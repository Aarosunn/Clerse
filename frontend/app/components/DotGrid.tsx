"use client";

import { useRef, useEffect, useCallback } from "react";
import { useViewport } from "@xyflow/react";

const DOT_SPACING = 32;
const DOT_BASE_RADIUS = 1.5;
const DOT_MAX_RADIUS = 3;
const GLOW_RADIUS = 160;
const BASE_COLOR = [216, 210, 198] as const;   // #d8d2c6
const GLOW_COLOR = [0, 191, 255] as const;     // #00BFFF — oceanic accent
const BASE_OPACITY = 0.6;
const GLOW_OPACITY = 1;

export default function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const viewport = useViewport();
  // Store viewport in a ref so the draw loop always reads the latest value
  const vpRef = useRef(viewport);
  vpRef.current = viewport;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Resize backing store if needed
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    const { x: panX, y: panY, zoom } = vpRef.current;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const glowR2 = GLOW_RADIUS * GLOW_RADIUS;

    // Scaled spacing and radius
    const spacing = DOT_SPACING * zoom;
    const baseR = DOT_BASE_RADIUS * zoom;
    const maxR = DOT_MAX_RADIUS * zoom;

    // Offset so dots align with React Flow's coordinate grid
    const offsetX = ((panX % spacing) + spacing) % spacing;
    const offsetY = ((panY % spacing) + spacing) % spacing;

    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;

    for (let row = 0; row <= rows; row++) {
      const y = offsetY + row * spacing;
      for (let col = 0; col <= cols; col++) {
        const x = offsetX + col * spacing;

        const dx = x - mx;
        const dy = y - my;
        const dist2 = dx * dx + dy * dy;

        let r: number;
        let cr: number, cg: number, cb: number, alpha: number;

        if (dist2 < glowR2) {
          const t = 1 - Math.sqrt(dist2) / GLOW_RADIUS;
          const ease = t * t;

          r = baseR + (maxR - baseR) * ease;
          cr = BASE_COLOR[0] + (GLOW_COLOR[0] - BASE_COLOR[0]) * ease;
          cg = BASE_COLOR[1] + (GLOW_COLOR[1] - BASE_COLOR[1]) * ease;
          cb = BASE_COLOR[2] + (GLOW_COLOR[2] - BASE_COLOR[2]) * ease;
          alpha = BASE_OPACITY + (GLOW_OPACITY - BASE_OPACITY) * ease;
        } else {
          r = baseR;
          cr = BASE_COLOR[0];
          cg = BASE_COLOR[1];
          cb = BASE_COLOR[2];
          alpha = BASE_OPACITY;
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha})`;
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);

    function onPointerMove(e: PointerEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onPointerLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
