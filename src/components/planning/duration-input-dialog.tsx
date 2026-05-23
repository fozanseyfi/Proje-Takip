"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, CheckCircle2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WbsItem } from "@/lib/store/types";

/**
 * Süreleri Tanımla — Planlama akışının 1. adımı.
 * Her work aktivitesi için tahmini çalışma günü girilir.
 * Sihirbaz bu değeri default başlangıç süresi olarak kullanır.
 *
 * Milestone'lar listede gösterilmez (süreleri yok).
 */
type Workweek = "mon-fri" | "mon-sat" | "mon-sun";

export interface DurationSavePayload {
  /** Tahmini süre — undefined = temizle */
  durationDays: number | undefined;
  /** Çalışma haftası — undefined = değiştirme */
  workweek?: Workweek;
}

export interface DurationInputDialogProps {
  open: boolean;
  onClose: () => void;
  /** Tüm WBS — başlıkları (L1/L2) da içerir; dialog hiyerarşik gösterir. */
  wbs: WbsItem[];
  onSave: (entries: Record<string, DurationSavePayload>) => void;
}

export function DurationInputDialog({ open, onClose, wbs, onSave }: DurationInputDialogProps) {
  // Sıralı tam WBS — başlıklar (level 1/2) ve leaf'ler dahil (silinmiş hariç)
  const orderedWbs = useMemo(() => {
    return wbs
      .filter((w) => !w.deletedAt && w.level >= 1)
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [wbs]);

  // Sadece süre girilebilen kalemler (work leaf'ler) — sayı sayımı + onSave için
  const workItems = useMemo(
    () => orderedWbs.filter((l) => l.isLeaf && l.activityType !== "milestone"),
    [orderedWbs]
  );

  // Her code için süre (string olarak tutuyoruz — boş input için)
  const [durations, setDurations] = useState<Record<string, string>>({});
  // Her code için çalışma haftası
  const [workweeks, setWorkweeks] = useState<Record<string, Workweek>>({});
  const [search, setSearch] = useState("");

  // Dialog açılınca mevcut değerleri yükle
  useEffect(() => {
    if (open) {
      const initDur: Record<string, string> = {};
      const initWw: Record<string, Workweek> = {};
      for (const w of workItems) {
        initDur[w.code] = w.estimatedDurationDays != null ? String(w.estimatedDurationDays) : "";
        // Default: mon-sat (Türkiye inşaat sektörü en yaygın 6 günlük hafta)
        initWw[w.code] = w.workweek ?? "mon-sat";
      }
      setDurations(initDur); // eslint-disable-line react-hooks/set-state-in-effect
      setWorkweeks(initWw);
    }
  }, [open, workItems]);

  // Filtreli ağaç: leaf eşleşiyorsa ataları da göster (kullanıcı bağlamı kaybetmesin)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedWbs;
    const matchedCodes = new Set<string>();
    for (const w of orderedWbs) {
      if (w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q)) {
        matchedCodes.add(w.code);
        // Ataları da ekle (kodun her parçası)
        const parts = w.code.split(".");
        for (let i = 1; i < parts.length; i++) {
          matchedCodes.add(parts.slice(0, i).join("."));
        }
      }
    }
    return orderedWbs.filter((w) => matchedCodes.has(w.code));
  }, [orderedWbs, search]);

  const filledCount = useMemo(
    () => Object.values(durations).filter((v) => v !== "" && Number(v) > 0).length,
    [durations]
  );

  function handleSave() {
    const out: Record<string, DurationSavePayload> = {};
    for (const [code, v] of Object.entries(durations)) {
      out[code] = {
        durationDays: v === "" ? undefined : Math.max(0, Number(v) || 0),
        workweek: workweeks[code],
      };
    }
    onSave(out);
    onClose();
  }

  // Toplu hafta seçici
  function bulkSetWorkweek(ww: Workweek) {
    const next: Record<string, Workweek> = {};
    for (const w of workItems) next[w.code] = ww;
    setWorkweeks(next);
  }

  function fillSuggestion() {
    // Miktara göre kestirim — sihirbaz mantığıyla aynı (max 30, min 1)
    setDurations((s) => {
      const next = { ...s };
      for (const w of workItems) {
        if (next[w.code] === "" || !next[w.code]) {
          const est = Math.max(1, w.quantity > 0 ? Math.min(30, w.quantity) : 10);
          next[w.code] = String(est);
        }
      }
      return next;
    });
  }

  function clearAll() {
    const next: Record<string, string> = {};
    for (const w of workItems) next[w.code] = "";
    setDurations(next);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Süreleri Tanımla — Estimate Activity Durations" size="xl">
      <div className="space-y-3">
        <div className="px-3 py-2 rounded-lg bg-accent/8 border border-accent/25 text-[12px] text-text2 flex items-start gap-2">
          <Clock3 size={14} className="text-accent shrink-0 mt-0.5" />
          <span>
            Her iş kalemi için <strong>tahmini çalışma günü</strong> gir. Planlama Sihirbazı bunu default
            başlangıç değeri olarak kullanır. Boş bırakırsan sihirbaz miktara göre kestirim yapar
            (max 30 gün).
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="text"
            placeholder="Kod veya isim ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button variant="outline" size="sm" onClick={fillSuggestion}>
            Otomatik Tahmin (Miktara Göre)
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll}>
            Süreleri Temizle
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-text3">
          <span className="font-bold">Tümüne uygula:</span>
          <button
            type="button"
            onClick={() => bulkSetWorkweek("mon-fri")}
            className="px-2 py-0.5 rounded border border-border bg-white hover:border-accent hover:text-accent font-mono"
          >
            Pzt-Cum
          </button>
          <button
            type="button"
            onClick={() => bulkSetWorkweek("mon-sat")}
            className="px-2 py-0.5 rounded border border-border bg-white hover:border-accent hover:text-accent font-mono"
          >
            Pzt-Cmt
          </button>
          <button
            type="button"
            onClick={() => bulkSetWorkweek("mon-sun")}
            className="px-2 py-0.5 rounded border border-border bg-white hover:border-accent hover:text-accent font-mono"
          >
            Pzt-Pz
          </button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-1.5 bg-bg2 border-b border-border flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-text2">
            İş Kalemleri
            <span className="ml-auto font-mono normal-case tracking-normal text-text3">
              {filledCount} / {workItems.length} dolu
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-text3 text-[12px]">
                {workItems.length === 0
                  ? "Bu projede tanımlı work aktivitesi yok."
                  : "Eşleşen kalem yok."}
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-bg2 sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-wider text-text3">
                    <th className="px-3 py-1.5 text-left w-20">Kod</th>
                    <th className="px-3 py-1.5 text-left">Kalem</th>
                    <th className="px-3 py-1.5 text-right w-24">Miktar</th>
                    <th className="px-3 py-1.5 text-center w-44">İş Haftası</th>
                    <th className="px-3 py-1.5 text-right w-28">Süre (gün)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((w) => {
                    const indentPx = Math.max(0, w.level - 1) * 14;
                    // BAŞLIK SATIRI (L1 veya L2 — leaf değil)
                    if (!w.isLeaf) {
                      const levelClass =
                        w.level === 1
                          ? "bg-accent/[0.08] text-accent font-extrabold uppercase tracking-wide border-l-2 border-l-accent"
                          : "bg-blue/[0.05] text-blue font-bold border-l-2 border-l-blue/50";
                      return (
                        <tr
                          key={w.id}
                          className={cn("border-t border-border/40", levelClass)}
                        >
                          <td className="px-3 py-1.5 font-mono text-[10.5px]">{w.code}</td>
                          <td className="px-3 py-1.5 text-[11.5px]" colSpan={4}>
                            <span style={{ paddingLeft: `${indentPx}px` }}>{w.name}</span>
                          </td>
                        </tr>
                      );
                    }
                    // MILESTONE — süre girilemez, bilgi amaçlı göster
                    if (w.activityType === "milestone") {
                      return (
                        <tr
                          key={w.id}
                          className="border-t border-border/40 bg-purple/[0.03] hover:bg-purple/[0.06]"
                        >
                          <td className="px-3 py-1 font-mono text-[10.5px] text-text3">{w.code}</td>
                          <td className="px-3 py-1 text-text2 truncate max-w-[20rem]">
                            <span style={{ paddingLeft: `${indentPx}px` }}>
                              <span className="text-purple mr-1">◆</span>
                              {w.name}
                            </span>
                          </td>
                          <td className="px-3 py-1 text-right font-mono text-[10.5px] text-text3 italic">
                            milestone
                          </td>
                          <td className="px-3 py-1 text-center font-mono text-[10.5px] text-text3">
                            —
                          </td>
                          <td className="px-3 py-1 text-right font-mono text-[10.5px] text-text3">
                            —
                          </td>
                        </tr>
                      );
                    }
                    // İŞ KALEMİ (work leaf) — süre input'u + iş haftası seçici
                    const value = durations[w.code] ?? "";
                    const isFilled = value !== "" && Number(value) > 0;
                    const currentWw: Workweek = workweeks[w.code] ?? "mon-sat";
                    return (
                      <tr
                        key={w.id}
                        className={cn(
                          "border-t border-border/40 hover:bg-bg2/40",
                          isFilled && "bg-accent/[0.03]"
                        )}
                      >
                        <td className="px-3 py-1 font-mono text-[10.5px] text-text3">{w.code}</td>
                        <td className="px-3 py-1 text-text2 truncate max-w-[20rem]">
                          <span style={{ paddingLeft: `${indentPx}px` }}>{w.name}</span>
                        </td>
                        <td className="px-3 py-1 text-right font-mono text-[10.5px] text-text3">
                          {w.quantity > 0 ? `${w.quantity} ${w.unit || ""}` : "—"}
                        </td>
                        <td className="px-3 py-0.5 text-center">
                          <div className="inline-flex p-0.5 bg-bg3 rounded border border-border gap-0">
                            {(["mon-fri", "mon-sat", "mon-sun"] as const).map((ww) => (
                              <button
                                key={ww}
                                type="button"
                                onClick={() =>
                                  setWorkweeks((s) => ({ ...s, [w.code]: ww }))
                                }
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold transition-all",
                                  currentWw === ww
                                    ? "bg-white text-accent shadow-soft"
                                    : "text-text3 hover:text-text2"
                                )}
                                title={
                                  ww === "mon-fri"
                                    ? "Pzt-Cum (Cmt/Pz kapalı, 5 gün)"
                                    : ww === "mon-sat"
                                      ? "Pzt-Cmt (Pz kapalı, 6 gün)"
                                      : "Pzt-Pz (her gün, 7 gün)"
                                }
                              >
                                {ww === "mon-fri" ? "Pzt-Cum" : ww === "mon-sat" ? "Pzt-Cmt" : "Pzt-Pz"}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-0.5 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={value}
                            onChange={(e) =>
                              setDurations((s) => ({ ...s, [w.code]: e.target.value }))
                            }
                            placeholder="—"
                            className={cn(
                              "w-20 px-2 py-1 text-xs font-mono bg-white border rounded text-right focus:outline-none focus:border-accent",
                              isFilled ? "border-accent/40" : "border-border"
                            )}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button variant="accent" onClick={handleSave}>
          <CheckCircle2 size={14} /> Süreleri Kaydet ({filledCount})
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
