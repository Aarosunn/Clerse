"use client";

import { useState } from "react";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import { YouTubeNodeData, ClaudeNodeData } from "@/types/nodes";
import { buildUserMessage } from "@/lib/conversations";
import { PlayCircleIcon, DownloadIcon, SparkleIcon } from "../Icons";
import WindowControls from "./WindowControls";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function YouTubeNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as YouTubeNodeData;
  const [url, setUrl] = useState(data.url);
  const [transcript, setTranscript] = useState(data.transcript);
  const [title, setTitle] = useState(data.title);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const { addNodes, addEdges, getNode } = useReactFlow();

  async function extract() {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/extract/youtube`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      setTranscript(json.transcript ?? "");
      setTitle(json.title ?? url);
    } catch {
      setTranscript("Could not fetch transcript — check backend.");
      setTitle(url);
    }
    setLoading(false);
  }

  function chatAboutThis() {
    if (!transcript) return;
    const branchId = crypto.randomUUID();
    const pos = getNode(id)?.position ?? { x: 0, y: 0 };
    addNodes({
      id: branchId,
      type: "claude" as const,
      position: { x: pos.x + 400, y: pos.y },
      data: {
        kind: "claude" as const,
        label: "YouTube Chat",
        conversationId: branchId,
        model: "claude-sonnet-4-6",
        initialMessages: [
          buildUserMessage(`YouTube: "${title}"\n\nTranscript:\n${transcript.slice(0, 8000)}`),
        ],
      } satisfies ClaudeNodeData,
      style: { width: 420 },
    });
    addEdges({ id: `${id}-${branchId}`, source: id, target: branchId, animated: true, style: { stroke: "#00668a", strokeWidth: 1.5 } });
  }

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{
        width: "100%",
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(28,28,25,0.08)",
        border: "1px solid rgba(188,200,209,0.15)",
      }}
    >
      <NodeResizer minWidth={280} minHeight={180} color="#00668a" />
      <Handle type="target" position={Position.Top} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: "rgba(0,102,138,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <PlayCircleIcon size={16} style={{ color: "#00668a" }} />
          <span className="font-label uppercase tracking-widest text-on-surface-variant" style={{ fontSize: 10 }}>
            YouTube
          </span>
        </div>
      </div>

      {!minimized && (
        <div style={{ padding: "14px 16px 16px" }} className="flex flex-col gap-3">
          {/* URL input */}
          <div className="flex gap-2 items-center">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && extract()}
            placeholder="Paste YouTube URL…"
            className="flex-1 font-body text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-3 py-2.5"
            style={{ background: "#f0ede8", border: "none", fontSize: 12 }}
          />
          <button
            onClick={extract}
            disabled={loading || !url.trim()}
            className="w-8 h-8 rounded-full text-on-secondary flex items-center justify-center hover:brightness-110 disabled:opacity-40 active:scale-95 transition-all shrink-0"
            style={{ background: "#00668a" }}
          >
            <DownloadIcon size={14} />
          </button>
        </div>

        {loading && (
          <p className="font-label uppercase tracking-widest text-center animate-pulse" style={{ fontSize: 10, color: "#00668a" }}>
            Fetching transcript…
          </p>
        )}

        {transcript && (
          <>
            {title && (
              <div className="px-3 py-2 rounded-xl" style={{ background: "#f0ede8" }}>
                <p className="font-label uppercase tracking-widest text-on-surface-variant truncate" style={{ fontSize: 10 }}>{title}</p>
              </div>
            )}
            <div className="rounded-xl px-3 py-2 overflow-y-auto" style={{ background: "#f0ede8", maxHeight: 100 }}>
              <p className="font-body text-xs text-on-surface-variant leading-relaxed">{transcript.slice(0, 400)}…</p>
            </div>
            <button
              onClick={chatAboutThis}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-on-secondary font-label uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
              style={{ fontSize: 10, background: "#00668a" }}
            >
              <SparkleIcon size={14} />
              Chat About This
            </button>
          </>
        )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
