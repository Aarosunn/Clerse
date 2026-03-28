"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Edge,
  NodeTypes,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NodeKind, ClaudeNodeData } from "@/types/nodes";
import { Message } from "@/types/messages";
import Toolbar from "./Toolbar";
import ClaudeNode from "./nodes/ClaudeNode";
import PDFNode from "./nodes/PDFNode";
import YouTubeNode from "./nodes/YouTubeNode";
import ArticleNode from "./nodes/ArticleNode";
import ImageNode from "./nodes/ImageNode";
import FlashcardNode from "./nodes/FlashcardNode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes: NodeTypes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  claude: ClaudeNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdf: PDFNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  youtube: YouTubeNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  article: ArticleNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image: ImageNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flashcard: FlashcardNode as any,
};

interface CanvasProps {
  workspaceId: string;
}

function CanvasInner({ workspaceId }: CanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, , onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { addNodes, addEdges } = useReactFlow();

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  function spawnNode(kind: NodeKind, initialMessages?: Message[], position?: { x: number; y: number }) {
    const id = crypto.randomUUID();
    const pos = position ?? {
      x: 160 + Math.random() * 280,
      y: 120 + Math.random() * 200,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    switch (kind) {
      case "claude":
        data = {
          kind: "claude",
          label: "Claude",
          conversationId: id,
          model: "claude-sonnet-4-6",
          initialMessages,
        } satisfies ClaudeNodeData;
        break;
      case "pdf":
        data = { kind: "pdf", label: "PDF", fileName: "", extractedText: "", pageCount: 0 };
        break;
      case "youtube":
        data = { kind: "youtube", label: "YouTube", url: "", transcript: "", title: "" };
        break;
      case "article":
        data = { kind: "article", label: "Article", url: "", content: "", title: "" };
        break;
      case "image":
        data = { kind: "image", label: "Image", base64: "", mimeType: "image/jpeg", fileName: "" };
        break;
      case "flashcard":
        data = { kind: "flashcard", label: "Flashcards", cards: [], sourceNodeId: "" };
        break;
    }

    addNodes({ id, type: kind, position: pos, data: data as Record<string, unknown>, style: { width: kind === "claude" ? 420 : 340 } });
    return id;
  }

  function spawnBranch(
    parentId: string,
    parentPosition: { x: number; y: number },
    messages: Message[]
  ) {
    const branchId = spawnNode(
      "claude",
      messages,
      { x: parentPosition.x + 460, y: parentPosition.y + 40 }
    );
    addEdges({
      id: `${parentId}-${branchId}`,
      source: parentId,
      target: branchId,
      animated: true,
      style: { stroke: "#00668a", strokeWidth: 1.5 },
    });
  }

  const NODE_COLORS: Record<string, string> = {
    claude: "#476083",
    pdf: "#a43c12",
    youtube: "#00668a",
    article: "#4a7c59",
    image: "#7b5ea7",
    flashcard: "#c89b3c",
  };

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ background: "#f6f3ee" }}>
      {/* Layer 0: Dot grid */}
      <div className="absolute inset-0 canvas-grid" />

      {/* Layer 1: Radial ripple — ambient depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 50%, #00bdfd 0%, transparent 60%)",
          opacity: 0.06,
        }}
      />

      {/* Layer 2: Animated river flows */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 1 }}
        preserveAspectRatio="none"
      >
        <path
          className="river-path"
          d="M-100,180 C200,80 500,280 800,180 S1100,80 1600,180"
          stroke="#00bdfd"
          strokeWidth="1.5"
          fill="none"
          opacity="0.12"
        />
        <path
          className="river-path"
          d="M-100,380 C200,280 500,480 800,380 S1100,280 1600,380"
          stroke="#476083"
          strokeWidth="1"
          fill="none"
          opacity="0.08"
          style={{ animationDelay: "-3s" }}
        />
        <path
          className="river-path"
          d="M-100,560 C300,460 600,660 900,560 S1200,460 1600,560"
          stroke="#00bdfd"
          strokeWidth="0.8"
          fill="none"
          opacity="0.07"
          style={{ animationDelay: "-6s" }}
        />
      </svg>

      {/* Layer 3: React Flow (transparent bg so layers show through) */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.4 }}
          style={{ background: "transparent" }}
          proOptions={{ hideAttribution: false }}
        >
          <Controls position="bottom-left" style={{ marginBottom: 100 }} />
          <MiniMap
            nodeColor={(n) => NODE_COLORS[n.type ?? "claude"] ?? "#476083"}
            position="bottom-right"
            style={{ marginBottom: 100 }}
          />
        </ReactFlow>
      </div>

      {/* Taskbar — Layer 3 glassmorphism, fixed bottom center */}
      <Toolbar onAddNode={spawnNode} onBranch={spawnBranch} workspaceId={workspaceId} />
    </div>
  );
}

export default function Canvas({ workspaceId }: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner workspaceId={workspaceId} />
    </ReactFlowProvider>
  );
}
