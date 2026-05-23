"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, CheckSquare, Square, Ban, Search } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WbsItem } from "@/lib/store/types";
import {
  computeDistribution,
  workingDates,
  endDateFromDuration,
  type DistributionShape,
} from "@/lib/calc/distribution";

/**
 * Toplu plan dağıtımı — birden fazla iş kalemine aynı dağılım şablonunu uygular.
 *
 * Her kalem için:
 *  - Başlangıç: schedules.earliestStart (öncül-aware), yoksa projectStart
 *  - Süre: item.estimatedDurationDays (yoksa miktar bazlı fallback)
 *  - İş haftası: item.workweek (yoksa Pzt-Cmt default)
 *  - Şablon: dialog'da seçilen tek şablon (uniform/s-curve/front/back)
 *
 * Milestone'lar ve miktarı 0 olan kalemler listede disabled.
 * Detaylı tek-kalem dağıtım için Planlama Sihirbazı kullanılır.
 */
export interface BulkDistributeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Tüm WBS (başlıklar + leaf'ler) — hiyerarşik gösterim için. */
  wbs: WbsItem[];
  /** Code → schedule lookup. earliestStart predecessor-constrained. */
  schedules: Map<string, { earliestStart: string; earliestEnd?: string }>;
  /** Proje başlangıç tarihi (fallback). */
  projectStart: string;
  /** Sonucu uygula — her code için byDate dict. */
  onApply: (results: Array<{ code: string; byDate: Record<string, number> }>) => void;
}

type Workweek = "mon-fri" | "mon-sat" | "mon-sun";

function workweekFlags(ww?: Workweek): { workSat: boolean; workSun: boolean } {
  if (ww === "mon-fri") return { workSat: false, workSun: false };
  if (ww === "mon-sun") return { workSat: true, workSun: true };
  return { workSat: true, workSun: false };
}

const SHAPE_OPTIONS: { value: DistributionShape; label: string; icon: string; desc: string }[] = [
  { value: "uniform", label: "Düzgün", icon: "▬", desc: "Her güne eşit miktar" },
  { value: "s-curve", label: "S-eğrisi", icon: "∿", desc: "Ortada yoğun, kenarlar yumuşak" },
  { value: "front-loaded", label: "Önden", icon: "◤", desc: "Başta yoğun, sonda azalan" },
  { value: "back-loaded", label: "Sondan", icon: "◢", desc: "Başta az, sonda yoğun" },
];

