"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Workspace {
  id: string;
  name: string;
  updated_at: string;
}

const NAV_ITEMS = [
  { icon: "dashboard", label: "Dashboard", active: true },
  { icon: "tsunami", label: "Projects" },
  { icon: "format_list_bulleted", label: "Tasks" },
  { icon: "folder_open", label: "Files" },
  { icon: "insights", label: "Analytics" },
];

const TOP_LINKS = ["Workspaces", "Archives", "Insights", "Team"];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/canvas")
      .then((r) => r.json())
      .then((data: Workspace[]) => setWorkspaces(Array.isArray(data) ? data : []))
      .catch(() => setWorkspaces([]));
  }, []);

  async function createWorkspace() {
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workspace" }),
      });
      const workspace: Workspace = await res.json();
      router.push(`/canvas/${workspace.id}`);
    } catch {
      // Offline: generate local ID and navigate
      router.push(`/canvas/${crypto.randomUUID()}`);
    }
  }

  const featured = workspaces[0];
  const recent = workspaces.slice(1, 3);

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen">

      {/* ── Sidebar (desktop only) ── */}
      <aside className="hidden md:flex flex-col p-6 space-y-4 h-screen w-64 fixed left-0 top-0 bg-surface-container-low z-[60]">
        <div className="mb-8 px-2">
          <h1 className="text-xl font-black font-headline uppercase tracking-tighter text-[#001C3A]">
            Clerse
          </h1>
          <p className="text-[10px] font-label font-semibold uppercase tracking-widest text-primary opacity-60">
            Oceanic Workspace
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                item.active
                  ? "bg-primary text-on-primary shadow-lg"
                  : "text-primary opacity-80 hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-label text-xs font-semibold uppercase tracking-widest">
                {item.label}
              </span>
            </a>
          ))}
        </nav>

        <div
          className="pt-6 space-y-1"
          style={{ borderTop: "1px solid rgba(71,96,131,0.1)" }}
        >
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-2 text-primary opacity-60 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              help_outline
            </span>
            <span className="font-label text-[10px] font-semibold uppercase tracking-widest">
              Help
            </span>
          </a>
          <a
            href="#"
            className="flex items-center gap-3 px-4 py-2 text-primary opacity-60 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              chat_bubble_outline
            </span>
            <span className="font-label text-[10px] font-semibold uppercase tracking-widest">
              Feedback
            </span>
          </a>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="md:ml-64 min-h-screen relative overflow-x-hidden">

        {/* Wave background layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 japanese-line-wave-bg opacity-30" />

        {/* ── Top header ── */}
        <header className="fixed top-0 right-0 left-0 md:left-64 z-50 h-20 flex justify-between items-center px-8 glass editorial-shadow">
          <div className="hidden lg:flex items-center gap-6">
            {TOP_LINKS.map((link, i) => (
              <a
                key={link}
                href="#"
                className={`font-headline text-base tracking-tight transition-colors duration-300 ${
                  i === 0
                    ? "text-[#001C3A] pb-1"
                    : "text-primary/70 hover:text-tertiary"
                }`}
                style={i === 0 ? { borderBottom: "2px solid #a43c12" } : {}}
              >
                {link}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-primary hover:text-tertiary transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="p-2 text-primary hover:text-tertiary transition-colors">
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button
              onClick={createWorkspace}
              className="hidden sm:flex items-center gap-2 bg-tertiary text-on-tertiary px-6 py-2.5 rounded-full font-label text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              New Workspace
            </button>
          </div>
        </header>

        {/* ── Hero ── */}
        <section className="pt-32 pb-20 px-8 relative">
          <div className="max-w-6xl mx-auto relative z-10">

            <div className="mb-12">
              <h2 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-on-surface mb-4">
                Tidal{" "}
                <span className="text-secondary italic">Workspaces</span>
              </h2>
              <p className="font-body text-on-surface-variant max-w-xl leading-relaxed">
                Organize your Claude conversations with the fluidity of the
                ocean. Each workspace is an infinite canvas for branching ideas.
              </p>
            </div>

            {/* ── Bento grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Featured card (col-span-8) */}
              {featured ? (
                <a
                  href={`/canvas/${featured.id}`}
                  className="md:col-span-8 group relative overflow-hidden bg-primary rounded-xl editorial-shadow p-12 flex flex-col justify-between min-h-[400px] transition-transform duration-500 hover:-translate-y-2 cursor-pointer"
                >
                  <div className="absolute inset-0 japanese-line-wave-bg opacity-20 pointer-events-none" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6">
                      <span
                        className="px-3 py-1 rounded-full font-label text-[10px] font-bold uppercase tracking-widest text-white"
                        style={{
                          background: "rgba(255,255,255,0.10)",
                          backdropFilter: "blur(8px)",
                          border: "1px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        Featured
                      </span>
                      <span className="font-label text-[10px] text-white/60 uppercase tracking-widest">
                        {timeAgo(featured.updated_at)}
                      </span>
                    </div>
                    <h3 className="font-headline text-4xl font-bold text-white mb-4">
                      {featured.name}
                    </h3>
                    <p className="text-primary-fixed-dim max-w-sm">
                      Continue on the infinite canvas — branch ideas, stream
                      Claude in parallel.
                    </p>
                  </div>
                  <div className="relative z-10 flex items-center justify-end">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:brightness-125 transition-all"
                      style={{
                        background: "rgba(255,255,255,0.10)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                      }}
                    >
                      <span className="material-symbols-outlined">
                        arrow_forward
                      </span>
                    </div>
                  </div>
                </a>
              ) : (
                /* Empty state (col-span-8) */
                <div className="md:col-span-8 relative overflow-hidden bg-surface-container rounded-xl editorial-shadow p-12 flex flex-col items-center justify-center min-h-[400px] gap-6">
                  <div className="absolute inset-0 japanese-line-wave-bg opacity-20 pointer-events-none" />
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(71,96,131,0.08)" }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 36, color: "#476083", opacity: 0.5 }}
                    >
                      tsunami
                    </span>
                  </div>
                  <div className="text-center relative z-10">
                    <h3 className="font-headline text-2xl font-bold text-on-surface mb-2">
                      Your ocean is empty
                    </h3>
                    <p className="text-on-surface-variant text-sm max-w-xs">
                      Create your first workspace and start branching ideas on
                      an infinite canvas.
                    </p>
                  </div>
                  <button
                    onClick={createWorkspace}
                    className="relative z-10 bg-tertiary text-on-tertiary px-8 py-3 rounded-full font-label text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                  >
                    Create First Workspace
                  </button>
                </div>
              )}

              {/* Stats card (col-span-4) */}
              <div className="md:col-span-4 bg-surface-container-highest rounded-xl editorial-shadow p-8 flex flex-col justify-between transition-transform duration-500 hover:-translate-y-2">
                <div>
                  <div className="w-12 h-12 bg-secondary rounded-xl mb-6 flex items-center justify-center text-on-secondary">
                    <span className="material-symbols-outlined">waves</span>
                  </div>
                  <h4 className="font-headline text-xl font-bold text-on-surface mb-2">
                    Current Stream
                  </h4>
                  <p className="font-body text-sm text-on-surface-variant">
                    {workspaces.length === 0
                      ? "No active workspaces yet."
                      : `${workspaces.length} workspace${workspaces.length !== 1 ? "s" : ""} in your ocean.`}
                  </p>
                </div>
                <div className="pt-8 flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(workspaces.length * 20, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-label text-[10px] font-bold text-secondary uppercase">
                    {Math.min(workspaces.length * 20, 100)}%
                  </span>
                </div>
              </div>

              {/* Recent workspace cards */}
              {recent.map((ws) => (
                <a
                  key={ws.id}
                  href={`/canvas/${ws.id}`}
                  className="md:col-span-4 bg-surface-container-low rounded-xl editorial-shadow p-8 flex flex-col transition-transform duration-500 hover:-translate-y-2 cursor-pointer"
                >
                  <div className="mb-6 h-20 w-full rounded-lg bg-surface-container flex items-center justify-center">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 28, color: "#476083", opacity: 0.25 }}
                    >
                      hub
                    </span>
                  </div>
                  <h4 className="font-headline text-xl font-bold text-on-surface mb-2">
                    {ws.name}
                  </h4>
                  <p className="font-body text-sm text-on-surface-variant mb-6">
                    Updated {timeAgo(ws.updated_at)}
                  </p>
                  <span className="mt-auto text-secondary font-label text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 group hover:gap-3 transition-all">
                    Open Canvas
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                    >
                      north_east
                    </span>
                  </span>
                </a>
              ))}

              {/* Coral Design System card — fills gap when < 2 recent workspaces */}
              {recent.length < 2 && (
                <div className="md:col-span-4 bg-surface-container-low rounded-xl editorial-shadow p-8 flex flex-col transition-transform duration-500 hover:-translate-y-2">
                  <div className="mb-6 h-20 w-full rounded-lg overflow-hidden bg-gradient-to-br from-tertiary-fixed to-tertiary-container flex items-center justify-center">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 32, color: "#a43c12", opacity: 0.6 }}
                    >
                      palette
                    </span>
                  </div>
                  <h4 className="font-headline text-xl font-bold text-on-surface mb-2">
                    Coral Design System
                  </h4>
                  <p className="font-body text-sm text-on-surface-variant mb-6">
                    Oceanic palette · Tidal typography · Editorial depth
                  </p>
                  <span className="mt-auto text-secondary font-label text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    Design Docs
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                    >
                      north_east
                    </span>
                  </span>
                </div>
              )}

              {/* Oceanic Insights analytics card */}
              <div className="md:col-span-5 bg-surface-container-lowest rounded-xl editorial-shadow p-8 flex flex-col transition-transform duration-500 hover:-translate-y-2" style={{ border: "1px solid rgba(188,200,209,0.1)" }}>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h4 className="font-headline text-2xl font-bold text-on-surface mb-1">
                      Oceanic Insights
                    </h4>
                    <p
                      className="font-label text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "#a43c12" }}
                    >
                      Analytics Dashboard
                    </p>
                  </div>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 36, color: "#476083", opacity: 0.2 }}
                  >
                    water_drop
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div className="p-4 bg-surface-container rounded-lg">
                    <p className="text-[10px] font-label font-bold text-on-surface-variant opacity-60 uppercase mb-1">
                      Flow Rate
                    </p>
                    <p className="text-xl font-headline font-bold text-on-surface">
                      {workspaces.length * 4} Nodes
                    </p>
                  </div>
                  <div className="p-4 bg-surface-container rounded-lg">
                    <p className="text-[10px] font-label font-bold text-on-surface-variant opacity-60 uppercase mb-1">
                      Canvases
                    </p>
                    <p className="text-xl font-headline font-bold text-on-surface">
                      {workspaces.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Create new workspace card */}
              <div
                className="md:col-span-3 group relative rounded-xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer hover:brightness-95"
                style={{
                  background: "rgba(255,151,114,0.08)",
                  border: "2px dashed rgba(164,60,18,0.2)",
                }}
                onClick={createWorkspace}
              >
                <button className="w-16 h-16 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 mb-4">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 28 }}
                  >
                    add
                  </span>
                </button>
                <p className="font-label text-xs font-bold text-on-tertiary-container uppercase tracking-widest text-center">
                  Create New Workspace
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer
          className="w-full py-12 flex flex-col items-center justify-center space-y-4 relative z-10 bg-surface"
          style={{ borderTop: "1px solid rgba(71,96,131,0.08)" }}
        >
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "API Status"].map((link) => (
              <a
                key={link}
                href="#"
                className="font-label text-xs uppercase tracking-widest text-primary/50 hover:text-secondary transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-primary/50">
            © 2024 Clerse. Flow like water.
          </p>
        </footer>
      </main>

      {/* ── FAB (mobile) ── */}
      <button
        onClick={createWorkspace}
        className="md:hidden fixed bottom-6 right-6 w-16 h-16 rounded-full bg-tertiary text-on-tertiary shadow-2xl flex items-center justify-center z-[100] hover:scale-105 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
          add
        </span>
      </button>
    </div>
  );
}
