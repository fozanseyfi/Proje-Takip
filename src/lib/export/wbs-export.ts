/**
 * WBS Excel + PDF dışa aktarma yardımcıları.
 * Excel: xlsx (SheetJS) — başlık satırları renkli, kolon genişlikleri ayarlı.
 * PDF: html2canvas-pro + jsPDF üzerinden seviye bazlı renkli + bold tasarım.
 */

import * as XLSX from "xlsx";
import { formatDate, toISODate } from "@/lib/utils";
import type { WbsItem } from "@/lib/store/types";
import type { HierarchicalWeight } from "@/lib/calc/sections";
import { loadingOverlay } from "@/lib/ui-loading";

const DISCIPLINE_LABEL: Record<string, string> = {
  mekanik: "Mekanik",
  elektrik: "Elektrik",
  insaat: "İnşaat",
  muhendislik: "Mühendislik",
  idari: "İdari",
  diger: "Diğer",
};

function levelName(level: number): string {
  switch (level) {
    case 0:
      return "Proje";
    case 1:
      return "Ana Başlık";
    case 2:
      return "Alt Başlık";
    case 3:
      return "İş Kalemi";
    default:
      return "—";
  }
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "_").trim() || "proje";
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// EXCEL ÇIKTI — başlıklı, renkli, kolon genişlikleri ayarlı
// ============================================================
export function exportWbsToExcel(
  projectName: string,
  rows: WbsItem[],
  hierarchical: Map<string, HierarchicalWeight>
): void {
  loadingOverlay.start("WBS Excel hazırlanıyor");
  try {
    _renderWbsToExcel(projectName, rows, hierarchical);
  } finally {
    loadingOverlay.stop();
  }
}

