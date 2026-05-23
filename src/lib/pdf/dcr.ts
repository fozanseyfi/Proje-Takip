/**
 * DCR (Daily Construction Report) — Saha mühendisinin imzalanan günlük raporu.
 *
 * Tek sayfa A4. İçerik:
 *   - Brand header (proje + tarih + günlük no)
 *   - Hava durumu kutusu (otomatik veya manuel)
 *   - İş durdu uyarısı (varsa)
 *   - Personel & makine sayıları (puantajdan)
 *   - O gün gerçekleşen WBS aktiviteleri (realization'dan)
 *   - Özet / sorunlar / yarın planı (saha mühendisinin notları)
 *   - Foto thumbnail grid (rapor foto'larından)
 *   - İmza alanı: Saha mühendisi + İşveren temsilcisi
 *
 * Emerald gradient header + Geist font Türkçe destekli.
 */

import { formatDate, formatNumber, toISODate, daysBetween } from "@/lib/utils";
import type { Project, DailyReport, PersonnelAttendance, MachineAttendance, WbsItem } from "@/lib/store/types";
import { loadingOverlay } from "@/lib/ui-loading";
import { sumByDateMap } from "@/lib/calc/progress";

export interface DCRInput {
  project: Project;
  report: DailyReport | undefined; // boş gün için de PDF üretilebilir
  date: string;
  /** O günün puantaj kayıtları (sadece o tarihte) */
  personnelAttendance: PersonnelAttendance[];
  machineAttendance: MachineAttendance[];
  /** Proje WBS — gerçekleşmiş aktivite isimleri için lookup */
  wbs: WbsItem[];
  /** Realized data — wbs code → date → qty */
  realized: Record<string, Record<string, number>>;
  /** Hazırlayan adı (saha mühendisi) — boş ise "Saha Mühendisi" yazılır */
  preparedBy?: string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function downloadDCRPDF(input: DCRInput): Promise<void> {
  loadingOverlay.start("DCR raporu hazırlanıyor");
  try {
    return await _renderDCR(input);
  } finally {
    loadingOverlay.stop();
  }
}

async function _renderDCR(input: DCRInput): Promise<void> {
  const { project, report, date, personnelAttendance, machineAttendance, wbs, realized, preparedBy } = input;
  const today = formatDate(toISODate(new Date()));
  const A4_PX_W = 794;

  // ─── Geist font (Türkçe destek) ───
  const fontResp = await fetch("/fonts/Geist-Regular.ttf");
  if (!fontResp.ok) throw new Error("Geist fontu yüklenemedi");
  const fontBuf = await fontResp.arrayBuffer();
  const fontB64 = (() => {
    const bytes = new Uint8Array(fontBuf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
  })();

  // ─── Veri hazırlığı ───
  // Personel sayım
  const personPresent = personnelAttendance.filter((a) => a.date === date && a.projectId === project.id && a.present);
  const personnelCount = new Set(personPresent.map((a) => a.personnelMasterId)).size;
  const totalManhours = personPresent.reduce((s, a) => s + (a.hours || 0), 0);

  // Makine sayım
  const machinePresent = machineAttendance.filter((a) => a.date === date && a.projectId === project.id && a.present);
  const machineCount = new Set(machinePresent.map((a) => a.machineMasterId)).size;
  const machineHours = machinePresent.reduce((s, a) => s + (a.hours || 0), 0);

  // O gün gerçekleşen WBS aktiviteleri
  const realizedToday: Array<{ code: string; name: string; qty: number; unit: string; cumPct: number }> = [];
  for (const w of wbs) {
    if (!w.isLeaf || w.deletedAt) continue;
    const qty = realized[w.code]?.[date];
    if (qty == null || qty <= 0) continue;
    const cumQty = sumByDateMap(realized, w.code, date);
    const cumPct = w.quantity > 0 ? Math.min(100, (cumQty / w.quantity) * 100) : 0;
    realizedToday.push({
      code: w.code,
      name: w.name,
      qty,
      unit: w.unit || "",
      cumPct,
    });
  }
  realizedToday.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  // Proje gün numarası
  const dayNo = daysBetween(project.startDate, date) + 1;

  // ─── HTML body ───
  const weatherLine = report?.weather
    ? `${report.weather}${report.temperatureMin != null && report.temperatureMax != null ? ` · ${report.temperatureMin}°C – ${report.temperatureMax}°C` : ""}`
    : "Bilgi yok";

  const realizedRows = realizedToday.length === 0
    ? `<tr><td colspan="5" style="padding:14px; text-align:center; color:#94a3b8; border:1px solid #e5e7eb;">Bu gün için kayıtlı gerçekleşme yok.</td></tr>`
    : realizedToday.map((r) => `
      <tr>
        <td style="padding:6px 8px; border:1px solid #e5e7eb; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:9.5px; color:#475569; font-weight:700;">${escapeHtml(r.code)}</td>
        <td style="padding:6px 8px; border:1px solid #e5e7eb; font-size:11px;">${escapeHtml(r.name)}</td>
        <td style="padding:6px 8px; border:1px solid #e5e7eb; text-align:right; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:10.5px; font-weight:700; color:#047857;">${formatNumber(r.qty, 1)}</td>
        <td style="padding:6px 8px; border:1px solid #e5e7eb; font-size:10.5px; color:#64748b;">${escapeHtml(r.unit)}</td>
        <td style="padding:6px 8px; border:1px solid #e5e7eb; text-align:right; font-family:'JetBrains Mono',ui-monospace,monospace; font-size:10.5px; color:${r.cumPct >= 100 ? "#047857" : "#0f172a"}; font-weight:700;">${r.cumPct.toFixed(1)}%</td>
      </tr>
    `).join("");

  const photosHtml = report?.photos && report.photos.length > 0
    ? `<div style="margin-top:14px;">
         <div style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px;">SAHA FOTOĞRAFLARI (${report.photos.length})</div>
         <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px;">
           ${report.photos.slice(0, 8).map((p) => `
             <img src="${escapeHtml(p.url)}" style="width:100%; aspect-ratio:1.4; object-fit:cover; border-radius:4px; border:1px solid #e5e7eb;" />
           `).join("")}
         </div>
       </div>`
    : "";

  const workStoppedBlock = report?.workStopped
    ? `<div style="margin-top:10px; padding:8px 12px; background:#fee2e2; border-left:4px solid #b91c1c; border-radius:4px; font-size:11px; color:#7f1d1d;">
         <strong>⚠ İŞ DURDU:</strong> ${escapeHtml(report.workStoppedReason || "Sebep belirtilmedi")}
       </div>`
    : "";

  const bodyHtml = `
    <div style="padding:8px;">
      <!-- PROJE BİLGİ BLOK -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0; border:1px solid #e2e8f0; border-radius:6px; overflow:hidden; margin-bottom:14px;">
        <div style="padding:8px 12px; background:#f8fafc; border-right:1px solid #e2e8f0;">
          <div style="font-size:8.5px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">PROJE</div>
          <div style="font-size:12px; font-weight:800; color:#0f172a; margin-top:2px;">${escapeHtml(project.name)}</div>
          <div style="font-size:10px; color:#475569; margin-top:1px;">${escapeHtml(project.location)}</div>
        </div>
        <div style="padding:8px 12px; background:#f8fafc; border-right:1px solid #e2e8f0;">
          <div style="font-size:8.5px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">RAPOR TARİHİ</div>
          <div style="font-size:14px; font-weight:800; color:#047857; margin-top:2px; font-family:'JetBrains Mono',ui-monospace,monospace;">${formatDate(date)}</div>
          <div style="font-size:10px; color:#475569; margin-top:1px;">Gün ${dayNo} / ${project.durationDays}</div>
        </div>
        <div style="padding:8px 12px; background:#f8fafc;">
          <div style="font-size:8.5px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">HAVA DURUMU</div>
          <div style="font-size:11px; font-weight:700; color:#0f172a; margin-top:2px;">${escapeHtml(weatherLine)}</div>
          ${report?.weatherAutoFetched ? `<div style="font-size:9px; color:#64748b; margin-top:1px;">Otomatik · Open-Meteo</div>` : ""}
        </div>
      </div>

      ${workStoppedBlock}

      <!-- KAYNAK ÖZETİ -->
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-top:${workStoppedBlock ? "10px" : "0"};">
        <div style="padding:10px 12px; background:#f0fdf4; border:1px solid #86efac; border-radius:6px; text-align:center;">
          <div style="font-size:8.5px; color:#047857; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">PERSONEL</div>
          <div style="font-size:22px; font-weight:900; color:#047857; margin-top:2px; font-family:'JetBrains Mono',ui-monospace,monospace;">${personnelCount}</div>
          <div style="font-size:9.5px; color:#475569; margin-top:1px;">${formatNumber(totalManhours, 0)} adam-saat</div>
        </div>
        <div style="padding:10px 12px; background:#fef3c7; border:1px solid #fcd34d; border-radius:6px; text-align:center;">
          <div style="font-size:8.5px; color:#b45309; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">MAKİNE</div>
          <div style="font-size:22px; font-weight:900; color:#b45309; margin-top:2px; font-family:'JetBrains Mono',ui-monospace,monospace;">${machineCount}</div>
          <div style="font-size:9.5px; color:#475569; margin-top:1px;">${formatNumber(machineHours, 0)} makine-saat</div>
        </div>
        <div style="padding:10px 12px; background:#dbeafe; border:1px solid #93c5fd; border-radius:6px; text-align:center;">
          <div style="font-size:8.5px; color:#1d4ed8; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">AKTİVİTE</div>
          <div style="font-size:22px; font-weight:900; color:#1d4ed8; margin-top:2px; font-family:'JetBrains Mono',ui-monospace,monospace;">${realizedToday.length}</div>
          <div style="font-size:9.5px; color:#475569; margin-top:1px;">kalem ilerledi</div>
        </div>
        <div style="padding:10px 12px; background:#f3e8ff; border:1px solid #d8b4fe; border-radius:6px; text-align:center;">
          <div style="font-size:8.5px; color:#7c3aed; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">FOTOĞRAF</div>
          <div style="font-size:22px; font-weight:900; color:#7c3aed; margin-top:2px; font-family:'JetBrains Mono',ui-monospace,monospace;">${report?.photos?.length ?? 0}</div>
          <div style="font-size:9.5px; color:#475569; margin-top:1px;">adet eklendi</div>
        </div>
      </div>

      <!-- GERÇEKLEŞEN AKTİVİTELER TABLOSU -->
      <div style="margin-top:14px;">
        <div style="background:linear-gradient(90deg, #047857 0%, #10b981 100%); color:white; padding:7px 12px; border-radius:6px 6px 0 0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px;">
          Gerçekleşen Aktiviteler (Bu Gün)
        </div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-top:none;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.4px;">WBS</th>
              <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.4px;">Kalem</th>
              <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:right; font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.4px;">Bu Gün</th>
              <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:left; font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.4px;">Birim</th>
              <th style="padding:6px 8px; border:1px solid #e5e7eb; text-align:right; font-size:9px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.4px;">Kümül. %</th>
            </tr>
          </thead>
          <tbody>
            ${realizedRows}
          </tbody>
        </table>
      </div>

      <!-- NOTLAR -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px;">
        <div>
          <div style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:4px;">SAHA NOTU / ÖZET</div>
          <div style="min-height:60px; padding:8px 10px; background:#f8fafc; border:1px solid #e5e7eb; border-radius:4px; font-size:11px; color:#334155; white-space:pre-wrap; line-height:1.5;">${escapeHtml(report?.summary || "—")}</div>
        </div>
        <div>
          <div style="font-size:10px; font-weight:800; color:#b91c1c; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:4px;">⚠ SORUNLAR / ENGELLER</div>
          <div style="min-height:60px; padding:8px 10px; background:#fef2f2; border:1px solid #fecaca; border-radius:4px; font-size:11px; color:#7f1d1d; white-space:pre-wrap; line-height:1.5;">${escapeHtml(report?.issues || "—")}</div>
        </div>
      </div>

      ${report?.tomorrowPlan ? `
        <div style="margin-top:10px;">
          <div style="font-size:10px; font-weight:800; color:#0369a1; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:4px;">→ YARIN İÇİN PLAN</div>
          <div style="padding:8px 10px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:4px; font-size:11px; color:#0c4a6e; white-space:pre-wrap; line-height:1.5;">${escapeHtml(report.tomorrowPlan)}</div>
        </div>
      ` : ""}

      ${photosHtml}

      <!-- İMZA ALANI -->
      <div style="margin-top:18px;">
        <div style="background:linear-gradient(90deg, #047857 0%, #10b981 100%); color:white; padding:7px 12px; border-radius:6px 6px 0 0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px;">
          İmzalar
        </div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
          <tbody>
            <tr>
              <td style="padding:14px 14px; border:1px solid #e2e8f0; vertical-align:top; width:50%;">
                <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">SAHA MÜHENDİSİ</div>
                <div style="font-size:11px; font-weight:700; color:#0f172a; min-height:14px;">${escapeHtml(preparedBy ?? "")}</div>
                <div style="margin-top:6px; font-size:8.5px; color:#71717a;">Tarih: ${escapeHtml(formatDate(date))}</div>
                <div style="margin-top:24px; border-bottom:1px solid #94a3b8;"></div>
                <div style="font-size:8px; color:#94a3b8; text-align:center; margin-top:3px; font-style:italic;">İmza</div>
              </td>
              <td style="padding:14px 14px; border:1px solid #e2e8f0; vertical-align:top; width:50%;">
                <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">İŞVEREN TEMSİLCİSİ</div>
                <div style="font-size:11px; font-weight:700; color:#0f172a; min-height:14px;">${escapeHtml(project.investorName ?? "")}</div>
                <div style="margin-top:6px; font-size:8.5px; color:#71717a;">Tarih: ___ / ___ / ${date.slice(0, 4)}</div>
                <div style="margin-top:24px; border-bottom:1px solid #94a3b8;"></div>
                <div style="font-size:8px; color:#94a3b8; text-align:center; margin-top:3px; font-style:italic;">İmza</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // ─── Render container ───
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: ${A4_PX_W}px; background: #ffffff; color: #0a0a0a;
    font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 11px; line-height: 1.4; padding: 0;
  `;
  root.innerHTML = bodyHtml;
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
    pdf.setFont("Geist", "normal");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginX = 8;
    const headerH = 22;
    const footerH = 8;
    const bodyTop = headerH + 2;
    const bodyBottom = pageH - footerH - 2;
    const bodyMaxH = bodyBottom - bodyTop;
    const contentW = pageW - marginX * 2;
    const pxPerMm = canvas.width / contentW;
    const bodyMaxHpx = bodyMaxH * pxPerMm;

    // Tek sayfada bitmesi için body ölçeklendirme — DCR tek sayfa kuralı
    let yOffset = 0;
    let pageNo = 0;
    while (yOffset < canvas.height) {
      const sliceH = Math.min(bodyMaxHpx, canvas.height - yOffset);
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

      sctx.clearRect(0, 0, slice.width, slice.height);
      slice.width = 0;
      slice.height = 0;

      yOffset += sliceH;
      pageNo++;
      if (pageNo > 5) break;
    }

    // ─── Her sayfaya emerald brand header + footer ───
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // Header gradient strip
      const strips = 200;
      const stripW = pageW / strips;
      const from: [number, number, number] = [4, 120, 87];
      const to: [number, number, number] = [16, 185, 129];
      for (let s = 0; s < strips; s++) {
        const t = s / (strips - 1);
        const r = Math.round(from[0] + (to[0] - from[0]) * t);
        const g = Math.round(from[1] + (to[1] - from[1]) * t);
        const b = Math.round(from[2] + (to[2] - from[2]) * t);
        pdf.setFillColor(r, g, b);
        pdf.rect(s * stripW, 0, stripW + 0.2, headerH, "F");
      }

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(220, 252, 231);
      pdf.text("GÜNLÜK SAHA RAPORU", marginX, 6);

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(`DCR · ${project.name}`, marginX, 13);

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(209, 250, 229);
      pdf.text(`Rapor: ${formatDate(date)}  ·  Gün ${dayNo}/${project.durationDays}`, marginX, 18.5);

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(today, pageW - marginX, 9, { align: "right" });

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(167, 243, 208);
      pdf.text(`Sayfa ${i}/${totalPages}`, pageW - marginX, 14, { align: "right" });

      // Footer
      pdf.setDrawColor(220, 220, 230);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, pageH - footerH + 2, pageW - marginX, pageH - footerH + 2);

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      pdf.text(`${project.name}  ·  Saha Günlük Raporu (DCR)`, marginX, pageH - 3);
      pdf.text(`${formatDate(date)}  ·  ${today}`, pageW - marginX, pageH - 3, { align: "right" });
    }

    // ─── İndir ───
    const safeName = project.name.replace(/[^\w\s\-_.]/g, "").replace(/\s+/g, "-").slice(0, 50);
    const dateStamp = date.replace(/-/g, "");
    pdf.save(`${safeName}-DCR-${dateStamp}.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}
