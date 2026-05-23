"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X, Pencil, Trash2, ChevronLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PredecessorLink, PredecessorType, WbsItem } from "@/lib/store/types";

type LagUnit = "calendar" | "work" | "no-sunday";

/**
 * Bir kalemin yanında küçük öncül/ardıl rozetleri.
 * Tıklayınca popover ile detay listesi açılır.
 * Popover document.body'ye portal ile basılır — matrix scroll container'ın
 * overflow clipping'inden etkilenmez.
 */
export interface PredecessorBadgesProps {
  code: string;
  predecessors: PredecessorLink[];
  successors: Array<{ successorCode: string; link: PredecessorLink }>;
  wbsByCode: Map<string, WbsItem>;
  /**
   * Link inline düzenleme — popover içinde "Düzenle" tıklanınca formla aç.
   */
  onEditLink?: (
    targetCode: string,
    predCode: string,
    patch: { type: PredecessorType; lagDays: number; lagUnit: LagUnit }
  ) => void;
  /**
   * Opsiyonel: Öncüllükler panelinde detay görünümüne git (scroll + highlight).
   * Sağlanırsa edit popover'ında "Panelde aç" linki gösterilir.
   */
  onJumpToLink?: (targetCode: string, predCode: string) => void;
  onRemovePredecessor?: (linkPredCode: string) => void;
  onRemoveSuccessor?: (successorCode: string, linkPredCode: string) => void;
  /**
   * Opsiyonel render-prop: varsayılan ← N / N → rozetlerini özel bir element ile
   * değiştirir. Sağlandığında popover sadece "pred" görünümünü açar.
   * Mini-Gantt bar tıklaması gibi kullanımlar için.
   */
  customTrigger?: (api: {
    triggerRef: React.RefObject<HTMLElement | null>;
    isOpen: boolean;
    toggle: () => void;
  }) => React.ReactNode;
}

