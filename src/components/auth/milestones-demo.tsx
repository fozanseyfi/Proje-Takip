"use client";

import { CheckSquare, Clock, GripVertical, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoShell } from "./demo-shell";

export function MilestonesDemo() {
  return (
    <DemoShell
      frames={[<KanbanFrame key="1" />, <TimelineFrame key="2" />, <DetailFrame key="3" />]}
      captions={[
        "Kanban kolonları — Yapılacak / Devam Eden / Tamamlandı.",
        "Milestone zaman çizgisi — sırada ne, ne kadar yaklaşmış?",
        "Görev detayı — atanan kişi, deadline, alt görevler.",
      ]}
    />
  );
}

function KanbanFrame() {
  const cols = [
    {
      title: "Yapılacak",
      tone: "bg-text3/15 text-text2",
      tasks: [
        { name: "Saha taraması", tag: "ÖNCE", tagBg: "bg-yellow/15 text-yellow" },
        { name: "Trafo siparişi", tag: "BÜTÇE", tagBg: "bg-blue/15 text-blue" },
        { name: "ÇED itirazı dilekçe", tag: "YASAL", tagBg: "bg-purple/15 text-purple" },
        { name: "İK izin onayı", tag: "İK", tagBg: "bg-text3/15 text-text2" },
      ],
    },
    {
      title: "Devam Eden",
      tone: "bg-blue/15 text-blue",
      tasks: [
        { name: "Panel kurulum", tag: "%62", tagBg: "bg-blue/15 text-blue" },
        { name: "Kablaj montajı", tag: "%48", tagBg: "bg-blue/15 text-blue" },
        { name: "Trafo nakliye", tag: "BUGÜN", tagBg: "bg-red/15 text-red" },
      ],
    },
    {
      title: "Tamamlandı",
      tone: "bg-accent/15 text-accent",
      tasks: [
        { name: "Statik proje", tag: "✓", tagBg: "bg-accent/15 text-accent" },
        { name: "ÇED raporu", tag: "✓", tagBg: "bg-accent/15 text-accent" },
        { name: "Topoğrafya ölçüm", tag: "✓", tagBg: "bg-accent/15 text-accent" },
      ],
    },
  ];
  return (
    <div className="p-2.5 h-full grid grid-cols-3 gap-1.5 overflow-hidden">
      {cols.map((c, i) => (
        <div key={i} className="rounded-lg border border-border bg-white p-1.5 flex flex-col gap-1">
          <div className={cn("inline-flex self-start items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider", c.tone)}>
            {c.title}
            <span className="font-mono tabular-nums">({c.tasks.length})</span>
          </div>
          {c.tasks.map((t, j) => (
            <div key={j} className="flex items-center gap-1 rounded-md border border-border bg-bg-soft px-1.5 py-1">
              <GripVertical className="size-2.5 text-text3 shrink-0" />
              <span className="text-[9.5px] text-text font-medium truncate flex-1 min-w-0">{t.name}</span>
              <span className={cn("inline-flex items-center px-1 rounded text-[8px] font-bold shrink-0", t.tagBg)}>
                {t.tag}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TimelineFrame() {
  const milestones = [
    { name: "Saha Hazırlığı", date: "15 Mar", done: true },
    { name: "Trafo Devreye", date: "02 Nis", done: true },
    { name: "Panel Kurulum", date: "28 Nis", done: true },
    { name: "Kablaj Tamamla", date: "15 May", done: false, near: true },
    { name: "Devreye Alma", date: "30 May", done: false },
  ];
  return (
    <div className="p-4 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-text3">Milestone Zaman Çizgisi</div>
          <div className="text-sm font-bold text-text mt-0.5">5 Aşama · 3 ✓</div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow/15 text-yellow text-[9px] font-bold uppercase">
          <Clock className="size-3" /> 12g kaldı
        </span>
      </div>
      <div className="relative pl-3">
        <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border" />
        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2.5">
              {m.done ? (
                <CheckCircle2 className="size-3 text-accent -ml-3.5 shrink-0 bg-white rounded-full" />
              ) : m.near ? (
                <span className="size-3 -ml-3.5 shrink-0 rounded-full bg-yellow ring-2 ring-yellow/20" />
              ) : (
                <Circle className="size-3 text-text3 -ml-3.5 shrink-0 bg-white" />
              )}
              <span className={cn("text-[11px] font-semibold flex-1 truncate", m.done ? "text-text3 line-through" : "text-text")}>
                {m.name}
              </span>
              <span className="font-mono text-[10px] text-text3 tabular-nums">{m.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailFrame() {
  const subtasks = [
    { label: "Kablo serim", done: true },
    { label: "Pano bağlantısı", done: true },
    { label: "Topraklama testi", done: false },
    { label: "Yalıtım ölçümü", done: false },
  ];
  return (
    <div className="p-4 h-full overflow-hidden">
      <div className="rounded-lg border border-border bg-white p-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-text3">Görev</div>
            <div className="text-[13px] font-bold text-text mt-0.5 leading-tight">
              Kablaj Tamamla
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow/15 text-yellow text-[9px] font-bold uppercase whitespace-nowrap">
            15 May
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
          <div className="size-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[10px] font-bold">
            MK
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-text">Mehmet Kaya</div>
            <div className="text-[9px] text-text3">Saha Mühendisi</div>
          </div>
          <span className="text-[9px] font-bold text-accent">ATANDI</span>
        </div>

        <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-1.5">Alt Görevler</div>
        <div className="space-y-1">
          {subtasks.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              {s.done ? <CheckSquare className="size-3.5 text-accent shrink-0" /> : <Circle className="size-3.5 text-text3 shrink-0" />}
              <span className={cn(s.done && "text-text3 line-through")}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
