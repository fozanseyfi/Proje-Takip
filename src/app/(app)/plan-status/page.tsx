"use client";

import { useMemo, useState } from "react";
import {
  ListChecks,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileDown,
  CheckCircle2,
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  Hourglass,
} from "lucide-react";
import {
  useCurrentProject,
  useProjectWbs,
  useProjectPlanned,
  useProjectRealized,
} from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate, toISODate, daysBetween, cn, formatNumber } from "@/lib/utils";
import { getPlanRange } from "@/lib/calc/predecessors";
import { computeProgress, type WbsItemForCalc } from "@/lib/calc/progress";
import { computeForecast, buildForecastCurve, getConfidenceTier } from "@/lib/calc/forecast";
import { makeVerticalLabel } from "@/components/charts/s-curve-chart";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

export default function PlanStatusPage() {
  const project = useCurrentProject();
  const wbs = useProjectWbs(project?.id);
  const planned = useProjectPlanned(project?.id);
  const realized = useProjectRealized(project?.id);
  const toast = useToast((s) => s.push);

  const [summaryExpanded, setSummaryExpanded] = useState<Set<string>>(() => new Set());
  // Gün filtresi — bu tarihe kadar planlanan/gerçekleşen yüzdeleri hesaplanır.
  // Default: proje raporlama tarihi, ama proje aralığı dışındaysa içine klamp
  const defaultFilterDate = useMemo(() => {
    const wanted = project?.reportDate ?? toISODate(new Date());
    if (!project) return wanted;
    if (wanted < project.startDate) return project.startDate;
    if (wanted > project.plannedEnd) return project.plannedEnd;
    return wanted;
  }, [project?.reportDate, project?.startDate, project?.plannedEnd]);
  const [filterDate, setFilterDate] = useState<string>(defaultFilterDate);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
        <p className="text-sm text-text2">Önce bir proje seç.</p>
      </Card>
    );
  }

  // Item için range — kendi leaf'lerinden agrega
  type Range = { start?: string; end?: string; duration: number };
  const all = wbs
    .filter((w) => !w.deletedAt)
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  function rangeFor(
    item: typeof all[number],
    dataMap: Record<string, Record<string, number>>
  ): Range {
    if (item.isLeaf) {
      const r = getPlanRange(dataMap[item.code]);
      return {
        start: r.start,
        end: r.end,
        duration: r.start && r.end ? daysBetween(r.start, r.end) + 1 : 0,
      };
    }
    const prefix = item.code + ".";
    let minS: string | undefined;
    let maxE: string | undefined;
    for (const child of all) {
      if (!child.isLeaf) continue;
      if (!child.code.startsWith(prefix)) continue;
      const r = getPlanRange(dataMap[child.code]);
      if (r.start && (!minS || r.start < minS)) minS = r.start;
      if (r.end && (!maxE || r.end > maxE)) maxE = r.end;
    }
    return {
      start: minS,
      end: maxE,
      duration: minS && maxE ? daysBetween(minS, maxE) + 1 : 0,
    };
  }

  // İlerleme yüzdesi — leaf ve parent için farklı yöntem:
  //   - Leaf: kendi data map'inde kümülatif / toplam (ağırlık dikkate alınmaz)
  //   - Parent: WBS ağırlığı bazlı — computeProgress(branchLeaves, ...).
  //     Σ effectiveWeight × min(cum/quantity, 1). PMP standardı, dashboard ile birebir uyumlu.
  function progressFor(
    item: typeof all[number],
    dataMap: Record<string, Record<string, number>>,
    upToDate: string
  ): { cumQty: number; totalQty: number; pct: number } {
    if (item.isLeaf) {
      const m = dataMap[item.code] ?? {};
      let cum = 0;
      let total = 0;
      for (const [d, v] of Object.entries(m)) {
        const q = Number(v) || 0;
        total += q;
        if (d <= upToDate) cum += q;
      }
      // Yüzde, kalemin planlanan toplam miktarına (quantity) göredir; map'teki kayıtların
      // toplamına değil. Aksi halde realized map kısmen dolu olduğunda filtre tarihi son
      // gerçekleşme gününü geçtiği anda oran her zaman %100'e çıkar.
      const denom = item.quantity > 0 ? item.quantity : 0;
      const pct = denom > 0 ? Math.min(cum / denom, 1) : 0;
      return { cumQty: cum, totalQty: denom, pct };
    }
    // Parent — branch leaves'a göre weight-bazlı
    const prefix = item.code + ".";
    const branchItems: WbsItemForCalc[] = [];
    for (const child of all) {
      if (!child.isLeaf || child.deletedAt) continue;
      if (!child.code.startsWith(prefix)) continue;
      branchItems.push({
        code: child.code,
        isLeaf: true,
        quantity: child.quantity,
        weight: child.weight,
      });
    }
    if (branchItems.length === 0) {
      return { cumQty: 0, totalQty: 0, pct: 0 };
    }
    // computeProgress içinde realPct = realized/quantity. Bu helper sadece tek map alıyor;
    // dolayısıyla dataMap'i planned olarak gönderir, planPct'i okuruz. realized için de
    // aynı şekilde çağrılır → o zaman dataMap = realized, hâlâ planPct slot'u kullanılır
    // (formül aynı: Σ weight × min(cum/qty, 1)).
    const res = computeProgress(branchItems, dataMap, {}, upToDate);
    return { cumQty: 0, totalQty: 0, pct: res.planPct };
  }

  type Status = {
    badge: "—" | "ok" | "warn" | "late" | "early";
    label: string;
    days: number;
  };
  function statusOf(planR: Range, realR: Range): Status {
    if (!planR.start && !planR.end && !realR.start) {
      return { badge: "—", label: "—", days: 0 };
    }
    if (!realR.start) {
      return { badge: "—", label: "başlamadı", days: 0 };
    }
    if (!planR.start || !planR.end) {
      return { badge: "warn", label: "plan yok", days: 0 };
    }
    const startDelay = daysBetween(planR.start, realR.start);
    const endDelay = realR.end ? daysBetween(planR.end, realR.end) : 0;
    const worst = Math.max(startDelay, endDelay);
    if (worst < 0) return { badge: "early", label: `${worst} gün`, days: worst };
    if (worst === 0) return { badge: "ok", label: "zamanında", days: 0 };
    if (worst <= 3) return { badge: "warn", label: `+${worst} gün`, days: worst };
    return { badge: "late", label: `+${worst} gün`, days: worst };
  }

  const isVisible = (item: typeof all[number]): boolean => {
    if (item.level <= 1) return true;
    const parts = item.code.split(".");
    for (let i = parts.length - 1; i >= 2; i--) {
      const ancestorCode = parts.slice(0, i).join(".");
      if (!summaryExpanded.has(ancestorCode)) return false;
    }
    return true;
  };
  const visible = all.filter((w) => w.level >= 1 && isVisible(w));

  // Proje toplam
  let projPlanS: string | undefined;
  let projPlanE: string | undefined;
  let projRealS: string | undefined;
  let projRealE: string | undefined;
  for (const w of all) {
    if (!w.isLeaf) continue;
    const p = getPlanRange(planned[w.code]);
    if (p.start && (!projPlanS || p.start < projPlanS)) projPlanS = p.start;
    if (p.end && (!projPlanE || p.end > projPlanE)) projPlanE = p.end;
    const r = getPlanRange(realized[w.code]);
    if (r.start && (!projRealS || r.start < projRealS)) projRealS = r.start;
    if (r.end && (!projRealE || r.end > projRealE)) projRealE = r.end;
  }
  const projPlanDur =
    projPlanS && projPlanE ? daysBetween(projPlanS, projPlanE) + 1 : 0;
  const projRealDur =
    projRealS && projRealE ? daysBetween(projRealS, projRealE) + 1 : 0;
  const projStatus = statusOf(
    { start: projPlanS, end: projPlanE, duration: projPlanDur },
    { start: projRealS, end: projRealE, duration: projRealDur }
  );

  // Proje toplam yüzdesi — WBS ağırlığı bazlı (PMP standardı, dashboard ile aynı)
  const allLeafItems: WbsItemForCalc[] = [];
  for (const w of all) {
    if (w.isLeaf && !w.deletedAt) {
      allLeafItems.push({
        code: w.code,
        isLeaf: true,
        quantity: w.quantity,
        weight: w.weight,
      });
    }
  }
  const projTotals = computeProgress(allLeafItems, planned, realized, filterDate);
  const projPlanPct = projTotals.planPct;
  const projRealPct = projTotals.realPct;

  // ─── EVM scope: "project" (tüm proje) veya L1 ana başlık kodu ───
  // Tüm L1 başlıkları (kod sıralı)
  const l1Sections = useMemo(
    () =>
      all
        .filter((w) => w.level === 1 && !w.deletedAt)
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [all]
  );
  const [evmScope, setEvmScope] = useState<string>("project"); // "project" | l1.code

  // Scope'a göre leaf'ler + tarih aralığı
  const scopedData = useMemo(() => {
    if (evmScope === "project") {
      return {
        items: allLeafItems,
        startDate: project.startDate,
        endDate: project.plannedEnd,
        label: "Proje",
      };
    }
    const sec = l1Sections.find((s) => s.code === evmScope);
    if (!sec) {
      return {
        items: allLeafItems,
        startDate: project.startDate,
        endDate: project.plannedEnd,
        label: "Proje",
      };
    }
    const prefix = sec.code + ".";
    const branchLeaves = all.filter(
      (w) => w.isLeaf && !w.deletedAt && w.code.startsWith(prefix)
    );
    const items = branchLeaves.map((l) => ({
      code: l.code,
      isLeaf: true,
      quantity: l.quantity,
      weight: l.weight,
    }));
    // Branch'ın planlanan başlangıç + bitiş tarihleri
    let minS: string | undefined;
    let maxE: string | undefined;
    for (const l of branchLeaves) {
      const r = getPlanRange(planned[l.code]);
      if (r.start && (!minS || r.start < minS)) minS = r.start;
      if (r.end && (!maxE || r.end > maxE)) maxE = r.end;
    }
    return {
      items,
      startDate: minS ?? project.startDate,
      endDate: maxE ?? project.plannedEnd,
      label: sec.name,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evmScope, l1Sections, planned, wbs, project.startDate, project.plannedEnd]);

  // EVM tahmin + S-eğrisi forecast — scope'a göre
  const forecast = useMemo(
    () =>
      computeForecast(
        scopedData.items,
        planned,
        realized,
        filterDate,
        scopedData.startDate,
        scopedData.endDate
      ),
    [scopedData, planned, realized, filterDate]
  );
  const forecastCurve = useMemo(
    () =>
      buildForecastCurve(
        scopedData.items,
        planned,
        realized,
        filterDate,
        scopedData.startDate,
        scopedData.endDate
      ),
    [scopedData, planned, realized, filterDate]
  );
  // SPI renk tonu
  const spiTone: "green" | "yellow" | "red" | "gray" = (() => {
    if (forecast.spi == null) return "gray";
    if (forecast.spi >= 0.95) return "green";
    if (forecast.spi >= 0.85) return "yellow";
    return "red";
  })();

  // PMP güvenilirlik kademesi — EV'ye göre tahmin ne kadar anlamlı
  const conf = getConfidenceTier(forecast.ev);
  const [pmpInfoOpen, setPmpInfoOpen] = useState(false);

  // PDF — A4 dikey, Geist font, gradient header + autoTable
  async function exportPdf() {
    if (!project) return;
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;

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

      type Row = {
        kod: string;
        ad: string;
        planBas: string;
        planBit: string;
        planSure: string;
        planPct: string;
        realBas: string;
        realBit: string;
        realSure: string;
        realPct: string;
        durum: string;
        level: number;
        isTotal?: boolean;
        statusBadge: Status["badge"];
        // Gerçekleşme %100'e ulaşmamış kalemler — "Gerç Süre" sütununa görsel işaret
        // konur ve PDF altına açıklama yazılır (ekranda kum saati ikonuyla aynı anlam).
        realOngoing: boolean;
      };
      function fmtPct(p: number): string {
        if (!p || p <= 0) return "—";
        return `${formatNumber(p * 100, 1)}%`;
      }
      const rows: Row[] = [];

      // PDF'te SADECE ekranda görünen satırlar (visible) çıkar — kullanıcının filtresine sadık kal.
      // Proje toplam üstte, sonra visible
      const projOngoing = projRealDur > 0 && projRealPct < 1;
      rows.push({
        kod: "—",
        ad: "TOPLAM PROJE",
        planBas: projPlanS ? formatDate(projPlanS) : "—",
        planBit: projPlanE ? formatDate(projPlanE) : "—",
        planSure: projPlanDur > 0 ? `${projPlanDur} g` : "—",
        planPct: fmtPct(projPlanPct),
        realBas: projRealS ? formatDate(projRealS) : "—",
        realBit: projRealE ? formatDate(projRealE) : "—",
        realSure: projRealDur > 0 ? `${projRealDur} g${projOngoing ? " •" : ""}` : "—",
        realPct: fmtPct(projRealPct),
        durum: projStatus.label,
        level: 0,
        isTotal: true,
        statusBadge: projStatus.badge,
        realOngoing: projOngoing,
      });

      for (const w of visible) {
        const planR = rangeFor(w, planned);
        const realR = rangeFor(w, realized);
        const st = statusOf(planR, realR);
        const indent = "  ".repeat(Math.max(0, w.level - 1));
        const pPct = progressFor(w, planned, filterDate).pct;
        const rPct = progressFor(w, realized, filterDate).pct;
        const ongoing = realR.duration > 0 && rPct < 1;
        rows.push({
          kod: w.code,
          ad: `${indent}${w.name}`,
          planBas: planR.start ? formatDate(planR.start) : "—",
          planBit: planR.end ? formatDate(planR.end) : "—",
          planSure: planR.duration > 0 ? `${planR.duration} g` : "—",
          planPct: fmtPct(pPct),
          realBas: realR.start ? formatDate(realR.start) : "—",
          realBit: realR.end ? formatDate(realR.end) : "—",
          realSure: realR.duration > 0 ? `${realR.duration} g${ongoing ? " •" : ""}` : "—",
          realPct: fmtPct(rPct),
          durum: st.label,
          level: w.level,
          statusBadge: st.badge,
          realOngoing: ongoing,
        });
      }

      // A4 PORTRAIT — 210 × 297 mm
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
      pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
      pdf.addFont("Geist-Regular.ttf", "Geist", "bold");
      pdf.setFont("Geist", "normal");

      const pageW = pdf.internal.pageSize.getWidth();
      const marginX = 8;
      const availW = pageW - marginX * 2;

      // ───── HEADER (BoQ tarzı profesyonel görsel — smooth gradient + rounded cards) ─────
      const headerX = marginX;
      const headerY = marginX;
      const headerW = availW;
      const headerH = 56; // biraz daha yüksek — daha rahat tipografi

      // Smooth gradient — platform yeşili: brand-700 #047857 → brand-500 #10b981
      // Pürüzsüz horizontal gradient, çizgi/şerit yok
      const strips = 240;
      const stripW = headerW / strips;
      const c1 = { r: 4, g: 120, b: 87 };    // #047857 brand-700
      const c2 = { r: 16, g: 185, b: 129 };  // #10b981 brand-500
      for (let i = 0; i < strips; i++) {
        const t = i / (strips - 1);
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        pdf.setFillColor(r, g, b);
        pdf.rect(headerX + i * stripW, headerY, stripW + 0.2, headerH, "F");
      }

      // Dekoratif daireler — header'a clip edilmiş, hafif daha koyu yeşil tonu ile
      // saydam efekt (GState ile opacity). Profesyonel "subtle highlight" hissi.
      pdf.saveGraphicsState();
      pdf.rect(headerX, headerY, headerW, headerH);
      pdf.clip();
      pdf.discardPath();

      // jsPDF v3+ GState API — opacity destekli
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfAny = pdf as any;
      const gsLight = new pdfAny.GState({ opacity: 0.18 });
      pdfAny.setGState(gsLight);

      // Büyük daire — sağ üst köşede, kısmen dışa taşar (clip ile kesilir)
      pdf.setFillColor(4, 78, 56); // brand-800 koyu yeşil; %18 opacity ile subtle
      pdf.circle(
        headerX + headerW - 4,
        headerY + 4,
        28,
        "F"
      );

      // Küçük daire — sağ alt bölgeye, kısmen dışa taşar
      pdf.setFillColor(4, 78, 56);
      pdf.circle(
        headerX + headerW * 0.78,
        headerY + headerH + 2,
        18,
        "F"
      );

      // Opacity reset
      pdfAny.setGState(new pdfAny.GState({ opacity: 1 }));
      pdf.restoreGraphicsState();

      // Sol üst rozet
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231); // çok açık yeşilimsi beyaz
      pdf.text("PLAN / GERÇEKLEŞME  ·  DURUM RAPORU", headerX + 7, headerY + 8);
      pdf.setDrawColor(220, 252, 231);
      pdf.setLineWidth(0.2);
      pdf.line(headerX + 7, headerY + 9.2, headerX + 56, headerY + 9.2);

      // Büyük proje adı
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(28);
      pdf.setTextColor(255, 255, 255);
      pdf.text(project.name, headerX + 7, headerY + 21);

      // Rapor günü (filtre tarihi)
      const aylar = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
      ];
      const fd = new Date(filterDate);
      const fdTr = `${fd.getDate()} ${aylar[fd.getMonth()]} ${fd.getFullYear()}`;
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(209, 250, 229); // soft mint
      pdf.text(`Rapor günü: ${fdTr}`, headerX + 7, headerY + 26);

      // Sağ üst — TOPLAM KALEM + büyük sayı + grup count
      const leafCount = wbs.filter((w) => w.isLeaf && !w.deletedAt).length;
      const groupCount = wbs.filter((w) => !w.isLeaf && !w.deletedAt && w.level >= 1).length;
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text("TOPLAM KALEM", headerX + headerW - 7, headerY + 8, { align: "right" });
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(32);
      pdf.setTextColor(255, 255, 255);
      pdf.text(String(leafCount), headerX + headerW - 7, headerY + 22, { align: "right" });
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(209, 250, 229);
      pdf.text(`${groupCount} grup`, headerX + headerW - 7, headerY + 27, { align: "right" });

      // Alt 4'lü rounded info kartları — koyu yeşil (header'dan koyu)
      const cardY = headerY + 32;
      const cardH = 18;
      const cardCount = 4;
      const cardGap = 2.5;
      const cardW = (headerW - 14 - cardGap * (cardCount - 1)) / cardCount;

      const cards = [
        { label: "LOKASYON", value: project.location || "—" },
        {
          label: "DC GÜÇ",
          value: project.installedCapacityMw
            ? `${project.installedCapacityMw.toFixed(2).replace(".", ",")} MWp`
            : "—",
        },
        { label: "PROJE BAŞL.", value: formatDate(project.startDate) },
        { label: "PROJE BİTİŞ", value: formatDate(project.plannedEnd) },
      ];
      cards.forEach((c, i) => {
        const cx = headerX + 7 + i * (cardW + cardGap);
        // Rounded card — koyu yeşil
        pdf.setFillColor(2, 44, 34); // #022c22 derin yeşil-siyah
        pdf.roundedRect(cx, cardY, cardW, cardH, 1.8, 1.8, "F");
        // Üst accent çizgi — emerald-300
        pdf.setDrawColor(110, 231, 183); // #6ee7b7
        pdf.setLineWidth(0.25);
        pdf.line(cx + 3, cardY + 6.5, cx + 6.5, cardY + 6.5);
        // Label
        pdf.setFont("Geist", "bold");
        pdf.setFontSize(6);
        pdf.setTextColor(167, 243, 208); // emerald-200
        pdf.text(c.label, cx + 3, cardY + 5.5);
        // Value
        pdf.setFont("Geist", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        // Uzun değerleri sığdır
        const maxW = cardW - 6;
        let val = c.value;
        const valW = pdf.getTextWidth(val);
        if (valW > maxW) {
          // font'u küçült
          let fs = 11;
          while (fs > 7 && pdf.getTextWidth(val) > maxW) {
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
      const tableStartY = headerY + headerH + 5;

      // Sütun genişlikleri — A4 portrait 194mm. Tarihler tek satıra sığsın diye 19mm.
      // Sıra: Kod | Ad | Plan(B/B/S) | Gerç(B/B/S) | Durum | Plan% | Gerçek%
      // Sum = 11 + 49 + 19+19+10 + 19+19+10 + 14 + 12 + 12 = 194
      const widths = {
        kod: 11,
        ad: 49,
        planBas: 19,
        planBit: 19,
        planSure: 10,
        realBas: 19,
        realBit: 19,
        realSure: 10,
        durum: 14,
        planPct: 12,
        realPct: 12,
      };

      autoTable(pdf, {
        startY: tableStartY,
        margin: { left: marginX, right: marginX, top: marginX, bottom: 10 },
        head: [
          [
            { content: "Kod", rowSpan: 2 },
            { content: "Ad", rowSpan: 2 },
            {
              content: "PLANLAMA",
              colSpan: 3,
              // brand-700 koyu yeşil
              styles: { halign: "center", fillColor: [4, 120, 87] },
            },
            {
              content: "GERÇEKLEŞME",
              colSpan: 3,
              // brand-500 açık yeşil — Plan'dan ayrılır ama platformla uyumlu
              styles: { halign: "center", fillColor: [16, 185, 129] },
            },
            { content: "Durum", rowSpan: 2 },
            {
              content: "Plan%",
              rowSpan: 2,
              styles: { halign: "right", fillColor: [4, 120, 87] },
            },
            {
              content: "Gerçek%",
              rowSpan: 2,
              styles: { halign: "right", fillColor: [16, 185, 129] },
            },
          ],
          ["Başl.", "Bitiş", "Süre", "Başl.", "Bitiş", "Süre"],
        ],
        body: rows.map((r) => [
          r.kod,
          r.ad,
          r.planBas,
          r.planBit,
          r.planSure,
          r.realBas,
          r.realBit,
          r.realSure,
          r.durum,
          r.planPct,
          r.realPct,
        ]),
        styles: {
          font: "Geist",
          fontSize: 6.5,
          cellPadding: { top: 1.2, right: 1.2, bottom: 1.2, left: 1.2 },
          overflow: "linebreak",
          valign: "middle",
          lineColor: [220, 220, 230],
          lineWidth: 0.1,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: widths.kod, fontStyle: "bold", halign: "left", fontSize: 6, overflow: "visible" },
          1: { cellWidth: widths.ad, halign: "left", overflow: "linebreak" },
          // Tarih sütunları — tek satır, taşmasın
          2: { cellWidth: widths.planBas, halign: "center", overflow: "visible" },
          3: { cellWidth: widths.planBit, halign: "center", overflow: "visible" },
          4: { cellWidth: widths.planSure, halign: "right", overflow: "visible" },
          5: { cellWidth: widths.realBas, halign: "center", overflow: "visible" },
          6: { cellWidth: widths.realBit, halign: "center", overflow: "visible" },
          7: { cellWidth: widths.realSure, halign: "right", overflow: "visible" },
          8: { cellWidth: widths.durum, halign: "center", fontStyle: "bold", fontSize: 6, overflow: "visible" },
          9: { cellWidth: widths.planPct, halign: "right", fontStyle: "bold", overflow: "visible" },
          10: { cellWidth: widths.realPct, halign: "right", fontStyle: "bold", overflow: "visible" },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const row = rows[data.row.index];
          if (!row) return;
          if (row.isTotal) {
            // Toplam proje — brand-800 koyu yeşil, beyaz yazı
            data.cell.styles.fillColor = [6, 78, 59];
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 7.5;
          } else if (row.level === 1) {
            // L1 — açık yeşil zemin, brand-700 yazı
            data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
            data.cell.styles.textColor = [4, 120, 87];     // brand-700
            data.cell.styles.fontStyle = "bold";
          } else if (row.level === 2) {
            // L2 — daha açık yeşil, brand-600 yazı
            data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
            data.cell.styles.textColor = [5, 150, 105];   // brand-600
            data.cell.styles.fontStyle = "bold";
          }
          // Durum sütunu artık index 8 (yeni sıralamada)
          if (data.column.index === 8 && !row.isTotal) {
            if (row.statusBadge === "ok") {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = [22, 101, 52];
            } else if (row.statusBadge === "early") {
              data.cell.styles.fillColor = [219, 234, 254];
              data.cell.styles.textColor = [30, 64, 175];
            } else if (row.statusBadge === "warn") {
              data.cell.styles.fillColor = [254, 249, 195];
              data.cell.styles.textColor = [161, 98, 7];
            } else if (row.statusBadge === "late") {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [185, 28, 28];
            }
          }
          // Gerç Süre sütunu (index 7) — devam eden işlerde sarı vurgu
          if (data.column.index === 7 && row.realOngoing && !row.isTotal) {
            data.cell.styles.fillColor = [254, 249, 195]; // yellow-100
            data.cell.styles.textColor = [161, 98, 7];   // yellow-700
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawCell: (data) => {
          // Plan% kolonunun sol kenarına (Durum / % ayrımı) ince accent çizgi.
          // didParseCell ile lineColor değiştirmek tüm 4 kenarı koyulaştırıyordu;
          // burada sadece SOL tarafa çiziyoruz, alt çizgi normal kalıyor.
          if (data.column.index === 9) {
            const { x, y, height } = data.cell;
            pdf.setDrawColor(5, 150, 105); // brand-600 #059669
            pdf.setLineWidth(0.5);
            pdf.line(x, y, x, y + height);
            // Restore defaults
            pdf.setDrawColor(220, 220, 230);
            pdf.setLineWidth(0.1);
          }
        },
        // Sayfa numarası burada YAZILMAZ — autoTable bittikten sonra toplam sayfa
        // sayısı kesinleştiği için tek seferde basıyoruz (1/N, 2/N … N/N).
      });

      // ─── Sayfa numaraları (1/N, 2/N …) ───
      {
        const totalPages = pdf.getNumberOfPages();
        const pageH = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFont("Geist", "normal");
          pdf.setFontSize(7.5);
          pdf.setTextColor(140, 140, 140);
          pdf.text(
            `${project.name}   ·   sayfa ${i}/${totalPages}`,
            marginX,
            pageH - 5
          );
        }
        pdf.setTextColor(0, 0, 0);
      }

      // ─── Tablonun altına işaret açıklaması ───
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastTable = (pdf as any).lastAutoTable;
      if (lastTable && typeof lastTable.finalY === "number") {
        const legendY = lastTable.finalY + 5;
        const pageH = pdf.internal.pageSize.getHeight();
        if (legendY < pageH - 12) {
          pdf.setFont("Geist", "bold");
          pdf.setFontSize(7);
          pdf.setTextColor(161, 98, 7);
          pdf.text("•", marginX, legendY);
          pdf.setFont("Geist", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(90, 90, 90);
          pdf.text(
            "  Gerçekleşme · Süre sütunundaki bu işaret, kalemin gerçekleşme yüzdesi henüz %100 olmadığını — işin hâlâ devam ettiğini gösterir.",
            marginX + 2,
            legendY
          );
        }
      }

      const fname = `${project.name.replace(/\s+/g, "-")}-PlanGerceklesme-${toISODate(new Date())}.pdf`;
      pdf.save(fname);
      toast("PDF indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Plan / Gerçekleşme Özeti"
        description="Her iş kalemi için planlanan ve gerçekleşen başlangıç/bitiş tarihleri ve süre."
        icon={CheckCircle2}
        actions={
          <Button variant="accent" onClick={exportPdf}>
            <FileDown size={14} /> PDF İndir
          </Button>
        }
      />

      {/* EVM Performans Kartı — PMP standardı schedule-EVM */}
      <Card className="!p-0 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-gradient-to-r from-purple/8 to-transparent flex-wrap">
          <CheckCircle2 size={16} className="text-purple" />
          <h3 className="font-display font-bold text-base text-text">
            Performansı (EVM) — {scopedData.label} · {formatDate(filterDate)} itibarıyla
          </h3>
          {/* Güvenilirlik rozeti */}
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
              conf.badgeColor === "red" && "bg-red/15 text-red",
              conf.badgeColor === "yellow" && "bg-yellow/20 text-yellow",
              conf.badgeColor === "blue" && "bg-blue/15 text-blue",
              conf.badgeColor === "green" && "bg-green/15 text-green",
              conf.badgeColor === "gray" && "bg-bg2 text-text3"
            )}
            title={conf.description}
          >
            {conf.tier === "very-low" || conf.tier === "low" ? "⚠ " : ""}
            {conf.label} · EV %{(forecast.ev * 100).toFixed(1)}
          </span>
          {/* PMP not linki */}
          <button
            onClick={() => setPmpInfoOpen(true)}
            className="text-[11px] text-accent font-semibold hover:underline inline-flex items-center gap-1"
            title="PMP / EVM güvenilirlik kademeleri ve Christensen örneği"
          >
            <AlertTriangle size={11} /> Not: PMP nasıl yorumlar?
          </button>
        </div>

        {/* SCOPE SEKMELER — Proje + L1 ana başlıklar */}
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-bg2/60 to-transparent">
          <div className="flex items-center gap-3 min-w-max overflow-x-auto">
            <span className="text-[9.5px] font-bold uppercase tracking-widest text-text3 shrink-0">
              Kapsam
            </span>

            {/* Proje Toplam — platform yeşili, sade */}
            <button
              type="button"
              onClick={(e) => {
                setEvmScope("project");
                e.currentTarget.blur();
              }}
              className={cn(
                "inline-flex items-center gap-2 pl-3 pr-4 h-10 rounded-lg whitespace-nowrap transition-colors duration-150 outline-none focus:outline-none",
                evmScope === "project"
                  ? "bg-gradient-to-r from-accent/85 to-accent text-white shadow-soft"
                  : "bg-white text-text2 border-2 border-border hover:border-accent/40 hover:text-accent"
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center size-6 rounded-md",
                  evmScope === "project" ? "bg-white/20 text-white" : "bg-bg2 text-text3"
                )}
              >
                <LayoutDashboard size={13} />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider">
                Proje Toplam
              </span>
            </button>

            {/* Ayraç — projeyi L1'lerden görsel olarak ayırır */}
            <div className="self-stretch w-px bg-border mx-1" />

            <span className="text-[9.5px] font-bold uppercase tracking-widest text-text3 shrink-0">
              Ana Başlıklar
            </span>

            {/* L1 ana başlıklar — kompakt segmented control */}
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-bg2 border border-border">
              {l1Sections.map((sec) => {
                const isActive = evmScope === sec.code;
                return (
                  <button
                    key={sec.code}
                    type="button"
                    onClick={(e) => {
                      setEvmScope(sec.code);
                      e.currentTarget.blur();
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md whitespace-nowrap transition-colors duration-150 text-[11px] outline-none focus:outline-none",
                      isActive
                        ? "bg-white text-accent shadow-soft font-bold border border-accent/30"
                        : "border border-transparent text-text2 hover:text-text hover:bg-white/60 font-semibold"
                    )}
                    title={`${sec.code} · ${sec.name}`}
                  >
                    <FolderKanban
                      size={11}
                      className={cn(isActive ? "text-accent" : "text-text3")}
                    />
                    <span
                      className={cn(
                        "font-mono text-[10px] px-1 py-0.5 rounded",
                        isActive ? "bg-accent/10 text-accent" : "bg-bg3 text-text3"
                      )}
                    >
                      {sec.code}
                    </span>
                    <span className="max-w-[160px] truncate align-bottom">{sec.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
          <EvmKpi
            label="PV — Planlanan"
            value={`${(forecast.pv * 100).toFixed(1)}%`}
            sub="Bu tarihe kadar planda"
            tone="blue"
          />
          <EvmKpi
            label="EV — Gerçekleşen"
            value={`${(forecast.ev * 100).toFixed(1)}%`}
            sub="Kazanılan değer"
            tone="green"
          />
          <EvmKpi
            label="SV — Sapma"
            value={`${forecast.sv >= 0 ? "+" : ""}${(forecast.sv * 100).toFixed(1)}%`}
            sub={forecast.sv >= 0 ? "Önde / zamanında" : "Geride"}
            tone={forecast.sv >= 0 ? "green" : "red"}
          />
          <EvmKpi
            label="SPI"
            value={forecast.spi != null ? forecast.spi.toFixed(2) : "—"}
            sub={
              forecast.spi == null
                ? "Henüz başlamadı"
                : forecast.spi >= 1
                  ? "1.00+ önde"
                  : forecast.spi >= 0.95
                    ? "Eşik içinde"
                    : forecast.spi >= 0.85
                      ? "Dikkat"
                      : "Kritik"
            }
            tone={spiTone}
          />
          <EvmKpi
            label="Tahmini Bitiş"
            value={conf.hideValues || !forecast.forecastEnd ? "—" : formatDate(forecast.forecastEnd)}
            sub={
              conf.hideValues
                ? `Yetersiz veri (EV %${(forecast.ev * 100).toFixed(1)})`
                : `Plan: ${formatDate(scopedData.endDate)}`
            }
            tone={
              conf.hideValues || forecast.forecastEnd == null
                ? "gray"
                : forecast.deltaDays <= 0
                  ? "green"
                  : forecast.deltaDays <= 7
                    ? "yellow"
                    : "red"
            }
          />
          <EvmKpi
            label="Sapma (gün)"
            value={
              conf.hideValues || forecast.forecastEnd == null
                ? "—"
                : `${forecast.deltaDays >= 0 ? "+" : ""}${forecast.deltaDays} gün`
            }
            sub={
              conf.hideValues
                ? "Yetersiz veri"
                : forecast.forecastEnd == null
                  ? "—"
                  : forecast.deltaDays <= 0
                    ? "Zamanında / erken"
                    : "Geç bitecek"
            }
            tone={
              conf.hideValues || forecast.forecastEnd == null
                ? "gray"
                : forecast.deltaDays <= 0
                  ? "green"
                  : forecast.deltaDays <= 7
                    ? "yellow"
                    : "red"
            }
          />
        </div>

        {/* S-curve grafik */}
        <div className="px-4 pb-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2 flex items-center gap-2">
            <span>S-Eğrisi: Plan / Gerçek / Tahmin</span>
            <span className="text-text3 normal-case font-normal">
              · Dikey çizgi rapor günü
            </span>
          </div>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart
                data={forecastCurve.points}
                margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickFormatter={(d) => formatDate(d as string)}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                  minTickGap={40}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    fontSize: 11,
                    boxShadow: "0 10px 24px -8px rgba(15, 23, 42, 0.12)",
                    padding: "8px 12px",
                  }}
                  labelFormatter={(d) => formatDate(d as string)}
                  formatter={(v, name) => [
                    typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)}%` : "—",
                    name === "pv" ? "Plan (PV)" : name === "ev" ? "Gerçek (EV)" : "Tahmin",
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#475569", paddingTop: 8, fontWeight: 600 }}
                  formatter={(v) =>
                    v === "pv" ? "Plan (PV)" : v === "ev" ? "Gerçek (EV)" : "Tahmin"
                  }
                />
                <ReferenceLine
                  x={filterDate}
                  stroke="#64748b"
                  strokeDasharray="4 3"
                  label={makeVerticalLabel("Rapor günü", "#64748b", "middle")}
                />
                <ReferenceLine
                  x={scopedData.endDate}
                  stroke="#3b82f6"
                  strokeDasharray="2 2"
                  label={makeVerticalLabel("Planlanan Bitiş", "#3b82f6", "bottom")}
                />
                {conf.showForecast && forecast.forecastEnd && forecast.forecastEnd !== scopedData.endDate && (
                  <ReferenceLine
                    x={forecast.forecastEnd}
                    stroke="#f97316"
                    strokeDasharray="2 2"
                    strokeOpacity={conf.forecastOpacity}
                    label={makeVerticalLabel("Tahmini Bitiş", "#f97316", "bottom")}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="pv"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="pv"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="ev"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  dot={false}
                  name="ev"
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {conf.showForecast && (
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    strokeOpacity={conf.forecastOpacity}
                    dot={false}
                    name="forecast"
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-gradient-to-r from-blue/8 to-transparent flex-wrap">
          <ListChecks size={16} className="text-blue" />
          <h3 className="font-display font-bold text-base text-text">Özet</h3>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const s = new Set<string>();
                for (const w of wbs) if (!w.isLeaf && !w.deletedAt) s.add(w.code);
                setSummaryExpanded(s);
              }}
            >
              Tümünü Aç
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSummaryExpanded(new Set())}>
              Tümünü Kapat
            </Button>
          </div>
        </div>
        {/* Açıklama notu — hesaplama yöntemi */}
        <div className="px-4 py-2 bg-blue/5 border-b border-blue/15 text-[11px] text-text2 flex items-start gap-2">
          <ListChecks size={11} className="text-blue shrink-0 mt-0.5" />
          <span>
            <strong>Hesaplama:</strong> Yaprak (kalem) seviyesinde{" "}
            <strong>Plan%</strong> ve <strong>Gerçek%</strong> kendi zaman serisinde kümülatif
            değer / toplam olarak hesaplanır — ağırlık dikkate alınmaz. Başlıklar (alt, ana) ve
            Toplam Proje için WBS'de tanımlı <strong>ağırlıklara göre</strong> toplam plan
            ilerleme ve toplam gerçek ilerleme hesaplanır (PMP standart yöntemi).
            {" "}
            <span className="inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-yellow/15 text-yellow font-semibold">
              <Hourglass size={10} /> işareti
            </span>
            {" "}
            Gerçekleşme · Süre sütununda görünür; bu kalemin gerçekleşme yüzdesi henüz{" "}
            <strong>%100'e ulaşmadığını</strong>, yani işin hâlâ devam ettiğini gösterir.
          </span>
        </div>
        {/* TARİH FİLTRE BANDI — sadece Plan%/Gerçek% sütunlarını etkiler */}
        {(() => {
          const filterMin = project.startDate;
          const filterMax = project.plannedEnd;
          const clamp = (d: string) =>
            d < filterMin ? filterMin : d > filterMax ? filterMax : d;
          const shift = (delta: number) => {
            const dt = new Date(filterDate);
            dt.setDate(dt.getDate() + delta);
            setFilterDate(clamp(toISODate(dt)));
          };
          const canPrev = filterDate > filterMin;
          const canNext = filterDate < filterMax;
          const today = toISODate(new Date());
          const todayInRange = today >= filterMin && today <= filterMax;
          const isToday = filterDate === today;
          return (
            <div className="px-4 py-2.5 border-b border-border bg-gradient-to-r from-accent/5 via-white to-accent/5 flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-accent">
                <CalendarDays size={12} />
                Rapor Günü
              </div>
              <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white border border-accent/30 shadow-soft">
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  disabled={!canPrev}
                  title={canPrev ? "Önceki gün" : "Proje başlangıcındasın"}
                  className="size-6 rounded inline-flex items-center justify-center text-text2 hover:bg-accent/10 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={13} />
                </button>
                <input
                  type="date"
                  value={filterDate}
                  min={filterMin}
                  max={filterMax}
                  onChange={(e) => setFilterDate(clamp(e.target.value))}
                  className="h-6 px-2 text-xs font-mono font-bold text-text rounded bg-transparent focus:outline-none w-36"
                />
                <button
                  type="button"
                  onClick={() => shift(1)}
                  disabled={!canNext}
                  title={canNext ? "Sonraki gün" : "Proje bitişindesin"}
                  className="size-6 rounded inline-flex items-center justify-center text-text2 hover:bg-accent/10 hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
              {/* Bugün toggle */}
              <button
                type="button"
                onClick={(e) => {
                  if (todayInRange) setFilterDate(today);
                  e.currentTarget.blur();
                }}
                disabled={!todayInRange}
                title={
                  !todayInRange
                    ? "Bugün proje aralığı dışında"
                    : isToday
                      ? "Zaten bugündesin"
                      : "Bugüne git"
                }
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 h-7 rounded-md text-[11px] font-bold transition-all outline-none",
                  isToday
                    ? "bg-accent text-white shadow-soft"
                    : "bg-white text-accent border border-accent/40 hover:bg-accent/10",
                  !todayInRange && "opacity-40 cursor-not-allowed"
                )}
              >
                Bugün
              </button>
              {/* Sadece % sütunları vurgusu */}
              <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-text2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent font-bold uppercase tracking-wider text-[9px]">
                  Etkiler
                </span>
                <span>
                  Sadece <strong className="text-accent">Plan%</strong> ve{" "}
                  <strong className="text-realized">Gerçek%</strong> sütunlarını değiştirir.
                  Başlangıç / Bitiş / Süre değişmez.
                </span>
              </span>
            </div>
          );
        })()}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bg2 text-text2">
              <tr className="text-[10px] uppercase tracking-wider font-bold">
                <th rowSpan={2} className="px-3 py-2 text-left w-24 border-r border-border">
                  Kod
                </th>
                <th rowSpan={2} className="px-3 py-2 text-left border-r-2 border-border2">
                  Ad
                </th>
                <th
                  colSpan={3}
                  className="px-3 py-1.5 text-center border-r-2 border-border2 bg-accent/10 text-accent"
                >
                  Planlama
                </th>
                <th
                  colSpan={3}
                  className="px-3 py-1.5 text-center border-r-2 border-border2 bg-realized/10 text-realized"
                >
                  Gerçekleşme
                </th>
                <th rowSpan={2} className="px-3 py-2 text-center w-24 border-r-2 border-r-accent/50">
                  Durum
                </th>
                <th rowSpan={2} className="px-3 py-2 text-right w-20 bg-accent/5 text-accent">
                  Plan%
                </th>
                <th rowSpan={2} className="px-3 py-2 text-right w-20 bg-realized/5 text-realized">
                  Gerçek%
                </th>
              </tr>
              <tr className="text-[10px] uppercase tracking-wider font-bold">
                <th className="px-3 py-1.5 text-left w-28 bg-accent/5">Başlangıç</th>
                <th className="px-3 py-1.5 text-left w-28 bg-accent/5">Bitiş</th>
                <th className="px-3 py-1.5 text-right w-20 bg-accent/5 border-r-2 border-border2">
                  Süre
                </th>
                <th className="px-3 py-1.5 text-left w-28 bg-realized/5">Başlangıç</th>
                <th className="px-3 py-1.5 text-left w-28 bg-realized/5">Bitiş</th>
                <th className="px-3 py-1.5 text-right w-20 bg-realized/5 border-r-2 border-border2">
                  Süre
                </th>
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-text3">
                    Hiç WBS satırı yok.
                  </td>
                </tr>
              ) : (
                <>
                  {/* Toplam Proje satırı */}
                  <tr className="border-t border-border bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb] text-white">
                    <td className="px-3 py-2 font-mono text-[10px] text-white/70 whitespace-nowrap">—</td>
                    <td className="px-3 py-2 border-r-2 border-white/20">
                      <span className="font-display font-extrabold uppercase tracking-wider text-[13px]">
                        Toplam Proje
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold">
                      {projPlanS ? formatDate(projPlanS) : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold">
                      {projPlanE ? formatDate(projPlanE) : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono border-r-2 border-white/20">
                      {projPlanDur > 0 ? (
                        <span className="font-extrabold">
                          {projPlanDur} <span className="text-white/70 font-normal text-[10px]">gün</span>
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold">
                      {projRealS ? formatDate(projRealS) : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold">
                      {projRealE ? formatDate(projRealE) : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono border-r-2 border-white/20">
                      {projRealDur > 0 ? (
                        <span className="inline-flex items-center gap-1 font-extrabold">
                          {projRealPct < 1 && (
                            <Hourglass
                              size={11}
                              className="text-yellow-300"
                              aria-label="Devam ediyor"
                            />
                          )}
                          <span>
                            {projRealDur} <span className="text-white/70 font-normal text-[10px]">gün</span>
                          </span>
                        </span>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-[11px] border-r-2 border-r-accent/50">
                      {projStatus.badge === "ok" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green/20 text-green">
                          ✓ {projStatus.label}
                        </span>
                      )}
                      {projStatus.badge === "early" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue/20 text-blue">
                          ◂ {projStatus.label}
                        </span>
                      )}
                      {projStatus.badge === "warn" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow/30 text-yellow font-bold">
                          ⚠ {projStatus.label}
                        </span>
                      )}
                      {projStatus.badge === "late" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red/30 text-red font-bold">
                          ⚠ {projStatus.label}
                        </span>
                      )}
                      {projStatus.badge === "—" && (
                        <span className="text-white/40">{projStatus.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold">
                      {formatNumber(projPlanPct * 100, 1)}<span className="text-white/70 font-normal">%</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold">
                      {formatNumber(projRealPct * 100, 1)}<span className="text-white/70 font-normal">%</span>
                    </td>
                  </tr>

                  {visible.map((w) => {
                    const planR = rangeFor(w, planned);
                    const realR = rangeFor(w, realized);
                    const planPctRow = progressFor(w, planned, filterDate).pct;
                    const realPctRow = progressFor(w, realized, filterDate).pct;
                    const isOpen = summaryExpanded.has(w.code);
                    const hasChildren =
                      !w.isLeaf && all.some((c) => c.code.startsWith(w.code + "."));
                    const rowBg =
                      w.level === 1
                        ? "bg-accent/10"
                        : w.level === 2
                        ? "bg-blue/8"
                        : "bg-white";
                    const textCls =
                      w.level === 1
                        ? "text-accent font-extrabold uppercase tracking-wide text-[13px]"
                        : w.level === 2
                        ? "text-blue font-bold text-[12px]"
                        : "text-text font-normal";
                    const indentPx = Math.max(0, w.level - 1) * 16;
                    const st = statusOf(planR, realR);

                    return (
                      <tr key={w.id} className={cn("border-t border-border", rowBg)}>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-text3 whitespace-nowrap border-r border-border/50">
                          {w.code}
                        </td>
                        <td className="px-3 py-1.5 border-r-2 border-border2">
                          <div
                            className={cn("flex items-center gap-1", textCls)}
                            style={{ paddingLeft: `${indentPx}px` }}
                          >
                            {hasChildren ? (
                              <button
                                onClick={() =>
                                  setSummaryExpanded((s) => {
                                    const n = new Set(s);
                                    if (n.has(w.code)) n.delete(w.code);
                                    else n.add(w.code);
                                    return n;
                                  })
                                }
                                className="w-4 h-4 rounded hover:bg-bg3 flex items-center justify-center shrink-0"
                              >
                                <ChevronRight
                                  size={11}
                                  className={cn("transition-transform", isOpen && "rotate-90")}
                                />
                              </button>
                            ) : (
                              <span className="w-4 shrink-0" />
                            )}
                            <span className="truncate">{w.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">
                          {planR.start ? formatDate(planR.start) : <span className="text-text3">—</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">
                          {planR.end ? formatDate(planR.end) : <span className="text-text3">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums border-r-2 border-border2">
                          {planR.duration > 0 ? (
                            <span
                              className={cn(
                                "font-semibold",
                                w.level === 1 ? "text-accent" : w.level === 2 ? "text-blue" : ""
                              )}
                            >
                              {planR.duration}{" "}
                              <span className="text-text3 font-normal text-[10px]">gün</span>
                            </span>
                          ) : (
                            <span className="text-text3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">
                          {realR.start ? formatDate(realR.start) : <span className="text-text3">—</span>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-[11px]">
                          {realR.end ? formatDate(realR.end) : <span className="text-text3">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums border-r-2 border-border2">
                          {realR.duration > 0 ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-realized">
                              {realPctRow < 1 && (
                                <Hourglass
                                  size={10}
                                  className="text-yellow"
                                  aria-label="Devam ediyor — gerçekleşme henüz %100 değil"
                                />
                              )}
                              <span>
                                {realR.duration}{" "}
                                <span className="text-text3 font-normal text-[10px]">gün</span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-text3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center border-r-2 border-r-accent/50">
                          {st.badge === "ok" && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green/15 text-green text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                          {st.badge === "early" && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue/15 text-blue text-[10px] font-bold"
                              title={st.label}
                            >
                              ◂ {st.label}
                            </span>
                          )}
                          {st.badge === "warn" && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow/20 text-yellow text-[10px] font-bold"
                              title={st.label}
                            >
                              <AlertTriangle size={10} /> {st.label}
                            </span>
                          )}
                          {st.badge === "late" && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red/20 text-red text-[10px] font-bold"
                              title={st.label}
                            >
                              <AlertTriangle size={10} /> {st.label}
                            </span>
                          )}
                          {st.badge === "—" && (
                            <span className="text-text3 text-[10px]">{st.label}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {planPctRow > 0 ? (
                            <span className={cn("font-bold", w.level === 1 ? "text-accent" : "text-text2")}>
                              {formatNumber(planPctRow * 100, 1)}
                              <span className="text-text3 font-normal">%</span>
                            </span>
                          ) : (
                            <span className="text-text3">—</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                          {realPctRow > 0 ? (
                            <span className="font-bold text-realized">
                              {formatNumber(realPctRow * 100, 1)}
                              <span className="text-text3 font-normal">%</span>
                            </span>
                          ) : (
                            <span className="text-text3">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PMP / Christensen açıklama dialog */}
      <Dialog
        open={pmpInfoOpen}
        onClose={() => setPmpInfoOpen(false)}
        title="PMP / EVM — Tahmin Güvenilirliği"
        size="lg"
      >
        <div className="space-y-4 text-sm text-text2 leading-relaxed">
          <p>
            EVM (Earned Value Management) tahminlerinin güvenilirliği projenin{" "}
            <strong>ne kadar ilerlemiş olduğuna</strong> bağlıdır. PMP/PMBOK ve EVM standartları
            (ANSI EIA-748), erken aşamada SPI/CPI'nin büyük dalgalanmalar gösterdiğini ve
            tahminlerin güvenilir olmadığını söyler.
          </p>

          <div>
            <h4 className="font-display font-bold text-text mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow" />
              Christensen (1993) — Stabilizasyon Noktası
            </h4>
            <p className="text-[13px]">
              David Christensen'in PM araştırmaları, yüzlerce askeri ve sivil projeyi inceleyerek
              gösterdi ki: <strong>proje %15–%20 tamamlanana kadar SPI/CPI dalgalanır</strong>,
              tahminler güvensizdir. <strong>%20 sonrası</strong> bu metrikler stabilize olur ve
              proje sonuna kadar genelde ±10% bandında kalır. Bu yüzden EVM literatüründe
              <strong> %20 "stabilizasyon eşiği"</strong> kabul edilir.
            </p>
          </div>

          <div>
            <h4 className="font-display font-bold text-text mb-2">Pratik Örnek</h4>
            <p className="text-[13px]">
              Diyelim 100 günlük proje. 5. gün: planda %5 olmalıydı, gerçekleşen %1.{" "}
              <strong>SPI = 0.20</strong>. Saf matematikle: tahmini süre = 100 / 0.20 ={" "}
              <strong>500 gün</strong>. Yani <strong>"proje 400 gün geç bitecek"</strong> deriz.
              Ama bu saçma — proje daha mobilizasyondayken bu rakamı kimse ciddiye almaz.
              <br /> <br />
              Aynı proje 25. gün: %25 planda, %20 gerçek → SPI 0.80. Tahmini: 125 gün, gecikme 25
              gün. Bu artık <strong>anlamlı bir uyarı</strong>.
            </p>
          </div>

          <div>
            <h4 className="font-display font-bold text-text mb-2">Güvenilirlik Kademeleri</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-bg2 text-text2">
                  <tr className="text-[10px] uppercase tracking-wider font-bold">
                    <th className="px-3 py-2 text-left">EV %</th>
                    <th className="px-3 py-2 text-left">Kademe</th>
                    <th className="px-3 py-2 text-left">Yorum</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 font-mono font-bold">&lt; %5</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-bg2 text-text3 text-[10px] font-bold uppercase">
                        Yetersiz veri
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text3">
                      Tahmin yapılmaz. KPI'lar "—" gösterir. Tahmin çizgisi grafikten gizlenir.
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-red/5">
                    <td className="px-3 py-2 font-mono font-bold">%5 – %15</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red/15 text-red text-[10px] font-bold uppercase">
                        ⚠ Çok düşük
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text3">
                      Tahmin gösterilir ama soluk. SPI günlük dalgalanır. Yön bilgisi bile sayma.
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-yellow/5">
                    <td className="px-3 py-2 font-mono font-bold">%15 – %20</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow/20 text-yellow text-[10px] font-bold uppercase">
                        ⚠ Düşük
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text3">
                      Tahmin yön belirtir, kesin tarih sayma. Eşiğe yaklaşılıyor.
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-blue/5">
                    <td className="px-3 py-2 font-mono font-bold">%20 – %50</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue/15 text-blue text-[10px] font-bold uppercase">
                        Orta
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text3">
                      Christensen stabilizasyon eşiği aşıldı. Tahmin makul güvenilir.
                    </td>
                  </tr>
                  <tr className="border-t border-border bg-green/5">
                    <td className="px-3 py-2 font-mono font-bold">&gt; %50</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green/15 text-green text-[10px] font-bold uppercase">
                        Yüksek
                      </span>
                    </td>
                    <td className="px-3 py-2 text-text3">
                      Tahmin oldukça stabil. EVM literatürüne göre güvenilir.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-bg2/60 rounded-lg p-3 text-[12px] text-text2">
            <strong className="text-text">Özet:</strong> Bu sayfada gördüğün rozet (
            <span className="px-1.5 py-0.5 rounded bg-yellow/20 text-yellow text-[10px] font-bold">
              ⚠ Düşük güvenilirlik
            </span>{" "}
            gibi) projenin hangi kademede olduğunu söyler. Tahmini bitiş + sapma KPI'ları{" "}
            <strong>%5'in altında "—"</strong> olarak gösterilir, %5–%20 arası rakam verilir ama
            uyarıyla. PMP eşiği olan <strong>%20'ye ulaşınca</strong> tahmin gerçekten anlamlı
            olur.
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────
// EVM KPI kartı — küçük, renkli tonlu

const EVM_TONE: Record<string, { bg: string; text: string; ring: string }> = {
  blue:   { bg: "bg-blue/10",   text: "text-blue",   ring: "ring-blue/20" },
  green:  { bg: "bg-green/10",  text: "text-green",  ring: "ring-green/20" },
  yellow: { bg: "bg-yellow/15", text: "text-yellow", ring: "ring-yellow/30" },
  red:    { bg: "bg-red/10",    text: "text-red",    ring: "ring-red/20" },
  gray:   { bg: "bg-bg2",       text: "text-text3",  ring: "ring-border" },
};

function EvmKpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof EVM_TONE;
}) {
  const t = EVM_TONE[tone];
  return (
    <div className={cn("rounded-lg p-3 ring-1", t.bg, t.ring)}>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">
        {label}
      </div>
      <div className={cn("font-mono text-[20px] font-extrabold tabular-nums leading-none", t.text)}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-text3 mt-1.5 leading-tight">{sub}</div>
      )}
    </div>
  );
}
