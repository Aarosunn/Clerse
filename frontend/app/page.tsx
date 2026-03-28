"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DashboardIcon,
  TsunamiIcon,
  ListIcon,
  FolderIcon,
  InsightsIcon,
  HelpIcon,
  ChatIcon,
  NotificationIcon,
  SettingsIcon,
  ArrowForwardIcon,
  WavesIcon,
  HubIcon,
  NorthEastIcon,
  AddIcon,
  WaterDropIcon,
} from "./components/Icons";

/* ── Image assets from the design mockup ── */
const IMG = {
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBP3ywYMxCTpGaU1gY4yub-MXQ5ZTKcPl9CagwJ9Xe46SK3FpJwfr9OaDEevl6llm6sGBJ6BDTNP00QxcznSZokLa7rHXbhcA3t_ljGO9x9vVi7xtuKfQb-7wvniZayF1616RDzthdjiwL7-zVuHDZCVVS64_LaGGp_mx2ioOP9VWQHwYBFZ9agPqcERRFkQbO6vyyRpoNQ6dhUGaKR5hy9f98EF8vHIQ7RUYqh5RMUM3Ogg61ptzVZpin_irZiEFE5FM-TEmDNYfk",
  ocean:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBc3B6PO3iJtN1XoAi101tlzuA0te0qaAHYko3y9AfEkhsPsaT9N9I1bzgfrN0e-4xtJYMEcZpVL-Ah88ac6KEzzNc0eBpKZILnMRRz6oyp9h2ZC0veAviCTVUov2DfivcDQ6odqHuBCKom-LX1Qf4ab-88RPCzN4KlMIg9_UjPonghir1cIHeyvduBC0WFQUE2yVYbu8TR5CngrH9OJLxXoDkO3eMIASJ9dk2klVRI1XhnDTBL6mrzmm7YUleALWtdbk6ezpanKlg",
  collab1:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCWd4bX8skpYYKFrY0w_g9Xs0l7f5HoZ4XWq3Z_GjWYrV11y4LUHukrcDQbFHWoj7GVN1tCQH6y5z3FninjEWFXW_2U3lDHI8_JUKj8-bSIh_qOAR1tJXHMoRrFBLUdcI6_rLBy6WYP2w9AtTXT6rcPpEH6Jl1f6T4sDhY5UWcOuTzJORQmJobnjZ7KkKUzbD0Vc10GCarSEnvYaMo1kchSZhZthA4g4O6t5eayU_LDUjftJ9H6GjjuR6Ws5Og5xLjleLV6cpROTq0",
  collab2:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAEjgoQ3dxi2QC2vq3FcC7OSw4uG1b5OLJvv76FVqGl00Bw5NFpPMwptpgqbng_jhbFo4NhTQ-9A4atgxZjV8dg-CbYXsya5fBUtF09dA5a465FofgS_P_C140UZOFDXCZGNYZRhUFM1qQAAR1PyPBXxC_5CxK4TP6N-1gETrcMWcFk12gPhZAfihjDp_h9HgmQU2QzSj3mcjqXZ7AO_AP40_Z6Gk3vk8b_69eZtymVxK12R4BXdgqlgttRJQe68XEmqg5Iev3e_n8",
  sand:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuD1K6jdI3_rcnHSRNZ6C__jmCmMC46z8UB9JnHtNHPiSa0WWUA1Vj2CRFLAm1jk6vUZrImmfO6A1tCJEOvodcTfGRq_uDNN229aUIfAhGMvARS2MnSGp2VR7xKAk8JZ-PaQzNcQ8UljK4itZbRRVpfMc_jJNvWe88S6JezYO97tz4BlH66ouoKxEBWFl18SOVRf71X65Giv1iySvpHR6I892TZZxYQz8bkpSAmA2dWE1-8IJnYSIG8iGN2JgDkV9c4lJHwdGPnnUjA",
};

interface Workspace {
  id: string;
  name: string;
  updated_at: string;
}

const NAV_ITEMS: { icon: React.ReactNode; label: string; active?: boolean }[] = [
  { icon: <DashboardIcon size={20} />, label: "Dashboard", active: true },
  { icon: <TsunamiIcon size={20} />, label: "Projects" },
  { icon: <ListIcon size={20} />, label: "Tasks" },
  { icon: <FolderIcon size={20} />, label: "Files" },
  { icon: <InsightsIcon size={20} />, label: "Analytics" },
];

const TOP_LINKS = ["Workspaces", "Archives", "Insights", "Team"];

