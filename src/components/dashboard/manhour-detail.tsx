"use client";

import { useMemo, useState } from "react";
import { Clock, Building2, Users, Calendar, TrendingUp, Activity } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { manhourByDiscipline, getDisciplineLabel } from "@/lib/calc/sections";
import { formatNumber, toISODate, addDays, cn } from "@/lib/utils";

// Disiplin renkleri — küçük renk noktaları + bar için
const DISCIPLINE_COLOR: Record<string, { bar: string; dot: string; text: string }> = {
  mekanik:     { bar: "bg-accent",        dot: "bg-accent",        text: "text-accent" },
  elektrik:    { bar: "bg-yellow",        dot: "bg-yellow",        text: "text-yellow" },
  insaat:      { bar: "bg-blue",          dot: "bg-blue",          text: "text-blue" },
  muhendislik: { bar: "bg-purple",        dot: "bg-purple",        text: "text-purple" },
  idari:       { bar: "bg-text2",         dot: "bg-text2",         text: "text-text2" },
  diger:       { bar: "bg-text3",         dot: "bg-text3",         text: "text-text3" },
  unknown:     { bar: "bg-text3",         dot: "bg-text3",         text: "text-text3" },
};

function discColors(d: string) {
  return DISCIPLINE_COLOR[d] ?? DISCIPLINE_COLOR.diger;
}

