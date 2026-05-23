/**
 * GES Teslim Alma Listesi — PDF üretimi.
 *
 * 3 çıktı türü:
 *  - "blank"  : boş taslak (kutucuklar boş, sahada el ile doldurulabilir)
 *  - "filled" : doldurulmuş hali (kullanıcının kaydettiği yanıtlar + şart/not)
 *  - "ncr"    : NCR ekstresi — yalnız "fail" ve "conditional" maddeler
 *
 * Ortak yapı:
 *  - Emerald gradient brand header (her sayfada)
 *  - Footer (proje adı + sayfa numarası)
 *  - Geist font ile Türkçe karakter desteği
 *  - html2canvas-pro ile body'yi render et, jsPDF ile başlık/footer
 */

import { formatDate, toISODate } from "@/lib/utils";
import type { Project } from "@/lib/store/types";
import type { TeslimAlmaReport, TeslimAlmaItemResult, TeslimAlmaStatus } from "@/lib/store/types";
import { TESLIM_ALMA_TEMPLATE, type TeslimAlmaSection, type TeslimAlmaItem } from "@/lib/data/teslim-alma-template";
import { loadingOverlay } from "@/lib/ui-loading";

export type TeslimAlmaPDFMode = "blank" | "filled" | "ncr";

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STATUS_LABEL: Record<TeslimAlmaStatus, string> = {
  pending: "Beklemede",
  ok: "Uygun",
  fail: "Uygun Değil",
  conditional: "Şartlı",
};

const STATUS_SYMBOL: Record<TeslimAlmaStatus, string> = {
  pending: "☐",
  ok: "✓",
  fail: "✗",
  conditional: "◐",
};

const STATUS_COLOR: Record<TeslimAlmaStatus, string> = {
  pending: "#71717a",
  ok: "#047857",
  fail: "#b91c1c",
  conditional: "#b45309",
};

const STATUS_BG: Record<TeslimAlmaStatus, string> = {
  pending: "#f4f4f5",
  ok: "#d1fae5",
  fail: "#fee2e2",
  conditional: "#fef3c7",
};

interface DecisionLabel {
  text: string;
  color: string;
  bg: string;
}

function decisionLabel(d: TeslimAlmaReport["meta"]["overallDecision"]): DecisionLabel | null {
  if (d === "approved") return { text: "Geçici Kabul Uygundur", color: "#047857", bg: "#d1fae5" };
  if (d === "rejected") return { text: "Geçici Kabul Uygun Değildir", color: "#b91c1c", bg: "#fee2e2" };
  if (d === "conditional") return { text: "Şartlı Uygundur", color: "#b45309", bg: "#fef3c7" };
  return null;
}

interface PDFOptions {
  mode: TeslimAlmaPDFMode;
  project: Project;
  report: TeslimAlmaReport;
}

// ─────────────────────────────────────────────────────────────────
// HTML body üretimi — bölüm / alt-bölüm / madde
// ─────────────────────────────────────────────────────────────────

