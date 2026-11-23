// app/fx.tsx
// The "special effects" that make SnapFind feel alive. Each one is small on its own:
// - WordsIn: headline words float up one by one
// - Reveal / StackCards / PriceRace / ScrollProgress: effects that play as you scroll
// - useTypingHint: the search box types product ideas by itself
// - CountUp: prices roll up from $0 like a slot machine
// - Tilt: cards lean toward your mouse in 3D
// - useSpotlight: a soft glow follows your cursor across cards
// - ScanLog: a live "what the AI is doing" log while it works
// - Viewfinder: the camera frame you can click or drop a photo onto
// Everything respects "reduce motion" (a phone setting for people who get dizzy).
"use client";

import { useEffect, useRef, useState } from "react";

// True if the person asked their device for less animation.
function calm(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A headline whose words float up one after another, slightly blurred, then sharpen.
export function WordsIn({ text, className = "", start = 0 }: { text: string; className?: string; start?: number }) {
  return (
    <span className={`words ${className}`} aria-label={text}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="word" aria-hidden="true" style={{ animationDelay: `${start + i * 90}ms` }}>{w}</span>
      ))}
    </span>
  );
}

// The search box "types" ideas by itself: "Try: AirPods Pro 2", erase, "Try: PS5 Slim"...
export function useTypingHint(words: string[], active: boolean): string {
  const [hint, setHint] = useState(words[0]);
  useEffect(() => {
    if (!active || calm()) return;
    let w = 0, i = 0, deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const word = words[w];
      i += deleting ? -1 : 1;
      setHint(word.slice(0, i));
      let wait = deleting ? 35 : 75;
      if (!deleting && i === word.length) { deleting = true; wait = 1400; } // pause on the full word
      else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; wait = 300; }
      timer = setTimeout(step, wait);
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, [words, active]);
  return hint;
}

// A number that rolls up from 0 to its value (ease-out: fast at first, then gently stops).
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (calm()) return setN(value);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(t < 1 ? Math.round(value * eased) : value);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(n)}</>;
}

// Leans its contents toward the mouse in 3D. "perspective" is how strong the 3D looks.
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || calm() || !window.matchMedia("(hover: hover)").matches) return; // skip on touch screens
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5; // -0.5 (left edge) to 0.5 (right edge)
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateY(-2px)`;
    };
    const leave = () => (el.style.transform = "");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return ref;
}

// One listener for the whole page: whichever ".spot" card the mouse is over gets told
// where the mouse is (--mx, --my), and the CSS draws a glow there.
export function useSpotlight() {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(".spot") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", move);
    return () => document.removeEventListener("pointermove", move);
  }, []);
}

// The "what the AI is doing" log. Lines appear one by one while we wait.
const PHOTO_STEPS = [
  "Compressing photo to 1024px",
  "Fingerprinting image (dHash)",
  "Checking memory for a match",
  "Sending to vision model",
  "Reading logos, shapes and text",
  "Matching against products",
];
const PRICE_STEPS = [
  "Querying Google Shopping",
  "Querying eBay",
  "Removing accessories and junk listings",
  "Splitting new vs. used",
  "Ranking by total price incl. shipping",
];
export function ScanLog({ mode }: { mode: "photo" | "prices" }) {
  const steps = mode === "photo" ? PHOTO_STEPS : PRICE_STEPS;
  const [count, setCount] = useState(1);
  useEffect(() => {
    setCount(1);
    const id = setInterval(() => setCount((c) => Math.min(c + 1, steps.length)), 550);
    return () => clearInterval(id);
  }, [steps]);
  return (
    <ol className="log" aria-live="polite">
      {steps.slice(0, count).map((s, i) => (
        <li key={s} className={i === count - 1 ? "now" : "done"}>
          <span className="log-mark">{i === count - 1 ? "›" : "✓"}</span> {s}
          {i === count - 1 && <span className="caret" />}
        </li>
      ))}
    </ol>
  );
}

// The big camera frame on the home screen. Click it, or drag a photo onto it.
// It shows where your mouse is, like a real targeting screen.
export function Viewfinder({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [over, setOver] = useState(false); // is a photo being dragged over it?
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // where the mouse is, in %
  return (
    <label
      className={over ? "viewfinder spot over" : "viewfinder spot"}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) onFile(f);
      }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: Math.round(((e.clientX - r.left) / r.width) * 100), y: Math.round(((e.clientY - r.top) / r.height) * 100) });
      }}
      onPointerLeave={() => setPos(null)}
    >
      <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
      <span className="beam" />
      {pos && <span className="cross" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} />}
      <span className="vf-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.5-2h6.8l1.5 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
        </svg>
        <strong>{over ? "Drop it to scan" : "Tap to snap a photo"}</strong>
        <span className="muted">or drop an image anywhere</span>
      </span>
      <input type="file" accept="image/*" capture="environment" disabled={disabled} hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </label>
  );
}

// Makes things slide and fade in when you scroll them into view.
// IntersectionObserver is the browser telling us "this element just appeared on screen".
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: {
  children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (calm() || !("IntersectionObserver" in window)) return setSeen(true);
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); io.disconnect(); } // only animate the first time
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // @ts-expect-error: ref works the same on div, section, and li
    <Tag ref={ref} className={`reveal ${seen ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

// The thin colored bar at the very top that fills up as you scroll down the page.
// It also shares the scroll position with CSS (--scroll) so backgrounds can drift (parallax).
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
      document.documentElement.style.setProperty("--scroll", String(window.scrollY));
    };
    // Only redraw once per frame, even if the scroll event fires 100 times.
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div className="progress" ref={bar} aria-hidden="true" />;
}

// Cards that stick to the top and pile up like a deck as you swipe up.
// Each card shrinks a little as the next one slides over it.
export function StackCards({ cards }: { cards: { kicker: string; title: string; text: string; art: React.ReactNode }[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (calm()) return;
    const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>(".stack-card") ?? []);
    let raf = 0;
    const update = () => {
      raf = 0;
      items.forEach((card, i) => {
        const next = items[i + 1];
        if (!next) return;
        const a = card.getBoundingClientRect();
        const b = next.getBoundingClientRect();
        // 0 = the next card is far below, 1 = it fully covers this card.
        const covered = Math.min(1, Math.max(0, 1 - (b.top - a.top) / a.height));
        card.style.transform = `scale(${1 - covered * 0.06})`;
        card.style.filter = `brightness(${1 - covered * 0.03})`;
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="stack" ref={wrap}>
      {cards.map((c, i) => (
        <article key={c.title} className="stack-card" style={{ top: `${88 + i * 18}px` }}>
          <div className="stack-text">
            <span className="kicker">{c.kicker}</span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
          </div>
          <div className="stack-art">{c.art}</div>
        </article>
      ))}
    </div>
  );
}

// Price bars that grow from zero when they scroll into view, like a race.
export function PriceRace({ rows }: { rows: { store: string; price: number; best?: boolean }[] }) {
  const max = Math.max(...rows.map((r) => r.price));
  return (
    <Reveal className="race">
      {rows.map((r, i) => (
        <div key={r.store} className={r.best ? "race-row best" : "race-row"}>
          <span className="race-store">{r.store}</span>
          <span className="race-track">
            <span className="race-bar" style={{ width: `${(r.price / max) * 100}%`, transitionDelay: `${150 + i * 120}ms` }} />
          </span>
          <span className="race-price">${r.price}</span>
        </div>
      ))}
    </Reveal>
  );
}
