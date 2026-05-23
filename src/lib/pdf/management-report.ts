/**
 * Yönetim Özeti PDF — Direktör/Patron için yapılandırılmış executive rapor.
 *
 * - Dashboard'da görünen TÜM özetleri içerir (KPI, S-curve, bölüm S-curve, finansal,
 *   adam-saat firma dağılımı, personel headcount, makine headcount, procurement,
 *   kritik işler, claim/tutanak, son faaliyet, saha foto, künye).
 * - Sayfa geçişleri bölüm sınırlarında kırılır (mid-content kesim olmaz).
 * - S-curve inline SVG ile çizilir (gerçek veri ile).
 */

import { formatDate, formatMoney, formatNumber, toISODate, daysBetween, spiLevel } from "@/lib/utils";
import { loadingOverlay } from "@/lib/ui-loading";
import type {
  Project,
  WbsItem,
  DateQuantityMap,
  BillingItem,
  ProcurementItem,
  LookaheadItem,
  PersonnelAttendance,
  MachineAttendance,
  DailyReport,
  PersonnelMaster,
  MachineMaster,
} from "@/lib/store/types";
import {
  computeProgress,
  buildSCurve,
  getAllDates,
  type SCurvePoint,
} from "@/lib/calc/progress";
import {
  computeSectionProgress,
  buildSectionSCurve,
  procurementFollowup,
  manhourByDiscipline,
  getDisciplineLabel,
} from "@/lib/calc/sections";

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  completed: "Tamamlandı",
  archived: "Arşivlendi",
};

interface Input {
  project: Project;
  wbs: WbsItem[];
  planned: DateQuantityMap;
  realized: DateQuantityMap;
  billing: BillingItem[];
  procurement: ProcurementItem[];
  lookahead: LookaheadItem[];
  personnelAttendance: PersonnelAttendance[];
  machineAttendance: MachineAttendance[];
  dailyReports: DailyReport[];
  personnel: PersonnelMaster[];
  machines: MachineMaster[];
  panelName?: string;
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

export async function downloadManagementReportPDF(input: Input): Promise<void> {
  loadingOverlay.start("Yönetim raporu hazırlanıyor");
  try {
    return await _renderManagementReportPDF(input);
  } finally {
    loadingOverlay.stop();
  }
}

async function _renderManagementReportPDF(input: Input): Promise<void> {
  const {
    project, wbs, planned, realized, billing, procurement, lookahead,
    personnelAttendance, machineAttendance, dailyReports, personnel, machines,
    panelName, preparedBy,
  } = input;

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  // ════════════════════════════════════════════════════════════════════
  // HESAPLAMALAR
  // ════════════════════════════════════════════════════════════════════
  const wbsItems = wbs.map((w) => ({ code: w.code, isLeaf: w.isLeaf, quantity: w.quantity, weight: w.weight }));
  const { planPct, realPct, spi } = computeProgress(wbsItems, planned, realized, project.reportDate);
  const sections = computeSectionProgress(wbs, planned, realized, project.reportDate, 1);
  const sCurve = buildSCurve(wbsItems, planned, realized, project.reportDate);
  const allDates = getAllDates(planned, realized);

  const elapsed = Math.max(0, daysBetween(project.startDate, project.reportDate) + 1);
  const remaining = Math.max(0, project.durationDays - elapsed);
  const durationPct = project.durationDays > 0 ? (elapsed / project.durationDays) * 100 : 0;

  // Personel
  const projectAttendance = personnelAttendance.filter((a) => a.projectId === project.id && a.present);
  const totalManhours = projectAttendance.reduce((s, a) => s + (a.hours || 0), 0);
  const uniquePersonnel = new Set(projectAttendance.map((a) => a.personnelMasterId)).size;
  const todayPersonnel = projectAttendance.filter((a) => a.date === project.reportDate).length;
  const todayManhours = projectAttendance
    .filter((a) => a.date === project.reportDate)
    .reduce((s, a) => s + (a.hours || 0), 0);

  // Disiplin dağılımı (mevcut helper)
  const disciplineRows = manhourByDiscipline(personnelAttendance, personnel, project.id);

  // Disiplin × Firma kırılımı
  const discCompany: Record<string, Record<string, number>> = {};
  const personById = new Map(personnel.map((p) => [p.id, p]));
  for (const a of projectAttendance) {
    const p = personById.get(a.personnelMasterId);
    const disc = (p?.discipline ?? "unknown") as string;
    const company = p?.company ?? "Bilinmiyor";
    if (!discCompany[disc]) discCompany[disc] = {};
    discCompany[disc][company] = (discCompany[disc][company] || 0) + (a.hours || 0);
  }

  // Personel headcount BUGÜN — Firma × Pozisyon
  const personnelPivot: Record<string, Record<string, number>> = {};
  const personnelCols = new Set<string>();
  const personnelRows = new Set<string>();
  for (const a of projectAttendance) {
    if (a.date !== project.reportDate) continue;
    const p = personById.get(a.personnelMasterId);
    if (!p) continue;
    const job = p.jobTitle ?? "—";
    const company = p.company;
    personnelCols.add(job);
    personnelRows.add(company);
    if (!personnelPivot[company]) personnelPivot[company] = {};
    personnelPivot[company][job] = (personnelPivot[company][job] || 0) + 1;
  }
  const personnelJobs = Array.from(personnelCols).sort((a, b) => a.localeCompare(b, "tr"));
  const personnelCompanies = Array.from(personnelRows).sort((a, b) => a.localeCompare(b, "tr"));

  // Personel son 7 gün
  const days7: { d: string; count: number; hours: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = toISODate(new Date(new Date(project.reportDate).getTime() - i * 86400000));
    const today = projectAttendance.filter((a) => a.date === d);
    days7.push({ d, count: today.length, hours: today.reduce((s, a) => s + (a.hours || 0), 0) });
  }
  const max7 = Math.max(1, ...days7.map((x) => x.count));

  // Makine
  const projMachine = machineAttendance.filter((a) => a.projectId === project.id && a.present);
  const totalMachineHours = projMachine.reduce((s, a) => s + (a.hours || 0), 0);
  const uniqueMachines = new Set(projMachine.map((a) => a.machineMasterId)).size;
  const todayMachines = projMachine.filter((a) => a.date === project.reportDate).length;

  // Makine pivot — Firma × Tip
  const machineById = new Map(machines.map((m) => [m.id, m]));
  const machinePivot: Record<string, Record<string, number>> = {};
  const machineCols = new Set<string>();
  const machineRowsSet = new Set<string>();
  for (const a of projMachine) {
    if (a.date !== project.reportDate) continue;
    const m = machineById.get(a.machineMasterId);
    if (!m) continue;
    machineCols.add(m.machineType);
    machineRowsSet.add(m.company);
    if (!machinePivot[m.company]) machinePivot[m.company] = {};
    machinePivot[m.company][m.machineType] = (machinePivot[m.company][m.machineType] || 0) + 1;
  }
  const machineTypes = Array.from(machineCols).sort();
  const machineCompanies = Array.from(machineRowsSet).sort((a, b) => a.localeCompare(b, "tr"));

  // Finansal
  const projBilling = billing.filter((b) => b.projectId === project.id && b.direction === "owner_incoming");
  const ownerInvoiced = projBilling.filter((b) => b.status !== "iptal").reduce((s, b) => s + b.amount, 0);
  const ownerPaid = projBilling.filter((b) => b.status === "odendi").reduce((s, b) => s + b.amount, 0);
  const contractAmount = project.totalBudget ?? 0;
  const invoicedPct = contractAmount > 0 ? (ownerInvoiced / contractAmount) * 100 : 0;
  const paidPct = contractAmount > 0 ? (ownerPaid / contractAmount) * 100 : 0;
  const openBalance = Math.max(0, contractAmount - ownerInvoiced);

  // Procurement
  const projProc = procurement.filter((p) => p.projectId === project.id);
  const procPending = projProc.filter((p) => !p.actualDeliveredDate).length;
  const procDone = projProc.filter((p) => p.actualDeliveredDate).length;
  const procCritical = projProc.filter((p) => p.isCritical && !p.actualDeliveredDate).length;
  const procFollow = procurementFollowup(projProc, project.reportDate).slice(0, 8);

  // Lookahead — kritik_is ve diğerleri ayrı
  const openLookahead = lookahead.filter((l) => l.projectId === project.id && !l.done);
  const critOpen = openLookahead.filter((l) => l.priority === "critical").length;
  const today = project.reportDate;
  const fifteen = toISODate(new Date(new Date(today).getTime() + 15 * 86400000));
  const next15Critical = openLookahead
    .filter((l) => (l.kind ?? "kritik_is") === "kritik_is" && l.date <= fifteen)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);
  const claimTutanak = openLookahead
    .filter((l) => (l.kind ?? "kritik_is") !== "kritik_is")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  // Son 5 gün faaliyet
  const fiveDaysAgo = toISODate(new Date(new Date(today).getTime() - 4 * 86400000));
  const recentActivity: { date: string; code: string; name: string; qty: number; unit: string }[] = [];
  for (const [code, byDate] of Object.entries(realized)) {
    for (const [d, qty] of Object.entries(byDate)) {
      if (d >= fiveDaysAgo && d <= today) {
        const w = wbs.find((x) => x.code === code);
        if (w) recentActivity.push({ date: d, code, name: w.name, qty, unit: w.unit });
      }
    }
  }
  recentActivity.sort((a, b) => b.date.localeCompare(a.date));
  const top10Activity = recentActivity.slice(0, 12);