function buildMetaBlockHtml(opts: PDFOptions): string {
  const { project, report } = opts;
  const m = report.meta;

  const cell = (label: string, value: string) => `
    <tr>
      <td style="padding:4px 8px; background:#f8fafc; color:#475569; font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; border:1px solid #e2e8f0; width:38%;">${escapeHtml(label)}</td>
      <td style="padding:4px 8px; color:#0f172a; font-size:10.5px; border:1px solid #e2e8f0;">${escapeHtml(value || "—")}</td>
    </tr>
  `;

  return `
    <div style="margin-bottom: 14px;">
      <div style="background: linear-gradient(90deg, #047857 0%, #10b981 100%); color: white; padding: 7px 12px; border-radius: 6px 6px 0 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">
        Proje Bilgileri
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-top: none;">
        <tbody>
          ${cell("Proje Adı", project.name)}
          ${cell("Konum / Adres", project.location ?? "")}
          ${cell("DC Kurulu Güç (kWp)", m.dcCapacityKwp != null ? String(m.dcCapacityKwp) : (project.installedCapacityMw != null ? String(project.installedCapacityMw * 1000) : ""))}
          ${cell("AC Kurulu Güç (kWe)", m.acCapacityKwe != null ? String(m.acCapacityKwe) : "")}
          ${cell("Panel Marka ve Adet", m.panelBrandModel ? `${m.panelBrandModel}${m.panelCount ? " — " + m.panelCount + " adet" : ""}` : "")}
          ${cell("Inverter Marka ve Adet", m.inverterBrandModel ? `${m.inverterBrandModel}${m.inverterCount ? " — " + m.inverterCount + " adet" : ""}` : "")}
          ${cell("EPC Yüklenici", m.epcContractor ?? project.mainContractorName ?? "")}
          ${cell("Denetim Tarihi", m.inspectionDate ? formatDate(m.inspectionDate) : "")}
          ${cell("Denetimi Yapan", m.inspectorName ? `${m.inspectorName}${m.inspectorTitle ? " — " + m.inspectorTitle : ""}` : "")}
          ${cell("İşveren Temsilcisi", m.ownerRepName ? `${m.ownerRepName}${m.ownerRepTitle ? " — " + m.ownerRepTitle : ""}` : "")}
        </tbody>
      </table>
    </div>
  `;
}

function buildLegendBlockHtml(mode: TeslimAlmaPDFMode): string {
  if (mode === "ncr") {
    return `
      <div style="margin-bottom: 12px; padding: 8px 12px; background: #fef2f2; border-left: 4px solid #b91c1c; border-radius: 4px; font-size: 10.5px; color: #7f1d1d; line-height: 1.5;">
        <strong style="color:#991b1b;">UYGUNSUZLUK RAPORU (NCR):</strong> Aşağıdaki maddeler denetim sırasında <strong>uygun değil</strong> veya <strong>şartlı uygun</strong> olarak işaretlenmiştir.
        <br>Major NCR'lar geçici kabul öncesi kapatılmalı, Minor NCR'lar punch-list'e alınmalıdır.
      </div>
    `;
  }
  return `
    <div style="margin-bottom: 12px; padding: 8px 12px; background: #f0fdf4; border-left: 4px solid #047857; border-radius: 4px; font-size: 9.5px; color: #14532d; line-height: 1.5;">
      <strong>Doldurma Kuralları:</strong> Her madde için ☐ kutucuğu UYGUN ise <strong style="color:#047857;">✓</strong>, UYGUN DEĞİL ise <strong style="color:#b91c1c;">✗</strong>, ŞARTLI UYGUN ise <strong style="color:#b45309;">◐</strong> olarak işaretlenir. Şartlı/uygunsuz maddelerde açıklama zorunludur.
      <br><strong>Severity:</strong> <span style="color:#b91c1c; font-weight:700;">Major</span> = kapatılmadan geçici kabul yapılamaz · <span style="color:#71717a; font-weight:700;">Minor</span> = punch-list'e alınır.
    </div>
  `;
}

