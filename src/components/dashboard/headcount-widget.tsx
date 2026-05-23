"use client";

import { useMemo } from "react";
import { Users, Truck } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, toISODate, addDays, cn } from "@/lib/utils";

interface DayCol {
  date: string;     // ISO
  label: string;    // 04-27
  isToday: boolean;
}

// ============================================================
// Personel Headcount Widget
// ============================================================
export function PersonnelHeadcountWidget() {
  const project = useCurrentProject();
  const attendance = useStore((s) => s.personnelAttendance);
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);

  const data = useMemo(() => {
    if (!project) return null;
    const today = project.reportDate;
    const personById = new Map(personnel.map((p) => [p.id, p]));

    // BUGÜN — Firma × Pozisyon pivot matrisi
    const pivot: Record<string, Record<string, number>> = {};
    const companiesSet = new Set<string>();
    const jobTitlesSet = new Set<string>();
    let todayCount = 0;
    for (const a of attendance) {
      if (a.projectId !== project.id || a.date !== today || !a.present) continue;
      const p = personById.get(a.personnelMasterId);
      if (!p) continue;
      const company = p.company;
      const job = p.jobTitle ?? "—";
      companiesSet.add(company);
      jobTitlesSet.add(job);
      if (!pivot[company]) pivot[company] = {};
      pivot[company][job] = (pivot[company][job] || 0) + 1;
      todayCount++;
    }
    const todayCompanies = Array.from(companiesSet).sort((a, b) => a.localeCompare(b, "tr"));
    const todayJobTitles = Array.from(jobTitlesSet).sort((a, b) => a.localeCompare(b, "tr"));
    const rowTotals: Record<string, number> = {};
    for (const c of todayCompanies) {
      rowTotals[c] = todayJobTitles.reduce((s, j) => s + (pivot[c]?.[j] || 0), 0);
    }
    const colTotals: Record<string, number> = {};
    for (const j of todayJobTitles) {
      colTotals[j] = todayCompanies.reduce((s, c) => s + (pivot[c]?.[j] || 0), 0);
    }

    // 7 GÜN — firma × tarih
    const days: DayCol[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = toISODate(addDays(new Date(today), -i));
      days.push({ date: d, label: d.slice(5), isToday: d === today });
    }

    const companies = Array.from(
      new Set(
        attendance
          .filter((a) => a.projectId === project.id && a.present && days.some((d) => d.date === a.date))
          .map((a) => personById.get(a.personnelMasterId)?.company)
          .filter((x): x is string => !!x)
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));

    const trend: Record<string, Record<string, number>> = {};
    for (const c of companies) trend[c] = {};
    for (const a of attendance) {
      if (a.projectId !== project.id || !a.present) continue;
      const dayCol = days.find((d) => d.date === a.date);
      if (!dayCol) continue;
      const p = personById.get(a.personnelMasterId);
      if (!p) continue;
      const c = p.company;
      if (!trend[c]) trend[c] = {};
      trend[c][a.date] = (trend[c][a.date] || 0) + 1;
    }

    const dailyTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const d of days) {
      let s = 0;
      for (const c of companies) s += trend[c][d.date] || 0;
      dailyTotals[d.date] = s;
      grandTotal += s;
    }

    const companyTotals: Record<string, number> = {};
    for (const c of companies) {
      companyTotals[c] = Object.values(trend[c]).reduce((s, v) => s + v, 0);
    }

    return {
      pivot,
      todayCompanies,
      todayJobTitles,
      rowTotals,
      colTotals,
      todayCount,
      days,
      companies,
      trend,
      dailyTotals,
      grandTotal,
      companyTotals,
    };
  }, [project, attendance, personnel]);

  if (!project || !data) return null;

  return (
    <CollapsibleCard
      title="Personel Headcount — Son 7 Gün"
      icon={<Users size={18} />}
      tone="purple"
      defaultOpen={false}
      badge={<Badge variant="purple">{data.todayCount} bugün</Badge>}
    >
      {/* BUGÜN — Firma × Pozisyon pivot */}
      <div className="px-4 pt-3 pb-2 border-b border-border bg-bg2/30">
        <div className="text-[9px] uppercase tracking-wider font-bold text-text3 mb-1.5">
          Bugün — Firma × Pozisyon
        </div>
        <div className="rounded-md border border-border bg-white overflow-x-auto">
          {data.todayCompanies.length === 0 ? (
            <div className="px-2 py-3 text-center text-text3 text-[11px]">
              Bugün puantaj kaydı yok.
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-bg2 border-b border-border">
                  <th className="px-2 py-1 text-left text-[9px] uppercase tracking-wider font-bold text-text3 sticky left-0 bg-bg2 z-10">
                    Firma
                  </th>
                  {data.todayJobTitles.map((j) => (
                    <th
                      key={j}
                      className="px-1.5 py-1 text-center text-[9px] uppercase tracking-wider font-bold text-text3 whitespace-nowrap"
                    >
                      {j}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right text-[9px] uppercase tracking-wider font-bold text-text3 bg-bg2">
                    Top.
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.todayCompanies.map((c) => (
                  <tr key={c} className="border-b border-border last:border-b-0 hover:bg-bg2/40">
                    <td className="px-2 py-1 text-text font-medium sticky left-0 bg-white whitespace-nowrap">{c}</td>
                    {data.todayJobTitles.map((j) => {
                      const v = data.pivot[c]?.[j] || 0;
                      return (
                        <td
                          key={j}
                          className={cn(
                            "px-1.5 py-1 text-center font-mono tabular-nums",
                            v === 0 ? "text-text3" : "text-text font-semibold"
                          )}
                        >
                          {v === 0 ? "—" : v}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-mono font-bold text-accent tabular-nums">
                      {data.rowTotals[c]}
                    </td>
                  </tr>
                ))}
                <tr className="bg-yellow/5 border-t-2 border-yellow/30 font-bold">
                  <td className="px-2 py-1 text-yellow uppercase text-[9px] tracking-wider sticky left-0 bg-yellow/5">
                    Toplam
                  </td>
                  {data.todayJobTitles.map((j) => (
                    <td key={j} className="px-1.5 py-1 text-center font-mono text-yellow tabular-nums">
                      {data.colTotals[j]}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono text-yellow tabular-nums">
                    {data.todayCount}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 7 GÜN — Firma Trendi */}
      <div className="px-4 py-3">
        <div className="text-[9px] uppercase tracking-wider font-bold text-text3 mb-1.5">
          Son 7 Gün — Firma Trendi
        </div>
        <div className="rounded-md border border-border bg-white overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-bg2 border-b border-border">
                <th className="px-2 py-1 text-left text-[9px] uppercase tracking-wider font-bold text-text3 sticky left-0 bg-bg2 z-10">
                  Firma
                </th>
                {data.days.map((d) => (
                  <th
                    key={d.date}
                    className={cn(
                      "px-1.5 py-1 text-center text-[9px] font-bold font-mono tabular-nums",
                      d.isToday ? "text-accent bg-accent/5" : "text-text3"
                    )}
                  >
                    {d.label}
                    {d.isToday && <span className="ml-0.5">📍</span>}
                  </th>
                ))}
                <th className="px-2 py-1 text-right text-[9px] uppercase tracking-wider font-bold text-text3 bg-bg2">
                  Top.
                </th>
              </tr>
            </thead>
            <tbody>
              {data.companies.length === 0 ? (
                <tr>
                  <td colSpan={data.days.length + 2} className="px-2 py-3 text-center text-text3 text-[11px]">
                    Son 7 günde firma kaydı yok.
                  </td>
                </tr>
              ) : (
                data.companies.map((c) => (
                  <tr key={c} className="border-b border-border last:border-b-0 hover:bg-bg2/40">
                    <td className="px-2 py-1 text-text font-medium sticky left-0 bg-white whitespace-nowrap">{c}</td>
                    {data.days.map((d) => {
                      const v = data.trend[c][d.date] || 0;
                      return (
                        <td
                          key={d.date}
                          className={cn(
                            "px-1.5 py-1 text-center font-mono tabular-nums",
                            v === 0 ? "text-text3" : "text-text font-semibold",
                            d.isToday && "bg-accent/5"
                          )}
                        >
                          {v === 0 ? "—" : v}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-mono font-bold text-accent tabular-nums">
                      {data.companyTotals[c]}
                    </td>
                  </tr>
                ))
              )}
              {data.companies.length > 0 && (
                <tr className="bg-bg2/40 border-t-2 border-border font-bold">
                  <td className="px-2 py-1 sticky left-0 bg-bg2/40 uppercase text-[9px] tracking-wider text-text">
                    Toplam
                  </td>
                  {data.days.map((d) => (
                    <td
                      key={d.date}
                      className={cn(
                        "px-1.5 py-1 text-center font-mono tabular-nums",
                        data.dailyTotals[d.date] === 0 ? "text-text3" : "text-text font-bold",
                        d.isToday && "bg-accent/10"
                      )}
                    >
                      {data.dailyTotals[d.date] === 0 ? "—" : data.dailyTotals[d.date]}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono font-bold text-accent tabular-nums">
                    {data.grandTotal}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CollapsibleCard>
  );
}

// ============================================================
// Makine Headcount Widget — aynı yapı, makine için
// ============================================================
export function MachineHeadcountWidget() {
  const project = useCurrentProject();
  const attendance = useStore((s) => s.machineAttendance);
  const machines = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);

  const data = useMemo(() => {
    if (!project) return null;
    const today = project.reportDate;
    const machineById = new Map(machines.map((m) => [m.id, m]));

    // BUGÜN — Firma × Tip pivot
    const pivot: Record<string, Record<string, number>> = {};
    const companiesSet = new Set<string>();
    const typesSet = new Set<string>();
    let todayCount = 0;
    for (const a of attendance) {
      if (a.projectId !== project.id || a.date !== today || !a.present) continue;
      const m = machineById.get(a.machineMasterId);
      if (!m) continue;
      const company = m.company;
      const type = m.machineType;
      companiesSet.add(company);
      typesSet.add(type);
      if (!pivot[company]) pivot[company] = {};
      pivot[company][type] = (pivot[company][type] || 0) + 1;
      todayCount++;
    }
    const todayCompanies = Array.from(companiesSet).sort((a, b) => a.localeCompare(b, "tr"));
    const todayTypes = Array.from(typesSet).sort((a, b) => a.localeCompare(b, "tr"));
    const rowTotals: Record<string, number> = {};
    for (const c of todayCompanies) {
      rowTotals[c] = todayTypes.reduce((s, t) => s + (pivot[c]?.[t] || 0), 0);
    }
    const colTotals: Record<string, number> = {};
    for (const t of todayTypes) {
      colTotals[t] = todayCompanies.reduce((s, c) => s + (pivot[c]?.[t] || 0), 0);
    }

    // 7 GÜN — firma × tarih
    const days: DayCol[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = toISODate(addDays(new Date(today), -i));
      days.push({ date: d, label: d.slice(5), isToday: d === today });
    }

    const companies = Array.from(
      new Set(
        attendance
          .filter((a) => a.projectId === project.id && a.present && days.some((d) => d.date === a.date))
          .map((a) => machineById.get(a.machineMasterId)?.company)
          .filter((x): x is string => !!x)
      )
    ).sort((a, b) => a.localeCompare(b, "tr"));

    const trend: Record<string, Record<string, number>> = {};
    for (const c of companies) trend[c] = {};
    for (const a of attendance) {
      if (a.projectId !== project.id || !a.present) continue;
      const dayCol = days.find((d) => d.date === a.date);
      if (!dayCol) continue;
      const m = machineById.get(a.machineMasterId);
      if (!m) continue;
      const c = m.company;
      if (!trend[c]) trend[c] = {};
      trend[c][a.date] = (trend[c][a.date] || 0) + 1;
    }

    const dailyTotals: Record<string, number> = {};
    let grandTotal = 0;
    for (const d of days) {
      let s = 0;
      for (const c of companies) s += trend[c][d.date] || 0;
      dailyTotals[d.date] = s;
      grandTotal += s;
    }
    const companyTotals: Record<string, number> = {};
    for (const c of companies) {
      companyTotals[c] = Object.values(trend[c]).reduce((s, v) => s + v, 0);
    }

    return {
      pivot,
      todayCompanies,
      todayTypes,
      rowTotals,
      colTotals,
      todayCount,
      days,
      companies,
      trend,
      dailyTotals,
      grandTotal,
      companyTotals,
    };
  }, [project, attendance, machines]);

  if (!project || !data) return null;

  return (
    <CollapsibleCard
      title="Makine Headcount — Son 7 Gün"
      icon={<Truck size={18} />}
      tone="yellow"
      defaultOpen={false}
      badge={<Badge variant="yellow">{data.todayCount} bugün</Badge>}
    >
      {/* BUGÜN — Firma × Tip pivot */}
      <div className="px-4 pt-3 pb-2 border-b border-border bg-bg2/30">
        <div className="text-[9px] uppercase tracking-wider font-bold text-text3 mb-1.5">
          Bugün — Firma × Makine Tipi
        </div>
        <div className="rounded-md border border-border bg-white overflow-x-auto">
          {data.todayCompanies.length === 0 ? (
            <div className="px-2 py-3 text-center text-text3 text-[11px]">
              Bugün puantaj kaydı yok.
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-bg2 border-b border-border">
                  <th className="px-2 py-1 text-left text-[9px] uppercase tracking-wider font-bold text-text3 sticky left-0 bg-bg2 z-10">
                    Firma
                  </th>
                  {data.todayTypes.map((t) => (
                    <th
                      key={t}
                      className="px-1.5 py-1 text-center text-[9px] uppercase tracking-wider font-bold text-text3 whitespace-nowrap capitalize"
                    >
                      {t}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-right text-[9px] uppercase tracking-wider font-bold text-text3 bg-bg2">
                    Top.
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.todayCompanies.map((c) => (
                  <tr key={c} className="border-b border-border last:border-b-0 hover:bg-bg2/40">
                    <td className="px-2 py-1 text-text font-medium sticky left-0 bg-white whitespace-nowrap">{c}</td>
                    {data.todayTypes.map((t) => {
                      const v = data.pivot[c]?.[t] || 0;
                      return (
                        <td
                          key={t}
                          className={cn(
                            "px-1.5 py-1 text-center font-mono tabular-nums",
                            v === 0 ? "text-text3" : "text-text font-semibold"
                          )}
                        >
                          {v === 0 ? "—" : v}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-mono font-bold text-accent tabular-nums">
                      {data.rowTotals[c]}
                    </td>
                  </tr>
                ))}
                <tr className="bg-yellow/5 border-t-2 border-yellow/30 font-bold">
                  <td className="px-2 py-1 text-yellow uppercase text-[9px] tracking-wider sticky left-0 bg-yellow/5">
                    Toplam
                  </td>
                  {data.todayTypes.map((t) => (
                    <td key={t} className="px-1.5 py-1 text-center font-mono text-yellow tabular-nums">
                      {data.colTotals[t]}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono text-yellow tabular-nums">
                    {data.todayCount}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 7 GÜN — Firma Trendi */}
      <div className="px-4 py-3">
        <div className="text-[9px] uppercase tracking-wider font-bold text-text3 mb-1.5">
          Son 7 Gün — Firma Trendi
        </div>
        <div className="rounded-md border border-border bg-white overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-bg2 border-b border-border">
                <th className="px-2 py-1 text-left text-[9px] uppercase tracking-wider font-bold text-text3 sticky left-0 bg-bg2 z-10">
                  Firma
                </th>
                {data.days.map((d) => (
                  <th
                    key={d.date}
                    className={cn(
                      "px-1.5 py-1 text-center text-[9px] font-bold font-mono tabular-nums",
                      d.isToday ? "text-accent bg-accent/5" : "text-text3"
                    )}
                  >
                    {d.label}
                    {d.isToday && <span className="ml-0.5">📍</span>}
                  </th>
                ))}
                <th className="px-2 py-1 text-right text-[9px] uppercase tracking-wider font-bold text-text3 bg-bg2">
                  Top.
                </th>
              </tr>
            </thead>
            <tbody>
              {data.companies.length === 0 ? (
                <tr>
                  <td colSpan={data.days.length + 2} className="px-2 py-3 text-center text-text3 text-[11px]">
                    Son 7 günde firma kaydı yok.
                  </td>
                </tr>
              ) : (
                data.companies.map((c) => (
                  <tr key={c} className="border-b border-border last:border-b-0 hover:bg-bg2/40">
                    <td className="px-2 py-1 text-text font-medium sticky left-0 bg-white whitespace-nowrap">{c}</td>
                    {data.days.map((d) => {
                      const v = data.trend[c][d.date] || 0;
                      return (
                        <td
                          key={d.date}
                          className={cn(
                            "px-1.5 py-1 text-center font-mono tabular-nums",
                            v === 0 ? "text-text3" : "text-text font-semibold",
                            d.isToday && "bg-accent/5"
                          )}
                        >
                          {v === 0 ? "—" : v}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-mono font-bold text-accent tabular-nums">
                      {data.companyTotals[c]}
                    </td>
                  </tr>
                ))
              )}
              {data.companies.length > 0 && (
                <tr className="bg-bg2/40 border-t-2 border-border font-bold">
                  <td className="px-2 py-1 sticky left-0 bg-bg2/40 uppercase text-[9px] tracking-wider text-text">
                    Toplam
                  </td>
                  {data.days.map((d) => (
                    <td
                      key={d.date}
                      className={cn(
                        "px-1.5 py-1 text-center font-mono tabular-nums",
                        data.dailyTotals[d.date] === 0 ? "text-text3" : "text-text font-bold",
                        d.isToday && "bg-accent/10"
                      )}
                    >
                      {data.dailyTotals[d.date] === 0 ? "—" : data.dailyTotals[d.date]}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-right font-mono font-bold text-accent tabular-nums">
                    {data.grandTotal}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </CollapsibleCard>
  );
}
