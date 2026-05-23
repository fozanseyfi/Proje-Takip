/**
 * Master liste PDF üretimi.
 * Body (tablo) html2canvas-pro ile render edilir; brand header + footer her sayfaya
 * jsPDF API ile ayrı çizilir (Geist font ile Türkçe karakter desteği).
 */

import { formatDate, toISODate } from "@/lib/utils";
import { loadingOverlay } from "@/lib/ui-loading";

export interface MasterPDFColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  mono?: boolean;
  bold?: boolean;
}

export interface MasterPDFOptions {
  title: string;
  subtitle?: string;
  tone?: "purple" | "yellow" | "accent" | "blue";
  projectName?: string;
  columns: MasterPDFColumn[];
  rows: Record<string, string | number>[];
  fileName: string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Brand renkleri — header gradient stripe + table head bg
const TONE: Record<
  NonNullable<MasterPDFOptions["tone"]>,
  { from: [number, number, number]; to: [number, number, number]; headHex: string; headBorder: string }
> = {
  accent: {
    from: [4, 120, 87], // brand-700
    to: [16, 185, 129], // brand-500
    headHex: "#047857",
    headBorder: "#065f46",
  },
  purple: {
    from: [109, 40, 217],
    to: [124, 58, 237],
    headHex: "#6d28d9",
    headBorder: "#5b21b6",
  },
  yellow: {
    from: [180, 83, 9],
    to: [217, 119, 6],
    headHex: "#b45309",
    headBorder: "#92400e",
  },
  blue: {
    from: [29, 78, 216],
    to: [59, 130, 246],
    headHex: "#2563eb",
    headBorder: "#1e40af",
  },
};

export async function downloadMasterListPDF(opts: MasterPDFOptions): Promise<void> {
  loadingOverlay.start(`${opts.title} hazırlanıyor`);
  try {
    return await _renderMasterListPDF(opts);
  } finally {
    loadingOverlay.stop();
  }
}

async function _renderMasterListPDF(opts: MasterPDFOptions): Promise<void> {
  const tone = opts.tone ?? "accent";
  const palette = TONE[tone];
  const today = formatDate(toISODate(new Date()));
  const A4_PX_W = 794;

  // ─── Geist font yükle (Türkçe destekli) ───
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

  // ─── Body HTML — sadece tablo (brand header/footer jsPDF ile her sayfaya çizilir) ───
  const colHeaderHtml = opts.columns
    .map(
      (c) => `
    <th style="
      padding: 8px 10px;
      text-align: ${c.align ?? "left"};
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border: 1px solid ${palette.headBorder};
      ${c.width ? `width: ${c.width};` : ""}
    ">${escapeHtml(c.label)}</th>
  `
    )
    .join("");

  const bodyHtml =
    opts.rows.length === 0
      ? `<tr><td colspan="${opts.columns.length}" style="padding: 18px; text-align: center; color: #71717a; border: 1px solid #d4d4d8;">Kayıt yok.</td></tr>`
      : opts.rows
          .map((row, i) => {
            const cellsHtml = opts.columns
              .map(
                (c) => `
          <td style="
            padding: 6px 10px;
            text-align: ${c.align ?? "left"};
            border: 1px solid #e5e7eb;
            ${c.mono ? "font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 10px;" : "font-size: 10.5px;"}
            ${c.bold ? "font-weight: 700;" : ""}
            ${c.align === "right" ? "font-variant-numeric: tabular-nums;" : ""}
          ">${escapeHtml(row[c.key])}</td>
        `
              )
              .join("");
            const stripe = i % 2 === 1 ? "background: #f9fafb;" : "";
            return `<tr style="${stripe}">${cellsHtml}</tr>`;
          })
          .join("");

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
  root.innerHTML = `
    <div style="padding: 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: ${palette.headHex}; color: white;">
            ${colHeaderHtml}
          </tr>
        </thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(root);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: A4_PX_W,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
    pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
    pdf.addFont("Geist-Regular.ttf", "Geist", "bold");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Sayfa düzeni (mm):
    //  Header: 24mm üst
    //  Body  : aralık (bodyTop..bodyBottom)
    //  Footer: 10mm alt
    const marginX = 10;
    const headerH = 24;
    const footerH = 10;
    const bodyTop = headerH + 4; // 4mm gap
    const bodyBottom = pageH - footerH - 3;
    const bodyMaxH = bodyBottom - bodyTop;
    const contentW = pageW - marginX * 2;
    const pxPerMm = canvas.width / contentW;
    const bodyMaxHpx = bodyMaxH * pxPerMm;

    const ctx = canvas.getContext("2d");
    function isRowMostlyWhite(y: number): boolean {
      if (!ctx) return false;
      const data = ctx.getImageData(0, y, canvas.width, 1).data;
      let whiteCount = 0;
      const total = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 4 || (r > 240 && g > 240 && b > 240)) whiteCount++;
      }
      return whiteCount / total >= 0.985;
    }
    // Tablo satırları arası ince çizgili olduğu için "boş satır" araması bazen başarısız
    // olur. O nedenle önce yumuşak beyaz aramayı dener; yoksa naturalEnd'i kullanır.
    function findSafeBreak(yStart: number, naturalEnd: number): number {
      const minBreak = yStart + (naturalEnd - yStart) * 0.7;
      for (let y = naturalEnd - 1; y >= minBreak; y--) {
        if (isRowMostlyWhite(y)) return y + 1;
      }
      return naturalEnd;
    }

    // ─── Body slice & yerleştirme ───
    let yOffset = 0;
    let pageNo = 0;
    while (yOffset < canvas.height) {
      const naturalEnd = Math.min(yOffset + bodyMaxHpx, canvas.height);
      const isLast = naturalEnd >= canvas.height;
      const safeEnd = isLast ? naturalEnd : findSafeBreak(yOffset, naturalEnd);
      const sliceH = safeEnd - yOffset;
      if (sliceH <= 0) break;

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const sctx = slice.getContext("2d");
      if (!sctx) break;
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, -yOffset);
      const imgData = slice.toDataURL("image/png");

      if (pageNo > 0) pdf.addPage();
      const imgMmH = sliceH / pxPerMm;
      pdf.addImage(imgData, "PNG", marginX, bodyTop, contentW, imgMmH);

      yOffset = safeEnd;
      pageNo++;
      if (pageNo > 30) break;
    }

    // ─── Her sayfaya brand header + footer ───
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // HEADER — brand gradient (yatay strip-blend)
      const strips = 200;
      const stripW = pageW / strips;
      for (let s = 0; s < strips; s++) {
        const t = s / (strips - 1);
        const r = Math.round(palette.from[0] + (palette.to[0] - palette.from[0]) * t);
        const g = Math.round(palette.from[1] + (palette.to[1] - palette.from[1]) * t);
        const b = Math.round(palette.from[2] + (palette.to[2] - palette.from[2]) * t);
        pdf.setFillColor(r, g, b);
        pdf.rect(s * stripW, 0, stripW + 0.2, headerH, "F");
      }

      // Sol blok — başlık + alt başlık + proje
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text("RAPOR", marginX, 6);

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(255, 255, 255);
      pdf.text(opts.title, marginX, 13);

      // Alt satır — subtitle ve project
      const subtitleParts: string[] = [];
      if (opts.subtitle) subtitleParts.push(opts.subtitle);
      if (opts.projectName) subtitleParts.push(opts.projectName);
      if (subtitleParts.length > 0) {
        pdf.setFont("Geist", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(209, 250, 229);
        // Sığdır
        const text = subtitleParts.join("  ·  ");
        const maxW = pageW - marginX * 2 - 50;
        let fs = 8.5;
        let drawText = text;
        while (pdf.getTextWidth(drawText) > maxW && fs > 6) {
          fs -= 0.5;
          pdf.setFontSize(fs);
        }
        if (pdf.getTextWidth(drawText) > maxW) {
          // hâlâ uzunsa kes
          while (pdf.getTextWidth(drawText + "…") > maxW && drawText.length > 0) {
            drawText = drawText.slice(0, -1);
          }
          drawText += "…";
        }
        pdf.text(drawText, marginX, 19);
      }

      // Sağ blok — tarih + sayfa
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text(today, pageW - marginX, 9, { align: "right" });

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(209, 250, 229);
      const pageLabel =
        totalPages > 1 ? `Sayfa ${i} / ${totalPages}` : `${opts.rows.length} kayıt`;
      pdf.text(pageLabel, pageW - marginX, 14.5, { align: "right" });

      if (totalPages > 1) {
        pdf.setFontSize(7);
        pdf.setTextColor(167, 243, 208);
        pdf.text(`${opts.rows.length} kayıt`, pageW - marginX, 19, { align: "right" });
      }

      // FOOTER
      pdf.setDrawColor(220, 220, 230);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, pageH - footerH + 2, pageW - marginX, pageH - footerH + 2);

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      const leftFooter = opts.projectName
        ? `${opts.projectName}  ·  proje-yonetim-platformu`
        : "proje-yonetim-platformu";
      pdf.text(leftFooter, marginX, pageH - 4);
      pdf.text(
        `${today}  ·  ${i}/${totalPages}`,
        pageW - marginX,
        pageH - 4,
        { align: "right" }
      );
    }

    pdf.save(`${opts.fileName}.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}
