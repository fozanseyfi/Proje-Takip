"use client";

import { useMemo, useState } from "react";
import {
  ShoppingCart,
  Plus,
  Pencil,
  Trash2,
  Star,
  CheckCircle2,
  Truck,
  Package,
  CalendarClock,
  FileDown,
} from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { formatDate, formatMoney, formatNumber, cn, toISODate } from "@/lib/utils";
import type { ProcurementItem } from "@/lib/store/types";
import type { Currency } from "@/lib/utils";
import {
  ProcurementKpiStrip,
  computeProcurementKpis,
} from "@/components/dashboard/procurement-kpis";

const STATUS_LABELS: Record<ProcurementItem["status"], string> = {
  talep: "Talep",
  siparis: "Sipariş",
  yolda: "Yolda",
  teslim: "Teslim",
  iade: "İade",
};

const STATUS_VARIANT: Record<ProcurementItem["status"], "gray" | "yellow" | "blue" | "green" | "red"> = {
  talep: "gray",
  siparis: "yellow",
  yolda: "blue",
  teslim: "green",
  iade: "red",
};

export default function ProcurementPage() {
  const project = useCurrentProject();
  const items = useStore((s) => s.procurement).filter((p) => p.projectId === project?.id);
  const add = useStore((s) => s.addProcurement);
  const update = useStore((s) => s.updateProcurement);
  const del = useStore((s) => s.deleteProcurement);
  const toast = useToast((s) => s.push);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProcurementItem | null>(null);
  const [actualizing, setActualizing] = useState<ProcurementItem | null>(null);
  const [filterCritical, setFilterCritical] = useState(false);

  const filtered = useMemo(
    () => filterCritical ? items.filter((p) => p.isCritical) : items,
    [items, filterCritical]
  );

  const totalsByCurrency = useMemo(() => {
    const planned: Record<Currency, number> = { TRY: 0, USD: 0, EUR: 0 };
    const actual: Record<Currency, number> = { TRY: 0, USD: 0, EUR: 0 };
    for (const it of items) {
      planned[it.currency] += it.quantity * it.unitPrice;
      if (it.actualQuantity != null && it.actualUnitPrice != null) {
        const ac = it.actualCurrency ?? it.currency;
        actual[ac] += it.actualQuantity * it.actualUnitPrice;
      }
    }
    return { planned, actual };
  }, [items]);

  const criticalCount = items.filter((p) => p.isCritical).length;

  // KPI hesaplamaları
  const kpis = useMemo(() => computeProcurementKpis(items, totalsByCurrency), [items, totalsByCurrency]);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
      </Card>
    );
  }

  function toggleCritical(it: ProcurementItem) {
    update(it.id, { isCritical: !it.isCritical });
    toast(
      it.isCritical
        ? `${it.material} — kritik bayrağı kaldırıldı`
        : `${it.material} — kritik işaretlendi · Dashboard'da sürekli görünür`,
      "info"
    );
  }

  async function exportPdf() {
    if (!project) return;
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;

      // Geist Regular TTF
      const fontResp = await fetch("/fonts/Geist-Regular.ttf");
      if (!fontResp.ok) throw new Error("Font yüklenemedi");
      const fontBuf = await fontResp.arrayBuffer();
      const fontB64 = (() => {
        const bytes = new Uint8Array(fontBuf);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(
            null,
            Array.from(bytes.subarray(i, i + chunk))
          );
        }
        return btoa(binary);
      })();

      // A4 LANDSCAPE — daha geniş sütun alanı için
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
      pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
      pdf.addFont("Geist-Regular.ttf", "Geist", "bold");
      pdf.setFont("Geist", "normal");

      const pageW = pdf.internal.pageSize.getWidth();
      const marginX = 8;
      const availW = pageW - marginX * 2;

      // ───── BRAND-GREEN HEADER ─────
      const headerX = marginX;
      const headerY = marginX;
      const headerW = availW;
      const headerH = 56;

      // Smooth gradient brand-700 → brand-500
      const strips = 240;
      const stripW = headerW / strips;
      const c1 = { r: 4, g: 120, b: 87 };
      const c2 = { r: 16, g: 185, b: 129 };
      for (let i = 0; i < strips; i++) {
        const t = i / (strips - 1);
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        pdf.setFillColor(r, g, b);
        pdf.rect(headerX + i * stripW, headerY, stripW + 0.2, headerH, "F");
      }

      // Dekoratif daireler (clip + opacity)
      pdf.saveGraphicsState();
      pdf.rect(headerX, headerY, headerW, headerH);
      pdf.clip();
      pdf.discardPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfAny = pdf as any;
      pdfAny.setGState(new pdfAny.GState({ opacity: 0.18 }));
      pdf.setFillColor(4, 78, 56);
      pdf.circle(headerX + headerW - 4, headerY + 4, 28, "F");
      pdf.circle(headerX + headerW * 0.78, headerY + headerH + 2, 18, "F");
      pdfAny.setGState(new pdfAny.GState({ opacity: 1 }));
      pdf.restoreGraphicsState();

      // Sol üst rozet
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text("PROCUREMENT  ·  SATIN ALMA RAPORU", headerX + 7, headerY + 8);
      pdf.setDrawColor(220, 252, 231);
      pdf.setLineWidth(0.2);
      pdf.line(headerX + 7, headerY + 9.2, headerX + 60, headerY + 9.2);

      // Proje adı
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(28);
      pdf.setTextColor(255, 255, 255);
      pdf.text(project.name, headerX + 7, headerY + 21);

      const aylar = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
      ];
      const today = new Date();
      const todayTr = `${today.getDate()} ${aylar[today.getMonth()]} ${today.getFullYear()}`;
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(209, 250, 229);
      pdf.text(`Rapor günü: ${todayTr}`, headerX + 7, headerY + 26);

      // Sağ üst — TOPLAM KALEM
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text("TOPLAM KALEM", headerX + headerW - 7, headerY + 8, { align: "right" });
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(32);
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(items.length), headerX + headerW - 7, headerY + 22, { align: "right" });
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(209, 250, 229);
      pdf.text(`${criticalCount} kritik`, headerX + headerW - 7, headerY + 27, { align: "right" });

      // Alt 4'lü info kartları — KPI özeti
      const cardY = headerY + 32;
      const cardH = 18;
      const cardCount = 4;
      const cardGap = 2.5;
      const cardW = (headerW - 14 - cardGap * (cardCount - 1)) / cardCount;
      const totalLine = kpis.activeCurrencies
        .map((c) => `${formatMoney(kpis.totalsByCurrency.planned[c], c, 0)}`)
        .join(" · ") || "—";
      const cards = [
        { label: "GECİKME (TESLİM)", value: `${kpis.deliveryLateCount} kalem${kpis.deliveryMaxDays > 0 ? ` · +${kpis.deliveryMaxDays}g` : ""}` },
        { label: "GECİKME (PO)", value: `${kpis.poLateCount} kalem${kpis.poMaxDays > 0 ? ` · +${kpis.poMaxDays}g` : ""}` },
        { label: "TESLİM EDİLEN", value: `${kpis.delivered} / ${kpis.total}` },
        { label: "TOPLAM BEDEL", value: totalLine },
      ];
      cards.forEach((c, i) => {
        const cx = headerX + 7 + i * (cardW + cardGap);
        pdf.setFillColor(2, 44, 34);
        pdf.roundedRect(cx, cardY, cardW, cardH, 1.8, 1.8, "F");
        pdf.setDrawColor(110, 231, 183);
        pdf.setLineWidth(0.25);
        pdf.line(cx + 3, cardY + 6.5, cx + 6.5, cardY + 6.5);
        pdf.setFont("Geist", "bold");
        pdf.setFontSize(6);
        pdf.setTextColor(167, 243, 208);
        pdf.text(c.label, cx + 3, cardY + 5.5);
        pdf.setFont("Geist", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(255, 255, 255);
        let val = c.value;
        const maxW = cardW - 6;
        if (pdf.getTextWidth(val) > maxW) {
          let fs = 10;
          while (fs > 6 && pdf.getTextWidth(val) > maxW) {
            fs -= 0.5;
            pdf.setFontSize(fs);
          }
        }
        pdf.text(val, cx + 3, cardY + 13);
      });

      pdf.setTextColor(0, 0, 0);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.2);

      // ───── TABLO ─────
      type ProcRowData = {
        crit: string;
        material: string;
        supplier: string;
        plan: string;
        gercek: string;
        po: string;
        exw: string;
        teslim: string;
        durum: string;
      };
      const body: ProcRowData[] = filtered.map((it) => {
        const plannedPo = it.plannedPoDate ?? it.orderDate;
        const plannedExw = it.plannedExwDate;
        const plannedDel = it.plannedDeliveryDate ?? it.expectedDate;
        const actualPo = it.actualPoDate;
        const actualExw = it.actualExwDate;
        const actualDel = it.actualDeliveredDate ?? it.deliveredDate;
        const plannedTotal = it.quantity * it.unitPrice;
        const actualTotal =
          it.actualQuantity != null && it.actualUnitPrice != null
            ? it.actualQuantity * it.actualUnitPrice
            : null;
        const fmtDate = (p?: string, a?: string) => {
          if (!p && !a) return "—";
          if (p && a) return `${formatDate(p)}\n${formatDate(a)}`;
          return formatDate(p ?? a!);
        };
        return {
          crit: it.isCritical ? "★" : "",
          material: it.material,
          supplier: it.supplier ?? "—",
          plan: formatMoney(plannedTotal, it.currency, 0),
          gercek: actualTotal != null
            ? formatMoney(actualTotal, it.actualCurrency ?? it.currency, 0)
            : "—",
          po: fmtDate(plannedPo, actualPo),
          exw: fmtDate(plannedExw, actualExw),
          teslim: fmtDate(plannedDel, actualDel),
          durum: STATUS_LABELS[it.status],
        };
      });

      autoTable(pdf, {
        startY: headerY + headerH + 5,
        margin: { left: marginX, right: marginX, top: 14, bottom: 12 },
        head: [["", "Malzeme", "Tedarikçi", "Plan", "Gerçek", "PO", "EXW", "Teslim", "Durum"]],
        body: body.map((r) => [
          r.crit, r.material, r.supplier, r.plan, r.gercek, r.po, r.exw, r.teslim, r.durum,
        ]),
        styles: {
          font: "Geist",
          fontSize: 8,
          cellPadding: { top: 2, right: 2, bottom: 2, left: 2 },
          overflow: "linebreak",
          valign: "middle",
          lineColor: [220, 220, 230],
          lineWidth: 0.15,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [4, 120, 87],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8.5,
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 6, halign: "center", textColor: [217, 119, 6] },
          1: { cellWidth: 65, halign: "left", fontStyle: "bold" },
          2: { cellWidth: 40, halign: "left" },
          3: { cellWidth: 28, halign: "right", fontStyle: "bold", overflow: "visible" },
          4: { cellWidth: 28, halign: "right", fontStyle: "bold", overflow: "visible" },
          5: { cellWidth: 26, halign: "center", overflow: "visible" },
          6: { cellWidth: 26, halign: "center", overflow: "visible" },
          7: { cellWidth: 26, halign: "center", overflow: "visible" },
          8: { cellWidth: 25, halign: "center", fontStyle: "bold", overflow: "visible" },
        },
        didDrawPage: (data) => {
          const pageNum = pdf.getNumberOfPages();
          const pageH = pdf.internal.pageSize.getHeight();
          pdf.setFont("Geist", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(140, 140, 140);
          pdf.text(
            `${project.name}   ·   sayfa ${data.pageNumber}/${pageNum}`,
            marginX,
            pageH - 5
          );
          pdf.setTextColor(0, 0, 0);
        },
      });

      const fname = `${project.name.replace(/\s+/g, "-")}-Procurement-${toISODate(new Date())}.pdf`;
      pdf.save(fname);
      toast("Procurement PDF indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Procurement"
        description={`${items.length} kayıt · ${criticalCount} kritik malzeme`}
        icon={ShoppingCart}
        actions={
          <>
            <Button variant="outline" onClick={exportPdf} disabled={items.length === 0}>
              <FileDown size={14} /> PDF İndir
            </Button>
            <Button variant="accent" onClick={() => setCreating(true)}>
              <Plus size={14} /> Yeni Kayıt
            </Button>
          </>
        }
      />

      {/* KPI'lar — 4 sabit kart: Gecikme Teslim, Gecikme PO, Teslim Edilen, Toplam Bedel */}
      <ProcurementKpiStrip kpis={kpis} items={items} />

      {/* Kritik filtre */}
      <div className="flex items-center gap-2 mb-3">
        <Button
          variant={filterCritical ? "soft" : "outline"}
          size="sm"
          onClick={() => setFilterCritical(!filterCritical)}
        >
          <Star size={14} className={filterCritical ? "fill-yellow text-yellow" : ""} />
          {filterCritical ? "Sadece Kritikler" : "Tümü Göster"} ({criticalCount} kritik)
        </Button>
      </div>

      {/* Tablo */}
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-bg2 sticky top-0 z-10">
              <tr className="text-[10px] uppercase tracking-wider font-bold text-text2">
                <th className="px-3 py-2.5 text-center border-b border-border w-9"></th>
                <th className="px-3 py-2.5 text-left border-b border-border w-[14rem]">
                  Malzeme
                </th>
                <th className="px-3 py-2.5 text-left border-b border-border w-[8rem]">
                  Tedarikçi
                </th>
                <th className="px-3 py-2.5 text-right border-b border-border w-[7.5rem]">
                  Miktar × Fiyat
                </th>
                <th className="px-3 py-2.5 text-right border-b border-border w-[7.5rem]">
                  Bütçe
                  <div className="text-[9px] text-text3 normal-case font-normal mt-0.5">
                    Plan / Gerçek
                  </div>
                </th>
                <th className="px-3 py-2.5 text-center border-b border-border w-[7rem]">
                  PO
                </th>
                <th className="px-3 py-2.5 text-center border-b border-border w-[7rem]">
                  EXW
                </th>
                <th className="px-3 py-2.5 text-center border-b border-border w-[7rem]">
                  Teslim
                </th>
                <th className="px-3 py-2.5 text-center border-b border-border w-[7rem]">
                  Durum
                </th>
                <th className="px-3 py-2.5 border-b border-border w-[6rem]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-text3 text-sm">
                    {filterCritical ? "Kritik işaretli malzeme yok." : "Henüz kayıt yok."}
                  </td>
                </tr>
              ) : (
                filtered.map((it) => (
                  <ProcRow
                    key={it.id}
                    item={it}
                    onEdit={() => setEditing(it)}
                    onActualize={() => setActualizing(it)}
                    onDelete={async () => {
                      if (await confirmAction({
                        title: `"${it.material}" silinsin mi?`,
                        message: "Satın alma kaydı kalıcı olarak silinecek.",
                        danger: true,
                        confirmText: "Sil",
                      })) {
                        del(it.id);
                      }
                    }}
                    onToggleCritical={() => toggleCritical(it)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <ProcForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          add({ ...data, projectId: project.id });
          setCreating(false);
          toast(`${data.material} eklendi`, "success");
        }}
      />
      <ProcForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          update(editing.id, data);
          setEditing(null);
          toast(`${data.material} güncellendi`, "success");
        }}
      />
      <ActualizeDialog
        open={!!actualizing}
        item={actualizing}
        onClose={() => setActualizing(null)}
        onSubmit={(actuals) => {
          if (!actualizing) return;
          update(actualizing.id, actuals);
          setActualizing(null);
          toast(`${actualizing.material} — gerçekleşme kaydedildi`, "success");
        }}
      />
    </>
  );
}

