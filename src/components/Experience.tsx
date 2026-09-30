"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Lenis from "lenis";
import { SCROLL_VH, T, chapters, clamp01, local, nav, smooth, state, stepped } from "@/lib/store";
import { services } from "@/lib/content";
import Loader from "./ui/Loader";
import Hud from "./ui/Hud";
import Chapters from "./ui/Chapters";
import Contact from "./ui/Contact";
import { scramble } from "./ui/scramble";
import { drone } from "./ui/sound";

const Scene = dynamic(() => import("./three/Scene"), { ssr: false });

/** Temperature readout for the journey: room temp → 15 mK → collapsed. */
function readout(p: number) {
  if (p >= T.finale[0] + 0.03) return "|ψ⟩ COLLAPSED";
  const keys: [number, number][] = [
    [0, 300],
    [T.statement[1], 300],
    [T.services[0], 50],
    [T.services[1], 0.1],
    [T.dive[1], 0.015],
  ];
  let k = 300;
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, ka] = keys[i];
    const [b, kb] = keys[i + 1];
    if (p >= a && p <= b) k = Math.exp(Math.log(ka) + (Math.log(kb) - Math.log(ka)) * ((p - a) / (b - a || 1)));
    if (p > b) k = kb;
  }
  if (k >= 10) return `${k.toFixed(0)} K`;
  if (k >= 1) return `${k.toFixed(2)} K`;
  return `${(k * 1000).toFixed(1)} mK`;
}

export default function Experience() {
  const [mounted, setMounted] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [svc, setSvc] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [contact, setContact] = useState(false);
  const lenisRef = useRef<Lenis | null>(null);

  // Device profile before the scene mounts
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    state.mobile = window.innerWidth / window.innerHeight < 0.85;
    state.lowPower = coarse || (navigator.hardwareConcurrency ?? 8) <= 4;
    setMounted(true);
    // Never trap the visitor behind the loader if WebGL is unavailable.
    const fallback = setTimeout(() => setSceneReady(true), 15000);
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => clearTimeout(fallback);
  }, []);

  // Smooth scroll + the master loop that drives progress and the DOM layer
  useEffect(() => {
    if (!mounted) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = new Lenis({ lerp: reduced ? 1 : 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.4, autoRaf: false });
    lenisRef.current = lenis;
    lenis.stop();

    const max = () => document.documentElement.scrollHeight - window.innerHeight;
    nav.scrollTo = (p, opts) =>
      lenis.scrollTo(clamp01(p) * max(), {
        duration: opts?.immediate ? 0 : 2.6,
        immediate: opts?.immediate,
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      });

    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-in]")).map((el) => ({
      el,
      a: parseFloat(el.dataset.in!),
      b: parseFloat(el.dataset.out!),
      f: parseFloat(el.dataset.fade ?? "0.014"),
      on: false,
    }));
    const readoutEl = document.querySelector<HTMLElement>("[data-readout]");
    const progressEl = document.querySelector<HTMLElement>("[data-progress]");

    let raf = 0;
    let last = performance.now();
    let lastSvc = -1;
    let lastChapter = -1;
    let lastText = "";

    const onPointer = (e: PointerEvent) => {
      state.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      state.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      lenis.raf(now);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const target = clamp01(window.scrollY / Math.max(1, max()));
      const prev = state.progress;
      state.target = target;
      state.progress = reduced ? target : prev + (target - prev) * (1 - Math.exp(-dt * 4.5));
      const vel = (state.progress - prev) / Math.max(dt, 0.001);
      state.velocity += (vel - state.velocity) * 0.15;
      if (state.loaded && state.entrance < 1) state.entrance = Math.min(1, state.entrance + dt / 2.6);

      const p = state.progress;
      for (const b of blocks) {
        const o = smooth(b.a - b.f, b.a, p) * (1 - smooth(b.b, b.b + b.f, p)) * (state.loaded ? 1 : 0);
        const dir = p < b.a ? 1 : -1;
        b.el.style.opacity = o.toFixed(3);
        b.el.style.transform = `translate3d(0, ${((1 - o) * 26 * dir).toFixed(1)}px, 0)`;
        b.el.style.visibility = o < 0.01 ? "hidden" : "visible";
        b.el.style.pointerEvents = o > 0.6 ? "auto" : "none";
        const on = o > 0.55;
        if (on && !b.on) b.el.querySelectorAll<HTMLElement>("[data-scramble]").forEach((el) => scramble(el));
        b.on = on;
      }

      const i = Math.round(stepped(local(p, T.services), services.length));
      if (i !== lastSvc) {
        if (lastSvc !== -1) drone.ping(1400 + i * 110);
        lastSvc = i;
        setSvc(i);
      }
      let ch = 0;
      chapters.forEach((c, k) => {
        if (p >= c.at - 0.04) ch = k;
      });
      if (ch !== lastChapter) {
        lastChapter = ch;
        setChapter(ch);
      }
      const text = readout(p);
      if (text !== lastText && readoutEl) {
        readoutEl.textContent = text;
        lastText = text;
      }
      if (progressEl) progressEl.style.transform = `scaleX(${p.toFixed(4)})`;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      lenis.destroy();
    };
  }, [mounted]);

  // Re-decode the service panel when the active service changes
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".svc [data-scramble]").forEach((el) => scramble(el, 700));
  }, [svc]);

  const onLoaderDone = useCallback(() => {
    state.loaded = true;
    setEntered(true);
    lenisRef.current?.start();
  }, []);

  const openContact = useCallback(() => {
    setContact(true);
    lenisRef.current?.stop();
  }, []);
  const closeContact = useCallback(() => {
    setContact(false);
    lenisRef.current?.start();
  }, []);
  useEffect(() => {
    nav.openContact = openContact;
  }, [openContact]);

  return (
    <>
      <div className="stage" aria-hidden>
        {mounted && <Scene onReady={() => setSceneReady(true)} />}
      </div>
      <div className="grain" aria-hidden />
      <main className={`ui ${entered ? "is-entered" : ""}`}>
        <Hud chapter={chapter} />
        <Chapters svc={svc} />
      </main>
      <Contact open={contact} onClose={closeContact} />
      <Loader ready={sceneReady} onDone={onLoaderDone} />
      <div className="scroll-space" style={{ height: `${SCROLL_VH}vh` }} />
    </>
  );
}
