"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  GitBranch,
  Square,
  CheckSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WbsItem, PredecessorType } from "@/lib/store/types";
import { PredecessorQuickAdd } from "@/components/planning/predecessor-quick-add";
import { PredecessorBadges } from "@/components/planning/predecessor-badges";
import { GanttArrows, type ArrowMode } from "@/components/planning/gantt-arrows";

/**
 * Mini-Gantt — kompakt görsel önizleme.
 *
 * Detaylı Gantt /timeline sayfasında. Bu sadece bir bakışta start/end aralıklarını
 * göstermek için. Kod kolonu (sol sticky) ve bar alanı (sağ scroll) ayrı tutulur ki
 * kısa süreli aktiviteler kodun arkasında kaybolmasın.
 *
 * Renk mantığı planlama matrisi ile aynı:
 *  - Critical → kırmızı
 *  - Plan var (miktarlı)  → yeşil (accent)
 *  - Plan yok (sadece süre tahmini) → mor (purple)
 *  - Milestone → mor ◆ (tamamlandıysa yeşil ◆)
 */
export interface MiniGanttProps {
  leafs: WbsItem[];
  /** Tüm WBS (öncül QuickAdd için cycle check). */
  allWbs: WbsItem[];
  /** WBS code → item lookup (PredecessorBadges popover'ı için). */
  wbsByCode: Map<string, WbsItem>;
  projectStart: string;
  projectEnd: string;
  reportDate: string;
  criticalCodes: Set<string>;
  durationRanges: Map<string, { start: string; end: string; isFromPlan: boolean }>;
  /** Açıklama (kalem ismi) tıklanınca: planlama sihirbazını aç. */
  onJumpToCode?: (code: string) => void;
  /** Öncül QuickAdd onAdd handler — leaf'in WBS koduna tıklanınca tetiklenen ekleme. */
  onAddPredecessor: (
    targetLeaf: WbsItem,
    predCodes: string[],
    type: PredecessorType,
    lagDays: number,
    lagUnit: "calendar" | "work" | "no-sunday"
  ) => void;
  /** Bar popover'da "Düzenle" → inline form kaydet. */
  onEditLink: (
    targetCode: string,
    predCode: string,
    patch: { type: PredecessorType; lagDays: number; lagUnit: "calendar" | "work" | "no-sunday" }
  ) => void;
  /** Opsiyonel: Öncüllükler panelinde detay görünümüne git. */
  onJumpToLink?: (targetCode: string, predCode: string) => void;
  /** Bar popover'da "Sil" — öncülü kaldır. */
  onRemovePredecessor: (targetLeaf: WbsItem, predCode: string) => void;
}