function _renderWbsToExcel(
  projectName: string,
  rows: WbsItem[],
  hierarchical: Map<string, HierarchicalWeight>
): void {
  const data = rows.map((w) => {
    const h = hierarchical.get(w.code);
    const finalPct = h ? h.finalPct * 100 : 0;
    const localPct = h ? h.localPct * 100 : 0;
    return {
      "Kod": w.code,
      "Seviye": `L${w.level}`,
      "Tip": levelName(w.level),
      "Ad": w.name,
      "Disiplin": w.discipline ? DISCIPLINE_LABEL[w.discipline] ?? w.discipline : "",
      "Miktar": w.isLeaf ? w.quantity : "",
      "Birim": w.isLeaf ? w.unit : "",
      "Yerel %": w.isLeaf || w.level === 0 ? "" : Number(localPct.toFixed(2)),
      "Proje %": Number(finalPct.toFixed(2)),
      "Yaprak": w.isLeaf ? "✓" : "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);

  ws["!cols"] = [
    { wch: 12 },
    { wch: 8 },
    { wch: 12 },
    { wch: 50 },
    { wch: 14 },
    { wch: 10 },
    { wch: 8 },
    { wch: 9 },
    { wch: 9 },
    { wch: 8 },
  ];

  const headers = Object.keys(data[0] ?? {});
  headers.forEach((h, i) => {
    void h;
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: i });
    const cell = ws[cellAddr];
    if (cell) {
      (cell as XLSX.CellObject & { s?: unknown }).s = {
        font: { bold: true, color: { rgb: "FFFFFFFF" } },
        fill: { fgColor: { rgb: "FF1E40AF" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  });

  data.forEach((row, idx) => {
    void row;
    const rowIdx = idx + 1;
    const lvl = rows[idx]?.level ?? 3;
    const tipCell = XLSX.utils.encode_cell({ r: rowIdx, c: 2 });
    const cell = ws[tipCell];
    if (cell) {
      const colorMap: Record<number, string> = {
        0: "FFE5E7EB",
        1: "FFDBEAFE",
        2: "FFE9D5FF",
        3: "FFD1FAE5",
      };
      (cell as XLSX.CellObject & { s?: unknown }).s = {
        fill: { fgColor: { rgb: colorMap[lvl] ?? "FFFFFFFF" } },
        font: { bold: lvl <= 2 },
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "WBS");

  // Top 15 özet sayfası
  const leafs = rows.filter((w) => w.isLeaf);
  const top15 = leafs
    .map((w) => ({
      item: w,
      finalPct: (hierarchical.get(w.code)?.finalPct ?? 0) * 100,
    }))
    .sort((a, b) => b.finalPct - a.finalPct)
    .slice(0, 15);

  const summaryData = top15.map((r, i) => ({
    "Sıra": i + 1,
    "Kod": r.item.code,
    "Ad": r.item.name,
    "Disiplin": r.item.discipline ? DISCIPLINE_LABEL[r.item.discipline] ?? r.item.discipline : "",
    "Miktar": r.item.quantity,
    "Birim": r.item.unit,
    "Proje %": Number(r.finalPct.toFixed(2)),
  }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary["!cols"] = [
    { wch: 6 }, { wch: 12 }, { wch: 50 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 9 },
  ];
  Object.keys(summaryData[0] ?? {}).forEach((h, i) => {
    void h;
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: i });
    const cell = wsSummary[cellAddr];
    if (cell) {
      (cell as XLSX.CellObject & { s?: unknown }).s = {
        font: { bold: true, color: { rgb: "FFFFFFFF" } },
        fill: { fgColor: { rgb: "FF059669" } },
        alignment: { horizontal: "center" },
      };
    }
  });
  XLSX.utils.book_append_sheet(wb, wsSummary, "Top 15 İş Kalemi");

  const ts = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeName(projectName)}-WBS-${ts}.xlsx`);
}

// ============================================================
// PDF ÇIKTI — seviye bazlı renkli + bold başlıklı tablo
// ============================================================
export async function exportWbsToPDF(
  projectName: string,
  rows: WbsItem[],
  hierarchical: Map<string, HierarchicalWeight>
): Promise<void> {
  loadingOverlay.start("WBS PDF hazırlanıyor");
  try {
    return await _renderWbsToPDF(projectName, rows, hierarchical);
  } finally {
    loadingOverlay.stop();
  }
}

async function _renderWbsToPDF(
  projectName: string,
  rows: WbsItem[],
  hierarchical: Map<string, HierarchicalWeight>
): Promise<void> {
  const ts = toISODate(new Date());
  const today = formatDate(ts);
  const fileName = `${safeName(projectName)}-WBS-${ts}.pdf`;
  const leafCount = rows.filter((r) => r.isLeaf).length;

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const A4_PX_W = 794;
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
    line-height: 1.4;
  `;

  // Disiplin renkleri (badge için)
  const discColor: Record<string, string> = {
    mekanik: "#3b82f6",
    elektrik: "#f59e0b",
    insaat: "#ef4444",
    muhendislik: "#8b5cf6",
    idari: "#64748b",
    diger: "#10b981",
  };

  // Satırlar — seviye bazlı stil
  let leafIdx = 0;
  const bodyHtml = rows.map((w) => {
    const h = hierarchical.get(w.code);
    const finalPct = h ? h.finalPct * 100 : 0;
    const pct = finalPct > 0 ? `%${finalPct.toFixed(2)}` : "—";

    // L0 — proje kökü
    if (w.level === 0) {
      return `<tr style="background:#0f172a;color:#ffffff;">
        <td colspan="5" style="padding:14px 14px;font-size:16px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;">${escapeHtml(w.code)} · ${escapeHtml(w.name)}</td>
      </tr>`;
    }
    // L1 — ana başlık (lacivert, büyük bold)
    if (w.level === 1) {
      return `<tr style="background:#1e3a8a;color:#ffffff;">
        <td style="padding:11px 12px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:800;width:75px;border-bottom:1px solid #1e3a8a;">${escapeHtml(w.code)}</td>
        <td colspan="3" style="padding:11px 12px;font-size:14px;font-weight:800;letter-spacing:0.2px;text-transform:uppercase;border-bottom:1px solid #1e3a8a;">${escapeHtml(w.name)}</td>
        <td style="padding:11px 12px;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;font-weight:800;width:75px;border-bottom:1px solid #1e3a8a;">${escapeHtml(pct)}</td>
      </tr>`;
    }
    // L2 — alt başlık (açık mavi, orta bold)
    if (w.level === 2) {
      return `<tr style="background:#dbeafe;color:#1e3a8a;">
        <td style="padding:9px 12px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;font-weight:700;width:75px;border-bottom:1px solid #93c5fd;">${escapeHtml(w.code)}</td>
        <td colspan="3" style="padding:9px 12px;font-size:12.5px;font-weight:700;border-bottom:1px solid #93c5fd;">${escapeHtml(w.name)}</td>
        <td style="padding:9px 12px;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;font-weight:700;width:75px;border-bottom:1px solid #93c5fd;">${escapeHtml(pct)}</td>
      </tr>`;
    }
    // L3 — iş kalemi (yaprak, stripe)
    const stripe = leafIdx++ % 2 === 1 ? "background:#f8fafc;" : "background:#ffffff;";
    const disciplineHtml = w.discipline
      ? `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:9px;font-weight:700;color:#fff;background:${discColor[w.discipline] ?? "#64748b"};">${escapeHtml(DISCIPLINE_LABEL[w.discipline] ?? w.discipline)}</span>`
      : `<span style="color:#cbd5e1;">—</span>`;
    const qty = w.isLeaf && w.quantity > 0 ? `${w.quantity} ${escapeHtml(w.unit)}` : "—";
    return `<tr style="${stripe}">
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:9.5px;color:#475569;white-space:nowrap;width:75px;">${escapeHtml(w.code)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:10.5px;color:#0a0a0a;">${escapeHtml(w.name)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;">${disciplineHtml}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:10px;color:#0a0a0a;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;white-space:nowrap;width:90px;">${escapeHtml(qty)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-size:10.5px;font-weight:700;color:#0a0a0a;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;white-space:nowrap;width:75px;">${escapeHtml(pct)}</td>
    </tr>`;
  }).join("");

  root.innerHTML = `
    <div style="padding:22px;">
      <div style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);color:white;padding:18px 22px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div>
          <div style="font-size:19px;font-weight:800;letter-spacing:-0.3px;line-height:1.1;">WBS YAPISI</div>
          <div style="font-size:11px;font-weight:500;opacity:0.92;margin-top:5px;">${rows.length} satır · ${leafCount} iş kalemi</div>
          <div style="font-size:10px;opacity:0.85;margin-top:2px;">${escapeHtml(projectName)}</div>
        </div>
        <div style="text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;">
          <div style="font-size:14px;font-weight:700;">${today}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
        <thead>
          <tr style="background:#0f172a;color:white;">
            <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:75px;">Kod</th>
            <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Ad</th>
            <th style="padding:8px 12px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Disiplin</th>
            <th style="padding:8px 12px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:90px;">Miktar</th>
            <th style="padding:8px 12px;text-align:right;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:75px;">Proje %</th>
          </tr>
        </thead>
        <tbody>${bodyHtml}</tbody>
      </table>

      <div style="margin-top:18px;padding-top:10px;border-top:1px dashed #d4d4d8;display:flex;justify-content:space-between;font-size:8.5px;color:#a1a1aa;font-family:'JetBrains Mono',ui-monospace,monospace;">
        <span>${escapeHtml(projectName)} · proje-yonetim-platformu</span>
        <span>${today}</span>
      </div>
    </div>
  `;

  document.body.appendChild(root);
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
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    // Yazıcıların yazamadığı kenar boşluğu için margin bırak
    const MARGIN_MM = 10;
    const contentW = pageW - 2 * MARGIN_MM;
    const contentH = pageH - 2 * MARGIN_MM;
    const pxPerMm = canvas.width / contentW;
    const pageHpx = contentH * pxPerMm;

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
      pdf.addImage(imgData, "PNG", MARGIN_MM, MARGIN_MM, contentW, imgMmH);

      // Slice canvas'ı bellekten serbest bırak — büyük WBS'lerde tarayıcı çökmesin
      ctx.clearRect(0, 0, slice.width, slice.height);
      slice.width = 0;
      slice.height = 0;

      yOffset += pageHpx;
      pageNo++;
    }

    pdf.save(fileName);
  } finally {
    document.body.removeChild(root);
  }
}