export function PredecessorBadges({
  code,
  predecessors,
  successors,
  wbsByCode,
  onEditLink,
  onJumpToLink,
  onRemovePredecessor,
  onRemoveSuccessor,
  customTrigger,
}: PredecessorBadgesProps) {
  const [open, setOpen] = useState<"pred" | "succ" | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  // Inline edit modu — bir link "Düzenle" tıklanınca aktive olur
  // editing = { targetCode, predCode, link } — form bu link'in mevcut değerlerini gösterir
  const [editing, setEditing] = useState<{
    targetCode: string;
    predCode: string;
    link: PredecessorLink;
  } | null>(null);
  // Form değerleri
  const [editType, setEditType] = useState<PredecessorType>("FS");
  const [editLagText, setEditLagText] = useState("0");
  // Trigger ref: customTrigger varsa generic Element, yoksa span
  const triggerRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Portal hedefi sadece client'ta var
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Pop position'u trigger'a göre yerleştir (popover açılınca + scroll/resize'de)
  const updatePosition = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    const popW = 320; // tahmini popover genişliği
    const popH = 280; // tahmini popover yüksekliği (max-h-72 + header)
    let left = rect.left;
    let top = rect.bottom + 4;
    // Sağdan taşıyorsa sola yasla
    if (left + popW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popW - 8);
    }
    // Alttan taşıyorsa yukarı aç
    if (top + popH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popH - 4);
    }
    setPosition({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null); // eslint-disable-line react-hooks/set-state-in-effect
      setEditing(null); // popover kapanınca edit modunu sıfırla
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  // Scroll veya resize varsa pozisyonu güncelle
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

  // Dışa tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Escape ile kapat
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const predCount = predecessors.length;
  const succCount = successors.length;
  // customTrigger varsa daima render (bar görünmeli — öncül olmasa bile)
  if (!customTrigger && predCount === 0 && succCount === 0) return null;

  // Edit modunu başlat — listede "Düzenle" tıklanınca çağrılır
  function startEdit(targetCode: string, predCode: string, link: PredecessorLink) {
    setEditing({ targetCode, predCode, link });
    setEditType(link.type);
    setEditLagText(String(link.lagDays));
  }

  function saveEdit() {
    if (!editing || !onEditLink) return;
    const lag = (() => {
      if (editLagText === "" || editLagText === "-") return 0;
      const n = parseInt(editLagText, 10);
      return isNaN(n) ? 0 : n;
    })();
    onEditLink(editing.targetCode, editing.predCode, {
      type: editType,
      lagDays: lag,
      lagUnit: "calendar",
    });
    setEditing(null);
  }

  const popover =
    open && position && mounted ? (
      <div
        ref={popoverRef}
        data-predecessor-popover="true"
        className="fixed z-[9999] min-w-[300px] max-w-[420px] rounded-lg border border-border bg-white shadow-large overflow-hidden"
        style={{ left: position.left, top: position.top }}
        onClick={(e) => e.stopPropagation()}
      >
        {editing ? (
          // EDIT MODE HEADER
          <div className="px-3 py-1.5 border-b border-border bg-accent/10 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-accent hover:text-accent2 inline-flex items-center gap-1"
              title="Listeye dön"
            >
              <ChevronLeft size={12} /> Geri
            </button>
            <Pencil size={11} className="text-accent" />
            <span className="text-accent">Linki Düzenle</span>
            <span className="text-text3 normal-case font-mono ml-auto">
              {editing.predCode} → {editing.targetCode}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setOpen(null);
              }}
              className="text-text3 hover:text-text2"
              title="Kapat"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          // LIST MODE HEADER
          <div className="px-3 py-1.5 border-b border-border bg-bg2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider">
            {open === "pred" ? (
              <>
                <ArrowLeft size={11} className="text-blue" />
                <span className="text-blue">Öncüller</span>
                <span className="text-text3 normal-case font-mono">
                  {code} bağlı olduğu kalemler
                </span>
              </>
            ) : (
              <>
                <ArrowRight size={11} className="text-green" />
                <span className="text-green">Ardıllar</span>
                <span className="text-text3 normal-case font-mono">
                  {code}&apos;e bağlı kalemler
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="ml-auto text-text3 hover:text-text2"
            >
              <X size={12} />
            </button>
          </div>
        )}
        {editing ? (
          // EDIT FORM
          <div className="p-3 space-y-3 text-[12px]">
            <div className="flex items-center gap-2 text-[11.5px] text-text2">
              <span className="font-bold w-12 shrink-0">Tip:</span>
              <div className="inline-flex p-0.5 bg-bg3 rounded border border-border gap-0">
                {(["FS", "SS", "FF"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditType(t)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-bold transition-all",
                      editType === t
                        ? "bg-white text-accent shadow-soft"
                        : "text-text2 hover:text-text"
                    )}
                    title={
                      t === "FS"
                        ? "Finish→Start"
                        : t === "SS"
                          ? "Start→Start"
                          : "Finish→Finish"
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-text2">
              <span className="font-bold w-12 shrink-0">Lag:</span>
              <input
                type="text"
                inputMode="numeric"
                value={editLagText}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || v === "-" || /^-?\d+$/.test(v)) {
                    setEditLagText(v);
                  }
                }}
                onBlur={() => {
                  if (editLagText === "" || editLagText === "-") setEditLagText("0");
                }}
                className="w-16 h-7 px-2 text-[11px] text-right font-mono rounded border border-border bg-white focus:border-accent focus:outline-none"
              />
              <span className="text-text3 text-[10px]">gün · hedef kalemin iş haftasına snap&apos;lenir</span>
            </div>
            {/* Aksiyonlar */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => {
                  // Silme: yön'e göre callback seç
                  if (open === "pred" && onRemovePredecessor) {
                    onRemovePredecessor(editing.predCode);
                  } else if (open === "succ" && onRemoveSuccessor) {
                    onRemoveSuccessor(editing.targetCode, editing.predCode);
                  }
                  setEditing(null);
                  setOpen(null);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-bold text-red border border-red/30 hover:bg-red/5"
              >
                <Trash2 size={11} /> Sil
              </button>
              {onJumpToLink && (
                <button
                  type="button"
                  onClick={() => {
                    onJumpToLink!(editing.targetCode, editing.predCode);
                    setEditing(null);
                    setOpen(null);
                  }}
                  className="inline-flex items-center gap-1 text-[10.5px] text-text3 hover:text-accent"
                  title="Öncüllükler panelinde aç"
                >
                  <ExternalLink size={10} /> Panelde aç
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="ml-auto px-2 py-1 text-[10.5px] text-text2 hover:text-text"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!onEditLink}
                className={cn(
                  "px-3 py-1 rounded text-[10.5px] font-bold",
                  onEditLink
                    ? "bg-accent text-white hover:bg-accent2"
                    : "bg-bg3 text-text3 cursor-not-allowed"
                )}
              >
                Kaydet
              </button>
            </div>
          </div>
        ) : (
        <ul className="max-h-72 overflow-y-auto">
          {open === "pred"
            ? predecessors.map((link, i) => {
                const w = wbsByCode.get(link.wbsCode);
                return (
                  <li
                    key={`${link.wbsCode}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-bg2/40 text-[11.5px]"
                  >
                    <span className="font-mono text-[10px] text-blue font-bold w-14 shrink-0">
                      {link.wbsCode}
                    </span>
                    <span className="flex-1 truncate text-text">{w?.name ?? "?"}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text2 shrink-0">
                      {link.type}
                      {link.lagDays !== 0 && (
                        <span className="ml-1 font-mono">
                          {link.lagDays > 0 ? "+" : ""}
                          {link.lagDays}
                          {link.lagUnit === "work" ? "ig" : link.lagUnit === "no-sunday" ? "g6" : "g"}
                        </span>
                      )}
                    </span>
                    {onEditLink && (
                      <button
                        type="button"
                        onClick={() => startEdit(code, link.wbsCode, link)}
                        className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:underline font-semibold shrink-0"
                        title="Bu öncül linkini düzenle"
                      >
                        <Pencil size={10} /> Düzenle
                      </button>
                    )}
                    {onRemovePredecessor && (
                      <button
                        type="button"
                        onClick={() => onRemovePredecessor(link.wbsCode)}
                        className="text-[10px] text-red hover:underline font-semibold shrink-0"
                        title="Bu öncülü kaldır"
                      >
                        Sil
                      </button>
                    )}
                  </li>
                );
              })
            : successors.map((s, i) => {
                const w = wbsByCode.get(s.successorCode);
                return (
                  <li
                    key={`${s.successorCode}-${i}`}
                    className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 hover:bg-bg2/40 text-[11.5px]"
                  >
                    <span className="font-mono text-[10px] text-green font-bold w-14 shrink-0">
                      {s.successorCode}
                    </span>
                    <span className="flex-1 truncate text-text">{w?.name ?? "?"}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text2 shrink-0">
                      {s.link.type}
                      {s.link.lagDays !== 0 && (
                        <span className="ml-1 font-mono">
                          {s.link.lagDays > 0 ? "+" : ""}
                          {s.link.lagDays}
                          {s.link.lagUnit === "work" ? "ig" : s.link.lagUnit === "no-sunday" ? "g6" : "g"}
                        </span>
                      )}
                    </span>
                    {onEditLink && (
                      <button
                        type="button"
                        onClick={() => startEdit(s.successorCode, code, s.link)}
                        className="inline-flex items-center gap-0.5 text-[10px] text-accent hover:underline font-semibold shrink-0"
                        title="Bu öncül linkini düzenle"
                      >
                        <Pencil size={10} /> Düzenle
                      </button>
                    )}
                    {onRemoveSuccessor && (
                      <button
                        type="button"
                        onClick={() => onRemoveSuccessor(s.successorCode, code)}
                        className="text-[10px] text-red hover:underline font-semibold shrink-0"
                        title="Bu ardıldan bu kalemin öncülünü kaldır"
                      >
                        Sil
                      </button>
                    )}
                  </li>
                );
              })}
        </ul>
        )}
      </div>
    ) : null;

  // CustomTrigger sağlanmışsa rozet'i değil onu render et + popover sadece "pred" açar
  if (customTrigger) {
    if (predCount === 0) {
      // Öncül yoksa trigger'ı render et ama popover açma
      return <>{customTrigger({
        triggerRef: triggerRef as React.RefObject<HTMLElement | null>,
        isOpen: false,
        toggle: () => {},
      })}</>;
    }
    return (
      <>
        {customTrigger({
          triggerRef: triggerRef as React.RefObject<HTMLElement | null>,
          isOpen: open === "pred",
          toggle: () => setOpen(open === "pred" ? null : "pred"),
        })}
        {mounted && popover && createPortal(popover, document.body)}
      </>
    );
  }

  return (
    <>
      <span
        className="relative inline-flex items-center gap-0.5"
        ref={triggerRef as React.RefObject<HTMLSpanElement>}
      >
        {predCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === "pred" ? null : "pred");
            }}
            className={cn(
              "inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold leading-tight transition-colors border",
              open === "pred"
                ? "bg-blue text-white border-blue"
                : "bg-blue/10 text-blue border-blue/30 hover:bg-blue/15"
            )}
            title={`${predCount} öncül — tıkla detay`}
          >
            <ArrowLeft size={9} /> {predCount}
          </button>
        )}
        {succCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(open === "succ" ? null : "succ");
            }}
            className={cn(
              "inline-flex items-center gap-0.5 px-1 py-0 rounded text-[9px] font-bold leading-tight transition-colors border",
              open === "succ"
                ? "bg-green text-white border-green"
                : "bg-green/10 text-green border-green/30 hover:bg-green/15"
            )}
            title={`${succCount} ardıl — tıkla detay`}
          >
            {succCount} <ArrowRight size={9} />
          </button>
        )}
      </span>
      {mounted && popover && createPortal(popover, document.body)}
    </>
  );
}
