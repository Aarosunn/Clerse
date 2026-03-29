"use client";

import { useState, useRef, useEffect } from "react";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import { TextNodeData } from "@/types/nodes";
import { useConnectMode } from "../Canvas";
import { TextIcon } from "../Icons";
import WindowControls from "./WindowControls";

const ACCENT = "#6d7981";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function TextNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as TextNodeData;
  const [content, setContent] = useState(data.content);
  const [minimized, setMinimized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { setNodes } = useReactFlow();
  const { startConnect: startConnectMode } = useConnectMode();

  // Sync content back to node data so it can be read by connected nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, content } }
          : n
      )
    );
  }, [content, id, setNodes]);

  // Auto-resize textarea
  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 300) + "px";
  }

  function handleConnect() {
    if (!content.trim()) return;
    // Build a simple message array from the text content for context transfer
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: content }],
    }];
    startConnectMode(id, msgs);
  }

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(28,28,25,0.08)",
        border: "1px solid rgba(188,200,209,0.15)",
      }}
    >
      <NodeResizer minWidth={240} minHeight={120} color={ACCENT} lineStyle={{ strokeWidth: 6, strokeOpacity: 0 }} handleStyle={{ width: 14, height: 14, borderRadius: 7 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{
          borderBottom: "1px solid rgba(188,200,209,0.12)",
          background: "rgba(109,121,129,0.04)",
        }}
      >
        <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
        <TextIcon size={16} style={{ color: ACCENT }} />
        <span
          className="font-label uppercase tracking-widest text-on-surface-variant"
          style={{ fontSize: 10 }}
        >
          Text
        </span>

        {/* Connect button */}
        <button
          onClick={handleConnect}
          disabled={!content.trim()}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          style={{
            fontSize: 10,
            background: "#00668a",
            color: "white",
            fontWeight: 600,
          }}
          title="Connect this text to another node"
        >
          Connect
        </button>
      </div>

      {/* Content area */}
      {!minimized && (
        <div className="nowheel" style={{ padding: "14px 16px 16px", flex: "1 1 0", minHeight: 0, overflowY: "auto" }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              autoResize();
            }}
            placeholder="Write freeform text context..."
            rows={4}
            className="w-full resize-none font-body text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-4 py-3"
            style={{
              background: "#f0ede8",
              border: "none",
              minHeight: 80,
              maxHeight: 300,
            }}
          />
          {content.trim() && (
            <p
              className="font-label uppercase tracking-widest mt-2 text-right"
              style={{ fontSize: 9, color: "rgba(109,121,129,0.5)" }}
            >
              {content.length} chars
            </p>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
