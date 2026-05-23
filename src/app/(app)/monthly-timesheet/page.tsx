"use client";

import { useMemo, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  HardHat,
  Truck,
  FileDown,
  FileSpreadsheet,
  X,
  Info,
} from "lucide-react";
import {
  useStore,
  useCurrentProject,
} from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  cn,
  formatDate,
  formatMoney,
  formatNumber,
  type Currency,
} from "@/lib/utils";
import type {
  PersonnelMaster,
  MachineMaster,
  PersonnelAttendance,
  MachineAttendance,
} from "@/lib/store/types";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_DOW_SHORT = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"];

const OVERTIME_THRESHOLD = 8; // 8 saat üzeri mesai

type TabKind = "personnel" | "machine";
type CellStatus = "worked" | "rapor" | "absent" | "closed";

interface DayCell {
  date: string;       // ISO
  day: number;        // 1..31
  dow: number;        // 0=Sun ... 6=Sat
  isSunday: boolean;
  inFuture: boolean;
}

interface PersonnelCellState {
  kind: CellStatus;
  hours: number;
}
interface MachineCellState {
  kind: "worked" | "absent" | "closed";
  hours: number;
}

interface PersonnelPayroll {
  normalHours: number;       // hafta içi normal (≤8h) + rapor günleri (her biri 8h sayılır)
  overtimeHours: number;     // hafta içi >8h ek saatleri (1.5x)
  sundayWorkedHours: number; // pazar günü çalışılan saatler (1.5x)
  sundayEntitledDays: number;// hak edilen pazar tatil günü sayısı (8h base × 1.0)
  raporDays: number;
  absentDays: number;
  workedDays: number;        // gün sayısı (worked olarak işaretli)
  tutar: number;             // toplam TL
}

// Local tarih → "YYYY-MM-DD" (saat dilimi çevirimi yapmaz; toISODate UTC kullandığı için
// Türkiye saatinde 1 gün geri kayma yaşanabiliyor).
function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function ymdISO(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthDays(year: number, month0: number): DayCell[] {
  const last = new Date(year, month0 + 1, 0).getDate();
  const todayIso = localISO(new Date());
  const out: DayCell[] = [];
  for (let d = 1; d <= last; d++) {
    const dt = new Date(year, month0, d);
    const iso = ymdISO(year, month0, d);
    out.push({
      date: iso,
      day: d,
      dow: dt.getDay(),
      isSunday: dt.getDay() === 0,
      inFuture: iso > todayIso,
    });
  }
  return out;
}

/** Pazar günü için: o pazarın hafta içi günlerinde (Pzt-Cmt) çalışma/rapor var mı? */
function sundayEntitled(
  sundayISO: string,
  personCellByDate: Map<string, PersonnelCellState>
): boolean {
  // Pazardan geriye 6 gün (Pzt-Cmt) bak — local tarih aritmetiği ile (UTC kaymasından kaçın).
  const sundayDt = new Date(sundayISO + "T00:00:00");
  for (let back = 1; back <= 6; back++) {
    const dt = new Date(sundayDt);
    dt.setDate(sundayDt.getDate() - back);
    const iso = localISO(dt);
    const c = personCellByDate.get(iso);
    if (c && (c.kind === "worked" || c.kind === "rapor")) return true;
  }
  return false;
}

function computePersonnelPayroll(
  days: DayCell[],
  cells: PersonnelCellState[],
  cellByDate: Map<string, PersonnelCellState>,
  dailyRate: number
): PersonnelPayroll {
  const hourly = dailyRate / 8;
  let normalHours = 0;
  let overtimeHours = 0;
  let sundayWorkedHours = 0;
  let sundayEntitledDays = 0;
  let raporDays = 0;
  let absentDays = 0;
  let workedDays = 0;

  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const c = cells[i];
    // Personelin işe giriş–çıkış / atama dışı günleri tamamen atla.
    if (c.kind === "closed") continue;
    if (d.isSunday) {
      // Pazar mantığı
      if (c.kind === "rapor") {
        // Rapor pazar: 8h × hourly olarak ödenir (rapor ödemesi)
        raporDays++;
        normalHours += 8;
      } else {
        const entitled = sundayEntitled(d.date, cellByDate);
        if (entitled) sundayEntitledDays++;
        if (c.kind === "worked") {
          sundayWorkedHours += c.hours;
          workedDays++;
        } else if (c.kind === "absent") {
          absentDays++;
        }
      }
    } else {
      // Pzt-Cmt
      if (c.kind === "worked") {
        const n = Math.min(c.hours, OVERTIME_THRESHOLD);
        const ot = Math.max(c.hours - OVERTIME_THRESHOLD, 0);
        normalHours += n;
        overtimeHours += ot;
        workedDays++;
      } else if (c.kind === "rapor") {
        raporDays++;
        normalHours += 8;
      } else {
        absentDays++;
      }
    }
  }

  const tutar =
    normalHours * hourly +
    overtimeHours * hourly * 1.5 +
    sundayEntitledDays * 8 * hourly +
    sundayWorkedHours * hourly * 1.5;

  return {
    normalHours,
    overtimeHours,
    sundayWorkedHours,
    sundayEntitledDays,
    raporDays,
    absentDays,
    workedDays,
    tutar,
  };
}

interface MachinePayroll {
  totalHours: number;
  workedDays: number;
  tutar: number;
}

function computeMachinePayroll(
  cells: MachineCellState[],
  dailyRate: number
): MachinePayroll {
  const hourly = dailyRate / 8;
  let totalHours = 0;
  let workedDays = 0;
  for (const c of cells) {
    if (c.kind === "worked") {
      totalHours += c.hours;
      workedDays++;
    }
  }
  return { totalHours, workedDays, tutar: totalHours * hourly };
}

