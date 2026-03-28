import Canvas from "@/app/components/Canvas";
import Link from "next/link";

interface Props {
  params: { id: string };
}

export default function CanvasPage({ params }: Props) {
  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {/* Back to dashboard */}
      <Link
        href="/"
        className="absolute top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full font-label text-[10px] font-bold uppercase tracking-widest text-primary editorial-shadow animate-fade-scale"
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(188,200,209,0.2)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
          arrow_back
        </span>
        Workspaces
      </Link>

      {/* Workspace ID badge */}
      <div
        className="absolute top-4 right-4 z-50 px-3 py-1.5 rounded-full font-label text-[9px] uppercase tracking-widest text-on-surface-variant"
        style={{
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(188,200,209,0.2)",
        }}
      >
        {params.id.slice(0, 8)}…
      </div>

      <Canvas workspaceId={params.id} />
    </div>
  );
}
