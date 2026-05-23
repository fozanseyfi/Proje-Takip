"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FolderTree, X, ListChecks } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber, cn } from "@/lib/utils";
import type { WbsItem, DateQuantityMap } from "@/lib/store/types";

/**
 * Plan / Gerçekleşme görüntüleme listesi — düzenleme yok, sadece görüntüleme.
 * Gün + WBS kalemi filtreli, ana tablodan bağımsız bir özet.
 */
export function PlanRealList({
  title,
  icon,
  variant,
  wbs,
  data,
}: {
  title: string;
  icon: React.ReactNode;
  variant: "planned" | "realized";
  wbs: WbsItem[];
  data: DateQuantityMap;
}) {
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterCode, setFilterCode] = useState<string>("");

  // Sadece leaf'ler
  const leafs = useMemo(
    () => wbs.filter((w) => w.isLeaf).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [wbs]
  );

  // Tüm kayıtları düzleştir
  const allRecords = useMemo(() => {
    const list: {
      date: string;
      code: string;
      qty: number;
      name: string;
      unit: string;
      quantity: number;
      level: number;
    }[] = [];
    for (const [code, byDate] of Object.entries(data)) {
      const w = wbs.find((x) => x.code === code);
      if (!w) continue;
      for (const [date, qty] of Object.entries(byDate)) {
        const n = Number(qty) || 0;
        if (n === 0) continue;
        list.push({
          date,
          code,
          qty: n,
          name: w.name,
          unit: w.unit,
          quantity: w.quantity,
          level: w.level,
        });
      }
    }
    return list.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  }, [data, wbs]);

  const filtered = useMemo(() => {
    return allRecords.filter((r) => {
      if (filterDate && r.date !== filterDate) return false;
      if (filterCode && r.code !== filterCode) return false;
      return true;
    });
  }, [allRecords, filterDate, filterCode]);

  // Kayıtlı tarihler ve kalemler (filtre dropdown'ları için)
  const uniqueDates = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.date))).sort(),
    [allRecords]
  );
  const uniqueCodes = useMemo(() => {
    const codes = new Set(allRecords.map((r) => r.code));
    return leafs.filter((l) => codes.has(l.code));
  }, [allRecords, leafs]);

  // Filtreli toplam (kalem bazında miktar)
  const total = filtered.reduce((s, r) => s + r.qty, 0);

  // Kümülatif (filtreye uyan code için, son tarihe kadar kümülatif)
  const codeCumulative = useMemo(() => {
    if (!filterCode) return null;
    const all = allRecords.filter((r) => r.code === filterCode);
    return all.reduce((s, r) => s + r.qty, 0);
  }, [allRecords, filterCode]);

  const hasFilter = !!(filterDate || filterCode);
  const isPlanned = variant === "planned";
  const accentClass = isPlanned ? "text-planned" : "text-realized";
  const cellBgClass = isPlanned ? "bg-blue/5" : "bg-green/5";

  return (
    <Card className={cn("!p-0 overflow-hidden mt-6 border-2", isPlanned ? "border-planned/40" : "border-realized/40")}>
      <div
        className={cn(
          "px-6 py-4 border-b-2 relative",
          isPlanned ? "bg-blue/10 border-planned/30" : "bg-green/10 border-realized/30"
        )}
      >
        {/* Sol kenarda kalın renk şeridi */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1",
            isPlanned ? "bg-planned" : "bg-realized"
          )}
        />
        <div className="flex items-center gap-2 pl-2">
          <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0", isPlanned ? "bg-blue/15" : "bg-green/15")}>
            {icon}
          </span>
          <div className="flex-1">
            <div className={cn("font-display text-sm font-bold tracking-tight", accentClass)}>
              {title}
            </div>
            <div className="text-[10px] text-text3 mt-0.5 uppercase tracking-wider font-semibold">
              Sadece görüntüleme · düzenlemek için yukarı çık
            </div>
          </div>
          <Badge variant={isPlanned ? "blue" : "green"} className="!text-sm !px-2.5 !py-1">
            {allRecords.length} kayıt
          </Badge>
        </div>
      </div>

      {/* Filtreler */}
      <div className="px-6 py-4 bg-bg2/40 border-b border-border">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tarih (tek gün)" className="w-44">
            <Select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="font-mono text-xs"
            >
              <option value="">Tüm tarihler ({uniqueDates.length})</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="İş Kalemi (WBS)" className="min-w-[300px] flex-1">
            <Select
              value={filterCode}
              onChange={(e) => setFilterCode(e.target.value)}
              className="text-xs"
            >
              <option value="">Tüm kalemler ({uniqueCodes.length})</option>
              {uniqueCodes.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} — {w.name}
                </option>
              ))}
            </Select>
          </Field>
          {hasFilter && (
            <Button
              variant="outline"
              onClick={() => {
                setFilterDate("");
                setFilterCode("");
              }}
            >
              <X size={14} /> Temizle
            </Button>
          )}
          <div className="ml-auto flex flex-col items-end gap-1">
            <Badge variant={isPlanned ? "blue" : "green"}>
              {filtered.length} satır görüntüleniyor
            </Badge>
            <div className="text-[11px] text-text3">
              Filtreli toplam:{" "}
              <span className={cn("font-mono font-bold", accentClass)}>
                {formatNumber(total, 2)}
              </span>
            </div>
            {filterCode && codeCumulative != null && (
              <div className="text-[11px] text-text3">
                Kalem kümülatifi:{" "}
                <span className={cn("font-mono font-bold", accentClass)}>
                  {formatNumber(codeCumulative, 2)}
                </span>
                {(() => {
                  const w = uniqueCodes.find((x) => x.code === filterCode);
                  if (!w || !w.quantity) return null;
                  return (
                    <span className="text-text3">
                      {" / "}
                      <span className="font-mono">{formatNumber(w.quantity, 0)}</span> {w.unit}
                      <span className="font-mono ml-1">
                        ({((codeCumulative / w.quantity) * 100).toFixed(1)}%)
                      </span>
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tablo */}
      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border whitespace-nowrap">
                Tarih
              </th>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border whitespace-nowrap">
                Kod
              </th>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border">
                İş Kalemi
              </th>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border whitespace-nowrap">
                {isPlanned ? "Planlanan" : "Gerçekleşen"} Miktar
              </th>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-left text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border whitespace-nowrap">
                Birim
              </th>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border whitespace-nowrap">
                Toplam Hedef
              </th>
              <th className="sticky top-0 z-10 bg-bg2 px-4 py-2.5 text-right text-[10px] uppercase tracking-wider font-bold text-text2 border-b border-border whitespace-nowrap">
                Pay %
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text3 text-sm">
                  {hasFilter ? (
                    <>
                      Bu filtreye uyan kayıt yok.
                      {filterDate && (
                        <span className="block mt-1 text-[11px]">
                          <strong>{formatDate(filterDate)}</strong> tarihinde
                          {isPlanned ? " planlanan" : " gerçekleşmiş"} iş yok
                        </span>
                      )}
                    </>
                  ) : (
                    <>Henüz {isPlanned ? "plan" : "gerçekleşme"} kaydı yok.</>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const pay = r.quantity > 0 ? (r.qty / r.quantity) * 100 : 0;
                return (
                  <tr key={`${r.code}-${r.date}`} className={cn("hover:bg-bg2/40", filterDate && filterDate === r.date && cellBgClass)}>
                    <td className="px-4 py-2 border-b border-border font-mono text-xs text-text2 whitespace-nowrap">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-4 py-2 border-b border-border font-mono text-xs text-text3 whitespace-nowrap">
                      {r.code}
                    </td>
                    <td className="px-4 py-2 border-b border-border text-sm">{r.name}</td>
                    <td className="px-4 py-2 border-b border-border text-right font-mono text-sm font-bold tabular-nums">
                      <span className={accentClass}>{formatNumber(r.qty, 2)}</span>
                    </td>
                    <td className="px-4 py-2 border-b border-border text-xs text-text3">{r.unit}</td>
                    <td className="px-4 py-2 border-b border-border text-right font-mono text-xs text-text2 tabular-nums">
                      {formatNumber(r.quantity, 0)}
                    </td>
                    <td className="px-4 py-2 border-b border-border text-right font-mono text-xs tabular-nums">
                      <span className={cn(accentClass)}>{pay.toFixed(2)}%</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
