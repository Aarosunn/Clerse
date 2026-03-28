"use client";

import { useEffect, useCallback } from "react";
import { useOthers, useUpdateMyPresence } from "@liveblocks/react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { CURSOR_COLORS } from "@/lib/liveblocks";

export default function Presence() {
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();
  const { screenToFlowPosition } = useReactFlow();
  const viewport = useViewport();

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      updateMyPresence({ cursor: pos });
    },
    [screenToFlowPosition, updateMyPresence]
  );

  const handlePointerLeave = useCallback(() => {
    updateMyPresence({ cursor: null });
  }, [updateMyPresence]);

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [handlePointerMove, handlePointerLeave]);

  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
      {others.map(({ connectionId, presence }) => {
        if (!presence?.cursor) return null;
        const color = CURSOR_COLORS[connectionId % CURSOR_COLORS.length];
        const screenX = presence.cursor.x * viewport.zoom + viewport.x;
        const screenY = presence.cursor.y * viewport.zoom + viewport.y;

        return (
          <div
            key={connectionId}
            className="absolute transition-all duration-75 ease-out"
            style={{ left: screenX, top: screenY }}
          >
            {/* Cursor arrow */}
            <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
              <path
                d="M1 1L18 10L9 13L5 22L1 1Z"
                fill={color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>
            {/* Name badge */}
            <div
              className="absolute left-4 top-5 px-2 py-0.5 rounded-full font-label text-white whitespace-nowrap animate-fade-scale"
              style={{ fontSize: 9, background: color }}
            >
              {presence.name || `User ${connectionId}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