export function MiniGantt({
  leafs,
  allWbs,
  wbsByCode,
  projectStart,
  projectEnd,
  reportDate,
  criticalCodes,
  durationRanges,
  onJumpToCode,
  onAddPredecessor,
  onEditLink,
  onJumpToLink,
  onRemovePredecessor,
}: MiniGanttProps) {
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

  const visible = useMemo(() => {
    return leafs
      .map((w) => {
        const r = durationRanges.get(w.code);
        return r ? { item: w, range: r } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [leafs, durationRanges]);

  // Her ay için: sınır çizgisi (left) + ortaya hizalı etiket pozisyonu (centerLeft)
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
      // Bu ayın proje aralığındaki etkili başlangıç ve bitişi
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

  // Yarım-ay çizgileri — her ayın 15'i (1. ve son gün zaten aylık çizgi olarak çiziliyor)
  const midMonthMarkers = useMemo(() => {
    const out: { iso: string; left: number }[] = [];
    const start = new Date(projectStart);
    const end = new Date(projectEnd);
    const cur = new Date(start.getFullYear(), start.getMonth(), 15);
    // İlk 15 projeden önceyse bir sonraki aya geç
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
  // Bugün çizgisi: header'daki simgeye tıklayınca toggle olur
  const [showTodayLine, setShowTodayLine] = useState(false);

  const [fullscreen, setFullscreen] = useState(false);

  // Öncül oku gösterimi: kapalı / tümü / seçili
  const [arrowMode, setArrowMode] = useState<ArrowMode>("off");
  const [selectedArrowCodes, setSelectedArrowCodes] = useState<Set<string>>(
    () => new Set()
  );
  function toggleSelectedArrowCode(code: string) {
    setSelectedArrowCodes((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  // Odaklanan bar — tıklanan bar'ın okları vurgulanır. Popover kapansa bile
  // odak korunur; sadece bar veya popover dışına tıklayınca temizlenir.
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  useEffect(() => {
    function handleDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isBar = target.closest('[data-gantt-bar="true"]');
      const isPopover = target.closest('[data-predecessor-popover="true"]');
      const isQuickAddPopover = target.closest('[data-predecessor-quickadd="true"]');
      if (!isBar && !isPopover && !isQuickAddPopover) {
        setFocusedCode(null);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, []);

  // Bar alanı pixel genişliği ölçümü (SVG ok overlay'i için)
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

  // Satırların gerçek y konumu — wrapper içindeki <li>'leri DOM'dan ölç.
  // Border'lar (1px normal, 2px grup ayırıcı) heights toplamına dahil olur;
  // hesaplama yerine ölçüm her durumda doğrudur.
  const rowsWrapperRef = useRef<HTMLDivElement>(null);

  // Esc ile tam ekrandan çık
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (visible.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-text3 text-[12px]">
        Henüz planlı kalem yok — Süreleri Tanımla veya Planlama Sihirbazı ile başla.
      </div>
    );
  }

  // CSS Grid: sol kolon (kod + ad) sabit, sağ kolon bar alanı esnek
  const CODE_COL_WIDTH = 220; // px — code + name için yeterli alan

  return (
    <div
      className={cn(
        "relative",
        fullscreen && "fixed inset-0 z-50 bg-white overflow-auto p-4"
      )}
    >
      {/* Üst kontrol şeridi — scroll'la kaymaz */}
      <div className="flex items-center justify-end gap-2 px-2 py-1 border-b border-border bg-bg2/40">
        {/* Öncül oku modu — üç-yönlü segmented kontrol */}
        <div className="inline-flex items-center gap-1 mr-auto pl-1">
          <GitBranch size={11} className="text-text3" />
          <span className="text-[10px] text-text3 font-mono uppercase tracking-wider">
            Öncül okları:
          </span>
          <div className="inline-flex p-0.5 bg-bg3 rounded border border-border gap-0">
            {(
              [
                { v: "off" as const, label: "Kapalı" },
                { v: "all" as const, label: "Tümü" },
                { v: "selected" as const, label: "Seçili" },
              ]
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setArrowMode(opt.v)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap",
                  arrowMode === opt.v
                    ? "bg-white text-accent shadow-soft"
                    : "text-text2 hover:text-text"
                )}
                title={
                  opt.v === "off"
                    ? "Hiç ok gösterme"
                    : opt.v === "all"
                      ? "Tüm öncül oklarını göster"
                      : "Sadece sol kolondan seçtiğin kalemlerin oklarını göster"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
          {arrowMode === "selected" && (
            <>
              <span className="text-[9.5px] text-text3 font-mono ml-1">
                {selectedArrowCodes.size} seçili
              </span>
              {selectedArrowCodes.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedArrowCodes(new Set())}
                  className="text-[9.5px] text-text2 hover:text-text underline"
                  title="Seçimi temizle"
                >
                  temizle
                </button>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="inline-flex items-center gap-1 h-6 px-2 rounded text-[10px] font-bold border border-border bg-white hover:border-accent hover:text-accent text-text2 transition-colors"
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
      <div className="overflow-x-auto">
      {/* HEADER: kod alanı boş, bar alanında ay etiketleri */}
      <div
        className="grid border-b border-border bg-bg2/40 h-5"
        style={{ gridTemplateColumns: `${CODE_COL_WIDTH}px 1fr` }}
      >
        <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-text3 border-r border-border flex items-center">
          Kalem
        </div>
        <div className="relative">
          {monthMarkers.map((m) => (
            <span
              key={m.iso}
              className="absolute top-0 text-[9.5px] font-mono text-text3 uppercase tracking-wider leading-5 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${m.centerLeft}%` }}
            >
              {m.label}
            </span>
          ))}
          {/* Bugün simgesi — tıklanınca dikey çizgi açılır/kapanır */}
          {todayInRange && (
            <button
              type="button"
              onClick={() => setShowTodayLine((v) => !v)}
              className={cn(
                "absolute top-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px] font-bold transition-all hover:scale-125",
                showTodayLine
                  ? "bg-yellow text-white border-yellow shadow-soft"
                  : "bg-white text-yellow border-yellow"
              )}
              style={{ left: `${todayLeft}%` }}
              title={`Bugün: ${reportDate} — tıkla, dikey çizgiyi göster/gizle`}
              aria-label="Bugün çizgisini aç/kapat"
            >
              •
            </button>
          )}
        </div>
      </div>

      {/* Satırlar + öncül oku overlay'i — wrapper relative */}
      <div ref={rowsWrapperRef} className="relative">
        {/* SVG ok katmanı — bar alanına aligned (CODE_COL_WIDTH px sağdan başlar) */}
        <div
          ref={barAreaRef}
          className="absolute top-0 bottom-0 right-0 pointer-events-none z-10"
          style={{ left: CODE_COL_WIDTH }}
        >
          {/* GanttArrows: mode off olsa bile focusedCode set ise tek bar'ın okları gözükür */}
          {(arrowMode !== "off" || focusedCode) && barAreaWidth > 0 && (
            <GanttArrows
              visible={visible}
              barAreaWidth={barAreaWidth}
              rowsWrapperRef={rowsWrapperRef}
              pct={pct}
              criticalCodes={criticalCodes}
              mode={arrowMode}
              selectedCodes={selectedArrowCodes}
              focusedCode={focusedCode}
            />
          )}
        </div>
      {/* Satırlar — divide-y kullanılmıyor (specificity sorunu); her satır kendi border-top'ını set eder.
          Her <li>'ye data-row-code attribute eklenir; GanttArrows bunu DOM'dan ölçer. */}
      <ul>
        {visible.map(({ item, range }, idx) => {
          const isCritical = criticalCodes.has(item.code);
          const isMilestone = item.activityType === "milestone";
          // Üst başlık (parent) değişimi → kalın ayırıcı çizgi (örn. 1.2.2.x → 1.2.3.x)
          const parentCode = item.code.split(".").slice(0, -1).join(".");
          const prevItem = idx > 0 ? visible[idx - 1].item : null;
          const prevParentCode = prevItem
            ? prevItem.code.split(".").slice(0, -1).join(".")
            : null;
          const isGroupStart = prevParentCode !== null && parentCode !== prevParentCode;
          const left = pct(range.start);
          const width = Math.max(0.5, pct(range.end) - left);
          const widthPct = Math.max(0.5, width);
          const isOnlyDuration = !range.isFromPlan && !isMilestone;
          const isAlap = item.scheduleType === "alap";
          return (
            <li
              key={item.id}
              data-row-code={item.code}
              className={cn(
                "grid hover:bg-bg3 transition-colors",
                // İlk satır border yok; grup başı → tek kalın çizgi; aksi → tek ince çizgi
                idx === 0
                  ? ""
                  : isGroupStart
                    ? "border-t-2 border-slate-400"
                    : "border-t border-slate-200"
              )}
              style={{ gridTemplateColumns: `${CODE_COL_WIDTH}px 1fr` }}
            >
              {/* SOL: kod (öncül kısayolu) + isim (sihirbaz kısayolu) */}
              <div className="flex items-center gap-2 px-3 py-0 border-r border-border/40 text-[10.5px] min-w-0 leading-tight">
                {arrowMode === "selected" && (
                  <button
                    type="button"
                    onClick={() => toggleSelectedArrowCode(item.code)}
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center w-4 h-4 rounded transition-colors",
                      selectedArrowCodes.has(item.code)
                        ? "text-accent"
                        : "text-text3 hover:text-text"
                    )}
                    title={
                      selectedArrowCodes.has(item.code)
                        ? "Seçimden çıkar"
                        : "Bu kalemin oklarını göster"
                    }
                    aria-label="Ok seçimini değiştir"
                  >
                    {selectedArrowCodes.has(item.code) ? (
                      <CheckSquare size={11} />
                    ) : (
                      <Square size={11} />
                    )}
                  </button>
                )}
                <PredecessorQuickAdd
                  targetCode={item.code}
                  targetId={item.id}
                  targetName={item.name}
                  allWbs={allWbs}
                  existingPredCodes={(item.predecessors ?? []).map((p) => p.wbsCode)}
                  onAdd={(predCodes, type, lagDays, lagUnit) =>
                    onAddPredecessor(item, predCodes, type, lagDays, lagUnit)
                  }
                >
                  {({ triggerRef, toggle, isOpen }) => (
                    <button
                      ref={triggerRef as React.RefObject<HTMLButtonElement>}
                      type="button"
                      onClick={toggle}
                      className={cn(
                        "font-mono text-[9.5px] shrink-0 rounded px-1 transition-colors cursor-pointer",
                        isOpen
                          ? "bg-blue text-white"
                          : "text-text3 hover:text-blue hover:bg-blue/10"
                      )}
                      title="Tıkla → öncül ekle"
                    >
                      {item.code}
                    </button>
                  )}
                </PredecessorQuickAdd>
                <button
                  type="button"
                  onClick={() => onJumpToCode?.(item.code)}
                  className="text-text2 truncate flex-1 min-w-0 text-left hover:text-accent hover:underline cursor-pointer"
                  title="Tıkla → Planlama Sihirbazı"
                >
                  {item.name}
                </button>
                {isMilestone && <span className="text-purple shrink-0">◆</span>}
              </div>
              {/* SAĞ: bar alanı — milestone diamond'ın taşmaması için overflow-visible */}
              <div className="relative h-5 overflow-visible">
                {/* AYIN 15'i çizgileri (soluk dashed) */}
                {midMonthMarkers.map((w) => (
                  <div
                    key={`mid-${w.iso}`}
                    className="absolute top-0 bottom-0 border-l border-dashed border-slate-300 pointer-events-none"
                    style={{ left: `${w.left}%` }}
                  />
                ))}
                {/* AYIN 1./SON gün çizgileri (solid, ay sınırı) — ilk ay (left=0) zaten panel kenarı */}
                {monthMarkers
                  .filter((m) => m.left > 0.5)
                  .map((m) => (
                    <div
                      key={m.iso}
                      className="absolute top-0 bottom-0 border-l border-slate-400/60 pointer-events-none"
                      style={{ left: `${m.left}%` }}
                    />
                  ))}
                {/* Bugün çizgisi — sadece header'daki simge tıklanınca görünür */}
                {showTodayLine && todayInRange && (
                  <div
                    className="absolute top-0 bottom-0 border-l-2 border-yellow pointer-events-none z-10"
                    style={{ left: `${todayLeft}%` }}
                  />
                )}
                {/* BAR — tıklayınca öncüller popover'ı açılır (Git/Sil aksiyonlu) */}
                <PredecessorBadges
                  code={item.code}
                  predecessors={item.predecessors ?? []}
                  successors={[]}
                  wbsByCode={wbsByCode}
                  onEditLink={onEditLink}
                  onJumpToLink={onJumpToLink}
                  onRemovePredecessor={(predCode) => onRemovePredecessor(item, predCode)}
                  customTrigger={({ triggerRef, toggle, isOpen }) =>
                    isMilestone ? (
                      <span
                        ref={triggerRef as React.RefObject<HTMLSpanElement>}
                        data-gantt-bar="true"
                        data-bar-code={item.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedCode(item.code);
                          toggle();
                        }}
                        className={cn(
                          "absolute w-3.5 h-3.5 border-2 border-white shadow-soft transition-transform hover:scale-150 cursor-pointer z-30",
                          isOpen && "ring-2 ring-accent",
                          focusedCode === item.code && "ring-2 ring-sky-400",
                          item.milestoneCompletedAt
                            ? "bg-green"
                            : range.isFromPlan
                              ? "bg-purple"
                              : "bg-slate-400"
                        )}
                        style={{
                          left: `${left}%`,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(45deg)",
                        }}
                        title={
                          range.isFromPlan
                            ? `Tıkla → öncüller${(item.predecessors?.length ?? 0) > 0 ? "" : " (henüz yok)"}`
                            : "Milestone tarihi atanmadı — sihirbazla tarih ekle"
                        }
                        aria-label="Milestone — tıkla → öncüller"
                      />
                    ) : (
                      <span
                        ref={triggerRef as React.RefObject<HTMLSpanElement>}
                        data-gantt-bar="true"
                        data-bar-code={item.code}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedCode(item.code);
                          toggle();
                        }}
                        className={cn(
                          "absolute top-1 bottom-1 rounded transition-all hover:brightness-110 cursor-pointer border",
                          isOpen && "ring-2 ring-accent ring-offset-1",
                          focusedCode === item.code && "ring-2 ring-sky-400 ring-offset-1",
                          isCritical
                            ? "bg-red border-red"
                            : isAlap
                              ? "bg-purple border-purple"
                              : isOnlyDuration
                                ? "bg-purple/40 border-purple/60"
                                : "bg-accent border-accent"
                        )}
                        style={{ left: `${left}%`, width: `${widthPct}%`, minWidth: "3px" }}
                        title={`${isAlap ? "⏮ ALAP · " : ""}Tıkla → öncüller${
                          (item.predecessors?.length ?? 0) > 0
                            ? ` (${item.predecessors!.length})`
                            : " (henüz yok)"
                        }`}
                      >
                        {isCritical && (
                          <span className="absolute top-0 left-0.5 text-[8px] text-white font-bold leading-none">
                            ⚡
                          </span>
                        )}
                        {!isCritical && isAlap && (
                          <span className="absolute top-0 left-0.5 text-[8px] text-white font-bold leading-none">
                            ⏮
                          </span>
                        )}
                      </span>
                    )
                  }
                />
              </div>
            </li>
          );
        })}
      </ul>
      </div>
      </div>

      {/* Lejant */}
      <div className="px-3 py-1.5 border-t border-border bg-bg2/30 flex items-center gap-3 text-[10px] text-text3 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-accent border border-accent rounded" />
          Planlı (miktarlı)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-purple/40 border border-purple/60 rounded" />
          Sadece süre (plan yok)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-purple border border-purple rounded" />
          ⏮ ALAP
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-red border border-red rounded" />
          Critical Path
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-purple rotate-45" /> Milestone
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-slate-400 rotate-45" /> Tarih atanmadı
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-2 h-2 bg-green rotate-45" /> Tamamlandı
        </span>
        <span className="inline-flex items-center gap-1 ml-auto">
          <span className="inline-block w-0.5 h-3 bg-yellow" /> Bugün ({reportDate})
        </span>
      </div>
    </div>
  );
}
