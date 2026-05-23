"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Truck,
  Activity,
  ArrowRight,
  Sun,
  MapPin,
  Calendar,
  Target,
  Zap,
  Telescope,
  ListChecks,
  ShoppingCart,
  Camera,
  AlertTriangle,
  FileText,
  Building2,
  Star,
  ChevronDown,
  Receipt,
  Clock,
} from "lucide-react";
import {
  useStore,
  useCurrentProject,
  useProjectWbs,
  useProjectPlanned,
  useProjectRealized,
} from "@/lib/store";
import { computeProgress, buildSCurve, getAllDates } from "@/lib/calc/progress";
import { computeForecast, buildForecastCurve, getConfidenceTier } from "@/lib/calc/forecast";
import {
  ProcurementKpiStrip,
  computeProcurementKpis,
} from "@/components/dashboard/procurement-kpis";
import { getPlanRange } from "@/lib/calc/predecessors";
import {
  computeSectionProgress,
  buildSectionSCurve,
  headcountByDate,
  machineCountByDate,
  manhourByDiscipline,
  getDisciplineLabel,
  billingSummary,
  procurementFollowup,
} from "@/lib/calc/sections";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { SCurveChart } from "@/components/charts/s-curve-chart";
import { MiniSCurve } from "@/components/charts/section-scurve";
import { HeadcountBar } from "@/components/charts/headcount-bar";
import { TrendLine } from "@/components/charts/trend-line";
import { BillingDetailWidget } from "@/components/dashboard/billing-detail";
import { PaymentPlanWidget } from "@/components/dashboard/payment-plan-widget";
import { ManhourDetailWidget } from "@/components/dashboard/manhour-detail";
import {
  PersonnelHeadcountWidget,
  MachineHeadcountWidget,
} from "@/components/dashboard/headcount-widget";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { downloadManagementReportPDF } from "@/lib/pdf/management-report";
import { usePanelName } from "@/lib/store";
import {
  formatDate,
  daysBetween,
  spiLevel,
  cn,
  toISODate,
  addDays,
  formatMoney,
  formatNumber,
} from "@/lib/utils";

