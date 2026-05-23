"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Save,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
} from "lucide-react";
import {
  useStore,
  useCurrentProject,
  useProjectWbs,
  useProjectPlanned,
  useProjectRealized,
} from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sumByDateMap } from "@/lib/calc/progress";
import { formatNumber, formatDate, toISODate, daysBetween, cn, spiLevel } from "@/lib/utils";
import { buildWbsTree } from "@/lib/wbs/tree";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function RealizationPage() {
  const project = useCurrentProject();
  const wbs = useProjectWbs(project?.id);
  const realized = useProjectRealized(project?.id);
  const planned = useProjectPlanned(project?.id);
  const setRealized = useStore((s) => s.setRealized);
  const toast = useToast((s) => s.push);

  const [date, setDate] = useState(toISODate(new Date()));

  // Proje değişince tarih sınırların dışındaysa klamp et
  useEffect(() => {
    if (!project) return;
    const td = toISODate(new Date());
    const max = project.plannedEnd < td ? project.plannedEnd : td;
    if (date < project.startDate) setDate(project.startDate);
    else if (date > max) setDate(max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const leafs = useMemo(
    () => wbs
      .filter((w) => w.isLeaf)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [wbs]
  );

  const tree = useMemo(() => buildWbsTree(wbs), [wbs]);

  // Tüm satırlar tek tabloda — L0 hariç (filtre yok, açılır kapanır yok)
  const visibleRows = useMemo(
    () => tree.rows.filter((r) => r.item.level !== 0),
    [tree.rows]
  );

  // Local draft: o günkü değerler için
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Tarih değişince draft'ı doldur
  useEffect(() => {
    const d: Record<string, string> = {};
    for (const w of leafs) {
      const v = realized[w.code]?.[date];
      if (v) d[w.code] = String(v);
    }
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
        <p className="text-sm text-text2">Önce bir proje seç.</p>
      </Card>
    );
  }

  // proje gün numarası
  const projectDay = daysBetween(project.startDate, date) + 1;

  // Tarih sınırları: proje başı/sonu + bugünden ileri gidilmez.
  const todayIso = toISODate(new Date());
  const minDate = project.startDate;
  const maxDate = project.plannedEnd < todayIso ? project.plannedEnd : todayIso;
  function clampDate(d: string): string {
    if (d < minDate) return minDate;
    if (d > maxDate) return maxDate;
    return d;
  }
  const canPrev = date > minDate;
  const canNext = date < maxDate;

  function shiftDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(clampDate(toISODate(d)));
  }

  function copyFromYesterday() {
    if (!project) return;
    const yesterday = toISODate(new Date(new Date(date).getTime() - 86400000));
    const d: Record<string, string> = {};
    let count = 0;
    for (const w of leafs) {
      const v = realized[w.code]?.[yesterday];
      if (v) {
        d[w.code] = String(v);
        count++;
      }
    }
    setDraft(d);
    toast(`Önceki gün (${formatDate(yesterday)}) — ${count} kayıt kopyalandı`, "info");
  }

  function saveAll() {
    if (!project) return;
    let count = 0;
    // Silinen değerler için, eski draft'ta vardı ama yeni'de yoksa 0 yaz
    const oldKeys = new Set<string>();
    for (const w of leafs) {
      if (realized[w.code]?.[date] != null) oldKeys.add(w.code);
    }
    for (const [code, value] of Object.entries(draft)) {
      const qty = Number(value) || 0;
      const prev = realized[code]?.[date] ?? 0;
      if (qty !== prev) {
        setRealized(project.id, code, date, qty);
        count++;
      }
      oldKeys.delete(code);
    }
    // draft'tan silinmiş olanları temizle
    for (const code of oldKeys) {
      setRealized(project.id, code, date, 0);
      count++;
    }
    toast(`${formatDate(date)} kaydedildi · ${count} kayıt güncellendi`, "success");
  }

  // Saha formu PDF — html2canvas + jsPDF ile düzgün Türkçe karakter desteği
  async function downloadFieldFormPDF() {
    if (!project) return;
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    // Tüm leaf satırlarını + başlıkları topla (sayfada gösterilecek sıra)
    type Row = { code: string; name: string; quantity: string; unit: string; isHeader: boolean; level: number };
    const rows: Row[] = [];
    for (const r of tree.rows) {
      const w = r.item;
      if (w.level === 0) continue;
      rows.push({
        code: w.code,
        name: w.name,
        quantity: w.isLeaf ? formatNumber(w.quantity, 0) : "",
        unit: w.isLeaf ? (w.unit || "") : "",
        isHeader: !w.isLeaf,
        level: w.level,
      });
    }

    // ───── Hidden A4 DOM ─────
    const A4_PX_W = 794;   // 210mm @ 96dpi
    const root = document.createElement("div");
    root.style.cssText = `
      position: fixed;
      left: -10000px;
      top: 0;
      width: ${A4_PX_W}px;
      background: #ffffff;
      color: #0a0a0a;
      font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
      font-size: 11px;
      line-height: 1.35;
    `;

    const html = `
      <div style="padding: 18px 22px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 18px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 14px;">
          <div>
            <div style="font-size: 16px; font-weight: 800; letter-spacing: -0.3px;">GÜNLÜK GERÇEKLEŞME — SAHA FORMU</div>
            <div style="font-size: 12px; font-weight: 500; opacity: 0.92; margin-top: 4px;">${escapeHtml(project.name)}</div>
            <div style="font-size: 10px; opacity: 0.85; margin-top: 1px;">${escapeHtml(project.location)}</div>
          </div>
          <div style="text-align: right; font-family: 'JetBrains Mono', ui-monospace, monospace;">
            <div style="font-size: 18px; font-weight: 800;">${formatDate(date)}</div>
            <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Gün ${projectDay} / ${project.durationDays}</div>
          </div>
        </div>

        <!-- Kimlik kutusu -->
        <div style="border: 1px solid #d4d4d8; border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; background: #fafafa;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 9px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; min-width: 90px;">Saha Mühendisi</span>
              <span style="flex: 1; border-bottom: 1px solid #71717a; height: 16px;"></span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 9px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; min-width: 60px;">Hava</span>
              <span style="flex: 1; border-bottom: 1px solid #71717a; height: 16px;"></span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 9px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; min-width: 90px;">Vardiya</span>
              <span style="flex: 1; border-bottom: 1px solid #71717a; height: 16px;"></span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 9px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; min-width: 60px;">Şantiye Şefi</span>
              <span style="flex: 1; border-bottom: 1px solid #71717a; height: 16px;"></span>
            </div>
          </div>
        </div>

        <!-- Tablo başlığı -->
        <div style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;">
          İmalat Kalemleri · Saha Doldurma
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <thead>
            <tr style="background: #10b981; color: white;">
              <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #047857; width: 60px;">WBS</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #047857;">Açıklama</th>
              <th style="padding: 6px 8px; text-align: right; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #047857; width: 60px;">Toplam</th>
              <th style="padding: 6px 8px; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #047857; width: 44px;">Birim</th>
              <th style="padding: 6px 8px; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #047857; width: 110px;">Bugünkü Gerçekleşme</th>
              <th style="padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #047857;">Not</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => {
              if (r.isHeader) {
                const bg = r.level === 1 ? "#d1fae5" : "#e0f2fe";
                const color = r.level === 1 ? "#065f46" : "#075985";
                const weight = r.level === 1 ? 800 : 700;
                return `
                  <tr style="background: ${bg};">
                    <td style="padding: 5px 8px; border: 1px solid #d4d4d8; font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: ${weight}; color: ${color}; font-size: 10px;">${escapeHtml(r.code)}</td>
                    <td colspan="5" style="padding: 5px 8px; border: 1px solid #d4d4d8; font-weight: ${weight}; color: ${color}; text-transform: ${r.level === 1 ? 'uppercase' : 'none'}; letter-spacing: ${r.level === 1 ? '0.4px' : '0'};">${escapeHtml(r.name)}</td>
                  </tr>
                `;
              }
              return `
                <tr>
                  <td style="padding: 5px 8px; border: 1px solid #d4d4d8; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9px; color: #71717a;">${escapeHtml(r.code)}</td>
                  <td style="padding: 5px 8px; border: 1px solid #d4d4d8; color: #18181b;">${escapeHtml(r.name)}</td>
                  <td style="padding: 5px 8px; border: 1px solid #d4d4d8; text-align: right; font-family: 'JetBrains Mono', ui-monospace, monospace; font-weight: 600; color: #18181b;">${escapeHtml(r.quantity)}</td>
                  <td style="padding: 5px 8px; border: 1px solid #d4d4d8; text-align: center; color: #71717a; font-size: 9px;">${escapeHtml(r.unit)}</td>
                  <td style="padding: 5px 8px; border: 1px solid #d4d4d8; background: #fefce8; min-height: 22px;">&nbsp;</td>
                  <td style="padding: 5px 8px; border: 1px solid #d4d4d8;">&nbsp;</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <!-- Notlar + İmza alanı -->
        <div style="margin-top: 18px;">
          <div style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px;">Genel Notlar / Karşılaşılan Durumlar</div>
          <div style="border: 1px solid #d4d4d8; border-radius: 6px; padding: 12px; min-height: 80px; background: #fafafa;">
            <div style="height: 18px; border-bottom: 1px dashed #d4d4d8;"></div>
            <div style="height: 18px; border-bottom: 1px dashed #d4d4d8; margin-top: 4px;"></div>
            <div style="height: 18px; border-bottom: 1px dashed #d4d4d8; margin-top: 4px;"></div>
          </div>
        </div>

        <div style="margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
          <div>
            <div style="border-bottom: 1px solid #18181b; height: 32px;"></div>
            <div style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; text-align: center;">Saha Mühendisi · İmza</div>
          </div>
          <div>
            <div style="border-bottom: 1px solid #18181b; height: 32px;"></div>
            <div style="font-size: 10px; font-weight: 700; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; text-align: center;">Şantiye Şefi · İmza</div>
          </div>
        </div>

        <div style="margin-top: 14px; font-size: 8px; color: #a1a1aa; text-align: center; font-family: 'JetBrains Mono', ui-monospace, monospace;">
          ${escapeHtml(project.name)} · ${formatDate(date)} · proje-yonetim-platformu
        </div>
      </div>
    `;
    root.innerHTML = html;
    document.body.appendChild(root);

    // Tarayıcının düzeni tamamlamasını bekle
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        windowWidth: A4_PX_W,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();   // 210
      const pageH = pdf.internal.pageSize.getHeight();  // 297
      // canvas.width / scale = A4 px width; px → mm ölçeği
      const pxPerMm = canvas.width / pageW;
      const pageHpx = pageH * pxPerMm;

      // canvas'ı dilim dilim sayfaya bas
      let yOffset = 0;
      let pageNo = 0;
      while (yOffset < canvas.height) {
        const sliceH = Math.min(pageHpx, canvas.height - yOffset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, -yOffset);
        const imgData = slice.toDataURL("image/png");

        if (pageNo > 0) pdf.addPage();
        const imgMmH = sliceH / pxPerMm;
        pdf.addImage(imgData, "PNG", 0, 0, pageW, imgMmH);

        yOffset += pageHpx;
        pageNo++;
      }

      pdf.save(`${project.name.replace(/\s+/g, "-")}-saha-formu-${date}.pdf`);
      toast("Saha formu PDF indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF oluşturulamadı", "error");
    } finally {
      document.body.removeChild(root);
    }
  }

  return (
    <>
      <PageHeader
        title="Günlük Gerçekleşme Girişi"
        description={`Seçili tarih için her WBS kalemi sahada ne kadar ilerledi`}
        icon={CheckCircle2}
        actions={
          <>
            <Button variant="outline" onClick={downloadFieldFormPDF}>
              <FileText size={14} /> Saha Formu PDF
            </Button>
            <Button variant="outline" onClick={copyFromYesterday}>
              <Copy size={14} /> Önceki Günden Kopyala
            </Button>
            <Button variant="accent" onClick={saveAll}>
              <Save size={14} /> Kaydet
            </Button>
          </>
        }
      />

      {/* Tarih navigasyon */}
      <Card className="mb-4 !p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => shiftDate(-1)}
            disabled={!canPrev}
            title={canPrev ? "Önceki gün" : "Proje başlangıcındasın"}
            className="w-10 h-10 rounded-lg bg-white border border-border hover:bg-bg2 hover:border-text3 text-text2 flex items-center justify-center transition-all shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
          </button>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(clampDate(e.target.value))}
            min={minDate}
            max={maxDate}
            className="w-52 !h-10 font-mono text-sm"
          />
          <button
            onClick={() => shiftDate(1)}
            disabled={!canNext}
            title={canNext ? "Sonraki gün" : date === todayIso ? "Bugünden ileri gidilemez" : "Proje sonundasın"}
            className="w-10 h-10 rounded-lg bg-white border border-border hover:bg-bg2 hover:border-text3 text-text2 flex items-center justify-center transition-all shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={16} />
          </button>
          <div className="ml-2 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-bold">
            Gün {projectDay} / {project.durationDays}
          </div>
          <Button
            variant="ghost"
            onClick={() => setDate(clampDate(todayIso))}
            className="ml-auto"
          >
            Bugün
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-end mb-2">
        <span className="text-[10px] font-mono text-text3">{visibleRows.length} satır</span>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  WBS
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border min-w-[16rem]">
                  Açıklama
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  Toplam
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  Birim
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  Dün'e Kadar
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-center text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap min-w-[10rem]">
                  Bugünkü Gerçekleşme
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  Kümülatif %
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  Plan %
                </th>
                <th className="sticky top-0 z-20 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border whitespace-nowrap">
                  SPI
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const w = r.item;
                const isLeaf = w.isLeaf;
                const yesterday = toISODate(new Date(new Date(date).getTime() - 86400000));

                // Sadece leaf için hesaplama
                const totalQty = isLeaf ? w.quantity : 0;
                const cumUntilYesterday = isLeaf ? sumByDateMap(realized, w.code, yesterday) : 0;
                const todayValue = isLeaf ? (Number(draft[w.code]) || 0) : 0;
                const cumIncludingToday = cumUntilYesterday + todayValue;
                const realPct = totalQty > 0 ? (cumIncludingToday / totalQty) * 100 : 0;

                const cumPlan = isLeaf ? sumByDateMap(planned, w.code, date) : 0;
                const planPct = totalQty > 0 ? (cumPlan / totalQty) * 100 : 0;

                const spi = planPct > 0 ? realPct / planPct : null;
                const spiL = spiLevel(spi);

                const isActive = todayValue > 0;
                const today = toISODate(new Date());
                const isToday = date === today;

                const rowBg = isLeaf
                  ? (isActive ? "bg-realized/5" : "")
                  : w.level === 1
                    ? "bg-accent/20"
                    : w.level === 2
                      ? "bg-blue/12"
                      : "bg-bg2";
                const rowText = isLeaf ? "text-text" : w.level === 1 ? "text-accent font-extrabold uppercase tracking-wide" : "text-text font-bold";
                const indentPx = Math.max(0, w.level - 1) * 14;

                return (
                  <tr key={w.id} className={cn(rowBg, "hover:bg-bg2/40 transition-colors")}>
                    <td className={cn("px-3 py-1.5 border-b border-r border-border font-mono text-xs whitespace-nowrap", isLeaf ? "text-text3" : "text-text font-bold")}>
                      {w.code}
                    </td>
                    <td className="px-2 py-1.5 border-b border-r border-border">
                      <div className="flex items-center gap-1" style={{ paddingLeft: `${indentPx}px` }}>
                        <span className={cn("text-xs truncate max-w-[28rem]", rowText)} title={w.name}>
                          {w.name}
                        </span>
                        {!isLeaf && (
                          <span className="ml-1.5 text-[9px] font-mono px-1.5 py-0 rounded bg-bg3 text-text3 shrink-0">
                            {r.childLeafCodes.length} kalem
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={cn("px-3 py-1.5 border-b border-r border-border text-right font-mono text-xs tabular-nums text-text2")}>
                      {isLeaf && totalQty > 0 ? formatNumber(totalQty, 0) : ""}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-border text-xs text-text3">{isLeaf ? (w.unit || "—") : ""}</td>
                    <td className="px-3 py-1.5 border-b border-r border-border text-right font-mono text-xs text-text2 tabular-nums">
                      {isLeaf && cumUntilYesterday > 0 ? formatNumber(cumUntilYesterday, 1) : ""}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-border">
                      {isLeaf ? (
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          value={draft[w.code] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || /^-?\d*\.?\d{0,1}$/.test(v)) {
                              setDraft((s) => ({ ...s, [w.code]: v }));
                            }
                          }}
                          placeholder="0"
                          className={cn(
                            "w-full h-8 px-2 rounded-md bg-white border border-border2 text-center font-mono text-sm tabular-nums",
                            "focus:outline-none focus:border-accent focus:shadow-focus",
                            isActive && "border-realized/40 bg-realized/5 text-realized font-semibold",
                            isToday && "ring-1 ring-accent/10"
                          )}
                        />
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-border text-right font-mono text-xs tabular-nums">
                      {isLeaf ? (
                        <span className={cn(realPct >= 99 ? "text-green font-semibold" : totalQty > 0 ? "text-text" : "text-text3")}>
                          {totalQty > 0 ? `${realPct.toFixed(1)}%` : "—"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-border text-right font-mono text-xs tabular-nums">
                      {isLeaf ? (
                        <span className={cn("text-planned", planPct >= 99 && "font-semibold")}>
                          {totalQty > 0 ? `${planPct.toFixed(1)}%` : "—"}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 border-b border-r border-border text-right font-mono text-xs tabular-nums">
                      {isLeaf ? (
                        spi == null ? (
                          <span className="text-text3">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              spiL === "good" && "text-green",
                              spiL === "warn" && "text-yellow",
                              spiL === "bad" && "text-red"
                            )}
                          >
                            {spi.toFixed(2)}
                          </span>
                        )
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-text3 text-sm">
                    Bu filtreye uyan kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </>
  );
}