export function ManhourDetailWidget() {
  const project = useCurrentProject();
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const attendance = useStore((s) => s.personnelAttendance);

  const today = toISODate(new Date());
  const defaultFrom = project ? toISODate(addDays(today, -30)) : today;

  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(today);
  const [draftFrom, setDraftFrom] = useState<string>(defaultFrom);
  const [draftTo, setDraftTo] = useState<string>(today);

  const disciplineStats = useMemo(
    () => project ? manhourByDiscipline(attendance, personnel, project.id, from, to) : [],
    [attendance, personnel, project, from, to]
  );

  // Disiplin × Firma kırılımı: { discipline -> { company -> hours } }
  const discCompanyBreakdown = useMemo(() => {
    if (!project) return {} as Record<string, Record<string, number>>;
    const personById = new Map(personnel.map((p) => [p.id, p]));
    const map: Record<string, Record<string, number>> = {};
    for (const a of attendance) {
      if (a.projectId !== project.id) continue;
      if (a.date < from || a.date > to) continue;
      if (!a.present) continue;
      const p = personById.get(a.personnelMasterId);
      const disc = (p?.discipline ?? "unknown") as string;
      const company = p?.company ?? "Bilinmiyor";
      if (!map[disc]) map[disc] = {};
      map[disc][company] = (map[disc][company] || 0) + (a.hours || 0);
    }
    return map;
  }, [attendance, personnel, project, from, to]);

  const totalHours = disciplineStats.reduce((s, d) => s + d.hours, 0);
  const totalUniquePeople = useMemo(() => {
    if (!project) return 0;
    const ids = new Set<string>();
    for (const a of attendance) {
      if (a.projectId === project.id && a.present && a.date >= from && a.date <= to) {
        ids.add(a.personnelMasterId);
      }
    }
    return ids.size;
  }, [attendance, project, from, to]);

  // gün sayısı (aralıkta puantaj olan gün — basit hesap)
  const distinctDays = useMemo(() => {
    if (!project) return 0;
    const days = new Set<string>();
    for (const a of attendance) {
      if (a.projectId === project.id && a.present && a.date >= from && a.date <= to) {
        days.add(a.date);
      }
    }
    return days.size;
  }, [attendance, project, from, to]);

  const avgPerDay = distinctDays > 0 ? totalHours / distinctDays : 0;

  // Firma bazlı dağılım (toplam)
  const companyStats = useMemo(() => {
    if (!project) return [];
    const personById = new Map(personnel.map((p) => [p.id, p]));
    const buckets: Record<string, { hours: number; people: Set<string> }> = {};
    for (const a of attendance) {
      if (a.projectId !== project.id) continue;
      if (a.date < from || a.date > to) continue;
      if (!a.present) continue;
      const person = personById.get(a.personnelMasterId);
      const company = person?.company ?? "Bilinmiyor";
      if (!buckets[company]) buckets[company] = { hours: 0, people: new Set() };
      buckets[company].hours += a.hours || 0;
      buckets[company].people.add(a.personnelMasterId);
    }
    const total = Object.values(buckets).reduce((s, b) => s + b.hours, 0);
    return Object.entries(buckets)
      .map(([company, v]) => ({
        company,
        hours: v.hours,
        people: v.people.size,
        pct: total > 0 ? (v.hours / total) * 100 : 0,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [attendance, personnel, project, from, to]);

  if (!project) return null;

  function applyDates() {
    setFrom(draftFrom);
    setTo(draftTo);
  }

  return (
    <CollapsibleCard
      title="Adam-Saat Analiz Tablosu"
      icon={<Clock size={18} />}
      tone="accent"
      defaultOpen={false}
      badge={
        totalHours > 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold font-mono tabular-nums">
            {formatNumber(totalHours, 0)} a-s
          </span>
        ) : null
      }
    >
      {/* TARİH FİLTRESİ */}
      <div className="px-4 py-2 border-b border-border bg-bg2/30 flex flex-wrap items-center gap-2 text-xs">
        <Calendar size={13} className="text-text3" />
        <span className="text-text3 font-semibold uppercase tracking-wider text-[9px]">Aralık:</span>
        <Input
          type="date"
          value={draftFrom}
          onChange={(e) => setDraftFrom(e.target.value)}
          className="!h-7 !w-32 !py-0 text-[11px] font-mono"
          min={project.startDate}
          max={project.plannedEnd}
        />
        <span className="text-text3">→</span>
        <Input
          type="date"
          value={draftTo}
          onChange={(e) => setDraftTo(e.target.value)}
          className="!h-7 !w-32 !py-0 text-[11px] font-mono"
          min={project.startDate}
          max={project.plannedEnd}
        />
        <Button size="sm" variant="accent" onClick={applyDates} className="!h-7 !px-2.5 !text-[11px]">
          Göster
        </Button>
      </div>

      {/* ÜST METRİK ŞERİDİ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-b border-border bg-gradient-to-br from-white to-bg2/40">
        <MetricTile
          icon={<Clock size={12} />}
          label="Toplam Adam-Saat"
          value={formatNumber(totalHours, 0)}
          unit="a-s"
          color="text-accent"
          iconBg="bg-accent/10 text-accent"
        />
        <MetricTile
          icon={<Activity size={12} />}
          label="Toplam Adam-Gün"
          value={formatNumber(totalHours / 9, 1)}
          unit="a-g"
          color="text-text"
          iconBg="bg-blue/10 text-blue"
        />
        <MetricTile
          icon={<Users size={12} />}
          label="Tekil Personel"
          value={String(totalUniquePeople)}
          unit="kişi"
          color="text-purple"
          iconBg="bg-purple/10 text-purple"
        />
        <MetricTile
          icon={<TrendingUp size={12} />}
          label="Günlük Ortalama"
          value={formatNumber(avgPerDay, 1)}
          unit={`a-s/gün · ${distinctDays}g`}
          color="text-yellow"
          iconBg="bg-yellow/10 text-yellow"
        />
      </div>

      <div className="px-4 py-3">
        {/* DİSİPLİN TABLOSU */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Activity size={12} className="text-accent" />
            <span className="text-[9px] uppercase tracking-wider font-bold text-text2">
              Disipline Göre Dağılım
            </span>
            <span className="ml-auto text-[9px] font-mono text-text3">
              {disciplineStats.length} disiplin
            </span>
          </div>

          <div className="rounded-md border border-border overflow-hidden bg-white">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-bg2/60 border-b border-border">
                  <th className="text-left py-1.5 px-2 text-[9px] uppercase tracking-wider font-bold text-text3">
                    Disiplin
                  </th>
                  <th className="text-right py-1.5 px-1.5 text-[9px] uppercase tracking-wider font-bold text-text3">
                    Adam-Saat
                  </th>
                  <th className="text-right py-1.5 px-1.5 text-[9px] uppercase tracking-wider font-bold text-text3">
                    Adam-Gün
                  </th>
                  <th className="text-right py-1.5 px-1.5 text-[9px] uppercase tracking-wider font-bold text-text3">
                    Kişi
                  </th>
                  <th className="text-left py-1.5 px-2 text-[9px] uppercase tracking-wider font-bold text-text3 w-[20%]">
                    Pay %
                  </th>
                  <th className="text-left py-1.5 px-2 text-[9px] uppercase tracking-wider font-bold text-text3 w-[30%]">
                    Firma Dağılımı
                  </th>
                </tr>
              </thead>
              <tbody>
                {disciplineStats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-text3 text-[11px]">
                      Seçili tarih aralığında puantaj kaydı yok.
                    </td>
                  </tr>
                ) : (
                  disciplineStats.map((d) => {
                    const colors = discColors(d.discipline);
                    const sharePct = totalHours > 0 ? (d.hours / totalHours) * 100 : 0;
                    const breakdown = discCompanyBreakdown[d.discipline] ?? {};
                    const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
                    const discTotal = entries.reduce((s, [, h]) => s + h, 0);
                    const topCompanies = entries.slice(0, 4).map(([c, h]) => ({
                      company: c,
                      hours: h,
                      pct: discTotal > 0 ? (h / discTotal) * 100 : 0,
                    }));
                    const restCount = Math.max(0, entries.length - topCompanies.length);

                    return (
                      <tr key={d.discipline} className="hover:bg-bg2/40 border-b border-border last:border-b-0 transition-colors">
                        <td className="py-1.5 px-2 align-middle">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", colors.dot)} />
                            <span className="font-semibold text-text">
                              {getDisciplineLabel(d.discipline)}
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-mono font-bold text-text tabular-nums whitespace-nowrap">
                          {formatNumber(d.hours, 1)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-mono text-accent font-semibold tabular-nums whitespace-nowrap">
                          {formatNumber(d.manDays, 1)}
                        </td>
                        <td className="py-1.5 px-1.5 text-right font-mono text-text2 tabular-nums">
                          {d.uniquePeople}
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 bg-bg3 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-[width] duration-500", colors.bar)}
                                style={{ width: `${sharePct}%` }}
                              />
                            </div>
                            <span className={cn("text-[10px] font-mono font-bold tabular-nums w-10 text-right", colors.text)}>
                              {sharePct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          {topCompanies.length === 0 ? (
                            <span className="text-[10px] text-text3">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-0.5">
                              {topCompanies.map((c) => (
                                <span
                                  key={c.company}
                                  title={`${c.company}: ${formatNumber(c.hours, 1)} a-s (%${c.pct.toFixed(1)})`}
                                  className="inline-flex items-center gap-1 px-1 py-0 rounded bg-bg2 border border-border text-[9px] font-medium leading-[1.3]"
                                >
                                  <span className="text-text2 truncate max-w-[4.5rem]">{c.company}</span>
                                  <span className={cn("font-mono font-bold tabular-nums shrink-0", colors.text)}>
                                    %{c.pct.toFixed(0)}
                                  </span>
                                </span>
                              ))}
                              {restCount > 0 && (
                                <span className="inline-flex items-center px-1 py-0 rounded bg-bg3 text-[9px] text-text3 font-medium">
                                  +{restCount}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {totalHours > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-accent/5 to-bg2/40 border-t-2 border-accent/30">
                    <td className="py-1.5 px-2 font-bold text-text uppercase text-[9px] tracking-wider">
                      Toplam
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono font-bold text-accent text-[13px] tabular-nums whitespace-nowrap">
                      {formatNumber(totalHours, 1)}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono font-bold text-accent tabular-nums whitespace-nowrap">
                      {formatNumber(totalHours / 9, 1)}
                    </td>
                    <td className="py-1.5 px-1.5 text-right font-mono font-bold text-text2 tabular-nums">
                      {totalUniquePeople}
                    </td>
                    <td className="py-1.5 px-2 text-[10px] font-mono text-text3">
                      100%
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* FİRMA TOPLAM TABLOSU */}
        {companyStats.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Building2 size={12} className="text-accent" />
              <span className="text-[9px] uppercase tracking-wider font-bold text-text2">
                Firmaya Göre Dağılım
              </span>
              <span className="ml-auto text-[9px] font-mono text-text3">
                {companyStats.length} firma
              </span>
            </div>
            <div className="rounded-md border border-border overflow-hidden bg-white">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-bg2/60 border-b border-border">
                    <th className="text-left py-1.5 px-2 text-[9px] uppercase tracking-wider font-bold text-text3">
                      Firma
                    </th>
                    <th className="text-right py-1.5 px-1.5 text-[9px] uppercase tracking-wider font-bold text-text3">
                      Adam-Saat
                    </th>
                    <th className="text-right py-1.5 px-1.5 text-[9px] uppercase tracking-wider font-bold text-text3">
                      Kişi
                    </th>
                    <th className="text-left py-1.5 px-2 text-[9px] uppercase tracking-wider font-bold text-text3 w-1/2">
                      Pay %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companyStats.map((c, i) => (
                    <tr key={c.company} className="hover:bg-bg2/40 border-b border-border last:border-b-0 transition-colors">
                      <td className="py-1.5 px-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] text-text3 w-4">{i + 1}.</span>
                          <span className="font-medium text-text">{c.company}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">
                        {formatNumber(c.hours, 1)}
                      </td>
                      <td className="py-1.5 px-1.5 text-right font-mono text-text2 tabular-nums">
                        {c.people}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-bg3 rounded-full overflow-hidden max-w-[300px]">
                            <div
                              className={cn(
                                "h-full rounded-full transition-[width] duration-500",
                                c.pct > 40 ? "bg-accent" : c.pct > 20 ? "bg-blue" : "bg-purple"
                              )}
                              style={{ width: `${c.pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-text3 tabular-nums w-10">
                            {c.pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}

function MetricTile({
  icon,
  label,
  value,
  unit,
  color = "text-text",
  iconBg = "bg-accent/10 text-accent",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  iconBg?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white px-2.5 py-1.5 flex items-center gap-2">
      <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md shrink-0", iconBg)}>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-[8.5px] uppercase tracking-wider font-bold text-text3 truncate">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("font-mono text-sm font-bold tabular-nums leading-tight", color)}>
            {value}
          </span>
          {unit && <span className="text-[9px] text-text3 font-mono truncate">{unit}</span>}
        </div>
      </div>
    </div>
  );
}
