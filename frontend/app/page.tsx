"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowForwardIcon,
} from "./components/Icons";

const BeachWaveBackground = dynamic(
  () => import("./components/BeachWaveBackground"),
  { ssr: false }
);

const SplitText = dynamic(
  () => import("./components/SplitText"),
  { ssr: false }
);


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

export default function LandingPage() {
  const router = useRouter();

  async function createWorkspace() {
    try {
      const res = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Workspace" }),
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
        <div className="flex items-center gap-2 text-white">
          <BookIcon size={28} />
          <span className="font-sacrifice text-3xl drop-shadow-md">
            Clerse
          </span>
        </div>

        {/* Center: Links (Removed) */}

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <button className="p-2 text-white/70 hover:text-white transition-colors">
            <AccountCircleIcon size={24} />
          </button>
          <button
            onClick={createWorkspace}
            className="bg-white/20 backdrop-blur-sm text-white font-label text-xs tracking-widest uppercase rounded-full px-6 py-2 hover:bg-white/30 transition-all border border-white/30"
          >
            Launch App
          </button>
        </div>
      </nav>


      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-8 relative z-10">
        {/* Large Title */}
        <h1 className="font-sacrifice text-white text-[8rem] md:text-[12rem] leading-none mb-8 drop-shadow-lg">
          <SplitText
            text="Clerse"
            tag="span"
            splitType="chars"
            delay={120}
            duration={1.8}
            ease="power3.out"
            from={{ opacity: 0, y: 60, rotateX: -20 }}
            to={{ opacity: 1, y: 0, rotateX: 0 }}
            threshold={0.05}
            rootMargin="0px"
            textAlign="center"
          />
        </h1>

        {/* Subheadline */}
        <p className="font-body text-white text-xl max-w-2xl mx-auto text-center leading-relaxed mb-12 drop-shadow-md">
          The fluid spatial canvas for your AI-powered thinking. Move beyond
          boxes and lines into a natural landscape for ideas.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={createWorkspace}
            className="bg-white text-[#1a9e9e] font-label font-semibold px-8 py-4 rounded-full flex items-center gap-2 hover:bg-white/90 transition-all shadow-lg"
          >
            Create Workspace
            <ArrowForwardIcon size={20} />
          </button>
          <button className="bg-white/15 backdrop-blur-sm text-white font-label font-semibold px-8 py-4 rounded-full border border-white/30 hover:bg-white/25 transition-all">
            View Demo
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex justify-between items-end px-12 pb-8 relative z-10 w-full">
        {/* Left: Brand info */}
        <div>
          <p className="font-sacrifice text-xl text-white mb-2 drop-shadow-sm">
            Clerse AI
          </p>
          <p className="font-label text-[10px] text-white/50 uppercase tracking-widest">
            © 2024 CLERSE AI. FLOWING THROUGH THE INFINITE CANVAS.
          </p>
        </div>

        {/* Right: Links */}
        <div className="hidden md:flex gap-8">
          {["Privacy", "Terms", "Twitter", "Discord"].map((link) => (
            <a
              key={link}
              href="#"
              className="font-label text-xs uppercase tracking-widest text-white/70 font-semibold hover:text-white transition-opacity"
            >
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
