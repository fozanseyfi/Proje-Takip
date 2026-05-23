"use client";

/**
 * BigGantt — Timeline & Gantt sayfasının ana görselleştirmesi.
 *
 * Bu komponent /timeline sayfasına özeldir. Planlama sayfasındaki MiniGantt
 * ile İLİŞKİSİ YOKTUR — orası dokunulmaz. Buradaki yapı baseline + realized
 * verisi üzerine kuruludur ve read-only'ye yakındır.
 *
 * Renk şeması (basit, MS Project / Primavera tarzı):
 *   - Planlı bar (baseline)  : soluk mavi   (bg-blue/30 + border-blue/50)
 *   - Gerçekleşen bar         : brand yeşil (bg-accent + border-accent)
 *   - Critical Path vurgusu   : kırmızı border + ring (renk değişmez, çerçeve eklenir)
 *   - Milestone               : mor ◆ (tamamlandıysa yeşil ◆)
 *   - Parent rollup           : aynı planlı rengi, soluk
 *
 * Özellikleri:
 *   - Öncül okları: Tümü (varsayılan) / Seçili / Kapalı
 *   - Critical Path toggle  — kritik leaf'lere kırmızı border
 *   - Float Isı Haritası toggle — leaf satır arkaplanını float'a göre renklendirir
 *   - What-If butonu — callback ile dışarı bildirir
 *   - Tam ekran modu (Esc ile çıkış)
 *   - Bugün çizgisi
 *
 * Filtre (L1/L2/L3): caller responsibility — `rows` zaten filtrelenmiş gelmelidir.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  GitBranch,
  Square,
  CheckSquare,
  Zap,
  Thermometer,
  Sparkles,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WbsItem } from "@/lib/store/types";
import type { LeafSchedule } from "@/lib/calc/predecessors";
import { GanttArrows, type ArrowMode } from "@/components/planning/gantt-arrows";

export interface TimelineRow {
  item: WbsItem;
  /** Hierarchical depth: L1 = 1, L2 = 2, L3 = 3. L0 gizli. */
  level: number;
  isLeaf: boolean;
  /** Planlı (baseline) tarih aralığı — caller hesaplar. */
  planRange: { start: string; end: string };
  /** Gerçekleşen tarih aralığı — yoksa undefined. */
  realizedRange?: { start: string; end: string };
}

export interface BigGanttProps {
  rows: TimelineRow[];
  projectStart: string;
  projectEnd: string;
  reportDate: string;
  /** Forward+backward pass sonucu — float ve critical için. */
  schedules?: Map<string, LeafSchedule>;
  /** Float === 0 leaf code'ları. */
  criticalCodes?: Set<string>;
  /** Döngüde olan leaf code'ları. */
  cycleNodes?: Set<string>;
  /** What-If butonu callback'i. */
  onOpenWhatIf?: () => void;
  /**
   * Planlı (baseline) barı göster — default true.
   */
  showPlan?: boolean;
  /**
   * Gerçekleşen barı göster — default true.
   * Açıkken oklar zorla kapalı (anlam karışıklığı önlenir; oklar sadece
   * planlama akışında anlamlıdır).
   */
  showRealized?: boolean;
}

