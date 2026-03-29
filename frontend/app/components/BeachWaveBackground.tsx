"use client";

import { useEffect, useRef } from "react";

/* ─── Props ─── */
interface BeachWaveBackgroundProps {
  speed?: number;
  colorDeep?: string;
  colorShallow?: string;
  colorSand?: string;
}

/* ─── Hex → vec3 helper ─── */
function hexToVec3(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/* ─── GLSL Simplex 2D Noise (Ashima / Stefan Gustavson) ─── */
const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   //  0.5*(sqrt(3.0)-1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    //  1.0 / 41.0
  );
  // First corner
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  // Other corners
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  // Permutations
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  // Gradients
  vec3 x  = 2.0 * fract(p * C.www) - 1.0;
  vec3 h  = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  // Compute final noise value at P
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

/* ─── Vertex Shader (fullscreen quad) ─── */
const VERTEX_SHADER = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* ─── Fragment Shader ─── */
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

${SIMPLEX_NOISE_GLSL}

uniform float uTime;
uniform float uSpeed;
uniform vec3  uColorDeep;
uniform vec3  uColorShallow;
uniform vec3  uColorSand;
uniform vec2  uResolution;

varying vec2 vUv;

void main() {
  // uv: top of screen = 0 (ocean), bottom = 1 (sand)
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);

  // ─── Fixed shoreline with gentle lapping ───
  float shoreCenter = 0.55;

  // Overlapping wave cycles for natural back-and-forth
  float wave1 = sin(uTime * uSpeed * 0.7) * 0.04;
  float wave2 = sin(uTime * uSpeed * 1.1 + 2.0) * 0.025;
  float wave3 = sin(uTime * uSpeed * 1.8 + 4.5) * 0.015;
  float waveOffset = wave1 + wave2 + wave3;

  // Smooth noise along the shoreline for organic edge
  float n1 = snoise(vec2(uv.x * 3.0 + uTime * 0.12, uTime * 0.08)) * 0.05;
  float n2 = snoise(vec2(uv.x * 7.0 - uTime * 0.2, uTime * 0.1 + 5.0)) * 0.02;
  float shoreline = shoreCenter + waveOffset + n1 + n2;

  // ─── Water depth ───
  float waterDepth = shoreline - uv.y;
  float inWater = smoothstep(-0.005, 0.01, waterDepth);

  // ─── Downward flow: visible current in water ───
  // Layered noise that scrolls top→bottom to show water direction
  float flow1 = snoise(vec2(uv.x * 4.0, uv.y * 3.0 - uTime * uSpeed * 0.35)) * 0.5 + 0.5;
  float flow2 = snoise(vec2(uv.x * 8.0 + 3.0, uv.y * 5.0 - uTime * uSpeed * 0.5)) * 0.5 + 0.5;
  float flow3 = snoise(vec2(uv.x * 2.5 - 1.0, uv.y * 2.0 - uTime * uSpeed * 0.2 + 7.0)) * 0.5 + 0.5;
  float flowPattern = flow1 * 0.5 + flow2 * 0.3 + flow3 * 0.2;

  // ─── Foam — wider, stronger shoreline foam ───
  // Primary foam band at the water's edge
  float foamEdge = smoothstep(-0.008, 0.006, waterDepth) * (1.0 - smoothstep(0.006, 0.14, waterDepth));
  // Secondary softer foam that reaches further into the water
  float foamWide = smoothstep(-0.003, 0.02, waterDepth) * (1.0 - smoothstep(0.02, 0.22, waterDepth));
  // Foam breakup noise for natural look
  float foamNoise = snoise(vec2(uv.x * 12.0 + uTime * 0.3, uv.y * 8.0 - uTime * uSpeed * 0.2)) * 0.5 + 0.5;
  float foamNoise2 = snoise(vec2(uv.x * 20.0 - uTime * 0.15, uv.y * 14.0 - uTime * uSpeed * 0.25 + 3.0)) * 0.5 + 0.5;
  // Combined foam: strong edge + noisy wider band
  float foam = foamEdge * 0.9 + foamWide * foamNoise * 0.5 + foamWide * foamNoise2 * 0.2;
  foam = clamp(foam, 0.0, 1.0);

  // ─── Whitecaps: rare, tiny specks in deeper water ───
  float capNoise = snoise(vec2(uv.x * 35.0 + uTime * 0.08, uv.y * 25.0 - uTime * uSpeed * 0.35));
  float whitecaps = smoothstep(0.74, 0.88, capNoise) * smoothstep(0.12, 0.30, waterDepth) * 0.12;

  // ─── Wet Sand Trail: Darkened spots where water receded ───
  // Approximate maximum reach of the combined waves
  float maxWaveReach = 0.06;
  float shorelineMax = shoreCenter + n1 + n2 + maxWaveReach;

  // Track the distance from the current water edge onto the sand
  float distToWater = -waterDepth;           // positive on sand side
  float distToBase = shorelineMax - uv.y;    // positive up to the max wave reach
  float inWetZone = step(0.0, distToWater) * step(0.0, distToBase);

  // The wet mark fades as it gets further from the current water line (drying effect)
  float recedeDistance = max(shorelineMax - shoreline, 0.001);
  float wetFade = 1.0 - smoothstep(0.0, recedeDistance, distToWater);
  wetFade = pow(wetFade, 1.5); // non-linear fade for more realistic drying

  // Add noise to make the sand look porous and naturally drying in patches
  float wetNoise = snoise(vec2(uv.x * 20.0, uv.y * 20.0 - uTime * 0.1)) * 0.5 + 0.5;
  wetFade *= mix(0.6, 1.0, wetNoise);

  float wetSandArea = inWetZone * wetFade;

  // ─── Water color: shallow → deep with visible flow ───
  float depthNorm = smoothstep(0.0, 0.45, waterDepth);
  vec3 waterColor = mix(uColorShallow, uColorDeep, depthNorm);
  // Modulate water color with flow pattern to show current direction
  vec3 flowHighlight = mix(waterColor, uColorShallow, 0.25);
  waterColor = mix(waterColor, flowHighlight, flowPattern * inWater * 0.4);

  // ─── Sand: clean flat color ───
  vec3 sandColor = uColorSand;

  // ─── Compositing ───
  vec3 color = sandColor;

  // Wet sand is a softened, darker yellow version of the base sand color
  vec3 wetSandColor = sandColor * vec3(0.90, 0.85, 0.75); // Less harsh darkening, keeps it yellow
  color = mix(color, wetSandColor, wetSandArea);

  color = mix(color, waterColor, inWater);
  color = mix(color, vec3(1.0), foam * 0.85);
  color = mix(color, vec3(1.0), whitecaps * inWater);

  gl_FragColor = vec4(color, 1.0);
}
`;

/* ─── React Component ─── */
export default function BeachWaveBackground({
  speed = 0.8,
  colorDeep = "#1a9e9e",
  colorShallow = "#5ce0d6",
  colorSand = "#dcbf8e",
}: BeachWaveBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dynamic import ogl to avoid SSR issues — WebGL requires DOM
    let cancelled = false;

    (async () => {
      const { Renderer, Program, Mesh, Triangle } = await import("ogl");

      if (cancelled) return;

      // ─── Renderer setup ───
      const dpr = Math.min(window.devicePixelRatio, 2);
      const renderer = new Renderer({ dpr, alpha: false, antialias: false });
      const gl = renderer.gl;
      gl.clearColor(
        ...hexToVec3(colorSand),
        1
      );
      container.appendChild(gl.canvas);

      // ─── Fullscreen triangle (more efficient than a quad) ───
      const geometry = new Triangle(gl);

      const program = new Program(gl, {
        vertex: VERTEX_SHADER,
        fragment: FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: speed },
          uColorDeep: { value: hexToVec3(colorDeep) },
          uColorShallow: { value: hexToVec3(colorShallow) },
          uColorSand: { value: hexToVec3(colorSand) },
          uResolution: { value: [gl.canvas.width, gl.canvas.height] },
        },
      });

      const mesh = new Mesh(gl, { geometry, program });

      // ─── Sizing ───
      function resize() {
        const w = container!.clientWidth;
        const h = container!.clientHeight;
        renderer.setSize(w, h);
        program.uniforms.uResolution.value = [w * dpr, h * dpr];
      }
      resize();

      const ro = new ResizeObserver(resize);
      ro.observe(container);

      // ─── Animation loop ───
      const startTime = performance.now();

      function update() {
        if (cancelled) return;
        requestAnimationFrame(update);
        program.uniforms.uTime.value = (performance.now() - startTime) / 1000;
        renderer.render({ scene: mesh });
      }
      requestAnimationFrame(update);

      // ─── Cleanup on unmount ───
      return () => {
        // This inner return won't be captured by useEffect's cleanup,
        // so we rely on the `cancelled` flag + outer cleanup below.
      };
    })();

    // Outer cleanup — runs when useEffect tears down
    return () => {
      cancelled = true;
      // Remove the canvas that ogl appended
      const canvas = container.querySelector("canvas");
      if (canvas) {
        // Lose WebGL context to free GPU memory
        const glCtx =
          canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (glCtx) {
          const ext = glCtx.getExtension("WEBGL_lose_context");
          if (ext) ext.loseContext();
        }
        canvas.remove();
      }
    };
  }, [speed, colorDeep, colorShallow, colorSand]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        overflow: "hidden",
        // Fallback if WebGL isn't supported
        backgroundColor: colorSand,
      }}
    />
  );
}
