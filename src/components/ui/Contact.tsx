"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { services, site } from "@/lib/content";

const needs = [...services.map((s) => s.short), "Something else"];

/**
 * Glass contact panel. No backend needed: it composes an email in the
 * visitor's mail client. Swap onSubmit for a fetch() to your API when ready.
 */
export default function Contact({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => first.current?.focus(), 500);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const body = [
      `Name: ${d.get("name")}`,
      `Email: ${d.get("email")}`,
      `Needs: ${picked.join(", ") || "—"}`,
      "",
      String(d.get("message") || ""),
    ].join("\n");
    window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(`Project enquiry — ${d.get("name")}`)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className={`contact ${open ? "is-open" : ""}`} aria-hidden={!open}>
      <button className="contact__scrim" onClick={onClose} tabIndex={-1} aria-label="Close" />
      <aside className="contact__panel" role="dialog" aria-modal="true" aria-label="Start a project">
        <button className="contact__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="kicker">OPEN A CHANNEL</p>
        <h2 className="contact__title">
          LET&apos;S BUILD
          <br />
          SOMETHING
          <br />
          IMPOSSIBLE.
        </h2>
        <form onSubmit={submit} className="contact__form">
          <label>
            <span>NAME</span>
            <input ref={first} name="name" required autoComplete="name" />
          </label>
          <label>
            <span>EMAIL</span>
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <fieldset>
            <legend>WHAT DO YOU NEED?</legend>
            <div className="chips">
              {needs.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={picked.includes(n)}
                  className={picked.includes(n) ? "is-on" : undefined}
                  onClick={() => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))}
                >
                  {n.toUpperCase()}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>TELL US ABOUT IT</span>
            <textarea name="message" rows={4} required />
          </label>
          <button type="submit" className="pill pill--solid pill--block">
            TRANSMIT →
          </button>
        </form>
        <a className="contact__mail" href={`mailto:${site.email}`}>
          {site.email}
        </a>
      </aside>
    </div>
  );
}