export function BigGantt({
  rows,
  projectStart,
  projectEnd,
  reportDate,
  schedules,
  criticalCodes,
  cycleNodes,
  onOpenWhatIf,
  showPlan = true,
  showRealized = true,
}: BigGanttProps) {
  // ─── Toggle state ───
  const [arrowMode, setArrowMode] = useState<ArrowMode>("all");
  const [selectedArrowCodes, setSelectedArrowCodes] = useState<Set<string>>(
    () => new Set()
  );
  const [criticalOn, setCriticalOn] = useState(true);
  const [floatHeatmapOn, setFloatHeatmapOn] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showTodayLine, setShowTodayLine] = useState(false);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);

  // Oklar SADECE Planlanan-only modunda anlamlıdır.
  // Gerçekleşen açıksa (tek başına veya planlanan ile birlikte) oklar kilitli.
  const arrowsAllowed = showPlan && !showRealized;

  // Render-zamanı türetme: arrowsAllowed=false ise effective mode "off"'a düşer,
  // ama kullanıcının seçimi state'te korunur (tekrar planlanan-only moduna döndüğünde
  // önceki tercih geri yüklenir). setState-in-effect anti-pattern'inden kaçınılır.
  const effectiveArrowMode: ArrowMode = arrowsAllowed ? arrowMode : "off";
  const effectiveFocusedCode = arrowsAllowed ? focusedCode : null;

  function toggleSelectedArrowCode(code: string) {
    if (!arrowsAllowed) return;
    setSelectedArrowCodes((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  // ─── Proje aralığı pct hesaplayıcı ───
  const totalDays = useMemo(() => {
    const a = new Date(projectStart).getTime();
    const b = new Date(projectEnd).getTime();
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }, [projectStart, projectEnd]);

  function pct(iso: string): number {
    const a = new Date(projectStart).getTime();
    const c = new Date(iso).getTime();
    return Math.max(0, Math.min(100, ((c - a) / 86400000 / totalDays) * 100));
  }

  // ─── Ay etiketleri ───
  const monthMarkers = useMemo(() => {
    const out: { iso: string; label: string; left: number; centerLeft: number }[] = [];
    const start = new Date(projectStart);
    const end = new Date(projectEnd);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const monthsTr = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const nextIso = nextMonth.toISOString().slice(0, 10);
      const effStart = iso < projectStart ? projectStart : iso;
      const effEnd = nextIso > projectEnd ? projectEnd : nextIso;
      if (effStart < effEnd) {
        const leftPct = pct(effStart);
        const rightPct = pct(effEnd);
        out.push({
          iso,
          label: `${monthsTr[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
          left: leftPct,
          centerLeft: (leftPct + rightPct) / 2,
        });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStart, projectEnd]);

  const midMonthMarkers = useMemo(() => {
    const out: { iso: string; left: number }[] = [];
    const start = new Date(projectStart);
    const end = new Date(projectEnd);
    const cur = new Date(start.getFullYear(), start.getMonth(), 15);
    if (cur < start) cur.setMonth(cur.getMonth() + 1);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      if (iso > projectStart && iso < projectEnd) {
        out.push({ iso, left: pct(iso) });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStart, projectEnd]);

  const todayLeft = pct(reportDate);
  const todayInRange = todayLeft > 0 && todayLeft < 100;

  // ─── Click-outside → focus temizle ───
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isBar = target.closest('[data-gantt-bar="true"]');
      const isPopover = target.closest('[data-predecessor-popover="true"]');
      if (!isBar && !isPopover) setFocusedCode(null);
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // ─── Esc ile fullscreen çıkış ───
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // ─── Bar alanı genişliği (ok overlay'i için) ───
  const barAreaRef = useRef<HTMLDivElement>(null);
  const [barAreaWidth, setBarAreaWidth] = useState(0);
  useLayoutEffect(() => {
    const el = barAreaRef.current;
    if (!el) return;
    setBarAreaWidth(el.offsetWidth);
    const obs = new ResizeObserver(([entry]) => {
      setBarAreaWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const rowsWrapperRef = useRef<HTMLDivElement>(null);

  // ─── GanttArrows için "visible" formatı: leaf'lerin planRange'ini almalı ───
  // GanttArrows API'sinde `isFromPlan` alanı var (planlama tarafıyla shared);
  // timeline'da hep true geçiyoruz çünkü sadece miktar girilmiş leaf'leri alıyoruz.
  const arrowsVisible = useMemo(() => {
    return rows
      .filter((r) => r.isLeaf)
      .map((r) => ({
        item: r.item,
        range: { ...r.planRange, isFromPlan: true },
      }));
  }, [rows]);

  // ─── Empty state ───
  if (rows.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-text3 text-[13px] bg-white rounded-xl border border-border">
        Görüntülenecek kalem yok. Filtre seçimini gözden geçirin veya{" "}
        <a href="/planning" className="text-accent underline">Planlama</a>&apos;dan
        plan oluşturup &quot;Baseline Al&quot; butonuna basın.
      </div>
    );
  }

  // ─── Sol kolon genişliği ───
  const CODE_COL_WIDTH = 320; // px

  // ─── Toggle button base classes ───
  const togglePillBase =
    "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold border transition-colors";

  return (
    <div
      className={cn(
        "relative bg-white rounded-xl border border-border overflow-hidden shadow-soft",
        fullscreen && "fixed inset-0 z-50 rounded-none border-0 overflow-auto"
      )}
    >
      {/* ═══════ ÜST KONTROL ŞERİDİ ═══════ */}
      <div className="flex items-center flex-wrap gap-2 px-3 py-2 border-b border-border bg-gradient-to-r from-accent/[0.06] via-white to-white">
        {/* Öncül okları — Gerçekleşen açıkken kilitli */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5",
            !arrowsAllowed && "opacity-50"
          )}
          title={
            !arrowsAllowed
              ? "Oklar yalnızca 'Planlanan' tek başına seçili iken aktiftir. Gerçekleşen açıkken kapalıdır."
              : undefined
          }
        >
          {arrowsAllowed ? (
            <GitBranch size={12} className="text-text3" />
          ) : (
            <Lock size={11} className="text-text3" />
          )}
          <span className="text-[10px] text-text3 font-mono uppercase tracking-wider">
            Oklar:
          </span>
          <div
            className={cn(
              "inline-flex p-0.5 bg-bg2 rounded border border-border gap-0",
              !arrowsAllowed && "cursor-not-allowed"
            )}
          >
            {(
              [
                { v: "all" as const, label: "Tümü" },
                { v: "selected" as const, label: "Seçili" },
                { v: "off" as const, label: "Kapalı" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                disabled={!arrowsAllowed}
                onClick={() => arrowsAllowed && setArrowMode(opt.v)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10.5px] font-bold transition-all whitespace-nowrap",
                  arrowsAllowed && arrowMode === opt.v
                    ? "bg-white text-accent shadow-soft"
                    : "text-text2",
                  arrowsAllowed
                    ? "hover:text-text"
                    : "cursor-not-allowed opacity-70"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {arrowsAllowed && arrowMode === "selected" && (
            <>
              <span className="text-[9.5px] text-text3 font-mono ml-1">
                {selectedArrowCodes.size} seçili
              </span>
              {selectedArrowCodes.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedArrowCodes(new Set())}
                  className="text-[9.5px] text-text2 hover:text-text underline"
                >
                  temizle
                </button>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCriticalOn((v) => !v)}
          className={cn(
            togglePillBase,
            criticalOn
              ? "bg-red text-white border-red shadow-soft"
              : "bg-white text-red border-red/40 hover:bg-red/5"
          )}
          title="Kritik yolu vurgula (float = 0 olan kalemler — kırmızı çerçeve)"
        >
          <Zap size={11} />
          Kritik Yol
          {criticalCodes && criticalOn && (
            <span className="font-mono text-[9.5px] opacity-85">· {criticalCodes.size}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFloatHeatmapOn((v) => !v)}
          className={cn(
            togglePillBase,
            floatHeatmapOn
              ? "bg-yellow text-white border-yellow shadow-soft"
              : "bg-white text-yellow-dark border-yellow/40 hover:bg-yellow/5"
          )}
          title="Her leaf satırın arka planı float'a göre renklenir"
        >
          <Thermometer size={11} />
          Float Isı
        </button>

        {onOpenWhatIf && (
          <button
            type="button"
            onClick={onOpenWhatIf}
            className={cn(togglePillBase, "bg-purple text-white border-purple shadow-soft hover:opacity-90")}
            title="What-If Senaryosu"
          >
            <Sparkles size={11} />
            What-If
          </button>
        )}

        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-bold border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
          title={fullscreen ? "Tam ekrandan çık (Esc)" : "Tam ekran"}
        >
          {fullscreen ? (
            <>
              <Minimize2 size={11} /> Çık (Esc)
            </>
          ) : (
            <>
              <Maximize2 size={11} /> Tam Ekran
            </>
          )}
        </button>
      </div>

      {/* ═══════ TABLO ═══════ */}
      <div
        className={cn(
          "overflow-auto",
          fullscreen
            ? "max-h-[calc(100vh-120px)]"
            : "max-h-[calc(100vh-260px)] min-h-[640px]"
        )}
      >
        {/* HEADER */}
        <div
          className="grid border-b border-border bg-bg2/50 sticky top-0 z-20 h-7"
          style={{ gridTemplateColumns: `${CODE_COL_WIDTH}px 1fr` }}
        >
          <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-text3 border-r border-border flex items-center sticky left-0 bg-bg2/50 z-30">
            Kalem
          </div>
          <div className="relative">
            {monthMarkers.map((m) => (
              <span
                key={m.iso}
                className="absolute top-0 text-[10px] font-mono text-text3 uppercase tracking-wider leading-7 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${m.centerLeft}%` }}
              >
                {m.label}
              </span>
            ))}
            {todayInRange && (
              <button
                type="button"
                onClick={() => setShowTodayLine((v) => !v)}
                className={cn(
                  "absolute top-1.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all hover:scale-125",
                  showTodayLine
                    ? "bg-yellow text-white border-yellow shadow-soft"
                    : "bg-white text-yellow border-yellow"
                )}
                style={{ left: `${todayLeft}%` }}
                title={`Bugün: ${reportDate}`}
              >
                •
              </button>
            )}
          </div>
        </div>

        {/* SATIRLAR + ok overlay */}
        <div ref={rowsWrapperRef} className="relative">
          <div
            ref={barAreaRef}
            className="absolute top-0 bottom-0 right-0 pointer-events-none z-10"
            style={{ left: CODE_COL_WIDTH }}
          >
            {(effectiveArrowMode !== "off" || effectiveFocusedCode) && barAreaWidth > 0 && (
              <GanttArrows
                visible={arrowsVisible}
                barAreaWidth={barAreaWidth}
                rowsWrapperRef={rowsWrapperRef}
                pct={pct}
                criticalCodes={criticalOn && criticalCodes ? criticalCodes : new Set()}
                mode={effectiveArrowMode}
                selectedCodes={selectedArrowCodes}
                focusedCode={effectiveFocusedCode}
              />
            )}
          </div>

          <ul>
            {rows.map((r, idx) => {
              const item = r.item;
              const isLeaf = r.isLeaf;
              const isMilestone = item.activityType === "milestone";
              const inCycle = isLeaf && cycleNodes?.has(item.code);
              const isCritical =
                criticalOn && isLeaf && !inCycle && criticalCodes?.has(item.code);

              const planLeft = pct(r.planRange.start);
              const planWidth = Math.max(0.5, pct(r.planRange.end) - planLeft);

              const realLeft = r.realizedRange ? pct(r.realizedRange.start) : 0;
              const realWidth = r.realizedRange
                ? Math.max(0.5, pct(r.realizedRange.end) - realLeft)
                : 0;

              // Float ısı haritası
              const sch = schedules?.get(item.code);
              const rowFloat = sch?.totalFloat;
              const heatmapBg =
                floatHeatmapOn && isLeaf && !isCritical && rowFloat !== undefined
                  ? rowFloat === 0
                    ? "bg-red/8"
                    : rowFloat <= 3
                      ? "bg-yellow/12"
                      : rowFloat <= 7
                        ? "bg-yellow/[0.06]"
                        : "bg-green/[0.06]"
                  : "";

              // Level-based sticky bg
              const stickyBg =
                r.level === 1
                  ? "#eff6ff"
                  : r.level === 2
                    ? "#faf5ff"
                    : "#ffffff";

              // Grup ayırıcı çizgi
              const parentCode = item.code.split(".").slice(0, -1).join(".");
              const prevItem = idx > 0 ? rows[idx - 1].item : null;
              const prevParentCode = prevItem
                ? prevItem.code.split(".").slice(0, -1).join(".")
                : null;
              const isGroupStart =
                idx > 0 && prevParentCode !== null && parentCode !== prevParentCode;

              // Satır yüksekliği — gerçekleşen var/yok'a göre
              const rowHeight = "h-8"; // tüm satırlar aynı (iki bar için yer)

              return (
                <li
                  key={item.id}
                  data-row-code={item.code}
                  className={cn(
                    "grid hover:bg-bg3/40 transition-colors",
                    rowHeight,
                    idx === 0
                      ? ""
                      : isGroupStart
                        ? "border-t-2 border-slate-300"
                        : "border-t border-slate-100"
                  )}
                  style={{ gridTemplateColumns: `${CODE_COL_WIDTH}px 1fr` }}
                >
                  {/* SOL KOLON */}
                  <div
                    className={cn(
                      "flex items-center gap-1.5 px-3 text-[11px] min-w-0 leading-tight sticky left-0 z-[5] border-r border-border/40",
                      heatmapBg
                    )}
                    style={{ backgroundColor: heatmapBg ? undefined : stickyBg }}
                  >
                    {/* Arrow seçim checkbox'ı — sadece etkin mod "selected" iken */}
                    {effectiveArrowMode === "selected" && isLeaf && (
                      <button
                        type="button"
                        onClick={() => toggleSelectedArrowCode(item.code)}
                        className={cn(
                          "shrink-0 inline-flex items-center justify-center w-4 h-4 rounded transition-colors",
                          selectedArrowCodes.has(item.code)
                            ? "text-accent"
                            : "text-text3 hover:text-text"
                        )}
                      >
                        {selectedArrowCodes.has(item.code) ? (
                          <CheckSquare size={11} />
                        ) : (
                          <Square size={11} />
                        )}
                      </button>
                    )}
                    {/* Level rozeti */}
                    <span
                      className={cn(
                        "shrink-0 text-[8.5px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded",
                        r.level === 1
                          ? "bg-blue/15 text-blue"
                          : r.level === 2
                            ? "bg-purple/15 text-purple"
                            : "bg-slate-200 text-text2"
                      )}
                    >
                      L{r.level}
                    </span>
                    <span className="font-mono text-[10px] text-text3 shrink-0">
                      {item.code}
                    </span>
                    <span
                      className={cn(
                        "truncate flex-1 min-w-0",
                        r.level === 1 && "font-bold text-text",
                        r.level === 2 && "font-semibold text-text",
                        r.level === 3 && "text-text2"
                      )}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    {/* Rozetler */}
                    {isCritical && (
                      <span
                        className="shrink-0 text-[9px] font-extrabold px-1 py-0.5 rounded bg-red/15 text-red"
                        title="Kritik yol — float = 0"
                      >
                        ⚡
                      </span>
                    )}
                    {inCycle && (
                      <span
                        className="shrink-0 text-[9px] font-extrabold px-1 py-0.5 rounded bg-yellow/15 text-yellow-dark"
                        title="Döngü içinde"
                      >
                        🔄
                      </span>
                    )}
                    {floatHeatmapOn && isLeaf && rowFloat !== undefined && !inCycle && (
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[9px] font-bold px-1 py-0.5 rounded",
                          rowFloat === 0
                            ? "bg-red/15 text-red"
                            : rowFloat <= 3
                              ? "bg-yellow/15 text-yellow-dark"
                              : "bg-green/15 text-green"
                        )}
                        title={`Float: ${rowFloat} gün`}
                      >
                        +{rowFloat}g
                      </span>
                    )}
                    {isMilestone && (
                      <span className="text-purple shrink-0" title="Milestone">◆</span>
                    )}
                  </div>

                  {/* SAĞ KOLON — bar alanı */}
                  <div className="relative overflow-visible">
                    {/* Yarım-ay çizgileri */}
                    {midMonthMarkers.map((w) => (
                      <div
                        key={`mid-${w.iso}`}
                        className="absolute top-0 bottom-0 border-l border-dashed border-slate-200 pointer-events-none"
                        style={{ left: `${w.left}%` }}
                      />
                    ))}
                    {/* Ay sınırı çizgileri */}
                    {monthMarkers
                      .filter((m) => m.left > 0.5)
                      .map((m) => (
                        <div
                          key={m.iso}
                          className="absolute top-0 bottom-0 border-l border-slate-300 pointer-events-none"
                          style={{ left: `${m.left}%` }}
                        />
                      ))}
                    {/* Bugün çizgisi */}
                    {showTodayLine && todayInRange && (
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-yellow pointer-events-none z-10"
                        style={{ left: `${todayLeft}%` }}
                      />
                    )}

                    {/* MILESTONE — diamond (planlı varsa) */}
                    {isMilestone && showPlan ? (
                      <span
                        className={cn(
                          "absolute w-3.5 h-3.5 border-2 border-white shadow-soft pointer-events-none",
                          item.milestoneCompletedAt ? "bg-accent" : "bg-purple"
                        )}
                        style={{
                          left: `${planLeft}%`,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(45deg)",
                        }}
                        title={`Milestone: ${r.planRange.start}`}
                      />
                    ) : isMilestone && !showPlan && r.realizedRange ? (
                      // Milestone tamamlanma diamond'ı — sadece gerçekleşen göster modunda
                      <span
                        className="absolute w-3.5 h-3.5 border-2 border-white shadow-soft bg-accent pointer-events-none"
                        style={{
                          left: `${realLeft}%`,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(45deg)",
                        }}
                        title={`Milestone gerçekleşti: ${r.realizedRange.start}`}
                      />
                    ) : !isMilestone ? (
                      <>
                        {/* PLANLI BAR — Seviyeye göre AYRI renk, popover yok, read-only */}
                        {showPlan && (
                          <span
                            className={cn(
                              "absolute h-2 rounded border pointer-events-none",
                              // L1 / L2 / L3 ayrı renkler (parent için biraz daha soluk)
                              r.level === 1
                                ? isLeaf
                                  ? "bg-blue/60 border-blue"
                                  : "bg-blue/45 border-blue/70"
                                : r.level === 2
                                  ? isLeaf
                                    ? "bg-purple/55 border-purple"
                                    : "bg-purple/40 border-purple/60"
                                  : // L3
                                    "bg-slate-400/60 border-slate-500",
                              // Critical override: KIRMIZI border + ring, renk değişmez
                              isCritical && "!border-red ring-1 ring-red/40"
                            )}
                            style={{
                              left: `${planLeft}%`,
                              width: `${planWidth}%`,
                              minWidth: "3px",
                              // İki bar yan yana varsa üst yarı; tek bar varsa ortala
                              top: showRealized && r.realizedRange ? "6px" : "10px",
                            }}
                            title={`Planlı: ${r.planRange.start} → ${r.planRange.end}`}
                          />
                        )}

                        {/* GERÇEKLEŞEN BAR — brand yeşil, popover yok */}
                        {showRealized && r.realizedRange && (
                          <span
                            className="absolute h-2 rounded border bg-accent border-accent shadow-sm pointer-events-none"
                            style={{
                              left: `${realLeft}%`,
                              width: `${realWidth}%`,
                              minWidth: "3px",
                              // İki bar varsa alt yarı; tek bar varsa ortala
                              top: showPlan ? "18px" : "10px",
                            }}
                            title={`Gerçekleşen: ${r.realizedRange.start} → ${r.realizedRange.end}`}
                          />
                        )}
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* LEJANT — 4 ana renk + critical */}
      <div className="px-3 py-2 border-t border-border bg-bg2/40 flex items-center gap-4 text-[10.5px] text-text2 flex-wrap">
        {showPlan && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-2 bg-blue/60 border border-blue rounded-sm" />
              <span>L1 — Ana Başlık (planlı)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-2 bg-purple/55 border border-purple rounded-sm" />
              <span>L2 — Alt Başlık (planlı)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-4 h-2 bg-slate-400/60 border border-slate-500 rounded-sm" />
              <span>L3 — İş Kalemi (planlı)</span>
            </span>
          </>
        )}
        {showRealized && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 bg-accent border border-accent rounded-sm" />
            <span>Gerçekleşen</span>
          </span>
        )}
        {showPlan && criticalOn && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 bg-slate-400/60 border-2 border-red rounded-sm" />
            <span>⚡ Kritik yol (kırmızı çerçeve)</span>
          </span>
        )}
        {showPlan && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-purple rotate-45" />
            <span>Milestone</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 ml-auto">
          <span className="inline-block w-0.5 h-3 bg-yellow" />
          <span>Bugün ({reportDate})</span>
        </span>
      </div>
    </div>
  );
}
