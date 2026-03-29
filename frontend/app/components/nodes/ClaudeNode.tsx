"use client";

import { useState, useRef, useCallback } from "react";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ClaudeNodeData } from "@/types/nodes";
import { Message } from "@/types/messages";
import { buildUserMessage, buildAssistantMessage, getTextContent } from "@/lib/conversations";
import ModelSelector from "../ModelSelector";
import WindowControls from "./WindowControls";
import {
  SparkleIcon,
  CheckCircleIcon,
  BranchIcon,
  ChecklistIcon,
  CloseIcon,
  CheckIcon,
  AddCircleIcon,
  GlobeIcon,
  HubIcon,
  LocationIcon,
  ArrowUpIcon,
  CopyIcon,
  ThumbUpIcon,
} from "../Icons";

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
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [minimized, setMinimized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { getNode, addNodes, addEdges } = useReactFlow();

  /* ── Send message ── */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;

    const userMsg = buildUserMessage(input.trim());
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setStreamText("");

    // Stub response — simulates streaming without calling the backend
    const stub = "This is a placeholder response. Connect the backend to get real Claude answers.";
    for (let i = 0; i <= stub.length; i++) {
      await new Promise((r) => setTimeout(r, 15));
      setStreamText(stub.slice(0, i));
    }

    setMessages((m) => [...m, buildAssistantMessage(stub)]);
    setStreamText("");
    setStreaming(false);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [input, messages, streaming]);

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
      style: { width: 420 },
    });
    addEdges({
      id: `${id}-${branchId}`,
      source: id,
      target: branchId,
      animated: true,
      style: { stroke: "#00668a", strokeWidth: 1.5 },
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
      style: { width: 420 },
    });
    addEdges({
      id: `${id}-${branchId}`,
      source: id,
      target: branchId,
      animated: true,
      style: { stroke: "#00668a", strokeWidth: 1.5 },
    });
  }

  return (
    /* CHAT_NODE_DESIGN.md §1 — Node Container */
    <div
      className="bg-surface-container-lowest rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{
        width: "100%",
        minHeight: 320,
        border: "1px solid rgba(188,200,209,0.10)",
        boxShadow: "0 12px 40px rgba(28,28,25,0.06)",
      }}
    >
      <NodeResizer minWidth={320} minHeight={260} color="#476083" />
      <Handle type="target" position={Position.Top} />

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
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <span
            className="font-headline font-bold text-primary"
            style={{ fontSize: 13 }}
          >
            Intelligence Stream
          </span>
          {data.parentNodeId && (
            <span
              className="font-label uppercase tracking-widest text-secondary/60"
              style={{ fontSize: 9 }}
            >
              · Branch
            </span>
          )}
        </div>

        {/* Right: model tag + selecting badge + branch action */}
        <div className="flex items-center gap-2">
          <ModelSelector value={model} onChange={setModel} />

          {/* CHAT_NODE_DESIGN.md §2 — Selecting badge */}
          {isSelecting && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full font-label uppercase tracking-widest text-white"
              style={{ fontSize: 9, background: "#00BFFF" }}
            >
              <CheckCircleIcon size={12} />
              Selecting
            </div>
          )}

          {/* Branch from selection */}
          {isSelecting && selectedIndices.size > 0 && (
            <button
              onClick={branchFromSelection}
              className="flex items-center gap-1 px-2 py-1 rounded-full font-label uppercase tracking-widest text-on-tertiary hover:brightness-110 active:scale-95 transition-all"
              style={{ fontSize: 9, background: "#a43c12" }}
            >
              <BranchIcon size={12} />
              Branch
            </button>
          )}

          {/* Toggle selection mode */}
          <button
            onClick={() => {
              setIsSelecting((v) => !v);
              setSelectedIndices(new Set());
            }}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-surface-container"
            style={{ color: isSelecting ? "#00BFFF" : "#6d7981" }}
            title={isSelecting ? "Exit selection" : "Select messages to branch"}
          >
            {isSelecting ? <CloseIcon size={14} /> : <ChecklistIcon size={14} />}
          </button>
        </div>
      </div>

      {/* ── Message area §3 ── */}
      {!minimized && <div
        className="flex-1 overflow-y-auto"
        style={{
          padding: "24px 32px",
          background: "rgba(252,249,244,0.5)",
          maxHeight: 380,
        }}
      >
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-40">
            <SparkleIcon size={28} className="text-primary" />
            <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Start the stream
            </p>
          </div>
        )}

        <div className="space-y-6">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`relative flex ${msg.role === "user" ? "flex-col items-end" : "items-start gap-3"}`}
            >
              {/* ── User message §3A ── */}
              {msg.role === "user" && (
                <>
                  {/* Selection checkbox — CRITICAL per spec */}
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
                    className="font-body text-sm text-on-surface leading-relaxed px-5 py-4 max-w-[88%]"
                    style={{
                      background: "rgba(235,232,227,0.80)",
                      borderRadius: "0.75rem 0.75rem 0 0.75rem",
                    }}
                  >
                    {getTextContent(msg.content)}
                  </div>
                </>
              )}

              {/* ── AI message §3B ── */}
              {msg.role === "assistant" && (
                <>
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5"
                  >
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

                    {/* §3C — Action bar */}
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

                  {/* Selection checkbox — right side for AI messages */}
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

          {/* Streaming in progress */}
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

          {/* Thinking dots */}
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
        {/* Textarea row */}
        <div className="relative flex items-center">
          {/* Left utilities */}
          <div className="absolute left-3 flex items-center gap-1.5 z-10">
            <button className="text-on-surface-variant/40 hover:text-primary transition-colors">
              <AddCircleIcon size={16} />
            </button>
            <button className="text-on-surface-variant/40 hover:text-primary transition-colors">
              <GlobeIcon size={16} />
            </button>
          </div>

          {/* Textarea */}
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

          {/* Submit button — inside textarea right */}
          <button
            onClick={sendMessage}
            disabled={streaming || !input.trim()}
            className="absolute right-2 p-2 rounded-xl text-on-primary hover:brightness-110 disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: "#476083" }}
          >
            <ArrowUpIcon size={14} />
          </button>
        </div>

        {/* Helper tags */}
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

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
