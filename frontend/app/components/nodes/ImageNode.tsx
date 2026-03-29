"use client";

import { useState, useRef } from "react";
import { Handle, Position, NodeProps, useReactFlow, NodeResizer } from "@xyflow/react";
import { ImageNodeData, ClaudeNodeData } from "@/types/nodes";
import { buildImageMessage } from "@/lib/conversations";
import { ImageIcon, AddPhotoIcon, SparkleIcon } from "../Icons";
import { useConnectMode } from "../Canvas";
import WindowControls from "./WindowControls";

const ACCENT = "#7b5ea7";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function ImageNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as ImageNodeData;
  const [base64, setBase64] = useState(data.base64);
  const [mimeType, setMimeType] = useState(data.mimeType);
  const [fileName, setFileName] = useState(data.fileName);
  const [question, setQuestion] = useState("");
  const [minimized, setMinimized] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addNodes, addEdges, getNode } = useReactFlow();
  const { startConnect: startConnectMode } = useConnectMode();

  function handleConnect() {
    if (!base64) return;
    // For images, pass a text description — the actual vision call happens in ClaudeNode
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `[Image: ${fileName}] Attached image for analysis.` }],
    }];
    startConnectMode(id, msgs);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setMimeType(file.type as ImageNodeData["mimeType"]);
    const reader = new FileReader();
    reader.onload = (e) =>
      setBase64((e.target?.result as string).split(",")[1]);
    reader.readAsDataURL(file);
  }

  function analyzeImage() {
    if (!base64) return;
    const branchId = crypto.randomUUID();
    const pos = getNode(id)?.position ?? { x: 0, y: 0 };
    addNodes({
      id: branchId,
      type: "claude" as const,
      position: { x: pos.x + 400, y: pos.y },
      data: {
        kind: "claude" as const,
        label: "Image Chat",
        conversationId: branchId,
        model: "claude-sonnet-4-6",
        initialMessages: [
          buildImageMessage(
            base64,
            mimeType,
            question || "Describe this image in detail."
          ),
        ],
      } satisfies ClaudeNodeData,
      style: { width: 420 },
    });
    addEdges({ id: `${id}-${branchId}`, source: id, target: branchId, animated: true, style: { stroke: ACCENT, strokeWidth: 1.5 } });
  }

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{ width: "100%", height: "100%", background: "#ffffff", boxShadow: "0 8px 24px rgba(28,28,25,0.08)", border: "1px solid rgba(188,200,209,0.15)" }}
    >
      <NodeResizer minWidth={260} minHeight={180} color={ACCENT} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: `rgba(123,94,167,0.04)` }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <ImageIcon size={16} style={{ color: ACCENT }} />
          <span className="font-label uppercase tracking-widest text-on-surface-variant" style={{ fontSize: 10 }}>Image</span>
        </div>
        {base64 && (
          <button
            onClick={handleConnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
            style={{ fontSize: 10, background: "#00668a", color: "white", fontWeight: 600 }}
            title="Connect this image to another node"
          >
            Connect
          </button>
        )}
      </div>

      {!minimized && (
        <div style={{ padding: "14px 16px 16px", flex: "1 1 0", minHeight: 0, overflowY: "auto" }} className="flex flex-col gap-3">
          {!base64 ? (
            <div
              className="rounded-xl flex flex-col items-center justify-center cursor-pointer hover:brightness-95 transition-all"
              style={{
                minHeight: 140,
                border: "2px dashed rgba(123,94,167,0.25)",
                background: `rgba(123,94,167,0.04)`,
              }}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith("image/")) handleFile(file);
              }}
            >
              <AddPhotoIcon size={36} style={{ color: ACCENT, opacity: 0.4 }} />
              <p className="font-label uppercase tracking-widest mt-2" style={{ fontSize: 10, color: "#6d7981" }}>
                Drop image or click
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:${mimeType};base64,${base64}`}
                alt={fileName}
                className="w-full rounded-xl object-cover"
                style={{ maxHeight: 180 }}
              />
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this image… (optional)"
                className="font-body text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-3 py-2.5"
                style={{ background: "#f0ede8", border: "none", fontSize: 12 }}
              />
              <button
                onClick={analyzeImage}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-label uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                style={{ fontSize: 10, background: ACCENT }}
              >
                <SparkleIcon size={14} />
                Analyze with Claude
              </button>
            </>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
