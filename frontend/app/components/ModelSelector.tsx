"use client";

const MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-opus-4-6", label: "Opus 4.6" },
];

interface Props {
  value: string;
  onChange: (model: string) => void;
}

export default function ModelSelector({ value, onChange }: Props) {
  const current = MODELS.find((m) => m.id === value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="font-label uppercase tracking-widest outline-none cursor-pointer rounded-lg px-2 py-1 transition-colors"
      style={{
        fontSize: 10,
        background: "rgba(71,96,131,0.08)",
        color: "rgba(71,96,131,0.7)",
        border: "none",
      }}
      title={current?.label}
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
