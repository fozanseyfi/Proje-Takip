"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  Calendar,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  FileDown,
  Wand2,
  CheckCircle2,
  HelpCircle,
  Eraser,
  Clock3,
  Clock,
  Layers,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  useStore,
  useCurrentProject,
  useProjectWbs,
  useProjectPlanned,
} from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { confirmAction } from "@/components/ui/confirm";
import { computeProgress } from "@/lib/calc/progress";
import { formatNumber, formatDate, toISODate, addDays, daysBetween, cn } from "@/lib/utils";
import { ListChecks, Link2, Unlink, X, AlertTriangle } from "lucide-react";
import {
  buildWbsTree,
  getVisibleRows,
  presetExpand,
} from "@/lib/wbs/tree";
import {
  computeSchedule,
  canAddPredecessor,
  getPlanRange,
  getEffectiveRange,
} from "@/lib/calc/predecessors";
import { endDateFromDuration, workingDates, startDateFromDuration } from "@/lib/calc/distribution";
import type { PredecessorType, PredecessorLink, WbsItem } from "@/lib/store/types";
import { PlanWizard } from "@/components/planning/plan-wizard";
import { CleanupDialog, type CleanupOptions } from "@/components/planning/cleanup-dialog";
import { PredecessorBadges } from "@/components/planning/predecessor-badges";
import { PredecessorQuickAdd } from "@/components/planning/predecessor-quick-add";
import { ShortcutsHint } from "@/components/planning/shortcuts-hint";
import { MiniGantt } from "@/components/planning/mini-gantt";
import { WhatIfDialog } from "@/components/planning/whatif-dialog";
import { DurationInputDialog } from "@/components/planning/duration-input-dialog";
import { BulkDistributeDialog } from "@/components/planning/bulk-distribute-dialog";
import { AlapSelectDialog } from "@/components/planning/alap-select-dialog";
import { Badge } from "@/components/ui/badge";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const MONTH_NAMES_SHORT = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

interface MonthInfo {
  key: string;        // "2026-03"
  year: number;
  month: number;      // 1-12
  label: string;      // "Mar 2026"
  longLabel: string;  // "Mart 2026"
  daysInMonth: number;
  firstDate: string;  // ISO
  lastDate: string;   // ISO
}

