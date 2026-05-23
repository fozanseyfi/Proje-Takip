"use client";

import { Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoShell } from "./demo-shell";

export function TeamDemo() {
  return (
    <DemoShell
      frames={[<LoadFrame key="1" />, <MatrixFrame key="2" />, <WarnFrame key="3" />]}
      captions={[
        "Ekip üyelerinin iş yükü oranı — kim dolu, kim boş?",
        "Kim hangi projede çalışıyor — atama matrisi.",
        "Aşırı yüklenme uyarısı — dengelemeye yön ver.",
      ]}
    />
  );
}

const TEAM = [
  { name: "Mehmet Kaya",  role: "Saha Mühendisi", load: 92, color: "bg-red",    avBg: "bg-red/15 text-red" },
  { name: "Ayşe Demir",   role: "Proje Yöneticisi", load: 78, color: "bg-yellow", avBg: "bg-yellow/15 text-yellow" },
  { name: "Ozan Yıldız",  role: "Elektrik", load: 65, color: "bg-blue",   avBg: "bg-blue/15 text-blue" },
  { name: "Selin Şahin",  role: "Satınalma", load: 48, color: "bg-accent", avBg: "bg-accent/15 text-accent" },
  { name: "Kerem Aydın",  role: "Mekanik", load: 38, color: "bg-purple", avBg: "bg-purple/15 text-purple" },
  { name: "Burak Tan",    role: "Stajyer", load: 22, color: "bg-text3",  avBg: "bg-bg2 text-text2" },
];

function LoadFrame() {
  const totalLoad = TEAM.reduce((s, m) => s + m.load, 0) / TEAM.length;
  return (
    <div className="p-3 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-text3">İş Yükü Dağılımı · {TEAM.length} kişi</div>
        <div className="text-[9px] font-mono text-text3">Ort. <span className="text-text font-bold">%{Math.round(totalLoad)}</span></div>
      </div>
      <div className="space-y-1">
        {TEAM.map((m, i) => (
          <div key={i} className="rounded-md border border-border bg-white px-2 py-1">
            <div className="flex items-center gap-1.5">
              <div className={cn("size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0", m.avBg)}>
                {m.name.split(" ").map((p) => p[0]).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold text-text truncate">{m.name}</div>
                <div className="text-[8.5px] text-text3 truncate">{m.role}</div>
              </div>
              <div className="font-mono text-[10px] font-bold text-text tabular-nums shrink-0">{m.load}%</div>
            </div>
            <div className="mt-0.5 h-0.5 rounded-full bg-bg3 overflow-hidden">
              <div className={cn("h-full rounded-full", m.color)} style={{ width: `${m.load}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatrixFrame() {
  const projects = ["Polatlı", "İzmir", "Konya", "Adana", "Mersin"];
  const matrix = [
    [1, 1, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 1, 1],
    [0, 1, 1, 0, 1],
    [0, 0, 1, 1, 0],
  ];
  return (
    <div className="p-3 h-full overflow-hidden">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-text3">Atama Matrisi</div>
        <div className="text-[9px] font-mono text-text3">{TEAM.length} üye × {projects.length} proje</div>
      </div>
      <div className="rounded-md border border-border bg-white overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-bg2">
              <th className="px-2 py-1 text-left font-bold text-text3 uppercase tracking-wider text-[8.5px]">Üye</th>
              {projects.map((p) => (
                <th key={p} className="px-1 py-1 text-center font-bold text-text3 uppercase tracking-wider text-[8.5px]">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEAM.map((m, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-2 py-0.5">
                  <div className="flex items-center gap-1">
                    <div className={cn("size-4 rounded-full flex items-center justify-center text-[7.5px] font-bold shrink-0", m.avBg)}>
                      {m.name.split(" ").map((p) => p[0]).join("")}
                    </div>
                    <span className="text-[9.5px] font-medium text-text truncate max-w-[70px]">{m.name}</span>
                  </div>
                </td>
                {matrix[i].map((v, j) => (
                  <td key={j} className="px-1 py-0.5 text-center">
                    {v ? (
                      <span className="inline-block size-2 rounded-full bg-accent" />
                    ) : (
                      <span className="inline-block size-2 rounded-full bg-bg3" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarnFrame() {
  return (
    <div className="p-4 h-full overflow-hidden">
      <div className="rounded-xl border border-red/30 bg-red/5 p-3 mb-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-red shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red">Aşırı Yüklenme</div>
            <div className="text-[12px] font-bold text-text mt-0.5">Mehmet Kaya · %92 yük</div>
            <div className="text-[11px] text-text2 mt-1 leading-snug">
              4 projede aktif görev; bu hafta 3 deadline çakışıyor. Dağıtım yeniden değerlendirilmeli.
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ActionTile icon={Users} label="Görev Devret" />
        <ActionTile icon={AlertTriangle} label="Deadline Esnet" />
      </div>
      <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-text3">Öneri</div>
      <div className="mt-1 text-[11px] text-text2 leading-snug">
        Selin Şahin (%48) ve Burak Tan (%22) müsait. 2 görev devredilirse Mehmet'in yükü %62'ye düşer.
      </div>
    </div>
  );
}

function ActionTile({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-white px-2.5 py-2 flex items-center gap-2 hover:border-accent/40 cursor-pointer transition-all">
      <Icon className="size-3.5 text-accent" />
      <span className="text-[11px] font-semibold text-text">{label}</span>
    </div>
  );
}
