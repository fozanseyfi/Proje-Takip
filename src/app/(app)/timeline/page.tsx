"use client";

/**
 * Timeline & Gantt — proje BASELINE planının kapsamlı görünümü.
 *
 * Veri kaynağı:
 *   - Planlı: `baseline[projectId]` (PMP onaylı orijinal plan)
 *             Baseline yoksa fallback olarak `planned` kullanılır.
 *   - Gerçekleşen: `realized[projectId]`
 *
 * Kapsam:
 *   - Sadece BASELINE'DA MİKTARI GİRİLEN kalemler tablo'da gösterilir.
 *     (Süre-only kalemler ve milestone'lar tarihsizse gösterilmez.)
 *   - Realized: yalnız o kalemin baseline'da kaydı varsa altında ikinci bar olarak.
 *
 * Filtreler:
 *   - L1 (Ana Başlıklar) · L2 (Alt Başlıklar) · L3 (İş Kalemleri) chip toggle'ları
 *   - Kapatılan seviyenin parent rollup'ı da hesaba katılmaz.
 *
 * Görselleştirme: BigGantt — read-only, Planlama dokunulmaz.
 */

import { useMemo, useState } from "react";
import {
  BarChart3,
  FileDown,
  Info,
  Layers3,
  Layers2,
  FileText,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import {
  useCurrentProject,
  useProjectWbs,
  useProjectBaseline,
  useProjectPlanned,
  useProjectRealized,
  useProjectHasBaseline,
  useProjectBaselineSetAt,
} from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate, toISODate } from "@/lib/utils";
import { computeSchedule, getPlanRange, type LeafSchedule } from "@/lib/calc/predecessors";
import { BigGantt, type TimelineRow } from "@/components/timeline/big-gantt";
import { WhatIfDialog } from "@/components/planning/whatif-dialog";
import { loadingOverlay } from "@/lib/ui-loading";

