"use client";

import { useMemo, useState } from "react";
import {
  HardHat,
  Truck,
  Clock,
  Calendar as CalendarIcon,
  Building2,
  ChevronDown,
  ChevronRight,
  Filter as FilterIcon,
} from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { formatMoney, formatNumber, toISODate, cn } from "@/lib/utils";
import {
  computeLaborCost,
  STANDARD_DAILY_HOURS,
  type CurrencyTotals,
} from "@/lib/calc/labor-cost";
import type { Currency } from "@/lib/utils";

const DISCIPLINE_LABEL: Record<string, string> = {
  mekanik: "Mekanik",
  elektrik: "Elektrik",
  insaat: "İnşaat",
  muhendislik: "Mühendislik",
  idari: "İdari",
  diger: "Diğer",
};

function MoneyCell({
  totals,
  compact = false,
}: {
  totals: CurrencyTotals;
  compact?: boolean;
}) {
  const nonZero = (["TRY", "USD", "EUR"] as Currency[]).filter((c) => totals[c] > 0);
  if (nonZero.length === 0) {
    return <span className="text-text3">—</span>;
  }
  if (compact && nonZero.length === 1) {
    return (
      <span className="font-mono font-bold">
        {formatMoney(totals[nonZero[0]], nonZero[0])}
      </span>
    );
  }
  return (
    <div className="flex flex-col items-end gap-0.5 leading-tight">
      {nonZero.map((c) => (
        <span key={c} className="font-mono text-[11px]">
          <span className="font-bold">{formatMoney(totals[c], c)}</span>
        </span>
      ))}
    </div>
  );
}