function getProjectMonths(startISO: string, endISO: string): MonthInfo[] {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const months: MonthInfo[] = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    const lastDay = new Date(y, m + 1, 0).getDate();
    months.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      year: y,
      month: m + 1,
      label: `${MONTH_NAMES_SHORT[m]} ${y}`,
      longLabel: `${MONTH_NAMES_TR[m]} ${y}`,
      daysInMonth: lastDay,
      firstDate: `${y}-${String(m + 1).padStart(2, "0")}-01`,
      lastDate: `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

type PlanCellProps = {
  code: string;
  date: string;
  rowIdx: number;
  colIdx: number;
  rowCount: number;
  colCount: number;
  value: string;
  inProject: boolean;
  isLocked: boolean;
  isStart: boolean;
  isEnd: boolean;
  isToday: boolean;
  isSunday: boolean;
  tableLocked: boolean;
  lockTitle?: string;
  /** Süre aralığında mı (plan veya tahmini süreden) */
  inDuration?: boolean;
  /** Bu hücre süre aralığının ilk günü mü */
  isDurationStart?: boolean;
  /** Bu hücre süre aralığının son günü mü */
  isDurationEnd?: boolean;
  /** Plandan mı (kuvvetli renk) yoksa süre tahmininden mi (zayıf renk) */
  durationFromPlan?: boolean;
  /** Kritik yol mu */
  isCritical?: boolean;
  /** ALAP mı (mor renk) */
  isAlap?: boolean;
  onChangeValue: (code: string, date: string, value: string) => void;
  onKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
    rowCount: number,
    colCount: number
  ) => void;
};

// Memoized hücre — yalnızca kendi prop'u değişen hücre yeniden render edilir.
// tableLocked iken <input> yerine düz <span> render edilir; DOM ağırlığı + event listener'lar
// büyük oranda azalır → kasma azalır.
const PlanCell = memo(function PlanCell(props: PlanCellProps) {
  const {
    code, date, rowIdx, colIdx, rowCount, colCount,
    value, inProject, isLocked, isStart, isEnd, isToday, isSunday,
    tableLocked, lockTitle, onChangeValue, onKeyDown,
    inDuration, isDurationStart, isDurationEnd, durationFromPlan, isCritical, isAlap,
  } = props;

  const baseTdClass = cn(
    "border-b border-border p-0.5 bg-white relative",
    isToday && "bg-accent/5",
    isSunday && !isToday && "bg-red/5",
    !inProject && "bg-bg2/40"
    // Locked stripes kaldırıldı — duration bar zaten aralığı belli ediyor.
    // isStart/isEnd ring göstergeleri zaten kaldırıldı.
  );

  // DURATION BAR overlay — hücrenin ALT kenarında ince yatay çubuk.
  // Hücre içindeki miktar sayısıyla çakışmasın diye altta konumlandırıyoruz.
  // Renk mantığı: Critical → kırmızı · Plan var (miktarlı) → yeşil · Plan yok (sadece süre) → mor
  const barOverlay = inDuration ? (
    <div
      className={cn(
        "absolute pointer-events-none inset-x-0 bottom-0 h-1.5",
        // Renk hiyerarşisi: kritik > alap > asap-plan > asap-tahmin
        isCritical
          ? "bg-red"
          : isAlap
            ? "bg-purple"
            : durationFromPlan
              ? "bg-accent"
              : "bg-purple/40",
        isDurationStart && "rounded-l-full ml-0.5",
        isDurationEnd && "rounded-r-full mr-0.5"
      )}
      aria-hidden="true"
    />
  ) : null;

  // Tablo kilitli: input render etme — hafif span. Inputlar binlerce hücrede ağır maliyet.
  if (tableLocked) {
    return (
      <td className={baseTdClass} title={lockTitle}>
        {barOverlay}
        <div
          className={cn(
            "relative w-full px-0.5 py-1 text-center text-[11px] font-mono tabular-nums leading-tight min-h-[20px]",
            !inProject && "text-text3",
            isLocked && "text-text3",
            value && !isLocked && "text-planned font-bold"
          )}
        >
          {value || ""}
        </div>
      </td>
    );
  }

  const disabled = !inProject || isLocked;
  return (
    <td className={baseTdClass} title={lockTitle}>
      {barOverlay}
      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        data-cell-row={rowIdx}
        data-cell-col={colIdx}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || /^-?\d*\.?\d{0,2}$/.test(v)) {
            onChangeValue(code, date, v);
          }
        }}
        onKeyDown={(e) => onKeyDown(e, rowIdx, colIdx, rowCount, colCount)}
        onFocus={(e) => e.target.select()}
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
        className={cn(
          "relative w-full px-0.5 py-1 bg-transparent text-center text-[11px] font-mono tabular-nums rounded leading-tight",
          "focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent/30 focus:shadow-focus",
          !inProject && "text-text3 cursor-not-allowed",
          isLocked && "text-text3 cursor-not-allowed",
          value && !isLocked && "text-planned font-bold"
        )}
        placeholder=""
      />
    </td>
  );
});

export default function PlanningPage() {
  const project = useCurrentProject();
  const wbs = useProjectWbs(project?.id);
  const planned = useProjectPlanned(project?.id);
  const setPlanned = useStore((s) => s.setPlanned);
  const toast = useToast((s) => s.push);

  const leafs = useMemo(
    () => wbs
      .filter((w) => w.isLeaf)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [wbs]
  );

  // Milestone adayları: miktar = 1 + birim = "adet"/boş + henüz milestone değil
  const milestoneCandidates = useMemo(() => {
    return leafs.filter((w) => {
      if (w.activityType === "milestone") return false;
      const qty = w.quantity ?? 0;
      const unit = (w.unit ?? "").trim().toLowerCase();
      const unitIsAdetOrEmpty = unit === "" || unit === "adet" || unit === "ad";
      // Heuristic: tam 1 adet veya birim boş ile tek tahsis
      return qty === 1 && unitIsAdetOrEmpty;
    });
  }, [leafs]);

  // Plan toplamı miktarla eşleşmeyenler (work aktiviteleri)
  const planMismatchItems = useMemo(() => {
    const out: Array<{ item: WbsItem; planTotal: number; diff: number }> = [];
    for (const w of leafs) {
      if (w.activityType === "milestone") continue;
      if ((w.quantity ?? 0) <= 0) continue;
      const map = planned[w.code] ?? {};
      const sum = Object.values(map).reduce((a, b) => a + (Number(b) || 0), 0);
      if (sum > 0 && Math.abs(sum - w.quantity) > 0.5) {
        out.push({ item: w, planTotal: sum, diff: sum - w.quantity });
      }
    }
    return out;
  }, [leafs, planned]);

  // Hiç planlanmamış work kalemleri (quantity > 0 ama planned boş)
  const unplannedItems = useMemo(() => {
    return leafs.filter((w) => {
      if (w.activityType === "milestone") return w.milestoneDate == null;
      if ((w.quantity ?? 0) <= 0) return false;
      const map = planned[w.code] ?? {};
      return Object.keys(map).length === 0;
    });
  }, [leafs, planned]);

  // Proje bitişini aşan kalemler
  const overflowItems = useMemo(() => {
    if (!project) return [];
    const out: Array<{ item: WbsItem; lastDate: string }> = [];
    for (const w of leafs) {
      const map = planned[w.code] ?? {};
      const dates = Object.keys(map).sort();
      const last = dates[dates.length - 1];
      if (last && last > project.plannedEnd) {
        out.push({ item: w, lastDate: last });
      }
      if (w.activityType === "milestone" && w.milestoneDate && w.milestoneDate > project.plannedEnd) {
        out.push({ item: w, lastDate: w.milestoneDate });
      }
    }
    return out;
  }, [leafs, planned, project]);

  const tree = useMemo(() => buildWbsTree(wbs), [wbs]);

  const months = useMemo(
    () => project ? getProjectMonths(project.startDate, project.plannedEnd) : [],
    [project]
  );

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");
  // Yeni PlanWizard state — bir leaf WBS satırı için açılır
  const [wizardCode, setWizardCode] = useState<string | null>(null);
  // Kalem seçici dialog (üst butona basınca açılır)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  // Milestone migration: "1 adet" iş kalemleri milestone olarak işaretlenebilir
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  // Kullanıcının daha önce kapattığı projeleri sessiz bırak
  useEffect(() => {
    if (!project) return;
    try {
      const dismissed = JSON.parse(localStorage.getItem("milestone-migration-dismissed") || "[]");
      if (dismissed.includes(project.id)) setMigrationDismissed(true); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);
  function dismissMigration() {
    if (!project) return;
    setMigrationDismissed(true);
    try {
      const dismissed = JSON.parse(localStorage.getItem("milestone-migration-dismissed") || "[]");
      if (!dismissed.includes(project.id)) {
        dismissed.push(project.id);
        localStorage.setItem("milestone-migration-dismissed", JSON.stringify(dismissed));
      }
    } catch {}
  }
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL ?code=X&wiz=1 → wizard'ı o satır için aç (WBS sayfasından gelen Planla link'i için)
  useEffect(() => {
    const wizParam = searchParams?.get("wiz");
    const codeParam = searchParams?.get("code");
    if (wizParam === "1" && codeParam) {
      setWizardCode(codeParam); // eslint-disable-line react-hooks/set-state-in-effect
      // URL'yi temizle
      router.replace("/planning");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [didInitExpand, setDidInitExpand] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Tablo daima kilitli — manuel hücre düzenlemesi kapalı.
  // Değer girişi sadece Planlama Sihirbazı üzerinden yapılır.
  const tableLocked = true;
  const [predecessorsOpen, setPredecessorsOpen] = useState(false);
  // Inline link düzenleme (popover içindeki "Düzenle" → form → Kaydet)
  function editPredecessorLink(
    targetCode: string,
    predCode: string,
    patch: { type: PredecessorType; lagDays: number; lagUnit: "calendar" | "work" | "no-sunday" }
  ) {
    const target = wbs.find((w) => w.code === targetCode);
    if (!target) return;
    const current = target.predecessors ?? [];
    const newPreds = current.map((p) =>
      p.wbsCode === predCode
        ? { ...p, type: patch.type, lagDays: patch.lagDays, lagUnit: patch.lagUnit }
        : p
    );
    setWbsPredecessors(target.id, newPreds);
    toast(`Link güncellendi: ${predCode} → ${targetCode}`, "success");
    setTimeout(() => {
      const n = shiftByPredecessorsFresh();
      if (n > 0) toast(`${n} kalem ötelendi`, "success");
    }, 0);
  }

  // "Git" popover'ı: belirli bir (target, pred) linkine scroll yap.
  function jumpToPredecessorLink(targetCode: string, predCode: string) {
    setPredecessorsOpen(true);
    // Ağaç görünümünde otomatik gidiyoruz; liste görünümündeyse de id'ler aynı.
    setTimeout(() => {
      const el = document.getElementById(`predlink-${targetCode}-${predCode}`);
      if (el) {
        // Hedef varsa içinde ki <details> açık değilse açtır
        const parentDetails = el.closest("details");
        if (parentDetails && !parentDetails.open) parentDetails.open = true;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // Kısa bir süre highlight için ekle/kaldır
        el.classList.add("bg-accent/20", "ring-2", "ring-accent");
        setTimeout(() => {
          el.classList.remove("bg-accent/20", "ring-2", "ring-accent");
        }, 1800);
      }
    }, 50);
  }
  const [predView, setPredView] = useState<"list" | "tree">("tree");
  const [addPredOpen, setAddPredOpen] = useState(false);
  const [predSearch, setPredSearch] = useState("");
  // Debounced search query — input her tuşunda anında güncellenir,
  // filtre 80ms gecikmeli çalışır (hızlı yazımda re-filter atlanır).
  const [predSearchDebounced, setPredSearchDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setPredSearchDebounced(predSearch), 80);
    return () => clearTimeout(t);
  }, [predSearch]);
  const [summaryExpanded, setSummaryExpanded] = useState<Set<string>>(() => new Set());

  // Predecessor store aksiyonları
  const setWbsPredecessors = useStore((s) => s.setWbsPredecessors);
  const updateWbs = useStore((s) => s.updateWbs);
  const snapshotBaseline = useStore((s) => s.snapshotBaseline);
  const baseline = useStore((s) => (project ? s.baseline[project.id] : undefined));
  const baselineSetAt = useStore((s) => (project ? s.baselineSetAt[project.id] : undefined));
  const rebaselineAll = useStore((s) => s.rebaselineAll);

  // Esc → fullscreen kapat
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // İlk render'da TÜM parent'ları aç (preset "leaf"). Sonradan tree.rows büyürse
  // (sayfa yeniden render olunca) didInitExpand bayrağı tekrar tetiklenmesini önler.
  useEffect(() => {
    if (!didInitExpand && tree.rows.length > 0) {
      setExpanded(presetExpand(tree.rows, "leaf")); // eslint-disable-line react-hooks/set-state-in-effect
      setDidInitExpand(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [tree.rows, didInitExpand]);

  // Yeni WBS satırı eklendiğinde otomatik aç — kullanıcı her satırı manuel açmak zorunda kalmasın
  const lastTreeRowCount = useRef(0);
  useEffect(() => {
    if (didInitExpand && tree.rows.length > lastTreeRowCount.current) {
      setExpanded(presetExpand(tree.rows, "leaf")); // eslint-disable-line react-hooks/set-state-in-effect
    }
    lastTreeRowCount.current = tree.rows.length;
  }, [tree.rows, didInitExpand]);

  // Matrix scroll container ref (yatay kaydırma için) — early return'dan önce çağırılmalı
  const matrixScrollRef = useRef<HTMLDivElement | null>(null);

  function toggleExpand(code: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }
  const visibleRows = useMemo(
    () => getVisibleRows(tree.rows, expanded),
    [tree.rows, expanded]
  );

  // local draft: { [code]: { [date]: string } }
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>({});

  // İlk yüklemede planned'dan draft'a kopya
  useEffect(() => {
    const d: Record<string, Record<string, string>> = {};
    for (const [code, byDate] of Object.entries(planned)) {
      d[code] = {};
      for (const [date, qty] of Object.entries(byDate)) {
        d[code][date] = String(qty);
      }
    }
    setDraft(d);
  }, [planned]);

  // Selected month default
  useEffect(() => {
    if (selectedMonthKey || months.length === 0) return;
    const today = toISODate(new Date());
    const idx = months.findIndex((m) => today >= m.firstDate && today <= m.lastDate);
    setSelectedMonthKey(months[idx >= 0 ? idx : 0].key);
  }, [months, selectedMonthKey]);

  // Aktif ay tablodaki konumuna kaydır — ilk yüklemede atlanır,
  // tablo daima en solda (proje başlangıcında) açılır.
  const didInitialMonthScrollRef = useRef(false);
  useEffect(() => {
    if (!selectedMonthKey) return;
    if (!didInitialMonthScrollRef.current) {
      didInitialMonthScrollRef.current = true;
      return; // İlk render — kaydırma yok, scrollLeft = 0
    }
    const t = setTimeout(() => {
      const el = document.getElementById(`plan-month-${selectedMonthKey}`);
      if (el) el.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "nearest", inline: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [selectedMonthKey]);

  const selectedMonth = months.find((m) => m.key === selectedMonthKey) || months[0];

  // wbs koddan satır map'i — wbs.find() yerine O(1) lookup
  const wbsByCode = useMemo(() => {
    const m = new Map<string, typeof wbs[number]>();
    for (const w of wbs) m.set(w.code, w);
    return m;
  }, [wbs]);

  // Öncüllerden earliestStart hesabı + backward pass + float + tüm predecessor
  // link'lerinin düz listesi. computeSchedule hem forward hem backward yapar:
  // schedules her leaf için earliestStart, latestStart, totalFloat, effectiveStart
  // alanlarını içerir.
  const { schedules, predecessorRows, cycles, cycleNodes, successorsByCode, predecessorsByCode, criticalCodes: criticalCodesFromSchedule } = useMemo(() => {
    const projectStart = project?.startDate ?? toISODate(new Date());
    const projectEnd = project?.plannedEnd;
    const sch = computeSchedule(wbs, planned, projectStart, projectEnd);
    const rowsList: Array<{
      target: typeof wbs[number];
      link: PredecessorLink;
    }> = [];
    // succByCode: code → onun ardılları (B → A: A.preds.includes(B), B'nin succ'u A)
    const succByCode = new Map<string, Array<{ successorCode: string; link: PredecessorLink }>>();
    const predByCode = new Map<string, PredecessorLink[]>();
    for (const w of wbs) {
      if (w.deletedAt) continue;
      const preds = w.predecessors ?? [];
      if (preds.length > 0) predByCode.set(w.code, preds);
      for (const link of preds) {
        rowsList.push({ target: w, link });
        const arr = succByCode.get(link.wbsCode) ?? [];
        arr.push({ successorCode: w.code, link });
        succByCode.set(link.wbsCode, arr);
      }
    }
    return {
      schedules: sch.schedules,
      predecessorRows: rowsList,
      cycles: sch.cycles,
      cycleNodes: sch.cycleNodes,
      successorsByCode: succByCode,
      predecessorsByCode: predByCode,
      criticalCodes: sch.critical,
    };
  }, [wbs, planned, project?.startDate, project?.plannedEnd]);

  // Critical Path (CPM) — float = 0 olan leaf code'ları set
  const [criticalPathOn, setCriticalPathOn] = useState(false);
  const [criticalDialogOpen, setCriticalDialogOpen] = useState(false);
  // Nasıl kullanılır yardım dialog'u
  const [helpOpen, setHelpOpen] = useState(false);
  // What-If senaryoları dialog'u
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  // Süreleri Tanımla dialog'u (Adım 1)
  const [durationOpen, setDurationOpen] = useState(false);
  // Toplu Dağıt dialog'u
  const [bulkDistribOpen, setBulkDistribOpen] = useState(false);
  // ALAP Belirle dialog'u
  const [alapDialogOpen, setAlapDialogOpen] = useState(false);
  // Float Isı Haritası toggle + ilk açılışta gösterilen uyarı banner state
  const [floatHeatmapOn, setFloatHeatmapOn] = useState(false);
  const [floatInfoOpen, setFloatInfoOpen] = useState(false);
  // Temizleme dialog'u
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const bulkClearWbsData = useStore((s) => s.bulkClearWbsData);
  const setWbsScheduleTypes = useStore((s) => s.setWbsScheduleTypes);

  // Mevcut ALAP kalemleri (dialog init için + visualization için)
  const alapCodes = useMemo(() => {
    const out = new Set<string>();
    for (const w of leafs) {
      if (w.scheduleType === "alap") out.add(w.code);
    }
    return out;
  }, [leafs]);
  const criticalCodes = criticalCodesFromSchedule;

  // Duration ranges — her kalem için (planlı ise) plan tarihleri, (planlı değilse)
  // estimatedDurationDays + workweek + earliestStart üzerinden türetilmiş aralık.
  // Matrix hücre bar overlay'i ve Mini-Gantt bu map'i kullanır.
  const durationRanges = useMemo(() => {
    const out = new Map<string, { start: string; end: string; isFromPlan: boolean }>();
    if (!project) return out;
    function workweekFlags(ww?: "mon-fri" | "mon-sat" | "mon-sun"): { workSat: boolean; workSun: boolean } {
      if (ww === "mon-fri") return { workSat: false, workSun: false };
      if (ww === "mon-sun") return { workSat: true, workSun: true };
      return { workSat: true, workSun: false }; // mon-sat default
    }
    for (const w of leafs) {
      // MILESTONE — tek tarih (yoksa öncüllere göre veya proje başlangıcına yerleştir)
      if (w.activityType === "milestone") {
        if (w.milestoneDate) {
          out.set(w.code, { start: w.milestoneDate, end: w.milestoneDate, isFromPlan: true });
        } else {
          // Tarih atanmamış — Gantt'e yine de ekle ki eksik milestone'lar görünür olsun.
          // Öncüller varsa earliestStart, yoksa proje başlangıcı.
          const sch = schedules.get(w.code);
          const fallback = sch?.earliestStart ?? project.startDate;
          out.set(w.code, { start: fallback, end: fallback, isFromPlan: false });
        }
        continue;
      }
      // WORK — önce plana bak
      const pr = getPlanRange(planned[w.code]);
      if (pr.start && pr.end) {
        out.set(w.code, { start: pr.start, end: pr.end, isFromPlan: true });
        continue;
      }
      // Plan yok ama tahmini süre var → bar pozisyonu için anchor seç.
      //  ALAP: effectiveStart..effectiveEnd (Free Float kadar geri)
      //  ASAP + FF kısıtı: bitişe sabitle (FF constraint = info.earliestEnd)
      //  ASAP + sadece FS/SS / kısıtsız: earliestStart..earliestStart+duration
      const dur = w.estimatedDurationDays;
      if (dur && dur > 0) {
        const sch = schedules.get(w.code);
        const isAlap = w.scheduleType === "alap";
        const flags = workweekFlags(w.workweek);
        let start: string;
        let end: string;
        if (isAlap && sch?.effectiveStart && sch?.effectiveEnd) {
          start = sch.effectiveStart;
          end = sch.effectiveEnd;
        } else if (sch?.earliestEnd) {
          // FF constraint var → bitişe sabitle
          end = sch.earliestEnd;
          start = startDateFromDuration(end, dur, flags.workSat, flags.workSun);
          // FS daha sıkıysa fallback
          if (sch.earliestStart && start < sch.earliestStart) {
            start = sch.earliestStart;
            end = endDateFromDuration(start, dur, flags.workSat, flags.workSun);
          }
        } else {
          start = sch?.earliestStart ?? project.startDate;
          end = endDateFromDuration(start, dur, flags.workSat, flags.workSun);
        }
        out.set(w.code, { start, end, isFromPlan: false });
      }
    }
    return out;
  }, [leafs, planned, project?.startDate, schedules]);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
        <p className="text-sm text-text2">Önce bir proje seç.</p>
      </Card>
    );
  }

  // Helpers
  function getDraftValue(code: string, date: string): string {
    return draft[code]?.[date] ?? "";
  }
  // Stable callback — memoized PlanCell'in re-render olmaması için referansı sabit
  const setDraftValue = useCallback((code: string, date: string, value: string) => {
    setDraft((s) => ({
      ...s,
      [code]: { ...(s[code] || {}), [date]: value },
    }));
  }, []);

  // Hesaplama: bir leaf'in TOPLAM planı (tüm proje boyunca)
  function totalForLeaf(code: string): number {
    const byDate = draft[code] || {};
    return Object.values(byDate).reduce((s, v) => s + (Number(v) || 0), 0);
  }
  // Selected ay toplamı
  function monthTotalForLeaf(code: string, month: MonthInfo): number {
    const byDate = draft[code] || {};
    let s = 0;
    for (const [d, v] of Object.entries(byDate)) {
      if (d >= month.firstDate && d <= month.lastDate) s += Number(v) || 0;
    }
    return s;
  }

  // Otomatik dağıt: bir WBS leaf için başlangıç-bitiş arası eşit dağıtım — store'a doğrudan yazılır
  function autoDistribute(code: string, byDate: Record<string, number>) {
    if (!project) return;
    const newCodeMap: Record<string, string> = {};
    let cnt = 0;
    let sum = 0;
    // Önce mevcut plan'ı temizle (sihirbaz yeniden başlatır)
    const prev = planned[code] || {};
    for (const d of Object.keys(prev)) {
      setPlanned(project.id, code, d, 0);
    }
    // Yeni değerleri yaz — store'a doğrudan, draft kullanmadan
    const baselineCandidate: Record<string, number> = {};
    for (const [d, v] of Object.entries(byDate)) {
      if (d > project.plannedEnd || d < project.startDate) continue;
      const n = Math.max(0, v);
      if (n > 0) {
        setPlanned(project.id, code, d, n);
        newCodeMap[d] = String(n);
        baselineCandidate[d] = n;
        cnt++;
        sum += n;
      }
    }
    // Baseline otomatik snapshot — sadece bu kalem için henüz baseline yoksa
    snapshotBaseline(project.id, code, baselineCandidate, "if-empty");
    // Local draft'i de senkronize tut (UI gösterimi için)
    setDraft((s) => ({ ...s, [code]: newCodeMap }));
    // Öncüllere göre bağımlıları kaydır
    const shifted = shiftByPredecessorsFresh();
    const unit = leafs.find((l) => l.code === code)?.unit || "";
    if (shifted > 0) {
      toast(`Plan kaydedildi · ${cnt} güne toplam ${formatNumber(sum, 2)} ${unit} · ${shifted} kalem öncüllere göre ötelendi`, "success");
    } else {
      toast(`Plan kaydedildi · ${cnt} güne toplam ${formatNumber(sum, 2)} ${unit}`, "success");
    }
  }

  // EXCEL plan indir — wide format (leaf × tarih matrisi). Düzgün başlıklı, totalli.
  function downloadExcelTemplate() {
    if (!project) return;
    const DAY_TR_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    const MONTH_TR_SHORT = [
      "Oca", "Şub", "Mar", "Nis", "May", "Haz",
      "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
    ];

    const allDates: string[] = [];
    const startD = new Date(project.startDate);
    const total = daysBetween(project.startDate, project.plannedEnd) + 1;
    for (let i = 0; i < total; i++) allDates.push(toISODate(addDays(startD, i)));

    // Birinci başlık satırı: ay grupları (her ay'ın ilk gününde ay adı yazılır, diğer hücreler boş)
    const monthHeader: (string | number)[] = ["", "", "", "", "", "", ""];
    let lastMonthKey = "";
    for (const d of allDates) {
      const dt = new Date(d);
      const mk = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (mk !== lastMonthKey) {
        monthHeader.push(`${MONTH_TR_SHORT[dt.getMonth()]} ${dt.getFullYear()}`);
        lastMonthKey = mk;
      } else {
        monthHeader.push("");
      }
    }
    monthHeader.push("", ""); // Toplam Plan + Fark

    // İkinci başlık satırı: tarih + gün adı
    const dayHeader: (string | number)[] = [
      "WBS Kodu", "İmalat", "Aktivite Tipi", "Birim", "Hedef Miktar", "Birim Ağırlık", "Öncüller",
    ];
    for (const d of allDates) {
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      dayHeader.push(`${dd}.${mm} ${DAY_TR_SHORT[dt.getDay()]}`);
    }
    dayHeader.push("Toplam Plan", "Fark");

    const rows: (string | number)[][] = [monthHeader, dayHeader];

    // Öncüller string'i: "1.1(FS+2), 1.2(SS), 1.3(FF-1ig)" formatı
    function predString(item: WbsItem): string {
      const preds = item.predecessors ?? [];
      if (preds.length === 0) return "";
      return preds
        .map((p) => {
          const lagPart =
            p.lagDays === 0
              ? ""
              : `${p.lagDays > 0 ? "+" : ""}${p.lagDays}${
                  p.lagUnit === "work" ? "ig" : p.lagUnit === "no-sunday" ? "g6" : ""
                }`;
          return `${p.wbsCode}(${p.type}${lagPart})`;
        })
        .join(", ");
    }

    // Veri satırları
    const colTotals = new Array(allDates.length).fill(0);
    let grandTotalPlan = 0;
    let grandTotalTarget = 0;
    for (const w of leafs) {
      const actType = w.activityType === "milestone" ? "Milestone" : "Work";
      const row: (string | number)[] = [
        w.code,
        w.name,
        actType,
        w.unit,
        w.activityType === "milestone" ? "" : w.quantity,
        w.weight ?? 0,
        predString(w),
      ];
      let rowSum = 0;
      if (w.activityType === "milestone") {
        // Milestone: tüm gün hücreleri boş, sadece milestoneDate'te ◆ işareti
        allDates.forEach((d) => {
          if (w.milestoneDate === d) row.push("◆");
          else row.push("");
        });
      } else {
        allDates.forEach((d, i) => {
          const v = Number(draft[w.code]?.[d]);
          if (v > 0) {
            row.push(v);
            rowSum += v;
            colTotals[i] += v;
          } else {
            row.push("");
          }
        });
      }
      row.push(rowSum); // Toplam Plan
      row.push(w.activityType === "milestone" ? "" : rowSum - w.quantity); // Fark (milestone'da yok)
      rows.push(row);
      if (w.activityType !== "milestone") {
        grandTotalPlan += rowSum;
        grandTotalTarget += w.quantity;
      }
    }

    // Genel Toplam satırı
    const grandTotalRow: (string | number)[] = [
      "GENEL TOPLAM", "", "", "", grandTotalTarget, "", "",
    ];
    for (const t of colTotals) grandTotalRow.push(t || "");
    grandTotalRow.push(grandTotalPlan);
    grandTotalRow.push(grandTotalPlan - grandTotalTarget);
    rows.push(grandTotalRow);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Kolon genişlikleri
    ws["!cols"] = [
      { wch: 14 },  // WBS
      { wch: 42 },  // İmalat
      { wch: 11 },  // Aktivite tipi
      { wch: 8 },   // Birim
      { wch: 13 },  // Hedef
      { wch: 12 },  // Ağırlık
      { wch: 28 },  // Öncüller
      ...allDates.map(() => ({ wch: 11 })),
      { wch: 14 },  // Toplam Plan
      { wch: 12 },  // Fark
    ];

    // Satır yükseklikleri — başlık satırları biraz daha yüksek
    ws["!rows"] = [
      { hpt: 20 }, // ay header
      { hpt: 28 }, // gün header
    ];

    // Freeze: ilk 7 kolon + 2 başlık satırı (WBS, İmalat, Aktivite Tipi, Birim, Hedef, Ağırlık, Öncüller)
    ws["!views"] = [{ state: "frozen", xSplit: 7, ySplit: 2 }];

    // Ay başlıklarını yatayda birleştir (her ay grup için)
    const merges: XLSX.Range[] = [];
    {
      const META_COLS = 7;
      let groupStart = META_COLS;
      let groupVal = monthHeader[META_COLS];
      for (let c = META_COLS + 1; c < monthHeader.length - 2; c++) {
        if (monthHeader[c] !== "") {
          // Önceki grubu kapat
          if (c - 1 > groupStart) {
            merges.push({ s: { r: 0, c: groupStart }, e: { r: 0, c: c - 1 } });
          }
          groupStart = c;
          groupVal = monthHeader[c];
        }
      }
      // Son grup
      const lastIdx = monthHeader.length - 3; // -2 (Toplam+Fark) - 1 (index)
      if (lastIdx > groupStart && groupVal) {
        merges.push({ s: { r: 0, c: groupStart }, e: { r: 0, c: lastIdx } });
      }
    }
    if (merges.length > 0) ws["!merges"] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planlama");

    XLSX.writeFile(wb, `${project.name.replace(/\s+/g, "-")}-plan-${toISODate(new Date())}.xlsx`);
    toast("Plan Excel indirildi", "success");
  }

  // Plan Özeti — PDF indir.
  // Geist Unicode TTF font'u public/fonts/'tan yükleyip jsPDF + autoTable ile
  // gerçek text-based PDF üretiyor — Türkçe karakterler tam destekli, okunabilir.
  async function exportPlanSummaryPdf() {
    if (!project) return;
    try {
      const [{ default: jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;

      // Geist Regular TTF'i public klasöründen çek (Türkçe destekli Unicode font)
      const fontResp = await fetch("/fonts/Geist-Regular.ttf");
      if (!fontResp.ok) throw new Error("Font yüklenemedi");
      const fontBuf = await fontResp.arrayBuffer();
      // ArrayBuffer → base64 (büyük dosyalar için chunked)
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

      const all = wbs
        .filter((w) => !w.deletedAt)
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

      const rangeFor = (item: typeof all[number]) => {
        if (item.isLeaf) {
          const r = getPlanRange(planned[item.code]);
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
          const r = getPlanRange(planned[child.code]);
          if (r.start && (!minS || r.start < minS)) minS = r.start;
          if (r.end && (!maxE || r.end > maxE)) maxE = r.end;
        }
        return {
          start: minS,
          end: maxE,
          duration: minS && maxE ? daysBetween(minS, maxE) + 1 : 0,
        };
      };

      let projMinS: string | undefined;
      let projMaxE: string | undefined;
      for (const w of all) {
        if (!w.isLeaf) continue;
        const r = getPlanRange(planned[w.code]);
        if (r.start && (!projMinS || r.start < projMinS)) projMinS = r.start;
        if (r.end && (!projMaxE || r.end > projMaxE)) projMaxE = r.end;
      }
      const projDuration = projMinS && projMaxE ? daysBetween(projMinS, projMaxE) + 1 : 0;

      type RowMeta = { level: number; isTotal?: boolean };
      const rowMeta: RowMeta[] = [];
      const body: string[][] = [];

      // Proje toplam — en üste navy renkli
      rowMeta.push({ level: 0, isTotal: true });
      body.push([
        "—",
        "TOPLAM PROJE PLANI",
        projDuration > 0 ? `${projDuration} gün` : "—",
        projMinS ? formatDate(projMinS) : "—",
        projMaxE ? formatDate(projMaxE) : "—",
      ]);

      for (const w of all) {
        if (w.level < 1) continue;
        const r = rangeFor(w);
        const indent = "   ".repeat(Math.max(0, w.level - 1));
        rowMeta.push({ level: w.level });
        body.push([
          w.code,
          `${indent}${w.name}`,
          r.duration > 0 ? `${r.duration} gün` : "—",
          r.start ? formatDate(r.start) : "—",
          r.end ? formatDate(r.end) : "—",
        ]);
      }

      // jsPDF (A4 portrait)
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Geist'i kaydet ve aktif yap — autoTable artık Türkçe karakter renderlar
      pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
      pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
      pdf.addFont("Geist-Regular.ttf", "Geist", "bold"); // synthetic bold
      pdf.setFont("Geist", "normal");

      const pageW = pdf.internal.pageSize.getWidth();
      const marginX = 8;
      const availW = pageW - marginX * 2;

      // ───── BRAND GREEN HEADER — plan-status PDF ile aynı stil ─────
      const headerX = marginX;
      const headerY = marginX;
      const headerW = availW;
      const headerH = 56;

      // Smooth gradient brand-700 #047857 → brand-500 #10b981
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

      // Dekoratif daireler — clip + opacity ile subtle profesyonel görünüm
      pdf.saveGraphicsState();
      pdf.rect(headerX, headerY, headerW, headerH);
      pdf.clip();
      pdf.discardPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfAny = pdf as any;
      pdfAny.setGState(new pdfAny.GState({ opacity: 0.18 }));
      pdf.setFillColor(4, 78, 56); // brand-800
      pdf.circle(headerX + headerW - 4, headerY + 4, 28, "F");
      pdf.circle(headerX + headerW * 0.78, headerY + headerH + 2, 18, "F");
      pdfAny.setGState(new pdfAny.GState({ opacity: 1 }));
      pdf.restoreGraphicsState();

      // Sol üst rozet
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(6.5);
      pdf.setTextColor(220, 252, 231);
      pdf.text("PLAN ÖZETİ  ·  ZAMAN ÇİZELGESİ", headerX + 7, headerY + 8);
      pdf.setDrawColor(220, 252, 231);
      pdf.setLineWidth(0.2);
      pdf.line(headerX + 7, headerY + 9.2, headerX + 56, headerY + 9.2);

      // Büyük proje adı
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(28);
      pdf.setTextColor(255, 255, 255);
      pdf.text(project.name, headerX + 7, headerY + 21);

      // Rapor tarihi (bugün)
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

      // Alt 4'lü mini info kartları
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
        pdf.setFillColor(2, 44, 34); // #022c22 derin yeşil
        pdf.roundedRect(cx, cardY, cardW, cardH, 1.8, 1.8, "F");
        pdf.setDrawColor(110, 231, 183);
        pdf.setLineWidth(0.25);
        pdf.line(cx + 3, cardY + 6.5, cx + 6.5, cardY + 6.5);
        pdf.setFont("Geist", "bold");
        pdf.setFontSize(6);
        pdf.setTextColor(167, 243, 208);
        pdf.text(c.label, cx + 3, cardY + 5.5);
        pdf.setFont("Geist", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(255, 255, 255);
        const maxW = cardW - 6;
        let val = c.value;
        if (pdf.getTextWidth(val) > maxW) {
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

      autoTable(pdf, {
        startY: headerY + headerH + 5,
        margin: { left: marginX, right: marginX, top: 14, bottom: 12 },
        head: [["Kod", "Ad", "Süre", "Başlangıç", "Bitiş"]],
        body,
        styles: {
          font: "Geist",
          fontSize: 9,
          cellPadding: { top: 2.4, right: 3, bottom: 2.4, left: 3 },
          overflow: "linebreak",
          valign: "middle",
          lineColor: [220, 220, 230],
          lineWidth: 0.1,
          textColor: [15, 23, 42],
        },
        headStyles: {
          fillColor: [4, 120, 87], // brand-700 platform yeşili
          textColor: 255,
          fontStyle: "bold",
          fontSize: 9,
        },
        columnStyles: {
          0: { cellWidth: 22, fontStyle: "bold", halign: "left", overflow: "visible" },
          1: { cellWidth: pageW - marginX * 2 - 22 - 22 - 26 - 26 },
          2: { cellWidth: 22, halign: "right", overflow: "visible" },
          3: { cellWidth: 26, halign: "left", overflow: "visible" },
          4: { cellWidth: 26, halign: "left", overflow: "visible" },
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;
          const meta = rowMeta[data.row.index];
          if (!meta) return;
          if (meta.isTotal) {
            data.cell.styles.fillColor = [6, 78, 59]; // brand-800 koyu yeşil
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
          } else if (meta.level === 1) {
            data.cell.styles.fillColor = [220, 252, 231]; // emerald-100
            data.cell.styles.textColor = [4, 120, 87];    // brand-700
            data.cell.styles.fontStyle = "bold";
          } else if (meta.level === 2) {
            data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
            data.cell.styles.textColor = [5, 150, 105];   // brand-600
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawPage: (data) => {
          const pageNum = pdf.getNumberOfPages();
          const pageH = pdf.internal.pageSize.getHeight();
          pdf.setFont("Geist", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(140, 140, 140);
          pdf.text(
            `${project.name}   ·   sayfa ${data.pageNumber}/${pageNum}`,
            marginX,
            pageH - 6
          );
          pdf.setTextColor(0, 0, 0);
        },
      });

      const fname = `${project.name.replace(/\s+/g, "-")}-PlanOzeti-${toISODate(new Date())}.pdf`;
      pdf.save(fname);
      toast("Plan özeti PDF indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    }
  }

  // Klavye navigasyonu — input grid arasında ok/Tab/Enter
  // Stable handler — memoized PlanCell'in re-render olmaması için referansı sabit.
  // rowCount/colCount parametre olarak alındığı için closure'da değişken state yok.
  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number,
    rowCount: number,
    colCount: number
  ) => {
    const focus = (r: number, c: number) => {
      const el = document.querySelector<HTMLInputElement>(
        `input[data-cell-row="${r}"][data-cell-col="${c}"]:not(:disabled)`
      );
      if (el) {
        el.focus();
        el.select();
        return true;
      }
      return false;
    };
    if (e.key === "ArrowRight" || (e.key === "Tab" && !e.shiftKey)) {
      for (let c = colIdx + 1; c < colCount; c++) if (focus(rowIdx, c)) { e.preventDefault(); return; }
      if (rowIdx + 1 < rowCount) for (let c = 0; c < colCount; c++) if (focus(rowIdx + 1, c)) { e.preventDefault(); return; }
    } else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      for (let c = colIdx - 1; c >= 0; c--) if (focus(rowIdx, c)) { e.preventDefault(); return; }
      if (rowIdx - 1 >= 0) for (let c = colCount - 1; c >= 0; c--) if (focus(rowIdx - 1, c)) { e.preventDefault(); return; }
    } else if (e.key === "ArrowDown" || e.key === "Enter") {
      e.preventDefault();
      for (let r = rowIdx + 1; r < rowCount; r++) if (focus(r, colIdx)) { return; }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      for (let r = rowIdx - 1; r >= 0; r--) if (focus(r, colIdx)) { return; }
    }
  }, []);

  // Bugüne kadar kümülatif plan % — commit edilmiş `planned` üzerinden hesaplanır
  // (draft her tuşta değişir; her tuşta yeniden hesaplamak büyük projelerde yavaşlatıyordu).
  const cumProgress = useMemo(() => {
    const items = wbs.map((w) => ({
      code: w.code,
      isLeaf: w.isLeaf,
      quantity: w.quantity,
      weight: w.weight,
    }));
    return computeProgress(items, planned, {}, project.reportDate).planPct;
  }, [planned, wbs, project.reportDate]);

  // Gün başlıkları — TÜM proje aylarını yatay olarak içerir
  const dayHeaders = useMemo(() => {
    const arr: { date: string; day: number; monthKey: string; isFirstOfMonth: boolean }[] = [];
    for (const mi of months) {
      for (let d = 1; d <= mi.daysInMonth; d++) {
        const dateStr = `${mi.year}-${String(mi.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        arr.push({
          date: dateStr,
          day: d,
          monthKey: mi.key,
          isFirstOfMonth: d === 1,
        });
      }
    }
    return arr;
  }, [months]);

  // Tab'tan aya kaydırma — month-group başlık hücresine scroll
  function scrollToMonth(monthKey: string) {
    const el = document.getElementById(`plan-month-${monthKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  }

  // Yatay kaydırma yardımcıları
  function scrollMatrixBy(deltaCols: number) {
    const el = matrixScrollRef.current;
    if (!el) return;
    // 1 sütun ~ 24px (day column width). Hesabı kabaca yap.
    const colPx = 26;
    el.scrollBy({ left: deltaCols * colPx, behavior: "smooth" });
  }
  function scrollMatrixToToday() {
    if (!project) return;
    const today = toISODate(new Date());
    // Bugün proje aralığında değilse, en yakın sınıra git
    let target = today;
    if (today < project.startDate) target = project.startDate;
    else if (today > project.plannedEnd) target = project.plannedEnd;
    const monthKey = target.slice(0, 7).replace("-", "-");
    // ay key'i "YYYY-M" formatında, sıfırsız ay
    const dt = new Date(target);
    const mk = `${dt.getFullYear()}-${dt.getMonth() + 1}`;
    const el = document.getElementById(`plan-month-${mk}`) ?? document.getElementById(`plan-month-${monthKey}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  }

  // Taze store state'inden öncülleri uygula — zincirler için iterate et.
  // ASAP kalemler (default): FS/SS → start kısıtı ileri, FF → end kısıtı ileri.
  // ALAP kalemler: plan latestStart..latestEnd aralığına kaydırılır — hem ileri
  // (geç kalmış) hem geri (erken kalmış) yönde shift yapılabilir.
  function shiftByPredecessorsFresh(): number {
    if (!project) return 0;
    let shifted = 0;
    for (let iter = 0; iter < 20; iter++) {
      const st = useStore.getState();
      const freshWbs = st.wbs.filter((w) => w.projectId === project.id && !w.deletedAt);
      const freshPlanned = st.planned[project.id] || {};
      const fresh = computeSchedule(
        freshWbs,
        freshPlanned,
        project.startDate,
        project.plannedEnd
      );
      let didShift = false;
      for (const [code, info] of fresh.schedules) {
        const item = freshWbs.find((w) => w.code === code);
        if (!item?.isLeaf) continue;

        // MILESTONE — milestoneDate earliestStart'tan önceyse güncelle (öteleme)
        if (item.activityType === "milestone") {
          if (item.milestoneDate && item.milestoneDate < info.earliestStart) {
            st.updateWbs(item.id, { milestoneDate: info.earliestStart });
            shifted++;
            didShift = true;
          }
          continue;
        }

        // WORK — kapsamlı yerleştirme kuralları:
        //
        //  1. ALAP + öncüllü/öncülsüz:
        //       end ← info.effectiveEnd  (Free Float kadar trueEnd'in ilerisi)
        //       start ← N working day end'ten geri
        //       NOT: ALAP'lı kalem successor'ları geciktirmez (FF=0 ise hiç hareket etmez)
        //
        //  2. ASAP + öncüllü + FF kısıtı VAR (info.earliestEnd defined):
        //       end ← info.earliestEnd  (FF constraint = A.end + lag)
        //       start ← N working day end'ten geri
        //       FS daha kısıtlayıcıysa fallback: start ← info.earliestStart, end ileri
        //
        //  3. ASAP + öncüllü + sadece FS/SS (info.earliestEnd undefined):
        //       start ← info.earliestStart  (FS/SS constraint)
        //       end ← N working day start'tan ileri
        //
        //  4. ASAP + öncülsüz: dokunma (manuel tarih korunur)
        //
        // Tüm hesaplar HEDEF KALEMİN workweek'ine göre yapılır (mon-fri/sat/sun).
        // workingDates redistribute ile plan tarihleri 1-to-1 eşlenir → hafta sonu
        // entry'si oluşmaz. Count mismatch'te uniform fallback.
        if (!info.plannedStart) continue;
        const isAlap = item.scheduleType === "alap";
        const hasPredecessors = (item.predecessors?.length ?? 0) > 0;
        if (!isAlap && !hasPredecessors) continue;

        // Mevcut plan dates (sıralı, qty > 0)
        const oldByDate = freshPlanned[code] ?? {};
        const oldDates = Object.entries(oldByDate)
          .filter(([, q]) => q > 0)
          .map(([d]) => d)
          .sort();
        if (oldDates.length === 0) continue;

        // Hedef kalemin iş haftası
        const ww = item.workweek;
        const workSat = ww === "mon-fri" ? false : true;
        const workSun = ww === "mon-sun" ? true : false;
        const N = oldDates.length;

        let targetStart: string;
        let targetEnd: string;

        if (isAlap && info.effectiveEnd) {
          // 1) ALAP: bitişe sabitle
          targetEnd = info.effectiveEnd;
          targetStart = startDateFromDuration(targetEnd, N, workSat, workSun);
          // FS daha sıkıysa: ALAP başlangıcı FS sınırının önünde olamaz
          if (info.earliestStart && targetStart < info.earliestStart) {
            targetStart = info.earliestStart;
            targetEnd = endDateFromDuration(targetStart, N, workSat, workSun);
          }
        } else if (hasPredecessors && info.earliestEnd) {
          // 2) ASAP + FF: bitişi FF constraint'e sabitle (kalem A'nın bitişine yaslanır)
          targetEnd = info.earliestEnd;
          targetStart = startDateFromDuration(targetEnd, N, workSat, workSun);
          // FS daha sıkıysa: FS dominates
          if (info.earliestStart && targetStart < info.earliestStart) {
            targetStart = info.earliestStart;
            targetEnd = endDateFromDuration(targetStart, N, workSat, workSun);
          }
        } else if (hasPredecessors) {
          // 3) ASAP + sadece FS/SS: başlangıcı earliestStart'a sabitle
          targetStart = info.earliestStart;
          targetEnd = endDateFromDuration(targetStart, N, workSat, workSun);
        } else {
          continue;
        }

        // Hedefte hiçbir değişiklik yok mu?
        if (oldDates[0] === targetStart && oldDates[N - 1] === targetEnd) continue;

        // Working dates (target range) — bunlar yeni plan günleri (hafta sonu YOK)
        const newDates = workingDates(targetStart, targetEnd, workSat, workSun);
        if (newDates.length === 0) continue;

        // Eski değerleri yeni working dates'e 1-to-1 eşle (orijinal shape korunur)
        const newByDate: Record<string, number> = {};
        if (newDates.length === N) {
          for (let i = 0; i < N; i++) {
            newByDate[newDates[i]] = oldByDate[oldDates[i]];
          }
        } else {
          // Count mismatch (edge case: workweek değiştirilmiş veya plan boş gün içerir).
          // Toplamı yeni working days'e uniform dağıt, kalanı son güne.
          const total = oldDates.reduce((sum, d) => sum + oldByDate[d], 0);
          const per = Math.floor((total * 100) / newDates.length) / 100;
          let used = 0;
          for (let i = 0; i < newDates.length; i++) {
            const v = i === newDates.length - 1
              ? Math.round((total - used) * 100) / 100
              : per;
            newByDate[newDates[i]] = v;
            used += v;
          }
        }

        st.replaceWbsPlan(project.id, code, newByDate);
        shifted++;
        didShift = true;
      }
      if (!didShift) break;
    }
    return shifted;
  }

  // Öncülleri planlamaya uygula — kalan günleri kaydır, yeni başlangıçlardan önceyi kilitle
  function applyPredecessors() {
    if (!project) return;
    const shifted = shiftByPredecessorsFresh();
    if (cycles.length > 0) {
      toast(`⚠ ${cycles.length} döngü atlandı`, "warning");
    }
    if (shifted > 0) {
      toast(`${shifted} kalemin planlaması öncüllere göre kaydırıldı`, "success");
    } else {
      toast("Tüm planlamalar öncüllere uygun — kayma yapılmadı", "info");
    }
  }

  return (
    <>
      <PageHeader
        title="Proje Baseline Planı — Tüm Proje Takvimi"
        description="PMP akışı: Süreleri Tanımla → Öncül Ekle → Planlama Sihirbazı → Baseline Kaydet"
        icon={CalendarDays}
        actions={
          <>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
              title="Nasıl kullanılır?"
              aria-label="Nasıl kullanılır?"
            >
              <HelpCircle size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                setCriticalPathOn((v) => !v);
                setCriticalDialogOpen(true);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-bold border transition-all",
                criticalPathOn
                  ? "bg-red text-white border-red shadow-soft"
                  : "bg-white text-red border-red/30 hover:bg-red/5"
              )}
              title="Critical Path — float = 0 kalemleri vurgula ve listele"
            >
              ⚡ Critical Path
              <span className={cn("font-mono text-[10px]", criticalPathOn ? "text-white/85" : "text-red/70")}>
                · {criticalCodes.size}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFloatHeatmapOn((v) => {
                  const next = !v;
                  // İlk açılışta sessionStorage flag yoksa bilgi banner'ı göster
                  if (next) {
                    try {
                      const dismissed =
                        typeof window !== "undefined" &&
                        sessionStorage.getItem("float-info-dismissed") === "1";
                      if (!dismissed) setFloatInfoOpen(true);
                    } catch {
                      setFloatInfoOpen(true);
                    }
                  }
                  return next;
                });
              }}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-bold border transition-all",
                floatHeatmapOn
                  ? "bg-blue text-white border-blue shadow-soft"
                  : "bg-white text-blue border-blue/30 hover:bg-blue/5"
              )}
              title="Float Isı Haritası — her satırın arka planı float'a göre renklenir (kırmızı→yeşil)"
            >
              📊 Float Isı
              {floatHeatmapOn && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFloatInfoOpen(true);
                  }}
                  className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 text-[10px]"
                  title="Float hakkında bilgi"
                  aria-label="Float bilgi"
                >
                  ⓘ
                </button>
              )}
            </button>
            <button
              type="button"
              onClick={() => setWhatIfOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-bold border transition-all bg-white text-purple border-purple/30 hover:bg-purple/5"
              title="What-If — hipotetik senaryo etki analizi (canlı veri değişmez)"
            >
              🔮 What-If
            </button>
            <Button variant="outline" onClick={downloadExcelTemplate}>
              <FileSpreadsheet size={14} /> Planı İndir (Excel)
            </Button>
          </>
        }
      />

      {/* ÖNERİLER VE UYARILAR — tek panel, çok sinyal */}
      <SuggestionsPanel
        cycles={cycles}
        wbs={wbs}
        wbsByCode={wbsByCode}
        milestoneCandidates={milestoneCandidates}
        migrationDismissed={migrationDismissed}
        onDismissMigration={dismissMigration}
        onOpenMigrationDialog={() => setMigrationOpen(true)}
        onBulkConvertMilestones={() => {
          let cnt = 0;
          for (const w of milestoneCandidates) {
            updateWbs(w.id, { activityType: "milestone", quantity: 0, unit: "" });
            cnt++;
          }
          toast(`${cnt} kalem milestone olarak işaretlendi`, "success");
          dismissMigration();
        }}
        onRemoveCycleLink={(targetCode, predCode) => {
          const target = wbs.find((w) => w.code === targetCode);
          if (!target) return;
          const newPreds = (target.predecessors ?? []).filter((p) => p.wbsCode !== predCode);
          setWbsPredecessors(target.id, newPreds);
          toast(`Döngüyü kıran link silindi: ${predCode} → ${targetCode}`, "success");
        }}
        planMismatchItems={planMismatchItems}
        unplannedItems={unplannedItems}
        overflowItems={overflowItems}
        projectEnd={project.plannedEnd}
        onJumpToCode={(code) => setWizardCode(code)}
      />

      {/* ÖNCÜLLÜKLER — açılır-kapanır */}
      <details
        open={predecessorsOpen}
        onToggle={(e) => setPredecessorsOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="mb-4 rounded-xl border border-border bg-white overflow-hidden"
      >
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3 hover:bg-bg2/40">
          <Link2 size={16} className="text-accent shrink-0" />
          <h3 className="font-display font-bold text-sm text-text">Öncüllükler</h3>
          <Badge variant="gray">{predecessorRows.length}</Badge>
          {cycles.length > 0 && (
            <Badge variant="red">⚠ {cycles.length} döngü</Badge>
          )}
          <span className="ml-auto text-[11px] text-text3 font-mono">
            Yeni öncül eklemek için yukarıdaki <strong className="text-text2">② Öncül Ekle</strong> adımını kullan
          </span>
        </summary>
        <div className="border-t border-border">
          {predecessorRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text3">
              Henüz öncül tanımlı değil. Tablonun üstündeki <strong>② Öncül Ekle</strong> butonuyla başla.
            </div>
          ) : (() => {
            const q = predSearchDebounced.trim().toLowerCase();
            const filtered = q
              ? predecessorRows.filter(({ target, link }) => {
                  const a = wbsByCode.get(link.wbsCode);
                  return (
                    target.code.toLowerCase().includes(q) ||
                    target.name.toLowerCase().includes(q) ||
                    link.wbsCode.toLowerCase().includes(q) ||
                    (a?.name ?? "").toLowerCase().includes(q) ||
                    link.type.toLowerCase().includes(q)
                  );
                })
              : predecessorRows;
            return (
              <>
                <div className="px-3 py-2 border-b border-border bg-bg2/40 flex items-center gap-2">
                  <div className="relative flex-1 max-w-md">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-text3 pointer-events-none"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                      type="text"
                      value={predSearch}
                      onChange={(e) => setPredSearch(e.target.value)}
                      placeholder="İmalat / öncül / kod / tip ara..."
                      className="w-full h-7 pl-7 pr-7 text-[11px] rounded-md border border-border bg-white focus:border-accent focus:outline-none"
                    />
                    {predSearch && (
                      <button
                        onClick={() => setPredSearch("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 size-4 inline-flex items-center justify-center rounded hover:bg-bg2 text-text3 hover:text-red"
                        title="Temizle"
                      >
                        <span className="text-[14px] leading-none">×</span>
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-text3">
                    <strong className="text-text2">{filtered.length}</strong>
                    {predSearch ? ` / ${predecessorRows.length}` : ""} kayıt
                  </span>
                  <div className="ml-auto inline-flex p-0.5 bg-bg3 rounded border border-border gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPredView("tree")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                        predView === "tree" ? "bg-white text-accent shadow-soft" : "text-text2 hover:text-text"
                      )}
                    >
                      Ağaç
                    </button>
                    <button
                      type="button"
                      onClick={() => setPredView("list")}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                        predView === "list" ? "bg-white text-accent shadow-soft" : "text-text2 hover:text-text"
                      )}
                    >
                      Liste
                    </button>
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-text3">
                    Aramayla eşleşen öncül yok.
                  </div>
                ) : predView === "tree" ? (
                  <PredecessorsTree
                    rows={filtered}
                    wbsByCode={wbsByCode}
                    schedules={schedules}
                    onChangeLink={(targetId, predCode, patch) => {
                      const target = wbs.find((w) => w.id === targetId);
                      if (!target) return;
                      const newPreds = (target.predecessors ?? []).map((p) =>
                        p.wbsCode === predCode ? { ...p, ...patch } : p
                      );
                      setWbsPredecessors(targetId, newPreds);
                      setTimeout(() => {
                        const n = shiftByPredecessorsFresh();
                        if (n > 0) toast(`${n} kalem ötelendi`, "success");
                      }, 0);
                    }}
                    onRemoveLink={(targetId, predCode) => {
                      const target = wbs.find((w) => w.id === targetId);
                      if (!target) return;
                      const newPreds = (target.predecessors ?? []).filter(
                        (p) => p.wbsCode !== predCode
                      );
                      setWbsPredecessors(targetId, newPreds);
                    }}
                  />
                ) : (
            <table className="w-full text-xs">
              <thead className="bg-bg2 text-text2">
                <tr className="text-[10px] uppercase tracking-wider font-bold">
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">İmalat (B)</th>
                  <th className="px-3 py-2 text-left">Öncül (A)</th>
                  <th className="px-3 py-2 text-center w-16">Tip</th>
                  <th className="px-3 py-2 text-right w-16">Lag</th>
                  <th className="px-3 py-2 text-left w-40">En Erken Başlangıç</th>
                  <th className="px-3 py-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ target, link }, idx) => {
                  const a = wbsByCode.get(link.wbsCode);
                  const sch = schedules.get(target.code);
                  return (
                    <tr
                      key={`${target.id}-${link.wbsCode}-${idx}`}
                      id={`predlink-${target.code}-${link.wbsCode}`}
                      className="border-t border-border hover:bg-bg2/40 transition-colors"
                    >
                      <td className="px-3 py-2 font-mono text-text3 text-center">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-[10px] text-text3">{target.code}</div>
                        <div className="font-medium truncate max-w-[18rem]">{target.name}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-mono text-[10px] text-text3">{link.wbsCode}</div>
                        <div className="text-text2 truncate max-w-[18rem]">{a?.name ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={link.type}
                          onChange={(e) => {
                            const newType = e.target.value as PredecessorType;
                            const newPreds = (target.predecessors ?? []).map((p) =>
                              p.wbsCode === link.wbsCode ? { ...p, type: newType } : p
                            );
                            setWbsPredecessors(target.id, newPreds);
                            setTimeout(() => {
                              const n = shiftByPredecessorsFresh();
                              if (n > 0) toast(`${n} kalem ötelendi`, "success");
                            }, 0);
                          }}
                          className="h-6 px-1.5 text-[11px] font-bold rounded border border-border bg-white focus:border-accent focus:outline-none"
                          title="Tipi değiştir"
                        >
                          <option value="FS">FS</option>
                          <option value="SS">SS</option>
                          <option value="FF">FF</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        <input
                          type="text"
                          inputMode="numeric"
                          defaultValue={String(link.lagDays)}
                          onBlur={(e) => {
                            const raw = e.target.value.trim();
                            const valid = raw === "" || raw === "-" ? "0" : raw;
                            const parsed = /^-?\d+$/.test(valid) ? parseInt(valid, 10) : link.lagDays;
                            e.target.value = String(parsed);
                            if (parsed === link.lagDays) return;
                            const newPreds = (target.predecessors ?? []).map((p) =>
                              p.wbsCode === link.wbsCode ? { ...p, lagDays: parsed } : p
                            );
                            setWbsPredecessors(target.id, newPreds);
                            setTimeout(() => {
                              const n = shiftByPredecessorsFresh();
                              if (n > 0) toast(`${n} kalem ötelendi`, "success");
                            }, 0);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="h-6 w-14 px-1.5 text-[11px] text-right font-mono rounded border border-border bg-white focus:border-accent focus:outline-none"
                          title="Lag (gün) — negatif değer ön çekim (örtüşme) yapar"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <div className="text-text2">
                          ⏵ ≥ {sch?.earliestStart ? formatDate(sch.earliestStart) : "—"}
                        </div>
                        {sch?.earliestEnd && (
                          <div className="text-orange text-[10px] font-semibold">
                            ⏹ ≤ {formatDate(sch.earliestEnd)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => {
                            const newPreds = (target.predecessors ?? []).filter(
                              (p) => p.wbsCode !== link.wbsCode
                            );
                            setWbsPredecessors(target.id, newPreds);
                          }}
                          className="p-1 text-text3 hover:text-red rounded"
                          title="Sil"
                        >
                          <Unlink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
                )}
              </>
            );
          })()}
          {cycles.length > 0 && (
            <div className="px-4 py-2 border-t border-red/30 text-[11px] text-red bg-red/[0.03]">
              <strong>⚠ {cycles.length} döngü</strong> — detay için &quot;Öneriler ve Uyarılar&quot; panelini aç.
            </div>
          )}
        </div>
      </details>

      {/* AY SEÇ + bilgi şeridi */}
      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <span className="text-[10px] uppercase tracking-wider font-bold text-text3">AY SEÇ:</span>
          <div className="flex flex-wrap gap-1 p-1 bg-bg2 border border-border rounded-lg">
            {months.map((m) => {
              const isCurrent =
                toISODate(new Date()) >= m.firstDate && toISODate(new Date()) <= m.lastDate;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setSelectedMonthKey(m.key);
                    scrollToMonth(m.key);
                  }}
                  className={cn(
                    "px-3 h-8 rounded text-xs font-semibold transition-all flex items-center gap-1.5",
                    selectedMonthKey === m.key
                      ? "bg-white text-text shadow-soft border border-border"
                      : "text-text2 hover:text-text"
                  )}
                  title={`${m.longLabel} bölümüne git`}
                >
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse-soft" />}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Konsolide bilgi şeridi — ay info + satır sayısı + baseline durumu */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-text2 pt-2 border-t border-border">
          <span className="flex items-center gap-1.5">
            <Info size={12} className="text-text3" />
            Gösterilen: <strong className="text-text">{selectedMonth?.longLabel}</strong>
          </span>
          <span>
            Bugüne kadar kümülatif plan:{" "}
            <strong className="text-accent font-mono">{(cumProgress * 100).toFixed(1)}%</strong>
          </span>
          <span>
            Proje toplam gün: <strong className="font-mono text-text">{project.durationDays}</strong>
          </span>
          <span className="text-[11px] text-text3 font-mono">
            {visibleRows.length} satır
          </span>
          {baselineSetAt && (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue/10 border border-blue/25 text-blue text-[10px] font-bold uppercase tracking-wider"
              title={`Baseline ${new Date(baselineSetAt).toLocaleString("tr-TR")} itibarıyla donduruldu`}
            >
              <CheckCircle2 size={10} /> Baseline ·{" "}
              <span className="font-mono normal-case tracking-normal text-blue/80">
                {baseline ? Object.keys(baseline).length : 0} kalem
              </span>
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text3">
            Kısayollar
            <ShortcutsHint />
          </span>
        </div>
      </Card>

      {/* MATRİS TABLOSU */}
      <div
        className={cn(
          fullscreen && "fixed inset-0 z-50 bg-bg p-4 overflow-auto"
        )}
      >
        {/* 4-ADIMLI İŞ AKIŞI ÇUBUĞU + Temizle + Tam Ekran (sağa yaslı) */}
        <div className="flex items-center justify-end flex-wrap gap-2 mb-2">
          <WorkflowStep
            n={1}
            icon={<Clock3 size={13} />}
            label="Süreleri Tanımla"
            tooltip="Adım 1: Her work aktivitesi için tahmini çalışma günü gir"
            onClick={() => setDurationOpen(true)}
          />
          <WorkflowArrow />
          <WorkflowStep
            n={2}
            icon={<Link2 size={13} />}
            label="Öncül Ekle"
            tooltip="Adım 2: Aktiviteler arası bağımlılıkları kur (FS/SS/FF + lag)"
            onClick={() => setAddPredOpen(true)}
          />
          <WorkflowArrow />
          <WorkflowStep
            n={3}
            icon={<Wand2 size={13} />}
            label="Planlama Sihirbazı"
            tooltip="Adım 3: Sihirbazla dağılım şablonu seç, başlangıç-bitiş tarihi ver"
            onClick={() => setPickerOpen(true)}
            highlight
          />
          <button
            type="button"
            onClick={() => setBulkDistribOpen(true)}
            className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-accent/40 bg-accent/10 text-accent hover:bg-accent/15 text-[11px] font-bold transition-colors"
            title="Toplu Dağıt — birden fazla kaleme aynı şablonu hızlıca uygula"
          >
            <Layers size={12} /> Toplu
          </button>
          <button
            type="button"
            onClick={() => setAlapDialogOpen(true)}
            className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-purple/40 bg-purple/10 text-purple hover:bg-purple/15 text-[11px] font-bold transition-colors"
            title="ALAP Belirle — kalemleri olabildiğince geç bitirmeye ayarla (tedarik, devreye alma vs.)"
          >
            <Clock size={12} /> ALAP
          </button>
          <WorkflowArrow />
          <WorkflowStep
            n={4}
            icon={<CheckCircle2 size={13} />}
            label={baselineSetAt ? "Baseline Yeniden Al" : "Baseline Kaydet"}
            tooltip={
              baselineSetAt
                ? `Adım 4: Baseline ${new Date(baselineSetAt).toLocaleString("tr-TR")} itibarıyla donduruldu — yeniden almak için tıkla`
                : "Adım 4: Şuanki planı baseline olarak dondur"
            }
            onClick={async () => {
              if (!project) return;
              const confirmed = await confirmAction({
                title: baselineSetAt ? "Baseline ezilecek" : "Baseline al",
                message: baselineSetAt
                  ? "Mevcut baseline ezilecek ve şu anki planlama yeni baseline olarak kaydedilecek. Sapma takibi sıfırdan başlayacak."
                  : "Şu anki planlama tüm kalemler için baseline olarak kaydedilecek. Bu, sapma takibi için referans noktasıdır.",
                danger: !!baselineSetAt,
                confirmText: baselineSetAt ? "Yeniden Baseline Al" : "Baseline Al",
              });
              if (!confirmed) return;
              rebaselineAll(project.id);
              toast("Baseline güncellendi (tüm kalemler dahil)", "success");
            }}
            done={!!baselineSetAt}
          />
          {/* Ayraç */}
          <span className="w-px h-6 bg-border mx-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCleanupOpen(true)}
            title="Seçili kalemler için plan/baseline/öncül verilerini temizle"
            className="!border-red/40 !text-red hover:!bg-red/5"
          >
            <Eraser size={12} /> Temizle
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFullscreen((f) => !f)}>
            {fullscreen ? <><Minimize2 size={12} /> Tam Ekrandan Çık (Esc)</> : <><Maximize2 size={12} /> Tam Ekran</>}
          </Button>
        </div>
        <Card className="!p-0 overflow-hidden">
        <div
          ref={matrixScrollRef}
          className={cn("overflow-x-auto overflow-y-auto", fullscreen ? "max-h-[calc(100vh-100px)]" : "max-h-[85vh]")}
          onWheel={(e) => {
            const el = matrixScrollRef.current;
            if (!el) return;
            const dx = e.deltaX;
            const dy = e.deltaY;
            // Sadece ÇAPRAZ hareket için müdahale et (touchpad diagonal swipe).
            // Tek eksenli hareket (plain wheel = dikey, Shift+wheel = yatay, native deltaX = yatay)
            // browser'ın native davranışıyla bırakılır.
            if (dx !== 0 && dy !== 0) {
              e.preventDefault();
              // Baskın eksene düş, diğerini görmezden gel
              if (Math.abs(dx) > Math.abs(dy)) {
                el.scrollLeft += dx;
              } else {
                el.scrollTop += dy;
              }
            }
          }}
        >
          <table className="w-full text-sm">
            <thead>
              {/* AY GRUP BAŞLIK SATIRI */}
              <tr>
                <th rowSpan={2} className="sticky top-0 z-30 bg-bg2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border w-20 min-w-[5rem] border-r" style={{ left: 0 }}>
                  WBS
                </th>
                <th rowSpan={2} className="sticky top-0 z-30 bg-bg2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border min-w-[16rem]" style={{ left: 80 }}>
                  Açıklama
                </th>
                <th rowSpan={2} className="sticky top-0 z-30 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-r border-border min-w-[5rem]" style={{ left: 336 }}>
                  Toplam
                </th>
                <th rowSpan={2} className="sticky top-0 z-30 bg-bg2 px-3 py-2 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border min-w-[3.5rem] border-r-2 border-r-border2" style={{ left: 416 }}>
                  Birim
                </th>
                {months.map((mi) => {
                  const isSelected = selectedMonthKey === mi.key;
                  return (
                    <th
                      key={mi.key}
                      id={`plan-month-${mi.key}`}
                      colSpan={mi.daysInMonth}
                      className={cn(
                        "sticky top-0 z-20 px-2 text-center text-[11px] font-bold border-b-2 border-r-2 border-border2 h-9",
                        isSelected
                          ? "bg-accent text-white"
                          : "bg-[#e7f0fe] text-blue"
                      )}
                    >
                      {mi.longLabel}
                    </th>
                  );
                })}
                <th rowSpan={2} className="sticky top-0 z-30 bg-bg2 px-3 py-2 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border min-w-[8rem] border-l-2 border-l-border2" style={{ right: 0 }}>
                  Plan Toplamı
                </th>
              </tr>
              {/* GÜN NUMARASI SATIRI */}
              <tr>
                {dayHeaders.map(({ date, day, isFirstOfMonth }) => {
                  const isToday = date === project.reportDate;
                  const inProject = date >= project.startDate && date <= project.plannedEnd;
                  const isSunday = new Date(date + "T00:00:00").getDay() === 0;
                  return (
                    <th
                      key={date}
                      className={cn(
                        "sticky z-20 px-1 py-1 text-center text-[10px] font-bold border-b border-border min-w-[2.75rem]",
                        isToday
                          ? "bg-[#dcf2e8] text-accent"
                          : isSunday
                          ? "bg-[#fee2e2] text-red"
                          : "bg-bg2 text-text2",
                        !inProject && "opacity-40",
                        isFirstOfMonth && "border-l-2 border-l-border2"
                      )}
                      style={{ top: 36 }}
                    >
                      <div className={cn("text-[11px]", isSunday && "text-red font-extrabold")}>
                        {day}
                        {isSunday && <span className="ml-0.5">P</span>}
                      </div>
                      <div className={cn("text-[9px] font-normal", isSunday ? "text-red/70" : "text-text3")}>
                        {daysBetween(project.startDate, date) + 1}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, rowIdx) => {
                const w = r.item;
                const isLeaf = w.isLeaf;
                // Leaf için hesaplama; başlıklarda aggregate gösterilmez
                const totalQty = isLeaf ? w.quantity : 0;
                const totalDraft = isLeaf ? totalForLeaf(w.code) : 0;
                const isExpanded = expanded.has(w.code);
                const isOpenable = r.hasChildren;

                // Stil seviyeye göre — boydan boya belirgin renk (orta hücreler için, opaklığı düşük olabilir)
                const rowBg = isLeaf
                  ? "bg-white"
                  : w.level === 1
                    ? "bg-accent/20"
                    : w.level === 2
                      ? "bg-blue/12"
                      : "bg-bg2";
                // Sticky hücreler için OPAK arka plan — tablo kayarken arkaları görünmesin
                const stickyBg = isLeaf
                  ? "bg-white"
                  : w.level === 1
                    ? "bg-[#cdeae1]" // accent/20 üzerine beyaz blend
                    : w.level === 2
                      ? "bg-[#e7f0fe]" // blue/12 üzerine beyaz blend
                      : "bg-bg2";
                // Float Isı Haritası — leaf satırlar için sticky/row arka planını float'a göre override
                // (kritik zaten kırmızı ring; burada non-kritik leaf'leri renklendir)
                const rowText = isLeaf ? "text-text" : w.level === 1 ? "text-accent font-extrabold uppercase tracking-wide" : "text-text font-bold";
                const indentPx = Math.max(0, w.level - 1) * 14;

                // Cycle node'ları kritik yol kararından önce ayrı işaretlenir —
                // backward pass döngü içinden geri çıkamadığı için float/critical güvenilir değil.
                const isInCycle = isLeaf && cycleNodes.has(w.code);
                const isCritical = criticalPathOn && isLeaf && !isInCycle && criticalCodes.has(w.code);
                const rowIsAlap = isLeaf && w.scheduleType === "alap";

                // Performans: schedule + duration range satır bazında 1 kez hesapla,
                // her hücre için tekrar Map.get çağırma.
                const rowSch = isLeaf ? schedules.get(w.code) : undefined;
                const rowFloat = rowSch?.totalFloat;
                // Float Isı Haritası — leaf, non-kritik, toggle açık → float'a göre arka plan
                const heatmapRowBg =
                  floatHeatmapOn && isLeaf && !isCritical && rowFloat !== undefined
                    ? rowFloat === 0
                      ? "!bg-red/8"
                      : rowFloat <= 3
                        ? "!bg-yellow/12"
                        : rowFloat <= 7
                          ? "!bg-yellow/5"
                          : "!bg-green/6"
                    : "";
                const rowDRange = isLeaf ? durationRanges.get(w.code) : undefined;
                const rowEarliestStart = rowSch?.earliestStart;
                const rowEarliestEnd = rowSch?.earliestEnd;
                const rowDStart = rowDRange?.start;
                const rowDEnd = rowDRange?.end;
                const rowDFromPlan = rowDRange?.isFromPlan ?? false;
                // Satır iş haftası — bar overlay hafta sonu olmayan günleri atlasın.
                const rowWorkSat = w.workweek === "mon-fri" ? false : true;
                const rowWorkSun = w.workweek === "mon-sun";
                // Görsel bar uçlarını ilk/son ÇALIŞMA gününe sabitle (yuvarlak kenar buraya gelir).
                // Aralık başı/sonu hafta sonuna denk gelirse en yakın iş gününe kayar.
                let rowVisualStart: string | undefined;
                let rowVisualEnd: string | undefined;
                if (rowDStart && rowDEnd) {
                  const startD = new Date(rowDStart + "T00:00:00");
                  const endD = new Date(rowDEnd + "T00:00:00");
                  for (let i = 0; i < 7 && startD <= endD; i++) {
                    const d = startD.getDay();
                    const skip = (d === 0 && !rowWorkSun) || (d === 6 && !rowWorkSat);
                    if (!skip) break;
                    startD.setDate(startD.getDate() + 1);
                  }
                  for (let i = 0; i < 7 && endD >= startD; i++) {
                    const d = endD.getDay();
                    const skip = (d === 0 && !rowWorkSun) || (d === 6 && !rowWorkSat);
                    if (!skip) break;
                    endD.setDate(endD.getDate() - 1);
                  }
                  if (startD <= endD) {
                    const fmt = (dt: Date) =>
                      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
                    rowVisualStart = fmt(startD);
                    rowVisualEnd = fmt(endD);
                  }
                }
                return (
                  <tr key={w.id} className={cn(
                    "group transition-colors",
                    isLeaf ? "hover:bg-bg2/50" : "hover:brightness-95",
                    isCritical && "ring-2 ring-red/40 bg-red/[0.04]"
                  )}>
                    <td
                      className={cn(
                        "sticky z-20 px-3 py-1.5 border-b border-r border-border font-mono text-xs w-20 min-w-[5rem]",
                        stickyBg,
                        isLeaf ? "text-text3" : "text-text font-bold",
                        isCritical && "!bg-red/[0.05] text-red font-bold",
                        heatmapRowBg
                      )}
                      style={{ left: 0 }}
                    >
                      {isCritical && <span className="mr-1" title="Kritik yol — float = 0">⚡</span>}
                      {isInCycle && (
                        <span
                          className="mr-1 text-yellow"
                          title="Döngü içinde — backward pass float hesaplayamadı. Öncül zincirinde döngü var."
                        >
                          🔄
                        </span>
                      )}
                      {rowIsAlap && (
                        <span
                          className="mr-1 text-purple"
                          title={
                            rowSch?.latestStart
                              ? `ALAP — En geç başlangıç: ${rowSch.latestStart}, en geç bitiş: ${rowSch.latestEnd}`
                              : "ALAP — Olabildiğince geç"
                          }
                        >
                          ⏮
                        </span>
                      )}
                      {floatHeatmapOn && isLeaf && rowFloat !== undefined && (
                        <span
                          className={cn(
                            "mr-1 font-mono text-[9px] font-bold px-1 py-0.5 rounded",
                            rowFloat === 0
                              ? "bg-red/15 text-red"
                              : rowFloat <= 3
                                ? "bg-yellow/15 text-yellow"
                                : rowFloat <= 7
                                  ? "bg-yellow/8 text-text2"
                                  : "bg-green/15 text-green"
                          )}
                          title={
                            rowSch
                              ? `Float: ${rowFloat} gün\nES: ${rowSch.earliestStart}\nLS: ${rowSch.latestStart ?? "—"}\nLE: ${rowSch.latestEnd ?? "—"}`
                              : `Float: ${rowFloat} gün`
                          }
                        >
                          +{rowFloat}g
                        </span>
                      )}
                      {isLeaf ? (
                        <PredecessorQuickAdd
                          targetCode={w.code}
                          targetId={w.id}
                          targetName={w.name}
                          allWbs={wbs}
                          existingPredCodes={(w.predecessors ?? []).map((p) => p.wbsCode)}
                          onAdd={(predCodes, type, lagDays, lagUnit) => {
                            const current = w.predecessors ?? [];
                            let accepted = 0;
                            let rejected = 0;
                            let working = current;
                            for (const predCode of predCodes) {
                              if (predCode === w.code) {
                                rejected++;
                                continue;
                              }
                              const check = canAddPredecessor(
                                wbs.map((x) =>
                                  x.id === w.id ? { ...x, predecessors: working } : x
                                ),
                                w.code,
                                predCode
                              );
                              if (!check.ok) {
                                rejected++;
                                continue;
                              }
                              const filtered = working.filter((p) => p.wbsCode !== predCode);
                              working = [
                                ...filtered,
                                { wbsCode: predCode, type, lagDays, lagUnit },
                              ];
                              accepted++;
                            }
                            if (accepted > 0) {
                              setWbsPredecessors(w.id, working);
                              toast(`${accepted} öncül eklendi → ${w.code}`, "success");
                              setTimeout(() => {
                                const n = shiftByPredecessorsFresh();
                                if (n > 0) toast(`${n} kalem ötelendi`, "success");
                              }, 0);
                            }
                            if (rejected > 0) {
                              toast(`${rejected} bağlantı atlandı (döngü veya kendi-bağlama)`, "error");
                            }
                          }}
                        >
                          {({ triggerRef, toggle, isOpen }) => (
                            <button
                              ref={triggerRef as React.RefObject<HTMLButtonElement>}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle();
                              }}
                              className={cn(
                                "font-mono text-xs cursor-pointer transition-colors rounded px-0.5",
                                isOpen
                                  ? "bg-blue text-white"
                                  : "text-text3 hover:text-blue hover:bg-blue/10"
                              )}
                              title="Tıkla → öncül ekle"
                            >
                              {w.code}
                            </button>
                          )}
                        </PredecessorQuickAdd>
                      ) : (
                        w.code
                      )}
                    </td>
                    <td
                      className={cn("sticky z-20 px-2 py-1.5 border-b border-r border-border min-w-[16rem]", stickyBg, heatmapRowBg)}
                      style={{ left: 80 }}
                    >
                      <div className="flex items-center gap-1" style={{ paddingLeft: `${indentPx}px` }}>
                        {isOpenable ? (
                          <button
                            onClick={() => toggleExpand(w.code)}
                            className="w-5 h-5 rounded hover:bg-bg3 flex items-center justify-center shrink-0"
                            title={isExpanded ? "Kapat" : "Aç"}
                          >
                            <ChevronRight
                              size={12}
                              className={cn("text-text2 transition-transform", isExpanded && "rotate-90")}
                            />
                          </button>
                        ) : (
                          <span className="w-5 shrink-0" />
                        )}
                        {isLeaf ? (
                          <button
                            type="button"
                            onClick={() => setWizardCode(w.code)}
                            title="Tıkla → Planlama Sihirbazını Aç"
                            className={cn(
                              "text-xs truncate max-w-[22rem] text-left hover:text-accent hover:underline cursor-pointer",
                              rowText
                            )}
                          >
                            {w.name}
                          </button>
                        ) : (
                          <span className={cn("text-xs truncate max-w-[22rem]", rowText)} title={w.name}>
                            {w.name}
                          </span>
                        )}
                        {isLeaf && w.activityType === "milestone" && (
                          <span
                            title="Milestone — kilometre taşı"
                            className="ml-1.5 inline-flex items-center px-1 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-purple/15 text-purple shrink-0"
                          >
                            ◆
                          </span>
                        )}
                        {isLeaf && (
                          <span className="ml-1.5 shrink-0">
                            <PredecessorBadges
                              code={w.code}
                              predecessors={predecessorsByCode.get(w.code) ?? []}
                              successors={successorsByCode.get(w.code) ?? []}
                              wbsByCode={wbsByCode}
                              onEditLink={editPredecessorLink}
                              onJumpToLink={jumpToPredecessorLink}
                              onRemovePredecessor={(predCode) => {
                                const newPreds = (w.predecessors ?? []).filter(
                                  (p) => p.wbsCode !== predCode
                                );
                                setWbsPredecessors(w.id, newPreds);
                                toast(`Öncül kaldırıldı: ${predCode} → ${w.code}`, "success");
                              }}
                              onRemoveSuccessor={(succCode, thisCode) => {
                                const successor = wbsByCode.get(succCode);
                                if (!successor) return;
                                const newPreds = (successor.predecessors ?? []).filter(
                                  (p) => p.wbsCode !== thisCode
                                );
                                setWbsPredecessors(successor.id, newPreds);
                                toast(`Ardıl bağlantısı kaldırıldı: ${thisCode} → ${succCode}`, "success");
                              }}
                            />
                          </span>
                        )}
                        {!isLeaf && (
                          <span className="ml-1.5 text-[9px] font-mono px-1.5 py-0 rounded bg-bg3 text-text3 shrink-0">
                            {r.childLeafCodes.length} kalem
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className={cn("sticky z-20 px-3 py-1.5 border-b border-r border-border text-right font-mono text-xs tabular-nums min-w-[5rem]", stickyBg, heatmapRowBg, "text-text2")}
                      style={{ left: 336 }}
                    >
                      {isLeaf && totalQty > 0 ? formatNumber(totalQty, 0) : ""}
                    </td>
                    <td
                      className={cn("sticky z-20 px-3 py-1.5 border-b border-border text-xs text-text3 border-r-2 border-r-border2 min-w-[3.5rem]", stickyBg, heatmapRowBg)}
                      style={{ left: 416 }}
                    >
                      {w.unit || "—"}
                    </td>
                    {dayHeaders.map(({ date }, colIdx) => {
                      const inProject = date >= project.startDate && date <= project.plannedEnd;
                      const isToday = date === project.reportDate;
                      const dow = new Date(date + "T00:00:00").getDay();
                      const isSunday = dow === 0;
                      const isSaturday = dow === 6;

                      if (!isLeaf) {
                        return (
                          <td
                            key={date}
                            className={cn(
                              "border-b border-border px-0.5 py-1",
                              isSunday ? "bg-red/8" : rowBg,
                              !inProject && "opacity-40"
                            )}
                          />
                        );
                      }

                      // MILESTONE — sadece milestoneDate gününde ◆ üçgeni göster, diğer hücreler boş
                      if (w.activityType === "milestone") {
                        const isMilestoneDay = w.milestoneDate === date;
                        const isCompletedDay = w.milestoneCompletedAt === date;
                        return (
                          <td
                            key={date}
                            className={cn(
                              "border-b border-border px-0.5 py-0 text-center",
                              isSunday ? "bg-red/8" : "bg-white",
                              !inProject && "opacity-40",
                              isToday && "bg-yellow/10",
                              isMilestoneDay && "bg-purple/15"
                            )}
                            title={
                              isMilestoneDay
                                ? `◆ Milestone tarihi: ${w.name}${
                                    w.milestoneCompletedAt
                                      ? ` · ✓ Gerçekleşti ${w.milestoneCompletedAt}`
                                      : " · Bekleniyor"
                                  }`
                                : isCompletedDay
                                  ? `✓ Milestone gerçekleşti: ${w.name}`
                                  : undefined
                            }
                          >
                            {isMilestoneDay && (
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center text-[14px] leading-none font-bold",
                                  w.milestoneCompletedAt ? "text-green" : "text-purple"
                                )}
                              >
                                ◆
                              </span>
                            )}
                            {isCompletedDay && !isMilestoneDay && (
                              <span
                                className="inline-flex items-center justify-center text-[12px] leading-none text-green font-bold"
                                title={`✓ Gerçekleşti: ${w.name}`}
                              >
                                ✓
                              </span>
                            )}
                          </td>
                        );
                      }

                      // Hız: rowSch / rowDRange satır bazında hesaplandı, burada sadece tarih kıyaslar.
                      const lockedBefore = !!rowEarliestStart && date < rowEarliestStart;
                      const lockedAfter = !!rowEarliestEnd && date > rowEarliestEnd;
                      const isLocked = lockedBefore || lockedAfter;
                      const isStart = !!rowEarliestStart && date === rowEarliestStart;
                      const isEnd = !!rowEarliestEnd && date === rowEarliestEnd;
                      const value = getDraftValue(w.code, date);
                      // lockTitle: sadece kilit durumlarında üret — gereksiz string allocation azalt.
                      const lockTitle = isLocked
                        ? lockedBefore
                          ? `🔒 ${rowSch?.reason ?? "Öncül bekleniyor"} — en erken: ${rowEarliestStart}`
                          : `🔒 ${rowSch?.reason ?? "Öncül bitiş kısıtı"} — bitiş ≤ ${rowEarliestEnd}`
                        : undefined;
                      // Satırın iş haftasında çalışılmayan bir gün ise bar overlay'i çizilmesin.
                      const isRowOffDay =
                        (isSunday && !rowWorkSun) || (isSaturday && !rowWorkSat);
                      const inDuration =
                        !isRowOffDay &&
                        !!rowVisualStart &&
                        !!rowVisualEnd &&
                        date >= rowVisualStart &&
                        date <= rowVisualEnd;
                      const isDurationStart = inDuration && date === rowVisualStart;
                      const isDurationEnd = inDuration && date === rowVisualEnd;
                      return (
                        <PlanCell
                          key={date}
                          code={w.code}
                          date={date}
                          rowIdx={rowIdx}
                          colIdx={colIdx}
                          rowCount={visibleRows.length}
                          colCount={dayHeaders.length}
                          value={value}
                          inProject={inProject}
                          isLocked={isLocked}
                          isStart={isStart}
                          isEnd={isEnd}
                          isToday={isToday}
                          isSunday={isSunday}
                          tableLocked={tableLocked}
                          lockTitle={lockTitle}
                          inDuration={inDuration}
                          isDurationStart={isDurationStart}
                          isDurationEnd={isDurationEnd}
                          durationFromPlan={rowDFromPlan}
                          isCritical={isCritical}
                          isAlap={rowIsAlap}
                          onChangeValue={setDraftValue}
                          onKeyDown={handleCellKeyDown}
                        />
                      );
                    })}
                    <td
                      className={cn(
                        "sticky z-20 px-3 py-1.5 border-b border-border text-right border-l-2 border-l-border2 min-w-[8rem]",
                        stickyBg,
                        heatmapRowBg
                      )}
                      style={{ right: 0 }}
                    >
                      {isLeaf && totalQty > 0 ? (() => {
                        const diff = totalDraft - totalQty;
                        const ratio = totalDraft / totalQty;
                        // Tam eşleşme toleransı (yuvarlama için)
                        const isComplete = Math.abs(diff) <= totalQty * 0.005;
                        const isOver = diff > totalQty * 0.005;
                        const isUnder = !isComplete && !isOver;
                        return (
                          <div className="flex items-center justify-end gap-1.5 font-mono text-xs tabular-nums">
                            <span
                              className={cn(
                                "font-bold",
                                isComplete ? "text-green" : isOver ? "text-red" : "text-yellow"
                              )}
                            >
                              {formatNumber(totalDraft, 1)}
                              <span className="text-text3 font-normal mx-0.5">/</span>
                              <span className="text-text3 font-normal">{formatNumber(totalQty, 1)}</span>
                            </span>
                            {isComplete ? (
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green text-white text-[10px]"
                                title="Plan tam karşılandı"
                              >
                                ✓
                              </span>
                            ) : isOver ? (
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red text-white text-[10px]"
                                title={`Plan aşıldı: +${formatNumber(diff, 1)} (${((ratio - 1) * 100).toFixed(1)}%)`}
                              >
                                !
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow text-white text-[10px]"
                                title={`Eksik: ${formatNumber(-diff, 1)} (${(ratio * 100).toFixed(1)}%)`}
                              >
                                !
                              </span>
                            )}
                          </div>
                        );
                      })() : null}
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5 + dayHeaders.length} className="px-3 py-10 text-center text-text3 text-sm">
                    Bu filtreye uyan kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Yatay kaydırma kontrol çubuğu */}
        <div className="border-t border-border bg-bg2/40 px-3 py-2 flex items-center gap-2 text-[11.5px]">
          <span className="text-text3 font-mono text-[10px] hidden sm:inline">YATAY KAYDIRMA:</span>
          <button
            type="button"
            onClick={() => scrollMatrixBy(-30)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
            title="1 ay geri"
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollMatrixBy(-7)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
            title="1 hafta geri"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={scrollMatrixToToday}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-accent bg-accent text-white hover:bg-accent2 text-[12px] font-bold transition-colors"
            title="Bugüne git"
          >
            <Calendar size={13} /> Bugün
          </button>
          <button
            type="button"
            onClick={() => scrollMatrixBy(7)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
            title="1 hafta ileri"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollMatrixBy(30)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
            title="1 ay ileri"
          >
            <ChevronsRight size={16} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const el = matrixScrollRef.current;
                if (el) el.scrollTo({ left: 0, behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-text2 text-[11px] font-semibold transition-colors"
              title="Proje başına dön"
            >
              <ChevronsLeft size={12} /> Başa
            </button>
            <button
              type="button"
              onClick={() => {
                const el = matrixScrollRef.current;
                if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-border bg-white hover:border-accent hover:text-accent text-text2 text-[11px] font-semibold transition-colors"
              title="Proje sonuna git"
            >
              Sona <ChevronsRight size={12} />
            </button>
          </div>
        </div>
        </Card>
      </div>

      {/* Mini-Gantt — kompakt görsel önizleme (collapsible, default kapalı) */}
      <details className="mt-4 rounded-xl border border-border bg-white overflow-hidden group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3 hover:bg-bg2/40 border-b border-border">
          <ChevronRight size={14} className="text-text2 shrink-0 transition-transform group-open:rotate-90" />
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent/15 text-accent shrink-0">
            📊
          </span>
          <span className="font-display font-bold text-sm text-text">Gantt Önizleme</span>
          <span className="text-[11px] text-text3 font-mono">
            kompakt görsel · detaylı Gantt için /timeline sayfası
          </span>
          <span className="ml-auto text-[11px] text-text3 font-mono group-open:hidden">
            tıkla → genişlet
          </span>
        </summary>
        <MiniGantt
          leafs={leafs}
          allWbs={wbs}
          wbsByCode={wbsByCode}
          projectStart={project.startDate}
          projectEnd={project.plannedEnd}
          reportDate={project.reportDate}
          criticalCodes={criticalCodes}
          durationRanges={durationRanges}
          onJumpToCode={(code) => setWizardCode(code)}
          onEditLink={editPredecessorLink}
          onJumpToLink={jumpToPredecessorLink}
          onRemovePredecessor={(targetLeaf, predCode) => {
            const newPreds = (targetLeaf.predecessors ?? []).filter(
              (p) => p.wbsCode !== predCode
            );
            setWbsPredecessors(targetLeaf.id, newPreds);
            toast(`Öncül kaldırıldı: ${predCode} → ${targetLeaf.code}`, "success");
          }}
          onAddPredecessor={(targetLeaf, predCodes, type, lagDays, lagUnit) => {
            const current = targetLeaf.predecessors ?? [];
            let accepted = 0;
            let rejected = 0;
            let working = current;
            for (const predCode of predCodes) {
              if (predCode === targetLeaf.code) {
                rejected++;
                continue;
              }
              const check = canAddPredecessor(
                wbs.map((x) =>
                  x.id === targetLeaf.id ? { ...x, predecessors: working } : x
                ),
                targetLeaf.code,
                predCode
              );
              if (!check.ok) {
                rejected++;
                continue;
              }
              const filtered = working.filter((p) => p.wbsCode !== predCode);
              working = [
                ...filtered,
                { wbsCode: predCode, type, lagDays, lagUnit },
              ];
              accepted++;
            }
            if (accepted > 0) {
              setWbsPredecessors(targetLeaf.id, working);
              toast(`${accepted} öncül eklendi → ${targetLeaf.code}`, "success");
              setTimeout(() => {
                const n = shiftByPredecessorsFresh();
                if (n > 0) toast(`${n} kalem ötelendi`, "success");
              }, 0);
            }
            if (rejected > 0) {
              toast(`${rejected} bağlantı atlandı (döngü veya kendi-bağlama)`, "error");
            }
          }}
        />
      </details>

      {/* Alt: Özet — hiyerarşik (Ana / Alt / İş Kalemi), açılır-kapanır */}
      <Card className="!p-0 mt-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-gradient-to-r from-blue/8 to-transparent">
          <ListChecks size={16} className="text-blue" />
          <h3 className="font-display font-bold text-base text-text">Plan Özeti</h3>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const all = new Set<string>();
                for (const w of wbs) {
                  if (!w.isLeaf && !w.deletedAt) all.add(w.code);
                }
                setSummaryExpanded(all);
              }}
            >
              <ChevronsUpDown size={12} /> Aç
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSummaryExpanded(new Set())}>
              <ChevronsDownUp size={12} /> Kapat
            </Button>
            <Button size="sm" variant="outline" onClick={exportPlanSummaryPdf}>
              <FileDown size={12} /> PDF İndir
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bg2 text-text2">
              <tr className="text-[10px] uppercase tracking-wider font-bold">
                <th className="px-3 py-2 text-left w-24">Kod</th>
                <th className="px-3 py-2 text-left">Ad</th>
                <th className="px-3 py-2 text-right w-20">Süre</th>
                <th className="px-3 py-2 text-left w-28">Başlangıç</th>
                <th className="px-3 py-2 text-left w-28">Bitiş</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Aktif satırlar — kod sıralı, deletedAt yok
                const all = wbs
                  .filter((w) => !w.deletedAt)
                  .slice()
                  .sort((a, b) =>
                    a.code.localeCompare(b.code, undefined, { numeric: true })
                  );
                if (all.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-text3">
                        Hiç WBS satırı yok.
                      </td>
                    </tr>
                  );
                }

                // Her satır için aggregate plan range (leaf'lerinden topla)
                function rangeFor(item: typeof all[number]): {
                  start?: string;
                  end?: string;
                  duration: number;
                } {
                  if (item.isLeaf) {
                    const r = getPlanRange(planned[item.code]);
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
                    const r = getPlanRange(planned[child.code]);
                    if (r.start && (!minS || r.start < minS)) minS = r.start;
                    if (r.end && (!maxE || r.end > maxE)) maxE = r.end;
                  }
                  return {
                    start: minS,
                    end: maxE,
                    duration: minS && maxE ? daysBetween(minS, maxE) + 1 : 0,
                  };
                }

                // Görünür satırlar: parent kapalıysa altı gözükmesin
                const isVisible = (item: typeof all[number]): boolean => {
                  if (item.level <= 1) return true; // L0 (Proje) ve L1 her zaman
                  // Atalardan biri kapalıysa gizle
                  const parts = item.code.split(".");
                  for (let i = parts.length - 1; i >= 2; i--) {
                    const ancestorCode = parts.slice(0, i).join(".");
                    if (!summaryExpanded.has(ancestorCode)) return false;
                  }
                  return true;
                };

                const visible = all.filter((w) => w.level >= 1 && isVisible(w));

                // Proje toplam — tüm planlanmış yaprakların aralığı
                let projMinS: string | undefined;
                let projMaxE: string | undefined;
                for (const w of all) {
                  if (!w.isLeaf) continue;
                  const r = getPlanRange(planned[w.code]);
                  if (r.start && (!projMinS || r.start < projMinS)) projMinS = r.start;
                  if (r.end && (!projMaxE || r.end > projMaxE)) projMaxE = r.end;
                }
                const projDuration =
                  projMinS && projMaxE ? daysBetween(projMinS, projMaxE) + 1 : 0;

                const projectTotalRow = (
                  <tr
                    key="__project_total__"
                    className="border-t border-border bg-gradient-to-r from-[#1e3a8a] via-[#1e40af] to-[#2563eb] text-white"
                  >
                    <td className="px-3 py-2 font-mono text-[10px] text-white/70 whitespace-nowrap">
                      —
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="w-4 shrink-0" />
                        <span className="font-display font-extrabold uppercase tracking-wider text-[13px]">
                          Toplam Proje Planı
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {projDuration > 0 ? (
                        <span className="font-extrabold text-[14px]">
                          {projDuration}{" "}
                          <span className="text-white/70 font-normal text-[10px]">gün</span>
                        </span>
                      ) : (
                        <span className="text-white/50">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold">
                      {projMinS ? formatDate(projMinS) : <span className="text-white/50">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] font-bold">
                      {projMaxE ? formatDate(projMaxE) : <span className="text-white/50">—</span>}
                    </td>
                  </tr>
                );

                const dataRows = visible.map((w) => {
                  const r = rangeFor(w);
                  const isOpen = summaryExpanded.has(w.code);
                  const hasChildren = !w.isLeaf && all.some(
                    (c) => c.code.startsWith(w.code + ".")
                  );

                  // Stil seviyeye göre
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

                  return (
                    <tr key={w.id} className={cn("border-t border-border", rowBg)}>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-text3 whitespace-nowrap">
                        {w.code}
                      </td>
                      <td className="px-3 py-1.5">
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
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {r.duration > 0 ? (
                          <span
                            className={cn(
                              "font-semibold",
                              w.level === 1
                                ? "text-accent"
                                : w.level === 2
                                ? "text-blue"
                                : ""
                            )}
                          >
                            {r.duration}{" "}
                            <span className="text-text3 font-normal text-[10px]">gün</span>
                          </span>
                        ) : (
                          <span className="text-text3">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {r.start ? formatDate(r.start) : <span className="text-text3">—</span>}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[11px]">
                        {r.end ? formatDate(r.end) : <span className="text-text3">—</span>}
                      </td>
                    </tr>
                  );
                });

                return [projectTotalRow, ...dataRows];
              })()}
            </tbody>
          </table>
        </div>
      </Card>

      <PlanWizard
        open={!!wizardCode}
        onClose={() => setWizardCode(null)}
        item={(wizardCode ? wbs.find((w) => w.code === wizardCode) : null) as WbsItem | null}
        existingByDate={(wizardCode ? planned[wizardCode] ?? {} : {}) as Record<string, number>}
        earliestStart={wizardCode ? schedules.get(wizardCode)?.earliestStart : undefined}
        latestEnd={wizardCode ? schedules.get(wizardCode)?.earliestEnd : undefined}
        constraintReason={wizardCode ? schedules.get(wizardCode)?.reason : undefined}
        onSubmit={(byDate) => {
          if (wizardCode) autoDistribute(wizardCode, byDate);
        }}
        onSubmitMilestone={(date) => {
          if (!wizardCode || !project) return;
          // Milestone'un MIKTARI YOK — planned tablosuna hiçbir değer YAZILMAZ.
          // Sadece WbsItem.milestoneDate set edilir (tek tarih).
          // Gerçekleşme bilgisi (milestoneCompletedAt) Gerçekleşme sayfasından girilir.
          const existing = planned[wizardCode] || {};
          for (const d of Object.keys(existing)) {
            setPlanned(project.id, wizardCode, d, 0);
          }
          const item = wbs.find((w) => w.code === wizardCode);
          if (item) updateWbs(item.id, { milestoneDate: date });
          toast(`Milestone tarihi ayarlandı: ${date}`, "success");
        }}
      />

      {/* Kalem seçici dialog — üst "Planlama Sihirbazı" butonuna basınca */}
      <Dialog
        open={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setPickerSearch("");
        }}
        title="Planlama Sihirbazı — Kalem Seç"
        size="md"
      >
        <div className="space-y-3">
          <p className="text-[12.5px] text-text2 leading-relaxed">
            Hangi iş kalemi için plan kuracaksın? Listeden seç → kalem için sihirbaz açılır.
          </p>
          <Input
            placeholder="Kod veya ad ile ara..."
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-80 overflow-y-auto border border-border rounded-lg">
            {(() => {
              const q = pickerSearch.trim().toLowerCase();
              const filtered = leafs.filter(
                (l) =>
                  !q ||
                  l.code.toLowerCase().includes(q) ||
                  l.name.toLowerCase().includes(q)
              );
              if (filtered.length === 0) {
                return (
                  <div className="px-3 py-6 text-center text-text3 text-[12px]">
                    Eşleşen kalem yok.
                  </div>
                );
              }
              return filtered.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerSearch("");
                    setWizardCode(l.code);
                  }}
                  className="w-full text-left px-3 py-2 border-b border-border/40 hover:bg-accent/5 transition-colors flex items-center gap-2"
                >
                  <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">
                    {l.code}
                  </span>
                  <span className="flex-1 text-[12.5px] text-text truncate">{l.name}</span>
                  {l.activityType === "milestone" ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple/15 text-purple shrink-0">
                      ◆
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-text3 shrink-0">
                      {l.quantity > 0 ? `${formatNumber(l.quantity, 0)} ${l.unit || ""}` : "—"}
                    </span>
                  )}
                </button>
              ));
            })()}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setPickerOpen(false);
              setPickerSearch("");
            }}
          >
            Kapat
          </Button>
        </DialogFooter>
      </Dialog>

      <MilestoneMigrationDialog
        open={migrationOpen}
        candidates={milestoneCandidates}
        onClose={() => setMigrationOpen(false)}
        onConvert={(ids) => {
          if (!project) return;
          let cnt = 0;
          for (const id of ids) {
            updateWbs(id, { activityType: "milestone", quantity: 0, unit: "" });
            cnt++;
          }
          toast(`${cnt} kalem milestone olarak işaretlendi`, "success");
          setMigrationOpen(false);
          if (ids.length === milestoneCandidates.length) dismissMigration();
        }}
      />

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Planlama Nasıl Yapılır?" size="lg">
        <div className="space-y-4 text-[13px] leading-relaxed">
          <p className="text-text2">
            Bu sayfa projenin <strong className="text-text">baseline (taban) planını</strong> kurman için var.
            WBS&apos;teki her imalat kalemi için hangi gün ne kadar yapılacağı girilir. Tablo daima kilitlidir —
            değer girişi sadece <strong>Planlama Sihirbazı</strong> üzerinden olur.
          </p>

          <p className="text-[11.5px] text-text3 italic">
            PMP akışı: WBS → Süreler → Öncüller → Planlama Sihirbazı → Baseline → Critical Path → What-If → Excel
          </p>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2">
              1. WBS — Aktiviteleri Tanımla
            </h4>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                <strong>WBS</strong> sayfasında her kalemi gir. L3 (yaprak) seviyesi planlamaya konu olur.
              </li>
              <li>
                Her yaprak için <strong>Aktivite Tipi</strong> seç:
                <ul className="list-disc list-outside ml-5 mt-0.5">
                  <li><strong>Work</strong> — ölçülebilir iş (m², ton, adet vb.), gün-gün dağıtılır.</li>
                  <li>
                    <strong>Milestone (◆)</strong> — tek tarihte gerçekleşen olay (sözleşme imzası, izin
                    alındı). Miktar yok, sadece hedef tarih. &quot;Yapıldı&quot; işareti{" "}
                    <strong>Gerçekleşme</strong> sayfasından girilir.
                  </li>
                </ul>
              </li>
              <li>
                Her work kalemi için <strong>miktar + birim</strong> gir (örn. 500 m², 12 adet).
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2 flex items-center gap-2">
              <Clock3 size={14} className="text-accent" /> 2. Süreler — Estimate Activity Durations
            </h4>
            <p className="text-text2 mb-2">
              Tablonun üstündeki <strong>① Süreleri Tanımla</strong> butonuna tıkla. Açılan dialog&apos;da
              her iş kalemi için <strong>tahmini çalışma günü</strong> gir. PMP&apos;nin{" "}
              <em>Estimate Activity Durations</em> adımıdır.
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                Tahmini süre doluysa Planlama Sihirbazı default başlangıç değeri olarak bunu kullanır.
              </li>
              <li>
                Boşsa sihirbaz miktara göre kestirim yapar (max 30 gün, default 10).
              </li>
              <li>
                &quot;Otomatik Tahmin (Miktara Göre)&quot; ile boş olanları tek tıkla doldur.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2 flex items-center gap-2">
              <Link2 size={14} className="text-blue" /> 3. Öncüller — Sequence Activities
            </h4>
            <p className="text-text2 mb-2">
              <strong>② Öncül Ekle</strong> butonu ile bir kalemin başka bir kaleme bağlı olduğunu
              söylersin (FS, SS, FF + lag).
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                <strong>Tip</strong>: FS (bitince başlar), SS (başlayınca başlar), FF (bitince biter).
              </li>
              <li>
                <strong>Lag birimi</strong> 3 seçenek: takvim günü, Pazar hariç, Cmt-Pz hariç.
              </li>
              <li>
                Sihirbazda öncül kısıtı varsa başlangıç/bitiş otomatik <em>clamp</em>&apos;lenir.
              </li>
              <li>
                Döngü tespit edilirse <strong>Öneriler ve Uyarılar</strong> panelinde gösterilir.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2 flex items-center gap-2">
              <Wand2 size={14} className="text-accent" /> 4. Planlama Sihirbazı — Develop Schedule
            </h4>
            <p className="text-text2 mb-2">İki yoldan açabilirsin:</p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2 mb-2">
              <li>Tablodaki bir <strong>kalem adına tıkla</strong> → sihirbaz o kalem için açılır.</li>
              <li>Üstteki <strong>③ Planlama Sihirbazı</strong> butonuna bas → liste açılır, kalem seç.</li>
            </ul>
            <p className="text-text2 mb-1">Sihirbazda:</p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                <strong>Dağılım şablonu</strong> seç — düzgün, S-eğrisi (orta yoğun), önden yüklü,
                sondan yüklü veya sabit günlük miktar. Her değişiklik <em>otomatik</em> uygulanır.
              </li>
              <li>
                <strong>Başlangıç + Süre / Bitiş</strong>: süre default WBS tahmininden gelir.
                Birini değiştirince diğeri otomatik hesaplanır.
              </li>
              <li>
                <strong>Cmt/Pz çalış</strong> kutucukları ile çalışma takvimini belirle. Kapalı günler
                önizleme tablosunda kilitli (🔒 —) görünür.
              </li>
              <li>
                Toplam mutlak tutmalı: günlük toplam = kalemin hedef miktarı. Tutmazsa{" "}
                <strong>Kaydet</strong> butonu kapalıdır.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-blue" /> 5. Baseline Kaydet — Plan Dondurma
            </h4>
            <p className="text-text2 mb-2">
              <strong>Baseline = onaylanmış orijinal plan</strong>. Proje yöneticisi planı bitirip{" "}
              <strong>④ Baseline Kaydet</strong> butonuna basınca, o anki tüm plan{" "}
              <em>donmuş referans</em> olarak saklanır. Daha sonra plan üzerinde değişiklik yapılsa bile
              baseline aynı kalır — böylece projenin <strong>başlangıçtaki taahhüt</strong>
              ile şu anki durum arasındaki <strong>sapma</strong> ölçülebilir hale gelir.
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                Bir kalem için ilk sihirbaz kaydında baseline <strong>otomatik snapshot</strong>{" "}
                alınır.
              </li>
              <li>
                Plan değişirse <strong>④ Baseline Yeniden Al</strong> ile mevcut planı yeni baseline
                olarak dondurursun.
              </li>
              <li>
                Baseline, S-curve / dashboard / variance analizinde &quot;hedef çizgisi&quot; olarak
                kullanılır.
              </li>
              <li>
                Sapma (Δ) = mevcut plan − baseline. Pozitif Δ = gecikme, negatif = erken.
              </li>
            </ul>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2">
              ⚡ 6. Critical Path — Kritik Yol Analizi
            </h4>
            <p className="text-text2">
              <strong>⚡ Critical Path</strong> butonu: <em>float = 0</em> olan (gecikmesi projeyi
              doğrudan geciktirir) tüm kalemleri kırmızıyla vurgular ve açılır listede gösterir. Bu
              kalemler proje takviminin omurgasıdır — gecikme = proje bitişi gecikir.
            </p>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2">
              🔮 7. What-If Senaryoları
            </h4>
            <p className="text-text2">
              Hipotetik durumları test et: aktivite gecikmesi, hızlandırma (crash), tatil etkisi, kaynak
              yokluğu, öncül değişikliği, miktar değişikliği, toplu öteleme, hava riski. Sonuç KPI&apos;ları
              + etkilenen aktivite listesi gösterilir. <strong>Canlı veriye dokunmaz</strong>.
            </p>
          </section>

          <section>
            <h4 className="font-display font-bold text-sm text-text mb-2">📊 8. Excel İndirme</h4>
            <p className="text-text2">
              <strong>Planı İndir (Excel)</strong>: tüm proje takvimini ay-gün matrisli Excel olarak
              indir. Aktivite tipi, öncüller, milestone tarihleri dahil. Saha ekibiyle paylaşmak için
              kullan.
            </p>
          </section>

          <section className="border-t border-border pt-3">
            <h4 className="font-display font-bold text-sm text-text mb-2">⚡ Tıklama Kısayolları</h4>
            <p className="text-[12px] text-text3 mb-2">
              Hem planlama tablosunda hem Mini-Gantt önizlemede aynı kısayollar geçerli:
            </p>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                <strong>WBS koduna tıkla</strong> (örn. <span className="font-mono text-blue">1.2.1</span>) →
                o kalem için <strong>Öncül Ekle</strong> popover&apos;ı açılır. Aranabilir liste +
                Tip (FS/SS/FF) + Lag + Birim. Çoklu öncül seçimi destekli, döngü/self-link otomatik
                engellenir.
              </li>
              <li>
                <strong>Açıklama/kalem adına tıkla</strong> → <strong>Planlama Sihirbazı</strong> açılır
                (süre, başlangıç, dağılım şablonu girişi).
              </li>
              <li>
                <strong>Öncül/ardıl rozetleri</strong> (← N / M →) → mevcut bağlantıları gör, sil. Yeni
                öncül eklemek için WBS koduna tıkla (rozet sadece görüntüleme).
              </li>
              <li>
                <strong>Milestone diamond</strong> (◆) → tarih atanmamışsa gri, atanmışsa mor,
                tamamlandıysa yeşil. Tarih atamak için kalem adına tıkla.
              </li>
            </ul>
            <p className="text-[11px] text-text3 mt-2">
              Bu özet ayrıca tablonun üstündeki <strong>💡 Kısayollar</strong> info ikonuna tıklayınca
              da küçük bir popover&apos;da görünür.
            </p>
          </section>

          <section className="border-t border-border pt-3">
            <h4 className="font-display font-bold text-sm text-text mb-2">💡 Pratik İpuçları</h4>
            <ul className="list-disc list-outside ml-5 space-y-1 text-text2">
              <li>
                <strong>Mouse wheel</strong>: dikey kaydırma. <strong>Shift + wheel</strong>: yatay
                kaydırma. Touchpad çapraz hareket otomatik baskın eksene düşer — çapraz kaydırma yok.
              </li>
              <li>
                Tablo daima kilitli — değer girişi sadece sihirbaz üzerinden olur.
              </li>
              <li>
                <strong>Temizle</strong> butonu: çoklu kalem için plan/baseline/öncülleri sıfırlar.
              </li>
            </ul>
          </section>
        </div>
        <DialogFooter>
          <Button variant="accent" onClick={() => setHelpOpen(false)}>Anladım</Button>
        </DialogFooter>
      </Dialog>

      <CriticalPathDialog
        open={criticalDialogOpen}
        onClose={() => setCriticalDialogOpen(false)}
        criticalCodes={criticalCodes}
        leafs={leafs}
        schedules={schedules}
        pathOn={criticalPathOn}
        onTogglePath={(on) => setCriticalPathOn(on)}
        onJump={(code) => {
          setCriticalDialogOpen(false);
          setWizardCode(code);
        }}
      />

      <WhatIfDialog
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        wbs={wbs}
        leafs={leafs}
        planned={planned}
        projectStart={project.startDate}
      />

      <DurationInputDialog
        open={durationOpen}
        onClose={() => setDurationOpen(false)}
        wbs={wbs}
        onSave={(entries) => {
          let updated = 0;
          for (const [code, payload] of Object.entries(entries)) {
            const item = wbs.find((w) => w.code === code);
            if (!item) continue;
            const newDuration = payload.durationDays;
            const newWorkweek = payload.workweek;
            const before = item.estimatedDurationDays;
            const beforeWw = item.workweek;
            if (before !== newDuration || beforeWw !== newWorkweek) {
              updateWbs(item.id, {
                estimatedDurationDays: newDuration,
                workweek: newWorkweek,
              });
              updated++;
            }
          }
          toast(`${updated} kalem güncellendi`, "success");
        }}
      />

      <BulkDistributeDialog
        open={bulkDistribOpen}
        onClose={() => setBulkDistribOpen(false)}
        wbs={wbs}
        schedules={schedules}
        projectStart={project.startDate}
        onApply={(results) => {
          let total = 0;
          for (const { code, byDate } of results) {
            autoDistribute(code, byDate);
            total++;
          }
          toast(`${total} kaleme dağıtım uygulandı`, "success");
          setTimeout(() => {
            const n = shiftByPredecessorsFresh();
            if (n > 0) toast(`${n} kalem öncüllere göre ötelendi`, "success");
          }, 0);
        }}
      />

      <AlapSelectDialog
        open={alapDialogOpen}
        onClose={() => setAlapDialogOpen(false)}
        wbs={wbs}
        schedules={schedules}
        initialAlapCodes={alapCodes}
        onApply={(newAlapCodes) => {
          if (!project) return;
          setWbsScheduleTypes(project.id, newAlapCodes);
          const alapCount = newAlapCodes.size;
          const previousAlap = alapCodes.size;
          if (alapCount === 0 && previousAlap === 0) {
            toast("Değişiklik yok", "info");
          } else {
            toast(
              alapCount > 0
                ? `${alapCount} kalem ALAP olarak işaretlendi`
                : "Tüm ALAP işaretleri kaldırıldı",
              "success"
            );
          }
          // Planı effective konuma kaydır
          setTimeout(() => {
            const n = shiftByPredecessorsFresh();
            if (n > 0) toast(`${n} kalem yeni konumuna kaydırıldı`, "success");
          }, 0);
        }}
      />

      {/* Float Isı Haritası — bilgilendirme banner'ı (ilk açılışta otomatik) */}
      <Dialog
        open={floatInfoOpen}
        onClose={() => setFloatInfoOpen(false)}
        title="📊 Float — Bilmen Gereken"
        size="md"
      >
        <div className="space-y-3 text-[12.5px] text-text leading-relaxed">
          <p>
            <strong>Float topolojiktir.</strong> Sadece öncül zincirine bakar —
            hava, malzeme aksaması, ekip uygunluğu gibi <strong>gerçek hayat
            buffer&apos;ını hesaba katmaz</strong>.
          </p>
          <p>
            Float=10 demek &ldquo;<em>topolojik olarak 10 gün esnekliğin var, buna
            ekstra realite buffer&apos;ı eklemen lazım</em>&rdquo; demek. &ldquo;10 gün rahatın
            var&rdquo; demek değil.
          </p>
          <p className="px-3 py-2 rounded-lg bg-yellow/10 border border-yellow/30">
            <strong>Birikimli kullanma.</strong> Bir kalemin float&apos;ını tamamen
            tüketirsen, arkasındaki tüm zincirin float&apos;ı sıfırlanır ve
            <strong> yeni kritik yollar çıkar</strong>.
          </p>
          <p className="text-text2">
            Isı haritası: <span className="font-mono text-[10px] px-1 rounded bg-red/15 text-red">0g</span>{" "}
            kritik · <span className="font-mono text-[10px] px-1 rounded bg-yellow/15 text-yellow">1-3g</span>{" "}
            riskli · <span className="font-mono text-[10px] px-1 rounded bg-green/15 text-green">4+g</span>{" "}
            esnek.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setFloatInfoOpen(false);
            }}
          >
            Anladım
          </Button>
          <Button
            variant="accent"
            onClick={() => {
              try {
                sessionStorage.setItem("float-info-dismissed", "1");
              } catch {}
              setFloatInfoOpen(false);
            }}
          >
            Bu oturumda bir daha gösterme
          </Button>
        </DialogFooter>
      </Dialog>

      <CleanupDialog
        open={cleanupOpen}
        onClose={() => setCleanupOpen(false)}
        leafs={leafs}
        planned={planned}
        baseline={baseline}
        onConfirm={(codes, opts: CleanupOptions) => {
          if (!project) return;
          const res = bulkClearWbsData(project.id, codes, opts);
          const parts: string[] = [];
          if (opts.planned) parts.push(`${res.plannedCleared} plan`);
          if (opts.baseline) parts.push(`${res.baselineCleared} baseline`);
          if (opts.predecessors) parts.push(`${res.predecessorsCleared} öncül`);
          toast(`Temizlendi · ${parts.join(", ")}`, "success");
          setCleanupOpen(false);
        }}
      />

      <AddPredecessorDialog
        open={addPredOpen}
        onClose={() => setAddPredOpen(false)}
        allWbs={wbs}
        planned={planned}
        onAdd={(targetCodes, predCodes, type, lag, lagUnit) => {
          let accepted = 0;
          let rejected = 0;
          // Her B için pred listesini tek tek güncelle
          for (const targetCode of targetCodes) {
            const target = wbs.find((w) => w.code === targetCode);
            if (!target) continue;
            let working = target.predecessors ?? [];
            for (const predCode of predCodes) {
              if (predCode === targetCode) continue;
              const check = canAddPredecessor(
                wbs.map((w) =>
                  w.id === target.id ? { ...w, predecessors: working } : w
                ),
                targetCode,
                predCode
              );
              if (!check.ok) {
                rejected++;
                continue;
              }
              const filtered = working.filter((p) => p.wbsCode !== predCode);
              working = [...filtered, { wbsCode: predCode, type, lagDays: lag, lagUnit }];
              accepted++;
            }
            setWbsPredecessors(target.id, working);
          }
          setAddPredOpen(false);
          if (accepted > 0) {
            toast(`${accepted} bağlantı eklendi`, "success");
            // Otomatik uygula — kullanıcı ayrıca "Planı Uygula"ya basmasın
            // setTimeout ile bir mikro-tick bekle: setWbsPredecessors persist'e işlesin sonra hesapla
            setTimeout(() => applyPredecessors(), 0);
          }
          if (rejected > 0) {
            toast(`${rejected} bağlantı döngü veya kendi-bağlama nedeniyle eklenmedi`, "error");
          }
        }}
      />
    </>
  );
}

