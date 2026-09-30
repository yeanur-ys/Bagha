/**
 * Shared, mutable, render-loop state. Nothing here triggers React renders —
 * the WebGL scene and the DOM overlay both read it every frame.
 */

export const SCROLL_VH = 1900;

/** Story chapters as ranges of normalised scroll progress (0 → 1). */
export const T = {
  intro: [0, 0.045],
  statement: [0.045, 0.14],
  descent: [0.14, 0.2],
  services: [0.2, 0.6],
  dive: [0.6, 0.66],
  process: [0.66, 0.86],
  finale: [0.86, 1],
} as const;

export type Range = readonly [number, number];

export const chapters = [
  { id: "intro", label: "Ground state", at: 0 },
  { id: "statement", label: "Studio", at: 0.1 },
  { id: "services", label: "Services", at: T.services[0] + 0.5 / 6 * (T.services[1] - T.services[0]) },
  { id: "process", label: "Process", at: T.process[0] + 0.125 * (T.process[1] - T.process[0]) },
  { id: "finale", label: "Contact", at: 0.985 },
] as const;

export const WORLD = {
  cardsTop: -19,
  cardsBottom: -46,
  cardRadius: 5.4,
  chandelierTop: -12.5,
  chipY: -56,
};

export const state = {
  /** raw scroll progress from the page */
  target: 0,
  /** damped progress used for animation */
  progress: 0,
  /** smoothed scroll velocity (progress / s) */
  velocity: 0,
  /** 0 → 1 entrance animation after the loader */
  entrance: 0,
  loaded: false,
  pointer: { x: 0, y: 0 },
  mobile: false,
  lowPower: false,
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const local = (p: number, r: Range) => clamp01((p - r[0]) / (r[1] - r[0]));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Stepped progress for a chapter with `n` items: the value holds on each item
 * (so it can be read) and glides between them. Returns 0..n-1 (float).
 */
export function stepped(t: number, n: number, hold = 0.28) {
  const s = clamp01(t) * n - 0.5;
  if (s <= 0) return 0;
  if (s >= n - 1) return n - 1;
  const i = Math.floor(s);
  return i + smooth(hold, 1 - hold, s - i);
}

/** Scroll position (0..1) at which service `i` is centred. */
export const serviceAt = (i: number) => T.services[0] + ((i + 0.5) / 6) * (T.services[1] - T.services[0]);
export const processAt = (i: number) => T.process[0] + ((i + 0.5) / 4) * (T.process[1] - T.process[0]);

/** Set by the Experience so any component can scroll the story. */
export const nav = {
  scrollTo: (_p: number, _opts?: { immediate?: boolean }) => {},
  openContact: () => {},
};
