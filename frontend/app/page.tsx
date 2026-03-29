"use client";

import { useRouter } from "next/navigation";
import {
  DashboardIcon,
  FolderIcon,
  SettingsIcon,
  ArrowForwardIcon,
} from "./components/Icons";

/* ── Minimal Material Symbol icons for landing page ── */
function BookIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function AccountCircleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="9" r="3" />
      <path d="M6.168 18.849A4 4 0 0 1 10 16h4a4 4 0 0 1 3.834 2.855" />
    </svg>
  );
}

function HistoryIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();

  async function createWorkspace() {
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Workspace" }),
      });
      const workspace = await res.json();
      router.push(`/canvas/${workspace.id}`);
    } catch {
      router.push(`/canvas/${crypto.randomUUID()}`);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Beach Background — Sandy base + animated ocean waves from top */}
      <div className="beach-background-container">
        {/* Wave layer 1 — Deep water */}
        <div className="wave-layer wave-layer-1">
          <svg
            className="wave-svg"
            viewBox="0 0 2880 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#476083"
              d="M0,0L2880,0L2880,220C2832,200,2736,160,2640,145C2544,130,2448,140,2352,160C2256,180,2160,210,2064,215C1968,220,1872,195,1776,175C1680,155,1584,140,1488,150C1392,160,1296,195,1200,210C1104,225,1008,220,912,200C816,180,720,145,624,140C528,135,432,160,336,175C240,190,144,200,48,195L0,190Z"
            />
          </svg>
        </div>

        {/* Wave layer 2 — Mid water */}
        <div className="wave-layer wave-layer-2">
          <svg
            className="wave-svg"
            viewBox="0 0 2880 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#00BFFF"
              d="M0,0L2880,0L2880,190C2832,180,2736,155,2640,150C2544,145,2448,160,2352,180C2256,200,2160,230,2064,228C1968,226,1872,190,1776,170C1680,150,1584,145,1488,155C1392,165,1296,190,1200,200C1104,210,1008,205,912,190C816,175,720,150,624,145C528,140,432,155,336,170C240,185,144,195,48,190L0,185Z"
            />
          </svg>
        </div>

        {/* Wave layer 3 — Foam / white wash */}
        <div className="wave-layer wave-layer-3">
          <svg
            className="wave-svg"
            viewBox="0 0 2880 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#ffffff"
              d="M0,0L2880,0L2880,155C2832,148,2736,130,2640,128C2544,126,2448,140,2352,155C2256,170,2160,190,2064,185C1968,180,1872,155,1776,142C1680,130,1584,130,1488,140C1392,150,1296,170,1200,178C1104,186,1008,180,912,168C816,156,720,138,624,132C528,126,432,132,336,145C240,158,144,175,48,172L0,168Z"
            />
          </svg>
        </div>

        {/* Gradient fade — blends wave edge into sand */}
        <div className="wave-fade" />
      </div>

      {/* Top Navigation */}
      <nav className="flex justify-between items-center px-12 py-6 relative z-10">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <BookIcon size={28} />
          <span className="font-headline italic font-bold text-3xl text-primary">
            Clerse
          </span>
        </div>

        {/* Center: Links */}
        <div className="hidden md:flex items-center gap-8">
          {["Manifesto", "Gallery", "Community"].map((link) => (
            <a
              key={link}
              href="#"
              className="font-label text-sm text-outline hover:text-primary transition-colors uppercase tracking-widest"
            >
              {link}
            </a>
          ))}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-outline hover:text-primary transition-colors">
            <AccountCircleIcon size={24} />
          </button>
          <button
            onClick={createWorkspace}
            className="bg-tertiary text-on-tertiary font-label text-xs tracking-widest uppercase rounded-full px-6 py-2 hover:brightness-110 transition-all"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Floating Left Sidebar */}
      <aside className="floating-sidebar hidden lg:flex">
        <button className="text-outline hover:text-primary hover:scale-110 transition-all">
          <DashboardIcon size={24} />
        </button>
        <button className="text-outline hover:text-primary hover:scale-110 transition-all">
          <FolderIcon size={24} />
        </button>
        <button className="text-outline hover:text-primary hover:scale-110 transition-all">
          <HistoryIcon size={24} />
        </button>
        <button className="text-outline hover:text-primary hover:scale-110 transition-all">
          <SettingsIcon size={24} />
        </button>
      </aside>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-8 relative z-10">
        {/* Large Title */}
        <h1 className="font-headline italic font-bold text-primary text-[8rem] md:text-[12rem] tracking-tighter leading-none mb-8">
          Clerse
        </h1>

        {/* Subheadline */}
        <p className="font-body text-on-surface-variant text-xl max-w-2xl mx-auto text-center leading-relaxed mb-12">
          The fluid spatial canvas for your AI-powered thinking. Move beyond
          boxes and lines into a natural landscape for ideas.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={createWorkspace}
            className="cta-primary flex items-center gap-2"
          >
            Create Workspace
            <ArrowForwardIcon size={20} />
          </button>
          <button className="cta-secondary">View Demo</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex justify-between items-end px-12 pb-8 relative z-10 w-full">
        {/* Left: Brand info */}
        <div>
          <p className="font-headline italic font-bold text-xl text-primary mb-2">
            Clerse AI
          </p>
          <p className="font-label text-[10px] text-outline uppercase tracking-widest">
            © 2024 CLERSE AI. FLOWING THROUGH THE INFINITE CANVAS.
          </p>
        </div>

        {/* Right: Links */}
        <div className="hidden md:flex gap-8">
          {["Privacy", "Terms", "Twitter", "Discord"].map((link) => (
            <a
              key={link}
              href="#"
              className="font-label text-xs uppercase tracking-widest text-primary font-semibold hover:opacity-75 transition-opacity"
            >
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