export default function DashboardPage() {
  const project = useCurrentProject();
  const wbs = useProjectWbs(project?.id);
  const planned = useProjectPlanned(project?.id);
  const realized = useProjectRealized(project?.id);
  const personnelAttendance = useStore((s) => s.personnelAttendance);
  const machineAttendance = useStore((s) => s.machineAttendance);
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const procurement = useStore((s) => s.procurement);
  const billing = useStore((s) => s.billing);
  const lookahead = useStore((s) => s.lookahead);
  const dailyReports = useStore((s) => s.dailyReports);
  const machinesMaster = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);
  const panelName = usePanelName();
  const currentUser = useStore((s) => s.users.find((u) => u.id === s.currentUserId) ?? null);
  const toast = useToast((s) => s.push);
  const [pdfBusy, setPdfBusy] = useState(false);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Seçilmedi</CardTitle>
        <p className="text-sm text-text2">
          Aktif proje yok.{" "}
          <Link href="/projects" className="text-accent font-semibold hover:underline">
            Tüm projeler →
          </Link>
        </p>
      </Card>
    );
  }

  const stats = useMemo(() => {
    const items = wbs.map((w) => ({
      code: w.code,
      isLeaf: w.isLeaf,
      quantity: w.quantity,
      weight: w.weight,
    }));
    const leafItems = items.filter((i) => i.isLeaf);
    const { planPct, realPct, spi } = computeProgress(items, planned, realized, project.reportDate);
    const baseCurve = buildSCurve(items, planned, realized, project.reportDate);

    // EVM tahmin — SPI bazlı, raporlama tarihinden 100'e ekstrapolasyon
    const forecast = computeForecast(
      leafItems,
      planned,
      realized,
      project.reportDate,
      project.startDate,
      project.plannedEnd
    );
    // S-curve'e forecast değerlerini ekle
    const fc = buildForecastCurve(
      leafItems,
      planned,
      realized,
      project.reportDate,
      project.startDate,
      project.plannedEnd
    );
    // baseCurve ile forecast curve'ünü date'e göre birleştir
    const fcByDate = new Map(fc.points.map((p) => [p.date, p]));
    const sCurve = baseCurve.map((p) => {
      const fpoint = fcByDate.get(p.date);
      return { ...p, forecast: fpoint?.forecast ?? NaN, realPct: isNaN(p.realPct) ? null : p.realPct };
    });
    // Forecast eğrisi baseCurve sonrasına uzanıyorsa eklemeleri de al
    const baseLastDate = baseCurve.length > 0 ? baseCurve[baseCurve.length - 1].date : null;
    if (baseLastDate) {
      for (const fp of fc.points) {
        if (fp.date > baseLastDate) {
          sCurve.push({
            date: fp.date,
            planPct: fp.pv,
            realPct: null,
            forecast: fp.forecast,
          });
        }
      }
    }

    const sections = computeSectionProgress(wbs, planned, realized, project.reportDate, 1);
    const allDates = getAllDates(planned, realized);
    return { planPct, realPct, spi, sCurve, sections, allDates, forecast };
  }, [wbs, planned, realized, project.reportDate, project.startDate, project.plannedEnd]);

  const elapsed = Math.max(0, daysBetween(project.startDate, project.reportDate) + 1);
  const remaining = Math.max(0, project.durationDays - elapsed);
  const spiL = spiLevel(stats.spi);
  const confMain = getConfidenceTier(stats.forecast.ev);

  const today = project.reportDate;
  const projectId = project.id;

  // Bugün metrikleri
  const personnelTodayList = personnelAttendance.filter(
    (a) => a.projectId === projectId && a.date === today && a.present
  );
  const personnelToday = personnelTodayList.length;
  const machinesTodayList = machineAttendance.filter(
    (a) => a.projectId === projectId && a.date === today && a.present
  );
  const machinesToday = machinesTodayList.length;

  // To-date toplam
  const allPersonnelAttForProject = personnelAttendance.filter(
    (a) => a.projectId === projectId && a.present
  );
  const totalManhours = allPersonnelAttForProject.reduce((s, a) => s + (a.hours || 0), 0);
  const totalManDays = totalManhours / 9;
  const uniquePersonnel = new Set(allPersonnelAttForProject.map((a) => a.personnelMasterId)).size;

  const allMachineAttForProject = machineAttendance.filter(
    (a) => a.projectId === projectId && a.present
  );
  const totalMachineHours = allMachineAttForProject.reduce((s, a) => s + (a.hours || 0), 0);
  const uniqueMachines = new Set(allMachineAttForProject.map((a) => a.machineMasterId)).size;

  // Son 7 gün headcount
  const last7Days = headcountByDate(
    personnelAttendance,
    projectId,
    toISODate(addDays(today, -6)),
    today
  );

  // Son 30 gün trendler
  const last30Personnel = headcountByDate(
    personnelAttendance,
    projectId,
    toISODate(addDays(today, -29)),
    today
  );
  const last30Machines = machineCountByDate(
    machineAttendance,
    projectId,
    toISODate(addDays(today, -29)),
    today
  );

  // Procurement follow-up
  const procFollow = procurementFollowup(
    procurement.filter((p) => p.projectId === projectId),
    today
  );

  // 15-Gün kritik işler (eski) — sıralı
  const fifteen = toISODate(addDays(today, 15));
  const lookahead15 = lookahead
    .filter((l) => l.projectId === projectId && !l.done && l.date <= fifteen)
    .sort((a, b) => a.date.localeCompare(b.date));
  const openActions = lookahead.filter((l) => l.projectId === projectId && !l.done);
  const criticalOpen = openActions.filter((l) => l.priority === "critical").length;
  void lookahead15; // legacy kullanım

  // Kritik İşler (sadece kind=kritik_is)
  const kritikIs = openActions
    .filter((l) => (l.kind ?? "kritik_is") === "kritik_is")
    .sort((a, b) => a.date.localeCompare(b.date));
  // Claim & Tutanak konuları (kritik_is hariç)
  const claimTutanak = openActions
    .filter((l) => (l.kind ?? "kritik_is") !== "kritik_is")
    .sort((a, b) => a.date.localeCompare(b.date));

  // Son 5 gün faaliyet
  const fiveDaysAgo = toISODate(addDays(today, -4));
  const recentRealizations: { date: string; code: string; qty: number; unit: string; name: string }[] = [];
  for (const [code, byDate] of Object.entries(planned)) {
    void code;
    void byDate;
  }
  for (const [code, byDate] of Object.entries(realized)) {
    for (const [d, qty] of Object.entries(byDate)) {
      if (d >= fiveDaysAgo && d <= today) {
        const w = wbs.find((x) => x.code === code);
        if (w) recentRealizations.push({ date: d, code, qty, unit: w.unit, name: w.name });
      }
    }
  }
  recentRealizations.sort((a, b) => b.date.localeCompare(a.date));

  // Drone foto: son daily report'taki ilk foto
  const latestReport = [...dailyReports]
    .filter((d) => d.projectId === projectId)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
  const dronePhoto = latestReport?.photos?.[0];

  return (
    <>
      {/* HERO */}
      <div className="mb-6 animate-slide-up">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11px] font-bold tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-soft" />
                Aktif
              </span>
              <span className="text-xs text-text3 font-medium">
                Rapor tarihi · {formatDate(project.reportDate)}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-[28px] font-extrabold text-text leading-tight tracking-tight">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-text2">
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-text3" />
                {project.location}
              </span>
              {project.installedCapacityMw != null && (
                <span className="flex items-center gap-1.5">
                  <Sun size={14} className="text-yellow" />
                  <span className="font-mono font-semibold tabular-nums">{project.installedCapacityMw}</span> MW
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-text3" />
                {formatDate(project.startDate)} → {formatDate(project.plannedEnd)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              disabled={pdfBusy}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await downloadManagementReportPDF({
                    project,
                    wbs,
                    planned,
                    realized,
                    billing,
                    procurement,
                    lookahead,
                    personnelAttendance,
                    machineAttendance,
                    dailyReports,
                    personnel,
                    machines: machinesMaster,
                    panelName,
                    preparedBy: currentUser?.fullName,
                  });
                  toast("Yönetim özeti PDF indirildi.", "success");
                } catch (err) {
                  console.error(err);
                  toast("PDF oluşturulamadı.", "error");
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              <FileText size={14} /> {pdfBusy ? "Hazırlanıyor…" : "Yönetim Özeti PDF"}
            </Button>
            <SpiBlock spi={stats.spi} level={spiL} />
          </div>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 sm:gap-4 mb-6">
        <KpiBig
          icon={<Target size={16} />}
          iconBg="blue"
          label="Planlanan İlerleme"
          value={`${(stats.planPct * 100).toFixed(1)}%`}
          valueColor="text-planned"
          bar={stats.planPct * 100}
          barColor="var(--planned)"
          delay={1}
        />
        <KpiBig
          icon={<Zap size={16} />}
          iconBg="accent"
          label="Gerçekleşen İlerleme"
          value={`${(stats.realPct * 100).toFixed(1)}%`}
          valueColor="text-realized"
          bar={stats.realPct * 100}
          barColor="var(--realized)"
          sub={
            <span className="flex items-center gap-1">
              {stats.realPct >= stats.planPct ? (
                <><TrendingUp size={11} className="text-green" /> Plan üzerinde</>
              ) : (
                <><TrendingDown size={11} className="text-red" /> Plan altında</>
              )}
            </span>
          }
          delay={2}
        />
        <KpiBig
          icon={<Users size={16} />}
          iconBg="purple"
          label="Personel · Bugün / To-Date"
          value={`${personnelToday}`}
          valueRight={
            <div className="text-right">
              <div className="text-[10px] text-text3 font-bold">TO-DATE</div>
              <div className="font-mono text-base font-bold text-purple tabular-nums">
                {formatNumber(totalManhours, 0)}
                <span className="text-xs text-text3 ml-1">a-s</span>
              </div>
              <div className="text-[10px] text-text3 font-mono">
                {uniquePersonnel} kişi · {formatNumber(totalManDays, 0)} a-g
              </div>
            </div>
          }
          delay={3}
        />
        <KpiBig
          icon={<Truck size={16} />}
          iconBg="amber"
          label="Makine · Bugün / To-Date"
          value={`${machinesToday}`}
          valueRight={
            <div className="text-right">
              <div className="text-[10px] text-text3 font-bold">TO-DATE</div>
              <div className="font-mono text-base font-bold text-yellow tabular-nums">
                {formatNumber(totalMachineHours, 0)}
                <span className="text-xs text-text3 ml-1">m-s</span>
              </div>
              <div className="text-[10px] text-text3 font-mono">{uniqueMachines} makine</div>
            </div>
          }
          delay={4}
        />
        <KpiBig
          icon={<Calendar size={16} />}
          iconBg="red"
          label="Süre · Geçen / Kalan"
          value={`${((elapsed / project.durationDays) * 100).toFixed(0)}%`}
          valueColor="text-text"
          valueRight={
            <div className="text-right">
              <div className="text-[10px] text-text3 font-bold">GEÇEN · KALAN</div>
              <div className="font-mono text-base font-bold text-text tabular-nums">
                <span className="text-accent">{elapsed}</span>
                <span className="text-text3 mx-1">·</span>
                <span className="text-text2">{remaining}</span>
                <span className="text-xs text-text3 ml-1">g</span>
              </div>
              <div className="text-[10px] text-text3 font-mono">/ {project.durationDays}g</div>
            </div>
          }
          bar={(elapsed / project.durationDays) * 100}
          barColor="var(--red)"
          sub={
            <span className="flex items-center justify-between gap-2 text-[10px] text-text3 font-mono">
              <span>Söz: <span className="text-text font-bold">{formatDate(project.contractEnd)}</span></span>
              <span>Plan: <span className="text-text font-bold">{formatDate(project.plannedEnd)}</span></span>
            </span>
          }
          delay={5}
        />
        {(() => {
          const hide = confMain.hideValues || stats.forecast.forecastEnd == null;
          const tierLabel =
            confMain.tier === "very-low" || confMain.tier === "low" ? `⚠ ${confMain.label}` : confMain.label;
          return (
            <>
              <KpiBig
                icon={<Target size={16} />}
                iconBg="amber"
                label="Tahmini Bitiş (SPI)"
                value={hide ? "—" : formatDate(stats.forecast.forecastEnd!)}
                valueColor={
                  hide
                    ? "text-text3"
                    : stats.forecast.deltaDays <= 0
                      ? "text-green"
                      : stats.forecast.deltaDays <= 7
                        ? "text-yellow"
                        : "text-red"
                }
                sub={
                  hide ? (
                    <span className="text-[10px] text-text3">
                      {tierLabel} (EV %{(stats.forecast.ev * 100).toFixed(1)})
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-text3 font-mono">
                      Plan: <span className="text-text font-bold">{formatDate(project.plannedEnd)}</span>
                      {stats.forecast.spi != null && (
                        <>
                          <span className="text-text3 mx-1">·</span>
                          SPI <span className="text-text font-bold">{stats.forecast.spi.toFixed(2)}</span>
                        </>
                      )}
                    </span>
                  )
                }
                delay={6}
              />
              <KpiBig
                icon={<TrendingDown size={16} />}
                iconBg={
                  hide
                    ? "blue"
                    : stats.forecast.deltaDays <= 0
                      ? "green"
                      : stats.forecast.deltaDays <= 7
                        ? "amber"
                        : "red"
                }
                label="Sapma (gün)"
                value={
                  hide
                    ? "—"
                    : `${stats.forecast.deltaDays >= 0 ? "+" : ""}${stats.forecast.deltaDays} g`
                }
                valueColor={
                  hide
                    ? "text-text3"
                    : stats.forecast.deltaDays <= 0
                      ? "text-green"
                      : stats.forecast.deltaDays <= 7
                        ? "text-yellow"
                        : "text-red"
                }
                sub={
                  <span className="text-[10px] text-text3">
                    {hide
                      ? tierLabel
                      : stats.forecast.deltaDays <= 0
                        ? "Zamanında / erken"
                        : "Plana göre geç bitecek"}
                  </span>
                }
                delay={7}
              />
            </>
          );
        })()}
      </div>

      {criticalOpen > 0 && (
        <Alert variant="error" className="mb-4">
          <strong>{criticalOpen}</strong> açık kritik iş var.{" "}
          <Link href="/lookahead" className="underline ml-1 font-semibold">
            15-Gün Kritik İşler →
          </Link>
        </Alert>
      )}

      {/* MASTER S-CURVE */}
      <Card className="mb-6 animate-slide-up">
        <div className="flex items-center justify-between mb-2">
          <CardTitle>
            <Activity size={14} className="text-accent" />
            Genel S-Curve · Plan vs Gerçekleşme
          </CardTitle>
          <Link
            href="/plan-status"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
          >
            Detay <ArrowRight size={12} />
          </Link>
        </div>
        {stats.sCurve.length > 0 ? (
          <SCurveChart
            data={confMain.showForecast ? stats.sCurve : stats.sCurve.map((p) => ({ ...p, forecast: NaN }))}
            reportDate={project.reportDate}
            plannedEnd={project.plannedEnd}
            forecastEnd={confMain.showForecast ? stats.forecast.forecastEnd : null}
            forecastOpacity={confMain.forecastOpacity}
          />
        ) : (
          <EmptyChart label="Henüz planlama / gerçekleşme verisi yok" href="/planning" linkLabel="Planlamaya geç" />
        )}
      </Card>

      {/* SECTION S-CURVES */}
      {stats.sections.length > 0 && (
        <div className="mb-6 animate-slide-up">
          <CollapsibleCard
            title="Bölüm S-Curve · L1"
            icon={<Activity size={18} />}
            tone="blue"
            defaultOpen={false}
            badge={<Badge variant="gray">{stats.sections.length}</Badge>}
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.sections.map((sec) => {
                const sCurve = buildSectionSCurve(
                  wbs,
                  planned,
                  realized,
                  sec.code,
                  project.reportDate,
                  stats.allDates
                );
                const spiL = spiLevel(sec.spi);

                // Section'a özgü tahmin: section'ın kendi leaf'leri + kendi tarih aralığı
                const sectionLeaves = wbs.filter(
                  (w) => w.isLeaf && !w.deletedAt && w.code.startsWith(sec.code + ".")
                );
                const leafItems = sectionLeaves.map((l) => ({
                  code: l.code,
                  isLeaf: true,
                  quantity: l.quantity,
                  weight: l.weight,
                }));
                // Section'ın planlanan başlangıç + bitiş tarihleri (leaf'lerden agregat)
                let secStart: string | undefined;
                let secEnd: string | undefined;
                for (const l of sectionLeaves) {
                  const r = getPlanRange(planned[l.code]);
                  if (r.start && (!secStart || r.start < secStart)) secStart = r.start;
                  if (r.end && (!secEnd || r.end > secEnd)) secEnd = r.end;
                }
                const secFc = secStart && secEnd
                  ? computeForecast(
                      leafItems,
                      planned,
                      realized,
                      project.reportDate,
                      secStart,
                      secEnd
                    )
                  : null;
                const secFcCurve = secStart && secEnd
                  ? buildForecastCurve(
                      leafItems,
                      planned,
                      realized,
                      project.reportDate,
                      secStart,
                      secEnd
                    )
                  : null;
                // sCurve'e forecast değerlerini ekle (tarihe göre eşle)
                const fcByDate = new Map(
                  secFcCurve ? secFcCurve.points.map((p) => [p.date, p.forecast]) : []
                );
                const enrichedCurve = sCurve.map((p) => ({
                  ...p,
                  forecast: fcByDate.get(p.date) ?? NaN,
                }));
                // Forecast curve sCurve dışına uzanıyorsa devamını ekle
                if (secFcCurve && sCurve.length > 0) {
                  const lastDate = sCurve[sCurve.length - 1].date;
                  for (const fp of secFcCurve.points) {
                    if (fp.date > lastDate) {
                      enrichedCurve.push({
                        date: fp.date,
                        planPct: fp.pv,
                        realPct: NaN,
                        forecast: fp.forecast,
                      });
                    }
                  }
                }

                const delta = secFc?.deltaDays ?? 0;
                const hasForecast = secFc?.forecastEnd != null;
                const secConf = getConfidenceTier(sec.realPct);
                // EV %5 altıysa veya forecast yoksa kademe yok kabul et
                const showFc = secConf.showForecast && hasForecast;

                // Enriched curve'de forecast değerlerini gizle (tier == none ise)
                const renderCurve = secConf.showForecast
                  ? enrichedCurve
                  : enrichedCurve.map((p) => ({ ...p, forecast: NaN }));

                return (
                  <div key={sec.code} className="rounded-xl border border-border p-4 bg-bg2/40">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="text-sm font-bold text-text truncate">
                        <span className="font-mono text-text3 mr-1.5 text-xs">{sec.code}</span>
                        {sec.name}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {sec.spi != null && (
                          <Badge variant={spiL === "good" ? "green" : spiL === "warn" ? "yellow" : "red"}>
                            SPI {sec.spi.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-3 mb-2 text-xs">
                      <span className="text-planned font-mono font-semibold">
                        Plan {(sec.planPct * 100).toFixed(0)}%
                      </span>
                      <span className="text-realized font-mono font-semibold">
                        Gerçek {(sec.realPct * 100).toFixed(0)}%
                      </span>
                      <span className="text-text3 ml-auto">{sec.leafCount} kalem</span>
                    </div>
                    {sCurve.length > 0 ? (
                      <MiniSCurve
                        data={renderCurve}
                        reportDate={project.reportDate}
                        plannedEnd={secEnd ?? null}
                        forecastEnd={showFc ? secFc?.forecastEnd ?? null : null}
                        forecastOpacity={secConf.forecastOpacity}
                        height={160}
                      />
                    ) : (
                      <div className="h-[160px] flex items-center justify-center text-text3 text-[10px]">
                        veri yok
                      </div>
                    )}
                    {/* Plana göre erken/geç bitiş notu + güvenilirlik */}
                    <div className="mt-2 text-[11px] font-semibold flex items-center gap-2 flex-wrap">
                      {!showFc ? (
                        <span className="text-text3">
                          Tahmin için yeterli veri yok (EV %{(sec.realPct * 100).toFixed(1)})
                        </span>
                      ) : (
                        <>
                          {delta === 0 && (
                            <span className="text-green">✓ Plana göre zamanında bitecek</span>
                          )}
                          {delta < 0 && (
                            <span className="text-blue">
                              ◂ Plana göre <strong>{Math.abs(delta)} gün erken</strong> bitecek
                            </span>
                          )}
                          {delta > 0 && delta <= 7 && (
                            <span className="text-yellow">
                              ⚠ Plana göre <strong>+{delta} gün geç</strong> bitecek
                            </span>
                          )}
                          {delta > 7 && (
                            <span className="text-red">
                              ⚠ Plana göre <strong>+{delta} gün geç</strong> bitecek
                            </span>
                          )}
                          {/* Güvenilirlik etiketi */}
                          {(secConf.tier === "very-low" || secConf.tier === "low") && (
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ml-auto",
                                secConf.badgeColor === "red" && "bg-red/15 text-red",
                                secConf.badgeColor === "yellow" && "bg-yellow/20 text-yellow"
                              )}
                              title={secConf.description}
                            >
                              ⚠ {secConf.label}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleCard>
        </div>
      )}

      {/* HEADCOUNT + TRENDS + İMALAT ÖZETİ (4-col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 animate-slide-up items-start">
        <CollapsibleCard
          title="Personel Headcount · Son 7 Gün"
          icon={<Users size={18} />}
          tone="purple"
          defaultOpen={false}
        >
          <div className="p-3">
            {last7Days.some((d) => d.count > 0) ? (
              <HeadcountBar data={last7Days} />
            ) : (
              <EmptyChart label="Son 7 gün puantaj kaydı yok" href="/personnel" linkLabel="Puantaja git" small />
            )}
          </div>
        </CollapsibleCard>
        <CollapsibleCard
          title="Personel Günlük Trend · 30 Gün"
          icon={<TrendingUp size={18} />}
          tone="green"
          defaultOpen={false}
        >
          <div className="p-3">
            {last30Personnel.some((d) => d.count > 0) ? (
              <TrendLine data={last30Personnel} color="#10b981" fillId="trendGreen" label="Personel" />
            ) : (
              <EmptyChart label="Trend için yeterli veri yok" href="/personnel" linkLabel="Puantaja git" small />
            )}
          </div>
        </CollapsibleCard>
        <CollapsibleCard
          title="Makine Günlük Trend · 30 Gün"
          icon={<Truck size={18} />}
          tone="yellow"
          defaultOpen={false}
        >
          <div className="p-3">
            {last30Machines.some((d) => d.count > 0) ? (
              <TrendLine data={last30Machines} color="#f59e0b" fillId="trendAmber" label="Makine" />
            ) : (
              <EmptyChart label="Trend için yeterli veri yok" href="/machines" linkLabel="Puantaja git" small />
            )}
          </div>
        </CollapsibleCard>
        <CollapsibleCard
          title="İmalat Bölüm Özeti"
          icon={<ListChecks size={18} />}
          tone="accent"
          defaultOpen={false}
          badge={<Badge variant="gray">{stats.sections.length}</Badge>}
        >
          <div className="max-h-[260px] overflow-y-auto">
            {stats.sections.map((sec) => {
              const spiL = spiLevel(sec.spi);
              const planP = sec.planPct * 100;
              const realP = sec.realPct * 100;
              return (
                <div
                  key={sec.code}
                  className="px-3 py-2 border-b border-border last:border-b-0 hover:bg-bg2/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="font-mono text-[10px] text-text3 shrink-0">{sec.code}</span>
                    <span className="text-[11px] font-semibold text-text truncate flex-1">{sec.name}</span>
                    {sec.spi != null && (
                      <span
                        className={cn(
                          "font-mono text-[10px] font-bold tabular-nums shrink-0",
                          spiL === "good" ? "text-green" : spiL === "warn" ? "text-yellow" : "text-red"
                        )}
                      >
                        {sec.spi.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="relative h-1.5 bg-bg3 rounded-full overflow-hidden mb-0.5">
                    <div
                      className="absolute h-full bg-planned/40 rounded-full"
                      style={{ width: `${planP}%` }}
                    />
                    <div
                      className="absolute h-full bg-realized rounded-full"
                      style={{ width: `${realP}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono tabular-nums">
                    <span className="text-planned">P {planP.toFixed(0)}%</span>
                    <span className="text-realized">G {realP.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
            {stats.sections.length === 0 && (
              <div className="text-center text-text3 text-sm py-6">Bölüm verisi yok.</div>
            )}
          </div>
        </CollapsibleCard>
      </div>

      {/* HAKEDİŞ PLANI — gecikme varsa üst sırada */}
      <div className="mb-6 animate-slide-up">
        <PaymentPlanWidget />
      </div>

      {/* FATURALANDIRMA */}
      <div className="mb-6 animate-slide-up">
        <BillingDetailWidget />
      </div>

      {/* PROCUREMENT — tam genişlik */}
      <div className="mb-4 animate-slide-up">
        <CollapsibleCard
          title="Procurement Follow Up"
          icon={<ShoppingCart size={18} />}
          tone="blue"
          defaultOpen={false}
          link={{ href: "/procurement", label: "Detay →" }}
          badge={<Badge variant="gray">{procFollow.length}</Badge>}
        >
          {/* KPI Strip — Gecikme (Teslim) · Gecikme (PO) · Teslim Edilen · Toplam Bedel */}
          <div className="px-3 pt-3">
            {(() => {
              const projItems = procurement.filter((p) => p.projectId === projectId);
              return (
                <ProcurementKpiStrip
                  kpis={computeProcurementKpis(projItems)}
                  items={projItems}
                  compact
                />
              );
            })()}
          </div>
          {procFollow.length === 0 ? (
            <p className="text-xs text-text3 py-6 text-center">Yaklaşan veya kritik malzeme yok.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-bg2 border-b border-border">
                    <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider font-bold text-text3 w-6"></th>
                    <th className="px-3 py-2 text-left text-[9px] uppercase tracking-wider font-bold text-text3">Malzeme</th>
                    <th className="px-2 py-2 text-center text-[9px] uppercase tracking-wider font-bold text-text3">PO</th>
                    <th className="px-2 py-2 text-center text-[9px] uppercase tracking-wider font-bold text-text3">EXW</th>
                    <th className="px-2 py-2 text-center text-[9px] uppercase tracking-wider font-bold text-text3">Teslim</th>
                  </tr>
                </thead>
                <tbody>
                  {procFollow.slice(0, 12).map((p) => (
                    <tr
                      key={p.item.id}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-bg2/40",
                        p.isCritical && "bg-yellow/3"
                      )}
                    >
                      <td className="px-3 py-2 align-middle">
                        {p.isCritical && (
                          <span title="Kritik">
                            <Star size={11} className="fill-yellow text-yellow" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="font-semibold text-text truncate max-w-[14rem]">{p.item.material}</div>
                        <div className="text-[10px] text-text3 truncate">{p.item.supplier ?? "—"}</div>
                      </td>
                      {p.milestones.map((m) => {
                        const colorClass = m.isCompleted
                          ? "text-green"
                          : m.isOverdue
                          ? "text-red font-bold"
                          : m.isUpcoming
                          ? "text-yellow"
                          : "text-text3";
                        const display = m.isCompleted && m.actualDate ? `✓ ${formatDate(m.actualDate).slice(0, 5)}` : m.plannedDate ? formatDate(m.plannedDate).slice(0, 5) : "—";
                        const sub = !m.isCompleted && m.daysFromToday != null
                          ? (m.daysFromToday < 0 ? `${-m.daysFromToday}g gec` : `${m.daysFromToday}g`)
                          : null;
                        return (
                          <td
                            key={m.kind}
                            className="px-2 py-2 text-center align-middle"
                            title={m.plannedDate ? `Plan: ${formatDate(m.plannedDate)}${m.actualDate ? ` · Gerç: ${formatDate(m.actualDate)}` : ""}` : "—"}
                          >
                            <div className={cn("font-mono text-[10px] tabular-nums whitespace-nowrap", colorClass)}>
                              {display}
                            </div>
                            {sub && (
                              <div className={cn("text-[9px] font-mono", colorClass, "opacity-80")}>{sub}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleCard>
      </div>

      {/* KRİTİK İŞLER + CLAIM&TUTANAK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 animate-slide-up">
        <CollapsibleCard
          title="Kritik İşler"
          icon={<Telescope size={18} />}
          tone="red"
          defaultOpen={false}
          link={{ href: "/lookahead", label: "Detay →" }}
          badge={<Badge variant="red">{kritikIs.length}</Badge>}
        >
          {kritikIs.length === 0 ? (
            <p className="text-xs text-text3 py-6 text-center">Açık kritik iş yok.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {kritikIs.slice(0, 14).map((l) => {
                    const days = daysBetween(today, l.date);
                    const overdue = days < 0;
                    return (
                      <tr key={l.id} className={cn("border-b border-border last:border-b-0 hover:bg-bg2/40", overdue && "bg-red/3")}>
                        <td className="px-3 py-2 align-middle">
                          <div className="font-medium text-text leading-tight truncate max-w-[18rem]">{l.task}</div>
                          {l.owner && <div className="text-[10px] text-text3 leading-tight">{l.owner}</div>}
                        </td>
                        <td className="px-2 py-2 align-middle text-right whitespace-nowrap">
                          <div className={cn("text-[10px] font-mono font-bold tabular-nums", overdue ? "text-red" : "text-text3")}>
                            {formatDate(l.date).slice(0, 5)}
                          </div>
                          <Badge
                            variant={
                              l.priority === "critical" ? "red" : l.priority === "high" ? "yellow" : l.priority === "medium" ? "blue" : "gray"
                            }
                          >
                            {overdue ? `+${-days}g` : `${days}g`}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          title="Claim & Tutanak Konuları"
          icon={<FileText size={18} />}
          tone="purple"
          defaultOpen={false}
          link={{ href: "/lookahead", label: "Detay →" }}
          badge={<Badge variant="purple">{claimTutanak.length}</Badge>}
        >
          {claimTutanak.length === 0 ? (
            <p className="text-xs text-text3 py-6 text-center">Aktif claim/tutanak yok.</p>
          ) : (
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {claimTutanak.slice(0, 14).map((l) => {
                    const days = daysBetween(today, l.date);
                    const overdue = days < 0;
                    const kind = l.kind ?? "tutanak";
                    return (
                      <tr key={l.id} className={cn("border-b border-border last:border-b-0 hover:bg-bg2/40", overdue && "bg-red/3")}>
                        <td className="px-2 py-1.5 align-middle w-[5.5rem]">
                          <KindPill kind={kind} />
                        </td>
                        <td className="px-2 py-1.5 align-middle">
                          <div className="font-medium text-text leading-tight truncate max-w-[14rem]">{l.task}</div>
                          {l.owner && <div className="text-[10px] text-text3 leading-tight">{l.owner}</div>}
                        </td>
                        <td className="px-2 py-1.5 align-middle text-right whitespace-nowrap">
                          <div className={cn("text-[10px] font-mono font-bold tabular-nums", overdue ? "text-red" : "text-text3")}>
                            {formatDate(l.date).slice(0, 5)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleCard>
      </div>

      {/* ADAM-SAAT */}
      <div className="mb-6 animate-slide-up">
        <ManhourDetailWidget />
      </div>

      {/* HEADCOUNT WIDGETS — tam genişlik, stacked */}
      <div className="space-y-4 mb-6 animate-slide-up">
        <PersonnelHeadcountWidget />
        <MachineHeadcountWidget />
      </div>

      {/* SON 5 GÜN FAALİYET ÖZETİ */}
      <div className="mb-6 animate-slide-up">
        <CollapsibleCard
          title="Son 5 Günün Faaliyet Özeti"
          icon={<FileText size={18} />}
          tone="accent"
          defaultOpen={false}
          link={{ href: "/realization", label: "Tümü →" }}
          badge={<Badge variant="gray">{recentRealizations.length}</Badge>}
        >
          {recentRealizations.length === 0 ? (
            <p className="text-sm text-text3 py-6 text-center">Son 5 günde gerçekleşme kaydı yok.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto p-3 space-y-1.5">
              {recentRealizations.slice(0, 12).map((r, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2 hover:bg-bg2 rounded text-sm">
                  <span className="text-[10px] font-mono text-text3 w-14 shrink-0">{formatDate(r.date).slice(0, 5)}</span>
                  <span className="font-mono text-xs text-text3 shrink-0">{r.code}</span>
                  <span className="truncate flex-1">{r.name}</span>
                  <span className="font-mono font-semibold text-realized text-xs whitespace-nowrap tabular-nums">
                    +{formatNumber(r.qty, 1)} {r.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CollapsibleCard>
      </div>

      {/* DRONE FOTO + PROJE KÜNYESİ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6 animate-slide-up">
        <div className="lg:col-span-2">
          <CollapsibleCard
            title={
              <>
                Saha Fotoğrafı
                {latestReport && (
                  <span className="text-text3 font-normal tracking-normal text-xs ml-2">
                    · {formatDate(latestReport.reportDate)}
                  </span>
                )}
              </>
            }
            icon={<Camera size={18} />}
            tone="blue"
            defaultOpen={false}
            link={{ href: "/daily-report", label: "Günlük rapor →" }}
          >
            {dronePhoto ? (
              <div className="relative aspect-video bg-bg2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dronePhoto.url}
                  alt={dronePhoto.caption || "Saha fotoğrafı"}
                  className="w-full h-full object-cover"
                />
                {latestReport?.summary && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/85 to-transparent p-4">
                    <p className="text-sm text-white font-medium line-clamp-2">{latestReport.summary}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center text-text3 gap-2 bg-bg-soft">
                <Camera size={36} className="opacity-50" />
                <span className="text-sm">Henüz fotoğraf yok</span>
                <Link href="/daily-report" className="text-xs text-accent font-semibold hover:underline">
                  Günlük rapor ekle →
                </Link>
              </div>
            )}
          </CollapsibleCard>
        </div>

        <CollapsibleCard
          title="Proje Künyesi"
          icon={<Building2 size={18} />}
          tone="gray"
          defaultOpen={false}
        >
          <div className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <InfoItem label="Başlangıç" value={formatDate(project.startDate)} />
              <InfoItem label="Bitiş" value={formatDate(project.plannedEnd)} />
              <InfoItem label="Sözleşme" value={formatDate(project.contractEnd)} />
              <InfoItem label="Süre" value={`${project.durationDays}g`} />
              <InfoItem label="Konum" value={project.location} />
              <InfoItem
                label="Kurulu Güç"
                value={project.installedCapacityMw ? `${project.installedCapacityMw} MW` : "—"}
              />
              <InfoItem
                label="Bütçe"
                value={project.totalBudget ? formatMoney(project.totalBudget, project.budgetCurrency, 0) : "—"}
              />
              <InfoItem label="Durum" value={STATUS_LABEL_DASH[project.status] ?? project.status} />
            </dl>
          </div>
        </CollapsibleCard>
      </div>
    </>
  );
}

function SpiBlock({ spi, level }: { spi: number | null; level: ReturnType<typeof spiLevel> }) {
  return (
    <div
      className={cn(
        "px-5 py-3 rounded-xl border bg-white shadow-soft text-center",
        level === "good" && "border-green/30",
        level === "warn" && "border-yellow/30",
        level === "bad" && "border-red/30",
        !level && "border-border"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-bold text-text3">SPI</div>
      <div
        className={cn(
          "font-mono text-2xl font-bold leading-tight mt-0.5 tabular-nums",
          level === "good" && "text-green",
          level === "warn" && "text-yellow",
          level === "bad" && "text-red",
          !level && "text-text3"
        )}
      >
        {spi == null ? "—" : spi.toFixed(3)}
      </div>
    </div>
  );
}

const ICON_BG: Record<string, string> = {
  blue:   "bg-blue/10 text-blue",
  accent: "bg-accent/10 text-accent",
  purple: "bg-purple/10 text-purple",
  amber:  "bg-yellow/10 text-yellow",
  red:    "bg-red/10 text-red",
};

function KpiBig({
  icon,
  iconBg = "accent",
  label,
  value,
  valueColor,
  valueRight,
  bar,
  barColor,
  sub,
  delay = 1,
}: {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  valueRight?: React.ReactNode;
  bar?: number;
  barColor?: string;
  sub?: React.ReactNode;
  delay?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
}) {
  const delayCls =
    delay === 1
      ? "animate-slide-up-delay-1"
      : delay === 2
      ? "animate-slide-up-delay-2"
      : delay === 3
      ? "animate-slide-up-delay-3"
      : "animate-slide-up-delay-4";
  return (
    <div
      className={cn(
        "rounded-2xl bg-white border border-border p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-medium",
        delayCls
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text3">{label}</div>
        <span
          className={cn(
            "inline-flex items-center justify-center w-9 h-9 rounded-xl",
            ICON_BG[iconBg]
          )}
        >
          {icon}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className={cn("font-mono text-[28px] font-bold leading-none tracking-tight tabular-nums", valueColor)}>
          {value}
        </div>
        {valueRight}
      </div>
      {sub && <div className="text-xs text-text2 mt-2 font-medium">{sub}</div>}
      {typeof bar === "number" && (
        <div className="h-1 bg-bg3 rounded-full mt-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: barColor || "var(--accent)" }}
          />
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-0.5">{label}</dt>
      <dd className="text-text font-semibold text-sm">{value}</dd>
    </div>
  );
}

const STATUS_LABEL_DASH: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  completed: "Tamamlandı",
  archived: "Arşivlendi",
};

const KIND_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  kritik_is: { label: "Kritik İş", bg: "bg-red/10", text: "text-red" },
  claim:     { label: "Claim",     bg: "bg-purple/10", text: "text-purple" },
  tutanak:   { label: "Tutanak",   bg: "bg-blue/10", text: "text-blue" },
  yazisma:   { label: "Yazışma",   bg: "bg-accent/10", text: "text-accent" },
  ihbar:     { label: "İhbar",     bg: "bg-yellow/10", text: "text-yellow" },
};
function KindPill({ kind }: { kind: string }) {
  const s = KIND_STYLES[kind] || KIND_STYLES.kritik_is;
  return (
    <span className={cn("inline-block text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded whitespace-nowrap", s.bg, s.text)}>
      {s.label}
    </span>
  );
}

function EmptyChart({
  label,
  href,
  linkLabel,
  small = false,
}: {
  label: string;
  href?: string;
  linkLabel?: string;
  small?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-text3 text-sm gap-2 border-2 border-dashed border-border rounded-xl bg-bg-soft",
        small ? "h-32" : "h-48"
      )}
    >
      <Activity size={24} className="text-text3" />
      <span>{label}</span>
      {href && linkLabel && (
        <Link href={href} className="text-accent text-xs font-semibold hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
