"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore, isDemoProject, DEMO_REPORT_DATE } from "@/lib/store";
import { computeProgress } from "@/lib/calc/progress";
import { spiLevel, cn, toISODate } from "@/lib/utils";

const ROTATE_MS = 5000;

interface TickerEntry {
  id: string;
  name: string;
  planPct: number;
  realPct: number;
  spi: number | null;
}

/**
 * Tüm projelerin Plan/Real/SPI değerlerini her 3 saniyede bir döner şekilde gösterir.
 * Proje adı shimmer animasyonu ile sürekli akar.
 */
export function ProjectStatsTicker() {
  const projects = useStore((s) => s.projects);
  const wbsAll = useStore((s) => s.wbs);
  const plannedAll = useStore((s) => s.planned);
  const realizedAll = useStore((s) => s.realized);

  const entries: TickerEntry[] = useMemo(() => {
    const today = toISODate(new Date());
    return projects
      .filter((p) => p.status === "active")
      .map((p) => {
        const refDate = isDemoProject(p) ? DEMO_REPORT_DATE : today;
        const items = wbsAll
          .filter((w) => w.projectId === p.id && !w.deletedAt)
          .map((w) => ({ code: w.code, isLeaf: w.isLeaf, quantity: w.quantity, weight: w.weight }));
        const planned = plannedAll[p.id] || {};
        const realized = realizedAll[p.id] || {};
        const { planPct, realPct, spi } = computeProgress(items, planned, realized, refDate);
        return { id: p.id, name: p.name, planPct, realPct, spi };
      });
  }, [projects, wbsAll, plannedAll, realizedAll]);

  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);

  function jump(delta: number) {
    if (entries.length < 2) return;
    setFading(true);
    setTimeout(() => {
      setIdx((p) => (p + delta + entries.length) % entries.length);
      setFading(false);
    }, 250);
  }

  useEffect(() => {
    if (entries.length < 2 || paused) return;
    const t = setInterval(() => jump(1), ROTATE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, paused]);

  if (entries.length === 0) return null;

  const entry = entries[idx % entries.length];
  const spiCls = entry.spi != null
    ? { good: "text-green", warn: "text-yellow", bad: "text-red" }[spiLevel(entry.spi) as "good" | "warn" | "bad"]
    : "text-text3";

  return (
    <div
      className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border/60 bg-gradient-to-r from-bg2/60 via-white to-bg2/60"
      title="Aktif projeler — 5 saniyede bir döner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={cn(
          "flex items-center gap-3 py-0.5 transition-all duration-300 ease-out",
          fading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
        )}
      >
        {/* Proje adı — shimmer */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="size-1.5 rounded-full bg-accent animate-pulse-soft shrink-0" />
          <span className="text-shimmer font-display text-[12.5px] font-bold tracking-tight truncate max-w-[170px]">
            {entry.name}
          </span>
        </div>

        <span className="w-px h-3.5 bg-border" />

        {/* Stats */}
        <Stat label="Plan" value={`${(entry.planPct * 100).toFixed(1)}%`} valueClass="text-planned" />
        <Stat label="Real" value={`${(entry.realPct * 100).toFixed(1)}%`} valueClass="text-realized" />
        <Stat
          label="SPI"
          value={entry.spi == null ? "—" : entry.spi.toFixed(3)}
          valueClass={spiCls}
        />
      </div>

      {/* Sağdaki ok butonları — sabit, yan yana */}
      {entries.length > 1 && (
        <div className="flex items-center gap-0.5 pl-2 ml-1 border-l border-border shrink-0">
          <button
            type="button"
            onClick={() => jump(-1)}
            aria-label="Önceki proje"
            className="inline-flex items-center justify-center size-6 rounded-md text-text3 hover:text-accent hover:bg-bg2 transition-colors"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => jump(1)}
            aria-label="Sonraki proje"
            className="inline-flex items-center justify-center size-6 rounded-md text-text3 hover:text-accent hover:bg-bg2 transition-colors"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[9px] uppercase tracking-wider font-bold text-text3">{label}</span>
      <span className={cn("font-mono text-[12px] font-bold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
