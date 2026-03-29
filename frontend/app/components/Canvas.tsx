"use client";

import { createContext, useCallback, useState, useEffect, useContext } from "react";
import {
  ReactFlow,
  Edge,
  Node,
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
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import { NodeKind, ClaudeNodeData } from "@/types/nodes";
import { Message } from "@/types/messages";
import { CURSOR_COLORS } from "@/lib/liveblocks";
import Toolbar from "./Toolbar";
import Presence from "./Presence";
import DotGrid from "./DotGrid";
import ClaudeNode from "./nodes/ClaudeNode";
import PDFNode from "./nodes/PDFNode";
import YouTubeNode from "./nodes/YouTubeNode";
import ArticleNode from "./nodes/ArticleNode";
import ImageNode from "./nodes/ImageNode";
import FlashcardNode from "./nodes/FlashcardNode";

/* ── Connect mode context ── */
interface ConnectContextValue {
  connectingFrom: string | null;
  startConnect: (nodeId: string) => void;
}

export const ConnectContext = createContext<ConnectContextValue>({
  connectingFrom: null,
  startConnect: () => {},
});

export function useConnectMode() {
  return useContext(ConnectContext);
}

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
  const { addNodes, addEdges, getNode, flowToScreenPosition } = useReactFlow();

  /* ── Connect mode state ── */
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mouseScreen, setMouseScreen] = useState<{ x: number; y: number } | null>(null);

  function startConnect(nodeId: string) {
    setConnectingFrom(nodeId);
  }

  function completeConnect(targetNodeId: string) {
    if (connectingFrom && connectingFrom !== targetNodeId) {
      setEdges((eds) =>
        addEdge(
          {
            id: `${connectingFrom}-${targetNodeId}`,
            source: connectingFrom,
            target: targetNodeId,
            animated: true,
            style: { stroke: "#00668a", strokeWidth: 1.5 },
          },
          eds
        )
      );
    }
    setConnectingFrom(null);
    setMouseScreen(null);
  }

  function cancelConnect() {
    setConnectingFrom(null);
    setMouseScreen(null);
  }

  // Track mouse for the connection line
  function handleMouseMove(e: React.MouseEvent) {
    if (connectingFrom) {
      setMouseScreen({ x: e.clientX, y: e.clientY });
    }
  }

  // Escape key cancels connect mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && connectingFrom) cancelConnect();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectingFrom]);

  /* ── Multiplayer: room activation ── */
  const [roomId, setRoomId] = useState<string | null>(null);

  // Auto-join room if ?room= param is in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) setRoomId(room);
  }, []);

  function activateRoom() {
    const id = `clerse-${workspaceId}`;
    setRoomId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("room", id);
    window.history.replaceState({}, "", url.toString());
    navigator.clipboard.writeText(url.toString());
  }

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

  /* ── Connection line: compute source screen position ── */
  function getSourceScreenPos(): { x: number; y: number } | null {
    if (!connectingFrom) return null;
    const sourceNode = getNode(connectingFrom);
    if (!sourceNode) return null;
    return flowToScreenPosition({
      x: sourceNode.position.x + ((sourceNode.measured?.width ?? sourceNode.width ?? 340) / 2),
      y: sourceNode.position.y + ((sourceNode.measured?.height ?? sourceNode.height ?? 200) / 2),
    });
  }

  const sourcePos = connectingFrom ? getSourceScreenPos() : null;

  return (
    <ConnectContext.Provider value={{ connectingFrom, startConnect }}>
      <div
        className="w-full h-full relative overflow-hidden"
        style={{ background: "#f6f3ee", cursor: connectingFrom ? "crosshair" : undefined }}
        onMouseMove={handleMouseMove}
      >
        {/* Layer 0: Interactive dot grid */}
        <DotGrid />

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
            onNodeClick={(_event: React.MouseEvent, node: Node) => {
              if (connectingFrom) {
                completeConnect(node.id);
              }
            }}
            onPaneClick={() => {
              if (connectingFrom) cancelConnect();
            }}
            fitView
            fitViewOptions={{ padding: 0.4 }}
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
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

        {/* Connection line overlay — follows cursor from source node */}
        {connectingFrom && mouseScreen && sourcePos && (
          <svg
            className="fixed inset-0 w-screen h-screen pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            <line
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={mouseScreen.x}
              y2={mouseScreen.y}
              stroke="#00BFFF"
              strokeWidth={2}
              strokeDasharray="8 4"
              opacity={0.8}
            />
            <circle
              cx={mouseScreen.x}
              cy={mouseScreen.y}
              r={6}
              fill="none"
              stroke="#00BFFF"
              strokeWidth={1.5}
              opacity={0.6}
            />
          </svg>
        )}

        {/* Multiplayer cursors — only active when room is joined */}
        {roomId && process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY && (
          <LiveblocksProvider publicApiKey={process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY}>
            <RoomProvider
              id={roomId}
              initialPresence={{
                cursor: null,
                name: `User ${Math.floor(Math.random() * 900 + 100)}`,
                color: CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)],
              }}
            >
              <Presence />
            </RoomProvider>
          </LiveblocksProvider>
        )}

        {/* Taskbar — Layer 3 glassmorphism, fixed bottom center */}
        <Toolbar
          onAddNode={spawnNode}
          onBranch={spawnBranch}
          onShare={activateRoom}
          roomId={roomId}
          workspaceId={workspaceId}
        />
      </div>
    </ConnectContext.Provider>
  );
}

export default function Canvas({ workspaceId }: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner workspaceId={workspaceId} />
    </ReactFlowProvider>
  );
}
