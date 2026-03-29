"use client";

import { useState, useRef } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { FlashcardNodeData, FlashCard } from "@/types/nodes";
import { FlashcardIcon, SparkleIcon, ChevronLeftIcon, ChevronRightIcon } from "../Icons";
import { useConnectMode } from "../Canvas";
import WindowControls from "./WindowControls";

const ACCENT = "#c89b3c";

const FLASHCARD_SYSTEM_PROMPT =
  "Generate flashcards from the provided content. " +
  "Respond ONLY with a valid JSON array, no preamble, no markdown fences. " +
  'Format: [{"front": "question", "back": "answer"}]';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FlashcardNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as FlashcardNodeData;
  const [cards, setCards] = useState<FlashCard[]>(data.cards ?? []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [minimized, setMinimized] = useState(false);
  const streamRef = useRef("");
  const { startConnect: startConnectMode, workspaceId } = useConnectMode();

  function handleConnect() {
    if (cards.length === 0) return;
    const text = cards.map((c, i) => `Q${i + 1}: ${c.front}\nA${i + 1}: ${c.back}`).join("\n\n");
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `Flashcards:\n\n${text}` }],
    }];
    startConnectMode(id, msgs);
  }

  async function generateCards() {
    if (!sourceText.trim()) return;
    setGenerating(true);
    streamRef.current = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          node_id: id,
          content: sourceText,
          model: "claude-haiku-4-5",
          connected_node_ids: [],
          system_override: FLASHCARD_SYSTEM_PROMPT,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            if (event.type === "token") streamRef.current += event.text as string;
          } catch { /* skip malformed lines */ }
        }
      }

      const jsonMatch = streamRef.current.match(/\[[\s\S]*\]/);
      const parsed: FlashCard[] = JSON.parse(jsonMatch?.[0] ?? streamRef.current);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty result");
      setCards(parsed);
      setCurrentIndex(0);
      setFlipped(false);
    } catch {
      setCards([{ front: "Could not generate", back: "Check backend connection." }]);
      setCurrentIndex(0);
    }
    setGenerating(false);
  }

  const card = cards[currentIndex];

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{ width: "100%", height: "100%", background: "#ffffff", boxShadow: "0 8px 24px rgba(28,28,25,0.08)", border: "1px solid rgba(188,200,209,0.15)" }}
    >
      <NodeResizer minWidth={260} minHeight={200} color={ACCENT} lineStyle={{ strokeWidth: 6, strokeOpacity: 0 }} handleStyle={{ width: 14, height: 14, borderRadius: 7 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: `rgba(200,155,60,0.04)` }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <FlashcardIcon size={16} style={{ color: ACCENT }} />
          <span className="font-label uppercase tracking-widest text-on-surface-variant" style={{ fontSize: 10 }}>Flashcards</span>
        </div>
        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <>
              <span className="font-label text-on-surface-variant" style={{ fontSize: 10 }}>
                {currentIndex + 1} / {cards.length}
              </span>
              <button
                onClick={handleConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
                style={{ fontSize: 10, background: "#00668a", color: "white", fontWeight: 600 }}
                title="Connect these flashcards to another node"
              >
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      {!minimized && (
        <div style={{ padding: "14px 16px 16px", flex: "1 1 0", minHeight: 0, overflowY: "auto" }} className="flex flex-col gap-3 nowheel">
          {cards.length === 0 ? (
            <>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste content to generate flashcards from…"
                rows={4}
                className="font-body text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-3 py-2.5 resize-none"
                style={{ background: "#f0ede8", border: "none" }}
              />
              <button
                onClick={generateCards}
                disabled={generating || !sourceText.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-label uppercase tracking-widest hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all"
                style={{ fontSize: 10, background: ACCENT }}
              >
                {generating ? (
                  <span className="animate-pulse">Generating…</span>
                ) : (
                  <>
                    <SparkleIcon size={14} />
                    Generate Cards
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Flip card */}
              <div
                className="rounded-xl flex items-center justify-center cursor-pointer transition-all hover:brightness-95 active:scale-[0.99]"
                style={{
                  minHeight: 120,
                  padding: "20px 16px",
                  background: flipped ? ACCENT : "#f0ede8",
                }}
                onClick={() => setFlipped((f) => !f)}
              >
                <p
                  className="font-body text-sm text-center leading-relaxed"
                  style={{ color: flipped ? "#ffffff" : "#1c1c19" }}
                >
                  {flipped ? card.back : card.front}
                </p>
              </div>
              <p className="font-label uppercase tracking-widest text-on-surface-variant/40 text-center" style={{ fontSize: 9 }}>
                {flipped ? "Answer" : "Question"} · tap to flip
              </p>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => { setCurrentIndex((i) => Math.max(0, i - 1)); setFlipped(false); }}
                  disabled={currentIndex === 0}
                  className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-surface-container transition-all active:scale-95"
                  style={{ background: "#f0ede8" }}
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <button
                  onClick={() => { setCards([]); setSourceText(""); }}
                  className="font-label uppercase tracking-widest text-on-surface-variant/50 hover:text-secondary transition-colors"
                  style={{ fontSize: 9 }}
                >
                  Regenerate
                </button>
                <button
                  onClick={() => { setCurrentIndex((i) => Math.min(cards.length - 1, i + 1)); setFlipped(false); }}
                  disabled={currentIndex === cards.length - 1}
                  className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-surface-container transition-all active:scale-95"
                  style={{ background: "#f0ede8" }}
                >
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
