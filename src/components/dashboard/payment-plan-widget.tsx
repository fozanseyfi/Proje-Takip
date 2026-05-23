"use client";

import { useMemo } from "react";
import { CalendarCheck, AlertTriangle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { formatDate, formatMoney, cn, toISODate, addDays } from "@/lib/utils";
import type { PaymentMilestone, PaymentMilestoneStatus } from "@/lib/store/types";
import type { Currency } from "@/lib/utils";

const STATUS_LABEL: Record<PaymentMilestoneStatus, string> = {
  planned: "Plan",
  realized: "Gerçekleşti",
  partial: "Kısmi",
  cancelled: "İptal",
};
const STATUS_VARIANT: Record<PaymentMilestoneStatus, "yellow" | "green" | "blue" | "red"> = {
  planned: "yellow",
  realized: "green",
  partial: "blue",
  cancelled: "red",
};

export function PaymentPlanWidget() {
  const project = useCurrentProject();
  const allMilestones = useStore((s) => s.paymentMilestones);
  const subcontractors = useStore((s) => s.subcontractors);

  const milestones = useMemo(
    () =>
      project ? allMilestones.filter((m) => m.projectId === project.id) : ([] as PaymentMilestone[]),
    [allMilestones, project]
  );

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const horizon30 = useMemo(() => toISODate(addDays(new Date(), 30)), []);

  const data = useMemo(() => {
    const totals: Record<Currency, { planned: number; realized: number }> = {
      TRY: { planned: 0, realized: 0 },
      USD: { planned: 0, realized: 0 },
      EUR: { planned: 0, realized: 0 },
    };
    const overdue: PaymentMilestone[] = [];
    const upcoming: PaymentMilestone[] = [];
    for (const m of milestones) {
      if (m.status === "cancelled") continue;
      totals[m.currency].planned += m.plannedAmount;
      totals[m.currency].realized += m.actualAmount ?? 0;
      // Tam ödenmiş hariç tüm yarım hakedişler için gecikme/yaklaşan hesabı
      const isUnpaid = m.status === "planned" || m.status === "partial";
      if (isUnpaid && m.plannedDate < todayISO) overdue.push(m);
      else if (isUnpaid && m.plannedDate >= todayISO && m.plannedDate <= horizon30)
        upcoming.push(m);
    }
    overdue.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    upcoming.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    const usedCurrencies = (Object.keys(totals) as Currency[]).filter(
      (c) => totals[c].planned > 0 || totals[c].realized > 0
    );
    return { totals, overdue, upcoming, usedCurrencies };
  }, [milestones, todayISO, horizon30]);

  if (!project) return null;

  const hasAny = milestones.length > 0;
  const tone = data.overdue.length > 0 ? "red" : "purple";

  return (
    <CollapsibleCard
      title="Hakediş Planı"
      icon={<CalendarCheck size={18} />}
      tone={tone}
      defaultOpen={data.overdue.length > 0}
      link={{ href: "/billing", label: "Detay →" }}
      badge={
        data.overdue.length > 0 ? (
          <Badge variant="red">
            <AlertTriangle size={10} /> {data.overdue.length} gecikmiş
          </Badge>
        ) : milestones.length > 0 ? (
          <Badge variant="gray">{milestones.length}</Badge>
        ) : null
      }
    >
      <div className="px-5 py-4">
        {!hasAny ? (
          <div className="text-center py-6 text-sm text-text3">
            Henüz hakediş planı yok.{" "}
            <span className="text-accent font-semibold">Faturalandırma → Hakediş Planı</span>{" "}
            sekmesinden ekleyin.
          </div>
        ) : (
          <>
            {/* METRİKLER — para birimi bazlı */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
              {(["planned", "realized"] as const).flatMap((kind) =>
                data.usedCurrencies.slice(0, 2).map((cur) => (
                  <div
                    key={`${kind}-${cur}`}
                    className="rounded-lg bg-bg2 border border-border px-3 py-2"
                  >
                    <div className="text-[9px] uppercase tracking-wider font-bold text-text3">
                      {kind === "planned" ? "Planlanan" : "Gerçekleşen"} ({cur})
                    </div>
                    <div
                      className={cn(
                        "font-mono text-sm font-bold tabular-nums mt-0.5",
                        kind === "realized" ? "text-green" : "text-text"
                      )}
                    >
                      {formatMoney(data.totals[cur][kind], cur, 0)}
                    </div>
                    {kind === "realized" && data.totals[cur].planned > 0 && (
                      <div className="text-[10px] text-text3 font-mono">
                        %{((data.totals[cur].realized / data.totals[cur].planned) * 100).toFixed(1)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* GECİKMİŞLER */}
            {data.overdue.length > 0 && (
              <details open className="group rounded-lg border border-red/30 bg-red/5 mb-2">
                <summary className="cursor-pointer px-3 py-2 list-none flex items-center gap-2">
                  <AlertTriangle size={12} className="text-red" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-red">
                    Gecikmiş
                  </span>
                  <Badge variant="red">{data.overdue.length}</Badge>
                </summary>
                <div className="border-t border-red/20">
                  <MilestoneList items={data.overdue} subcontractors={subcontractors} todayISO={todayISO} />
                </div>
              </details>
            )}

            {/* YAKLAŞAN — 30 GÜN */}
            <details className="group rounded-lg border border-border bg-white">
              <summary className="cursor-pointer px-3 py-2 list-none flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-text2">
                  Önümüzdeki 30 Gün
                </span>
                <Badge variant="gray">{data.upcoming.length}</Badge>
              </summary>
              <div className="border-t border-border">
                {data.upcoming.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-text3">
                    Önümüzdeki 30 günde planlı hakediş yok.
                  </div>
                ) : (
                  <MilestoneList
                    items={data.upcoming.slice(0, 8)}
                    subcontractors={subcontractors}
                    todayISO={todayISO}
                  />
                )}
              </div>
            </details>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}

function MilestoneList({
  items,
  subcontractors,
  todayISO,
}: {
  items: PaymentMilestone[];
  subcontractors: { id: string; name: string }[];
  todayISO: string;
}) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {items.map((m) => {
          const overdueDays = m.plannedDate < todayISO
            ? Math.floor((new Date(todayISO).getTime() - new Date(m.plannedDate).getTime()) / 86_400_000)
            : 0;
          const isOwner = m.direction === "owner_incoming";
          const sc = subcontractors.find((s) => s.id === m.subcontractorId);
          return (
            <tr key={m.id} className="border-b border-border last:border-b-0 hover:bg-bg2/40">
              <td className="py-2 px-3 w-7">
                {isOwner ? (
                  <ArrowDownLeft size={14} className="text-green" />
                ) : (
                  <ArrowUpRight size={14} className="text-yellow" />
                )}
              </td>
              <td className="py-2 px-1">
                <div className="font-medium truncate max-w-[14rem]">{m.description}</div>
                <div className="text-[10px] text-text3">
                  {isOwner ? "İşveren" : sc?.name ?? "Alt Yüklenici"} ·{" "}
                  <span className={cn(overdueDays > 0 && "text-red font-bold")}>
                    {formatDate(m.plannedDate)}
                  </span>
                  {overdueDays > 0 && (
                    <span className="text-red font-bold ml-1">+{overdueDays}g</span>
                  )}
                </div>
              </td>
              <td className="py-2 px-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                {formatMoney(m.plannedAmount, m.currency, 0)}
              </td>
              <td className="py-2 px-2 text-right">
                <Badge variant={STATUS_VARIANT[m.status]}>{STATUS_LABEL[m.status]}</Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