  // Saha foto
  const latestReport = [...dailyReports]
    .filter((d) => d.projectId === project.id)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0];
  const dronePhoto = latestReport?.photos?.[0];

  // SPI rengi
  const spiL = spiLevel(spi);
  const spiColor = spiL === "good" ? "#10b981" : spiL === "warn" ? "#d97706" : spiL === "bad" ? "#dc2626" : "#94a3b8";

  // Marka
  const initials = project.name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);

  // ════════════════════════════════════════════════════════════════════
  // HIDDEN DOM
  // ════════════════════════════════════════════════════════════════════
  const W = 794;
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${W}px;
    background: #ffffff;
    color: #0f172a;
    font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.45;
  `;

  // S-curve master
  const sCurveSvg = renderSCurveSvg(sCurve, project.reportDate);

  // Bölüm S-eğrileri (mini)
  const sectionSCurvesHtml = sections.length > 0
    ? `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">${sections.map((sec) => {
        const sCurveSec = buildSectionSCurve(wbs, planned, realized, sec.code, project.reportDate, allDates);
        const sLvl = spiLevel(sec.spi);
        const sColor = sLvl === "good" ? "#10b981" : sLvl === "warn" ? "#d97706" : sLvl === "bad" ? "#dc2626" : "#94a3b8";
        return `
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:#fafafa;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <div style="font-size:11px;font-weight:700;color:#0f172a;">
                <span style="font-family:'JetBrains Mono',monospace;color:#64748b;font-size:10px;">${escapeHtml(sec.code)}</span>
                &nbsp;${escapeHtml(sec.name)}
              </div>
              <span style="font-family:'JetBrains Mono',monospace;font-weight:700;font-size:10.5px;color:${sColor};">SPI ${sec.spi == null ? "—" : sec.spi.toFixed(2)}</span>
            </div>
            <div style="display:flex;gap:10px;font-size:10px;color:#475569;margin-bottom:6px;">
              <span style="color:#2563eb;font-weight:700;">P ${(sec.planPct * 100).toFixed(0)}%</span>
              <span style="color:#10b981;font-weight:700;">G ${(sec.realPct * 100).toFixed(0)}%</span>
              <span style="margin-left:auto;color:#94a3b8;">${sec.leafCount} kalem</span>
            </div>
            ${renderMiniSCurveSvg(sCurveSec, project.reportDate)}
          </div>
        `;
      }).join("")}</div>`
    : "";

  // Bölüm tablosu
  const sectionsRows = sections.map((s) => {
    const planP = s.planPct * 100;
    const realP = s.realPct * 100;
    const sLvl = spiLevel(s.spi);
    const sColor = sLvl === "good" ? "#10b981" : sLvl === "warn" ? "#d97706" : sLvl === "bad" ? "#dc2626" : "#94a3b8";
    return `
      <tr>
        <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:#64748b;width:42px;">${escapeHtml(s.code)}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;">${escapeHtml(s.name)}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#2563eb;width:60px;">${planP.toFixed(0)}%</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#10b981;width:60px;">${realP.toFixed(0)}%</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:${sColor};width:60px;">${s.spi == null ? "—" : s.spi.toFixed(2)}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;width:160px;">
          <div style="position:relative;height:7px;border-radius:4px;background:#f1f5f9;overflow:hidden;">
            <div style="position:absolute;inset:0;background:#93c5fd;width:${Math.min(100, planP)}%;"></div>
            <div style="position:absolute;inset:0;background:#10b981;width:${Math.min(100, realP)}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  // Disiplin tablosu
  const disciplineRowsHtml = disciplineRows.length === 0
    ? `<tr><td colspan="5" style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Puantaj kaydı bulunmuyor.</td></tr>`
    : disciplineRows.map((d) => {
        const breakdown = discCompany[d.discipline] ?? {};
        const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
        const discTotal = entries.reduce((s, [, h]) => s + h, 0);
        const top3 = entries.slice(0, 3).map(([c, h]) => `<span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#f1f5f9;font-size:9px;font-weight:600;color:#475569;margin-right:3px;">${escapeHtml(c)} <strong style="color:#10b981;">%${discTotal > 0 ? Math.round((h / discTotal) * 100) : 0}</strong></span>`).join("");
        const rest = Math.max(0, entries.length - 3);
        const sharePct = totalManhours > 0 ? (d.hours / totalManhours) * 100 : 0;
        return `
          <tr>
            <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;width:90px;">${escapeHtml(getDisciplineLabel(d.discipline))}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#0f172a;width:70px;">${formatNumber(d.hours, 0)}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#10b981;width:60px;">${formatNumber(d.manDays, 0)}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;color:#475569;width:50px;">${d.uniquePeople}</td>
            <td style="padding:7px 9px;border-bottom:1px solid #e5e7eb;">${top3}${rest > 0 ? `<span style="display:inline-block;padding:1px 5px;border-radius:3px;background:#f8fafc;font-size:9px;color:#94a3b8;font-weight:600;">+${rest}</span>` : ""}<div style="margin-top:3px;height:4px;background:#f1f5f9;border-radius:2px;overflow:hidden;"><div style="height:100%;background:#10b981;width:${sharePct}%;"></div></div></td>
          </tr>
        `;
      }).join("");

  // Headcount 7 gün
  const headcount7Bars = days7.map((d) => {
    const h = max7 > 0 ? (d.count / max7) * 60 : 0;
    const isToday = d.d === today;
    const label = d.d.slice(8, 10) + "." + d.d.slice(5, 7);
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
        <div style="font-size:9.5px;font-weight:700;color:#0f172a;font-family:'JetBrains Mono',ui-monospace,monospace;">${d.count}</div>
        <div style="width:100%;display:flex;flex-direction:column;justify-content:flex-end;height:62px;">
          <div style="height:${Math.max(2, h)}px;background:${isToday ? "#10b981" : "#86efac"};border-radius:3px 3px 0 0;"></div>
        </div>
        <div style="font-size:8.5px;color:${isToday ? "#10b981" : "#94a3b8"};font-weight:${isToday ? 700 : 500};font-family:'JetBrains Mono',ui-monospace,monospace;">${label}</div>
      </div>
    `;
  }).join("");

  // Personel pivot
  const personnelPivotHtml = personnelCompanies.length === 0
    ? `<div style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Bugün sahada personel kaydı yok.</div>`
    : `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Firma</th>
            ${personnelJobs.map((j) => `<th style="padding:6px 8px;text-align:center;font-size:9px;font-weight:700;letter-spacing:1.1px;color:#64748b;text-transform:uppercase;">${escapeHtml(j)}</th>`).join("")}
            <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Top.</th>
          </tr>
        </thead>
        <tbody>
          ${personnelCompanies.map((c) => {
            const row = personnelPivot[c];
            const total = personnelJobs.reduce((s, j) => s + (row?.[j] ?? 0), 0);
            return `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;">${escapeHtml(c)}</td>
                ${personnelJobs.map((j) => {
                  const v = row?.[j] ?? 0;
                  return `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:${v > 0 ? 700 : 400};color:${v > 0 ? "#0f172a" : "#cbd5e1"};">${v > 0 ? v : "—"}</td>`;
                }).join("")}
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#10b981;">${total}</td>
              </tr>
            `;
          }).join("")}
          <tr style="background:#fef3c7;">
            <td style="padding:6px 8px;font-weight:700;color:#92400e;text-transform:uppercase;font-size:9px;letter-spacing:1px;">Toplam</td>
            ${personnelJobs.map((j) => {
              const total = personnelCompanies.reduce((s, c) => s + (personnelPivot[c]?.[j] ?? 0), 0);
              return `<td style="padding:6px 8px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#92400e;">${total}</td>`;
            }).join("")}
            <td style="padding:6px 8px;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:800;color:#92400e;">${todayPersonnel}</td>
          </tr>
        </tbody>
      </table>
    `;

  // Makine pivot
  const machinePivotHtml = machineCompanies.length === 0
    ? `<div style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Bugün sahada makine kaydı yok.</div>`
    : `
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Firma</th>
            ${machineTypes.map((t) => `<th style="padding:6px 8px;text-align:center;font-size:9px;font-weight:700;letter-spacing:1.1px;color:#64748b;text-transform:uppercase;text-transform:capitalize;">${escapeHtml(t)}</th>`).join("")}
            <th style="padding:6px 8px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Top.</th>
          </tr>
        </thead>
        <tbody>
          ${machineCompanies.map((c) => {
            const row = machinePivot[c];
            const total = machineTypes.reduce((s, t) => s + (row?.[t] ?? 0), 0);
            return `
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;">${escapeHtml(c)}</td>
                ${machineTypes.map((t) => {
                  const v = row?.[t] ?? 0;
                  return `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:${v > 0 ? 700 : 400};color:${v > 0 ? "#0f172a" : "#cbd5e1"};">${v > 0 ? v : "—"}</td>`;
                }).join("")}
                <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#10b981;">${total}</td>
              </tr>
            `;
          }).join("")}
          <tr style="background:#fef3c7;">
            <td style="padding:6px 8px;font-weight:700;color:#92400e;text-transform:uppercase;font-size:9px;letter-spacing:1px;">Toplam</td>
            ${machineTypes.map((t) => {
              const total = machineCompanies.reduce((s, c) => s + (machinePivot[c]?.[t] ?? 0), 0);
              return `<td style="padding:6px 8px;text-align:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#92400e;">${total}</td>`;
            }).join("")}
            <td style="padding:6px 8px;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:800;color:#92400e;">${todayMachines}</td>
          </tr>
        </tbody>
      </table>
    `;

  // Procurement
  const procRowsHtml = procFollow.length === 0
    ? `<tr><td colspan="4" style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Yaklaşan kritik teslim yok.</td></tr>`
    : procFollow.map((p) => {
      const m = p.milestones[p.milestones.length - 1];
      const display = m.isCompleted && m.actualDate ? `✓ ${formatDate(m.actualDate)}` : m.plannedDate ? formatDate(m.plannedDate) : "—";
      const tone = m.isCompleted ? "#10b981" : m.isOverdue ? "#dc2626" : m.isUpcoming ? "#d97706" : "#64748b";
      const sub = !m.isCompleted && m.daysFromToday != null ? (m.daysFromToday < 0 ? `${-m.daysFromToday}g gecikme` : `${m.daysFromToday}g kaldı`) : "";
      return `
        <tr>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;width:14px;">${p.isCritical ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fbbf24;"></span>` : ""}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;">${escapeHtml(p.item.material)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:10.5px;">${escapeHtml(p.item.supplier ?? "—")}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:${tone};white-space:nowrap;">${display}${sub ? `<div style="font-size:9px;font-weight:500;opacity:0.85;">${sub}</div>` : ""}</td>
        </tr>
      `;
    }).join("");

  // Kritik işler (kritik_is)
  const next15Html = next15Critical.length === 0
    ? `<tr><td colspan="4" style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Açık kritik iş yok.</td></tr>`
    : next15Critical.map((l) => lookaheadRow(l, today)).join("");

  // Claim & Tutanak
  const claimHtml = claimTutanak.length === 0
    ? `<tr><td colspan="4" style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Aktif claim/tutanak yok.</td></tr>`
    : claimTutanak.map((l) => lookaheadRow(l, today)).join("");

  // Son 5 gün faaliyet
  const recentHtml = top10Activity.length === 0
    ? `<tr><td colspan="4" style="padding:14px;text-align:center;color:#94a3b8;font-size:11px;">Son 5 günde gerçekleşme yok.</td></tr>`
    : top10Activity.map((r) => `
        <tr>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:#64748b;width:58px;white-space:nowrap;">${formatDate(r.date)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:#64748b;width:54px;">${escapeHtml(r.code)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;font-weight:500;color:#0f172a;">${escapeHtml(r.name)}</td>
          <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;color:#10b981;white-space:nowrap;">+${formatNumber(r.qty, 1)} ${escapeHtml(r.unit)}</td>
        </tr>
      `).join("");

  // ════════════════════════════════════════════════════════════════════
  // DOM HTML
  // ════════════════════════════════════════════════════════════════════
  root.innerHTML = `
    <div style="padding:22px 22px 30px 22px;">

      <!-- KAPAK / ANTET -->
      <div data-pdf-section data-page-start>
        <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#334155 100%);color:white;padding:16px 22px;border-radius:12px 12px 0 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;opacity:0.85;">
              ${escapeHtml(panelName ?? "Proje Yönetim Platformu")}
            </div>
            <div style="font-size:10px;font-weight:600;opacity:0.85;font-family:'JetBrains Mono',ui-monospace,monospace;">
              YÖNETİM ÖZETİ · ${formatDate(project.reportDate)}
            </div>
          </div>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:22px;background:linear-gradient(180deg,#fafafa 0%,#ffffff 100%);">
          <div style="display:flex;align-items:flex-start;gap:18px;">
            <div style="width:68px;height:68px;border-radius:14px;background:linear-gradient(135deg,#10b981,#047857);color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;letter-spacing:0.5px;flex-shrink:0;box-shadow:0 4px 12px rgba(16,185,129,0.25);">
              ${escapeHtml(initials)}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(16,185,129,0.14);color:#047857;font-size:9.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                ${STATUS_LABEL[project.status] ?? project.status}
              </div>
              <div style="font-size:24px;font-weight:800;letter-spacing:-0.4px;margin-top:6px;line-height:1.1;color:#0f172a;">
                ${escapeHtml(project.name)}
              </div>
              <div style="margin-top:5px;font-size:12.5px;color:#475569;">
                ${escapeHtml(project.location)}${project.installedCapacityMw != null ? ` &nbsp;·&nbsp; <strong style=\"color:#0f172a;\">${project.installedCapacityMw} MW</strong>` : ""}${contractAmount ? ` &nbsp;·&nbsp; <strong style=\"color:#0f172a;\">${formatMoney(contractAmount, project.budgetCurrency, 0)}</strong>` : ""}
              </div>
            </div>
          </div>
          <div style="margin-top:16px;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;border-top:1px dashed #e5e7eb;padding-top:14px;">
            ${metaCell("Başlangıç", formatDate(project.startDate))}
            ${metaCell("Plan Bitiş", formatDate(project.plannedEnd))}
            ${metaCell("Sözleşme", formatDate(project.contractEnd))}
            ${metaCell("Rapor", formatDate(project.reportDate))}
            ${metaCell("Süre", `${elapsed} / ${project.durationDays}g`)}
          </div>
        </div>
      </div>

      <!-- YÖNETİM DEĞERLENDİRMESİ -->
      ${section("Yönetim Değerlendirmesi", `
        <div style="font-size:12.5px;line-height:1.7;color:#1e293b;">
          ${escapeHtml(project.name)} projesi <strong>${formatDate(project.reportDate)}</strong> itibarıyla
          <strong style="color:${realPct >= planPct ? "#10b981" : "#dc2626"}">${realPct >= planPct ? "plan üzerinde" : "plan altında"}</strong>
          ilerlemekte. Planlanan ilerleme <strong style="color:#2563eb">%${(planPct * 100).toFixed(1)}</strong>,
          gerçekleşen ilerleme <strong style="color:#10b981">%${(realPct * 100).toFixed(1)}</strong>.
          Performans Endeksi (SPI) <strong style="color:${spiColor}">${spi == null ? "—" : spi.toFixed(3)}</strong>${spi != null ? (spi >= 0.95 ? " — sağlıklı seyrediyor" : spi >= 0.85 ? " — yakın takip gerekiyor" : " — acil aksiyon gerekli") : ""}.
          Süre kullanımı <strong>%${durationPct.toFixed(0)}</strong> (${elapsed}/${project.durationDays} gün; ${remaining} gün kaldı).
        </div>
        <div style="margin-top:8px;font-size:12.5px;line-height:1.7;color:#1e293b;">
          ${critOpen > 0 ? `<strong style="color:#dc2626">${critOpen} açık kritik iş</strong> bulunuyor; ilerideki 15 gün içinde <strong>${next15Critical.length}</strong> kalem yönetim takibi gerektiriyor.` : `Önümüzdeki 15 günde <strong>${next15Critical.length}</strong> aksiyon kalemi takipte; açık kritik iş yok.`}
          Finansal: sözleşmenin <strong>%${invoicedPct.toFixed(1)}</strong>'i faturalandı, <strong>%${paidPct.toFixed(1)}</strong>'i tahsil edildi.
          Operasyon: bugün <strong>${todayPersonnel}</strong> personel ve <strong>${todayMachines}</strong> makine sahada; toplam <strong>${formatNumber(totalManhours, 0)}</strong> adam-saat harcandı.
        </div>
      `)}

      <!-- KPI GRID -->
      ${section("Kritik Göstergeler", `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          ${bigKpi("Planlanan İlerleme", `${(planPct * 100).toFixed(1)}%`, "#2563eb", "Baseline'a göre öngörülen")}
          ${bigKpi("Gerçekleşen İlerleme", `${(realPct * 100).toFixed(1)}%`, "#10b981", "Sahada yapılan")}
          ${bigKpi("SPI", spi == null ? "—" : spi.toFixed(3), spiColor, "Plan vs Gerçek oranı")}
          ${bigKpi("Adam-Saat", formatNumber(totalManhours, 0), "#7c3aed", `${uniquePersonnel} tekil personel`)}
          ${bigKpi("Makine-Saat", formatNumber(totalMachineHours, 0), "#0891b2", `${uniqueMachines} tekil makine`)}
          ${bigKpi("Süre Kullanımı", `${durationPct.toFixed(0)}%`, "#dc2626", `${remaining} gün kaldı`)}
        </div>
      `)}

      <!-- S-CURVE -->
      ${section("Plan vs Gerçekleşme · S-Eğrisi", `
        <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
          ${sCurveSvg}
          <div style="display:flex;gap:18px;margin-top:10px;font-size:11px;justify-content:center;">
            <span style="display:flex;align-items:center;gap:6px;color:#475569;">
              <span style="display:inline-block;width:18px;height:3px;background:#2563eb;border-radius:2px;"></span>
              <strong>Planlanan</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#475569;">
              <span style="display:inline-block;width:18px;height:3px;background:#10b981;border-radius:2px;"></span>
              <strong>Gerçekleşen</strong>
            </span>
            <span style="display:flex;align-items:center;gap:6px;color:#475569;">
              <span style="display:inline-block;width:2px;height:14px;background:#dc2626;"></span>
              <strong>Bugün</strong>
            </span>
          </div>
        </div>
      `)}

      ${sections.length > 0 ? section("Bölüm İlerlemesi · L1 Tablosu", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Kod</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Bölüm</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Plan</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Gerç.</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">SPI</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">İlerleme</th>
              </tr>
            </thead>
            <tbody>${sectionsRows}</tbody>
          </table>
        </div>
      `) : ""}

      ${sections.length > 0 ? section("Bölüm Bazlı S-Eğrileri", sectionSCurvesHtml) : ""}

      ${section("Finansal Durum · İşveren Tarafı", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
            <table style="width:100%;font-size:11.5px;">
              <tr><td style="padding:5px 0;color:#64748b;">Sözleşme Bedeli</td><td style="padding:5px 0;text-align:right;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;color:#0f172a;">${formatMoney(contractAmount, project.budgetCurrency, 0)}</td></tr>
              <tr><td style="padding:5px 0;color:#64748b;">Faturalanan</td><td style="padding:5px 0;text-align:right;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;color:#2563eb;">${formatMoney(ownerInvoiced, project.budgetCurrency, 0)} <span style="color:#94a3b8;font-weight:400;">(%${invoicedPct.toFixed(1)})</span></td></tr>
              <tr><td style="padding:5px 0;color:#64748b;">Tahsil Edilen</td><td style="padding:5px 0;text-align:right;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;color:#10b981;">${formatMoney(ownerPaid, project.budgetCurrency, 0)} <span style="color:#94a3b8;font-weight:400;">(%${paidPct.toFixed(1)})</span></td></tr>
              <tr><td style="padding:5px 0;color:#64748b;border-top:1px dashed #e5e7eb;padding-top:8px;">Açık Bakiye</td><td style="padding:5px 0;text-align:right;font-weight:700;font-family:'JetBrains Mono',ui-monospace,monospace;color:#dc2626;border-top:1px dashed #e5e7eb;padding-top:8px;">${formatMoney(openBalance, project.budgetCurrency, 0)}</td></tr>
            </table>
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Görsel</div>
            ${progressBar("Faturalanan", invoicedPct, "#2563eb")}
            ${progressBar("Tahsil Edilen", paidPct, "#10b981")}
            ${progressBar("Açık Bakiye", 100 - invoicedPct, "#dc2626")}
          </div>
        </div>
      `)}

      ${section("Adam-Saat · Disipline Göre Dağılım", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Disiplin</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Adam-Saat</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Adam-Gün</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Kişi</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Firma %</th>
              </tr>
            </thead>
            <tbody>${disciplineRowsHtml}</tbody>
          </table>
        </div>
      `)}

      ${section("Personel Headcount · Bugün × Son 7 Gün", `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;">
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Bugün · Firma × Pozisyon</div>
            ${personnelPivotHtml}
          </div>
          <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa;">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Son 7 Gün</div>
            <div style="display:flex;gap:6px;align-items:flex-end;">${headcount7Bars}</div>
            <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#475569;">
              <span>Bugün: <strong style="color:#10b981;">${todayPersonnel}</strong></span>
              <span>Adam-saat: <strong style="color:#0f172a;">${formatNumber(todayManhours, 0)}</strong></span>
            </div>
          </div>
        </div>
      `)}

      ${machineCompanies.length > 0 ? section("Makine Headcount · Bugün · Firma × Tip", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa;">
          ${machinePivotHtml}
        </div>
      `) : ""}

      ${section("Satın Alma · Yaklaşan Teslimler", `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
          ${miniStat("Toplam Kalem", String(projProc.length), "#0f172a")}
          ${miniStat("Açık", String(procPending), "#2563eb")}
          ${miniStat("Teslim Alındı", String(procDone), "#10b981")}
        </div>
        ${procCritical > 0 ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:6px;font-size:11px;margin-bottom:10px;"><strong>${procCritical} kritik açık kalem</strong> yönetim dikkati gerektirmekte.</div>` : ""}
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;width:18px;"></th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Malzeme</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Tedarikçi</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Teslim</th>
              </tr>
            </thead>
            <tbody>${procRowsHtml}</tbody>
          </table>
        </div>
      `)}

      ${section("15-Gün Kritik İşler · Aksiyon Listesi", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Tarih</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Görev</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Sorumlu</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Öncelik</th>
              </tr>
            </thead>
            <tbody>${next15Html}</tbody>
          </table>
        </div>
      `)}

      ${claimTutanak.length > 0 ? section("Claim & Tutanak Konuları", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Tarih</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Konu</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Sorumlu</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Tür</th>
              </tr>
            </thead>
            <tbody>${claimHtml}</tbody>
          </table>
        </div>
      `) : ""}

      ${section("Son 5 Günün Faaliyet Özeti", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Tarih</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">WBS</th>
                <th style="padding:8px 9px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">İş Kalemi</th>
                <th style="padding:8px 9px;text-align:right;font-size:9px;font-weight:700;letter-spacing:1.2px;color:#64748b;text-transform:uppercase;">Miktar</th>
            </tr>
            </thead>
            <tbody>${recentHtml}</tbody>
          </table>
        </div>
      `)}

      ${dronePhoto ? section("Saha Fotoğrafı", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;background:#0f172a;">
          <div style="position:relative;width:100%;aspect-ratio:16/9;background:#1e293b;">
            <img src="${escapeHtml(dronePhoto.url)}" alt="Saha" crossorigin="anonymous" style="width:100%;height:100%;object-fit:cover;display:block;" />
          </div>
          ${latestReport?.summary ? `<div style="padding:14px 16px;background:#0f172a;color:#e2e8f0;font-size:11.5px;line-height:1.5;">${escapeHtml(latestReport.summary)}</div>` : ""}
          <div style="padding:8px 16px;font-size:9.5px;color:#94a3b8;font-family:'JetBrains Mono',ui-monospace,monospace;background:#0f172a;border-top:1px solid #1e293b;">
            ${latestReport ? formatDate(latestReport.reportDate) : ""}${dronePhoto.caption ? ` · ${escapeHtml(dronePhoto.caption)}` : ""}
          </div>
        </div>
      `) : ""}

      ${section("Proje Künyesi", `
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;background:#fafafa;display:grid;grid-template-columns:repeat(2,1fr);gap:8px 24px;font-size:11.5px;">
          ${kvp("Proje Adı", project.name)}
          ${kvp("Durum", STATUS_LABEL[project.status] ?? project.status)}
          ${kvp("Lokasyon", project.location)}
          ${kvp("Kurulu Güç", project.installedCapacityMw != null ? `${project.installedCapacityMw} MW` : "—")}
          ${kvp("Başlangıç", formatDate(project.startDate))}
          ${kvp("Plan Bitiş", formatDate(project.plannedEnd))}
          ${kvp("Sözleşme Bitiş", formatDate(project.contractEnd))}
          ${kvp("Süre", `${project.durationDays} gün`)}
          ${kvp("Bütçe", contractAmount ? formatMoney(contractAmount, project.budgetCurrency, 0) : "—")}
          ${kvp("Rapor Tarihi", formatDate(project.reportDate))}
        </div>
      `)}

      <!-- İMZA -->
      <div data-pdf-section style="margin-top:32px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;">
          <div>
            <div style="border-bottom:1.5px solid #0f172a;height:34px;"></div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#64748b;margin-top:5px;text-align:center;">Saha Mühendisi</div>
          </div>
          <div>
            <div style="border-bottom:1.5px solid #0f172a;height:34px;"></div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#64748b;margin-top:5px;text-align:center;">Proje Yöneticisi</div>
          </div>
          <div>
            <div style="border-bottom:1.5px solid #0f172a;height:34px;"></div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:#64748b;margin-top:5px;text-align:center;">Direktör</div>
          </div>
        </div>
        <div style="margin-top:18px;padding-top:10px;border-top:1px dashed #e5e7eb;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;font-family:'JetBrains Mono',ui-monospace,monospace;">
          <span>${escapeHtml(panelName ?? "Proje Yönetim Platformu")}${preparedBy ? ` · Hazırlayan: ${escapeHtml(preparedBy)}` : ""}</span>
          <span>${formatDate(project.reportDate)} · proje-yonetim-platformu</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Resimlerin yüklenmesini bekle
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          const done = () => res();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, 5000);
        })
    )
  );
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: W,
    });

    // Bölüm sınırlarını topla — html scale ile çarp
    const scale = 2;
    const rootRect = root.getBoundingClientRect();
    const sectionEls = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-section]"));
    const sectionTops = sectionEls.map((el) => (el.getBoundingClientRect().top - rootRect.top) * scale);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pxPerMm = canvas.width / pageW;
    const pageHpx = pageH * pxPerMm;

    let pageStart = 0;
    let pageNo = 0;
    const totalH = canvas.height;

    while (pageStart < totalH) {
      let pageEnd = Math.min(pageStart + pageHpx, totalH);

      // En son sayfa değilse — sayfa içinde başlayan bir section sınırı varsa orada kes
      if (pageEnd < totalH) {
        const cuts = sectionTops.filter((t) => t > pageStart + 60 && t <= pageEnd);
        if (cuts.length > 0) {
          // Son cut'tan önce kes — böylece o section yeni sayfaya geçer
          pageEnd = cuts[cuts.length - 1];
        }
      }

      const sliceH = pageEnd - pageStart;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, -pageStart);
      const imgData = slice.toDataURL("image/png");
      if (pageNo > 0) pdf.addPage();
      const imgMmH = sliceH / pxPerMm;
      pdf.addImage(imgData, "PNG", 0, 0, pageW, imgMmH);

      // Footer
      pdf.setFontSize(7);
      pdf.setTextColor(160, 160, 160);
      pdf.text(
        `${panelName ?? "Proje Yönetim Platformu"} · ${project.name} · ${formatDate(project.reportDate)}${preparedBy ? ` · ${preparedBy}` : ""}`,
        pageW / 2,
        pageH - 4,
        { align: "center" }
      );
      pdf.text(`Sayfa ${pageNo + 1}`, pageW - 8, pageH - 4, { align: "right" });

      pageStart = pageEnd;
      pageNo++;
    }

    pdf.save(`${project.name.replace(/\s+/g, "-")}-yonetim-ozeti-${project.reportDate}.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// YARDIMCILAR
// ═════════════════════════════════════════════════════════════════════════

function section(title: string, body: string): string {
  return `
    <div data-pdf-section style="margin-top:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="display:inline-block;width:3px;height:18px;background:linear-gradient(180deg,#10b981,#047857);border-radius:2px;"></span>
        <span style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#475569;">${escapeHtml(title)}</span>
        <span style="flex:1;height:1px;background:linear-gradient(90deg,#e5e7eb,transparent);"></span>
      </div>
      ${body}
    </div>
  `;
}

function metaCell(label: string, value: string): string {
  return `
    <div style="text-align:center;">
      <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;">${escapeHtml(label)}</div>
      <div style="font-size:12px;font-weight:700;color:#0f172a;margin-top:3px;font-family:'JetBrains Mono',ui-monospace,monospace;">${escapeHtml(value)}</div>
    </div>
  `;
}

function bigKpi(label: string, value: string, color: string, sub: string): string {
  return `
    <div style="background:linear-gradient(180deg,#ffffff,#fafafa);border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;">${escapeHtml(label)}</div>
      <div style="font-size:28px;font-weight:800;color:${color};margin-top:4px;font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:-0.6px;line-height:1;">${escapeHtml(value)}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:5px;">${escapeHtml(sub)}</div>
    </div>
  `;
}

function miniStat(label: string, value: string, color: string): string {
  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;background:white;">
      <div style="font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#94a3b8;">${escapeHtml(label)}</div>
      <div style="font-size:20px;font-weight:800;color:${color};margin-top:3px;font-family:'JetBrains Mono',ui-monospace,monospace;letter-spacing:-0.3px;line-height:1;">${escapeHtml(value)}</div>
    </div>
  `;
}

function progressBar(label: string, pct: number, color: string): string {
  const v = Math.max(0, Math.min(100, pct));
  return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:10.5px;margin-bottom:4px;"><span>${escapeHtml(label)}</span><span style="font-weight:700;color:${color};">${pct.toFixed(1)}%</span></div>
      <div style="height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;"><div style="height:100%;background:${color};width:${v}%;"></div></div>
    </div>
  `;
}

function kvp(label: string, value: string): string {
  return `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb;">
      <span style="color:#64748b;">${escapeHtml(label)}</span>
      <strong style="color:#0f172a;text-align:right;">${escapeHtml(value)}</strong>
    </div>
  `;
}

function lookaheadRow(l: LookaheadItem, today: string): string {
  const d = daysBetween(today, l.date);
  const tone = d < 0 ? "#dc2626" : d <= 3 ? "#d97706" : "#64748b";
  const pTone = l.priority === "critical" ? "#dc2626" : l.priority === "high" ? "#d97706" : l.priority === "medium" ? "#2563eb" : "#94a3b8";
  const pLabel = ({ critical: "KRİTİK", high: "YÜKSEK", medium: "ORTA", low: "DÜŞÜK" } as Record<string, string>)[l.priority] ?? "—";
  return `
    <tr>
      <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;color:${tone};font-weight:700;width:64px;white-space:nowrap;">${formatDate(l.date)}</td>
      <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#0f172a;">${escapeHtml(l.task)}</td>
      <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:10.5px;">${escapeHtml(l.owner ?? "—")}</td>
      <td style="padding:6px 9px;border-bottom:1px solid #e5e7eb;text-align:right;width:64px;"><span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:8.5px;font-weight:700;letter-spacing:0.8px;background:${pTone}1a;color:${pTone};">${pLabel}</span></td>
    </tr>
  `;
}

/** S-curve master (büyük). points: planPct/realPct = 0–100 aralığı, NaN = veri yok */
function renderSCurveSvg(points: SCurvePoint[], reportDate: string): string {
  return renderSCurveSvgGeneric(points, reportDate, 720, 200, { l: 38, r: 14, t: 14, b: 28 }, true);
}

/** Mini S-curve (bölüm bazlı, küçük) */
function renderMiniSCurveSvg(points: SCurvePoint[], reportDate: string): string {
  return renderSCurveSvgGeneric(points, reportDate, 320, 100, { l: 26, r: 10, t: 8, b: 18 }, false);
}

function renderSCurveSvgGeneric(
  points: SCurvePoint[],
  reportDate: string,
  W: number,
  H: number,
  pad: { l: number; r: number; t: number; b: number },
  labels: boolean
): string {
  if (points.length < 2) {
    return `<div style="height:${H}px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;">Yeterli veri yok.</div>`;
  }
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const n = points.length;
  const toX = (i: number) => pad.l + (i / (n - 1)) * innerW;
  // points.planPct ve realPct: 0–100 aralığı (buildSCurve *100)
  const toY = (pct: number) => {
    const v = Math.min(100, Math.max(0, pct));
    return pad.t + (1 - v / 100) * innerH;
  };

  const planPath = points
    .map((p, i) => (i === 0 ? "M" : "L") + toX(i).toFixed(1) + "," + toY(p.planPct).toFixed(1))
    .join("");

  // Real path NaN'a kadar
  let realPath = "";
  let firstReal = true;
  let lastRealIdx = -1;
  for (let i = 0; i < n; i++) {
    const v = points[i].realPct;
    if (Number.isFinite(v)) {
      realPath += (firstReal ? "M" : "L") + toX(i).toFixed(1) + "," + toY(v).toFixed(1);
      firstReal = false;
      lastRealIdx = i;
    } else {
      break;
    }
  }
  const realFillPath =
    lastRealIdx >= 0
      ? `${realPath} L${toX(lastRealIdx).toFixed(1)},${(pad.t + innerH).toFixed(1)} L${toX(0).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`
      : "";

  // Bugün
  let todayIdx = -1;
  for (let i = 0; i < n; i++) if (points[i].date <= reportDate) todayIdx = i;
  const todayX = todayIdx >= 0 ? toX(todayIdx) : null;

  const grids = (labels ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1])
    .map((g) => {
      const y = pad.t + (1 - g) * innerH;
      return `
        <line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>
        ${labels ? `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" fill="#94a3b8" font-family="JetBrains Mono, monospace">${(g * 100).toFixed(0)}%</text>` : ""}
      `;
    })
    .join("");

  const xLabels = labels
    ? [0, Math.floor(n / 2), n - 1]
        .map(
          (i) =>
            `<text x="${toX(i)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="JetBrains Mono, monospace">${formatDate(points[i].date).slice(0, 5)}</text>`
        )
        .join("")
    : "";

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">
      <rect x="0" y="0" width="${W}" height="${H}" fill="white"/>
      ${grids}
      ${realFillPath ? `<path d="${realFillPath}" fill="#10b981" fill-opacity="0.12"/>` : ""}
      <path d="${planPath}" fill="none" stroke="#2563eb" stroke-width="${labels ? 2.2 : 1.6}" stroke-dasharray="5 4" stroke-linejoin="round"/>
      ${realPath ? `<path d="${realPath}" fill="none" stroke="#10b981" stroke-width="${labels ? 2.6 : 1.8}" stroke-linejoin="round"/>` : ""}
      ${todayX != null
        ? `<line x1="${todayX}" y1="${pad.t}" x2="${todayX}" y2="${pad.t + innerH}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3 3"/>
           ${labels && lastRealIdx >= 0 ? `<circle cx="${toX(lastRealIdx)}" cy="${toY(points[lastRealIdx].realPct)}" r="4" fill="#10b981" stroke="white" stroke-width="2"/>` : ""}
           ${labels ? `<circle cx="${todayX}" cy="${toY(points[todayIdx].planPct)}" r="4" fill="#2563eb" stroke="white" stroke-width="2"/>` : ""}`
        : ""}
      ${xLabels}
    </svg>
  `;
}
