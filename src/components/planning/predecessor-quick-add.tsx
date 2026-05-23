"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Search, CheckSquare, Square, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WbsItem, PredecessorType } from "@/lib/store/types";
import { canAddPredecessor } from "@/lib/calc/predecessors";

/**
 * Render-prop API'si — trigger element'i dışarıdan verilir.
 * triggerRef → popover konumlandırma için consumer'ın trigger element'ine bağlanır.
 */
export interface QuickAddTriggerProps {
  triggerRef: React.RefObject<HTMLElement | null>;
  isOpen: boolean;
  toggle: () => void;
}

/**
 * Inline öncül ekleme — bir leaf satırının yanında "+" butonu olarak gösterilir.
 * Tıklayınca popover açılır: A (öncül) seç + Type/Lag + Ekle.
 *
 * B (target) zaten bu komponenti çağıran satır. Mevcut öncüller işaretli (☑) görünür
 * ve disabled. Self-link ve cycle yaratan adaylar disabled + ⊘ ikonu ile gri.
 *
 * Popover document.body'ye portal ile basılır — overflow clipping'inden etkilenmez.
 */

type LagUnit = "calendar" | "work" | "no-sunday";

export interface PredecessorQuickAddProps {
  targetCode: string;
  targetId: string;
  targetName: string;
  /** Filtre + cycle check için tüm WBS (silinmemiş). */
  allWbs: WbsItem[];
  /** Bu kalemin mevcut öncüllerinin code listesi. */
  existingPredCodes: string[];
  onAdd: (
    predCodes: string[],
    type: PredecessorType,
    lagDays: number,
    lagUnit: LagUnit
  ) => void;
  /** Render-prop: dışarıdan trigger element'i sağlanır. */
  children: (api: QuickAddTriggerProps) => React.ReactNode;
}

