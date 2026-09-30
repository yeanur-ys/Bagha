"use client";

import { finale, process, services, site, statement } from "@/lib/content";
import { T, nav, processAt, serviceAt } from "@/lib/store";

/**
 * DOM layer of the story. Every block declares the scroll range it lives in
 * (data-in / data-out); the Experience loop fades and drifts them, and
 * decodes [data-scramble] text when a block turns on.
 */

const r = (n: number) => n.toFixed(4);

export default function Chapters({ svc }: { svc: number }) {
  const s = services[svc];
  return (
    <div className="chapters">
      {/* 00 — Ground state */}
      <section className="ch ch--intro" data-in={0} data-out={r(T.intro[1] * 0.7)}>
        <p className="ch-intro__tag">
          <span data-scramble>WEB · AI · ENGINEERING STUDIO</span>
        </p>
        <div className="scroll-cue">
          <span data-scramble>SCROLL TO ENTER THE SYSTEM</span>
          <i />
        </div>
      </section>

      {/* 01 — Statement */}
      <section className="ch ch--statement" data-in={r(T.statement[0] + 0.035)} data-out={r(T.statement[1] - 0.012)}>
        <h1 className="sr-only">{statement.lines.join(" ")}</h1>
        <div className="statement__copy">
          {statement.paragraphs.map((p, i) => (
            <p key={i} data-scramble>
              {p}
            </p>
          ))}
        </div>
      </section>

      {/* 02 — Services intro caption (during the descent) */}
      <section className="ch ch--caption" data-in={r(T.descent[0] + 0.012)} data-out={r(T.descent[1] - 0.018)}>
        <p className="kicker">
          <span data-scramble>CHAPTER 02 — DESCENDING TO 15 MILLIKELVIN</span>
        </p>
        <h2 className="caption__title">
          <span data-scramble>SIX WAYS WE</span>
          <span data-scramble>BEND THE WEB</span>
        </h2>
      </section>

      {/* 02 — Services */}
      <section className="ch ch--services" data-in={r(T.services[0] + 0.004)} data-out={r(T.services[1] - 0.004)}>
        <div className="svc" key={s.id}>
          <p className="kicker">
            <span data-scramble>{`SERVICE 0${svc + 1} / 0${services.length}`}</span>
          </p>
          <h2 className="svc__title">
            {s.title.map((l) => (
              <span key={l} data-scramble>
                {l}
              </span>
            ))}
          </h2>
          <p className="svc__body">{s.body}</p>
          <ul className="svc__tags">
            {s.tags.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        <nav className="menu" aria-label="Services">
          <p className="menu__q">WHAT DO YOU NEED?</p>
          <ul>
            {services.map((x, i) => (
              <li key={x.id}>
                <button className={i === svc ? "is-active" : undefined} onClick={() => nav.scrollTo(serviceAt(i))}>
                  <span>-&gt;</span> {x.short.toUpperCase()}
                </button>
              </li>
            ))}
          </ul>
          <button className="ask" onClick={() => nav.openContact()}>
            ASK US ANYTHING…
          </button>
        </nav>
      </section>

      {/* 03 — Process caption (the dive into the chip) */}
      <section className="ch ch--caption" data-in={r(T.dive[0] + 0.012)} data-out={r(T.dive[1] - 0.004)}>
        <p className="kicker">
          <span data-scramble>CHAPTER 03 — INSIDE THE PROCESSOR</span>
        </p>
        <h2 className="caption__title">
          <span data-scramble>HOW WE WORK,</span>
          <span data-scramble>QUBIT BY QUBIT</span>
        </h2>
      </section>

      {/* 03 — Process steps */}
      {process.map((p, i) => (
        <section
          key={p.title}
          className="ch ch--step"
          data-in={r(processAt(i) - 0.018)}
          data-out={r(processAt(i) + 0.018)}
          data-fade="0.01"
        >
          <p className="kicker">
            <span data-scramble>{`STEP 0${i + 1} / 04`}</span>
          </p>
          <p className="step__ket">{p.ket}</p>
          <h2 className="step__title">
            <span data-scramble>{p.title}</span>
          </h2>
          <p className="step__body">{p.body}</p>
          <div className="step__bar">
            {process.map((_, k) => (
              <i key={k} className={k <= i ? "is-on" : undefined} />
            ))}
          </div>
        </section>
      ))}

      {/* 04 — Collapse / contact */}
      <section className="ch ch--finale" data-in={r(T.finale[0] + 0.05)} data-out={1}>
        <p className="kicker">
          <span data-scramble>{`CHAPTER 04 — ${finale.kicker}`}</span>
        </p>
        <h2 className="finale__title">
          {finale.lines.map((l) => (
            <span key={l} data-scramble>
              {l}
            </span>
          ))}
        </h2>
        <p className="finale__sub">{finale.sub}</p>
        <div className="finale__actions">
          <button className="pill pill--solid" onClick={() => nav.openContact()}>
            START A PROJECT
          </button>
          <a className="pill" href={`mailto:${site.email}`}>
            {site.email.toUpperCase()}
          </a>
        </div>
        <footer className="finale__foot">
          <span>© {new Date().getFullYear()} {site.name}</span>
          <span className="finale__socials">
            {site.socials.map((x) => (
              <a key={x.label} href={x.href} target="_blank" rel="noreferrer">
                {x.label.toUpperCase()}
              </a>
            ))}
          </span>
          <button onClick={() => nav.scrollTo(0)}>BACK TO GROUND STATE ↑</button>
        </footer>
      </section>
    </div>
  );
}