function AddPredecessorDialog({
  open,
  onClose,
  allWbs,
  planned,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  allWbs: ReturnType<typeof useProjectWbs>;
  planned: ReturnType<typeof useProjectPlanned>;
  onAdd: (
    targetCodes: string[],
    predCodes: string[],
    type: PredecessorType,
    lag: number,
    lagUnit: "calendar" | "work" | "no-sunday"
  ) => void;
}) {
  const [targetCodes, setTargetCodes] = useState<string[]>([]);
  const [predCodes, setPredCodes] = useState<string[]>([]);
  const [type, setType] = useState<PredecessorType>("FS");
  const [lagText, setLagText] = useState("0");
  const [lagUnit, setLagUnit] = useState<"calendar" | "work" | "no-sunday">("calendar");
  const lag = (() => {
    if (lagText === "" || lagText === "-") return 0;
    const n = parseInt(lagText, 10);
    return isNaN(n) ? 0 : n;
  })();

  // Tüm WBS — koda göre sıralı, başlıklar + leaf'ler dahil
  const sortedAll = useMemo(
    () =>
      allWbs
        .filter((w) => !w.deletedAt && w.level >= 1)
        .slice()
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [allWbs]
  );

  // Seçim listesi: L3 leaf'ler tıklanabilir, L1/L2 başlık olarak görsel ayırıcı
  const allOptions = useMemo(
    () =>
      sortedAll.map((w) => {
        if (w.isLeaf) {
          return {
            value: w.code,
            label: `${w.code} · ${w.name}`,
          };
        }
        return {
          value: w.code,
          label: `${w.code} · ${w.name}`,
          header: true,
          headerLevel: w.level === 1 ? 0 : 1,
        };
      }),
    [sortedAll]
  );

  // B veya A overlap'ı: aynı kod hem B hem A olamaz (kendi-bağlama)
  const targetOverlap = targetCodes.filter((c) => predCodes.includes(c));
  const totalLinks = targetCodes.length * predCodes.length - targetOverlap.length;

  return (
    <Dialog open={open} onClose={onClose} title="Yeni Öncül" size="xl">
      <div className="space-y-3 min-h-[75vh]">
        <Field
          label={`İmalat (B) — bağımlı kalem${targetCodes.length > 0 ? ` · ${targetCodes.length} seçili` : ""}`}
        >
          <MultiSelectFilter
            label="İmalat"
            options={allOptions}
            selected={targetCodes}
            onChange={setTargetCodes}
            placeholder="Bağımlı kalem(ler) seç"
            searchable
            maxHeight={600}
          />
        </Field>
        <Field
          label={`Öncül (A) — önce bitmesi/başlaması gereken${predCodes.length > 0 ? ` · ${predCodes.length} seçili` : ""}`}
        >
          <MultiSelectFilter
            label="Öncül"
            options={allOptions}
            selected={predCodes}
            onChange={setPredCodes}
            placeholder="Öncül kalem(ler) seç"
            searchable
            maxHeight={600}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tip (tümü için)">
            <Select value={type} onChange={(e) => setType(e.target.value as PredecessorType)}>
              <option value="FS">FS — Finish→Start (A bitince B başlar)</option>
              <option value="SS">SS — Start→Start (A başlayınca B başlar)</option>
              <option value="FF">FF — Finish→Finish (A bitince B biter)</option>
            </Select>
          </Field>
          <Field label="Lag (tümü için)" hint="+ öteleme · − ön çekim (örtüşme, örn −3)">
            <div className="flex items-stretch gap-1">
              <Input
                type="text"
                inputMode="numeric"
                value={lagText}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || v === "-" || /^-?\d+$/.test(v)) {
                    setLagText(v);
                  }
                }}
                onBlur={() => {
                  if (lagText === "" || lagText === "-") setLagText("0");
                }}
                className="flex-1"
              />
              <div className="inline-flex p-0.5 bg-bg3 rounded-md border border-border gap-0.5">
                <button
                  type="button"
                  onClick={() => setLagUnit("calendar")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap",
                    lagUnit === "calendar"
                      ? "bg-white text-accent shadow-soft"
                      : "text-text2 hover:text-text"
                  )}
                  title="Takvim günü — Cmt/Pz dahil her gün sayılır"
                >
                  Takvim
                </button>
                <button
                  type="button"
                  onClick={() => setLagUnit("no-sunday")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap",
                    lagUnit === "no-sunday"
                      ? "bg-white text-accent shadow-soft"
                      : "text-text2 hover:text-text"
                  )}
                  title="Pazar hariç — Cumartesi çalışılır, Pazar atlanır"
                >
                  Pazar Hariç
                </button>
                <button
                  type="button"
                  onClick={() => setLagUnit("work")}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap",
                    lagUnit === "work"
                      ? "bg-white text-accent shadow-soft"
                      : "text-text2 hover:text-text"
                  )}
                  title="Cumartesi-Pazar hariç — sadece hafta içi"
                >
                  Cmt-Pz Hariç
                </button>
              </div>
            </div>
          </Field>
        </div>

        {/* Görsel zaman çizelgesi — 1 B + 1 A seçili olduğunda */}
        {targetCodes.length === 1 && predCodes.length === 1 && targetCodes[0] !== predCodes[0] && (
          <PredecessorTimelinePreview
            aCode={predCodes[0]}
            bCode={targetCodes[0]}
            type={type}
            lag={lag}
            lagUnit={lagUnit}
            allWbs={allWbs}
            planned={planned}
          />
        )}

        {totalLinks > 0 && (
          <div className="text-[11px] text-text3 bg-bg2 rounded-md px-2.5 py-1.5 space-y-0.5">
            <div>
              ℹ <strong>{totalLinks}</strong> bağlantı oluşturulacak ({targetCodes.length} B × {predCodes.length} A
              {targetOverlap.length > 0 ? `, − ${targetOverlap.length} kendi-bağlama atlanır` : ""}).
            </div>
            <div>
              Tip: <strong>{type}</strong> · Lag:{" "}
              <strong>
                {lag === 0 ? "0" : `${lag > 0 ? "+" : ""}${lag}`}
                {lagUnit === "work"
                  ? " (Cmt-Pz hariç)"
                  : lagUnit === "no-sunday"
                  ? " (Pazar hariç)"
                  : " takvim günü"}
              </strong>
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() => {
            if (targetCodes.length === 0 || predCodes.length === 0) {
              alert("Hem B (imalat) hem A (öncül) seçilmeli");
              return;
            }
            onAdd(targetCodes, predCodes, type, lag, lagUnit);
            setTargetCodes([]);
            setPredCodes([]);
            setType("FS");
            setLagText("0");
            setLagUnit("calendar");
          }}
        >
          Ekle ({totalLinks})
        </Button>
      </DialogFooter>
    </Dialog>
  );
}


