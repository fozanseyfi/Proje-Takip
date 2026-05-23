"use client";

import { useMemo } from "react";
import { Receipt, Users2, ChevronDown } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import type { BillingItem, Subcontractor, PaymentMilestone } from "@/lib/store/types";

const STATUS_LABEL: Record<BillingItem["status"], string> = {
  taslak: "Taslak",
  gonderildi: "Beklemede",
  kismi: "Kısmi",
  odendi: "Ödendi",
  iptal: "İptal",
};
const STATUS_VARIANT: Record<BillingItem["status"], "gray" | "yellow" | "blue" | "green" | "red"> = {
  taslak: "gray",
  gonderildi: "yellow",
  kismi: "blue",
  odendi: "green",
  iptal: "red",
};

function getEffectiveStatus(b: BillingItem, milestones: PaymentMilestone[]): BillingItem["status"] {
  if (b.status === "iptal") return "iptal";
  let paid = 0;
  for (const m of milestones) {
    for (const p of m.payments ?? []) {
      if (p.billingItemId === b.id) paid += p.amount;
    }
  }
  if (paid <= 0) return b.status;
  if (paid < b.amount - 0.005) return "kismi";
  return "odendi";
}

export function BillingDetailWidget() {
  const project = useCurrentProject();
  const billing = useStore((s) => s.billing).filter((b) => b.projectId === project?.id);
  const subs = useStore((s) => s.subcontractors).filter((s) => s.projectId === project?.id);
  const milestones = useStore((s) => s.paymentMilestones).filter((m) => m.projectId === project?.id);

  const ownerInvoices = useMemo(
    () =>
      billing
        .filter((b) => b.direction === "owner_incoming")
        .sort((a, b) => a.issueDate.localeCompare(b.issueDate)),
    [billing]
  );

  if (!project) return null;

  const contractAmount = project.totalBudget ?? 0;
  const ownerInvoicedTotal = ownerInvoices
    .filter((b) => b.status !== "iptal")
    .reduce((s, b) => s + b.amount, 0);
  const ownerPaidTotal = ownerInvoices
    .filter((b) => b.status === "odendi")
    .reduce((s, b) => s + b.amount, 0);
  const ownerInvoicedPct = contractAmount > 0 ? (ownerInvoicedTotal / contractAmount) * 100 : 0;
  const ownerPaidPct = contractAmount > 0 ? (ownerPaidTotal / contractAmount) * 100 : 0;

  return (
    <CollapsibleCard
      title="Faturalandırma Durumu"
      icon={<Receipt size={18} />}
      tone="green"
      defaultOpen={false}
      link={{ href: "/billing", label: "Detay →" }}
    >
      <div className="px-5 py-4">
        {/* ÖZET METRİKLER — kompakt 3'lü */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <Metric label="Sözleşme" value={formatMoney(contractAmount, project.budgetCurrency, 0)} color="text-text" />
          <Metric
            label="Faturalanan"
            value={formatMoney(ownerInvoicedTotal, project.budgetCurrency, 0)}
            sub={`%${ownerInvoicedPct.toFixed(1)}`}
            color="text-accent"
          />
          <Metric
            label="Tahsil Edilen"
            value={formatMoney(ownerPaidTotal, project.budgetCurrency, 0)}
            sub={`%${ownerPaidPct.toFixed(1)}`}
            color="text-green"
          />
        </div>

        {/* Çift katmanlı progress */}
        <div className="h-2 bg-bg3 rounded-full overflow-hidden mb-3 relative">
          <div
            className="absolute h-full bg-accent/40 rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(100, ownerInvoicedPct)}%` }}
          />
          <div
            className="absolute h-full bg-green rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(100, ownerPaidPct)}%` }}
          />
        </div>

        {/* İŞVEREN FATURALARI — collapsible */}
        <details className="group rounded-lg border border-border bg-white">
          <summary className="cursor-pointer px-3 py-2 list-none flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-text2">
              İşveren Faturaları
            </span>
            <Badge variant="gray">{ownerInvoices.length}</Badge>
            <ChevronDown size={14} className="ml-auto text-text3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border max-h-64 overflow-y-auto">
            <CompactBillingList items={ownerInvoices} currency={project.budgetCurrency} milestones={milestones} />
          </div>
        </details>

        {/* ALT YÜKLENİCİLER — collapsible */}
        {subs.length > 0 && (
          <details className="group rounded-lg border border-border bg-white mt-2">
            <summary className="cursor-pointer px-3 py-2 list-none flex items-center gap-2">
              <Users2 size={12} className="text-accent" />
              <span className="text-[10px] uppercase tracking-wider font-bold text-text2">
                Alt Yükleniciler
              </span>
              <Badge variant="gray">{subs.length}</Badge>
              <ChevronDown size={14} className="ml-auto text-text3 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border max-h-96 overflow-y-auto p-3 space-y-2">
              {subs.map((sc) => (
                <SubcontractorMiniBlock key={sc.id} sub={sc} bills={billing} milestones={milestones} />
              ))}
            </div>
          </details>
        )}
      </div>
    </CollapsibleCard>
  );
}

function Metric({
  label,
  value,
  sub,
  color = "text-text",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg bg-bg2 border border-border px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider font-bold text-text3">{label}</div>
      <div className={cn("font-mono text-sm font-bold tabular-nums mt-0.5", color)}>{value}</div>
      {sub && <div className="text-[10px] text-text3 font-mono">{sub}</div>}
    </div>
  );
}

function CompactBillingList({
  items,
  currency,
  milestones,
}: {
  items: BillingItem[];
  currency: string;
  milestones: PaymentMilestone[];
}) {
  if (items.length === 0) {
    return <div className="px-3 py-4 text-center text-xs text-text3">Henüz fatura yok.</div>;
  }
  const todayISO = new Date().toISOString().slice(0, 10);
  return (
    <table className="w-full text-xs">
      <tbody>
        {items.map((b, i) => {
          const effStatus = getEffectiveStatus(b, milestones);
          const isPaid = effStatus === "odendi";
          const isOverdue =
            !isPaid &&
            effStatus !== "iptal" &&
            !!b.dueDate &&
            b.dueDate < todayISO;
          return (
            <tr key={b.id} className={cn("border-b border-border last:border-b-0 hover:bg-bg2/40", isOverdue && "bg-red/5")}>
              <td className="py-2 px-3 text-text3 font-mono w-8">{i + 1}</td>
              <td className="py-2 px-1">
                <div className="font-medium truncate max-w-[14rem]">{b.description}</div>
                <div className="text-[10px] text-text3">
                  {b.invoiceNo && <span className="font-mono mr-2">{b.invoiceNo}</span>}
                  Vade: <span className={cn(isOverdue && "text-red font-bold")}>{b.dueDate ? formatDate(b.dueDate) : "—"}</span>
                </div>
              </td>
              <td className="py-2 px-2 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                {formatMoney(b.amount, currency as "TRY" | "USD" | "EUR", 0)}
              </td>
              <td className="py-2 px-2 text-right">
                <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                  <Badge variant={STATUS_VARIANT[effStatus]}>{STATUS_LABEL[effStatus]}</Badge>
                  {isOverdue && (
                    <Badge variant="red">Gecikti</Badge>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SubcontractorMiniBlock({
  sub,
  bills,
  milestones,
}: {
  sub: Subcontractor;
  bills: BillingItem[];
  milestones: PaymentMilestone[];
}) {
  const myBills = useMemo(
    () =>
      bills.filter(
        (b) => b.direction === "subcontractor_outgoing" && b.subcontractorId === sub.id
      ),
    [bills, sub.id]
  );
  const invoiced = myBills.filter((b) => b.status !== "iptal").reduce((s, b) => s + b.amount, 0);
  const paid = myBills.filter((b) => b.status === "odendi").reduce((s, b) => s + b.amount, 0);
  const invoicedPct = sub.contractAmount > 0 ? (invoiced / sub.contractAmount) * 100 : 0;
  const paidPct = sub.contractAmount > 0 ? (paid / sub.contractAmount) * 100 : 0;

  return (
    <details className="group rounded-md bg-bg2 border border-border">
      <summary className="cursor-pointer px-3 py-2 list-none">
        <div className="flex items-center gap-2 mb-1.5">
          <ChevronDown size={12} className="text-text3 transition-transform group-open:rotate-180 shrink-0" />
          <div className="font-semibold text-xs text-text truncate flex-1">{sub.name}</div>
          <div className="text-[10px] font-mono whitespace-nowrap">
            <span className="text-text font-semibold">{formatMoney(invoiced, sub.currency, 0)}</span>
            <span className="text-text3 mx-0.5">/</span>
            <span className="text-text3">{formatMoney(sub.contractAmount, sub.currency, 0)}</span>
            <span className={cn("ml-1.5 font-bold", invoicedPct >= 80 ? "text-green" : invoicedPct >= 40 ? "text-yellow" : "text-text3")}>
              {invoicedPct.toFixed(0)}%
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-white border border-border rounded-full overflow-hidden relative ml-5">
          <div className="absolute h-full bg-accent/40 rounded-full" style={{ width: `${Math.min(100, invoicedPct)}%` }} />
          <div className="absolute h-full bg-green rounded-full" style={{ width: `${Math.min(100, paidPct)}%` }} />
        </div>
        <div className="text-[10px] text-text3 ml-5 mt-1 truncate">{sub.scopeOfWork}</div>
      </summary>
      {myBills.length > 0 && (
        <div className="border-t border-border bg-white">
          <CompactBillingList items={myBills} currency={sub.currency} milestones={milestones} />
        </div>
      )}
    </details>
  );
}
