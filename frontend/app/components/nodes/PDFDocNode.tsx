"use client";

import { useState, useRef } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { PDFDocNodeData } from "@/types/nodes";
import { MarkdownIcon, SparkleIcon, DownloadIcon } from "../Icons";
import { useConnectMode } from "../Canvas";
import WindowControls from "./WindowControls";

const ACCENT = "#a43c12";

const PDFDOC_SYSTEM_PROMPT = `Generate a well-structured document from the provided context.
Use Markdown formatting with headers, bullet points, and clear sections.
Use LaTeX math notation (wrapped in $ or $$) where appropriate.
Respond ONLY with the Markdown content. No conversational wrapping.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PDFDocNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as PDFDocNodeData;
  const [markdown, setMarkdown] = useState(data.markdown);
  const [title, setTitle] = useState(data.title || "Untitled Document");
  const [generating, setGenerating] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [editing, setEditing] = useState(false);
  const streamRef = useRef("");
  const { startConnect: startConnectMode, workspaceId } = useConnectMode();

  function handleConnect() {
    if (!markdown.trim()) return;
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `Document "${title}":\n\n${markdown}` }],
    }];
    startConnectMode(id, msgs);
  }

  async function generateDocument() {
    if (!sourceText.trim()) return;
    setGenerating(true);
    streamRef.current = "";

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace_id: workspaceId,
        node_id: id,
        content: sourceText,
        model: "claude-sonnet-4-6",
        system_override: PDFDOC_SYSTEM_PROMPT,
        connected_node_ids: [],
      }),
    });

    const reader = res.body!.getReader();
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
        try {
          const event = JSON.parse(raw);
          if (event.type === "token") {
            streamRef.current += event.text as string;
            setMarkdown(streamRef.current);
          }
        } catch { /* skip */ }
      }
    }

    setGenerating(false);
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{ width: "100%", height: "100%", background: "#ffffff", boxShadow: "0 8px 24px rgba(28,28,25,0.08)", border: "1px solid rgba(188,200,209,0.15)" }}
    >
      <NodeResizer minWidth={300} minHeight={240} color={ACCENT} lineStyle={{ strokeWidth: 6, strokeOpacity: 0 }} handleStyle={{ width: 14, height: 14, borderRadius: 7 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: "rgba(164,60,18,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <MarkdownIcon size={16} style={{ color: ACCENT }} />
          {editing ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => { if (e.key === "Enter") setEditing(false); }}
              autoFocus
              className="font-label uppercase tracking-widest text-on-surface-variant outline-none bg-transparent border-b"
              style={{ fontSize: 10, borderColor: ACCENT }}
            />
          ) : (
            <span
              className="font-label uppercase tracking-widest text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors"
              style={{ fontSize: 10 }}
              onClick={() => setEditing(true)}
              title="Click to rename"
            >
              {title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {markdown.trim() && (
            <>
              <button
                onClick={downloadMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
                style={{ fontSize: 10, background: "rgba(164,60,18,0.1)", color: ACCENT, fontWeight: 600 }}
                title="Download as Markdown"
              >
                <DownloadIcon size={12} />
                .md
              </button>
              <button
                onClick={handleConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
                style={{ fontSize: 10, background: "#00668a", color: "white", fontWeight: 600 }}
                title="Connect this document to another node"
              >
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div style={{ padding: "14px 16px 16px", flex: "1 1 0", minHeight: 0, overflowY: "auto" }} className="flex flex-col gap-3 nowheel">
          {!markdown.trim() && !generating ? (
            <>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste content or describe the document you want to generate…"
                rows={4}
                className="font-body text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-3 py-2.5 resize-none"
                style={{ background: "#f0ede8", border: "none" }}
              />
              <button
                onClick={generateDocument}
                disabled={generating || !sourceText.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-label uppercase tracking-widest hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all"
                style={{ fontSize: 10, background: ACCENT }}
              >
                <SparkleIcon size={14} />
                Generate Document
              </button>
            </>
          ) : (
            <>
              {/* Rendered markdown */}
              <div
                className="rounded-xl overflow-y-auto nowheel"
                style={{
                  background: "#faf9f7",
                  border: "1px solid rgba(188,200,209,0.12)",
                  padding: "16px 20px",
                  maxHeight: 360,
                  minHeight: 120,
                }}
              >
                <div className="font-body text-sm text-on-surface leading-relaxed prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {markdown}
                  </ReactMarkdown>
                  {generating && (
                    <span
                      className="inline-block w-0.5 h-3.5 align-middle ml-0.5 animate-pulse"
                      style={{ background: ACCENT }}
                    />
                  )}
                </div>
              </div>

              {/* Footer info */}
              <div className="flex items-center justify-between">
                <p
                  className="font-label uppercase tracking-widest"
                  style={{ fontSize: 9, color: "rgba(164,60,18,0.5)" }}
                >
                  {markdown.length} chars · {markdown.split("\n").length} lines
                </p>
                <button
                  onClick={() => { setMarkdown(""); setSourceText(""); }}
                  className="font-label uppercase tracking-widest text-on-surface-variant/50 hover:text-secondary transition-colors"
                  style={{ fontSize: 9 }}
                >
                  Regenerate
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