const FLOW_DAYS = [
  { day: "Mon", h: 128, accent: false },
  { day: "Tue", h: 160, accent: false },
  { day: "Wed", h: 96,  accent: false },
  { day: "Thu", h: 192, accent: true },
  { day: "Fri", h: 144, accent: false },
  { day: "Sat", h: 112, accent: false },
  { day: "Sun", h: 64,  accent: false },
];

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
      router.push(`/canvas/${crypto.randomUUID()}`);
    }
  }

  const featured = workspaces[0];
  const recent = workspaces.slice(1, 3);

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen">

      {/* Sidebar (desktop) */}
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
              {item.icon}
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
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-primary opacity-60 hover:opacity-100 transition-opacity">
            <HelpIcon size={18} />
            <span className="font-label text-[10px] font-semibold uppercase tracking-widest">Help</span>
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-primary opacity-60 hover:opacity-100 transition-opacity">
            <ChatIcon size={18} />
            <span className="font-label text-[10px] font-semibold uppercase tracking-widest">Feedback</span>
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="md:ml-64 min-h-screen relative overflow-x-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 japanese-line-wave-bg opacity-30" />

        {/* Header */}
        <header className="fixed top-0 right-0 left-0 md:left-64 z-50 h-20 flex justify-between items-center px-8 glass editorial-shadow">
          <div className="hidden lg:flex items-center gap-6">
            {TOP_LINKS.map((link, i) => (
              <a
                key={link}
                href="#"
                className={`font-headline text-base tracking-tight transition-colors duration-300 ${
                  i === 0 ? "text-[#001C3A] pb-1" : "text-primary/70 hover:text-tertiary"
                }`}
                style={i === 0 ? { borderBottom: "2px solid #a43c12" } : {}}
              >
                {link}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button className="p-2 text-primary hover:text-tertiary transition-colors">
                <NotificationIcon size={24} />
              </button>
              <button className="p-2 text-primary hover:text-tertiary transition-colors">
                <SettingsIcon size={24} />
              </button>
            </div>
            <button
              onClick={createWorkspace}
              className="hidden sm:flex items-center gap-2 bg-tertiary text-on-tertiary px-6 py-2.5 rounded-full font-label text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              New Workspace
            </button>
            {/* Profile avatar */}
            <div className="h-10 w-10 rounded-full overflow-hidden editorial-shadow" style={{ border: "2px solid #ebe8e3" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.avatar} alt="Profile" className="w-full h-full object-cover" />
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="pt-32 pb-20 px-8 relative">
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="mb-12">
              <h2 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tighter text-on-surface mb-4">
                Tidal <span className="text-secondary italic">Workspaces</span>
              </h2>
              <p className="font-body text-on-surface-variant max-w-xl leading-relaxed">
                Organize your creative output with the fluidity of the ocean. Each workspace is a
                self-contained ecosystem for your projects, files, and flow.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

              {/* Featured card (8 cols) */}
              {featured ? (
                <a
                  href={`/canvas/${featured.id}`}
                  className="md:col-span-8 group relative overflow-hidden bg-primary rounded-xl editorial-shadow p-12 flex flex-col justify-between min-h-[400px] transition-transform duration-500 hover:-translate-y-2 cursor-pointer"
                >
                  {/* Ocean background image */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={IMG.ocean} alt="" className="w-full h-full object-cover mix-blend-overlay" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-6">
                      <span
                        className="px-3 py-1 rounded-full font-label text-[10px] font-bold uppercase tracking-widest text-white"
                        style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
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
                      A centralized vault for high-fidelity research and oceanic data modeling.
                    </p>
                  </div>
                  {/* Bottom bar: avatars + arrow */}
                  <div className="relative z-10 flex items-center justify-between">
                    {/* Collaborator avatars */}
                    <div className="flex -space-x-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={IMG.collab1} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid #476083" }} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={IMG.collab2} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid #476083" }} />
                      <div
                        className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-[10px] font-bold text-on-secondary-container"
                        style={{ border: "2px solid #476083" }}
                      >
                        +3
                      </div>
                    </div>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white hover:brightness-125 transition-all"
                      style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
                    >
                      <ArrowForwardIcon size={24} />
                    </div>
                  </div>
                </a>
              ) : (
                /* Empty state (8 cols) */
                <div className="md:col-span-8 relative overflow-hidden bg-primary rounded-xl editorial-shadow p-12 flex flex-col justify-between min-h-[400px]">
                  {/* Ocean background even in empty state */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={IMG.ocean} alt="" className="w-full h-full object-cover mix-blend-overlay" />
                  </div>
                  <div className="relative z-10 flex flex-col items-center justify-center h-full gap-6">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                      <TsunamiIcon size={36} className="text-white" style={{ opacity: 0.7 }} />
                    </div>
                    <div className="text-center">
                      <h3 className="font-headline text-2xl font-bold text-white mb-2">
                        Your ocean is empty
                      </h3>
                      <p className="text-primary-fixed-dim text-sm max-w-xs">
                        Create your first workspace and start branching ideas on an infinite canvas.
                      </p>
                    </div>
                    <button
                      onClick={createWorkspace}
                      className="bg-tertiary text-on-tertiary px-8 py-3 rounded-full font-label text-xs font-bold uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
                    >
                      Create First Workspace
                    </button>
                  </div>
                  {/* Dummy avatar row for visual balance */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={IMG.collab1} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid #476083" }} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={IMG.collab2} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: "2px solid #476083" }} />
                      <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-[10px] font-bold text-on-secondary-container" style={{ border: "2px solid #476083" }}>
                        +3
                      </div>
                    </div>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white/40"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                    >
                      <ArrowForwardIcon size={24} />
                    </div>
                  </div>
                </div>
              )}

              {/* Stats card (4 cols) */}
              <div className="md:col-span-4 bg-surface-container-highest rounded-xl editorial-shadow p-8 flex flex-col justify-between transition-transform duration-500 hover:-translate-y-2">
                <div>
                  <div className="w-12 h-12 bg-secondary rounded-xl mb-6 flex items-center justify-center text-on-secondary">
                    <WavesIcon size={24} />
                  </div>
                  <h4 className="font-headline text-xl font-bold text-on-surface mb-2">Current Stream</h4>
                  <p className="font-body text-sm text-on-surface-variant">
                    Active project tracking and team synchronization.
                  </p>
                </div>
                <div className="pt-8 flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-700"
                      style={{ width: `${Math.max(Math.min(workspaces.length * 20, 100), 70)}%` }}
                    />
                  </div>
                  <span className="font-label text-[10px] font-bold text-secondary uppercase">
                    {Math.max(Math.min(workspaces.length * 20, 100), 70)}%
                  </span>
                </div>
              </div>

              {/* Coral Design System card with sand image */}
              <div className="md:col-span-4 bg-surface-container-low rounded-xl editorial-shadow p-8 flex flex-col transition-transform duration-500 hover:-translate-y-2" style={{ border: "1px solid rgba(188,200,209,0.1)" }}>
                <div className="mb-6 h-32 w-full rounded-lg overflow-hidden bg-surface-container-high relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={IMG.sand} alt="Sand patterns" className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #f6f3ee, transparent)" }} />
                </div>
                <h4 className="font-headline text-xl font-bold text-on-surface mb-2">Coral Design System</h4>
                <p className="font-body text-sm text-on-surface-variant mb-6">
                  Visual assets and brand guidelines for the Tidal project.
                </p>
                <button className="mt-auto text-secondary font-label text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 group hover:gap-3 transition-all">
                  Open Workspace <NorthEastIcon size={14} />
                </button>
              </div>

              {/* Recent workspace cards */}
              {recent.map((ws) => (
                <a
                  key={ws.id}
                  href={`/canvas/${ws.id}`}
                  className="md:col-span-4 bg-surface-container-low rounded-xl editorial-shadow p-8 flex flex-col transition-transform duration-500 hover:-translate-y-2 cursor-pointer"
                  style={{ border: "1px solid rgba(188,200,209,0.1)" }}
                >
                  <div className="mb-6 h-20 w-full rounded-lg bg-surface-container flex items-center justify-center">
                    <HubIcon size={28} style={{ color: "#476083", opacity: 0.25 }} />
                  </div>
                  <h4 className="font-headline text-xl font-bold text-on-surface mb-2">{ws.name}</h4>
                  <p className="font-body text-sm text-on-surface-variant mb-6">Updated {timeAgo(ws.updated_at)}</p>
                  <span className="mt-auto text-secondary font-label text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 group hover:gap-3 transition-all">
                    Open Canvas <NorthEastIcon size={14} />
                  </span>
                </a>
              ))}

              {/* Insights card (5 cols) */}
              <div className="md:col-span-5 bg-surface-container-lowest rounded-xl editorial-shadow p-8 flex flex-col transition-transform duration-500 hover:-translate-y-2" style={{ border: "1px solid rgba(188,200,209,0.1)" }}>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <h4 className="font-headline text-2xl font-bold text-on-surface mb-1">Oceanic Insights</h4>
                    <p className="font-label text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#a43c12" }}>
                      Analytics Dashboard
                    </p>
                  </div>
                  <WaterDropIcon size={36} style={{ color: "#476083", opacity: 0.2 }} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div className="p-4 bg-surface-container rounded-lg">
                    <p className="text-[10px] font-label font-bold text-on-surface-variant opacity-60 uppercase mb-1">Flow Rate</p>
                    <p className="text-xl font-headline font-bold text-on-surface">12.4 GB</p>
                  </div>
                  <div className="p-4 bg-surface-container rounded-lg">
                    <p className="text-[10px] font-label font-bold text-on-surface-variant opacity-60 uppercase mb-1">Node Density</p>
                    <p className="text-xl font-headline font-bold text-on-surface">842</p>
                  </div>
                </div>
              </div>

              {/* Create new workspace (3 cols) */}
              <div
                className="md:col-span-3 group relative rounded-xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer hover:brightness-95"
                style={{ background: "rgba(255,151,114,0.08)", border: "2px dashed rgba(164,60,18,0.2)" }}
                onClick={createWorkspace}
              >
                <button className="w-16 h-16 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 mb-4">
                  <AddIcon size={28} />
                </button>
                <p className="font-label text-xs font-bold text-on-tertiary-container uppercase tracking-widest text-center">
                  Create New Workspace
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Flow Ecosystem — Analytics Section */}
        <section className="py-20 px-8 relative" style={{ background: "rgba(246,243,238,0.5)" }}>
          <div className="max-w-6xl mx-auto relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div>
                <span className="font-label text-xs font-bold text-secondary uppercase tracking-widest mb-2 block">System Pulse</span>
                <h3 className="font-headline text-4xl font-bold text-on-surface">Data Flow Ecosystem</h3>
              </div>
              <button className="flex items-center gap-2 px-6 py-3 bg-surface-container-highest rounded-full font-label text-xs font-bold uppercase tracking-widest text-primary hover:bg-surface-container-high transition-colors">
                View Network Map <HubIcon size={14} />
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-xl editorial-shadow overflow-hidden" style={{ border: "1px solid rgba(188,200,209,0.08)" }}>
              {/* Legend header */}
              <div className="p-8 flex justify-between items-center" style={{ borderBottom: "1px solid rgba(188,200,209,0.10)" }}>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Active Streams</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-tertiary" />
                    <span className="font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Peak Events</span>
                  </div>
                </div>
                <select className="bg-surface-container text-on-surface rounded-lg font-label text-[10px] font-bold uppercase tracking-widest px-4 py-2 focus:ring-secondary" style={{ border: "none" }}>
                  <option>Last 30 Days</option>
                  <option>Last 7 Days</option>
                </select>
              </div>

              {/* Wave chart */}
              <div className="h-64 relative bg-surface-container-lowest">
                {/* SVG wave fill */}
                <div className="absolute inset-0 flex items-end">
                  <div className="w-full h-full relative opacity-20">
                    <svg className="absolute bottom-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                      <defs>
                        <linearGradient id="waveGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#00668a" />
                          <stop offset="100%" stopColor="#ffffff" />
                        </linearGradient>
                      </defs>
                      <path d="M0 80 Q 150 20, 300 80 T 600 80 T 900 80 L 1000 100 L 0 100 Z" fill="url(#waveGradient)" />
                    </svg>
                  </div>

                  {/* Bar chart overlay */}
                  <div className="absolute inset-0 flex items-center justify-around px-8">
                    {FLOW_DAYS.map(({ day, h, accent }) => (
                      <div key={day} className="flex flex-col items-center">
                        <div
                          className="w-1.5 rounded-full relative"
                          style={{
                            height: h,
                            background: accent ? "#a43c12" : `rgba(0,102,138,${Math.min(h / 200, 1)})`,
                            boxShadow: accent ? "0 0 15px rgba(164,60,18,0.3)" : "none",
                          }}
                        >
                          {accent && (
                            <div
                              className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white font-bold"
                              style={{ background: "#a43c12" }}
                            >
                              {Math.round(h / 16)}
                            </div>
                          )}
                        </div>
                        <span className="mt-4 font-label text-[8px] uppercase tracking-widest opacity-40">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="w-full py-12 flex flex-col items-center justify-center space-y-4 relative z-10 bg-surface" style={{ borderTop: "1px solid rgba(71,96,131,0.08)" }}>
          <div className="flex items-center gap-6 mb-2">
            {["Privacy", "Terms", "API Status"].map((link) => (
              <a key={link} href="#" className="font-label text-xs uppercase tracking-widest text-primary/50 hover:text-secondary transition-colors">
                {link}
              </a>
            ))}
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-primary/50">© 2024 Clerse. Flow like water.</p>
        </footer>
      </main>

      {/* FAB (mobile) */}
      <button
        onClick={createWorkspace}
        className="md:hidden fixed bottom-6 right-6 w-16 h-16 rounded-full bg-tertiary text-on-tertiary shadow-2xl flex items-center justify-center z-[100] hover:scale-105 active:scale-95 transition-all"
      >
        <AddIcon size={28} />
      </button>
    </div>
  );
}
