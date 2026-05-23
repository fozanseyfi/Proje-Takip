"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_INTERVAL_MS = 3500;
const SWIPE_THRESHOLD_PX = 40;

export function DemoShell({
  frames,
  captions,
  intervalMs = DEFAULT_INTERVAL_MS,
  domain = "projetakip.fozanseyfi.com",
  height = "h-[260px]",
}: {
  frames: React.ReactNode[];
  captions: string[];
  intervalMs?: number;
  domain?: string;
  height?: string;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const count = frames.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((p) => (p + 1) % count), intervalMs);
    return () => clearInterval(t);
  }, [paused, count, intervalMs]);

  function next() {
    setActive((p) => (p + 1) % count);
  }
  function prev() {
    setActive((p) => (p - 1 + count) % count);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  }
  function onTouchEnd(e: React.TouchEvent) {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    setPaused(false);
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) next();
    else prev();
  }

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-white shadow-medium"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-bg2 px-3 py-2">
        <div className="size-2.5 rounded-full bg-red/70" />
        <div className="size-2.5 rounded-full bg-yellow/80" />
        <div className="size-2.5 rounded-full bg-green/70" />
        <div className="ml-3 flex-1 truncate rounded bg-white px-2 py-0.5 text-[10px] text-text3 font-mono">
          {domain}
        </div>
      </div>

      <div className={cn("relative bg-bg-soft", height)}>
        {frames.map((F, idx) => (
          <div
            key={idx}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              idx === active ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            aria-hidden={idx !== active}
          >
            {F}
          </div>
        ))}
        <button
          type="button"
          onClick={prev}
          aria-label="Önceki"
          className="absolute top-1/2 left-2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-text2 opacity-0 shadow-soft backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100 focus:opacity-100 active:scale-95"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Sonraki"
          className="absolute top-1/2 right-2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-text2 opacity-0 shadow-soft backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100 focus:opacity-100 active:scale-95"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Caption + progress */}
      <div className="border-t border-border bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text3 text-[10px] font-bold tabular-nums">
            {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
          <span className="text-text font-medium">{captions[active]}</span>
        </div>
        <div className="mt-2 flex gap-1">
          {frames.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActive(idx)}
              aria-label={`Slayt ${idx + 1}`}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                idx === active ? "bg-accent" : idx < active ? "bg-accent/30" : "bg-border"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
