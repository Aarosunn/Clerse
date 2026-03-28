"use client";

import { useState } from "react";
import { NodeKind } from "@/types/nodes";
import { Message } from "@/types/messages";

interface ToolbarProps {
  onAddNode: (kind: NodeKind) => void;
  onBranch: (
    parentId: string,
    parentPosition: { x: number; y: number },
    messages: Message[]
  ) => void;
  workspaceId?: string;
}

/* Canvas tool buttons (pan, select, connect) */
const CANVAS_TOOLS = [
  { icon: "pan_tool", label: "Pan" },
  { icon: "ads_click", label: "Select" },
  { icon: "polyline", label: "Connect" },
];

/* Node type creation buttons */
const NODE_TOOLS: { kind: NodeKind; icon: string; label: string; color: string }[] = [
  { kind: "claude",    icon: "auto_awesome",   label: "Claude",   color: "#476083" },
  { kind: "pdf",       icon: "picture_as_pdf", label: "PDF",      color: "#a43c12" },
  { kind: "youtube",   icon: "play_circle",    label: "YouTube",  color: "#00668a" },
  { kind: "article",   icon: "article",        label: "Article",  color: "#4a7c59" },
  { kind: "image",     icon: "image",          label: "Image",    color: "#7b5ea7" },
  { kind: "flashcard", icon: "style",          label: "Cards",    color: "#c89b3c" },
];

function Divider() {
  return <div className="w-px h-6 bg-primary/10 mx-2" />;
}

export default function Toolbar({ onAddNode, workspaceId }: ToolbarProps) {
  const [activeTool, setActiveTool] = useState("pan_tool");
  const [copied, setCopied] = useState(false);

  function shareCanvas() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    /* NAVY_ACCENTED_DESIGN.md — fixed bottom center glass pill */
    <div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-6 py-3 rounded-full"
      style={{
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 8px 32px rgba(28, 28, 25, 0.08), 0 2px 8px rgba(0, 191, 255, 0.06)",
        border: "1px solid rgba(188, 200, 209, 0.25)",
      }}
    >
      {/* Canvas tools */}
      {CANVAS_TOOLS.map((tool) => (
        <button
          key={tool.icon}
          title={tool.label}
          onClick={() => setActiveTool(tool.icon)}
          className="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95"
          style={{
            color: activeTool === tool.icon ? "#476083" : "#6d7981",
            background: activeTool === tool.icon ? "rgba(71,96,131,0.08)" : "transparent",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {tool.icon}
          </span>
          <span
            className="font-label uppercase tracking-widest mt-0.5"
            style={{ fontSize: 7 }}
          >
            {tool.label}
          </span>
        </button>
      ))}

      <Divider />

      {/* Node creation tools */}
      {NODE_TOOLS.map(({ kind, icon, label, color }) => (
        <button
          key={kind}
          title={`Add ${label} node`}
          onClick={() => onAddNode(kind)}
          className="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95 hover:bg-surface-container/60"
          style={{ color }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {icon}
          </span>
          <span
            className="font-label uppercase tracking-widest mt-0.5"
            style={{ fontSize: 7, color: "#6d7981" }}
          >
            {label}
          </span>
        </button>
      ))}

      <Divider />

      {/* Share */}
      <button
        title="Copy share link"
        onClick={shareCanvas}
        className="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95"
        style={{ color: copied ? "#27c93f" : "#00668a" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
          {copied ? "check_circle" : "share"}
        </span>
        <span
          className="font-label uppercase tracking-widest mt-0.5"
          style={{ fontSize: 7, color: "#6d7981" }}
        >
          {copied ? "Copied" : "Share"}
        </span>
      </button>
    </div>
  );
}