export function BulkDistributeDialog({
  open,
  onClose,
  wbs,
  schedules,
  projectStart,
  onApply,
}: BulkDistributeDialogProps) {
  const orderedWbs = useMemo(() => {
    return wbs
      .filter((w) => !w.deletedAt && w.level >= 1)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [wbs]);

  // Uygun adaylar: work leaf + quantity > 0
  const eligibleCodes = useMemo(() => {
    const out = new Set<string>();
    for (const w of orderedWbs) {
      if (!w.isLeaf) continue;
      if (w.activityType === "milestone") continue;
      if (w.quantity <= 0) continue;
      out.add(w.code);
    }
    return out;
  }, [orderedWbs]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [shape, setShape] = useState<DistributionShape>("uniform");
  const [search, setSearch] = useState("");

  // Dialog açıldığında: tüm eligible'ları seçili olarak başla
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set(eligibleCodes));
      setShape("uniform");
      setSearch("");
    }
  }, [open, eligibleCodes]);

  function toggleCode(code: string) {
    if (!eligibleCodes.has(code)) return;
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  // Filtreli liste: arama eşleşince ataları da göster
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

  function handleApply() {
    const results: Array<{ code: string; byDate: Record<string, number> }> = [];
    let skipped = 0;
    for (const code of selected) {
      const item = orderedWbs.find((w) => w.code === code);
      if (!item || item.quantity <= 0) {
        skipped++;
        continue;
      }
      const dur =
        item.estimatedDurationDays && item.estimatedDurationDays > 0
          ? item.estimatedDurationDays
          : Math.max(1, item.quantity > 0 ? Math.min(30, item.quantity) : 10);
      const flags = workweekFlags(item.workweek);
      const sch = schedules.get(code);
      const start = sch?.earliestStart ?? projectStart;
      const end = endDateFromDuration(start, dur, flags.workSat, flags.workSun);
      const dates = workingDates(start, end, flags.workSat, flags.workSun);
      if (dates.length === 0) {
        skipped++;
        continue;
      }
      const portions = computeDistribution(item.quantity, dates.length, shape, 0);
      const byDate: Record<string, number> = {};
      for (let i = 0; i < dates.length; i++) {
        if (portions[i] > 0) byDate[dates[i]] = portions[i];
      }
      results.push({ code, byDate });
    }
    onApply(results);
    onClose();
    void skipped;
  }

  const eligibleSelectedCount = selected.size;

  return (
    <Dialog open={open} onClose={onClose} title="Toplu Plan Dağıtımı" size="xl">
      <div className="space-y-3">
        <div className="px-3 py-2 rounded-lg bg-accent/8 border border-accent/25 text-[12px] text-text2 flex items-start gap-2">
          <Layers size={14} className="text-accent shrink-0 mt-0.5" />
          <span>
            Seçtiğin tüm kalemlere <strong>aynı dağılım şablonunu</strong> uygula. Her kalemin
            kendi süresi, iş haftası ve öncül kısıtı kullanılır. Detaylı tek-kalem dağıtım için{" "}
            <strong>Planlama Sihirbazı</strong>.
          </span>
        </div>

        {/* ① Şablon */}
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-text2 mb-1.5">
            Dağılım Şablonu
          </div>
          <div className="inline-flex p-1 bg-bg3 rounded-lg border border-border gap-0.5 flex-wrap">
            {SHAPE_OPTIONS.map((opt) => {
              const active = shape === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setShape(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                    active
                      ? "bg-white text-accent shadow-soft border border-accent/30"
                      : "text-text2 hover:text-text hover:bg-white/60"
                  )}
                  title={opt.desc}
                >
                  <span className="mr-1">{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ② Kalem seçimi */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text2">
              Kalemler{" "}
              <span className="text-text3 normal-case font-normal">
                ({eligibleSelectedCount} / {eligibleCodes.size} seçili)
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSelected(new Set(eligibleCodes))}
                className="text-accent hover:underline font-semibold"
              >
                Hepsini seç
              </button>
              <span className="text-text3">·</span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-text2 hover:underline"
              >
                Hiçbiri
              </button>
            </div>
          </div>
          <div className="relative">
            <Search
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-text3 pointer-events-none"
            />
            <Input
              type="text"
              placeholder="Kod veya isim ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!pl-7"
            />
          </div>
          <div className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border bg-white">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-text3 text-[12px]">Eşleşen kalem yok.</div>
            ) : (
              filtered.map((w) => {
                const indentPx = Math.max(0, w.level - 1) * 14;
                // BAŞLIK
                if (!w.isLeaf) {
                  const levelClass =
                    w.level === 1
                      ? "bg-accent/[0.06] text-accent font-extrabold uppercase tracking-wide"
                      : "bg-blue/[0.04] text-blue font-bold";
                  return (
                    <div
                      key={w.id}
                      className={cn(
                        "px-3 py-1 text-[11px] flex items-center gap-2 border-b border-border/40",
                        levelClass
                      )}
                    >
                      <span className="font-mono text-[10px] w-14 shrink-0">{w.code}</span>
                      <span style={{ paddingLeft: `${indentPx}px` }}>{w.name}</span>
                    </div>
                  );
                }
                // LEAF
                const eligible = eligibleCodes.has(w.code);
                const isSel = selected.has(w.code);
                const reason =
                  w.activityType === "milestone"
                    ? "Milestone (miktar yok)"
                    : w.quantity <= 0
                      ? "Miktar yok"
                      : "";
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleCode(w.code)}
                    disabled={!eligible}
                    className={cn(
                      "w-full text-left flex items-center gap-2 px-3 py-1.5 border-b border-border/40 text-[11.5px]",
                      !eligible
                        ? "opacity-50 cursor-not-allowed bg-bg2/30"
                        : isSel
                          ? "bg-accent/[0.05] cursor-pointer hover:bg-accent/10"
                          : "hover:bg-bg2/40 cursor-pointer"
                    )}
                    title={!eligible ? reason : undefined}
                  >
                    {!eligible ? (
                      <Ban size={12} className="text-text3 shrink-0" />
                    ) : isSel ? (
                      <CheckSquare size={12} className="text-accent shrink-0" />
                    ) : (
                      <Square size={12} className="text-text3 shrink-0" />
                    )}
                    <span className="font-mono text-[10px] text-text3 w-14 shrink-0">{w.code}</span>
                    <span
                      className="flex-1 truncate text-text"
                      style={{ paddingLeft: `${indentPx}px` }}
                    >
                      {w.name}
                    </span>
                    {w.activityType === "milestone" ? (
                      <span className="text-[9px] font-bold text-purple shrink-0">◆</span>
                    ) : (
                      <span className="font-mono text-[10px] text-text3 shrink-0">
                        {w.quantity > 0 ? `${w.quantity} ${w.unit || ""}` : "—"}
                      </span>
                    )}
                    {eligible && (
                      <span className="font-mono text-[9px] text-text3 shrink-0">
                        {w.estimatedDurationDays && w.estimatedDurationDays > 0
                          ? `${w.estimatedDurationDays}g`
                          : "?g"}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <p className="mt-1.5 text-[10.5px] text-text3">
            Tahmini süresi atanmamış kalemler için fallback (max 30 gün, miktara göre) kullanılır.
            Daha doğru sonuç için önce <strong>① Süreleri Tanımla</strong> ile süreleri gir.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="accent"
          onClick={handleApply}
          disabled={eligibleSelectedCount === 0}
        >
          <Layers size={14} /> {eligibleSelectedCount} Kaleme Uygula
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
