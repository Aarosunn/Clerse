"use client";

import { memo, useEffect, useRef } from "react";
import { EdgeProps, getBezierPath, useInternalNode } from "@xyflow/react";
import { getEdgeParams } from "../../lib/edgeUtils";

/**
 * RiverEdge — Single wavy SVG edge with animated flow.
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

function RiverEdge({
  source,
  target,
  sourceX: defaultSourceX,
  sourceY: defaultSourceY,
  targetX: defaultTargetX,
  targetY: defaultTargetY,
  sourcePosition: defaultSourcePosition,
  targetPosition: defaultTargetPosition,
}: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  let sourceX = defaultSourceX;
  let sourceY = defaultSourceY;
  let targetX = defaultTargetX;
  let targetY = defaultTargetY;
  let sourcePosition = defaultSourcePosition;
  let targetPosition = defaultTargetPosition;

  if (sourceNode && targetNode) {
    const params = getEdgeParams(sourceNode, targetNode);
    sourceX = params.sx;
    sourceY = params.sy;
    targetX = params.tx;
    targetY = params.ty;
    sourcePosition = params.sourcePos;
    targetPosition = params.targetPos;
  }

  // Get the standard bezier midpoints for the invisible interaction path
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let startTime = performance.now();

    const animate = (time: number) => {
      // Calculate a phase shift based on time to make the wave flow
      // A negative phase makes the wave flow from source to target
      const elapsedTime = time - startTime;
      const phase = (elapsedTime / 1000) * -1.5;

      const newPath = buildWavyPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
        amplitude: 15, // Determines how wide the wave is
        frequency: 2.5, // Determines how many peaks the wave has
        phase,
        segments: 64, // Resolution of the curve
      });

      if (pathRef.current) {
        pathRef.current.setAttribute("d", newPath);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
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

      {/* 1 animated river solid layer */}
      <path
        ref={pathRef}
        fill="none"
        stroke="#00BFFF"
        strokeWidth={6}
        strokeOpacity={0.8}
        strokeLinecap="round"
        className="river-edge-path"
        style={{
          filter: "drop-shadow(0 0 4px rgba(0,191,255,0.7))",
        }}
      />
    </g>
  );
}

export default memo(RiverEdge);

