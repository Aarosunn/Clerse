"use client";

import { createContext, useCallback, useState, useEffect, useContext, useRef } from "react";
import {
  ReactFlow,
  Edge,
  EdgeTypes,
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
import QuizNode from "./nodes/QuizNode";
import TextNode from "./nodes/TextNode";
import PDFDocNode from "./nodes/PDFDocNode";
import RiverEdge from "./edges/RiverEdge";
import {
  SparkleIcon,
  PdfIcon,
  PlayCircleIcon,
  ArticleIcon as ArticleIconComponent,
  ImageIcon as ImageIconComponent,
  FlashcardIcon,
  QuizIcon,
  TextIcon as TextIconComponent,
  MarkdownIcon,
} from "./Icons";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

/* ── Connect mode context ── */
interface ConnectContextValue {
  connectingFrom: string | null;
  cachedMessages: Message[] | null;
  connectionOrigin: { x: number; y: number } | null;
  startConnect: (nodeId: string, messages?: Message[], origin?: { x: number; y: number }) => void;
  workspaceId: string;
  spawnNode: (kind: NodeKind, initialMessages?: Message[], position?: { x: number; y: number }) => string;
}

export const ConnectContext = createContext<ConnectContextValue>({
  connectingFrom: null,
  cachedMessages: null,
  connectionOrigin: null,
  startConnect: () => {},
  workspaceId: "",
  spawnNode: () => "",
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quiz: QuizNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  text: TextNode as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfdoc: PDFDocNode as any,
};

const edgeTypes: EdgeTypes = {
  river: RiverEdge,
};

/* ── Wavy connection line preview ── */
/* Mirrors RiverEdge: same amplitude, frequency, noise, color, and glow */
function WavyConnectionLine({ sourceX, sourceY, targetX, targetY }: {
  sourceX: number; sourceY: number; targetX: number; targetY: number;
}) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = len > 0 ? -(dy / len) : 0;
  const ny = len > 0 ? dx / len : 0;

  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsedTime = time - startTime;
      const phase = (elapsedTime / 1000) * -1.5;

      const segments = 64;
      const amplitude = 8;
      const frequency = 1.2;
      const points: string[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const baseX = sourceX + dx * t;
        const baseY = sourceY + dy * t;
        const waveMain = Math.sin(t * frequency * Math.PI * 2 + phase) * amplitude;
        const waveNoise = Math.sin(t * (frequency * 2.13) * Math.PI * 2 + phase * 1.3) * (amplitude * 0.35);
        const wave = waveMain + waveNoise;
        const taper = Math.sin(t * Math.PI);
        const px = baseX + nx * wave * taper;
        const py = baseY + ny * wave * taper;
        points.push(i === 0 ? `M ${px} ${py}` : `L ${px} ${py}`);
      }

      if (pathRef.current) {
        pathRef.current.setAttribute("d", points.join(" "));
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [sourceX, sourceY, dx, dy, nx, ny]);

  return (
    <path
      ref={pathRef}
      fill="none"
      stroke="#739AB5"
      strokeWidth={6}
      strokeOpacity={0.6}
      strokeLinecap="round"
      style={{
        filter: "drop-shadow(0 0 4px rgba(115,154,181,0.5))",
      }}
    />
  );
}

interface CanvasProps {
  workspaceId: string;
}

function CanvasInner({ workspaceId }: CanvasProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nodes, , onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { addNodes, addEdges, getNode, setNodes, getViewport, flowToScreenPosition, screenToFlowPosition } = useReactFlow();

  /* ── Connect mode state ── */
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [cachedMessages, setCachedMessages] = useState<Message[] | null>(null);
  const [mouseScreen, setMouseScreen] = useState<{ x: number; y: number } | null>(null);

  const [connectionOrigin, setConnectionOrigin] = useState<{ x: number; y: number } | null>(null);

  const hydrated = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Node drag preview state ── */
  const [draggingNodeType, setDraggingNodeType] = useState<NodeKind | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);

  function startConnect(nodeId: string, messages?: Message[], origin?: { x: number; y: number }) {
    setConnectingFrom(nodeId);
    setCachedMessages(messages ?? null);
    setConnectionOrigin(origin ?? null);
  }

  function completeConnect(targetNodeId: string) {
    if (!connectingFrom || connectingFrom === targetNodeId) {
      cancelConnect();
      return;
    }

    // Connection restriction: only claude → claude
    const targetNode = getNode(targetNodeId);
    if (targetNode?.type !== "claude") {
      cancelConnect();
      return;
    }

    // Create river edge
    setEdges((eds) =>
      addEdge(
        {
          id: `${connectingFrom}-${targetNodeId}`,
          source: connectingFrom,
          target: targetNodeId,
          type: "river",
        },
        eds
      )
    );

    // Inject cached messages as referencedMessages into target node
    if (cachedMessages && cachedMessages.length > 0) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== targetNodeId) return n;
          const existing = (n.data as Record<string, unknown>).referencedMessages as Message[] | undefined;
          return {
            ...n,
            data: {
              ...n.data,
              referencedMessages: [...(existing ?? []), ...cachedMessages],
            },
          };
        })
      );
    }

    setConnectingFrom(null);
    setCachedMessages(null);
    setConnectionOrigin(null);
    setMouseScreen(null);
  }

  function cancelConnect() {
    setConnectingFrom(null);
    setCachedMessages(null);
    setMouseScreen(null);
  }

  /* ── Node drag preview handlers ── */
  function startDraggingNode(kind: NodeKind) {
    setDraggingNodeType(kind);
  }

  function cancelDrag() {
    setDraggingNodeType(null);
  }

  function placeDraggingNode(e: React.MouseEvent) {
    if (!draggingNodeType) return;

    const nodeWidth = draggingNodeType === "claude" ? 480 : 340;
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const position = {
      x: flowPos.x - nodeWidth / 2,
      y: flowPos.y - 40,
    };

    spawnNode(draggingNodeType, undefined, position);
    cancelDrag();
  }

  // Track mouse for the connection line and drag preview
  function handleMouseMove(e: React.MouseEvent) {
    if (connectingFrom) {
      setMouseScreen({ x: e.clientX, y: e.clientY });
    }
    if (draggingNodeType && dragPreviewRef.current) {
      // Update style directly on the ref, bypassing React render lifecycle
      dragPreviewRef.current.style.transform = `translate(${e.clientX - 32}px, ${e.clientY - 32}px)`;
    }
  }

  // Escape key cancels connect mode and drag mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (connectingFrom) cancelConnect();
        if (draggingNodeType) cancelDrag();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectingFrom, draggingNodeType]);

  /* ── Workspace persistence ── */

  // Mount: hydrate nodes + edges from backend
  useEffect(() => {
    async function hydrate() {
      try {
        const res = await fetch(`${BACKEND}/api/workspaces/${workspaceId}`);
        if (res.ok) {
          const workspace = await res.json();
          const state = workspace.canvas_state;
          if (state) {
            if (state.nodes) setNodes(state.nodes);
            if (state.edges) setEdges(state.edges);
          }
        }
      } finally {
        hydrated.current = true;
      }
    }
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  // Debounced auto-save (30s) on nodes/edges change
  useEffect(() => {
    if (!hydrated.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`${BACKEND}/api/workspaces/${workspaceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_state: { nodes, edges, viewport: getViewport() } }),
      });
    }, 30_000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, workspaceId]);

  // Save on page close
  useEffect(() => {
    function handleBeforeUnload() {
      fetch(`${BACKEND}/api/workspaces/${workspaceId}`, {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_state: { nodes, edges, viewport: getViewport() } }),
      });
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, workspaceId]);

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
          label: "Clerse",
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
      case "quiz":
        data = { kind: "quiz", label: "Quiz", questions: [], sourceNodeId: "" };
        break;
      case "text":
        data = { kind: "text", label: "Text", content: "" };
        break;
      case "pdfdoc":
        data = { kind: "pdfdoc", label: "Document", markdown: "", title: "Untitled Document" };
        break;
    }

    const defaultSizes: Record<string, { width: number; height: number }> = {
      claude: { width: 480, height: 520 },
      pdf: { width: 340, height: 400 },
      youtube: { width: 340, height: 360 },
      article: { width: 340, height: 360 },
      image: { width: 340, height: 360 },
      flashcard: { width: 340, height: 380 },
      quiz: { width: 340, height: 420 },
      text: { width: 340, height: 280 },
      pdfdoc: { width: 340, height: 400 },
    };
    const size = defaultSizes[kind] ?? { width: 340, height: 360 };
    addNodes({ id, type: kind, position: pos, data: data as Record<string, unknown>, style: { width: size.width, height: size.height } });
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
      type: "river",
    });
  }

  const NODE_COLORS: Record<string, string> = {
    claude: "#476083",
    pdf: "#a43c12",
    youtube: "#00668a",
    article: "#4a7c59",
    image: "#7b5ea7",
    flashcard: "#c89b3c",
    quiz: "#d97706",
    text: "#6d7981",
    pdfdoc: "#a43c12",
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

  const sourcePos = connectionOrigin ?? (connectingFrom ? getSourceScreenPos() : null);

  return (
    <ConnectContext.Provider value={{ connectingFrom, cachedMessages, connectionOrigin, startConnect, workspaceId, spawnNode }}>
      <div
        className="w-full h-full relative overflow-hidden"
        style={{
          background: "#f6f3ee",
          cursor: connectingFrom ? "crosshair" : draggingNodeType ? "none" : undefined,
        }}
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
            edgeTypes={edgeTypes}
            deleteKeyCode={null}
            onNodeClick={(_event: React.MouseEvent, node: Node) => {
              if (connectingFrom) {
                completeConnect(node.id);
              }
            }}
            onPaneClick={(e) => {
              if (connectingFrom) {
                cancelConnect();
              } else if (draggingNodeType) {
                placeDraggingNode(e);
              }
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
              pannable
              zoomable
            />
          </ReactFlow>
        </div>

        {/* Connection line overlay — wavy river preview */}
        {connectingFrom && mouseScreen && sourcePos && (
          <svg
            className="fixed inset-0 w-screen h-screen pointer-events-none"
            style={{ zIndex: 9999 }}
          >
            <WavyConnectionLine
              sourceX={sourcePos.x}
              sourceY={sourcePos.y}
              targetX={mouseScreen.x}
              targetY={mouseScreen.y}
            />
            <circle
              cx={mouseScreen.x}
              cy={mouseScreen.y}
              r={6}
              fill="none"
              stroke="#739AB5"
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

        {/* Node drag preview — floating bubble that follows cursor */}
        {draggingNodeType && (
          <div
            ref={dragPreviewRef}
            className="node-drag-preview"
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              transform: `translate(-1000px, -1000px)`,
              pointerEvents: 'none',
              zIndex: 9999,
              color: NODE_COLORS[draggingNodeType] || "#476083",
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                border: `2px solid ${NODE_COLORS[draggingNodeType] || "#476083"}`,
                boxShadow: `0 8px 24px ${NODE_COLORS[draggingNodeType]}40`,
              }}
            >
              {draggingNodeType === "claude" && <SparkleIcon size={28} />}
              {draggingNodeType === "pdf" && <PdfIcon size={28} />}
              {draggingNodeType === "youtube" && <PlayCircleIcon size={28} />}
              {draggingNodeType === "article" && <ArticleIconComponent size={28} />}
              {draggingNodeType === "image" && <ImageIconComponent size={28} />}
              {draggingNodeType === "flashcard" && <FlashcardIcon size={28} />}
              {draggingNodeType === "quiz" && <QuizIcon size={28} />}
              {draggingNodeType === "text" && <TextIconComponent size={28} />}
              {draggingNodeType === "pdfdoc" && <MarkdownIcon size={28} />}
            </div>
          </div>
        )}

        {/* Taskbar — Layer 3 glassmorphism, fixed bottom center */}
        <Toolbar
          onAddNode={spawnNode}
          onStartDrag={startDraggingNode}
          onBranch={spawnBranch}
          onShare={activateRoom}
          roomId={roomId}
          workspaceId={workspaceId}
          draggingNodeType={draggingNodeType}
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
