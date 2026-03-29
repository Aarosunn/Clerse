"use client";

import { useState, useRef } from "react";
import { Handle, Position, NodeProps, NodeResizer } from "@xyflow/react";
import { QuizNodeData, QuizQuestion } from "@/types/nodes";
import { QuizIcon, SparkleIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "../Icons";
import { useConnectMode } from "../Canvas";
import WindowControls from "./WindowControls";

const ACCENT = "#d97706";

const QUIZ_SYSTEM_PROMPT = `Generate quiz questions from the provided context.
Respond ONLY with a valid JSON array. No preamble, no markdown.
Format: [{"question": "...", "options": ["A", "B", "C", "D"], "correct_answer": "A", "explanation": "..."}]`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function QuizNode({ id, data: rawData }: NodeProps<any>) {
  const data = rawData as QuizNodeData;
  const [questions, setQuestions] = useState<QuizQuestion[]>(data.questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sourceText, setSourceText] = useState("");
  const [minimized, setMinimized] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const streamRef = useRef("");
  const { startConnect: startConnectMode } = useConnectMode();

  function handleConnect() {
    if (questions.length === 0) return;
    const text = questions
      .map((q, i) => `Q${i + 1}: ${q.question}\nOptions: ${q.options.join(", ")}\nAnswer: ${q.correct_answer}\nExplanation: ${q.explanation}`)
      .join("\n\n");
    const msgs = [{
      role: "user" as const,
      content: [{ type: "text" as const, text: `Quiz:\n\n${text}` }],
    }];
    startConnectMode(id, msgs);
  }

  async function generateQuiz() {
    if (!sourceText.trim()) return;
    setGenerating(true);
    streamRef.current = "";

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        system: QUIZ_SYSTEM_PROMPT,
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
      const parsed: QuizQuestion[] = JSON.parse(streamRef.current);
      setQuestions(parsed);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setScore(0);
      setAnswered(new Set());
    } catch {
      setQuestions([{
        question: "Parse error",
        options: ["Could not parse response"],
        correct_answer: "",
        explanation: streamRef.current.slice(0, 200),
      }]);
    }
    setGenerating(false);
  }

  function selectAnswer(option: string) {
    if (selectedAnswer) return;
    setSelectedAnswer(option);
    setShowExplanation(true);
    if (!answered.has(currentIndex) && option === question?.correct_answer) {
      setScore((s) => s + 1);
    }
    setAnswered((prev) => new Set(prev).add(currentIndex));
  }

  function nextQuestion() {
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
    setSelectedAnswer(null);
    setShowExplanation(false);
  }

  function prevQuestion() {
    setCurrentIndex((i) => Math.max(0, i - 1));
    setSelectedAnswer(null);
    setShowExplanation(false);
  }

  const question = questions[currentIndex];

  return (
    <div
      className="rounded-xl flex flex-col animate-fade-scale overflow-hidden"
      style={{ width: "100%", height: "100%", background: "#ffffff", boxShadow: "0 8px 24px rgba(28,28,25,0.08)", border: "1px solid rgba(188,200,209,0.15)" }}
    >
      <NodeResizer minWidth={280} minHeight={200} color={ACCENT} lineStyle={{ strokeWidth: 6, strokeOpacity: 0 }} handleStyle={{ width: 14, height: 14, borderRadius: 7 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid rgba(188,200,209,0.12)", background: "rgba(217,119,6,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <WindowControls nodeId={id} minimized={minimized} onToggleMinimize={() => setMinimized((m) => !m)} />
          <QuizIcon size={16} style={{ color: ACCENT }} />
          <span className="font-label uppercase tracking-widest text-on-surface-variant" style={{ fontSize: 10 }}>Quiz</span>
        </div>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <>
              <span className="font-label text-on-surface-variant" style={{ fontSize: 10 }}>
                {currentIndex + 1} / {questions.length}
              </span>
              <span
                className="font-label px-2 py-0.5 rounded-full"
                style={{ fontSize: 9, background: "rgba(217,119,6,0.12)", color: ACCENT, fontWeight: 600 }}
              >
                {score}/{answered.size} correct
              </span>
              <button
                onClick={handleConnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label uppercase tracking-widest transition-all whitespace-nowrap"
                style={{ fontSize: 10, background: "#00668a", color: "white", fontWeight: 600 }}
                title="Connect this quiz to another node"
              >
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {!minimized && (
        <div style={{ padding: "14px 16px 16px", flex: "1 1 0", minHeight: 0, overflowY: "auto" }} className="flex flex-col gap-3 nowheel">
          {questions.length === 0 ? (
            <>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste content to generate quiz questions from…"
                rows={4}
                className="font-body text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none rounded-xl px-3 py-2.5 resize-none"
                style={{ background: "#f0ede8", border: "none" }}
              />
              <button
                onClick={generateQuiz}
                disabled={generating || !sourceText.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-label uppercase tracking-widest hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all"
                style={{ fontSize: 10, background: ACCENT }}
              >
                {generating ? (
                  <span className="animate-pulse">Generating…</span>
                ) : (
                  <>
                    <SparkleIcon size={14} />
                    Generate Quiz
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              {/* Question */}
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "#f0ede8" }}
              >
                <p className="font-body text-sm text-on-surface leading-relaxed font-medium">
                  {question.question}
                </p>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2">
                {question.options.map((option, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const isSelected = selectedAnswer === letter;
                  const isCorrect = letter === question.correct_answer;
                  const hasAnswered = selectedAnswer !== null;

                  let optionBg = "#f8f6f3";
                  let optionBorder = "1px solid rgba(188,200,209,0.2)";
                  let optionColor = "#1c1c19";

                  if (hasAnswered) {
                    if (isCorrect) {
                      optionBg = "rgba(39,201,63,0.1)";
                      optionBorder = "1px solid rgba(39,201,63,0.4)";
                      optionColor = "#15803d";
                    } else if (isSelected && !isCorrect) {
                      optionBg = "rgba(239,68,68,0.08)";
                      optionBorder = "1px solid rgba(239,68,68,0.3)";
                      optionColor = "#dc2626";
                    }
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => selectAnswer(letter)}
                      disabled={hasAnswered}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all hover:brightness-95 active:scale-[0.99] disabled:cursor-default"
                      style={{ background: optionBg, border: optionBorder, color: optionColor }}
                    >
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 font-label"
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          background: hasAnswered && isCorrect ? "rgba(39,201,63,0.2)" : "rgba(188,200,209,0.15)",
                          color: hasAnswered && isCorrect ? "#15803d" : "#6d7981",
                        }}
                      >
                        {hasAnswered && isCorrect ? <CheckIcon size={14} /> : letter}
                      </span>
                      <span className="font-body text-sm leading-relaxed">{option}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {showExplanation && question.explanation && (
                <div
                  className="rounded-xl px-4 py-3"
                  style={{
                    background: selectedAnswer === question.correct_answer
                      ? "rgba(39,201,63,0.06)"
                      : "rgba(239,68,68,0.04)",
                    border: selectedAnswer === question.correct_answer
                      ? "1px solid rgba(39,201,63,0.15)"
                      : "1px solid rgba(239,68,68,0.1)",
                  }}
                >
                  <p className="font-label uppercase tracking-widest mb-1" style={{ fontSize: 9, color: "#6d7981" }}>
                    Explanation
                  </p>
                  <p className="font-body text-sm text-on-surface leading-relaxed">
                    {question.explanation}
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={prevQuestion}
                  disabled={currentIndex === 0}
                  className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 hover:bg-surface-container transition-all active:scale-95"
                  style={{ background: "#f0ede8" }}
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <button
                  onClick={() => { setQuestions([]); setSourceText(""); setScore(0); setAnswered(new Set()); }}
                  className="font-label uppercase tracking-widest text-on-surface-variant/50 hover:text-secondary transition-colors"
                  style={{ fontSize: 9 }}
                >
                  Regenerate
                </button>
                <button
                  onClick={nextQuestion}
                  disabled={currentIndex === questions.length - 1}
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
