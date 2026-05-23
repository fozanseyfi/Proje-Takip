"use client";

import { FolderKanban, Trophy, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoShell } from "./demo-shell";

export function ProjectsDemo() {
  return (
    <DemoShell
      frames={[<Frame1 key="1" />, <Frame2 key="2" />, <Frame3 key="3" />]}
      captions={[
        "Aktif projeleri tek panelde gör — ilerleme, durum ve uyarılar.",
        "Tek bir projeyi seç — bütçe, takım ve görev metriklerini gör.",
        "Tüm projeleri ilerleme yüzdesine göre sıralayıp önceliklendir.",
      ]}
    />
  );
}

function Frame1() {
  const projects = [
    { name: "Ankara Polatlı GES", code: "GES-12", mw: "12 MW", pct: 72, tone: "green" as const },
    { name: "İzmir RES Faz-2",   code: "RES-25", mw: "18 MW", pct: 54, tone: "blue" as const },
    { name: "Konya Kapasite HES", code: "HES-19", mw: "8 MW",  pct: 41, tone: "purple" as const },
    { name: "Adana Çatı Sistemi", code: "GES-31", mw: "2.4 MW", pct: 28, tone: "yellow" as const },
    { name: "Mersin Tank Sahası", code: "OG-04",  mw: "6.1 MW", pct: 18, tone: "red" as const },
  ];
  const dot: Record<string, string> = { green: "bg-green", blue: "bg-blue", purple: "bg-purple", red: "bg-red", yellow: "bg-yellow" };
  const bar: Record<string, string> = { green: "bg-green", blue: "bg-blue", purple: "bg-purple", red: "bg-red", yellow: "bg-yellow" };
  return (
    <div className="p-3 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider font-bold text-text3">Aktif Projeler · 5</div>
        <div className="text-[9px] font-mono text-text3">Ort. ilerleme <span className="text-text font-bold">%42.6</span></div>
      </div>
      <div className="space-y-1">
        {projects.map((p, i) => (
          <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1.5">
            <FolderKanban className="size-3 text-text3 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10.5px] font-semibold text-text truncate">{p.name}</span>
                <span className="text-[8px] font-mono text-text3 shrink-0">{p.code}</span>
              </div>
              <div className="mt-0.5 h-0.5 rounded-full bg-bg3 overflow-hidden">
                <div className={cn("h-full rounded-full", bar[p.tone])} style={{ width: `${p.pct}%` }} />
              </div>
            </div>
            <span className="text-[8px] font-mono text-text3 hidden sm:inline shrink-0">{p.mw}</span>
            <span className={cn("size-1.5 rounded-full shrink-0", dot[p.tone])} />
            <span className="text-[9.5px] font-mono tabular-nums font-bold text-text w-8 text-right shrink-0">{p.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame2() {
  const metrics = [
    { label: "Bütçe Kullanımı", value: 68, color: "bg-blue" },
    { label: "Takım Yükü", value: 84, color: "bg-yellow" },
    { label: "Görev Tamamlanma", value: 72, color: "bg-accent" },
  ];
  return (
    <div className="p-4 h-full overflow-hidden">
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-2.5 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-accent text-white">
            <Trophy className="size-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-accent">Öncelikli</div>
            <div className="text-[12px] font-bold text-text truncate">Ankara Polatlı GES</div>
          </div>
          <div className="font-mono text-lg font-extrabold text-accent tabular-nums">72%</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-text2 font-medium">{m.label}</span>
              <span className="font-mono font-bold text-text">{m.value}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-bg3 overflow-hidden">
              <div className={cn("h-full rounded-full", m.color)} style={{ width: `${m.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Frame3() {
  const ranked = [
    { name: "Ankara Polatlı GES", pct: 72, badge: "ZAMANINDA", icon: CheckCircle2, color: "text-green" },
    { name: "İzmir RES Faz-2", pct: 54, badge: "DEVAM EDEN", icon: CheckCircle2, color: "text-blue" },
    { name: "Konya HES", pct: 31, badge: "BAŞLANGIÇ", icon: CheckCircle2, color: "text-purple" },
    { name: "Mersin Tank Sahası", pct: 18, badge: "GECİKMİŞ", icon: AlertCircle, color: "text-red" },
  ];
  return (
    <div className="p-4 h-full overflow-hidden">
      <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">İlerleme Sıralaması</div>
      <div className="space-y-1.5">
        {ranked.map((r, i) => {
          const Icon = r.icon;
          return (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-white px-2.5 py-2">
              <span className="font-mono text-[10px] font-bold text-text3 w-4 tabular-nums">{i + 1}</span>
              <Icon className={cn("size-3.5 shrink-0", r.color)} />
              <span className="text-[11px] font-semibold text-text flex-1 min-w-0 truncate">{r.name}</span>
              <span className="font-mono text-[10px] text-text3 tabular-nums w-9 text-right">{r.pct}%</span>
              <span className={cn("text-[8px] font-bold uppercase tracking-wider", r.color)}>{r.badge}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