/* ============================================================ */
/* Satır component — tek satır, plan+gerçek bilgisi compact dual */
/* ============================================================ */
function ProcRow({
  item,
  onEdit,
  onActualize,
  onDelete,
  onToggleCritical,
}: {
  item: ProcurementItem;
  onEdit: () => void;
  onActualize: () => void;
  onDelete: () => void;
  onToggleCritical: () => void;
}) {
  // Legacy fallback
  const plannedPo = item.plannedPoDate ?? item.orderDate;
  const plannedExw = item.plannedExwDate;
  const plannedDelivery = item.plannedDeliveryDate ?? item.expectedDate;
  const actualPo = item.actualPoDate;
  const actualExw = item.actualExwDate;
  const actualDelivery = item.actualDeliveredDate ?? item.deliveredDate;

  const plannedTotal = item.quantity * item.unitPrice;
  const actualTotal =
    item.actualQuantity != null && item.actualUnitPrice != null
      ? item.actualQuantity * item.actualUnitPrice
      : null;
  const diff = actualTotal != null ? actualTotal - plannedTotal : null;
  const actualCurrency = item.actualCurrency ?? item.currency;

  const rowBg = "bg-white hover:bg-bg2/40";

  return (
    <tr className={cn("border-b-2 border-border transition-colors", rowBg)}>
      {/* Kritik yıldız */}
      <td className="px-3 py-2 text-center align-middle">
        <button
          onClick={onToggleCritical}
          className={cn(
            "p-1 rounded-md transition-colors",
            item.isCritical
              ? "text-yellow"
              : "text-text3/40 hover:text-yellow"
          )}
          title={item.isCritical ? "Kritik bayrağını kaldır" : "Kritik işaretle"}
        >
          <Star size={14} className={item.isCritical ? "fill-yellow" : ""} />
        </button>
      </td>

      {/* Malzeme */}
      <td className="px-3 py-2 align-middle">
        <div className="text-[12.5px] font-semibold text-text leading-snug">
          {item.material}
        </div>
      </td>

      {/* Tedarikçi */}
      <td className="px-3 py-2 align-middle text-[11.5px] text-text2 leading-snug">
        {item.supplier ? item.supplier : <span className="text-text3">—</span>}
      </td>

      {/* Miktar × Fiyat */}
      <td className="px-3 py-2 align-middle text-right">
        <div className="font-mono text-[11px] tabular-nums leading-tight whitespace-nowrap">
          <span className="text-text">
            {formatNumber(item.quantity, 0)}
            <span className="text-text3 mx-0.5">{item.unit}</span>
          </span>
          <span className="text-text3 mx-1">×</span>
          <span className="font-semibold text-text">
            {formatMoney(item.unitPrice, item.currency)}
          </span>
        </div>
        {item.actualQuantity != null && item.actualUnitPrice != null && (
          <div className="font-mono text-[10px] tabular-nums leading-tight text-realized mt-0.5 whitespace-nowrap">
            <span>
              {formatNumber(item.actualQuantity, 0)}
              <span className="text-text3 mx-0.5">{item.unit}</span>
            </span>
            <span className="text-text3 mx-1">×</span>
            <span className="font-semibold">
              {formatMoney(item.actualUnitPrice, actualCurrency)}
            </span>
          </div>
        )}
      </td>

      {/* Bütçe — Plan / Gerçek alt alta */}
      <td className="px-3 py-2 align-middle text-right">
        <div className="font-mono font-bold text-planned tabular-nums text-[12px] leading-tight whitespace-nowrap">
          {formatMoney(plannedTotal, item.currency, 0)}
        </div>
        {actualTotal != null ? (
          <div className="mt-0.5 leading-tight">
            <div className="font-mono font-bold text-realized tabular-nums text-[12px] whitespace-nowrap">
              {formatMoney(actualTotal, actualCurrency, 0)}
            </div>
            {diff != null && Math.abs(diff) > 0.5 && (
              <div
                className={cn(
                  "inline-block mt-0.5 px-1.5 py-0 rounded text-[9.5px] font-mono font-bold",
                  diff > 0 ? "bg-red/10 text-red" : "bg-green/10 text-green"
                )}
              >
                {diff > 0 ? "+" : ""}
                {formatMoney(diff, actualCurrency, 0)}
              </div>
            )}
          </div>
        ) : (
          <div className="text-text3 text-[9.5px] italic mt-0.5">bekleniyor</div>
        )}
      </td>

      {/* Tarihler — PO / EXW / Teslim */}
      <DualDateCell planned={plannedPo} actual={actualPo} />
      <DualDateCell planned={plannedExw} actual={actualExw} />
      <DualDateCell planned={plannedDelivery} actual={actualDelivery} />

      {/* Durum */}
      <td className="px-3 py-2 align-middle text-center">
        <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABELS[item.status]}</Badge>
      </td>

      {/* Aksiyonlar */}
      <td className="px-3 py-2 align-middle">
        <div className="flex gap-0.5 justify-end">
          <button
            onClick={onActualize}
            className="p-1.5 rounded text-text3 hover:text-realized hover:bg-realized/10 transition-colors"
            title="Gerçekleşme Kaydet"
          >
            <CheckCircle2 size={14} />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded text-text3 hover:text-accent hover:bg-accent/10 transition-colors"
            title="Düzenle"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-text3 hover:text-red hover:bg-red/10 transition-colors"
            title="Sil"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Tek hücrede plan + (varsa) gerçek tarih dikey gösterim.
 * Plan üstte mavi, gerçek altta yeşil (+gecikme rozeti)
 */
function DualDateCell({
  planned,
  actual,
}: {
  planned?: string;
  actual?: string;
}) {
  const delayDays =
    planned && actual
      ? Math.ceil((new Date(actual).getTime() - new Date(planned).getTime()) / 86400000)
      : null;
  return (
    <td className="px-3 py-2 align-middle text-center">
      {planned ? (
        <div className="font-mono text-[10.5px] text-planned tabular-nums leading-tight whitespace-nowrap">
          {formatDate(planned)}
        </div>
      ) : (
        <div className="text-text3 text-xs">—</div>
      )}
      {actual && (
        <div className="mt-0.5 font-mono text-[10.5px] text-realized font-semibold tabular-nums leading-tight whitespace-nowrap">
          {formatDate(actual)}
          {delayDays != null && delayDays !== 0 && (
            <span
              className={cn(
                "ml-1 px-1 rounded text-[9px]",
                delayDays > 0 ? "bg-red/10 text-red" : "bg-green/10 text-green"
              )}
            >
              {delayDays > 0 ? `+${delayDays}g` : `${delayDays}g`}
            </span>
          )}
        </div>
      )}
    </td>
  );
}

/* ============================================================ */
/* Yeni / Düzenle dialog */
/* ============================================================ */
function ProcForm({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: ProcurementItem;
  onClose: () => void;
  onSubmit: (data: Omit<ProcurementItem, "id" | "projectId">) => void;
}) {
  const [material, setMaterial] = useState(initial?.material ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [unit, setUnit] = useState(initial?.unit ?? "adet");
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ?? 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "USD");
  const [status, setStatus] = useState<ProcurementItem["status"]>(initial?.status ?? "talep");
  const [isCritical, setIsCritical] = useState(initial?.isCritical ?? false);
  const [plannedPoDate, setPlannedPoDate] = useState(initial?.plannedPoDate ?? initial?.orderDate ?? "");
  const [plannedExwDate, setPlannedExwDate] = useState(initial?.plannedExwDate ?? "");
  const [plannedDeliveryDate, setPlannedDeliveryDate] = useState(initial?.plannedDeliveryDate ?? initial?.expectedDate ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const planTotal = quantity * unitPrice;

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Satın Alma Düzenle" : "Yeni Satın Alma Kaydı"} size="lg">
      <div className="space-y-4">
        {/* Temel bilgi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Malzeme" className="sm:col-span-2">
            <Input
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="örn. Solar Panel 545Wp, NYY-O 5×16, Trafo 1600kVA..."
            />
          </Field>
          <Field label="Tedarikçi" className="sm:col-span-2">
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <Field label="Miktar">
            <div className="flex gap-2">
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value) || 0)}
                className="flex-1"
              />
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20" placeholder="adet" />
            </div>
          </Field>
          <Field label="Birim Fiyat">
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                className="flex-1"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
              />
              <Select className="w-24" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </div>
          </Field>
          <Field label="Durum">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProcurementItem["status"])}>
              <option value="talep">Talep</option>
              <option value="siparis">Sipariş</option>
              <option value="yolda">Yolda</option>
              <option value="teslim">Teslim</option>
              <option value="iade">İade</option>
            </Select>
          </Field>
          <Field label="Toplam Tutar (planlanan)">
            <div className="h-10 flex items-center px-3 rounded-lg bg-bg2 border border-border font-mono font-bold text-planned tabular-nums">
              {formatMoney(planTotal, currency, 0)}
            </div>
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-yellow/30 bg-yellow/5">
          <input
            type="checkbox"
            checked={isCritical}
            onChange={(e) => setIsCritical(e.target.checked)}
            className="w-4 h-4 accent-yellow"
          />
          <Star size={14} className={isCritical ? "fill-yellow text-yellow" : "text-text3"} />
          <span className="text-sm font-semibold text-text">Kritik Malzeme</span>
          <span className="text-xs text-text3">
            (Dashboard procurement follow-up&apos;ta sürekli görünür)
          </span>
        </label>

        {/* Planlanan tarihler */}
        <div className="rounded-xl border border-planned/30 bg-blue/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={14} className="text-planned" />
            <span className="text-sm font-bold text-planned uppercase tracking-wider">
              Planlanan Tarihler
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="PO Tarihi">
              <Input type="date" value={plannedPoDate} onChange={(e) => setPlannedPoDate(e.target.value)} />
            </Field>
            <Field label="EXW Tarihi" hint="Fabrika çıkış / hazır">
              <Input type="date" value={plannedExwDate} onChange={(e) => setPlannedExwDate(e.target.value)} />
            </Field>
            <Field label="Teslimat Tarihi" hint="Sahaya geliş">
              <Input type="date" value={plannedDeliveryDate} onChange={(e) => setPlannedDeliveryDate(e.target.value)} />
            </Field>
          </div>
        </div>

        <Field label="Notlar">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() =>
            onSubmit({
              // category alanı schema'da zorunlu; UI'dan kaldırıldı, malzeme adıyla doldurulur
              category: material,
              material,
              supplier: supplier || undefined,
              quantity,
              unit,
              unitPrice,
              currency,
              status,
              isCritical,
              plannedPoDate: plannedPoDate || undefined,
              plannedExwDate: plannedExwDate || undefined,
              plannedDeliveryDate: plannedDeliveryDate || undefined,
              notes: notes || undefined,
              // Gerçekleşen alanlar mevcut değerleri korusun (edit ediliyorsa)
              actualPoDate: initial?.actualPoDate,
              actualExwDate: initial?.actualExwDate,
              actualDeliveredDate: initial?.actualDeliveredDate,
              actualQuantity: initial?.actualQuantity,
              actualUnitPrice: initial?.actualUnitPrice,
              actualCurrency: initial?.actualCurrency,
              actualNotes: initial?.actualNotes,
            })
          }
        >
          Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/* ============================================================ */
/* Gerçekleşme Kaydet dialog */
/* ============================================================ */
function ActualizeDialog({
  open,
  item,
  onClose,
  onSubmit,
}: {
  open: boolean;
  item: ProcurementItem | null;
  onClose: () => void;
  onSubmit: (data: Partial<ProcurementItem>) => void;
}) {
  const [actualPoDate, setActualPoDate] = useState("");
  const [actualExwDate, setActualExwDate] = useState("");
  const [actualDeliveredDate, setActualDeliveredDate] = useState("");
  const [actualQuantity, setActualQuantity] = useState<string>("");
  const [actualUnitPrice, setActualUnitPrice] = useState<string>("");
  const [actualCurrency, setActualCurrency] = useState<Currency>("USD");
  const [actualNotes, setActualNotes] = useState("");
  const [newStatus, setNewStatus] = useState<ProcurementItem["status"]>("teslim");

  // Item değişince state'i doldur
  useMemo(() => {
    if (item) {
      setActualPoDate(item.actualPoDate ?? "");
      setActualExwDate(item.actualExwDate ?? "");
      setActualDeliveredDate(item.actualDeliveredDate ?? item.deliveredDate ?? "");
      setActualQuantity(item.actualQuantity != null ? String(item.actualQuantity) : String(item.quantity));
      setActualUnitPrice(item.actualUnitPrice != null ? String(item.actualUnitPrice) : String(item.unitPrice));
      setActualCurrency(item.actualCurrency ?? item.currency);
      setActualNotes(item.actualNotes ?? "");
      setNewStatus(item.status);
    }
  }, [item]);

  if (!item) return null;

  const plannedTotal = item.quantity * item.unitPrice;
  const actualTotal = (Number(actualQuantity) || 0) * (Number(actualUnitPrice) || 0);
  const diff = actualTotal - plannedTotal;

  return (
    <Dialog open={open} onClose={onClose} title={`Gerçekleşme Kaydı — ${item.material}`} size="lg">
      <div className="space-y-4">
        <Alert variant="info">
          Bu satınalma için gerçekleşen tarihleri, miktarı ve gerçek bütçeyi gir.
          Planlanan değerler korunur; tabloda alt alta karşılaştırma görünür.
        </Alert>

        {/* Gerçek tarihler */}
        <div className="rounded-xl border border-realized/30 bg-green/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={14} className="text-realized" />
            <span className="text-sm font-bold text-realized uppercase tracking-wider">
              Gerçekleşen Tarihler
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field
              label="PO Tarihi"
              hint={item.plannedPoDate ? `Plan: ${formatDate(item.plannedPoDate)}` : undefined}
            >
              <Input type="date" value={actualPoDate} onChange={(e) => setActualPoDate(e.target.value)} />
            </Field>
            <Field
              label="EXW Tarihi"
              hint={item.plannedExwDate ? `Plan: ${formatDate(item.plannedExwDate)}` : undefined}
            >
              <Input type="date" value={actualExwDate} onChange={(e) => setActualExwDate(e.target.value)} />
            </Field>
            <Field
              label="Teslim Tarihi"
              hint={item.plannedDeliveryDate ? `Plan: ${formatDate(item.plannedDeliveryDate)}` : undefined}
            >
              <Input type="date" value={actualDeliveredDate} onChange={(e) => setActualDeliveredDate(e.target.value)} />
            </Field>
          </div>
        </div>

        {/* Gerçek miktar + bütçe */}
        <div className="rounded-xl border border-realized/30 bg-green/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package size={14} className="text-realized" />
            <span className="text-sm font-bold text-realized uppercase tracking-wider">
              Gerçekleşen Miktar & Bütçe
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Gerçek Miktar" hint={`Plan: ${formatNumber(item.quantity, 0)} ${item.unit}`}>
              <Input type="number" value={actualQuantity} onChange={(e) => setActualQuantity(e.target.value)} />
            </Field>
            <Field label="Gerçek Birim Fiyat" hint={`Plan: ${formatMoney(item.unitPrice, item.currency)}`}>
              <Input
                type="number"
                step="0.01"
                value={actualUnitPrice}
                onChange={(e) => setActualUnitPrice(e.target.value)}
              />
            </Field>
            <Field label="Para Birimi">
              <Select value={actualCurrency} onChange={(e) => setActualCurrency(e.target.value as Currency)}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="px-3 py-2 rounded-lg bg-white border border-border">
              <div className="text-[10px] uppercase tracking-wider font-bold text-text3">Plan Tutar</div>
              <div className="font-mono font-bold text-planned tabular-nums">
                {formatMoney(plannedTotal, item.currency, 0)}
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-white border border-border">
              <div className="text-[10px] uppercase tracking-wider font-bold text-text3">Gerçek Tutar</div>
              <div className="font-mono font-bold text-realized tabular-nums">
                {formatMoney(actualTotal, actualCurrency, 0)}
              </div>
            </div>
            <div className={cn("px-3 py-2 rounded-lg bg-white border", diff > 0 ? "border-red/30" : "border-green/30")}>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text3">Fark</div>
              <div className={cn("font-mono font-bold tabular-nums", diff > 0 ? "text-red" : "text-green")}>
                {diff > 0 ? "+" : ""}{formatMoney(diff, actualCurrency, 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Durum (güncelleyebilirsin)">
            <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value as ProcurementItem["status"])}>
              <option value="talep">Talep</option>
              <option value="siparis">Sipariş</option>
              <option value="yolda">Yolda</option>
              <option value="teslim">Teslim</option>
              <option value="iade">İade</option>
            </Select>
          </Field>
        </div>

        <Field label="Gerçekleşme Notu">
          <Textarea value={actualNotes} onChange={(e) => setActualNotes(e.target.value)} rows={2} />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() => {
            onSubmit({
              actualPoDate: actualPoDate || undefined,
              actualExwDate: actualExwDate || undefined,
              actualDeliveredDate: actualDeliveredDate || undefined,
              actualQuantity: actualQuantity ? Number(actualQuantity) : undefined,
              actualUnitPrice: actualUnitPrice ? Number(actualUnitPrice) : undefined,
              actualCurrency: actualCurrency,
              actualNotes: actualNotes || undefined,
              status: newStatus,
            });
          }}
        >
          <CheckCircle2 size={14} /> Gerçekleşmeyi Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