function buildItemRowHtml(
  item: TeslimAlmaItem,
  result: TeslimAlmaItemResult | undefined,
  mode: TeslimAlmaPDFMode
): string {
  const status: TeslimAlmaStatus = result?.status ?? "pending";
  const severityBadge =
    item.severity === "major"
      ? `<span style="display:inline-block; padding:1px 6px; background:#fee2e2; color:#991b1b; font-size:7.5px; font-weight:800; border-radius:3px; text-transform:uppercase; letter-spacing:0.4px;">MAJOR</span>`
      : `<span style="display:inline-block; padding:1px 6px; background:#f1f5f9; color:#475569; font-size:7.5px; font-weight:700; border-radius:3px; text-transform:uppercase; letter-spacing:0.4px;">Minor</span>`;

  // Mode'a göre statü kutuları
  let statusBlock: string;
  if (mode === "blank") {
    // Tüm statüler boş kutu — sahada doldurulabilir
    statusBlock = `
      <span style="display:inline-block; margin-left:6px; font-size:11px; color:#475569;">
        <span style="margin-right:4px;">☐ Uygun</span>
        <span style="margin-right:4px;">☐ Uygun Değil</span>
        <span>☐ Şartlı</span>
      </span>
    `;
  } else {
    // filled veya ncr — gerçek statü işaretli
    statusBlock = `
      <span style="display:inline-block; padding:2px 8px; background:${STATUS_BG[status]}; color:${STATUS_COLOR[status]}; font-size:10px; font-weight:800; border-radius:4px; border:1px solid ${STATUS_COLOR[status]}40;">
        ${STATUS_SYMBOL[status]} ${STATUS_LABEL[status]}
      </span>
    `;
  }

  // Not / şart bloku
  let notesHtml = "";
  if (mode !== "blank") {
    const parts: string[] = [];
    if (status === "conditional" && result?.condition) {
      parts.push(`<div style="margin-top:4px; padding:4px 8px; background:#fef3c7; border-left:3px solid #b45309; color:#78350f; font-size:9.5px; line-height:1.45;"><strong>Şart:</strong> ${escapeHtml(result.condition)}</div>`);
    }
    if (result?.note) {
      parts.push(`<div style="margin-top:4px; padding:4px 8px; background:#f8fafc; border-left:3px solid #94a3b8; color:#334155; font-size:9.5px; line-height:1.45;"><strong>Açıklama:</strong> ${escapeHtml(result.note)}</div>`);
    }
    if (parts.length > 0) notesHtml = parts.join("");
  } else {
    // Blank — boş açıklama satırı (saha için)
    notesHtml = `<div style="margin-top:4px; padding:3px 8px; border-bottom:1px dotted #94a3b8; font-size:9px; color:#94a3b8;">Açıklama / şart: _________________________________________________</div>`;
  }

  return `
    <tr style="vertical-align:top; page-break-inside: avoid;">
      <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; font-family:'JetBrains Mono', ui-monospace, monospace; font-size:9px; color:#64748b; font-weight:700; width:46px;">${escapeHtml(item.id)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">
        <div style="display:flex; align-items:flex-start; gap:6px; flex-wrap:wrap;">
          <span style="flex:1; min-width:0; font-size:10.5px; line-height:1.5; color:#0f172a;">${escapeHtml(item.text)}</span>
          <span style="flex-shrink:0; display:inline-flex; align-items:center; gap:4px;">
            ${severityBadge}
            ${statusBlock}
          </span>
        </div>
        ${notesHtml}
      </td>
    </tr>
  `;
}

function buildSectionHtml(
  section: TeslimAlmaSection,
  results: Record<string, TeslimAlmaItemResult>,
  mode: TeslimAlmaPDFMode
): string {
  // NCR modunda yalnızca fail/conditional maddeleri içeren bölümleri çıkar
  if (mode === "ncr") {
    const hasIssue = section.subsections.some((sub) =>
      sub.items.some((it) => {
        const st = results[it.id]?.status;
        return st === "fail" || st === "conditional";
      })
    );
    if (!hasIssue) return "";
  }

  const subsectionsHtml = section.subsections
    .map((sub) => {
      let items = sub.items;
      if (mode === "ncr") {
        items = items.filter((it) => {
          const st = results[it.id]?.status;
          return st === "fail" || st === "conditional";
        });
        if (items.length === 0) return "";
      }
      const rowsHtml = items.map((it) => buildItemRowHtml(it, results[it.id], mode)).join("");
      return `
        <div style="margin-top:10px; page-break-inside: avoid;">
          <div style="padding:5px 10px; background:#f0fdf4; border-left:3px solid #047857; font-size:10.5px; font-weight:800; color:#14532d;">
            ${escapeHtml(sub.id)} · ${escapeHtml(sub.title)}
          </div>
          <table style="width:100%; border-collapse:collapse; margin-top:2px;">
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      `;
    })
    .filter((s) => s !== "")
    .join("");

  if (!subsectionsHtml) return "";

  return `
    <div style="margin-top:16px; page-break-inside: auto;">
      <div style="background: linear-gradient(90deg, #047857 0%, #10b981 100%); color:white; padding:8px 14px; border-radius:5px 5px 0 0;">
        <span style="font-size:14px; font-weight:900; letter-spacing:-0.2px;">${escapeHtml(section.id)}</span>
        <span style="font-size:13px; font-weight:800; margin-left:8px;">${escapeHtml(section.title)}</span>
        <div style="font-size:9.5px; color:#d1fae5; font-weight:500; margin-top:2px; line-height:1.4;">${escapeHtml(section.description)}</div>
      </div>
      <div style="background:white; border:1px solid #e2e8f0; border-top:none; border-radius:0 0 5px 5px; padding:8px 12px;">
        ${subsectionsHtml}
      </div>
    </div>
  `;
}

