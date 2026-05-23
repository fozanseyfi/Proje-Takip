"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Küçük info ikon — tıklanınca açılır popover'da planlama tablosu ve Mini-Gantt'in
 * kısayollarını anlatır. Aynı bilgiler "Nasıl Kullanılır" dialog'unda da var,
 * bu sadece anlık ipucu için.
 */
export function ShortcutsHint() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const updatePosition = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const rect = trig.getBoundingClientRect();
    const popW = 360;
    const popH = 260;
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

  const popover =
    open && position && mounted ? (
      <div
        ref={popoverRef}
        className="fixed z-[9999] w-[360px] rounded-lg border border-border bg-white shadow-large overflow-hidden"
        style={{ left: position.left, top: position.top, maxWidth: "calc(100vw - 16px)" }}
      >
        <div className="px-3 py-2 border-b border-border bg-yellow/10 flex items-center gap-2 text-[12px]">
          <span className="text-base">💡</span>
          <span className="font-bold text-text">Kısayollar</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto text-text3 hover:text-text2"
            title="Kapat (Esc)"
          >
            <X size={12} />
          </button>
        </div>
        <div className="px-3 py-3 space-y-2.5 text-[12px] text-text2">
          <div className="flex items-start gap-2">
            <span className="font-mono text-[10px] text-blue bg-blue/10 border border-blue/30 px-1.5 py-0.5 rounded shrink-0">
              1.2.1
            </span>
            <span>
              <strong className="text-text">WBS koduna tıkla</strong> → o kalem için{" "}
              <strong>öncül ekleme popover&apos;ı</strong> açılır. Hem planlama tablosunda hem
              Mini-Gantt&apos;ta çalışır.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-accent hover:underline shrink-0 mt-0.5">
              Kalem adı
            </span>
            <span>
              <strong className="text-text">Açıklamaya/kalem adına tıkla</strong> →{" "}
              <strong>Planlama Sihirbazı</strong> açılır (süre, başlangıç, dağılım girişi).
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-[10px] text-blue bg-blue/10 border border-blue/30 px-1.5 py-0.5 rounded shrink-0">
              ← 2
            </span>
            <span>
              <strong className="text-text">Öncül/ardıl rozetleri</strong> → tıkla, bağlantıları
              gör + sil. Bu rozetler sadece görüntüleme; yeni eklemek için WBS koduna tıkla.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[14px] leading-none mt-0.5">◆</span>
            <span>
              <strong className="text-text">Milestone diamond</strong> → tarih atanmamışsa gri,
              atanmışsa mor, tamamlandıysa yeşil. Tarih atamak için kalem adına tıkla.
            </span>
          </div>
        </div>
        <div className="px-3 py-2 border-t border-border bg-bg2/40 text-[11px] text-text3">
          Detaylı için: üstteki <strong>?</strong> butonundan <strong>Nasıl Kullanılır</strong>{" "}
          dialog&apos;u.
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors",
          open
            ? "bg-yellow text-white border-yellow"
            : "bg-yellow/10 text-yellow border-yellow/40 hover:bg-yellow/20"
        )}
        title="Kısayolları göster"
        aria-label="Kısayollar"
      >
        <Info size={11} />
      </button>
      {mounted && popover && createPortal(popover, document.body)}
    </>
  );
}
