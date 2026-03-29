"use client";

import { useState } from "react";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import { ArticleNodeData, ClaudeNodeData } from "@/types/nodes";
import { buildUserMessage } from "@/lib/conversations";
import { ArticleIcon, DownloadIcon, SparkleIcon } from "../Icons";
import { useConnectMode } from "../Canvas";
import WindowControls from "./WindowControls";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ArticleNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as ArticleNodeData;
  const [url, setUrl] = useState(data.url);
  const [content, setContent] = useState(data.content);
  const [title, setTitle] = useState(data.title);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const ACCENT = "#4a7c59";
  const { addNodes, addEdges, getNode } = useReactFlow();
  const { startConnect: startConnectMode } = useConnectMode();

  function handleConnect() {
    if (!content) return;
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `Article: "${title}"\n\n${content.slice(0, 8000)}` }],
    }];
    startConnectMode(id, msgs);
  }

  async function extract() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/extract/article`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      setContent(json.content ?? "");
      setTitle(json.title ?? url);
    } catch {
      setContent("Could not extract article — check backend.");
      setTitle(url);
    }
    setLoading(false);
  }

  function chatAboutThis() {
    if (!content) return;
    const branchId = crypto.randomUUID();
    const pos = getNode(id)?.position ?? { x: 0, y: 0 };
    addNodes({
      id: branchId,
      type: "claude" as const,
      position: { x: pos.x + 400, y: pos.y },
      data: {
        kind: "claude" as const,
        label: "Article Chat",
        conversationId: branchId,
        model: "claude-sonnet-4-6",
        initialMessages: [buildUserMessage(`Article: "${title}"\n\n${content.slice(0, 8000)}`)],
      } satisfies ClaudeNodeData,
      style: { width: 420 },
    });
    addEdges({ id: `${id}-${branchId}`, source: id, target: branchId, animated: true, style: { stroke: ACCENT, strokeWidth: 1.5 } });
  }

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{ width: "100%", background: "#ffffff", boxShadow: "0 8px 24px rgba(28,28,25,0.08)", border: "1px solid rgba(188,200,209,0.15)" }}
    >
      <NodeResizer minWidth={280} minHeight={180} color={ACCENT} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: `rgba(74,124,89,0.04)` }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <ArticleIcon size={16} style={{ color: ACCENT }} />
          <span className="font-label uppercase tracking-widest text-on-surface-variant" style={{ fontSize: 10 }}>Article</span>
        </div>
        {content && (
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
            style={{ fontSize: 10, background: "#00668a", color: "white", fontWeight: 600 }}
            title="Connect this article to another node"
          >
            Connect
          </button>
        )}
      </div>

      {!minimized && (
        <div style={{ padding: "14px 16px 16px" }} className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && extract()}
            placeholder="Paste article URL…"
            className="flex-1 font-body text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-3 py-2.5"
            style={{ background: "#f0ede8", border: "none", fontSize: 12 }}
          />
          <button
            onClick={extract}
            disabled={loading || !url.trim()}
            className="w-8 h-8 rounded-full text-white flex items-center justify-center hover:brightness-110 disabled:opacity-40 active:scale-95 transition-all shrink-0"
            style={{ background: ACCENT }}
          >
            <DownloadIcon size={14} />
          </button>
        </div>

        {loading && (
          <p className="font-label uppercase tracking-widest text-center animate-pulse" style={{ fontSize: 10, color: ACCENT }}>
            Extracting…
          </p>
        )}

        {content && (
          <>
            {title && (
              <div className="px-3 py-2 rounded-xl" style={{ background: "#f0ede8" }}>
                <p className="font-label uppercase tracking-widest text-on-surface-variant truncate" style={{ fontSize: 10 }}>{title}</p>
              </div>
            )}
            <div className="rounded-xl px-3 py-2 overflow-y-auto" style={{ background: "#f0ede8", maxHeight: 100 }}>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed">{content.slice(0, 400)}…</p>
            </div>
            <button
              onClick={chatAboutThis}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-label uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
              style={{ fontSize: 10, background: ACCENT }}
            >
              <SparkleIcon size={14} />
              Chat About This
            </button>
          </>
        )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
