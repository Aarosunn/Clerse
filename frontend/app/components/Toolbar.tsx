"use client";

import { useState, ReactNode } from "react";
import { NodeKind } from "@/types/nodes";
import { Message } from "@/types/messages";
import {
  SparkleIcon,
  PdfIcon,
  PlayCircleIcon,
  ArticleIcon,
  ImageIcon,
  FlashcardIcon,
  QuizIcon,
  TextIcon,
  MarkdownIcon,
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

/* Node type creation buttons */
const NODE_TOOLS: { kind: NodeKind; icon: (s: number) => ReactNode; label: string; color: string }[] = [
  { kind: "claude",    icon: (s) => <SparkleIcon size={s} />,     label: "Claude",   color: "#476083" },
  { kind: "pdf",       icon: (s) => <PdfIcon size={s} />,         label: "PDF",      color: "#a43c12" },
  { kind: "youtube",   icon: (s) => <PlayCircleIcon size={s} />,  label: "YouTube",  color: "#00668a" },
  { kind: "article",   icon: (s) => <ArticleIcon size={s} />,     label: "Article",  color: "#4a7c59" },
  { kind: "image",     icon: (s) => <ImageIcon size={s} />,       label: "Image",    color: "#7b5ea7" },
  { kind: "flashcard", icon: (s) => <FlashcardIcon size={s} />,   label: "Cards",    color: "#c89b3c" },
  { kind: "quiz",      icon: (s) => <QuizIcon size={s} />,       label: "Quiz",     color: "#d97706" },
  { kind: "text",      icon: (s) => <TextIcon size={s} />,       label: "Text",     color: "#6d7981" },
  { kind: "pdfdoc",    icon: (s) => <MarkdownIcon size={s} />,   label: "Doc",      color: "#a43c12" },
];

function Divider() {
  return <div className="w-px h-8 bg-primary/10 mx-2" />;
}

export default function Toolbar({ onAddNode, onStartDrag, onShare, roomId, draggingNodeType }: ToolbarProps) {
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
      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-8 py-4 rounded-full shadow-2xl"
      style={{
        background: "rgba(255, 255, 255, 0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 8px 32px rgba(28, 28, 25, 0.08), 0 2px 8px rgba(0, 191, 255, 0.06)",
        border: "1px solid rgba(188, 200, 209, 0.25)",
      }}
    >
      {/* Node creation tools */}
      {NODE_TOOLS.map(({ kind, icon, label, color }) => (
        <button
          key={kind}
          title={`Add ${label} node`}
          onClick={() => handleNodeClick(kind)}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all hover:scale-110 active:scale-95 hover:bg-surface-container/60"
          style={{
            color,
            background: draggingNodeType === kind ? "rgba(71,96,131,0.12)" : "transparent",
            transform: draggingNodeType === kind ? "scale(0.9)" : "scale(1)",
          }}
        >
          {icon(26)}
          <span
            className="font-label uppercase tracking-widest mt-1"
            style={{ fontSize: 9, color: "#6d7981" }}
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
        className="flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all hover:scale-110 active:scale-95"
        style={{ color: copied ? "#27c93f" : roomId ? "#00BFFF" : "#00668a" }}
      >
        {copied ? (
          <CheckCircleIcon size={26} />
        ) : roomId ? (
          <GroupIcon size={26} />
        ) : (
          <ShareIcon size={26} />
        )}
        <span
          className="font-label uppercase tracking-widest mt-1"
          style={{ fontSize: 9, color: roomId && !copied ? "#00BFFF" : "#6d7981" }}
        >
          {copied ? "Copied" : roomId ? "Live" : "Share"}
        </span>
      </button>

      {/* Live pulse indicator */}
      {roomId && !copied && (
        <div className="absolute top-2 right-4 w-3 h-3 rounded-full bg-[#00BFFF] animate-pulse" />
      )}
    </div>
  );
}

