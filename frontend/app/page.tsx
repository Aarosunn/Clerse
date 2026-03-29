"use client";

import { useRouter } from "next/navigation";
import {
  DashboardIcon,
  FolderIcon,
  SettingsIcon,
  ArrowForwardIcon,
} from "./components/Icons";
import BeachWaveBackground from "./components/BeachWaveBackground";

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
      {/* WebGL Beach Wave Background */}
      <BeachWaveBackground
        speed={0.8}
        colorDeep="#1a9e9e"
        colorShallow="#5ce0d6"
        colorSand="#dcbf8e"
      />

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