function buildSummaryBlockHtml(report: TeslimAlmaReport, totalItems: number): string {
  let ok = 0, fail = 0, conditional = 0, pending = 0;
  for (const r of Object.values(report.items)) {
    if (r.status === "ok") ok++;
    else if (r.status === "fail") fail++;
    else if (r.status === "conditional") conditional++;
  }
  pending = totalItems - ok - fail - conditional;
  const dec = decisionLabel(report.meta.overallDecision);
  const decisionBlock = dec
    ? `<div style="margin-top:8px; padding:6px 12px; background:${dec.bg}; color:${dec.color}; border-radius:4px; font-size:11px; font-weight:800; text-align:center;">${escapeHtml(dec.text)}</div>`
    : "";

  return `
    <div style="margin-bottom: 14px;">
      <div style="background: linear-gradient(90deg, #047857 0%, #10b981 100%); color:white; padding:7px 12px; border-radius:6px 6px 0 0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px;">
        Denetim Özeti
      </div>
      <div style="border:1px solid #e2e8f0; border-top:none; padding:10px 12px; background:white;">
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:8px;">
          <div style="text-align:center; padding:8px 4px; background:#f8fafc; border-radius:4px;">
            <div style="font-size:8px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Toplam</div>
            <div style="font-size:18px; font-weight:900; color:#0f172a; font-family:'JetBrains Mono', monospace;">${totalItems}</div>
          </div>
          <div style="text-align:center; padding:8px 4px; background:#d1fae5; border-radius:4px;">
            <div style="font-size:8px; color:#047857; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Uygun</div>
            <div style="font-size:18px; font-weight:900; color:#047857; font-family:'JetBrains Mono', monospace;">${ok}</div>
          </div>
          <div style="text-align:center; padding:8px 4px; background:#fee2e2; border-radius:4px;">
            <div style="font-size:8px; color:#b91c1c; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Uygun Değil</div>
            <div style="font-size:18px; font-weight:900; color:#b91c1c; font-family:'JetBrains Mono', monospace;">${fail}</div>
          </div>
          <div style="text-align:center; padding:8px 4px; background:#fef3c7; border-radius:4px;">
            <div style="font-size:8px; color:#b45309; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Şartlı</div>
            <div style="font-size:18px; font-weight:900; color:#b45309; font-family:'JetBrains Mono', monospace;">${conditional}</div>
          </div>
          <div style="text-align:center; padding:8px 4px; background:#f4f4f5; border-radius:4px;">
            <div style="font-size:8px; color:#71717a; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Beklemede</div>
            <div style="font-size:18px; font-weight:900; color:#71717a; font-family:'JetBrains Mono', monospace;">${pending}</div>
          </div>
        </div>
        ${decisionBlock}
        ${report.meta.generalNotes ? `
          <div style="margin-top:8px; padding:6px 10px; background:#f8fafc; border-left:3px solid #94a3b8; font-size:10px; color:#334155; line-height:1.5;">
            <strong>Genel Notlar:</strong> ${escapeHtml(report.meta.generalNotes)}
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function buildSignatureBlockHtml(report: TeslimAlmaReport): string {
  const m = report.meta;
  const sigCell = (title: string, name: string, role: string) => `
    <td style="padding:14px 12px; border:1px solid #e2e8f0; vertical-align:top; width:33.33%;">
      <div style="font-size:9px; color:#64748b; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">${escapeHtml(title)}</div>
      <div style="font-size:11px; font-weight:700; color:#0f172a; min-height:14px;">${escapeHtml(name || "")}</div>
      <div style="font-size:9.5px; color:#475569; min-height:13px;">${escapeHtml(role || "")}</div>
      <div style="margin-top:6px; font-size:8.5px; color:#71717a;">Tarih: ${escapeHtml(m.inspectionDate ? formatDate(m.inspectionDate) : "___ / ___ / 20___")}</div>
      <div style="margin-top:18px; border-bottom:1px solid #94a3b8;"></div>
      <div style="font-size:8px; color:#94a3b8; text-align:center; margin-top:3px; font-style:italic;">İmza</div>
    </td>
  `;
  return `
    <div style="margin-top:18px; page-break-inside: avoid;">
      <div style="background: linear-gradient(90deg, #047857 0%, #10b981 100%); color:white; padding:7px 12px; border-radius:6px 6px 0 0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px;">
        İmzalar
      </div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #e2e8f0; border-top:none;">
        <tbody>
          <tr>
            ${sigCell("Denetimi Yapan", m.inspectorName ?? "", m.inspectorTitle ?? "")}
            ${sigCell("İşveren Temsilcisi", m.ownerRepName ?? "", m.ownerRepTitle ?? "")}
            ${sigCell("EPC Yüklenici Temsilcisi", m.epcRepName ?? "", m.epcRepTitle ?? "")}
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────
// Ana fonksiyon
// ─────────────────────────────────────────────────────────────────

export async function downloadTeslimAlmaPDF(opts: PDFOptions): Promise<void> {
  const overlayLabel =
    opts.mode === "blank" ? "Taslak PDF hazırlanıyor"
    : opts.mode === "ncr" ? "NCR raporu hazırlanıyor"
    : "Teslim alma raporu hazırlanıyor";
  loadingOverlay.start(overlayLabel);
  try {
    return await _renderTeslimAlmaPDF(opts);
  } finally {
    loadingOverlay.stop();
  }
}

async function _renderTeslimAlmaPDF(opts: PDFOptions): Promise<void> {
  const today = formatDate(toISODate(new Date()));
  const A4_PX_W = 794;

  // ─── Font yükle (Türkçe destekli) ───
  const fontResp = await fetch("/fonts/Geist-Regular.ttf");
  if (!fontResp.ok) throw new Error("Font yüklenemedi");
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

  // ─── Body HTML kur ───
  const sectionsHtml = TESLIM_ALMA_TEMPLATE.map((sec) =>
    buildSectionHtml(sec, opts.report.items, opts.mode)
  )
    .filter((h) => h !== "")
    .join("");

  // Toplam madde sayısı (özet için)
  let totalItems = 0;
  for (const s of TESLIM_ALMA_TEMPLATE) {
    for (const sub of s.subsections) totalItems += sub.items.length;
  }

  const ncrEmpty = opts.mode === "ncr" && sectionsHtml === "";

  const bodyHtml = `
    ${buildMetaBlockHtml(opts)}
    ${opts.mode !== "blank" ? buildSummaryBlockHtml(opts.report, totalItems) : ""}
    ${buildLegendBlockHtml(opts.mode)}
    ${ncrEmpty
      ? `<div style="margin-top:20px; padding:24px; background:#f0fdf4; border:2px solid #047857; border-radius:8px; text-align:center; color:#14532d;">
           <div style="font-size:28px; margin-bottom:8px;">✓</div>
           <div style="font-size:14px; font-weight:800;">Uygunsuzluk Tespit Edilmedi</div>
           <div style="font-size:11px; margin-top:4px;">Bu denetimde hiçbir madde "Uygun Değil" veya "Şartlı" olarak işaretlenmemiştir.</div>
         </div>`
      : sectionsHtml}
    ${opts.mode !== "ncr" ? buildSignatureBlockHtml(opts.report) : ""}
  `;

  // ─── Render container ───
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed; left: -10000px; top: 0;
    width: ${A4_PX_W}px; background: #ffffff; color: #0a0a0a;
    font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 11px; line-height: 1.4; padding: 0;
  `;
  root.innerHTML = `<div style="padding: 4px;">${bodyHtml}</div>`;
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
    const marginX = 10;
    const headerH = 24;
    const footerH = 10;
    const bodyTop = headerH + 4;
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
    function findSafeBreak(yStart: number, naturalEnd: number): number {
      const minBreak = yStart + (naturalEnd - yStart) * 0.7;
      for (let y = naturalEnd - 1; y >= minBreak; y--) {
        if (isRowMostlyWhite(y)) return y + 1;
      }
      return naturalEnd;
    }

    // ─── Body slice + sayfa ekle ───
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

      // Slice canvas'ı bellekten serbest bırak
      sctx.clearRect(0, 0, slice.width, slice.height);
      slice.width = 0;
      slice.height = 0;

      yOffset = safeEnd;
      pageNo++;
      if (pageNo > 60) break; // güvenlik üst sınırı
    }

    // ─── Her sayfaya brand header + footer ───
    const totalPages = pdf.getNumberOfPages();
    const titleMap: Record<TeslimAlmaPDFMode, string> = {
      blank: "GES Teslim Alma Listesi — Taslak",
      filled: "GES Teslim Alma Listesi — Denetim Raporu",
      ncr: "GES Teslim Alma — Uygunsuzluk Raporu (NCR)",
    };
    const subtitleMap: Record<TeslimAlmaPDFMode, string> = {
      blank: "Saha denetim · doldurma şablonu",
      filled: `Denetim tarihi: ${opts.report.meta.inspectionDate ? formatDate(opts.report.meta.inspectionDate) : today}`,
      ncr: "Uygun değil ve şartlı maddeler",
    };

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // HEADER — emerald gradient (yatay strip-blend)
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

      // Sol — başlık
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text(opts.mode === "ncr" ? "UYGUNSUZLUK RAPORU" : "DENETİM RAPORU", marginX, 6);

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(titleMap[opts.mode], marginX, 13);

      // Alt başlık + proje
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(209, 250, 229);
      const parts = [subtitleMap[opts.mode], opts.project.name].filter(Boolean);
      const subText = parts.join("  ·  ");
      const maxW = pageW - marginX * 2 - 50;
      let fs = 8.5;
      let drawText = subText;
      while (pdf.getTextWidth(drawText) > maxW && fs > 6) {
        fs -= 0.5;
        pdf.setFontSize(fs);
      }
      if (pdf.getTextWidth(drawText) > maxW) {
        while (pdf.getTextWidth(drawText + "…") > maxW && drawText.length > 0) {
          drawText = drawText.slice(0, -1);
        }
        drawText += "…";
      }
      pdf.text(drawText, marginX, 19);

      // Sağ — tarih + sayfa
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text(today, pageW - marginX, 9, { align: "right" });

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(209, 250, 229);
      pdf.text(`Sayfa ${i} / ${totalPages}`, pageW - marginX, 14.5, { align: "right" });

      pdf.setFontSize(7);
      pdf.setTextColor(167, 243, 208);
      pdf.text("v1.0", pageW - marginX, 19, { align: "right" });

      // FOOTER
      pdf.setDrawColor(220, 220, 230);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, pageH - footerH + 2, pageW - marginX, pageH - footerH + 2);

      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      pdf.text(`${opts.project.name}  ·  Saha Denetim Checklist v1.0`, marginX, pageH - 4);
      pdf.text(`${today}  ·  ${i}/${totalPages}`, pageW - marginX, pageH - 4, { align: "right" });
    }

    // ─── İndir ───
    const safeName = opts.project.name.replace(/[^\w\s\-_.]/g, "").replace(/\s+/g, "-").slice(0, 60);
    const suffix = opts.mode === "blank" ? "taslak" : opts.mode === "ncr" ? "ncr" : "dolduruldu";
    const stamp = toISODate(new Date()).replace(/-/g, "");
    pdf.save(`${safeName}-teslim-alma-${suffix}-${stamp}.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}