export default function TimelinePage() {
  const project = useCurrentProject();
  const wbs = useProjectWbs(project?.id);
  const baseline = useProjectBaseline(project?.id);
  const planned = useProjectPlanned(project?.id);
  const realized = useProjectRealized(project?.id);
  const hasBaseline = useProjectHasBaseline(project?.id);
  const baselineSetAt = useProjectBaselineSetAt(project?.id);
  const toast = useToast((s) => s.push);

  // ─── Filter state ───
  const [showL1, setShowL1] = useState(true);
  const [showL2, setShowL2] = useState(true);
  const [showL3, setShowL3] = useState(true);
  // Planlanan / Gerçekleşen seçenekleri — her ikisi de seçilebilir
  const [showPlan, setShowPlan] = useState(true);
  const [showRealized, setShowRealized] = useState(true);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ─── CPM hesabı — baseline üzerinde ───
  const { schedules, criticalCodes, cycleNodes } = useMemo(() => {
    if (!project) {
      return {
        schedules: new Map<string, LeafSchedule>(),
        criticalCodes: new Set<string>(),
        cycleNodes: new Set<string>(),
      };
    }
    const r = computeSchedule(wbs, baseline, project.startDate, project.plannedEnd);
    return {
      schedules: r.schedules,
      criticalCodes: r.critical,
      cycleNodes: r.cycleNodes,
    };
  }, [wbs, baseline, project]);

  // ─── Rows: hierarchical (L1/L2/L3) + planlı/realized range + filtreli ───
  const rows = useMemo<TimelineRow[]>(() => {
    if (!project) return [];

    // 1. Leaf'lerin planlı range'i — SADECE baseline'da miktar girilmiş olanlar
    const leafPlan = new Map<string, { start: string; end: string }>();
    const leafReal = new Map<string, { start: string; end: string }>();

    for (const w of wbs) {
      if (!w.isLeaf || w.deletedAt) continue;

      // Milestone — tarih girilmişse al, yoksa gösterme
      if (w.activityType === "milestone") {
        if (w.milestoneDate) {
          leafPlan.set(w.code, { start: w.milestoneDate, end: w.milestoneDate });
        }
        // Milestone gerçekleşmesi varsa onu da ekle
        if (w.milestoneCompletedAt) {
          leafReal.set(w.code, { start: w.milestoneCompletedAt, end: w.milestoneCompletedAt });
        }
        continue;
      }

      // Work — baseline'da miktar girilmişse al
      const planR = getPlanRange(baseline[w.code]);
      if (planR.start && planR.end) {
        leafPlan.set(w.code, { start: planR.start, end: planR.end });
      }

      // Realized
      const realR = getPlanRange(realized[w.code]);
      if (realR.start && realR.end) {
        leafReal.set(w.code, { start: realR.start, end: realR.end });
      }
    }

    // 2. Tüm WBS'i hiyerarşik sırala ve filtreyi uygula
    const sortedAll = wbs
      .filter((w) => !w.deletedAt && w.level >= 1 && w.level <= 3)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    // Filter map
    const levelEnabled: Record<number, boolean> = { 1: showL1, 2: showL2, 3: showL3 };

    // 3. Parent satırlar için: descendant leaf'lerin (filtrelenmemiş) min/max'i.
    //    Parent satırın kendisi de filtreden geçiyorsa eklenir.
    function descendantLeafCodes(parentCode: string): string[] {
      const out: string[] = [];
      for (const w of wbs) {
        if (w.deletedAt) continue;
        if (!w.isLeaf) continue;
        if (w.code === parentCode) continue;
        if (w.code.startsWith(parentCode + ".")) out.push(w.code);
      }
      return out;
    }

    const out: TimelineRow[] = [];
    for (const w of sortedAll) {
      // Level filtresi
      if (!levelEnabled[w.level]) continue;

      if (w.isLeaf) {
        const p = leafPlan.get(w.code);
        if (!p) continue; // miktar/tarih girilmemiş → satır YOK
        const r = leafReal.get(w.code);
        out.push({
          item: w,
          level: w.level,
          isLeaf: true,
          planRange: p,
          realizedRange: r,
        });
      } else {
        // Parent rollup — sadece miktar girilmiş leaf'lerin min/max'i
        const leaves = descendantLeafCodes(w.code);
        let minStart: string | undefined;
        let maxEnd: string | undefined;
        let minRealStart: string | undefined;
        let maxRealEnd: string | undefined;
        for (const code of leaves) {
          const p = leafPlan.get(code);
          if (p) {
            if (!minStart || p.start < minStart) minStart = p.start;
            if (!maxEnd || p.end > maxEnd) maxEnd = p.end;
          }
          const r = leafReal.get(code);
          if (r) {
            if (!minRealStart || r.start < minRealStart) minRealStart = r.start;
            if (!maxRealEnd || r.end > maxRealEnd) maxRealEnd = r.end;
          }
        }
        if (minStart && maxEnd) {
          out.push({
            item: w,
            level: w.level,
            isLeaf: false,
            planRange: { start: minStart, end: maxEnd },
            realizedRange:
              minRealStart && maxRealEnd
                ? { start: minRealStart, end: maxRealEnd }
                : undefined,
          });
        }
      }
    }
    return out;
  }, [wbs, baseline, realized, project, showL1, showL2, showL3]);

  // ─── PDF Export ───
  async function exportPdf() {
    if (!project) return;
    setExporting(true);
    try {
      await loadingOverlay.run(async () => {
        const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
          import("jspdf"),
          import("html2canvas-pro"),
        ]);
        const el = document.querySelector("[data-timeline-capture]") as HTMLElement | null;
        if (!el) throw new Error("Capture container bulunamadı");

        const prev = {
          maxHeight: el.style.maxHeight,
          height: el.style.height,
          overflow: el.style.overflow,
          width: el.style.width,
        };
        el.style.maxHeight = "none";
        el.style.height = "auto";
        el.style.overflow = "visible";
        el.style.width = `${el.scrollWidth}px`;

        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          width: el.scrollWidth,
          height: el.scrollHeight,
          windowWidth: el.scrollWidth,
          windowHeight: el.scrollHeight,
        });

        el.style.maxHeight = prev.maxHeight;
        el.style.height = prev.height;
        el.style.overflow = prev.overflow;
        el.style.width = prev.width;

        const pdf = new jsPDF("landscape", "mm", "a3");
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const headerH = 14;
        const availW = pageW - margin * 2;
        const availH = pageH - margin - headerH;
        const pxPerMm = canvas.width / availW;
        const imgWmm = availW;
        const imgHmm = canvas.height / pxPerMm;
        const imgData = canvas.toDataURL("image/png");

        const drawHeader = (subtitle: string) => {
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          pdf.text(project.name, margin, margin);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.text(subtitle, margin, margin + 5);
        };
        const baseSubtitle = `Timeline (Baseline) · ${formatDate(project.startDate)} -> ${formatDate(project.plannedEnd)} · Rapor: ${formatDate(project.reportDate)}`;

        if (imgHmm <= availH) {
          drawHeader(baseSubtitle);
          pdf.addImage(imgData, "PNG", margin, margin + headerH, imgWmm, imgHmm);
        } else {
          const sliceHmm = availH;
          const sliceHpx = sliceHmm * pxPerMm;
          const totalPages = Math.ceil(canvas.height / sliceHpx);
          const tmp = document.createElement("canvas");
          tmp.width = canvas.width;
          const ctx = tmp.getContext("2d")!;
          for (let p = 0; p < totalPages; p++) {
            const offsetY = p * sliceHpx;
            const sliceActualH = Math.min(sliceHpx, canvas.height - offsetY);
            tmp.height = sliceActualH;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, tmp.width, sliceActualH);
            ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceActualH, 0, 0, canvas.width, sliceActualH);
            const sliceData = tmp.toDataURL("image/png");
            if (p > 0) pdf.addPage("a3", "landscape");
            drawHeader(`${baseSubtitle} · sayfa ${p + 1}/${totalPages}`);
            const sliceHmmActual = sliceActualH / pxPerMm;
            pdf.addImage(sliceData, "PNG", margin, margin + headerH, imgWmm, sliceHmmActual);
          }
        }
        const fileName = `${project.name.replace(/\s+/g, "-")}-Timeline-Baseline-${toISODate(new Date())}.pdf`;
        pdf.save(fileName);
        toast("Timeline PDF kaydedildi (A3)", "success");
      }, "Timeline PDF hazırlanıyor");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    } finally {
      setExporting(false);
    }
  }

  if (!project) {
    return (
      <>
        <PageHeader title="Timeline & Gantt" icon={BarChart3} />
        <Alert variant="warning">Önce bir proje seçin.</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Timeline & Gantt"
        description={`Baseline planı · ${formatDate(project.startDate)} → ${formatDate(project.plannedEnd)}`}
        icon={BarChart3}
        actions={
          <Button variant="accent" onClick={exportPdf} disabled={exporting} size="sm">
            <FileDown size={14} />
            {exporting ? "Üretiliyor..." : "PDF (A3)"}
          </Button>
        }
      />

      {/* Baseline durumu */}
      {!hasBaseline && Object.keys(planned).length > 0 && (
        <Alert variant="info" className="mb-4">
          <Info size={14} className="inline mr-1.5" />
          <strong>Baseline alınmamış.</strong> Şu an mevcut planlama verisi gösteriliyor.
          Baseline almak için <a href="/planning" className="text-accent underline font-bold">Planlama</a> sayfasında
          &quot;Baseline Al&quot; butonuna basın.
        </Alert>
      )}

      {hasBaseline && baselineSetAt && (
        <div className="mb-3 inline-flex items-center gap-2 text-[11px] text-accent bg-accent/8 border border-accent/25 rounded-md px-2.5 py-1">
          <Info size={11} />
          <span className="font-bold uppercase tracking-wider">Baseline</span>
          <span className="text-text2">·</span>
          <span className="font-mono">{formatDate(baselineSetAt)} tarihinde donduruldu</span>
        </div>
      )}

      {/* Filtreler */}
      <Card className="!p-3 mb-3 space-y-2">
        {/* Satır 1: Seviye chip'leri */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-bold text-text3 mr-1">
            Seviyeler:
          </span>
          <TypeChip
            active={showL1}
            onToggle={() => setShowL1(!showL1)}
            icon={<Layers3 size={13} />}
            label="L1 — Ana Başlıklar"
            color="blue"
          />
          <TypeChip
            active={showL2}
            onToggle={() => setShowL2(!showL2)}
            icon={<Layers2 size={13} />}
            label="L2 — Alt Başlıklar"
            color="purple"
          />
          <TypeChip
            active={showL3}
            onToggle={() => setShowL3(!showL3)}
            icon={<FileText size={13} />}
            label="L3 — İş Kalemleri"
            color="slate"
          />
          <span className="ml-auto text-[10.5px] text-text3 font-mono">
            {rows.length} satır gösteriliyor
          </span>
        </div>
        {/* Satır 2: Planlanan / Gerçekleşen chip'leri */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-bold text-text3 mr-1">
            Veri:
          </span>
          <TypeChip
            active={showPlan}
            onToggle={() => setShowPlan(!showPlan)}
            icon={<CalendarDays size={13} />}
            label="Planlanan"
            color="blue"
          />
          <TypeChip
            active={showRealized}
            onToggle={() => setShowRealized(!showRealized)}
            icon={<CheckCircle2 size={13} />}
            label="Gerçekleşen"
            color="accent"
          />
          {showRealized && (
            <span className="text-[10.5px] text-text3 italic ml-1">
              ℹ Gerçekleşen açıkken öncül okları kapalıdır.
            </span>
          )}
        </div>
      </Card>

      {!showL1 && !showL2 && !showL3 ? (
        <Alert variant="warning">Hiçbir seviye seçili değil — en az birini açın.</Alert>
      ) : !showPlan && !showRealized ? (
        <Alert variant="warning">
          Hem Planlanan hem Gerçekleşen kapalı — en az birini açın.
        </Alert>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-text2 text-center py-8">
            Bu filtre için gösterilecek kalem yok.{" "}
            <a href="/planning" className="text-accent underline">
              Planlama
            </a>
            &apos;dan baseline almayı ve plan girmeyi unutmayın.
          </p>
        </Card>
      ) : (
        <div data-timeline-capture>
          <BigGantt
            rows={rows}
            projectStart={project.startDate}
            projectEnd={project.plannedEnd}
            reportDate={project.reportDate}
            schedules={schedules}
            criticalCodes={criticalCodes}
            cycleNodes={cycleNodes}
            showPlan={showPlan}
            showRealized={showRealized}
            onOpenWhatIf={() => setWhatIfOpen(true)}
          />
        </div>
      )}

      <WhatIfDialog
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        wbs={wbs}
        leafs={wbs.filter((w) => w.isLeaf && !w.deletedAt)}
        planned={baseline}
        projectStart={project.startDate}
      />
    </>
  );
}

function TypeChip({
  active,
  onToggle,
  icon,
  label,
  color,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  color: "blue" | "purple" | "slate" | "accent";
}) {
  const colorMap = {
    blue: { border: "border-blue", bg: "bg-blue/10", text: "text-blue" },
    purple: { border: "border-purple", bg: "bg-purple/10", text: "text-purple" },
    slate: { border: "border-slate-400", bg: "bg-slate-100", text: "text-slate-700" },
    accent: { border: "border-accent", bg: "bg-accent/10", text: "text-accent" },
  };
  const c = colorMap[color];
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-[11px] font-bold transition-all",
        active
          ? [c.bg, c.text, c.border]
          : "bg-white border-border text-text3 hover:text-text2 hover:border-border2"
      )}
    >
      <input
        type="checkbox"
        checked={active}
        onChange={onToggle}
        className={cn("w-3 h-3 rounded pointer-events-none", active && c.text)}
        readOnly
      />
      {icon}
      {label}
    </button>
  );
}