// ───────────────────────────────────────────────────────────────
// Milestone Migration Dialog — "1 adet" iş kalemlerini seçerek dönüştür
// ───────────────────────────────────────────────────────────────
function MilestoneMigrationDialog({
  open,
  candidates,
  onClose,
  onConvert,
}: {
  open: boolean;
  candidates: WbsItem[];
  onClose: () => void;
  onConvert: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // Açılışta hepsini seç
  useEffect(() => {
    if (open) setSelected(new Set(candidates.map((c) => c.id))); // eslint-disable-line react-hooks/set-state-in-effect
  }, [open, candidates]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Milestone Dönüştür — Seçim"
      size="lg"
    >
      <div className="space-y-3">
        <p className="text-[12.5px] text-text2 leading-relaxed">
          Aşağıdaki kalemler 1 adet/adetsiz değerle işaretli. <strong>İşaretlediklerini</strong>{" "}
          milestone (kilometre taşı) olarak dönüştürülecek — miktar/birim sıfırlanır, sadece
          hedef tarih girilir.
        </p>
        <div className="flex items-center gap-2 text-[11.5px]">
          <button
            type="button"
            onClick={() => setSelected(new Set(candidates.map((c) => c.id)))}
            className="text-accent hover:underline font-semibold"
          >
            Hepsini seç
          </button>
          <span className="text-text3">·</span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-text2 hover:underline font-semibold"
          >
            Hiçbirini seçme
          </button>
          <span className="ml-auto text-text3 font-mono">
            {selected.size} / {candidates.length} seçili
          </span>
        </div>
        <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
          {candidates.map((w) => (
            <label
              key={w.id}
              className="flex items-center gap-3 px-3 py-2 border-b border-border/40 hover:bg-bg2/40 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(w.id)}
                onChange={() => toggle(w.id)}
                className="w-4 h-4 accent-purple"
              />
              <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">{w.code}</span>
              <span className="flex-1 text-[12.5px] text-text truncate">{w.name}</span>
              <span className="text-[10px] font-mono text-text3 shrink-0">
                {w.quantity > 0 ? `${w.quantity} ${w.unit || "adet"}` : "—"}
              </span>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() => onConvert(Array.from(selected))}
          disabled={selected.size === 0}
        >
          ◆ {selected.size} Kalemi Milestone&apos;a Dönüştür
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────
// Critical Path Dialog — kritik kalemleri listele
// ───────────────────────────────────────────────────────────────
function CriticalPathDialog({
  open,
  onClose,
  criticalCodes,
  leafs,
  schedules,
  pathOn,
  onTogglePath,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  criticalCodes: Set<string>;
  leafs: WbsItem[];
  schedules: Map<string, { plannedStart?: string; plannedEnd?: string; earliestStart: string; earliestEnd?: string }>;
  pathOn: boolean;
  onTogglePath: (on: boolean) => void;
  onJump: (code: string) => void;
}) {
  const items = useMemo(() => {
    return leafs
      .filter((l) => criticalCodes.has(l.code))
      .sort((a, b) => {
        const sa = schedules.get(a.code)?.plannedStart ?? schedules.get(a.code)?.earliestStart ?? "";
        const sb = schedules.get(b.code)?.plannedStart ?? schedules.get(b.code)?.earliestStart ?? "";
        return sa.localeCompare(sb) || a.code.localeCompare(b.code, undefined, { numeric: true });
      });
  }, [criticalCodes, leafs, schedules]);

  return (
    <Dialog open={open} onClose={onClose} title="⚡ Critical Path — Float = 0 Kalemler" size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red/5 border border-red/20 text-[12px]">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-red text-white shrink-0">⚡</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-red">{items.length} kritik kalem</div>
            <div className="text-text2 text-[11.5px] leading-relaxed">
              Bu kalemlerin gecikmesi proje bitişini doğrudan geciktirir. Float (boşluk) = 0.
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-[11.5px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pathOn}
              onChange={(e) => onTogglePath(e.target.checked)}
              className="w-4 h-4 accent-red"
            />
            Tabloda vurgula
          </label>
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-10 text-center text-text3 text-[12px]">
            Henüz kritik kalem yok — öncüllükler eklendikçe burada görünecek.
            <div className="mt-2 text-[11px] text-text3">
              (CPM hesaplaması için kalemlerin <strong>planlanmış</strong> olması ve öncül zincirlerinin
              tanımlı olması gerekir.)
            </div>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-bg2 sticky top-0">
                <tr className="text-[10px] uppercase tracking-wider text-text3">
                  <th className="px-3 py-2 text-left w-16">Kod</th>
                  <th className="px-3 py-2 text-left">Kalem</th>
                  <th className="px-3 py-2 text-left w-24">Başlangıç</th>
                  <th className="px-3 py-2 text-left w-24">Bitiş</th>
                  <th className="px-3 py-2 text-right w-20">Süre</th>
                  <th className="px-3 py-2 w-12" />
                </tr>
              </thead>
              <tbody>
                {items.map((l) => {
                  const sch = schedules.get(l.code);
                  const s = sch?.plannedStart ?? sch?.earliestStart;
                  const e = sch?.plannedEnd ?? sch?.earliestEnd ?? s;
                  const days =
                    s && e
                      ? Math.max(
                          1,
                          Math.round(
                            (new Date(e).getTime() - new Date(s).getTime()) / 86400000
                          ) + 1
                        )
                      : 0;
                  return (
                    <tr key={l.id} className="border-t border-border/40 hover:bg-red/[0.03]">
                      <td className="px-3 py-1.5 font-mono text-[10.5px] text-red font-bold">{l.code}</td>
                      <td className="px-3 py-1.5 text-text">
                        <span className="mr-1.5">⚡</span>
                        {l.name}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10.5px] text-text2">{s ?? "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-[10.5px] text-text2">{e ?? "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-[10.5px] text-text2 text-right">
                        {days > 0 ? `${days}g` : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => onJump(l.code)}
                          className="text-[10px] text-accent hover:underline font-semibold"
                          title="Bu kalemin sihirbazını aç"
                        >
                          Aç →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Kapat</Button>
      </DialogFooter>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────
// Predecessor Timeline Preview — A + B bar chart + lag aralığı
// ───────────────────────────────────────────────────────────────
function PredecessorTimelinePreview({
  aCode,
  bCode,
  type,
  lag,
  lagUnit,
  allWbs,
  planned,
}: {
  aCode: string;
  bCode: string;
  type: PredecessorType;
  lag: number;
  lagUnit: "calendar" | "work" | "no-sunday";
  allWbs: ReturnType<typeof useProjectWbs>;
  planned: ReturnType<typeof useProjectPlanned>;
}) {
  const a = allWbs.find((w) => w.code === aCode);
  const b = allWbs.find((w) => w.code === bCode);
  if (!a || !b) return null;

  const aRange = getEffectiveRange(a, planned[aCode]);
  const bRange = getEffectiveRange(b, planned[bCode]);

  if (!aRange.start || !aRange.end) {
    return (
      <div className="px-3 py-2 rounded-md bg-yellow/5 border border-yellow/25 text-[11.5px] text-text2">
        ℹ <strong>{aCode}</strong> kalemi henüz planlanmamış — zaman çizelgesi gösterilemiyor.
      </div>
    );
  }

  // B'nin link sonrası en erken başlangıcı/bitişi
  let bConstraintStart: string | undefined;
  let bConstraintEnd: string | undefined;
  const addLagFn = (from: string, n: number) => {
    if (lagUnit === "work" || lagUnit === "no-sunday") {
      const cur = new Date(from + "T00:00:00");
      const step = n > 0 ? 1 : -1;
      let remaining = Math.abs(n);
      while (remaining > 0) {
        cur.setDate(cur.getDate() + step);
        const dow = cur.getDay();
        const skip = lagUnit === "work"
          ? dow === 0 || dow === 6
          : dow === 0;
        if (!skip) remaining--;
      }
      return toISODate(cur);
    }
    return toISODate(addDays(new Date(from), n));
  };
  if (type === "FS") bConstraintStart = addLagFn(aRange.end!, lag + 1);
  else if (type === "SS") bConstraintStart = addLagFn(aRange.start!, lag);
  else if (type === "FF") bConstraintEnd = addLagFn(aRange.end!, lag);

  // Görselleştirme: A başlangıcından ileri 90 gün'lük pencere
  const windowStart = aRange.start!;
  const windowEnd = toISODate(addDays(new Date(windowStart), 90));
  const days = Math.max(1, Math.round((new Date(windowEnd).getTime() - new Date(windowStart).getTime()) / 86400000));

  function pct(iso: string): number {
    const offset = (new Date(iso).getTime() - new Date(windowStart).getTime()) / 86400000;
    return Math.max(0, Math.min(100, (offset / days) * 100));
  }

  const aStartPct = pct(aRange.start!);
  const aEndPct = pct(aRange.end!);
  const aWidth = Math.max(1, aEndPct - aStartPct);

  // B planlı varsa onu göster, yoksa constraint'i göster
  const bShownStart = bRange.start ?? bConstraintStart;
  const bShownEnd = bRange.end ?? bConstraintEnd ?? bConstraintStart;
  const bIsConstraint = !bRange.start;

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="px-3 py-1.5 bg-bg2 border-b border-border text-[10.5px] font-bold uppercase tracking-wider text-text2 flex items-center gap-2">
        Zaman Çizelgesi Önizleme
        <span className="ml-auto font-mono normal-case tracking-normal text-text3">
          {windowStart} → {windowEnd}
        </span>
      </div>
      <div className="p-3 space-y-2 text-[11px]">
        {/* A bar */}
        <div className="flex items-center gap-2">
          <span className="font-mono w-16 shrink-0 text-blue font-bold">{aCode}</span>
          <div className="flex-1 relative h-5 bg-bg2/40 rounded">
            <div
              className="absolute top-0 bottom-0 bg-blue/30 border border-blue/60 rounded text-[10px] font-bold text-blue inline-flex items-center justify-center"
              style={{ left: `${aStartPct}%`, width: `${aWidth}%`, minWidth: "8px" }}
              title={`${aRange.start} → ${aRange.end}`}
            >
              {aWidth > 8 && "A"}
            </div>
          </div>
          <span className="font-mono text-text3 w-44 shrink-0 text-[10px] truncate">
            {aRange.start} → {aRange.end}
          </span>
        </div>

        {/* Lag indicator (FS sadece) */}
        {type === "FS" && lag !== 0 && bShownStart && (
          <div className="flex items-center gap-2 text-[10px] text-text3">
            <span className="w-16 shrink-0" />
            <div className="flex-1 relative h-3">
              <div
                className={cn(
                  "absolute top-0 bottom-0 border-t border-b border-dashed",
                  lag > 0 ? "border-yellow bg-yellow/10" : "border-red bg-red/10"
                )}
                style={{
                  left: `${pct(aRange.end!)}%`,
                  width: `${Math.max(0, pct(bShownStart) - pct(aRange.end!))}%`,
                }}
                title={`Lag ${lag > 0 ? "+" : ""}${lag} ${
                  lagUnit === "work" ? "(Cmt-Pz hariç)" : lagUnit === "no-sunday" ? "(Pazar hariç)" : "takvim günü"
                }`}
              />
            </div>
            <span className="w-44 shrink-0 font-mono">
              lag {lag > 0 ? "+" : ""}{lag}
              {lagUnit === "work" ? " ig" : lagUnit === "no-sunday" ? " g6" : " g"}
            </span>
          </div>
        )}

        {/* B bar */}
        {bShownStart && bShownEnd && (
          <div className="flex items-center gap-2">
            <span className="font-mono w-16 shrink-0 text-green font-bold">{bCode}</span>
            <div className="flex-1 relative h-5 bg-bg2/40 rounded">
              <div
                className={cn(
                  "absolute top-0 bottom-0 rounded text-[10px] font-bold inline-flex items-center justify-center",
                  bIsConstraint
                    ? "bg-green/15 border-2 border-dashed border-green/50 text-green"
                    : "bg-green/30 border border-green/60 text-green"
                )}
                style={{
                  left: `${pct(bShownStart)}%`,
                  width: `${Math.max(1, pct(bShownEnd) - pct(bShownStart))}%`,
                  minWidth: "8px",
                }}
                title={
                  bIsConstraint
                    ? `Öncül kısıtı: B en erken ${bShownStart} başlar`
                    : `${bShownStart} → ${bShownEnd}`
                }
              >
                {pct(bShownEnd) - pct(bShownStart) > 8 && "B"}
              </div>
            </div>
            <span className="font-mono text-text3 w-44 shrink-0 text-[10px] truncate">
              {bIsConstraint ? (
                <span className="text-green">≥ {bShownStart} (kısıt)</span>
              ) : (
                <>
                  {bShownStart} → {bShownEnd}
                </>
              )}
            </span>
          </div>
        )}

        <div className="text-[10.5px] text-text2 pt-1">
          <strong className="text-text">{type}</strong>:{" "}
          {type === "FS" && "A bittikten sonra B başlar."}
          {type === "SS" && "A başladıktan sonra B başlar."}
          {type === "FF" && "A bittikten sonra B biter."}
          {lag !== 0 && (
            <>
              {" "}Lag <strong>{lag > 0 ? "+" : ""}{lag}</strong>{" "}
              {lagUnit === "work"
                ? "(Cumartesi-Pazar hariç)"
                : lagUnit === "no-sunday"
                ? "(Pazar hariç)"
                : "takvim günü"} ile.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Predecessors Tree — B kalemleri kök, A'lar dal
// ───────────────────────────────────────────────────────────────
function PredecessorsTree({
  rows,
  wbsByCode,
  schedules,
  onChangeLink,
  onRemoveLink,
}: {
  rows: Array<{ target: WbsItem; link: PredecessorLink }>;
  wbsByCode: Map<string, WbsItem>;
  schedules: Map<string, { earliestStart: string; earliestEnd?: string; reason?: string }>;
  onChangeLink: (targetId: string, predCode: string, patch: Partial<PredecessorLink>) => void;
  onRemoveLink: (targetId: string, predCode: string) => void;
}) {
  // Group by target.code (B)
  const grouped = useMemo(() => {
    const m = new Map<string, { target: WbsItem; links: PredecessorLink[] }>();
    for (const { target, link } of rows) {
      const e = m.get(target.code);
      if (e) {
        e.links.push(link);
      } else {
        m.set(target.code, { target, links: [link] });
      }
    }
    // Sort by code
    return Array.from(m.values()).sort((a, b) =>
      a.target.code.localeCompare(b.target.code, undefined, { numeric: true })
    );
  }, [rows]);

  return (
    <div className="divide-y divide-border">
      {grouped.map(({ target, links }) => {
        const sch = schedules.get(target.code);
        return (
          <details key={target.id} open className="group">
            <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 hover:bg-bg2/40">
              <ChevronRight size={12} className="text-text2 transition-transform group-open:rotate-90 shrink-0" />
              <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">{target.code}</span>
              <span className="text-[12px] font-bold text-text truncate">{target.name}</span>
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-blue/15 text-blue shrink-0">
                ← {links.length} öncül
              </span>
              {sch?.earliestStart && (
                <span className="ml-auto font-mono text-[10px] text-text3">
                  ⏵ ≥ {sch.earliestStart}
                </span>
              )}
            </summary>
            <ul className="pl-8 pr-3 pb-2 space-y-1">
              {links.map((link, i) => {
                const a = wbsByCode.get(link.wbsCode);
                return (
                  <li
                    key={`${link.wbsCode}-${i}`}
                    id={`predlink-${target.code}-${link.wbsCode}`}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-blue/5 text-[11.5px] transition-colors"
                  >
                    <span className="text-text3 shrink-0">└</span>
                    <span className="font-mono text-[10px] text-blue font-bold w-14 shrink-0">
                      {link.wbsCode}
                    </span>
                    <span className="flex-1 truncate text-text2">{a?.name ?? "—"}</span>
                    <select
                      value={link.type}
                      onChange={(e) =>
                        onChangeLink(target.id, link.wbsCode, {
                          type: e.target.value as PredecessorType,
                        })
                      }
                      className="h-6 px-1.5 text-[10px] font-bold rounded border border-border bg-white focus:border-accent focus:outline-none shrink-0"
                      title="Tipi değiştir"
                    >
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                      <option value="FF">FF</option>
                    </select>
                    <input
                      type="text"
                      inputMode="numeric"
                      defaultValue={String(link.lagDays)}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const valid = raw === "" || raw === "-" ? "0" : raw;
                        const parsed = /^-?\d+$/.test(valid) ? parseInt(valid, 10) : link.lagDays;
                        e.target.value = String(parsed);
                        if (parsed !== link.lagDays) {
                          onChangeLink(target.id, link.wbsCode, { lagDays: parsed });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="h-6 w-12 px-1.5 text-[10px] text-right font-mono rounded border border-border bg-white focus:border-accent focus:outline-none shrink-0"
                      title="Lag"
                    />
                    <select
                      value={link.lagUnit ?? "calendar"}
                      onChange={(e) =>
                        onChangeLink(target.id, link.wbsCode, {
                          lagUnit: e.target.value as "calendar" | "work" | "no-sunday",
                        })
                      }
                      className="h-6 px-1 text-[10px] rounded border border-border bg-white focus:border-accent focus:outline-none shrink-0"
                      title="Lag birimi"
                    >
                      <option value="calendar">tk (Takvim)</option>
                      <option value="no-sunday">g6 (Pazar hariç)</option>
                      <option value="work">iş (Cmt-Pz hariç)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemoveLink(target.id, link.wbsCode)}
                      className="p-1 text-text3 hover:text-red rounded shrink-0"
                      title="Bu öncülü sil"
                    >
                      <X size={11} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Suggestions Panel — öneriler ve uyarılar (cycle + milestone + diğer)
// ───────────────────────────────────────────────────────────────
function SuggestionsPanel({
  cycles,
  wbs,
  wbsByCode,
  milestoneCandidates,
  migrationDismissed,
  onDismissMigration,
  onOpenMigrationDialog,
  onBulkConvertMilestones,
  onRemoveCycleLink,
  planMismatchItems,
  unplannedItems,
  overflowItems,
  projectEnd,
  onJumpToCode,
}: {
  cycles: string[];
  wbs: WbsItem[];
  wbsByCode: Map<string, WbsItem>;
  milestoneCandidates: WbsItem[];
  migrationDismissed: boolean;
  onDismissMigration: () => void;
  onOpenMigrationDialog: () => void;
  onBulkConvertMilestones: () => void;
  onRemoveCycleLink: (targetCode: string, predCode: string) => void;
  planMismatchItems: Array<{ item: WbsItem; planTotal: number; diff: number }>;
  unplannedItems: WbsItem[];
  overflowItems: Array<{ item: WbsItem; lastDate: string }>;
  projectEnd: string;
  onJumpToCode: (code: string) => void;
}) {
  // Cycle linkleri ayrıştır
  const cyclesParsed = useMemo(
    () =>
      cycles.map((cycle) => {
        const codes = cycle.split(/\s*→\s*/);
        const links: Array<{ predCode: string; targetCode: string }> = [];
        for (let i = 0; i < codes.length - 1; i++) {
          links.push({ predCode: codes[i], targetCode: codes[i + 1] });
        }
        return { codes, links };
      }),
    [cycles]
  );

  const showMilestoneCard = !migrationDismissed && milestoneCandidates.length > 0;
  const errorCount = cycles.length;
  const warnCount =
    planMismatchItems.length + overflowItems.length;
  const suggestionCount =
    (showMilestoneCard ? 1 : 0) + (unplannedItems.length > 0 ? 1 : 0);

  const totalCount = errorCount + warnCount + suggestionCount;
  if (totalCount === 0) return null;

  return (
    <details className="mb-4 rounded-xl border border-border bg-white overflow-hidden group">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-3 hover:bg-bg2/40">
        <ChevronRight size={14} className="text-text2 shrink-0 transition-transform group-open:rotate-90" />
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-yellow/15 text-yellow shrink-0">
          💡
        </span>
        <span className="font-display font-bold text-sm text-text">Öneriler ve Uyarılar</span>
        <span className="inline-flex items-center gap-1.5 ml-2">
          {errorCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red/15 text-red">
              {errorCount} hata
            </span>
          )}
          {warnCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-yellow/20 text-yellow">
              {warnCount} uyarı
            </span>
          )}
          {suggestionCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue/15 text-blue">
              {suggestionCount} öneri
            </span>
          )}
        </span>
        <span className="ml-auto text-[11px] text-text3 font-mono group-open:hidden">tıkla → genişlet</span>
      </summary>

      <div className="border-t border-border divide-y divide-border">
        {/* ERROR: Cycles */}
        {cyclesParsed.length > 0 && (
          <SuggestionItem
            tone="error"
            icon={<AlertTriangle size={14} />}
            title={`${cyclesParsed.length} öncül döngüsü tespit edildi`}
            summary="Bu döngüler dikkate alınmaz; CPM ve baseline hesabı yanlış çıkar. Her döngüden en az bir link silinmeli."
          >
            <div className="space-y-2 mt-2">
              {cyclesParsed.map(({ codes, links }, ci) => (
                <details key={ci} className="rounded border border-red/30 bg-red/[0.04] overflow-hidden">
                  <summary className="cursor-pointer list-none px-3 py-1.5 flex items-center gap-2 hover:bg-red/8 text-[11px]">
                    <ChevronRight size={11} className="text-red shrink-0" />
                    <span className="text-text2">Döngü {ci + 1}:</span>
                    <span className="font-mono text-red font-bold">
                      {codes.map((c, i) => (
                        <span key={i}>
                          {c}
                          {i < codes.length - 1 && <span className="text-text3 mx-1">→</span>}
                        </span>
                      ))}
                    </span>
                    <span className="ml-auto text-[10px] text-text3 font-mono">{links.length} link</span>
                  </summary>
                  <ul className="border-t border-red/20 px-3 py-2 space-y-1 text-[11px]">
                    {links.map((l, li) => {
                      const aItem = wbsByCode.get(l.predCode);
                      const bItem = wbsByCode.get(l.targetCode);
                      const actualLink = wbs
                        .find((w) => w.code === l.targetCode)
                        ?.predecessors?.find((p) => p.wbsCode === l.predCode);
                      return (
                        <li
                          key={li}
                          className="flex items-center gap-2 px-2 py-1 rounded bg-white border border-red/15"
                        >
                          <span className="font-mono text-blue text-[10.5px] font-bold w-14 shrink-0">
                            {l.predCode}
                          </span>
                          <span className="flex-1 truncate text-text2">{aItem?.name ?? "?"}</span>
                          <span className="text-text3 mx-1">→</span>
                          <span className="font-mono text-green text-[10.5px] font-bold w-14 shrink-0">
                            {l.targetCode}
                          </span>
                          <span className="flex-1 truncate text-text2">{bItem?.name ?? "?"}</span>
                          {actualLink && (
                            <span className="font-mono text-[9px] text-text3 shrink-0">
                              {actualLink.type}
                              {actualLink.lagDays !== 0 &&
                                ` ${actualLink.lagDays > 0 ? "+" : ""}${actualLink.lagDays}g`}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveCycleLink(l.targetCode, l.predCode)}
                            className="px-2 py-0.5 rounded bg-red text-white text-[10px] font-bold hover:bg-red/90 shrink-0"
                            title="Bu linki sil — döngü kırılır"
                          >
                            Bu Linki Sil
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </SuggestionItem>
        )}

        {/* WARNING: Plan toplam uyumsuzluğu */}
        {planMismatchItems.length > 0 && (
          <SuggestionItem
            tone="warning"
            icon={<AlertTriangle size={14} />}
            title={`${planMismatchItems.length} kalemin günlük toplamı miktarla uyuşmuyor`}
            summary="Sihirbazla yeniden planla ya da hedef miktarı güncelle."
          >
            <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-yellow/30 divide-y divide-yellow/20">
              {planMismatchItems.map(({ item, planTotal, diff }) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-yellow/[0.04] text-[11.5px]"
                >
                  <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">{item.code}</span>
                  <span className="flex-1 truncate text-text2">{item.name}</span>
                  <span className="font-mono text-[10.5px] text-text3 shrink-0">
                    {planTotal.toFixed(1)} / {item.quantity} {item.unit}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10.5px] font-bold shrink-0",
                      diff > 0 ? "text-red" : "text-yellow"
                    )}
                  >
                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onJumpToCode(item.code)}
                    className="text-[10px] text-accent hover:underline font-semibold shrink-0"
                  >
                    Düzelt →
                  </button>
                </li>
              ))}
            </ul>
          </SuggestionItem>
        )}

        {/* WARNING: Proje bitişini aşan kalemler */}
        {overflowItems.length > 0 && (
          <SuggestionItem
            tone="warning"
            icon={<AlertTriangle size={14} />}
            title={`${overflowItems.length} kalem proje bitişini aşıyor`}
            summary={`Proje bitiş tarihi: ${projectEnd}. Bu kalemler ya proje bitişini büyütmeyi gerektirir ya da daha erkene çekilmeli.`}
          >
            <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-yellow/30 divide-y divide-yellow/20">
              {overflowItems.map(({ item, lastDate }) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-yellow/[0.04] text-[11.5px]"
                >
                  <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">{item.code}</span>
                  <span className="flex-1 truncate text-text2">{item.name}</span>
                  <span className="font-mono text-[10.5px] text-red shrink-0">son: {lastDate}</span>
                  <button
                    type="button"
                    onClick={() => onJumpToCode(item.code)}
                    className="text-[10px] text-accent hover:underline font-semibold shrink-0"
                  >
                    Düzelt →
                  </button>
                </li>
              ))}
            </ul>
          </SuggestionItem>
        )}

        {/* INFO: Milestone önerisi */}
        {showMilestoneCard && (
          <SuggestionItem
            tone="info"
            icon={<span className="text-purple text-base leading-none">◆</span>}
            title={`${milestoneCandidates.length} kalem milestone (kilometre taşı) olabilir`}
            summary='Miktarı "1 adet" olan kalemler genellikle "sözleşme imzası", "izin alındı" gibi tek tarihte gerçekleşen kilometre taşlarıdır.'
          >
            <details className="mt-2 mb-3">
              <summary className="text-[11.5px] text-text3 cursor-pointer hover:text-text2 font-mono">
                Adaylar ({milestoneCandidates.length}) →
              </summary>
              <ul className="mt-2 ml-3 space-y-0.5 text-[11.5px] font-mono text-text2 max-h-40 overflow-y-auto">
                {milestoneCandidates.map((w) => (
                  <li key={w.id} className="truncate">
                    <span className="text-text3 mr-2">{w.code}</span> {w.name}
                  </li>
                ))}
              </ul>
            </details>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={onOpenMigrationDialog}>
                Seçerek Dönüştür
              </Button>
              <Button variant="outline" size="sm" onClick={onBulkConvertMilestones}>
                Hepsini Dönüştür
              </Button>
              <button
                type="button"
                onClick={onDismissMigration}
                className="ml-auto text-[10.5px] text-text3 hover:text-text2 underline"
              >
                Bu öneriyi kapat
              </button>
            </div>
          </SuggestionItem>
        )}

        {/* INFO: Hiç planlanmamış kalemler */}
        {unplannedItems.length > 0 && (
          <SuggestionItem
            tone="info"
            icon={<CalendarDays size={14} />}
            title={`${unplannedItems.length} kalem henüz planlanmadı`}
            summary="Sihirbazla planla — kalem adına tıkla ya da üstteki 'Planlama Sihirbazı' butonunu kullan."
          >
            <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-blue/30 divide-y divide-blue/20">
              {unplannedItems.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue/[0.04] text-[11.5px]"
                >
                  <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">{w.code}</span>
                  <span className="flex-1 truncate text-text2">{w.name}</span>
                  {w.activityType === "milestone" ? (
                    <span className="text-[9px] font-bold text-purple shrink-0">◆ Milestone</span>
                  ) : (
                    <span className="font-mono text-[10.5px] text-text3 shrink-0">
                      {w.quantity} {w.unit}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onJumpToCode(w.code)}
                    className="text-[10px] text-accent hover:underline font-semibold shrink-0"
                  >
                    Planla →
                  </button>
                </li>
              ))}
            </ul>
          </SuggestionItem>
        )}
      </div>
    </details>
  );
}

function SuggestionItem({
  tone,
  icon,
  title,
  summary,
  children,
}: {
  tone: "error" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  summary: string;
  children?: React.ReactNode;
}) {
  const cls = {
    error: { bg: "bg-red/[0.03] hover:bg-red/[0.06]", chip: "bg-red text-white", border: "border-l-red" },
    warning: { bg: "bg-yellow/[0.03] hover:bg-yellow/[0.06]", chip: "bg-yellow text-white", border: "border-l-yellow" },
    info: { bg: "bg-blue/[0.03] hover:bg-blue/[0.06]", chip: "bg-blue text-white", border: "border-l-blue" },
  }[tone];

  return (
    <details className={cn("group/inner border-l-4", cls.border)}>
      <summary className={cn("cursor-pointer list-none px-4 py-2.5 flex items-start gap-3", cls.bg)}>
        <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded shrink-0 mt-0.5", cls.chip)}>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[13px] text-text">{title}</div>
          <div className="text-[11.5px] text-text2 leading-snug">{summary}</div>
        </div>
        <ChevronRight size={14} className="text-text3 transition-transform group-open/inner:rotate-90 shrink-0 mt-1" />
      </summary>
      {children && <div className="px-4 pb-3 pl-14">{children}</div>}
    </details>
  );
}

// ───────────────────────────────────────────────────────────────
// Workflow Step — 4-adımlı iş akışı çubuğu için numaralı kart-buton
// ───────────────────────────────────────────────────────────────
function WorkflowStep({
  n,
  icon,
  label,
  tooltip,
  onClick,
  highlight,
  done,
}: {
  n: number;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  onClick: () => void;
  highlight?: boolean;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 pl-1 pr-3 rounded-lg border text-[11.5px] font-semibold transition-all group",
        done
          ? "bg-green/8 border-green/40 text-green hover:bg-green/15"
          : highlight
            ? "bg-accent text-white border-accent shadow-soft hover:bg-accent2"
            : "bg-white border-border text-text hover:border-accent hover:text-accent"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-md text-[11px] font-bold shrink-0",
          done
            ? "bg-green text-white"
            : highlight
              ? "bg-white/20 text-white"
              : "bg-bg2 text-text2 group-hover:bg-accent/15 group-hover:text-accent"
        )}
      >
        {done ? <CheckCircle2 size={13} /> : n}
      </span>
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

function WorkflowArrow() {
  return (
    <ChevronRight size={14} className="text-text3 shrink-0" aria-hidden="true" />
  );
}
