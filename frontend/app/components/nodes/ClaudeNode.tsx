"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer, Node, Edge } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ClaudeNodeData } from "@/types/nodes";
import { Message } from "@/types/messages";
import { buildUserMessage, buildAssistantMessage, getTextContent } from "@/lib/conversations";
import { useConnectMode } from "../Canvas";
import ModelSelector from "../ModelSelector";
import WindowControls from "./WindowControls";
import {
  SparkleIcon,
  CheckCircleIcon,
  BranchIcon,
  CheckIcon,
  AddCircleIcon,
  GlobeIcon,
  HubIcon,
  LocationIcon,
  ArrowUpIcon,
  CopyIcon,
  ThumbUpIcon,
} from "../Icons";

interface PendingSuggestion {
  title: string;
  reason: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ClaudeNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as ClaudeNodeData;
  const [messages, setMessages] = useState<Message[]>(data.initialMessages ?? []);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [model, setModel] = useState(data.model);

  /* CHAT_NODE_DESIGN.md §2 — "Selecting" state */
  const [isSelecting, setIsSelecting] = useState(false);

  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [minimized, setMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ── Referenced messages from connected nodes ── */
  const [referencedMessages, setReferencedMessages] = useState<Message[]>(
    data.referencedMessages ?? []
  );

  useEffect(() => {
    if (data.referencedMessages && data.referencedMessages.length > 0) {
      setReferencedMessages(data.referencedMessages);
    }
  }, [data.referencedMessages]);

  /* ── Escape key exits fullscreen ── */
  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const { startConnect: startConnectMode, workspaceId, spawnNode } = useConnectMode();

  // Hydrate message history from DB on mount (fixes refresh + multiplayer blank history)
  useEffect(() => {
    if (!workspaceId) return;
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${BACKEND}/api/workspaces/${workspaceId}/nodes/${id}/messages`)
      .then((r) => r.ok ? r.json() : [])
      .then((rows: { role: string; content: string | null }[]) => {
        if (rows.length === 0) return;
        setMessages(
          rows
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({
              role: r.role as "user" | "assistant",
              content: [{ type: "text" as const, text: r.content ?? "" }],
            }))
        );
      })
      .catch(() => {/* keep initialMessages on error */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getNode, getEdges, addNodes, addEdges, setNodes } = useReactFlow();

  /* ── Send message ── */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;

    const content = input.trim();
    setMessages((m) => [...m, buildUserMessage(content)]);
    setInput("");
    setStreaming(true);
    setStreamText("");

    const edges = getEdges();
    const connected_node_ids = edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => (e.source === id ? e.target : e.source));

    let fullText = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          node_id: id,
          content,
          model,
          connected_node_ids,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "token") {
            fullText += event.text as string;
            setStreamText(fullText);
          } else if (event.type === "error") {
            throw new Error((event.message as string) ?? "Backend error");
          } else if (event.type === "tool_result") {
            const name = event.name as string;
            if (name === "suggest_branch") {
              setPendingSuggestion({
                title: event.title as string,
                reason: event.reason as string,
              });
            } else if (
              name === "create_branches" ||
              name === "create_markdown" ||
              name === "generate_flashcards" ||
              name === "generate_quiz" ||
              name === "create_pdf_doc"
            ) {
              const toolNodes = event.nodes as Node[];
              const toolEdges = event.edges as Edge[];
              if (toolNodes?.length) addNodes(toolNodes);
              if (toolEdges?.length) addEdges(toolEdges);
            }
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      fullText = fullText || "Error: could not reach backend.";
    } finally {
      setMessages((m) => [...m, buildAssistantMessage(fullText)]);
      setStreamText("");
      setStreaming(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [id, workspaceId, input, streaming, model, getEdges]);

  /* ── Branch from selected messages ── */
  function branchFromSelection() {
    if (selectedIndices.size === 0) return;
    const currentNode = getNode(id);
    const pos = currentNode?.position ?? { x: 0, y: 0 };

    const branchMessages = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map((i) => messages[i]);

    const branchId = crypto.randomUUID();
    addNodes({
      id: branchId,
      type: "claude" as const,
      position: { x: pos.x + 460, y: pos.y + 40 },
      data: {
        kind: "claude" as const,
        label: "Branch",
        conversationId: branchId,
        parentNodeId: id,
        model,
        initialMessages: branchMessages,
      } satisfies ClaudeNodeData,
      style: { width: 480, height: 520 },
    });
    addEdges({
      id: `${id}-${branchId}`,
      source: id,
      target: branchId,
      type: "river",
    });

    setIsSelecting(false);
    setSelectedIndices(new Set());
  }

  /* ── Toggle individual message selection ── */
  function toggleSelect(index: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) { next.delete(index); } else { next.add(index); }
      return next;
    });
  }

  /* ── Handle minimize with node resize ── */
  function handleMinimizeToggle() {
    const currentNode = getNode(id);
    if (!currentNode) return;

    setMinimized((prev) => {
      const newMinimized = !prev;
      // Resize node based on minimized state
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? {
                ...n,
                style: {
                  ...n.style,
                  width: newMinimized ? 280 : 480,
                  height: newMinimized ? 'auto' : 520,
                },
              }
            : n
        )
      );
      return newMinimized;
    });
  }

  /* ── Quick branch from a single assistant message ── */
  function quickBranch(upToIndex: number) {
    const currentNode = getNode(id);
    const pos = currentNode?.position ?? { x: 0, y: 0 };
    const branchId = crypto.randomUUID();

    addNodes({
      id: branchId,
      type: "claude" as const,
      position: { x: pos.x + 460, y: pos.y + 40 },
      data: {
        kind: "claude" as const,
        label: "Branch",
        conversationId: branchId,
        parentNodeId: id,
        model,
        initialMessages: messages.slice(0, upToIndex + 1),
      } satisfies ClaudeNodeData,
      style: { width: 480, height: 520 },
    });
    addEdges({
      id: `${id}-${branchId}`,
      source: id,
      target: branchId,
      type: "river",
    });
  }

  function acceptSuggestion() {
    if (!pendingSuggestion) return;
    const currentNode = getNode(id);
    const pos = currentNode?.position ?? { x: 0, y: 0 };
    const branchId = spawnNode("claude", undefined, { x: pos.x + 460, y: pos.y + 40 });
    setNodes((nds) =>
      nds.map((n) =>
        n.id === branchId ? { ...n, data: { ...n.data, label: pendingSuggestion!.title } } : n
      )
    );
    addEdges({
      id: `${id}-${branchId}`,
      source: id,
      target: branchId,
      type: "river",
    });
    setPendingSuggestion(null);
  }

  /* ── Shared inner UI ── */
  const chatUI = (
    <div
      className="bg-surface-container-lowest flex flex-col overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        borderRadius: isFullscreen ? "1rem" : undefined,
        boxShadow: isFullscreen ? "0 24px 80px rgba(28,28,25,0.18)" : undefined,
      }}
    >
      {/* ── Header §2 ── */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{
          background: "rgba(71,96,131,0.04)",
          borderBottom: "1px solid rgba(188,200,209,0.15)",
        }}
      >
        {/* Left: macOS dots + title */}
        <div className="flex items-center gap-3">
          <WindowControls
            nodeId={id}
            minimized={minimized}
            onToggleMinimize={handleMinimizeToggle}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((v) => !v)}
          />
          <span
            className="font-headline font-bold text-primary"
            style={{ fontSize: 13 }}
          >
            Clerse
          </span>
          {data.parentNodeId && !minimized && (
            <span
              className="font-label uppercase tracking-widest text-secondary/60"
              style={{ fontSize: 9 }}
            >
              · Branch
            </span>
          )}
        </div>

        {/* Right: model tag + selecting badge + branch action */}
        {!minimized && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <ModelSelector value={model} onChange={setModel} />

            <button
              onClick={() => {
                setIsSelecting((v) => !v);
                setSelectedIndices(new Set());
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
              style={{
                fontSize: 10,
                background: isSelecting ? "#00BFFF" : "rgba(0, 191, 255, 0.15)",
                color: isSelecting ? "white" : "#00BFFF",
                fontWeight: 600,
              }}
              title={isSelecting ? "Exit selection mode" : "Enter selection mode"}
            >
              <CheckCircleIcon size={12} />
              Selecting
            </button>

            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                const cached = selectedIndices.size > 0
                  ? Array.from(selectedIndices).sort((a, b) => a - b).map((i) => messages[i])
                  : [...messages];
                startConnectMode(id, cached, origin);
                setIsSelecting(false);
                setSelectedIndices(new Set());
              }}
              disabled={messages.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              style={{
                fontSize: 10,
                background: "#00668a",
                color: "white",
                fontWeight: 600,
              }}
              title="Connect context to another node"
            >
              <BranchIcon size={12} />
              Branch
            </button>

            {isSelecting && selectedIndices.size > 0 && (
              <button
                onClick={branchFromSelection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
                style={{
                  fontSize: 10,
                  background: "#a43c12",
                  color: "white",
                  fontWeight: 600,
                }}
                title="Create a new branch node from selection"
              >
                <AddCircleIcon size={12} />
                Create Branch
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Message area §3 ── */}
      {!minimized && <div
        className="overflow-y-auto nowheel"
        style={{
          padding: "24px 32px",
          background: "rgba(252,249,244,0.5)",
          flex: "1 1 0",
          minHeight: 180,
          maxHeight: isFullscreen ? undefined : "calc(100% - 130px)",
        }}
      >
        {referencedMessages.length > 0 && (
          <div
            className="mb-4 rounded-lg overflow-hidden"
            style={{
              border: "1px solid rgba(0,191,255,0.2)",
              background: "rgba(0,191,255,0.04)",
            }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{
                background: "rgba(0,191,255,0.08)",
                borderBottom: "1px solid rgba(0,191,255,0.12)",
              }}
            >
              <HubIcon size={12} className="text-[#00668a]" />
              <span
                className="font-label uppercase tracking-widest text-[#00668a]"
                style={{ fontSize: 9, fontWeight: 600 }}
              >
                Referenced Context
              </span>
              <span
                className="font-label text-[#00668a]/50 ml-auto"
                style={{ fontSize: 9 }}
              >
                {referencedMessages.length} message{referencedMessages.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-3 py-2 space-y-2 max-h-32 overflow-y-auto nowheel">
              {referencedMessages.map((msg, i) => (
                <div
                  key={`ref-${i}`}
                  className="font-body text-xs text-on-surface/70 leading-relaxed"
                >
                  <span
                    className="font-label uppercase tracking-widest mr-1.5"
                    style={{
                      fontSize: 8,
                      color: msg.role === "user" ? "#a43c12" : "#476083",
                      fontWeight: 600,
                    }}
                  >
                    {msg.role === "user" ? "User" : "Clerse"}:
                  </span>
                  {getTextContent(msg.content).slice(0, 120)}
                  {getTextContent(msg.content).length > 120 ? "..." : ""}
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.length === 0 && !streaming && referencedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-40">
            <SparkleIcon size={28} className="text-primary" />
            <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Start the stream
            </p>
          </div>
        )}

        {pendingSuggestion && (
          <div
            className="mb-4 rounded-lg overflow-hidden"
            style={{
              border: "1px solid rgba(164,60,18,0.25)",
              background: "rgba(164,60,18,0.04)",
            }}
          >
            <details>
              <summary
                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                style={{
                  background: "rgba(164,60,18,0.08)",
                  borderBottom: "1px solid rgba(164,60,18,0.12)",
                  listStyle: "none",
                }}
              >
                <BranchIcon size={12} className="text-[#a43c12]" />
                <span
                  className="font-label uppercase tracking-widest text-[#a43c12] flex-1"
                  style={{ fontSize: 9, fontWeight: 600 }}
                >
                  Branch Suggestion: {pendingSuggestion.title}
                </span>
              </summary>
              <div className="px-3 py-2">
                <p className="font-body text-xs text-on-surface/70 leading-relaxed mb-2">
                  {pendingSuggestion.reason}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={acceptSuggestion}
                    className="px-3 py-1 rounded-full font-label uppercase tracking-widest text-white transition-all"
                    style={{ fontSize: 9, fontWeight: 600, background: "#a43c12" }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setPendingSuggestion(null)}
                    className="px-3 py-1 rounded-full font-label uppercase tracking-widest transition-all"
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      background: "rgba(164,60,18,0.1)",
                      color: "#a43c12",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        <div className="space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`relative flex ${msg.role === "user" ? "flex-col items-end" : "items-start gap-3"}`}
            >
              {msg.role === "user" && (
                <>
                  {isSelecting && (
                    <button
                      onClick={() => toggleSelect(i)}
                      className="absolute -left-8 top-1 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                      style={{
                        border: selectedIndices.has(i)
                          ? "2px solid #00BFFF"
                          : "2px solid rgba(0,191,255,0.3)",
                        background: selectedIndices.has(i) ? "#00BFFF" : "white",
                      }}
                    >
                      {selectedIndices.has(i) && (
                        <CheckIcon size={12} className="text-white" />
                      )}
                    </button>
                  )}
                  <div
                    className="font-body text-sm text-on-surface leading-relaxed px-5 py-4 max-w-[88%] break-words whitespace-pre-wrap"
                    style={{
                      background: "rgba(235,232,227,0.80)",
                      borderRadius: "0.75rem 0.75rem 0 0.75rem",
                    }}
                  >
                    {getTextContent(msg.content)}
                  </div>
                </>
              )}

              {msg.role === "assistant" && (
                <>
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <SparkleIcon size={14} className="text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm text-on-surface leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {getTextContent(msg.content)}
                      </ReactMarkdown>
                    </div>

                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(getTextContent(msg.content))}
                        className="transition-colors"
                        style={{ color: "rgba(28,28,25,0.4)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#476083")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(28,28,25,0.4)")}
                        title="Copy"
                      >
                        <CopyIcon size={14} />
                      </button>
                      <button
                        onClick={() => quickBranch(i)}
                        className="flex items-center gap-1 font-label uppercase tracking-widest transition-colors"
                        style={{ fontSize: 9, color: "rgba(28,28,25,0.4)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#00668a")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(28,28,25,0.4)")}
                        title="Branch from here"
                      >
                        <BranchIcon size={14} />
                        Branch
                      </button>
                      <button
                        className="transition-colors"
                        style={{ color: "rgba(28,28,25,0.4)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#476083")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(28,28,25,0.4)")}
                        title="Thumbs up"
                      >
                        <ThumbUpIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {isSelecting && (
                    <button
                      onClick={() => toggleSelect(i)}
                      className="absolute -right-8 top-1 w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0"
                      style={{
                        border: selectedIndices.has(i)
                          ? "2px solid #00BFFF"
                          : "2px solid rgba(0,191,255,0.3)",
                        background: selectedIndices.has(i) ? "#00BFFF" : "white",
                      }}
                    >
                      {selectedIndices.has(i) && (
                        <CheckIcon size={12} className="text-white" />
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          ))}

          {streaming && streamText && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                <SparkleIcon size={14} className="text-white" />
              </div>
              <div className="font-body text-sm text-on-surface leading-relaxed flex-1 prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {streamText}
                </ReactMarkdown>
                <span
                  className="inline-block w-0.5 h-3.5 align-middle ml-0.5 animate-pulse"
                  style={{ background: "#00668a" }}
                />
              </div>
            </div>
          )}

          {streaming && !streamText && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <SparkleIcon size={14} className="text-white" />
              </div>
              <div className="flex items-center gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-secondary animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      }

      {/* ── Compose input §4 ── */}
      {!minimized && <div
        className="shrink-0"
        style={{
          background: "rgba(71,96,131,0.04)",
          borderTop: "1px solid rgba(188,200,209,0.15)",
          padding: "12px 16px 10px",
        }}
      >
        <div className="relative flex items-center">
          <div className="absolute left-3 flex items-center gap-1.5 z-10">
            <button className="text-on-surface-variant/40 hover:text-primary transition-colors">
              <AddCircleIcon size={16} />
            </button>
            <button className="text-on-surface-variant/40 hover:text-primary transition-colors">
              <GlobeIcon size={16} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Reply to the stream..."
            disabled={streaming}
            rows={1}
            className="w-full resize-none font-body text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none disabled:opacity-50 overflow-hidden"
            style={{
              background: "white",
              borderRadius: "1rem",
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 80,
              paddingRight: 48,
              boxShadow: "inset 0 1px 3px rgba(28,28,25,0.06)",
              border: "none",
            }}
          />

          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="absolute right-2 p-2 rounded-xl text-on-primary hover:brightness-110 disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: "#476083" }}
          >
            <ArrowUpIcon size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded-full font-label uppercase tracking-widest text-on-surface-variant/50 hover:text-primary transition-colors"
            style={{ fontSize: 9, background: "rgba(71,96,131,0.06)" }}
          >
            <HubIcon size={11} />
            Attach Nodes
          </button>
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded-full font-label uppercase tracking-widest text-on-surface-variant/50 hover:text-secondary transition-colors"
            style={{ fontSize: 9, background: "rgba(0,102,138,0.06)" }}
          >
            <LocationIcon size={11} />
            Spatial Context
          </button>
          <span
            className="font-label uppercase tracking-widest ml-auto"
            style={{ fontSize: 9, color: "rgba(61,72,80,0.35)" }}
          >
            Press ⌘ + Enter to Flow
          </span>
        </div>
      </div>}
    </div>
  );

  return (
    /* CHAT_NODE_DESIGN.md §1 — Node Container */
    <>
      <div
        className="bg-surface-container-lowest rounded-xl flex flex-col animate-fade-scale overflow-hidden relative"
        style={{
          width: "100%",
          minHeight: minimized ? 48 : 320,
          height: minimized ? "auto" : "100%",
          border: "1px solid rgba(188,200,209,0.10)",
          boxShadow: "0 12px 40px rgba(28,28,25,0.06)",
        }}
      >
        {!minimized && !isFullscreen && (
          <NodeResizer
            minWidth={480}
            minHeight={260}
            lineStyle={{ stroke: "rgba(71,96,131,0.3)", strokeWidth: 6, strokeOpacity: 0 }}
            handleStyle={{
              width: 14,
              height: 14,
              borderRadius: 7,
              background: "#476083",
              border: "none",
              opacity: 0.5,
            }}
          />
        )}
        {/* ── Resize grip texture ── */}
        {!minimized && !isFullscreen && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              width: 16,
              height: 16,
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              {[4,8,12].map(x =>
                [4,8,12].filter(y => x + y >= 12).map(y => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={1.2} fill="rgba(71,96,131,0.40)" />
                ))
              )}
            </svg>
          </div>
        )}
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

        {/* When fullscreen, show a minimal placeholder card on the canvas */}
        {isFullscreen ? (
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{
              background: "rgba(71,96,131,0.04)",
              borderBottom: "1px solid rgba(188,200,209,0.15)",
            }}
          >
            <WindowControls
              nodeId={id}
              minimized={minimized}
              onToggleMinimize={handleMinimizeToggle}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(false)}
            />
            <span className="font-headline font-bold text-primary" style={{ fontSize: 13 }}>
              Clerse
            </span>
            <span
              className="font-label uppercase tracking-widest text-secondary/50 ml-2"
              style={{ fontSize: 9 }}
            >
              · Fullscreen
            </span>
          </div>
        ) : chatUI}

        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      </div>

      {/* ── Fullscreen portal overlay ── */}
      {isFullscreen && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(28,28,25,0.55)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
        >
          <div
            style={{
              position: "absolute",
              inset: 24,
              borderRadius: "1.25rem",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 32px 100px rgba(28,28,25,0.30)",
              border: "1px solid rgba(188,200,209,0.18)",
            }}
          >
            {chatUI}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

