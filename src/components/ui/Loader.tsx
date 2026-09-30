"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ASCII qubit loader: a disc of slashes and flickering bits that fills in as
 * the scene loads, with a live counter. On completion it blooms outward into
 * a ring and reveals the scene.
 */
export default function Loader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const [phase, setPhase] = useState<"load" | "out" | "gone">("load");
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = 220;
    c.width = S * dpr;
    c.height = S * dpr;
    ctx.scale(dpr, dpr);
    const cw = 9.5;
    const ch = 13;
    const cols = Math.floor(S / cw);
    const rows = Math.floor(S / ch);
    const R = 80;
    const seeds = Array.from({ length: cols * rows }, () => Math.random());

    let shown = 0;
    let raf = 0;
    let finished = false;
    const start = performance.now();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const elapsed = (now - start) / 1000;
      // Ease toward 90 while loading, then race to 100 once the scene is ready.
      const target = readyRef.current ? 100 : Math.min(90, 90 * (1 - Math.exp(-elapsed * 0.9)));
      shown += (target - shown) * (readyRef.current ? 0.12 : 0.06);
      const n = Math.min(100, Math.round(shown));
      if (count.current) count.current.textContent = `/${String(n).padStart(2, "0")}`;

      ctx.clearRect(0, 0, S, S);
      ctx.font = "500 12px ui-monospace, 'SF Mono', Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fill = shown / 100;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = x * cw + cw / 2;
          const py = y * ch + ch / 2;
          const dx = px - S / 2;
          const dy = py - S / 2;
          const d = Math.hypot(dx, dy);
          if (d > R) continue;
          const sd = seeds[y * cols + x];
          // fill from the bottom up, with a ragged edge
          const h = 1 - (py - (S / 2 - R)) / (2 * R);
          if (h > fill * 1.15 + sd * 0.15) continue;
          const flicker = Math.sin(now * 0.004 + sd * 80) > 0.93;
          const glyph = flicker ? (sd > 0.5 ? "1" : "0") : sd > 0.97 ? "ψ" : "/";
          const edge = 1 - d / R;
          ctx.fillStyle = flicker ? "rgba(160,255,255,0.95)" : `rgba(90,210,220,${0.25 + edge * 0.6})`;
          ctx.fillText(glyph, px, py);
        }
      }

      if (!finished && readyRef.current && n >= 100) {
        finished = true;
        setTimeout(() => setPhase("out"), 250);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (phase !== "out") return;
    onDone();
    const t = setTimeout(() => setPhase("gone"), 1800);
    return () => clearTimeout(t);
  }, [phase, onDone]);

  if (phase === "gone") return null;
  return (
    <div className={`loader ${phase === "out" ? "is-out" : ""}`} aria-hidden>
      <div className="loader__disc">
        <canvas ref={canvas} className="loader__canvas" />
        <span ref={count} className="loader__count">
          /00
        </span>
      </div>
      <div className="loader__ring" />
      <div className="loader__petals">
        {Array.from({ length: 12 }).map((_, i) => (
          <i key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
      </div>
    </div>
  );
}