export default function MonthlyTimesheetPage() {
  const project = useCurrentProject();
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const machines = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);
  const personnelAssignments = useStore((s) => s.personnelAssignments);
  const machineAssignments = useStore((s) => s.machineAssignments);
  const personnelAttendance = useStore((s) => s.personnelAttendance);
  const machineAttendance = useStore((s) => s.machineAttendance);
  const toast = useToast((s) => s.push);

  // Ay seçimi — default: bugünün ayı
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month0, setMonth0] = useState(today.getMonth()); // 0..11

  const [tab, setTab] = useState<TabKind>("personnel");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const days = useMemo(() => buildMonthDays(year, month0), [year, month0]);

  // ─── Personel sekmesi verisi ─────────────────────────────
  // Personel: bu projeye HER ZAMAN atanmış olanlar (atama bitmiş olsa da listede kalır,
  // sadece atama/işe-giriş-çıkış dışı günler "kapalı" gösterilir).
  type Window = { from: string; to: string | null };
  const personnelWindows = useMemo<Map<string, Window[]>>(() => {
    if (!project) return new Map();
    const m = new Map<string, Window[]>();
    for (const a of personnelAssignments) {
      if (a.projectId !== project.id) continue;
      if (!m.has(a.personnelMasterId)) m.set(a.personnelMasterId, []);
      m.get(a.personnelMasterId)!.push({
        from: a.assignedFrom || "",
        to: a.assignedTo || null,
      });
    }
    return m;
  }, [personnelAssignments, project]);

  const machineWindows = useMemo<Map<string, Window[]>>(() => {
    if (!project) return new Map();
    const m = new Map<string, Window[]>();
    for (const a of machineAssignments) {
      if (a.projectId !== project.id) continue;
      if (!m.has(a.machineMasterId)) m.set(a.machineMasterId, []);
      m.get(a.machineMasterId)!.push({
        from: a.assignedFrom || "",
        to: a.assignedTo || null,
      });
    }
    return m;
  }, [machineAssignments, project]);

  const assignedPersonnel = useMemo<PersonnelMaster[]>(() => {
    if (!project) return [];
    return personnel.filter((p) => personnelWindows.has(p.id));
  }, [personnel, personnelWindows, project]);

  const assignedMachines = useMemo<MachineMaster[]>(() => {
    if (!project) return [];
    return machines.filter((m) => machineWindows.has(m.id));
  }, [machines, machineWindows, project]);

  // Bir tarih, personelin aktif olduğu (işe giriş–çıkış + atama pencerelerinden biri içinde) gün mü?
  function isPersonnelActive(p: PersonnelMaster, dateISO: string): boolean {
    if (p.startDate && dateISO < p.startDate) return false;
    if (p.terminationDate && dateISO > p.terminationDate) return false;
    const wins = personnelWindows.get(p.id) || [];
    for (const w of wins) {
      const fromOk = !w.from || dateISO >= w.from;
      const toOk = !w.to || dateISO <= w.to;
      if (fromOk && toOk) return true;
    }
    return false;
  }
  function isMachineActive(m: MachineMaster, dateISO: string): boolean {
    const wins = machineWindows.get(m.id) || [];
    for (const w of wins) {
      const fromOk = !w.from || dateISO >= w.from;
      const toOk = !w.to || dateISO <= w.to;
      if (fromOk && toOk) return true;
    }
    return false;
  }

  // Firma listesi (görünen tab'a göre)
  const companies = useMemo(() => {
    const src = tab === "personnel" ? assignedPersonnel : assignedMachines;
    return Array.from(new Set(src.map((r) => r.company).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "tr")
    );
  }, [tab, assignedPersonnel, assignedMachines]);

  function switchTab(t: TabKind) {
    setTab(t);
    setFilterCompany("");
  }

  const visiblePersonnel = useMemo(
    () =>
      assignedPersonnel
        .filter((p) => !filterCompany || p.company === filterCompany)
        .sort((a, b) =>
          (a.company + " " + a.firstName + " " + a.lastName).localeCompare(
            b.company + " " + b.firstName + " " + b.lastName,
            "tr"
          )
        ),
    [assignedPersonnel, filterCompany]
  );

  const visibleMachines = useMemo(
    () =>
      assignedMachines
        .filter((m) => !filterCompany || m.company === filterCompany)
        .sort((a, b) =>
          (a.company + " " + a.name).localeCompare(b.company + " " + b.name, "tr")
        ),
    [assignedMachines, filterCompany]
  );

  // Attendance map: `${personId}|${dateISO}` → record
  const personnelAttKey = (pid: string, date: string) => `${pid}|${date}`;
  const personnelAttMap = useMemo(() => {
    if (!project) return new Map<string, PersonnelAttendance>();
    const m = new Map<string, PersonnelAttendance>();
    for (const a of personnelAttendance) {
      if (a.projectId === project.id) {
        m.set(personnelAttKey(a.personnelMasterId, a.date), a);
      }
    }
    return m;
  }, [personnelAttendance, project]);

  const machineAttMap = useMemo(() => {
    if (!project) return new Map<string, MachineAttendance>();
    const m = new Map<string, MachineAttendance>();
    for (const a of machineAttendance) {
      if (a.projectId === project.id) {
        m.set(`${a.machineMasterId}|${a.date}`, a);
      }
    }
    return m;
  }, [machineAttendance, project]);

  // Her personel için ay boyu hücre matrisi + payroll
  const personnelRows = useMemo(() => {
    return visiblePersonnel.map((p) => {
      const cells: PersonnelCellState[] = [];
      const byDate = new Map<string, PersonnelCellState>();
      for (const d of days) {
        let cs: PersonnelCellState;
        if (!isPersonnelActive(p, d.date)) {
          cs = { kind: "closed", hours: 0 };
        } else {
          const a = personnelAttMap.get(personnelAttKey(p.id, d.date));
          if (!a) cs = { kind: "absent", hours: 0 };
          else if (a.status === "rapor") cs = { kind: "rapor", hours: 0 };
          else if (a.present && a.hours > 0) cs = { kind: "worked", hours: a.hours };
          else cs = { kind: "absent", hours: 0 };
        }
        cells.push(cs);
        byDate.set(d.date, cs);
      }
      const payroll = computePersonnelPayroll(
        days,
        cells,
        byDate,
        p.dailyRate ?? 0
      );
      return { p, cells, payroll };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePersonnel, days, personnelAttMap, personnelWindows]);

  const machineRows = useMemo(() => {
    return visibleMachines.map((m) => {
      const cells: MachineCellState[] = [];
      for (const d of days) {
        if (!isMachineActive(m, d.date)) {
          cells.push({ kind: "closed", hours: 0 });
          continue;
        }
        const a = machineAttMap.get(`${m.id}|${d.date}`);
        if (a && a.present && a.hours > 0) {
          cells.push({ kind: "worked", hours: a.hours });
        } else {
          cells.push({ kind: "absent", hours: 0 });
        }
      }
      const payroll = computeMachinePayroll(cells, m.dailyRate ?? 0);
      return { m, cells, payroll };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMachines, days, machineAttMap, machineWindows]);

  // Günlük toplamlar (gün × tab)
  const dailyTotals = useMemo(() => {
    if (tab === "personnel") {
      return days.map((_, di) => {
        let hours = 0;
        let presentCount = 0;
        for (const r of personnelRows) {
          const c = r.cells[di];
          if (c.kind === "worked") {
            hours += c.hours;
            presentCount++;
          }
        }
        return { hours, presentCount };
      });
    }
    return days.map((_, di) => {
      let hours = 0;
      let presentCount = 0;
      for (const r of machineRows) {
        const c = r.cells[di];
        if (c.kind === "worked") {
          hours += c.hours;
          presentCount++;
        }
      }
      return { hours, presentCount };
    });
  }, [tab, days, personnelRows, machineRows]);

  // ─── Ay navigasyonu ──────────────────────────────────────
  function shiftMonth(delta: number) {
    const dt = new Date(year, month0 + delta, 1);
    setYear(dt.getFullYear());
    setMonth0(dt.getMonth());
  }
  function goToCurrentMonth() {
    setYear(today.getFullYear());
    setMonth0(today.getMonth());
  }

  // ─── Excel export ───────────────────────────────────────
  async function exportExcel() {
    if (!project) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const header = [
        "Sıra",
        "Firma",
        "Ad Soyad",
        ...days.map((d) => `${d.day} ${TR_DOW_SHORT[d.dow]}`),
        "Çal.Gün",
        "Normal Saat",
        "Mesai Saat",
        "Pazar Saat",
        "Rapor Gün",
        "Hak.Pazar",
        "Yevmiye (TL)",
        "Toplam (TL)",
      ];
      const rows: (string | number)[][] = [];
      if (tab === "personnel") {
        personnelRows.forEach((r, idx) => {
          const cellTxt = r.cells.map((c) =>
            c.kind === "closed"
              ? "×"
              : c.kind === "worked"
              ? c.hours
              : c.kind === "rapor"
              ? "R"
              : "—"
          );
          rows.push([
            idx + 1,
            r.p.company,
            `${r.p.firstName} ${r.p.lastName}`,
            ...cellTxt,
            r.payroll.workedDays,
            r.payroll.normalHours,
            r.payroll.overtimeHours,
            r.payroll.sundayWorkedHours,
            r.payroll.raporDays,
            r.payroll.sundayEntitledDays,
            r.p.dailyRate ?? 0,
            Number(r.payroll.tutar.toFixed(2)),
          ]);
        });
      } else {
        machineRows.forEach((r, idx) => {
          const cellTxt = r.cells.map((c) =>
            c.kind === "closed" ? "×" : c.kind === "worked" ? c.hours : "—"
          );
          rows.push([
            idx + 1,
            r.m.company,
            `${r.m.name}${r.m.licensePlate ? " · " + r.m.licensePlate : ""}`,
            ...cellTxt,
            r.payroll.workedDays,
            r.payroll.totalHours,
            "", // mesai
            "", // pazar
            "", // rapor
            "", // hak.pazar
            r.m.dailyRate ?? 0,
            Number(r.payroll.tutar.toFixed(2)),
          ]);
        });
      }
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      // Sütun genişlikleri — kompakt, A4 yatayda tek sayfaya sığması için
      const colWidths = [
        { wch: 4 },  // Sıra
        { wch: 18 }, // Firma
        { wch: 22 }, // Ad Soyad / Makine
        ...days.map(() => ({ wch: 3.2 })), // gün sütunları
        { wch: 7 },  // Çal.Gün
        { wch: 8 },  // Normal Saat
        { wch: 8 },  // Mesai Saat
        { wch: 8 },  // Pazar Saat
        { wch: 7 },  // Rapor Gün
        { wch: 8 },  // Hak.Pazar
        { wch: 10 }, // Yevmiye (TL)
        { wch: 12 }, // Toplam (TL)
      ];
      const wsExt = ws as unknown as {
        "!cols"?: typeof colWidths;
        "!freeze"?: { xSplit?: number; ySplit?: number };
        "!margins"?: { left: number; right: number; top: number; bottom: number; header: number; footer: number };
        "!pageSetup"?: { orientation?: string; paperSize?: number; fitToWidth?: number; fitToHeight?: number; scale?: number };
        "!printOptions"?: { horizontalCentered?: boolean };
      };
      wsExt["!cols"] = colWidths;
      // Yatay yönelim + tek sayfa genişliğine sığdır
      wsExt["!pageSetup"] = {
        orientation: "landscape",
        paperSize: 9, // A4
        fitToWidth: 1,
        fitToHeight: 0,
      };
      wsExt["!printOptions"] = { horizontalCentered: true };
      wsExt["!margins"] = {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      };

      const sheetName = `${TR_MONTHS[month0]} ${year}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      const fname = `${project.name.replace(/\s+/g, "-")}-Puantaj-${TR_MONTHS[month0]}-${year}-${tab === "personnel" ? "Personel" : "Makine"}.xlsx`;
      XLSX.writeFile(wb, fname);
      toast("Excel indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("Excel üretilirken hata oluştu", "error");
    }
  }

  // ─── PDF export — A4 yatay, Geist font ──────────────────
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

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
      pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
      pdf.addFont("Geist-Regular.ttf", "Geist", "bold");
      pdf.setFont("Geist", "normal");

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 6;

      // ─── HEADER ───
      const headerH = 22;
      // Gradient — brand-700 → brand-500
      const strips = 200;
      const stripW = (pageW - marginX * 2) / strips;
      for (let i = 0; i < strips; i++) {
        const t = i / (strips - 1);
        const r = Math.round(4 + (16 - 4) * t);
        const g = Math.round(120 + (185 - 120) * t);
        const b = Math.round(87 + (129 - 87) * t);
        pdf.setFillColor(r, g, b);
        pdf.rect(marginX + i * stripW, marginX, stripW + 0.2, headerH, "F");
      }
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text("AYLIK PUANTAJ", marginX + 5, marginX + 6);
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(255, 255, 255);
      pdf.text(project.name, marginX + 5, marginX + 13);
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(220, 252, 231);
      pdf.text(
        `${TR_MONTHS[month0]} ${year}  ·  ${tab === "personnel" ? "Personel" : "Makine"}${filterCompany ? "  ·  " + filterCompany : ""}`,
        marginX + 5,
        marginX + 19
      );
      pdf.setTextColor(0, 0, 0);

      const tableStartY = marginX + headerH + 4;

      // Sütun başlıkları
      const dayCols = days.map((d) => ({
        content: String(d.day),
        styles: {
          halign: "center" as const,
          fontSize: 6,
          fillColor: (d.isSunday ? [254, 226, 226] : [241, 245, 249]) as [number, number, number],
          textColor: (d.isSunday ? [185, 28, 28] : [30, 41, 59]) as [number, number, number],
        },
      }));
      const dowRow = days.map((d) => ({
        content: TR_DOW_SHORT[d.dow],
        styles: {
          halign: "center" as const,
          fontSize: 5,
          fillColor: (d.isSunday ? [254, 226, 226] : [241, 245, 249]) as [number, number, number],
          textColor: (d.isSunday ? [185, 28, 28] : [100, 116, 139]) as [number, number, number],
        },
      }));

      // Body
      type CellDef = { content: string; styles?: Record<string, unknown> };
      const bodyRows: CellDef[][] = [];
      if (tab === "personnel") {
        personnelRows.forEach((r, idx) => {
          const row: CellDef[] = [
            { content: String(idx + 1) },
            { content: `${r.p.firstName} ${r.p.lastName}`, styles: { halign: "left" } },
            { content: r.p.company, styles: { halign: "left", fontSize: 6 } },
            ...r.cells.map((c, ci) => {
              const isSunday = days[ci].isSunday;
              let txt = "—";
              let fill: [number, number, number] | undefined;
              let tc: [number, number, number] | undefined;
              let bold = false;
              if (c.kind === "closed") {
                txt = "×";
                fill = [203, 213, 225]; // slate-300 — kapalı gün
                tc = [100, 116, 139];   // slate-500
              } else if (c.kind === "worked") {
                txt = String(c.hours);
                if (c.hours > OVERTIME_THRESHOLD) {
                  fill = [254, 249, 195];
                  tc = [161, 98, 7];
                  bold = true;
                }
              } else if (c.kind === "rapor") {
                txt = "R";
                fill = [219, 234, 254];
                tc = [30, 64, 175];
                bold = true;
              }
              if (isSunday && !fill) fill = [254, 242, 242];
              return {
                content: txt,
                styles: {
                  halign: "center",
                  fontSize: 6,
                  ...(fill && { fillColor: fill }),
                  ...(tc && { textColor: tc }),
                  ...(bold && { fontStyle: "bold" }),
                },
              } as CellDef;
            }),
            { content: String(r.payroll.workedDays), styles: { halign: "right" } },
            { content: formatNumber(r.payroll.normalHours, 0), styles: { halign: "right" } },
            { content: formatNumber(r.payroll.overtimeHours, 0), styles: { halign: "right", textColor: [161, 98, 7] } },
            { content: formatNumber(r.payroll.sundayWorkedHours, 0), styles: { halign: "right", textColor: [185, 28, 28] } },
            { content: String(r.payroll.raporDays), styles: { halign: "right" } },
            {
              content: formatMoney(r.payroll.tutar, (r.p.dailyRateCurrency ?? "TRY") as Currency, 0),
              styles: { halign: "right", fontStyle: "bold", textColor: [4, 120, 87] },
            },
          ];
          bodyRows.push(row);
        });
      } else {
        machineRows.forEach((r, idx) => {
          const row: CellDef[] = [
            { content: String(idx + 1) },
            { content: r.m.name, styles: { halign: "left" } },
            { content: r.m.company, styles: { halign: "left", fontSize: 6 } },
            ...r.cells.map((c, ci) => {
              const isSunday = days[ci].isSunday;
              let txt = "—";
              let fill: [number, number, number] | undefined;
              let bold = false;
              if (c.kind === "closed") {
                txt = "×";
                fill = [203, 213, 225];
              } else if (c.kind === "worked") {
                txt = String(c.hours);
                if (c.hours > OVERTIME_THRESHOLD) {
                  fill = [254, 249, 195];
                  bold = true;
                }
              }
              if (isSunday && !fill) fill = [254, 242, 242];
              return {
                content: txt,
                styles: {
                  halign: "center",
                  fontSize: 6,
                  ...(fill && { fillColor: fill }),
                  ...(bold && { fontStyle: "bold", textColor: [161, 98, 7] }),
                },
              } as CellDef;
            }),
            { content: String(r.payroll.workedDays), styles: { halign: "right" } },
            { content: formatNumber(r.payroll.totalHours, 0), styles: { halign: "right" } },
            { content: "—", styles: { halign: "right" } },
            { content: "—", styles: { halign: "right" } },
            { content: "—", styles: { halign: "right" } },
            {
              content: formatMoney(r.payroll.tutar, (r.m.dailyRateCurrency ?? "TRY") as Currency, 0),
              styles: { halign: "right", fontStyle: "bold", textColor: [4, 120, 87] },
            },
          ];
          bodyRows.push(row);
        });
      }

      // Sütun genişlikleri — A4 yataya sığması için kesin hesap (önceki -90 hatalıydı,
      // tablo sağa taşıyordu). Diğer sütunlar toplamı 106mm; günler kalanı eşit paylaşır.
      const COL_NO = 6;
      const COL_NAME = 24;
      const COL_FIRMA = 18;
      const COL_GUN = 7;
      const COL_NORMAL = 9;
      const COL_MESAI = 9;
      const COL_PAZAR = 9;
      const COL_RAPOR = 8;
      const COL_TOTAL_TL = 16;
      const FIXED_COLS_TOTAL =
        COL_NO + COL_NAME + COL_FIRMA + COL_GUN + COL_NORMAL + COL_MESAI + COL_PAZAR + COL_RAPOR + COL_TOTAL_TL;
      const dayCellWidth = Math.max(
        3,
        (pageW - marginX * 2 - FIXED_COLS_TOTAL) / days.length
      );

      autoTable(pdf, {
        startY: tableStartY,
        margin: { left: marginX, right: marginX, bottom: 10 },
        tableWidth: "wrap",
        head: [
          [
            { content: "#", rowSpan: 2 },
            { content: tab === "personnel" ? "Ad Soyad" : "Makine", rowSpan: 2, styles: { halign: "left" } },
            { content: "Firma", rowSpan: 2, styles: { halign: "left" } },
            ...dayCols,
            { content: "Gün", rowSpan: 2 },
            { content: "Normal", rowSpan: 2 },
            { content: "Mesai", rowSpan: 2 },
            { content: "Pazar", rowSpan: 2 },
            { content: "Rapor", rowSpan: 2 },
            { content: "Toplam (TL)", rowSpan: 2 },
          ],
          dowRow,
        ],
        body: bodyRows,
        styles: {
          font: "Geist",
          fontSize: 6,
          cellPadding: { top: 0.8, right: 1, bottom: 0.8, left: 1 },
          overflow: "linebreak",
          valign: "middle",
          lineColor: [220, 220, 230],
          lineWidth: 0.08,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 6,
          halign: "center",
        },
        columnStyles: (() => {
          const c: Record<number, Record<string, unknown>> = {
            0: { cellWidth: COL_NO, halign: "center", fontSize: 5.5 },
            1: { cellWidth: COL_NAME, halign: "left", fontSize: 6.5, fontStyle: "bold" },
            2: { cellWidth: COL_FIRMA, halign: "left", fontSize: 5.5, textColor: [100, 116, 139] },
          };
          for (let i = 0; i < days.length; i++) {
            c[3 + i] = { cellWidth: dayCellWidth, halign: "center" };
          }
          const start = 3 + days.length;
          c[start] = { cellWidth: COL_GUN, halign: "right", fontSize: 6 };
          c[start + 1] = { cellWidth: COL_NORMAL, halign: "right", fontSize: 6 };
          c[start + 2] = { cellWidth: COL_MESAI, halign: "right", fontSize: 6 };
          c[start + 3] = { cellWidth: COL_PAZAR, halign: "right", fontSize: 6 };
          c[start + 4] = { cellWidth: COL_RAPOR, halign: "right", fontSize: 6 };
          c[start + 5] = { cellWidth: COL_TOTAL_TL, halign: "right", fontStyle: "bold", fontSize: 6.5 };
          return c;
        })(),
      });

      // Açıklama satırı
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastTable = (pdf as any).lastAutoTable;
      if (lastTable && typeof lastTable.finalY === "number") {
        const legendY = lastTable.finalY + 4;
        if (legendY < pageH - 8) {
          pdf.setFont("Geist", "normal");
          pdf.setFontSize(6.5);
          pdf.setTextColor(90, 90, 90);
          const legend =
            tab === "personnel"
              ? "Renkler: sarı = mesai (>8h), mavi A = raporlu (tam yevmiye sayılır), kırmızı sütun = Pazar.  Hesap: Pzt-Cmt ≤8h × 1.0 + >8h × 1.5  ·  Pazar: hak edilen 8h × 1.0 (haftada en az 1 çalışılan/raporlu gün varsa) + çalışılan saat × 1.5  ·  Rapor günü: 8h × 1.0."
              : "Renkler: sarı = mesai (>8h), kırmızı sütun = Pazar.  Hesap: saatlik ücret × toplam çalışılan saat.";
          const split = pdf.splitTextToSize(legend, pageW - marginX * 2);
          pdf.text(split, marginX, legendY);
        }
      }

      // Sayfa numaraları (1/N)
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFont("Geist", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(140, 140, 140);
        pdf.text(
          `${project.name}  ·  ${TR_MONTHS[month0]} ${year}  ·  sayfa ${i}/${totalPages}`,
          marginX,
          pageH - 4
        );
      }

      const fname = `${project.name.replace(/\s+/g, "-")}-Puantaj-${TR_MONTHS[month0]}-${year}-${tab === "personnel" ? "Personel" : "Makine"}.pdf`;
      pdf.save(fname);
      toast("PDF indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    }
  }

  // ─── Toplam kartlar (özet) ──────────────────────────────
  const summary = useMemo(() => {
    if (tab === "personnel") {
      let normalH = 0;
      let overtimeH = 0;
      let sundayH = 0;
      let raporD = 0;
      let total = 0;
      for (const r of personnelRows) {
        normalH += r.payroll.normalHours;
        overtimeH += r.payroll.overtimeHours;
        sundayH += r.payroll.sundayWorkedHours;
        raporD += r.payroll.raporDays;
        total += r.payroll.tutar;
      }
      return { normalH, overtimeH, sundayH, raporD, total };
    }
    let totalH = 0;
    let total = 0;
    for (const r of machineRows) {
      totalH += r.payroll.totalHours;
      total += r.payroll.tutar;
    }
    return { totalH, total };
  }, [tab, personnelRows, machineRows]);

  const tableRef = useRef<HTMLDivElement | null>(null);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
        <p className="text-sm text-text2">Önce bir proje seç.</p>
      </Card>
    );
  }

  const rowCount = tab === "personnel" ? personnelRows.length : machineRows.length;
  const currency: Currency =
    tab === "personnel"
      ? ((personnelRows[0]?.p.dailyRateCurrency ?? "TRY") as Currency)
      : ((machineRows[0]?.m.dailyRateCurrency ?? "TRY") as Currency);

  return (
    <>
      <PageHeader
        title="Aylık Puantaj"
        description="Ay × Personel/Makine — mesai, pazar tatili ve rapor günleri dahil otomatik yevmiye hesabı."
        icon={CalendarRange}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" onClick={exportExcel}>
              <FileSpreadsheet size={14} /> Excel
            </Button>
            <Button variant="outline" size="md" onClick={exportPdf}>
              <FileDown size={14} /> PDF
            </Button>
          </div>
        }
      />

      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Ay seçici */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="w-10 h-10 rounded-lg bg-white border border-border hover:bg-bg2 hover:border-text3 text-text2 flex items-center justify-center transition-all shadow-soft"
              title="Önceki ay"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="inline-flex items-center gap-2 px-3 h-10 rounded-lg bg-white border border-border shadow-soft min-w-[200px]">
              <Select
                value={month0}
                onChange={(e) => setMonth0(Number(e.target.value))}
                className="!h-7 !border-0 !shadow-none !bg-transparent font-semibold text-sm pl-0"
              >
                {TR_MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </Select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || today.getFullYear())}
                className="w-16 h-7 bg-transparent border-0 outline-none font-mono font-bold text-sm text-text"
              />
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="w-10 h-10 rounded-lg bg-white border border-border hover:bg-bg2 hover:border-text3 text-text2 flex items-center justify-center transition-all shadow-soft"
              title="Sonraki ay"
            >
              <ChevronRight size={16} />
            </button>
            <Button variant="ghost" size="md" onClick={goToCurrentMonth}>
              Bu Ay
            </Button>
          </div>

          {/* Tab — Personel / Makine */}
          <div className="inline-flex rounded-lg border border-border bg-white shadow-soft overflow-hidden">
            <button
              onClick={() => switchTab("personnel")}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold transition-colors",
                tab === "personnel" ? "bg-accent text-white" : "text-text2 hover:bg-bg2"
              )}
            >
              <HardHat size={14} /> Personel ({assignedPersonnel.length})
            </button>
            <button
              onClick={() => switchTab("machine")}
              className={cn(
                "inline-flex items-center gap-1.5 px-4 h-10 text-sm font-semibold transition-colors border-l border-border",
                tab === "machine" ? "bg-accent text-white" : "text-text2 hover:bg-bg2"
              )}
            >
              <Truck size={14} /> Makine ({assignedMachines.length})
            </button>
          </div>

          {/* Firma filtresi */}
          <Field label="Firma" className="min-w-[200px]">
            <Select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
              <option value="">Tümü ({companies.length})</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>

          {filterCompany && (
            <Button variant="outline" size="md" onClick={() => setFilterCompany("")}>
              <X size={14} /> Temizle
            </Button>
          )}

          {/* Özet kartlar */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {tab === "personnel" ? (
              <>
                <Badge variant="gray">Normal: <strong>{formatNumber(summary.normalH ?? 0, 0)}h</strong></Badge>
                <Badge variant="yellow">Mesai: <strong>{formatNumber(summary.overtimeH ?? 0, 0)}h</strong></Badge>
                <Badge variant="red">Pazar: <strong>{formatNumber(summary.sundayH ?? 0, 0)}h</strong></Badge>
                <Badge variant="blue">Rapor: <strong>{summary.raporD ?? 0} gün</strong></Badge>
                <Badge variant="green">
                  Toplam: <strong>{formatMoney(summary.total ?? 0, currency, 0)}</strong>
                </Badge>
              </>
            ) : (
              <>
                <Badge variant="gray">Toplam: <strong>{formatNumber(summary.totalH ?? 0, 0)}h</strong></Badge>
                <Badge variant="green">
                  Maliyet: <strong>{formatMoney(summary.total ?? 0, currency, 0)}</strong>
                </Badge>
              </>
            )}
          </div>
        </div>
      </Card>

      {rowCount === 0 ? (
        <Card>
          <CardTitle>Veri yok</CardTitle>
          <p className="text-sm text-text2">
            Bu projeye atanmış {tab === "personnel" ? "personel" : "makine"} bulunamadı.
            {filterCompany && (
              <>
                {" "}Firma filtresini <strong>{filterCompany}</strong> dışı için sıfırla.
              </>
            )}
          </p>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div ref={tableRef} className="overflow-x-auto max-h-[calc(100vh-260px)] overflow-y-auto">
            <table className="text-xs border-collapse">
              <thead className="bg-bg2 sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-bg2 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-text2 border-r border-border w-10">
                    #
                  </th>
                  <th className="sticky left-10 z-30 bg-bg2 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-text2 border-r border-border min-w-[180px]">
                    {tab === "personnel" ? "Ad Soyad / Firma" : "Makine / Firma"}
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.date}
                      className={cn(
                        "px-1 py-1 text-center w-9 border-r border-border/40 align-bottom",
                        d.isSunday && "bg-red/8",
                        d.inFuture && "opacity-50"
                      )}
                    >
                      <div className={cn("text-[11px] font-bold leading-tight", d.isSunday ? "text-red" : "text-text")}>
                        {d.day}
                      </div>
                      <div className={cn("text-[8.5px] uppercase tracking-wider", d.isSunday ? "text-red/80" : "text-text3")}>
                        {TR_DOW_SHORT[d.dow]}
                      </div>
                    </th>
                  ))}
                  {tab === "personnel" ? (
                    <>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text2 bg-bg2 border-l-2 border-border w-12">Gün</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text2 bg-bg2 w-14">Normal</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-yellow bg-yellow/8 w-14">Mesai</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-red bg-red/8 w-14">Pazar</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-blue bg-blue/8 w-14">Rapor</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-green bg-green/8 w-24">Toplam (TL)</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text2 bg-bg2 border-l-2 border-border w-12">Gün</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-text2 bg-bg2 w-16">Saat</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-green bg-green/8 w-24">Maliyet (TL)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {tab === "personnel" ? (
                  personnelRows.map((r, idx) => (
                    <tr key={r.p.id} className="border-t border-border hover:bg-bg2/50">
                      <td className="sticky left-0 bg-white hover:bg-bg2/50 px-2 py-1.5 text-center font-mono text-[10px] text-text3 border-r border-border w-10">
                        {idx + 1}
                      </td>
                      <td className="sticky left-10 bg-white hover:bg-bg2/50 px-3 py-1.5 border-r border-border min-w-[180px]">
                        <button
                          type="button"
                          onClick={() => setSelectedPersonId(r.p.id)}
                          className="text-left w-full block group"
                          title="Detayları gör"
                        >
                          <div className="font-semibold text-text text-[12px] leading-tight truncate group-hover:text-accent">
                            {r.p.firstName} {r.p.lastName}
                          </div>
                          <div className="text-[10px] text-text3 truncate">
                            {r.p.company}
                            {r.p.jobTitle && (
                              <>
                                <span className="text-text3/50"> · </span>
                                {r.p.jobTitle}
                              </>
                            )}
                          </div>
                        </button>
                      </td>
                      {r.cells.map((c, ci) => {
                        const d = days[ci];
                        const isOvertime = c.kind === "worked" && c.hours > OVERTIME_THRESHOLD;
                        const isClosed = c.kind === "closed";
                        return (
                          <td
                            key={d.date}
                            title={isClosed ? "İşe giriş/çıkış veya atama dışı" : undefined}
                            className={cn(
                              "px-0 py-0 text-center w-9 border-r border-border/30",
                              isClosed
                                ? "bg-bg3 bg-[repeating-linear-gradient(45deg,rgba(100,116,139,0.18)_0_3px,transparent_3px_7px)]"
                                : d.isSunday && "bg-red/5",
                              d.inFuture && !isClosed && "opacity-60"
                            )}
                          >
                            <div
                              className={cn(
                                "w-full h-7 inline-flex items-center justify-center text-[11px] font-mono tabular-nums",
                                c.kind === "worked" && !isOvertime && "text-text",
                                isOvertime && "bg-yellow/20 text-yellow-700 font-bold",
                                c.kind === "rapor" && "bg-blue/15 text-blue font-bold",
                                c.kind === "absent" && "text-text3/40",
                                isClosed && "text-text3/50"
                              )}
                            >
                              {isClosed
                                ? "×"
                                : c.kind === "worked"
                                ? c.hours
                                : c.kind === "rapor"
                                ? "R"
                                : "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right font-mono text-text border-l-2 border-border">
                        {r.payroll.workedDays}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-text">
                        {formatNumber(r.payroll.normalHours, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-yellow-700 bg-yellow/5">
                        {r.payroll.overtimeHours > 0 ? formatNumber(r.payroll.overtimeHours, 0) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-red bg-red/5">
                        {r.payroll.sundayWorkedHours > 0 ? formatNumber(r.payroll.sundayWorkedHours, 0) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-blue bg-blue/5">
                        {r.payroll.raporDays > 0 ? r.payroll.raporDays : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-green bg-green/8">
                        {formatMoney(
                          r.payroll.tutar,
                          (r.p.dailyRateCurrency ?? "TRY") as Currency,
                          0
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  machineRows.map((r, idx) => (
                    <tr key={r.m.id} className="border-t border-border hover:bg-bg2/50">
                      <td className="sticky left-0 bg-white hover:bg-bg2/50 px-2 py-1.5 text-center font-mono text-[10px] text-text3 border-r border-border w-10">
                        {idx + 1}
                      </td>
                      <td className="sticky left-10 bg-white hover:bg-bg2/50 px-3 py-1.5 border-r border-border min-w-[180px]">
                        <div className="font-semibold text-text text-[12px] leading-tight truncate">
                          {r.m.name}
                          {r.m.licensePlate && (
                            <span className="text-text3 font-normal"> · {r.m.licensePlate}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-text3 truncate">{r.m.company}</div>
                      </td>
                      {r.cells.map((c, ci) => {
                        const d = days[ci];
                        const isOvertime = c.kind === "worked" && c.hours > OVERTIME_THRESHOLD;
                        const isClosed = c.kind === "closed";
                        return (
                          <td
                            key={d.date}
                            title={isClosed ? "Atama dışı" : undefined}
                            className={cn(
                              "px-0 py-0 text-center w-9 border-r border-border/30",
                              isClosed
                                ? "bg-bg3 bg-[repeating-linear-gradient(45deg,rgba(100,116,139,0.18)_0_3px,transparent_3px_7px)]"
                                : d.isSunday && "bg-red/5",
                              d.inFuture && !isClosed && "opacity-60"
                            )}
                          >
                            <div
                              className={cn(
                                "w-full h-7 inline-flex items-center justify-center text-[11px] font-mono tabular-nums",
                                c.kind === "worked" && !isOvertime && "text-text",
                                isOvertime && "bg-yellow/20 text-yellow-700 font-bold",
                                c.kind === "absent" && "text-text3/40",
                                isClosed && "text-text3/50"
                              )}
                            >
                              {isClosed ? "×" : c.kind === "worked" ? c.hours : "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right font-mono text-text border-l-2 border-border">
                        {r.payroll.workedDays}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-text">
                        {formatNumber(r.payroll.totalHours, 0)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-green bg-green/8">
                        {formatMoney(
                          r.payroll.tutar,
                          (r.m.dailyRateCurrency ?? "TRY") as Currency,
                          0
                        )}
                      </td>
                    </tr>
                  ))
                )}

                {/* Günlük toplam satırı */}
                <tr className="border-t-2 border-border bg-bg2/60 font-semibold">
                  <td className="sticky left-0 bg-bg2 px-2 py-2 text-center text-[10px] text-text3 border-r border-border w-10">
                    Σ
                  </td>
                  <td className="sticky left-10 bg-bg2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-text2 border-r border-border">
                    Günlük Toplam Saat
                  </td>
                  {dailyTotals.map((dt, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "px-1 py-2 text-center font-mono text-[10px] border-r border-border/30",
                        days[ci].isSunday && "bg-red/5 text-red",
                        days[ci].inFuture && "opacity-60"
                      )}
                    >
                      {dt.hours > 0 ? formatNumber(dt.hours, 0) : "—"}
                    </td>
                  ))}
                  <td className="bg-bg2" />
                  <td className="bg-bg2" />
                  {tab === "personnel" && (
                    <>
                      <td className="bg-bg2" />
                      <td className="bg-bg2" />
                      <td className="bg-bg2" />
                    </>
                  )}
                  <td className="bg-bg2" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 bg-blue/5 border-t border-blue/15 text-[11px] text-text2 flex items-start gap-2">
            <Info size={11} className="text-blue shrink-0 mt-0.5" />
            <span>
              <strong>Salt okunur</strong> — değerler <strong>Günlük Operasyon ▸ Personel/Makine Puantajı</strong>{" "}
              sayfasından gelir.{" "}
              <span className="text-yellow-700 font-semibold">Sarı</span> = mesai (8 saat üzeri),{" "}
              <span className="text-blue font-semibold">R</span> = raporlu (tam yevmiye sayılır,
              biz ödüyoruz),{" "}
              <span className="text-red font-semibold">kırmızı sütun</span> = Pazar,{" "}
              <span className="text-text3 font-semibold">çapraz tarama × </span> = işe giriş/çıkış
              veya atama dışı kapalı gün (hesaba katılmaz).{" "}
              {tab === "personnel" && (
                <>
                  <strong>Hesap:</strong> Pzt-Cmt ≤8h × <em>saatlik</em> + &gt;8h × <em>saatlik</em> × 1.5.{" "}
                  Pazar: hak edilen 8h × <em>saatlik</em> (haftada en az 1 çalışılan/raporlu gün varsa) +
                  çalışılan saat × <em>saatlik</em> × 1.5. Rapor: 8h × <em>saatlik</em>.
                </>
              )}
            </span>
          </div>
        </Card>
      )}

      {/* Personel detay dialog */}
      {selectedPersonId && (() => {
        const row = personnelRows.find((r) => r.p.id === selectedPersonId);
        if (!row) return null;
        const p = row.p;
        const pay = row.payroll;
        const curr = (p.dailyRateCurrency ?? "TRY") as Currency;
        const daily = p.dailyRate ?? 0;
        const hourly = daily / 8;
        const monthlyNominal = daily * 30; // yaklaşık aylık (30 gün)
        return (
          <Dialog
            open
            onClose={() => setSelectedPersonId(null)}
            title={`${p.firstName} ${p.lastName}`}
            size="md"
          >
            <div className="space-y-4">
              {/* Kimlik bilgisi şeridi */}
              <div className="flex items-center gap-3 p-3 bg-bg2 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-accent text-white inline-flex items-center justify-center font-bold text-sm shrink-0">
                  {p.firstName?.[0]}
                  {p.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-[15px] text-text leading-tight">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="text-[11px] text-text2 truncate">
                    {p.jobTitle || "—"}
                    {p.discipline && (
                      <>
                        <span className="text-text3/50"> · </span>
                        <span className="capitalize">{p.discipline}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Firma & tarih bilgisi */}
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-0.5">
                    Firma
                  </div>
                  <div className="text-text font-semibold">{p.company || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-0.5">
                    Disiplin
                  </div>
                  <div className="text-text capitalize">{p.discipline || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-0.5">
                    İşe Giriş
                  </div>
                  <div className="text-text font-mono">
                    {p.startDate ? formatDate(p.startDate) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-0.5">
                    İşten Çıkış
                  </div>
                  <div className="text-text font-mono">
                    {p.terminationDate ? formatDate(p.terminationDate) : (
                      <span className="text-text3">— hâlâ çalışıyor</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ücret bilgisi */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-bg2 border-b border-border text-[10px] font-bold uppercase tracking-wider text-text2">
                  Ücret
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Saatlik</span>
                    <span className="font-mono font-semibold text-text">
                      {daily > 0 ? formatMoney(hourly, curr, 2) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Günlük (8h)</span>
                    <span className="font-mono font-semibold text-text">
                      {daily > 0 ? formatMoney(daily, curr, 2) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Nominal Aylık (30 gün)</span>
                    <span className="font-mono font-semibold text-text">
                      {daily > 0 ? formatMoney(monthlyNominal, curr, 0) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bu ay payroll */}
              <div className="border border-accent/30 rounded-lg overflow-hidden bg-accent/[0.03]">
                <div className="px-3 py-1.5 bg-accent/10 border-b border-accent/20 text-[10px] font-bold uppercase tracking-wider text-accent">
                  {TR_MONTHS[month0]} {year} · Bu Ay Hak Edilen
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Çalışılan Gün</span>
                    <span className="font-mono font-semibold text-text">{pay.workedDays}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Normal Saat</span>
                    <span className="font-mono font-semibold text-text">
                      {formatNumber(pay.normalHours, 0)}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Mesai Saat (×1.5)</span>
                    <span className="font-mono font-semibold text-yellow-700">
                      {pay.overtimeHours > 0 ? `${formatNumber(pay.overtimeHours, 0)}h` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Pazar Çalışılan (×1.5)</span>
                    <span className="font-mono font-semibold text-red">
                      {pay.sundayWorkedHours > 0
                        ? `${formatNumber(pay.sundayWorkedHours, 0)}h`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Pazar Hak Edilen Tatil</span>
                    <span className="font-mono font-semibold text-text">
                      {pay.sundayEntitledDays > 0 ? `${pay.sundayEntitledDays} gün` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                    <span className="text-text2">Raporlu</span>
                    <span className="font-mono font-semibold text-blue">
                      {pay.raporDays > 0 ? `${pay.raporDays} gün` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 text-[13px] bg-green/8">
                    <span className="font-bold text-text">TOPLAM</span>
                    <span className="font-mono font-extrabold text-green text-[15px]">
                      {formatMoney(pay.tutar, curr, 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Dialog>
        );
      })()}
    </>
  );
}
