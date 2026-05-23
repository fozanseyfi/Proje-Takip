"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  sub?: string;
  /** true ise tıklanamaz görsel ayırıcı satırı (örn. başlık). */
  header?: boolean;
  /** Header satırının görsel seviye derinliği (0=ana, 1=alt) — opsiyonel girinti için. */
  headerLevel?: number;
}

/**
 * Kompakt çoklu seçim filtresi. Trigger pill butonu, açılınca search + checkbox list.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  placeholder = "Tümü",
  className,
  searchable = true,
  maxHeight = 300,
  single = false,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  /** Açılır liste max yüksekliği (piksel). Default 300. */
  maxHeight?: number;
  /** true ise tek-seçim modu: tıklama önceki seçimi siler + popover kapanır. */
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Dışına tıklayınca kapat
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    // Arama sırasında header'ları gizle (sadece eşleşen item'lar görünür)
    return options.filter(
      (o) =>
        !o.header &&
        (o.label.toLowerCase().includes(q) || (o.sub?.toLowerCase().includes(q) ?? false))
    );
  }, [options, search]);

  function toggle(value: string) {
    if (single) {
      onChange([value]);
      setOpen(false);
      return;
    }
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function clear() {
    onChange([]);
  }

  function selectAll() {
    // Header satırlarını seçmeye dahil etme
    onChange(options.filter((o) => !o.header).map((o) => o.value));
  }

  const selectedLabels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const display = selected.length === 0 ? placeholder : selected.length === 1 ? selectedLabels[0] : `${selected.length} seçili`;

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full h-8 px-2.5 inline-flex items-center justify-between gap-2 rounded-md border bg-white text-xs transition-colors",
          selected.length > 0
            ? "border-accent text-text"
            : "border-border2 text-text2 hover:border-text3"
        )}
      >
        <span className="truncate font-semibold">{display}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="size-5 rounded-md hover:bg-bg2 inline-flex items-center justify-center text-text3 hover:text-red"
              aria-label="Temizle"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={12}
            className={cn("text-text3 transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-40 bg-white border border-border rounded-lg shadow-medium overflow-hidden flex flex-col min-w-[200px]"
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {searchable && options.length > 6 && (
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-text3 pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ara..."
                  className="w-full h-7 pl-7 pr-2 text-[12px] rounded-md border border-border2 focus:outline-none focus:border-accent"
                  autoFocus
                />
              </div>
            </div>
          )}

          {!single && (
            <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-bg2/40">
              <button
                type="button"
                onClick={selectAll}
                className="text-[10px] font-bold text-accent hover:underline"
              >
                Tümünü seç
              </button>
              <button
                type="button"
                onClick={clear}
                className="text-[10px] font-bold text-text3 hover:text-red"
              >
                Temizle
              </button>
            </div>
          )}

          <div className="overflow-y-auto flex-1 py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-text3 text-[11px]">Sonuç yok.</div>
            ) : (
              filtered.map((o, idx) => {
                if (o.header) {
                  // Tıklanamaz görsel ayırıcı satır
                  const lvl = o.headerLevel ?? 0;
                  return (
                    <div
                      key={`hdr-${o.value}-${idx}`}
                      className={cn(
                        "sticky top-0 z-10 px-2.5 py-1 border-b border-border",
                        lvl === 0
                          ? "bg-accent/15 text-accent font-extrabold uppercase tracking-wide text-[10.5px]"
                          : "bg-blue/10 text-blue font-bold text-[11px]"
                      )}
                      style={{ paddingLeft: `${10 + lvl * 10}px` }}
                    >
                      {o.label}
                    </div>
                  );
                }
                const isSelected = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 flex items-center gap-2 hover:bg-bg2 transition-colors",
                      isSelected && "bg-accent/5"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex items-center justify-center size-4 rounded border shrink-0",
                        isSelected
                          ? "bg-accent border-accent text-white"
                          : "bg-white border-border2"
                      )}
                    >
                      {isSelected && <Check size={10} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "text-[12px] leading-tight truncate",
                          isSelected ? "font-semibold text-text" : "text-text2"
                        )}
                      >
                        {o.label}
                      </div>
                      {o.sub && (
                        <div className="text-[10px] text-text3 truncate leading-tight">{o.sub}</div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
