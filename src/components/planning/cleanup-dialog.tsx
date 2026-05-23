"use client";

import { useMemo, useState } from "react";
import { Eraser, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { WbsItem, DateQuantityMap } from "@/lib/store/types";

/**
 * Plan / Baseline / Öncül / Gerçekleşme temizleme aracı.
 * Kullanıcı kalemleri çoklu seçer + hangi veri tipini sileceğini işaretler.
 */
export interface CleanupOptions {
  planned: boolean;
  baseline: boolean;
  predecessors: boolean;
}

export interface CleanupDialogProps {
  open: boolean;
  onClose: () => void;
  leafs: WbsItem[];
  planned: DateQuantityMap;
  baseline: DateQuantityMap | undefined;
  onConfirm: (codes: string[], opts: CleanupOptions) => void;
}

export function CleanupDialog({
  open,
  onClose,
  leafs,
  planned,
  baseline,
  onConfirm,
}: CleanupDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [opts, setOpts] = useState<CleanupOptions>({
    planned: true,
    baseline: false,
    predecessors: false,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leafs;
    return leafs.filter(
      (l) =>
        l.code.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q)
    );
  }, [leafs, search]);

  function toggleCode(code: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(code)) n.delete(code);
      else n.add(code);
      return n;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((l) => l.code)));
  }
  function selectNone() {
    setSelected(new Set());
  }
  function selectWithPlanned() {
    setSelected(new Set(filtered.filter((l) => planned[l.code] && Object.keys(planned[l.code]).length > 0).map((l) => l.code)));
  }
  function selectWithPredecessors() {
    setSelected(new Set(filtered.filter((l) => (l.predecessors?.length ?? 0) > 0).map((l) => l.code)));
  }

  // Etki özeti — seçili kalemler × seçili opsiyonlar için kaç kayıt etkilenir
  const impact = useMemo(() => {
    let plannedHits = 0;
    let baselineHits = 0;
    let predHits = 0;
    for (const code of selected) {
      if (opts.planned && planned[code] && Object.keys(planned[code]).length > 0) plannedHits++;
      if (opts.baseline && baseline?.[code] && Object.keys(baseline[code]).length > 0) baselineHits++;
      if (opts.predecessors) {
        const w = leafs.find((l) => l.code === code);
        if ((w?.predecessors?.length ?? 0) > 0) predHits++;
      }
    }
    return { plannedHits, baselineHits, predHits };
  }, [selected, opts, planned, baseline, leafs]);

  const anyOpt = opts.planned || opts.baseline || opts.predecessors;
  const totalImpact = impact.plannedHits + impact.baselineHits + impact.predHits;
  const canApply = selected.size > 0 && anyOpt;

  function handleConfirm() {
    if (!canApply) return;
    onConfirm(Array.from(selected), opts);
    // Reset on close
    setSelected(new Set());
    setSearch("");
  }

  return (
    <Dialog open={open} onClose={onClose} title="Plan Temizle — Seçimli Sıfırlama" size="xl">
      <div className="space-y-4">
        <div className="px-3 py-2 rounded-lg bg-yellow/8 border border-yellow/30 text-[12px] flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow shrink-0 mt-0.5" />
          <span className="text-text2">
            Bu işlem <strong>geri alınamaz</strong>. Seçtiğin kalemler için işaretli veri tipleri{" "}
            <strong>silinir</strong>. Önemli verin varsa önce <strong>JSON Yedek</strong> al.
          </span>
        </div>

        {/* Hangi veriler temizlenecek */}
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-text2 mb-1.5">
            Hangi veriler temizlensin?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <OptCheck
              label="Plan değerleri"
              desc="Günlük plan miktarları"
              checked={opts.planned}
              onChange={(v) => setOpts((o) => ({ ...o, planned: v }))}
              color="blue"
            />
            <OptCheck
              label="Baseline"
              desc="Donmuş onaylı plan"
              checked={opts.baseline}
              onChange={(v) => setOpts((o) => ({ ...o, baseline: v }))}
              color="purple"
            />
            <OptCheck
              label="Öncüller"
              desc="Bağlılık linkleri"
              checked={opts.predecessors}
              onChange={(v) => setOpts((o) => ({ ...o, predecessors: v }))}
              color="green"
            />
          </div>
          <p className="mt-2 text-[10.5px] text-text3 leading-relaxed">
            Not: Gerçekleşme verisi planlama sayfasından temizlenmez —{" "}
            <strong>Günlük Puantaj / Gerçekleşme</strong> sayfasından yönetilir.
          </p>
        </div>

        {/* Kalem seçimi */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-text2">
              Hangi kalemler? <span className="text-text3 normal-case font-normal">({selected.size} seçili)</span>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[11px]">
              <button type="button" onClick={selectAll} className="text-accent hover:underline font-semibold">
                Hepsini seç
              </button>
              <span className="text-text3">·</span>
              <button type="button" onClick={selectNone} className="text-text2 hover:underline">
                Hiçbiri
              </button>
              <span className="text-text3">·</span>
              <button type="button" onClick={selectWithPlanned} className="text-blue hover:underline">
                Planı olanlar
              </button>
              <span className="text-text3">·</span>
              <button type="button" onClick={selectWithPredecessors} className="text-green hover:underline">
                Öncülü olanlar
              </button>
            </div>
          </div>
          <Input
            type="text"
            placeholder="Kod veya ad ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 max-h-72 overflow-y-auto border border-border rounded-lg bg-white">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-text3 text-[12px]">Eşleşen kalem yok.</div>
            ) : (
              filtered.map((l) => {
                const hasPlanned = !!planned[l.code] && Object.keys(planned[l.code]).length > 0;
                const hasBaseline = !!baseline?.[l.code] && Object.keys(baseline[l.code]).length > 0;
                const hasPreds = (l.predecessors?.length ?? 0) > 0;
                const isSel = selected.has(l.code);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleCode(l.code)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 border-b border-border/40 flex items-center gap-2 transition-colors",
                      isSel ? "bg-red/[0.05] hover:bg-red/[0.08]" : "hover:bg-bg2/40"
                    )}
                  >
                    {isSel ? (
                      <CheckSquare size={14} className="text-red shrink-0" />
                    ) : (
                      <Square size={14} className="text-text3 shrink-0" />
                    )}
                    <span className="font-mono text-[10.5px] text-text3 w-16 shrink-0">{l.code}</span>
                    <span className="flex-1 text-[12px] text-text truncate">{l.name}</span>
                    {l.activityType === "milestone" && (
                      <span className="text-[9px] font-bold text-purple shrink-0">◆</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {hasPlanned && (
                        <span className="text-[9px] px-1 py-0 rounded bg-blue/15 text-blue font-bold uppercase tracking-wider">
                          Plan
                        </span>
                      )}
                      {hasBaseline && (
                        <span className="text-[9px] px-1 py-0 rounded bg-purple/15 text-purple font-bold uppercase tracking-wider">
                          BL
                        </span>
                      )}
                      {hasPreds && (
                        <span className="text-[9px] px-1 py-0 rounded bg-green/15 text-green font-bold uppercase tracking-wider">
                          Öncül {l.predecessors!.length}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Etki özeti */}
        {selected.size > 0 && anyOpt && (
          <div className="px-3 py-2 rounded-lg bg-red/[0.04] border border-red/25 text-[12px]">
            <div className="font-bold text-red mb-1">
              <Eraser size={12} className="inline mr-1" /> Temizleme özeti — {totalImpact} kayıt
              etkilenecek
            </div>
            <ul className="text-text2 text-[11px] space-y-0.5 ml-5 list-disc">
              {opts.planned && (
                <li>
                  Plan değerleri: <strong>{impact.plannedHits}</strong> kalem temizlenecek
                </li>
              )}
              {opts.baseline && (
                <li>
                  Baseline: <strong>{impact.baselineHits}</strong> kalem temizlenecek
                </li>
              )}
              {opts.predecessors && (
                <li>
                  Öncüller: <strong>{impact.predHits}</strong> kalem temizlenecek (ayrıca bu kalemleri
                  öncül olarak gösteren diğer linkler de düşer)
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="accent"
          onClick={handleConfirm}
          disabled={!canApply}
          className={canApply ? "!bg-red !border-red hover:!bg-red/90" : ""}
        >
          <Eraser size={14} /> {selected.size} Kalem İçin Temizle
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function OptCheck({
  label,
  desc,
  checked,
  onChange,
  color,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: "blue" | "purple" | "green";
}) {
  const ring = {
    blue: "border-blue/40 bg-blue/[0.04]",
    purple: "border-purple/40 bg-purple/[0.04]",
    green: "border-green/40 bg-green/[0.04]",
  }[color];
  return (
    <label
      className={cn(
        "flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none",
        checked ? ring : "border-border bg-white hover:bg-bg2/40"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn("w-4 h-4 mt-0.5 shrink-0", `accent-${color}`)}
      />
      <div className="min-w-0">
        <div className="text-[12px] font-bold text-text">{label}</div>
        <div className="text-[10.5px] text-text3 leading-tight">{desc}</div>
      </div>
    </label>
  );
}
