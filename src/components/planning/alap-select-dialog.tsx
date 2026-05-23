"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, CheckSquare, Square, Ban, Search, Zap } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WbsItem } from "@/lib/store/types";
import type { LeafSchedule } from "@/lib/calc/predecessors";

/**
 * ALAP (As Late As Possible) Belirleme — birden fazla iş kalemini ALAP yapar.
 *
 * Seçili kalemler için scheduleType="alap" set edilir, seçilmeyenler "asap".
 * Tedarik, devreye alma, esnek kalemler için tipik kullanım.
 *
 * Kritik yol kalemleri (float=0) disabled — ALAP'a almak projeyi geciktirir.
 * Her aday'ın yanında: float (gün), kritik ⚡ ikonu, mevcut scheduleType işareti.
 */
export interface AlapSelectDialogProps {
  open: boolean;
  onClose: () => void;
  wbs: WbsItem[];
  /** Code → schedule (latestStart/End + totalFloat için). */
  schedules: Map<string, LeafSchedule>;
  /** Mevcut ALAP kalemlerin code'ları (init için). */
  initialAlapCodes: Set<string>;
  /** Apply → seçili kodları döner. Çağıran setWbsScheduleTypes ve shift'i yapar. */
  onApply: (alapCodes: Set<string>) => void;
}

export function AlapSelectDialog({
  open,
  onClose,
  wbs,
  schedules,
  initialAlapCodes,
  onApply,
}: AlapSelectDialogProps) {
  const orderedWbs = useMemo(() => {
    return wbs
      .filter((w) => !w.deletedAt && w.level >= 1)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [wbs]);

  // Uygun adaylar: work leaf + non-critical (float > 0)
  const { eligibleCodes, criticalCodes } = useMemo(() => {
    const eligible = new Set<string>();
    const critical = new Set<string>();
    for (const w of orderedWbs) {
      if (!w.isLeaf) continue;
      if (w.activityType === "milestone") continue;
      const sch = schedules.get(w.code);
      if (sch?.isCritical) {
        critical.add(w.code);
        continue;
      }
      // Float > 0 olanlar veya float bilgisi yoksa da ekleyelim (kritik olmadığı sürece)
      eligible.add(w.code);
    }
    return { eligibleCodes: eligible, criticalCodes: critical };
  }, [orderedWbs, schedules]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(new Set(initialAlapCodes));
      setSearch("");
    }
  }, [open, initialAlapCodes]);

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
    onApply(selected);
    onClose();
  }

  const selectedCount = selected.size;

  return (
    <Dialog open={open} onClose={onClose} title="ALAP — Olabildiğince Geç Belirle" size="xl">
      <div className="space-y-3">
        <div className="px-3 py-2 rounded-lg bg-purple/10 border border-purple/30 text-[12px] text-text2 flex items-start gap-2">
          <Clock size={14} className="text-purple shrink-0 mt-0.5" />
          <span>
            Seçilen kalemler <strong>en geç</strong> bitebileceği güne yaslanır —
            successor&apos;larını geciktirmeden. Tipik adaylar: <strong>tedarik / malzeme alımı</strong>,
            <strong> devreye alma / test</strong>, kritik yolda olmayan esnek kalemler.
            Kritik yol kalemleri (⚡) disabled — ALAP&apos;a alınamaz.
          </span>
        </div>

        {/* Kalem seçimi */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text2">
              Kalemler{" "}
              <span className="text-text3 normal-case font-normal">
                ({selectedCount} ALAP seçili · {eligibleCodes.size} aday · {criticalCodes.size} kritik)
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSelected(new Set(eligibleCodes))}
                className="text-purple hover:underline font-semibold"
              >
                Tümünü ALAP yap
              </button>
              <span className="text-text3">·</span>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-text2 hover:underline"
              >
                Hiçbiri (hepsi ASAP)
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
                const isCrit = criticalCodes.has(w.code);
                const eligible = eligibleCodes.has(w.code);
                const isSel = selected.has(w.code);
                const sch = schedules.get(w.code);
                const floatStr =
                  sch?.totalFloat !== undefined ? `${sch.totalFloat}g` : "—";
                const reason = isCrit
                  ? "Kritik yol — ALAP yapılamaz (projeyi geciktirir)"
                  : w.activityType === "milestone"
                    ? "Milestone (ALAP geçerli değil)"
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
                          ? "bg-purple/[0.06] cursor-pointer hover:bg-purple/[0.12]"
                          : "hover:bg-bg2/40 cursor-pointer"
                    )}
                    title={!eligible ? reason : undefined}
                  >
                    {!eligible ? (
                      isCrit ? (
                        <Zap size={12} className="text-red shrink-0" />
                      ) : (
                        <Ban size={12} className="text-text3 shrink-0" />
                      )
                    ) : isSel ? (
                      <CheckSquare size={12} className="text-purple shrink-0" />
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
                    {/* Float gösterimi */}
                    <span
                      className={cn(
                        "font-mono text-[9.5px] shrink-0 px-1.5 py-0.5 rounded",
                        isCrit
                          ? "bg-red/10 text-red font-bold"
                          : sch?.totalFloat && sch.totalFloat <= 3
                            ? "bg-yellow/10 text-yellow font-bold"
                            : "bg-bg3 text-text2"
                      )}
                      title={
                        sch
                          ? `Float: ${floatStr}\nES: ${sch.earliestStart}\nLS: ${sch.latestStart ?? "—"}`
                          : "Float: hesaplanamadı"
                      }
                    >
                      +{floatStr}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <p className="mt-1.5 text-[10.5px] text-text3">
            Float yüksek kalemler ALAP için iyi adaydır. ALAP yapılan kalemin planı
            otomatik latestStart..latestEnd aralığına kaydırılır. Geri ASAP&apos;a
            çevirmek için tekrar bu dialog&apos;u aç ve işareti kaldır.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button variant="accent" onClick={handleApply}>
          <Clock size={14} /> {selectedCount} Kalemi ALAP Yap
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
