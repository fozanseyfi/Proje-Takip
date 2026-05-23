"use client";

import { useState, useMemo } from "react";
import { CalendarClock, FileSignature, Package, Wallet, AlertTriangle, Star } from "lucide-react";
import type { ProcurementItem } from "@/lib/store/types";
import type { Currency } from "@/lib/utils";
import { formatMoney, formatDate, toISODate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export interface ProcurementKpis {
  /** Toplam kalem sayısı */
  total: number;
  /** Aktif (teslim/iade olmayan) sayı */
  open: number;
  /** Teslim edilmiş sayı (status === "teslim") */
  delivered: number;
  /** Teslim gecikmesi olan kalem sayısı */
  deliveryLateCount: number;
  /** En çok teslim gecikme günü */
  deliveryMaxDays: number;
  /** PO gecikmesi olan kalem sayısı (PO planlanan tarih geçmiş, actual PO yok) */
  poLateCount: number;
  /** En çok PO gecikme günü */
  poMaxDays: number;
  /** Para birimi bazlı toplam (plan/actual) */
  totalsByCurrency: {
    planned: Record<Currency, number>;
    actual: Record<Currency, number>;
  };
  /** Kayıt olan para birimleri (USD→TRY→EUR sırasında, sıfır olmayan) */
  activeCurrencies: Currency[];
}

export function computeProcurementKpis(
  items: ProcurementItem[],
  precomputedTotals?: {
    planned: Record<Currency, number>;
    actual: Record<Currency, number>;
  }
): ProcurementKpis {
  const today = toISODate(new Date());

  // Para birimi toplamı (verilmediyse hesapla)
  const totals = precomputedTotals ?? (() => {
    const planned: Record<Currency, number> = { TRY: 0, USD: 0, EUR: 0 };
    const actual: Record<Currency, number> = { TRY: 0, USD: 0, EUR: 0 };
    for (const it of items) {
      planned[it.currency] += it.quantity * it.unitPrice;
      if (it.actualQuantity != null && it.actualUnitPrice != null) {
        const ac = it.actualCurrency ?? it.currency;
        actual[ac] += it.actualQuantity * it.actualUnitPrice;
      }
    }
    return { planned, actual };
  })();

  let open = 0;
  let delivered = 0;
  let deliveryLateCount = 0;
  let deliveryMaxDays = 0;
  let poLateCount = 0;
  let poMaxDays = 0;

  for (const it of items) {
    const actualDel = it.actualDeliveredDate ?? it.deliveredDate;
    // Statü "teslim" VEYA actual delivery tarihi varsa → teslim edilmiş kabul et
    if (it.status === "teslim" || actualDel) {
      delivered++;
      continue;
    }
    if (it.status === "iade") continue;
    open++;

    // Teslim gecikmesi — sadece henüz teslim edilmemiş kalemler için
    const plannedDel = it.plannedDeliveryDate ?? it.expectedDate;
    if (plannedDel && plannedDel < today) {
      deliveryLateCount++;
      const days = Math.floor(
        (new Date(today).getTime() - new Date(plannedDel).getTime()) / 86400000
      );
      if (days > deliveryMaxDays) deliveryMaxDays = days;
    }

    // PO gecikmesi — plan tarihi geçmiş ama actual PO yok
    const plannedPo = it.plannedPoDate ?? it.orderDate;
    if (plannedPo && plannedPo < today && !it.actualPoDate) {
      poLateCount++;
      const days = Math.floor(
        (new Date(today).getTime() - new Date(plannedPo).getTime()) / 86400000
      );
      if (days > poMaxDays) poMaxDays = days;
    }
  }

  const order: Currency[] = ["USD", "TRY", "EUR"];
  const activeCurrencies = order.filter(
    (c) => totals.planned[c] > 0 || totals.actual[c] > 0
  );

  return {
    total: items.length,
    open,
    delivered,
    deliveryLateCount,
    deliveryMaxDays,
    poLateCount,
    poMaxDays,
    totalsByCurrency: totals,
    activeCurrencies,
  };
}

export function ProcurementKpiStrip({
  kpis,
  items,
  compact = false,
}: {
  kpis: ProcurementKpis;
  /** Tıklanabilir detay listesi için kaynak — pas geçilirse cards static gösterir */
  items?: ProcurementItem[];
  /** Dashboard içi kullanım için daha sıkışık */
  compact?: boolean;
}) {
  const pad = compact ? "!p-3" : "!p-4";
  const label = compact ? "text-[9.5px]" : "text-[10px]";
  const big = compact ? "text-2xl" : "text-3xl";

  // Tıklamayla açılan detay dialog'u
  const [detailType, setDetailType] = useState<"delivery" | "po" | null>(null);
  const today = toISODate(new Date());

  // Geciken kalemler — talep edilen tipe göre. KPI sayım mantığıyla birebir uyumlu.
  const lateItems = useMemo(() => {
    if (!items || !detailType) return [];
    return items
      .filter((it) => {
        if (it.status === "iade") return false;
        if (detailType === "delivery") {
          // Actual delivery tarihi varsa veya statü teslimse → "geciken" sayılmaz
          const actualDel = it.actualDeliveredDate ?? it.deliveredDate;
          if (it.status === "teslim" || actualDel) return false;
          const planned = it.plannedDeliveryDate ?? it.expectedDate;
          return !!planned && planned < today;
        } else {
          const planned = it.plannedPoDate ?? it.orderDate;
          return !!planned && planned < today && !it.actualPoDate;
        }
      })
      .map((it) => {
        const planned =
          detailType === "delivery"
            ? it.plannedDeliveryDate ?? it.expectedDate
            : it.plannedPoDate ?? it.orderDate;
        // Henüz tamamlanmadığına göre: bugüne kadar geçen gün sayısı
        const days = planned
          ? Math.floor(
              (new Date(today).getTime() - new Date(planned).getTime()) / 86400000
            )
          : 0;
        return { it, planned, days };
      })
      .sort((a, b) => b.days - a.days);
  }, [items, detailType, today]);

  const isClickableDelivery = items && kpis.deliveryLateCount > 0;
  const isClickablePo = items && kpis.poLateCount > 0;

  return (
    <>
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3",
        !compact && "mb-4"
      )}
    >
      {/* GECİKME (TESLİM) */}
      <Card
        className={cn(
          pad,
          kpis.deliveryLateCount > 0 && "ring-1 ring-red/30 bg-red/5",
          isClickableDelivery && "cursor-pointer hover:ring-2 hover:ring-red/60 transition-all"
        )}
        onClick={isClickableDelivery ? () => setDetailType("delivery") : undefined}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-lg",
              kpis.deliveryLateCount > 0 ? "bg-red/15 text-red" : "bg-bg2 text-text3"
            )}
          >
            <CalendarClock size={14} />
          </span>
          <span className={cn(label, "text-text3 uppercase font-bold tracking-wider")}>
            Gecikme (Teslim)
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono font-extrabold tabular-nums leading-none",
              big,
              kpis.deliveryLateCount > 0 ? "text-red" : "text-text3"
            )}
          >
            {kpis.deliveryLateCount}
          </span>
          <span className="text-[11px] text-text3">/ {kpis.open} açık</span>
        </div>
        <div className="mt-1.5 text-[10.5px] text-text2">
          {kpis.deliveryMaxDays > 0 ? (
            <>En geç: <strong className="text-red">+{kpis.deliveryMaxDays} g</strong></>
          ) : (
            <span className="text-text3">Zamanında / vade gelmedi</span>
          )}
          {isClickableDelivery && (
            <span className="ml-1.5 text-[9.5px] text-red font-bold">· Detay →</span>
          )}
        </div>
      </Card>

      {/* GECİKME (PO) */}
      <Card
        className={cn(
          pad,
          kpis.poLateCount > 0 && "ring-1 ring-orange/30 bg-orange/5",
          isClickablePo && "cursor-pointer hover:ring-2 hover:ring-orange/60 transition-all"
        )}
        onClick={isClickablePo ? () => setDetailType("po") : undefined}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-lg",
              kpis.poLateCount > 0 ? "bg-orange/15 text-orange" : "bg-bg2 text-text3"
            )}
          >
            <FileSignature size={14} />
          </span>
          <span className={cn(label, "text-text3 uppercase font-bold tracking-wider")}>
            Gecikme (PO)
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-mono font-extrabold tabular-nums leading-none",
              big,
              kpis.poLateCount > 0 ? "text-orange" : "text-text3"
            )}
          >
            {kpis.poLateCount}
          </span>
          <span className="text-[11px] text-text3">kalem</span>
        </div>
        <div className="mt-1.5 text-[10.5px] text-text2">
          {kpis.poMaxDays > 0 ? (
            <>En geç: <strong className="text-orange">+{kpis.poMaxDays} g</strong></>
          ) : (
            <span className="text-text3">PO zamanında veya vade gelmedi</span>
          )}
          {isClickablePo && (
            <span className="ml-1.5 text-[9.5px] text-orange font-bold">· Detay →</span>
          )}
        </div>
      </Card>

      {/* TESLİM EDİLEN */}
      <Card className={cn(pad)}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green/15 text-green">
            <Package size={14} />
          </span>
          <span className={cn(label, "text-text3 uppercase font-bold tracking-wider")}>
            Teslim Edilen
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn("font-mono font-extrabold tabular-nums leading-none text-green", big)}>
            {kpis.delivered}
          </span>
          <span className="text-[11px] text-text3">/ {kpis.total} toplam</span>
        </div>
        <div className="mt-1.5 text-[10.5px] text-text2">
          {kpis.total > 0 ? (
            <>
              <strong className="text-green">
                %{((kpis.delivered / kpis.total) * 100).toFixed(0)}
              </strong>{" "}
              teslim oranı
            </>
          ) : (
            <span className="text-text3">Henüz kayıt yok</span>
          )}
        </div>
      </Card>

      {/* TOPLAM BEDEL */}
      <Card className={cn(pad)}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent/15 text-accent">
            <Wallet size={14} />
          </span>
          <span className={cn(label, "text-text3 uppercase font-bold tracking-wider")}>
            Toplam Bedel
          </span>
        </div>
        {kpis.activeCurrencies.length === 0 ? (
          <div className="text-text3 text-sm italic">Kayıt yok</div>
        ) : (
          <div className="space-y-0.5">
            {kpis.activeCurrencies.map((c) => (
              <div key={c} className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[9.5px] font-bold text-text3 tracking-wider w-6">
                    {c}
                  </span>
                  <span
                    className={cn(
                      "font-mono font-bold text-text tabular-nums leading-none",
                      compact ? "text-[13px]" : "text-[15px]"
                    )}
                  >
                    {formatMoney(kpis.totalsByCurrency.planned[c], c, 0)}
                  </span>
                </div>
                {kpis.totalsByCurrency.actual[c] > 0 && (
                  <span className="font-mono text-[10px] font-semibold text-realized tabular-nums">
                    {formatMoney(kpis.totalsByCurrency.actual[c], c, 0)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>

    {/* Gecikme detay dialog'u */}
    <Dialog
      open={detailType !== null}
      onClose={() => setDetailType(null)}
      title={detailType === "delivery" ? "Geciken Teslimat — Detay" : "Geciken PO — Detay"}
      size="lg"
    >
      <div className="text-[11px] text-text2 mb-3 flex items-center gap-2">
        <AlertTriangle
          size={12}
          className={detailType === "delivery" ? "text-red" : "text-orange"}
        />
        <span>
          <strong>{lateItems.length}</strong> kalemde{" "}
          {detailType === "delivery"
            ? "planlanan teslim tarihi geçmiş ama henüz teslim edilmemiş"
            : "planlanan PO tarihi geçmiş ama actual PO girilmemiş"}
          .
        </span>
      </div>
      {lateItems.length === 0 ? (
        <div className="text-text3 text-sm py-6 text-center">Geciken kalem yok.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-bg2 text-text2">
              <tr className="text-[10px] uppercase tracking-wider font-bold">
                <th className="px-3 py-2 text-left w-8"></th>
                <th className="px-3 py-2 text-left">Malzeme</th>
                <th className="px-3 py-2 text-left">Tedarikçi</th>
                <th className="px-2 py-2 text-center w-24">
                  {detailType === "delivery" ? "Plan Teslim" : "Plan PO"}
                </th>
                <th className="px-2 py-2 text-right w-20">Gecikme</th>
                <th className="px-2 py-2 text-center w-20">Durum</th>
              </tr>
            </thead>
            <tbody>
              {lateItems.map(({ it, planned, days }) => (
                <tr key={it.id} className="border-t border-border hover:bg-bg2/40">
                  <td className="px-3 py-2 text-center">
                    {it.isCritical && (
                      <Star size={12} className="fill-yellow text-yellow inline" />
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold">{it.material}</td>
                  <td className="px-3 py-2 text-text2">{it.supplier ?? "—"}</td>
                  <td className="px-2 py-2 text-center font-mono text-[11px] text-planned tabular-nums">
                    {planned ? formatDate(planned) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
                        detailType === "delivery"
                          ? "bg-red/15 text-red"
                          : "bg-orange/15 text-orange"
                      )}
                    >
                      +{days} g
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Badge variant="gray" className="!text-[10px]">
                      {it.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
    </>
  );
}
