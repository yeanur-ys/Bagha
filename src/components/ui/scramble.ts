const GLYPHS = "/\\|_-=+<>01#*%ψ⟩";

const running = new WeakMap<HTMLElement, number>();

/** Decode an element's text from random glyphs, left to right. */
export function scramble(el: HTMLElement, duration = 900) {
  const final = el.dataset.text ?? el.textContent ?? "";
  el.dataset.text = final;
  const prev = running.get(el);
  if (prev) cancelAnimationFrame(prev);
  const start = performance.now();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    el.textContent = final;
    return;
  }
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    let out = "";
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      const reveal = i / final.length;
      if (ch === " " || ch === "\n") out += ch;
      else if (t > reveal * 0.75 + 0.25) out += ch;
      else if (t > reveal * 0.75) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += " ";
    }
    el.textContent = out;
    if (t < 1) running.set(el, requestAnimationFrame(tick));
    else {
      el.textContent = final;
      running.delete(el);
    }
  };
  running.set(el, requestAnimationFrame(tick));
}
