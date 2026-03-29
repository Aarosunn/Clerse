"use client";

import { memo, useMemo } from "react";
import { EdgeProps, getBezierPath } from "@xyflow/react";

/**
 * RiverEdge — 3-layered wavy SVG edge with animated flow.
 * Uses sine-wave displacement on top of a standard bezier path
 * for a river/current aesthetic matching the canvas background.
 */

interface WavyPathParams {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  amplitude: number;
  frequency: number;
  phase: number;
  segments: number;
}

function buildWavyPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  amplitude,
  frequency,
  phase,
  segments,
}: WavyPathParams): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Unit vectors: along the line and perpendicular
  const ux = len > 0 ? dx / len : 0;
  const uy = len > 0 ? dy / len : 0;
  const nx = -uy; // perpendicular
  const ny = ux;

  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Position along the straight line
    const baseX = sourceX + dx * t;
    const baseY = sourceY + dy * t;
    // Sine displacement perpendicular to the line
    const wave = Math.sin(t * frequency * Math.PI * 2 + phase) * amplitude;
    // Taper amplitude at endpoints so line connects cleanly
    const taper = Math.sin(t * Math.PI);
    const px = baseX + nx * wave * taper;
    const py = baseY + ny * wave * taper;

    if (i === 0) {
      points.push(`M ${px} ${py}`);
    } else {
      points.push(`L ${px} ${py}`);
    }
  }

  return points.join(" ");
}

const RIVER_LAYERS = [
  { color: "#00BFFF", opacity: 0.5, width: 2.5, amplitudeScale: 1.0, phaseOffset: 0, dashArray: "none" },
  { color: "#476083", opacity: 0.3, width: 1.5, amplitudeScale: 0.7, phaseOffset: 2.1, dashArray: "none" },
  { color: "#00bdfd", opacity: 0.2, width: 1.0, amplitudeScale: 1.3, phaseOffset: 4.2, dashArray: "6 4" },
];

function RiverEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  // Get the standard bezier midpoints for the invisible interaction path
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const paths = useMemo(() => {
    return RIVER_LAYERS.map((layer, i) => {
      const d = buildWavyPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        amplitude: 8 * layer.amplitudeScale,
        frequency: 1.5,
        phase: layer.phaseOffset,
        segments: 64,
      });
      return { ...layer, d, key: i };
    });
  }, [sourceX, sourceY, targetX, targetY]);

  return (
    <g className="river-edge-group">
      {/* Invisible fat path for interaction (click/hover target) */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />

      {/* 3 animated river layers */}
      {paths.map(({ key, d, color, opacity, width, dashArray }) => (
        <path
          key={key}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeOpacity={opacity}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          className="river-edge-path"
          style={{
            filter: key === 0 ? "drop-shadow(0 0 3px rgba(0,191,255,0.3))" : undefined,
          }}
        />
      ))}
    </g>
  );
}

export default memo(RiverEdge);
