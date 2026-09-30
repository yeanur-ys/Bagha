"use client";

import { useState } from "react";
import { chapters, nav, serviceAt } from "@/lib/store";
import { site } from "@/lib/content";
import { drone } from "./sound";

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="2.2" />
      <ellipse cx="16" cy="16" rx="8" ry="3" stroke="currentColor" strokeWidth="1" opacity=".6" />
      <path d="M16 16 L21 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="21" cy="9" r="1.8" fill="currentColor" />
    </svg>
  );
}

export default function Hud({ chapter }: { chapter: number }) {
  const [sound, setSound] = useState(false);
  return (
    <>
      <header className="hud-top">
        <button className="brand" onClick={() => nav.scrollTo(0)} aria-label={`${site.name} — back to start`}>
          <Mark />
          <span>{site.name}</span>
        </button>
        <div className="hud-top__right">
          <button
            className={`sound ${sound ? "is-on" : ""}`}
            onClick={() => setSound(drone.toggle())}
            aria-label={sound ? "Mute ambient sound" : "Play ambient sound"}
            aria-pressed={sound}
          >
            {[0, 1, 2, 3].map((i) => (
              <i key={i} style={{ animationDelay: `${i * 0.13}s` }} />
            ))}
          </button>
          <nav className="navpill" aria-label="Primary">
            <button onClick={() => nav.scrollTo(serviceAt(0))}>SERVICES</button>
            <span className="navpill__line" />
            <button onClick={() => nav.openContact()}>CONTACT</button>
          </nav>
        </div>
      </header>

      <nav className="rail" aria-label="Chapters">
        {chapters.map((c, i) => (
          <button key={c.id} className={i === chapter ? "is-active" : undefined} onClick={() => nav.scrollTo(c.at)}>
            <span className="rail__label">{c.label}</span>
            <i />
          </button>
        ))}
      </nav>

      <div className="readout" aria-hidden>
        <span className="readout__k">SYSTEM</span>
        <span className="readout__v" data-readout>
          300 K
        </span>
        <span className="readout__bar">
          <i data-progress />
        </span>
      </div>
    </>
  );
}
