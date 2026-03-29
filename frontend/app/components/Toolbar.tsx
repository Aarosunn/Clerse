"use client";

import { useState, ReactNode } from "react";
import { NodeKind } from "@/types/nodes";
import { Message } from "@/types/messages";
import {
  PanToolIcon,
  SelectIcon,
  ConnectIcon,
  SparkleIcon,
  PdfIcon,
  PlayCircleIcon,
  ArticleIcon,
  ImageIcon,
  FlashcardIcon,
  ShareIcon,
  GroupIcon,
  CheckCircleIcon,
} from "./Icons";

interface ToolbarProps {
  onAddNode: (kind: NodeKind) => void;
  onStartDrag?: (kind: NodeKind) => void;
  onBranch: (
    parentId: string,
    parentPosition: { x: number; y: number },
    messages: Message[]
  ) => void;
  onShare: () => void;
  roomId: string | null;
  workspaceId?: string;
  draggingNodeType?: NodeKind | null;
}

/* Canvas tool buttons (pan, select, connect) */
const CANVAS_TOOLS: { icon: (size: number) => ReactNode; id: string; label: string }[] = [
  { id: "pan", icon: (s) => <PanToolIcon size={s} />, label: "Pan" },
  { id: "select", icon: (s) => <SelectIcon size={s} />, label: "Select" },
  { id: "connect", icon: (s) => <ConnectIcon size={s} />, label: "Connect" },
];

/* Node type creation buttons */
const NODE_TOOLS: { kind: NodeKind; icon: (s: number) => ReactNode; label: string; color: string }[] = [
  { kind: "claude",    icon: (s) => <SparkleIcon size={s} />,     label: "Claude",   color: "#476083" },
  { kind: "pdf",       icon: (s) => <PdfIcon size={s} />,         label: "PDF",      color: "#a43c12" },
  { kind: "youtube",   icon: (s) => <PlayCircleIcon size={s} />,  label: "YouTube",  color: "#00668a" },
  { kind: "article",   icon: (s) => <ArticleIcon size={s} />,     label: "Article",  color: "#4a7c59" },
  { kind: "image",     icon: (s) => <ImageIcon size={s} />,       label: "Image",    color: "#7b5ea7" },
  { kind: "flashcard", icon: (s) => <FlashcardIcon size={s} />,   label: "Cards",    color: "#c89b3c" },
];

function Divider() {
  return <div className="w-px h-6 bg-primary/10 mx-2" />;
}

export default function Toolbar({ onAddNode, onStartDrag, onShare, roomId, draggingNodeType }: ToolbarProps) {
  const [activeTool, setActiveTool] = useState("pan");
  const [copied, setCopied] = useState(false);

  function shareCanvas() {
    onShare();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleNodeClick(kind: NodeKind) {
    if (onStartDrag) {
      onStartDrag(kind);
    } else {
      onAddNode(kind);
    }
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
          key={tool.id}
          title={tool.label}
          onClick={() => setActiveTool(tool.id)}
          className="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95"
          style={{
            color: activeTool === tool.id ? "#476083" : "#6d7981",
            background: activeTool === tool.id ? "rgba(71,96,131,0.08)" : "transparent",
          }}
        >
          {tool.icon(18)}
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
          onClick={() => handleNodeClick(kind)}
          className="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95 hover:bg-surface-container/60"
          style={{
            color,
            background: draggingNodeType === kind ? "rgba(71,96,131,0.12)" : "transparent",
            transform: draggingNodeType === kind ? "scale(0.9)" : "scale(1)",
          }}
        >
          {icon(18)}
          <span
            className="font-label uppercase tracking-widest mt-0.5"
            style={{ fontSize: 7, color: "#6d7981" }}
          >
            {label}
          </span>
        </button>
      ))}

      <Divider />

      {/* Share / Live indicator */}
      <button
        title={roomId ? "Room active — copy link" : "Go live & copy share link"}
        onClick={shareCanvas}
        className="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-110 active:scale-95"
        style={{ color: copied ? "#27c93f" : roomId ? "#00BFFF" : "#00668a" }}
      >
        {copied ? (
          <CheckCircleIcon size={18} />
        ) : roomId ? (
          <GroupIcon size={18} />
        ) : (
          <ShareIcon size={18} />
        )}
        <span
          className="font-label uppercase tracking-widest mt-0.5"
          style={{ fontSize: 7, color: roomId && !copied ? "#00BFFF" : "#6d7981" }}
        >
          {copied ? "Copied" : roomId ? "Live" : "Share"}
        </span>
      </button>

      {/* Live pulse indicator */}
      {roomId && !copied && (
        <div className="absolute -top-1 right-4 w-2.5 h-2.5 rounded-full bg-[#00BFFF] animate-pulse" />
      )}
    </div>
  );
}
