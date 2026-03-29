"use client";

import { useState, useRef } from "react";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import { PDFNodeData, ClaudeNodeData } from "@/types/nodes";
import { buildUserMessage } from "@/lib/conversations";
import {
  DescriptionIcon,
  ExpandIcon,
  CollapseIcon,
  UploadIcon,
  LoadingIcon,
  SparkleIcon,
} from "../Icons";
import { useConnectMode } from "../Canvas";
import WindowControls from "./WindowControls";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PDFNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as PDFNodeData;
  const [extracted, setExtracted] = useState(data.extractedText);
  const [fileName, setFileName] = useState(data.fileName);
  const [pageCount, setPageCount] = useState(data.pageCount);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addNodes, addEdges, getNode } = useReactFlow();
  const { startConnect: startConnectMode, workspaceId } = useConnectMode();

  function handleConnect() {
    if (!extracted) return;
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `PDF: "${fileName}" (${pageCount} pages)\n\n${extracted.slice(0, 8000)}` }],
    }];
    startConnectMode(id, msgs);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setFileName(file.name);
    const form = new FormData();
    form.append("file", file);
    form.append("workspace_id", workspaceId);
    form.append("node_id", id);
    try {
      const res = await fetch(`${BACKEND}/api/extract/pdf`, { method: "POST", body: form });
      const json = await res.json();
      const pages: { page: number; text: string }[] = json.pages ?? [];
      setExtracted(pages.map((p) => p.text).join("\n\n"));
      setPageCount(pages.length);
      if (json.filename) setFileName(json.filename);
    } catch {
      setExtracted("Could not extract PDF — check backend connection.");
    }
    setLoading(false);
  }

  function chatAboutThis() {
    if (!extracted) return;
    const branchId = crypto.randomUUID();
    const pos = getNode(id)?.position ?? { x: 0, y: 0 };
    addNodes({
      id: branchId,
      type: "claude" as const,
      position: { x: pos.x + 400, y: pos.y },
      data: {
        kind: "claude" as const,
        label: "PDF Chat",
        conversationId: branchId,
        model: "claude-sonnet-4-6",
        initialMessages: [
          buildUserMessage(
            `I have a PDF document: "${fileName}" (${pageCount} pages).\n\nContent:\n${extracted.slice(0, 8000)}`
          ),
        ],
      } satisfies ClaudeNodeData,
      style: { width: 420 },
    });
    addEdges({
      id: `${id}-${branchId}`,
      source: id,
      target: branchId,
      animated: true,
      style: { stroke: "#a43c12", strokeWidth: 1.5 },
    });
  }

  return (
    /* NAVY_ACCENTED_DESIGN.md §2 — Document/PDF Viewer Node */
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        background: "#e5e2dd", /* surface-container-highest */
        boxShadow: "0 8px 24px rgba(28,28,25,0.10)",
        border: "1px solid rgba(188,200,209,0.20)",
      }}
    >
      <NodeResizer minWidth={280} minHeight={200} color="#a43c12" />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ padding: "12px 16px" }}>
        {/* Mac controls + file name */}
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <DescriptionIcon size={16} className="text-primary" />
          <span
            className="font-label uppercase tracking-widest text-on-surface truncate max-w-[160px]"
            style={{ fontSize: 10 }}
          >
            {fileName || "Drop PDF here"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Connect button */}
          {extracted && (
            <button
              onClick={handleConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
              style={{ fontSize: 10, background: "#00668a", color: "white", fontWeight: 600 }}
              title="Connect this PDF to another node"
            >
              Connect
            </button>
          )}
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-outline hover:text-on-surface transition-colors cursor-pointer"
          >
            {expanded ? <CollapseIcon size={16} /> : <ExpandIcon size={16} />}
          </button>
        </div>
      </div>

      {/* PDF Preview area */}
      {!minimized && <div style={{ padding: "0 16px 16px", flex: "1 1 0", minHeight: 0, overflowY: "auto" }}>
        {!extracted ? (
          /* Drop zone */
          <div
            className="rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:brightness-95 active:scale-[0.99]"
            style={{
              aspectRatio: "3/4",
              maxHeight: expanded ? 480 : 220,
              background: "#ffffff",
              border: "1px solid rgba(188,200,209,0.20)",
              overflow: "hidden",
            }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file?.type === "application/pdf") handleFile(file);
            }}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <LoadingIcon
                  size={32}
                  className="animate-spin"
                  style={{ color: "#a43c12", opacity: 0.6 }}
                />
                <p
                  className="font-label uppercase tracking-widest"
                  style={{ fontSize: 10, color: "#a43c12" }}
                >
                  Extracting…
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-6">
                <UploadIcon
                  size={40}
                  style={{ color: "#a43c12", opacity: 0.35 }}
                />
                <p
                  className="font-label uppercase tracking-widest text-center"
                  style={{ fontSize: 10, color: "#6d7981" }}
                >
                  Drop PDF or click to upload
                </p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        ) : (
          /* NAVY_ACCENTED_DESIGN.md §2 — PDF render preview with gradient overlay */
          <div
            className="relative rounded-lg overflow-hidden group cursor-default"
            style={{
              aspectRatio: "3/4",
              maxHeight: expanded ? 480 : 220,
              background: "#ffffff",
              border: "1px solid rgba(188,200,209,0.20)",
              overflow: "hidden",
            }}
          >
            {/* Text content preview */}
            <div className="w-full h-full overflow-hidden p-4">
              <p
                className="font-body text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap"
                style={{ opacity: 0.7 }}
              >
                {extracted}
              </p>
            </div>

            {/* Gradient overlay with metadata — bottom */}
            <div
              className="absolute inset-0 flex items-end p-4"
              style={{
                background: "linear-gradient(to top, rgba(229,226,221,0.90) 0%, transparent 50%)",
              }}
            >
              <div className="w-full">
                <p
                  className="font-label uppercase tracking-widest text-on-surface-variant"
                  style={{ fontSize: 10 }}
                >
                  {pageCount} pages · {Math.round(extracted.length / 1000)}k chars
                </p>
                <button
                  onClick={chatAboutThis}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-on-tertiary font-label uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                  style={{ fontSize: 9, background: "#a43c12" }}
                >
                  <SparkleIcon size={12} />
                  Chat About This
                </button>
              </div>
            </div>
          </div>
        )}
      </div>}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