export default function LaborCostPage() {
  const project = useCurrentProject();
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const machines = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);
  const personnelAttendanceAll = useStore((s) => s.personnelAttendance);
  const machineAttendanceAll = useStore((s) => s.machineAttendance);

  // Sayfa proje-scope: sadece aktif projenin puantajını al
  const personnelAttendance = useMemo(
    () =>
      project ? personnelAttendanceAll.filter((a) => a.projectId === project.id) : [],
    [personnelAttendanceAll, project]
  );
  const machineAttendance = useMemo(
    () =>
      project ? machineAttendanceAll.filter((a) => a.projectId === project.id) : [],
    [machineAttendanceAll, project]
  );

  // ─── Filtreler ───
  // Default tarih: bu projenin tüm dönemi (yok ise son 90 gün)
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return toISODate(d);
  }, []);
  const defaultEnd = useMemo(() => toISODate(new Date()), []);

  const [startDate, setStartDate] = useState<string>(defaultStart);
  const [endDate, setEndDate] = useState<string>(defaultEnd);
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([]);
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);

  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // ─── Hesap ───
  const result = useMemo(
    () =>
      computeLaborCost(
        { personnel, machines, personnelAttendance, machineAttendance },
        {
          startDate,
          endDate,
          disciplines: filterDisciplines,
          companies: filterCompanies,
        }
      ),
    [
      personnel,
      machines,
      personnelAttendance,
      machineAttendance,
      startDate,
      endDate,
      filterDisciplines,
      filterCompanies,
    ]
  );

  // Bu ay (filtreyi göz ardı, sadece içinde bulunduğumuz takvim ayı — aktif proje)
  const thisMonth = useMemo(() => {
    const now = new Date();
    const ymStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const ymEnd = toISODate(last);
    return computeLaborCost(
      { personnel, machines, personnelAttendance, machineAttendance },
      { startDate: ymStart, endDate: ymEnd }
    );
  }, [personnel, machines, personnelAttendance, machineAttendance]);

  // Filter options
  const disciplineOptions = useMemo(
    () =>
      [
        "mekanik",
        "elektrik",
        "insaat",
        "muhendislik",
        "idari",
        "diger",
      ].map((d) => ({ value: d, label: DISCIPLINE_LABEL[d] })),
    []
  );
  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of personnel) if (p.company) set.add(p.company);
    for (const m of machines) if (m.company) set.add(m.company);
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b, "tr"))
      .map((c) => ({ value: c, label: c }));
  }, [personnel, machines]);

  function clearFilters() {
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setFilterDisciplines([]);
    setFilterCompanies([]);
  }

  const hasActiveFilters =
    startDate !== defaultStart ||
    endDate !== defaultEnd ||
    filterDisciplines.length > 0 ||
    filterCompanies.length > 0;

  if (!project) {
    return (
      <>
        <PageHeader title="Personel & Makina Maliyeti" icon={HardHat} />
        <Card>
          <div className="text-sm text-text2">Önce bir proje seç.</div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Personel & Makina Maliyeti"
        description="Yevmiye × çalışma saati üzerinden firma bazlı işçilik ve makine maliyeti. Mazot dahil değildir."
        icon={HardHat}
      />

      {/* KPI ŞERİDİ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={HardHat}
          label="Personel Maliyeti"
          totals={result.totals.personnelCost}
          subLabel={`${formatNumber(result.totals.personnelHours, 0)} saat · ${formatNumber(result.totals.personnelHours / STANDARD_DAILY_HOURS, 0)} adam-gün`}
          tone="purple"
        />
        <KpiCard
          icon={Truck}
          label="Makine Maliyeti"
          totals={result.totals.machineCost}
          subLabel={`${formatNumber(result.totals.machineHours, 0)} saat · ${formatNumber(result.totals.machineHours / STANDARD_DAILY_HOURS, 0)} mak-gün`}
          tone="yellow"
        />
        <KpiCard
          icon={CalendarIcon}
          label="Bu Ay Personel"
          totals={thisMonth.totals.personnelCost}
          subLabel={`${formatNumber(thisMonth.totals.personnelHours, 0)} saat`}
          tone="blue"
        />
        <KpiCard
          icon={CalendarIcon}
          label="Bu Ay Makine"
          totals={thisMonth.totals.machineCost}
          subLabel={`${formatNumber(thisMonth.totals.machineHours, 0)} saat`}
          tone="accent"
        />
      </div>

      {/* FİLTRELER */}
      <Card className="!p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <FilterIcon size={14} className="text-text3" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-text2">
            Filtreler
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-[11px] text-accent font-bold hover:underline"
            >
              Sıfırla ×
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">
              Başlangıç
            </div>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="!h-8 font-mono text-xs"
            />
          </div>
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">
              Bitiş
            </div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="!h-8 font-mono text-xs"
            />
          </div>
          <MultiSelectFilter
            label="Disiplin"
            options={disciplineOptions}
            selected={filterDisciplines}
            onChange={setFilterDisciplines}
            placeholder="Tüm disiplinler"
          />
          <MultiSelectFilter
            label="Firma"
            options={companyOptions}
            selected={filterCompanies}
            onChange={setFilterCompanies}
            placeholder="Tüm firmalar"
          />
        </div>
      </Card>

      {/* FİRMA KARTLARI */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-gradient-to-r from-purple/8 to-transparent">
          <Building2 size={16} className="text-purple" />
          <h3 className="font-display font-bold text-base text-text">
            Firma Bazında Maliyet
          </h3>
          <span className="text-[10px] text-text3 ml-2">
            ({result.byCompany.length} firma · seçili dönem)
          </span>
        </div>

        {result.byCompany.length === 0 ? (
          <div className="px-6 py-12 text-center text-text3">
            <Building2 size={32} className="mx-auto mb-2 opacity-40" />
            <div className="text-sm font-medium">Seçili filtreyle eşleşen kayıt yok.</div>
            <div className="text-xs mt-1">
              Tarih aralığını genişletmeyi veya filtreleri sıfırlamayı dene.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg2 text-text2">
                <tr className="text-[10px] uppercase tracking-wider font-bold">
                  <th className="px-3 py-2 text-left w-6"></th>
                  <th className="px-3 py-2 text-left">Firma</th>
                  <th className="px-3 py-2 text-right">Personel Saat</th>
                  <th className="px-3 py-2 text-right">Personel Maliyet</th>
                  <th className="px-3 py-2 text-right">Makine Saat</th>
                  <th className="px-3 py-2 text-right">Makine Maliyet</th>
                  <th className="px-3 py-2 text-right">TOPLAM</th>
                </tr>
              </thead>
              <tbody>
                {result.byCompany.map((row) => {
                  const isOpen = expandedCompany === row.company;
                  const total: CurrencyTotals = {
                    TRY: row.personnelCost.TRY + row.machineCost.TRY,
                    USD: row.personnelCost.USD + row.machineCost.USD,
                    EUR: row.personnelCost.EUR + row.machineCost.EUR,
                  };
                  const personnelDetails = result.personnelDetails.get(row.company) ?? [];
                  const machineDetails = result.machineDetails.get(row.company) ?? [];
                  return (
                    <>
                      <tr
                        key={row.company}
                        className={cn(
                          "border-t border-border cursor-pointer hover:bg-bg2/50 transition-colors",
                          isOpen && "bg-purple/5"
                        )}
                        onClick={() =>
                          setExpandedCompany(isOpen ? null : row.company)
                        }
                      >
                        <td className="px-3 py-2.5 text-text3">
                          {isOpen ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-text">{row.company}</div>
                          <div className="text-[10px] text-text3 mt-0.5">
                            {row.personnelCount} personel · {row.machineCount} makine
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {row.personnelHours > 0 ? (
                            <span>
                              <span className="font-bold">
                                {formatNumber(row.personnelHours, 0)}
                              </span>{" "}
                              <span className="text-text3 text-[10px]">saat</span>
                            </span>
                          ) : (
                            <span className="text-text3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <MoneyCell totals={row.personnelCost} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {row.machineHours > 0 ? (
                            <span>
                              <span className="font-bold">
                                {formatNumber(row.machineHours, 0)}
                              </span>{" "}
                              <span className="text-text3 text-[10px]">saat</span>
                            </span>
                          ) : (
                            <span className="text-text3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <MoneyCell totals={row.machineCost} />
                        </td>
                        <td className="px-3 py-2.5 text-right border-l border-border bg-bg2/40">
                          <MoneyCell totals={total} />
                        </td>
                      </tr>

                      {/* Drill-down */}
                      {isOpen && (
                        <tr className="bg-bg2/30">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {/* Personel detay */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <HardHat size={12} className="text-purple" />
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-purple">
                                    Personel
                                  </span>
                                  <span className="text-[10px] text-text3">
                                    ({personnelDetails.length})
                                  </span>
                                </div>
                                {personnelDetails.length === 0 ? (
                                  <div className="text-[11px] text-text3 italic py-2">
                                    Bu dönemde bu firmanın personel kaydı yok.
                                  </div>
                                ) : (
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="text-text3 border-b border-border">
                                        <th className="px-2 py-1 text-left font-semibold">
                                          Ad Soyad
                                        </th>
                                        <th className="px-2 py-1 text-right font-semibold">
                                          Saat
                                        </th>
                                        <th className="px-2 py-1 text-right font-semibold">
                                          Yevmiye
                                        </th>
                                        <th className="px-2 py-1 text-right font-semibold">
                                          Tutar
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {personnelDetails.map((d) => (
                                        <tr
                                          key={d.personnel.id}
                                          className="border-b border-border/50"
                                        >
                                          <td className="px-2 py-1">
                                            <div className="font-semibold">
                                              {d.personnel.firstName} {d.personnel.lastName}
                                            </div>
                                            <div className="text-[9.5px] text-text3">
                                              {DISCIPLINE_LABEL[d.personnel.discipline]}
                                              {d.personnel.jobTitle ? ` · ${d.personnel.jobTitle}` : ""}
                                            </div>
                                          </td>
                                          <td className="px-2 py-1 text-right font-mono tabular-nums">
                                            {formatNumber(d.hours, 0)}
                                            <span className="text-text3 text-[9px] ml-0.5">
                                              ({formatNumber(d.manDays, 1)}g)
                                            </span>
                                          </td>
                                          <td className="px-2 py-1 text-right font-mono tabular-nums text-text3">
                                            {d.personnel.dailyRate
                                              ? formatMoney(
                                                  d.personnel.dailyRate,
                                                  (d.personnel.dailyRateCurrency ?? "TRY") as Currency
                                                )
                                              : "—"}
                                          </td>
                                          <td className="px-2 py-1 text-right">
                                            <MoneyCell totals={d.cost} compact />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>

                              {/* Makine detay */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Truck size={12} className="text-yellow" />
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-yellow">
                                    Makine
                                  </span>
                                  <span className="text-[10px] text-text3">
                                    ({machineDetails.length})
                                  </span>
                                </div>
                                {machineDetails.length === 0 ? (
                                  <div className="text-[11px] text-text3 italic py-2">
                                    Bu dönemde bu firmanın makine kaydı yok.
                                  </div>
                                ) : (
                                  <table className="w-full text-[11px]">
                                    <thead>
                                      <tr className="text-text3 border-b border-border">
                                        <th className="px-2 py-1 text-left font-semibold">
                                          Makine
                                        </th>
                                        <th className="px-2 py-1 text-right font-semibold">
                                          Saat
                                        </th>
                                        <th className="px-2 py-1 text-right font-semibold">
                                          Yevmiye
                                        </th>
                                        <th className="px-2 py-1 text-right font-semibold">
                                          Tutar
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {machineDetails.map((d) => (
                                        <tr
                                          key={d.machine.id}
                                          className="border-b border-border/50"
                                        >
                                          <td className="px-2 py-1">
                                            <div className="font-semibold">
                                              {d.machine.name}
                                            </div>
                                            <div className="text-[9.5px] text-text3">
                                              {d.machine.machineType}
                                              {d.machine.licensePlate ? ` · ${d.machine.licensePlate}` : ""}
                                            </div>
                                          </td>
                                          <td className="px-2 py-1 text-right font-mono tabular-nums">
                                            {formatNumber(d.hours, 0)}
                                            <span className="text-text3 text-[9px] ml-0.5">
                                              ({formatNumber(d.manDays, 1)}g)
                                            </span>
                                          </td>
                                          <td className="px-2 py-1 text-right font-mono tabular-nums text-text3">
                                            {d.machine.dailyRate
                                              ? formatMoney(
                                                  d.machine.dailyRate,
                                                  (d.machine.dailyRateCurrency ?? "TRY") as Currency
                                                )
                                              : "—"}
                                          </td>
                                          <td className="px-2 py-1 text-right">
                                            <MoneyCell totals={d.cost} compact />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="text-[11px] text-text3 mt-3 px-1">
        ℹ Maliyet = (yevmiye / {STANDARD_DAILY_HOURS}) × çalışma saati. Mazot bu hesaba dahil değildir.
        Para birimleri (TRY/USD/EUR) ayrı toplanır, birbirine çevrilmez.
      </div>
    </>
  );
}

// ============================================================
// KPI Kart
// ============================================================
const TONE_BG: Record<string, string> = {
  purple: "bg-purple/10 border-purple/20",
  yellow: "bg-yellow/10 border-yellow/20",
  blue: "bg-blue/10 border-blue/20",
  accent: "bg-accent/10 border-accent/20",
};
const TONE_ICON: Record<string, string> = {
  purple: "bg-purple/20 text-purple",
  yellow: "bg-yellow/20 text-yellow",
  blue: "bg-blue/20 text-blue",
  accent: "bg-accent/20 text-accent",
};

function KpiCard({
  icon: Icon,
  label,
  totals,
  subLabel,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  totals: CurrencyTotals;
  subLabel?: string;
  tone: keyof typeof TONE_BG;
}) {
  const nonZero = (["TRY", "USD", "EUR"] as Currency[]).filter((c) => totals[c] > 0);
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        TONE_BG[tone]
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text3">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex items-center justify-center w-8 h-8 rounded-lg",
            TONE_ICON[tone]
          )}
        >
          <Icon size={14} />
        </span>
      </div>
      {nonZero.length === 0 ? (
        <div className="font-mono text-[22px] font-extrabold text-text3 leading-none">
          —
        </div>
      ) : (
        <div className="space-y-0.5">
          {nonZero.map((c) => (
            <div
              key={c}
              className="font-mono text-[18px] font-extrabold tabular-nums leading-none text-text"
            >
              {formatMoney(totals[c], c)}
            </div>
          ))}
        </div>
      )}
      {subLabel && (
        <div className="text-[10px] text-text3 mt-2 flex items-center gap-1">
          <Clock size={9} />
          {subLabel}
        </div>
      )}
    </div>
  );
}