export function PredecessorQuickAdd({
  targetCode,
  targetId,
  targetName,
  allWbs,
  existingPredCodes,
  onAdd,
  children,
}: PredecessorQuickAddProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [type, setType] = useState<PredecessorType>("FS");
  const [lagText, setLagText] = useState("0");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Açılışta state'i sıfırla, search input'una focus ver
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set());
      setSearch("");
      setType("FS");
      setLagText("0");
      // 0ms timeout — popover render olduktan sonra focus
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  // Popover konum hesabı
  const updatePosition = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    const popW = 380;
    const popH = 460;
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + popW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popW - 8);
    }
    if (top + popH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popH - 4);
    }
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handle() {
      updatePosition();
    }
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle);
    };
  }, [open, updatePosition]);

  // Click-outside + Escape
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Listede gösterilecek WBS sıralı (başlıklar + leaf'ler) — sadece popover açıkken hesapla
  const orderedWbs = useMemo(() => {
    if (!open) return [];
    return allWbs
      .filter((w) => !w.deletedAt && w.level >= 1)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [open, allWbs]);

  // Her aday için durumu hesapla (cycle, self, mevcut)
  // PERF: Popover kapalıyken hiç hesaplama yapma — 100+ instance × 100+ cycle check
  // büyük projelerde ciddi yavaşlamaya yol açar.
  const candidateStatus = useMemo(() => {
    const out = new Map<
      string,
      { canBe: boolean; reason: "self" | "cycle" | "existing" | "ok"; existing: boolean }
    >();
    if (!open) return out; // popover kapalı — hesaplama yok
    for (const w of orderedWbs) {
      if (!w.isLeaf) continue;
      const existing = existingPredCodes.includes(w.code);
      if (w.code === targetCode) {
        out.set(w.code, { canBe: false, reason: "self", existing: false });
        continue;
      }
      if (existing) {
        out.set(w.code, { canBe: false, reason: "existing", existing: true });
        continue;
      }
      const check = canAddPredecessor(allWbs, targetCode, w.code);
      if (!check.ok) {
        out.set(w.code, { canBe: false, reason: "cycle", existing: false });
        continue;
      }
      out.set(w.code, { canBe: true, reason: "ok", existing: false });
    }
    return out;
  }, [open, orderedWbs, targetCode, existingPredCodes, allWbs]);

  // Filtreli liste: leaf eşleşirse ataları otomatik dahil
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedWbs;
    const matchedCodes = new Set<string>();
    for (const w of orderedWbs) {
      if (w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)) {
        matchedCodes.add(w.code);
        const parts = w.code.split(".");
        for (let i = 1; i < parts.length; i++) {
          matchedCodes.add(parts.slice(0, i).join("."));
        }
      }
    }
    return orderedWbs.filter((w) => matchedCodes.has(w.code));
  }, [orderedWbs, search]);

  function toggleCode(code: string) {
    const st = candidateStatus.get(code);
    if (!st?.canBe) return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  const lag = (() => {
    if (lagText === "" || lagText === "-") return 0;
    const n = parseInt(lagText, 10);
    return isNaN(n) ? 0 : n;
  })();

  const canApply = selected.size > 0;

  function handleAdd() {
    if (!canApply) return;
    onAdd(Array.from(selected), type, lag, "calendar");
    setOpen(false);
  }

  // Enter ile ekle (search input'tan)
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && canApply) {
      e.preventDefault();
      handleAdd();
    }
  }

  const popover =
    open && position && mounted ? (
      <div
        ref={popoverRef}
        data-predecessor-quickadd="true"
        className="fixed z-[9999] w-[380px] rounded-lg border border-border bg-white shadow-large overflow-hidden flex flex-col"
        style={{
          left: position.left,
          top: position.top,
          maxWidth: "calc(100vw - 16px)",
          maxHeight: "calc(100vh - 16px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border bg-bg2 flex items-center gap-2 text-[11px]">
          <Plus size={12} className="text-blue" />
          <span className="font-bold text-blue">Öncül Ekle</span>
          <span className="text-text3 font-mono">→ {targetCode}</span>
          <span className="text-text2 truncate flex-1 min-w-0">{targetName}</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-text3 hover:text-text2 shrink-0"
            title="Kapat (Esc)"
          >
            <X size={12} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text3 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Kod veya isim ile ara..."
              className="w-full h-7 pl-7 pr-2 text-[11.5px] rounded-md border border-border bg-white focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto min-h-[180px] max-h-[260px]">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-text3 text-[11.5px]">
              Eşleşen kalem yok.
            </div>
          ) : (
            <ul className="divide-y divide-border/30">
              {filtered.map((w) => {
                const indentPx = Math.max(0, w.level - 1) * 12;
                if (!w.isLeaf) {
                  // Başlık satırı
                  const levelClass =
                    w.level === 1
                      ? "bg-accent/[0.06] text-accent font-extrabold uppercase tracking-wide"
                      : "bg-blue/[0.04] text-blue font-bold";
                  return (
                    <li
                      key={w.id}
                      className={cn("px-3 py-1 text-[10.5px] flex items-center gap-2", levelClass)}
                    >
                      <span className="font-mono text-[9.5px] w-12 shrink-0">{w.code}</span>
                      <span className="truncate" style={{ paddingLeft: `${indentPx}px` }}>
                        {w.name}
                      </span>
                    </li>
                  );
                }
                const st = candidateStatus.get(w.code);
                const isSel = selected.has(w.code);
                const disabled = !st?.canBe;
                const reasonTooltip =
                  st?.reason === "self"
                    ? "Bu kalem kendisi"
                    : st?.reason === "existing"
                      ? "Zaten öncül"
                      : st?.reason === "cycle"
                        ? "Döngü oluşur (cycle)"
                        : "";
                return (
                  <li
                    key={w.id}
                    onClick={() => !disabled && toggleCode(w.code)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1 text-[11.5px]",
                      disabled
                        ? "opacity-50 cursor-not-allowed bg-bg2/30"
                        : "cursor-pointer hover:bg-blue/[0.05]",
                      isSel && "bg-blue/[0.08]"
                    )}
                    title={disabled ? reasonTooltip : undefined}
                  >
                    {disabled ? (
                      <Ban size={12} className="text-text3 shrink-0" />
                    ) : isSel ? (
                      <CheckSquare size={12} className="text-blue shrink-0" />
                    ) : (
                      <Square size={12} className="text-text3 shrink-0" />
                    )}
                    <span className="font-mono text-[10px] text-text3 w-12 shrink-0">
                      {w.code}
                    </span>
                    <span
                      className="text-text truncate flex-1 min-w-0"
                      style={{ paddingLeft: `${indentPx}px` }}
                    >
                      {w.name}
                    </span>
                    {st?.existing && (
                      <span className="text-[9px] uppercase tracking-wider text-text3 font-bold shrink-0">
                        Mevcut
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Tip / Lag / Birim — daima görünür */}
        <div className="px-3 py-2 border-t border-border bg-bg2/40 space-y-2">
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="font-bold text-text2 w-8 shrink-0">Tip:</span>
            <div className="inline-flex p-0.5 bg-bg3 rounded border border-border gap-0">
              {(["FS", "SS", "FF"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold transition-all",
                    type === t
                      ? "bg-white text-accent shadow-soft"
                      : "text-text2 hover:text-text"
                  )}
                  title={
                    t === "FS"
                      ? "Finish→Start (A bitince B başlar)"
                      : t === "SS"
                        ? "Start→Start (A başlayınca B başlar)"
                        : "Finish→Finish (A bitince B biter)"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10.5px]">
            <span className="font-bold text-text2 w-8 shrink-0">Lag:</span>
            <input
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
              className="w-14 h-6 px-1.5 text-[10.5px] text-right font-mono rounded border border-border bg-white focus:border-accent focus:outline-none"
            />
            <span className="text-text3 text-[10px]">gün · hedef kalemin iş haftasına snap&apos;lenir</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[11px] text-text2 hover:text-text px-2 py-1"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canApply}
            className={cn(
              "ml-auto inline-flex items-center gap-1 h-7 px-3 rounded-md text-[11px] font-bold transition-colors",
              canApply
                ? "bg-accent text-white hover:bg-accent2"
                : "bg-bg3 text-text3 cursor-not-allowed"
            )}
          >
            Ekle ({selected.size})
          </button>
        </div>
      </div>
    ) : null;

  // targetId — TS no-unused-vars için (consumer'a callback'te lazım olabiliyor)
  void targetId;

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <>
      {children({ triggerRef, isOpen: open, toggle })}
      {mounted && popover && createPortal(popover, document.body)}
    </>
  );
}
