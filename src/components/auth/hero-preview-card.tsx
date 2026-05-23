"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Trophy,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HERO_INTERVAL = 6000;
const SWIPE_THRESHOLD = 40;
const SLIDES = [
  { label: "Aktif Projeler", Frame: ProjectsFrame },
  { label: "Proje Detayı", Frame: DetailFrame },
  { label: "Gantt & Takvim", Frame: GanttFrame },
  { label: "Şablon Galerisi", Frame: TemplatesFrame },
] as const;

export function HeroPreviewCard() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pulse, setPulse] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const count = SLIDES.length;

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setActive((p) => (p + 1) % count), HERO_INTERVAL);
    return () => clearInterval(t);
  }, [paused, count]);

  // Pulse blink her 2sn
  useEffect(() => {
    const t = setInterval(() => setPulse((p) => !p), 2000);
    return () => clearInterval(t);
  }, []);

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
    const sx = touchStartXRef.current;
    touchStartXRef.current = null;
    setPaused(false);
    if (sx === null) return;
    const ex = e.changedTouches[0]?.clientX ?? sx;
    const dx = ex - sx;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dx < 0) next();
    else prev();
  }

  return (
    <div
      className="group relative min-h-[470px] rounded-3xl overflow-hidden border border-border bg-gradient-to-br from-white via-bg2/40 to-accent/5 shadow-[0_18px_60px_-25px_rgb(16_185_129_/_0.45)] p-5 sm:p-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Dekoratif blur'lar */}
      <div className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-yellow/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 size-64 rounded-full bg-accent/10 blur-3xl" />

      {/* Üst bar: pulse label + counter */}
      <div className="relative flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full transition-all",
              pulse ? "bg-accent scale-100" : "bg-accent/40 scale-90"
            )}
          />
          <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-text2">
            {SLIDES[active].label}
          </span>
        </div>
        <div className="text-[10px] font-mono tabular-nums text-text3">
          {String(active + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </div>
      </div>

      {/* Slayt alanı */}
      <div className="relative min-h-[360px]">
        {SLIDES.map(({ Frame }, idx) => (
          <div
            key={idx}
            className={cn(
              "transition-opacity duration-500",
              idx === active
                ? "relative opacity-100"
                : "absolute inset-0 opacity-0 pointer-events-none"
            )}
            aria-hidden={idx !== active}
          >
            <Frame />
          </div>
        ))}
      </div>

      {/* Sol-sağ ok */}
      <button
        type="button"
        onClick={prev}
        aria-label="Önceki"
        className="absolute top-1/2 left-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-text2 opacity-0 shadow-soft backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100 active:scale-95"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        type="button"
        onClick={next}
        aria-label="Sonraki"
        className="absolute top-1/2 right-3 z-10 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/90 text-text2 opacity-0 shadow-soft backdrop-blur transition-opacity hover:bg-white group-hover:opacity-100 active:scale-95"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Dot indicator'lar */}
      <div className="relative mt-5 flex items-center justify-center gap-1.5">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActive(idx)}
            aria-label={`Slayt ${idx + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === active ? "w-8 bg-accent" : "w-1.5 bg-border hover:bg-text3"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME 1 — AKTİF PROJELER (zengin liste + 4 stat + trend)
// ═══════════════════════════════════════════════════════════════════════════
function ProjectsFrame() {
  const projects = [
    { name: "İzmir RES Faz-2", code: "RES-25", pct: 54, mw: "12 MW", tone: "blue" as const },
    { name: "Konya Kapasite HES", code: "HES-19", pct: 41, mw: "8 MW",  tone: "purple" as const },
    { name: "Adana Çatı Sistemi",  code: "GES-31", pct: 28, mw: "2.4 MW", tone: "yellow" as const },
    { name: "Mersin Tank Sahası",  code: "OG-04",  pct: 18, mw: "6.1 MW", tone: "red" as const },
  ];
  return (
    <div className="space-y-2.5">
      {/* Öne çıkan proje */}
      <div className="rounded-xl border border-accent/30 bg-gradient-to-br from-accent/12 via-white to-white p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center size-9 rounded-lg bg-accent text-white">
            <Trophy className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
              Öncelikli
              <span className="text-text3 font-mono">· GES-12</span>
            </div>
            <div className="text-sm font-bold text-text truncate">Ankara Polatlı GES · 12 MW</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-extrabold text-accent tabular-nums leading-none">72%</div>
            <div className="text-[9px] text-text3 font-mono mt-0.5">120 / 165 gün</div>
          </div>
        </div>
        {/* mini progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-bg3 overflow-hidden">
          <div className="h-full rounded-full bg-accent" style={{ width: "72%" }} />
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-1.5">
        {projects.map((p, i) => (
          <ProjectRow key={i} {...p} />
        ))}
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-4 gap-1.5">
        <StatBox label="Aktif Proje" value="5" trend="▲ 2" trendColor="text-green" />
        <StatBox label="Açık Görev" value="47" trend="▲ 8" trendColor="text-green" />
        <StatBox label="Tamamlanan" value="218" trend="▲ 14" trendColor="text-green" />
        <StatBox label="Geciken" value="3" tone="red" trend="▼ 1" trendColor="text-green" />
      </div>
    </div>
  );
}

function ProjectRow({
  name,
  code,
  pct,
  mw,
  tone,
}: {
  name: string;
  code: string;
  pct: number;
  mw: string;
  tone: "green" | "blue" | "purple" | "red" | "yellow";
}) {
  const dot: Record<string, string> = { green: "bg-green", blue: "bg-blue", purple: "bg-purple", red: "bg-red", yellow: "bg-yellow" };
  const bar: Record<string, string> = { green: "bg-green", blue: "bg-blue", purple: "bg-purple", red: "bg-red", yellow: "bg-yellow" };
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-white px-2.5 py-1.5 hover:border-accent/30 transition-colors">
      <FolderKanban className="size-3.5 text-text3 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-text truncate">{name}</span>
          <span className="text-[9px] font-mono text-text3 shrink-0">{code}</span>
        </div>
        <div className="mt-0.5 h-0.5 rounded-full bg-bg3 overflow-hidden">
          <div className={cn("h-full rounded-full", bar[tone])} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[9px] font-mono text-text3 hidden sm:inline">{mw}</span>
        <span className={cn("size-1.5 rounded-full", dot[tone])} />
        <span className="text-[10px] font-mono tabular-nums font-bold text-text w-8 text-right">{pct}%</span>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
  trend,
  trendColor,
}: {
  label: string;
  value: string;
  tone?: "red";
  trend?: string;
  trendColor?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white px-2 py-1.5">
      <div
        className={cn(
          "font-mono text-base font-extrabold tabular-nums leading-none",
          tone === "red" ? "text-red" : "text-text"
        )}
      >
        {value}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="text-[8.5px] text-text3 uppercase tracking-wider truncate">{label}</div>
        {trend && (
          <span className={cn("text-[8.5px] font-mono font-bold", trendColor)}>{trend}</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME 2 — PROJE DETAYI
// ═══════════════════════════════════════════════════════════════════════════
function DetailFrame() {
  const metrics = [
    { label: "Bütçe Kullanımı", value: 68, color: "bg-blue", suffix: "%" },
    { label: "Takım Yükü", value: 84, color: "bg-yellow", suffix: "%" },
    { label: "Görev Tamamlanma", value: 72, color: "bg-accent", suffix: "%" },
    { label: "Deadline Yaklaşımı", value: 73, color: "bg-purple", suffix: "g" },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-white p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-text3">
              Proje Detayı
            </div>
            <div className="text-sm font-bold text-text mt-0.5">Ankara Polatlı GES</div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/12 text-accent text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="size-3" />
            Zamanında
          </span>
        </div>

        {/* Metric bars */}
        <div className="space-y-2.5">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-text2 font-medium">{m.label}</span>
                <span className="font-mono font-bold text-text tabular-nums">
                  {m.value}
                  {m.suffix}
                </span>
              </div>
              <div className="h-2 rounded-full bg-bg3 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", m.color)} style={{ width: `${m.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        <KpiTile icon={Clock} label="SPI" value="0.96" tone="green" />
        <KpiTile icon={TrendingUp} label="CPI" value="1.02" tone="accent" />
        <KpiTile icon={AlertTriangle} label="Risk" value="Düşük" tone="yellow" />
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "green" | "accent" | "yellow";
}) {
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: "bg-green/10", text: "text-green" },
    accent: { bg: "bg-accent/10", text: "text-accent" },
    yellow: { bg: "bg-yellow/15", text: "text-yellow" },
  };
  const c = colors[tone];
  return (
    <div className="rounded-lg border border-border bg-white px-2.5 py-2 flex items-center gap-2">
      <span className={cn("inline-flex items-center justify-center size-7 rounded-md", c.bg, c.text)}>
        <Icon className="size-3.5" />
      </span>
      <div>
        <div className="text-[9px] uppercase tracking-wider font-bold text-text3">{label}</div>
        <div className={cn("font-mono text-sm font-extrabold tabular-nums", c.text)}>{value}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME 3 — GANTT & TAKVİM
// ═══════════════════════════════════════════════════════════════════════════
function GanttFrame() {
  const tasks = [
    { name: "Saha Hazırlık", start: 0, len: 25, color: "bg-accent" },
    { name: "Trafo Montaj", start: 18, len: 30, color: "bg-blue" },
    { name: "Panel Kurulum", start: 35, len: 45, color: "bg-purple" },
    { name: "Kablaj", start: 55, len: 25, color: "bg-yellow" },
    { name: "Devreye Alma", start: 75, len: 20, color: "bg-green" },
  ];
  const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz"];
  return (
    <div className="rounded-xl border border-border bg-white p-3.5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text3">
            Zaman Çizelgesi
          </div>
          <div className="text-sm font-bold text-text mt-0.5">6 Ay · 5 Milestone</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue/10 text-blue text-[10px] font-bold uppercase">
          <Calendar className="size-3" />
          Aktif
        </span>
      </div>

      {/* Header — months */}
      <div className="grid grid-cols-6 gap-px text-[9px] font-mono text-text3 mb-1.5">
        {months.map((m) => (
          <div key={m} className="text-center">
            {m}
          </div>
        ))}
      </div>

      {/* Task rows */}
      <div className="space-y-1.5">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="text-[10px] text-text2 font-medium w-20 truncate">{t.name}</div>
            <div className="relative flex-1 h-3 bg-bg3 rounded">
              <div
                className={cn("absolute top-0 h-full rounded transition-all", t.color)}
                style={{ left: `${t.start}%`, width: `${t.len}%` }}
              />
              {/* Today line */}
              <div className="absolute top-0 bottom-0 w-px bg-red" style={{ left: "55%" }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-text3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-px bg-red" /> Bugün
        </span>
        <span className="font-mono tabular-nums">SPI 0.96 · CPI 1.02</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAME 4 — ŞABLON GALERİSİ
// ═══════════════════════════════════════════════════════════════════════════
function TemplatesFrame() {
  const templates = [
    { name: "GES Kurulum", icon: "☀️", count: "79 kalem" },
    { name: "RES Saha", icon: "🌬️", count: "62 kalem" },
    { name: "HES Tesis", icon: "💧", count: "54 kalem" },
    { name: "Yazılım", icon: "💻", count: "32 kalem" },
    { name: "Pazarlama", icon: "📣", count: "24 kalem" },
    { name: "Boş Proje", icon: "✨", count: "Sıfırdan" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-text3">Şablonlar</div>
          <div className="text-sm font-bold text-text mt-0.5">Hızlı Başlat</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow/15 text-yellow text-[10px] font-bold uppercase tracking-wider">
          <Sparkles className="size-3" />
          {templates.length} hazır
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {templates.map((t, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-white p-2.5 hover:border-accent/40 hover:shadow-soft transition-all cursor-pointer"
          >
            <div className="text-xl leading-none">{t.icon}</div>
            <div className="mt-1.5 text-[11px] font-bold text-text leading-tight truncate">
              {t.name}
            </div>
            <div className="text-[9px] text-text3 font-mono mt-0.5">{t.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
