"use client";

import { useState, useRef } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { FlashcardNodeData, FlashCard } from "@/types/nodes";
import { FlashcardIcon, SparkleIcon, ChevronLeftIcon, ChevronRightIcon } from "../Icons";
import WindowControls from "./WindowControls";

const ACCENT = "#c89b3c";

const FLASHCARD_SYSTEM_PROMPT = `Generate flashcards from the provided context.
Respond ONLY with a valid JSON array. No preamble, no markdown.
Format: [{"front": "question", "back": "answer"}]`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function FlashcardNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as FlashcardNodeData;
  const [cards, setCards] = useState<FlashCard[]>(data.cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [minimized, setMinimized] = useState(false);
  const streamRef = useRef("");

  async function generateCards() {
    if (!sourceText.trim()) return;
    setGenerating(true);
    streamRef.current = "";

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        system: FLASHCARD_SYSTEM_PROMPT,
        messages: [{ role: "user", content: [{ type: "text", text: sourceText }] }],
      }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      streamRef.current += decoder.decode(value, { stream: true });
    }

    try {
      const parsed: FlashCard[] = JSON.parse(streamRef.current);
      setCards(parsed);
      setCurrentIndex(0);
      setFlipped(false);
    } catch {
      setCards([{ front: "Parse error", back: streamRef.current.slice(0, 200) }]);
    }
    setGenerating(false);
  }

  const card = cards[currentIndex];

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{ width: "100%", background: "#ffffff", boxShadow: "0 8px 24px rgba(28,28,25,0.08)", border: "1px solid rgba(188,200,209,0.15)" }}
    >
      <NodeResizer minWidth={260} minHeight={200} color={ACCENT} />
      <Handle type="target" position={Position.Top} />

      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: `rgba(200,155,60,0.04)` }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <FlashcardIcon size={16} style={{ color: ACCENT }} />
          <span className="font-label uppercase tracking-widest text-on-surface-variant" style={{ fontSize: 10 }}>Flashcards</span>
        </div>
        {cards.length > 0 && (
          <span className="font-label text-on-surface-variant" style={{ fontSize: 10 }}>
            {currentIndex + 1} / {cards.length}
          </span>
        )}
      </div>

      {!minimized && (
        <div style={{ padding: "14px 16px 16px" }} className="flex flex-col gap-3">
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

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
