"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Building2,
  Users2,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  ChevronDown,
} from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { confirmAction } from "@/components/ui/confirm";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { formatDate, formatMoney, cn, toISODate, addDays, uid, daysBetween } from "@/lib/utils";
import type {
  BillingItem,
  Subcontractor,
  BillingDirection,
  Discipline,
  PaymentMilestone,
  PaymentMilestoneStatus,
  PaymentEntry,
} from "@/lib/store/types";
import type { Currency } from "@/lib/utils";

type Tab = "owner-payments" | "sub-payments" | "owner" | "subcontractor-invoices";

const STATUS_LABEL: Record<BillingItem["status"], string> = {
  taslak: "Taslak",
  gonderildi: "Gönderildi",
  kismi: "Kısmi Ödendi",
  odendi: "Ödendi",
  iptal: "İptal",
};

/**
 * Bir faturaya bağlı ödemeleri toplayarak gerçek durumunu hesaplar.
 * Stored status'u geçersiz kılarak güncel duruma göre yenisini döner.
 * Kullanım: tablolarda her zaman gerçek durumu göster (eski sample/manuel veriler için).
 */
function getEffectiveInvoiceStatus(
  b: BillingItem,
  milestones: PaymentMilestone[]
): BillingItem["status"] {
  if (b.status === "iptal") return "iptal";
  let paidSum = 0;
  for (const m of milestones) {
    for (const p of m.payments ?? []) {
      if (p.billingItemId === b.id) paidSum += p.amount;
    }
  }
  // Hiç ödeme kaydı yoksa stored status'a güven (manuel ödendi/gonderildi durumları için)
  if (paidSum <= 0) return b.status;
  if (paidSum < b.amount - 0.005) return "kismi";
  return "odendi";
}

/**
 * Fatura gecikmiş mi? (vade tarihi geçmiş + tam ödenmedi)
 */
function isInvoiceOverdue(
  b: BillingItem,
  effectiveStatus: BillingItem["status"],
  todayISO: string
): boolean {
  if (!b.dueDate) return false;
  if (effectiveStatus === "odendi" || effectiveStatus === "iptal") return false;
  return b.dueDate < todayISO;
}

const STATUS_VARIANT: Record<BillingItem["status"], "gray" | "blue" | "green" | "red" | "yellow"> = {
  taslak: "gray",
  gonderildi: "blue",
  kismi: "yellow",
  odendi: "green",
  iptal: "red",
};

const SC_STATUS_LABEL: Record<Subcontractor["status"], string> = {
  aktif: "Aktif",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
  askida: "Askıda",
};
const SC_STATUS_VARIANT: Record<Subcontractor["status"], "green" | "blue" | "red" | "yellow"> = {
  aktif: "green",
  tamamlandi: "blue",
  iptal: "red",
  askida: "yellow",
};

export default function BillingPage() {
  const project = useCurrentProject();
  const billing = useStore((s) => s.billing).filter((b) => b.projectId === project?.id);
  const subcontractors = useStore((s) => s.subcontractors).filter((s) => s.projectId === project?.id);
  const milestones = useStore((s) => s.paymentMilestones).filter((m) => m.projectId === project?.id);

  const [tab, setTab] = useState<Tab>("owner-payments");

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
      </Card>
    );
  }

  const ownerInvoices = billing.filter((b) => b.direction === "owner_incoming");
  const subInvoices = billing.filter((b) => b.direction === "subcontractor_outgoing");
  const ownerMilestoneCount = milestones.filter((m) => m.direction === "owner_incoming").length;
  const subMilestoneCount = milestones.filter((m) => m.direction === "subcontractor_outgoing").length;

  // Sözleşme top. tutarları — para birimi bazında
  const ownerContracts: Record<Currency, number> = {
    TRY: project.budgetCurrency === "TRY" ? project.totalBudget ?? 0 : 0,
    USD: project.budgetCurrency === "USD" ? project.totalBudget ?? 0 : 0,
    EUR: project.budgetCurrency === "EUR" ? project.totalBudget ?? 0 : 0,
  };
  const subContracts: Record<Currency, number> = subcontractors
    .filter((sc) => sc.status !== "iptal")
    .reduce(
      (acc, sc) => {
        acc[sc.currency] += sc.contractAmount;
        return acc;
      },
      { TRY: 0, USD: 0, EUR: 0 } as Record<Currency, number>
    );

  return (
    <>
      <PageHeader
        title="Hakediş & Fatura"
        description="İşveren ve alt yüklenici hakediş + fatura takibi"
        icon={Receipt}
      />

      <div className="flex items-center gap-1 p-1 bg-bg2 border border-border rounded-xl mb-5 w-fit overflow-x-auto">
        <TabButton active={tab === "owner-payments"} onClick={() => setTab("owner-payments")} icon={<CalendarCheck size={14} className="text-blue" />}>
          İşveren Hakedişleri
          <CountPill>{ownerMilestoneCount}</CountPill>
        </TabButton>
        <TabButton active={tab === "owner"} onClick={() => setTab("owner")} icon={<Building2 size={14} className="text-blue" />}>
          İşveren Faturaları
          <CountPill>{ownerInvoices.length}</CountPill>
        </TabButton>
        <span className="w-px h-6 bg-border mx-2 shrink-0" aria-hidden />
        <TabButton active={tab === "sub-payments"} onClick={() => setTab("sub-payments")} icon={<CalendarCheck size={14} className="text-yellow" />}>
          Alt Yüklenici Hakedişleri
          <CountPill>{subMilestoneCount}</CountPill>
        </TabButton>
        <TabButton active={tab === "subcontractor-invoices"} onClick={() => setTab("subcontractor-invoices")} icon={<FileText size={14} className="text-yellow" />}>
          Alt Yüklenici Faturaları
          <CountPill>{subInvoices.length}</CountPill>
        </TabButton>
      </div>

      {tab === "owner-payments" && (
        <PaymentPlanTab
          projectId={project.id}
          milestones={milestones}
          subcontractors={subcontractors}
          projectBudget={project.totalBudget ?? 0}
          projectCurrency={project.budgetCurrency}
          projectStartDate={project.startDate}
          projectEndDate={project.contractEnd || project.plannedEnd}
          directionFilter="owner_incoming"
          contracts={ownerContracts}
        />
      )}
      {tab === "sub-payments" && (
        <PaymentPlanTab
          projectId={project.id}
          milestones={milestones}
          subcontractors={subcontractors}
          projectBudget={project.totalBudget ?? 0}
          projectCurrency={project.budgetCurrency}
          projectStartDate={project.startDate}
          projectEndDate={project.contractEnd || project.plannedEnd}
          directionFilter="subcontractor_outgoing"
          contracts={subContracts}
        />
      )}
      {tab === "owner" && (
        <OwnerInvoicesTab
          projectId={project.id}
          items={ownerInvoices}
          contracts={ownerContracts}
          milestones={milestones}
        />
      )}
      {tab === "subcontractor-invoices" && (
        <SubInvoicesTab
          projectId={project.id}
          items={subInvoices}
          subcontractors={subcontractors}
          milestones={milestones}
          contracts={subContracts}
        />
      )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        "inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap",
        active
          ? "bg-white text-text shadow-soft border border-border"
          : "text-text2 hover:text-text"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-md bg-bg3 text-text2 text-[11px] font-bold tabular-nums">
      {children}
    </span>
  );
}

// ============================================================
// TAB 1: İşveren Faturaları
// ============================================================
function OwnerInvoicesTab({
  projectId,
  items,
  contracts,
  milestones,
}: {
  projectId: string;
  items: BillingItem[];
  contracts: Record<Currency, number>;
  milestones: PaymentMilestone[];
}) {
  const add = useStore((s) => s.addBilling);
  const update = useStore((s) => s.updateBilling);
  const del = useStore((s) => s.deleteBilling);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BillingItem | null>(null);
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const totals = useMemo(() => {
    const m: Record<Currency, { issued: number; paid: number }> = {
      TRY: { issued: 0, paid: 0 },
      USD: { issued: 0, paid: 0 },
      EUR: { issued: 0, paid: 0 },
    };
    for (const it of items) {
      if (it.status === "iptal") continue;
      m[it.currency].issued += it.amount;
      // Bu faturaya bağlı tüm ödemeleri topla
      let paidForThis = 0;
      for (const ms of milestones) {
        for (const p of ms.payments ?? []) {
          if (p.billingItemId === it.id) paidForThis += p.amount;
        }
      }
      // Fallback: ödeme kaydı yokken manuel "odendi" işaretlenmişse
      if (paidForThis === 0 && it.status === "odendi") paidForThis = it.amount;
      m[it.currency].paid += paidForThis;
    }
    return m;
  }, [items, milestones]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 sm:max-w-lg">
        <InvoiceMultiCurrencyCard
          label="Faturalanan / Sözleşme"
          values={{
            TRY: totals.TRY.issued,
            USD: totals.USD.issued,
            EUR: totals.EUR.issued,
          }}
          denominators={contracts}
        />
        <InvoiceMultiCurrencyCard
          label="Tahsil / Faturalanan"
          values={{
            TRY: totals.TRY.paid,
            USD: totals.USD.paid,
            EUR: totals.EUR.paid,
          }}
          denominators={{
            TRY: totals.TRY.issued,
            USD: totals.USD.issued,
            EUR: totals.EUR.issued,
          }}
          valueClass="text-green"
        />
      </div>

      <div className="flex justify-between items-center mb-3">
        <p className="text-sm text-text2">İşverene kestiğiniz hakediş & faturalar</p>
        <Button variant="accent" onClick={() => setCreating(true)}>
          <Plus size={14} /> Yeni Fatura
        </Button>
      </div>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Fatura No</TH>
              <TH>Açıklama</TH>
              <TH className="text-right">Tutar</TH>
              <TH>Düzenleme</TH>
              <TH>Vade</TH>
              <TH>Ödendi</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {items.length === 0 ? (
              <Empty colSpan={8}>Henüz işveren faturası yok.</Empty>
            ) : (
              items.map((it) => {
                const effStatus = getEffectiveInvoiceStatus(it, milestones);
                const overdue = isInvoiceOverdue(it, effStatus, todayISO);
                return (
                <TR key={it.id} className={cn(overdue && "bg-red/5")}>
                  <TD className="font-mono text-xs text-text2">{it.invoiceNo || "—"}</TD>
                  <TD className="font-medium">{it.description}</TD>
                  <TD className="text-right font-mono font-semibold tabular-nums">
                    {formatMoney(it.amount, it.currency)}
                  </TD>
                  <TD className="text-xs text-text2">{formatDate(it.issueDate)}</TD>
                  <TD className={cn("text-xs", overdue ? "text-red font-bold" : "text-text2")}>
                    {it.dueDate ? formatDate(it.dueDate) : "—"}
                  </TD>
                  <TD className="text-xs text-text2">{it.paidDate ? formatDate(it.paidDate) : "—"}</TD>
                  <TD>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant={STATUS_VARIANT[effStatus]}>{STATUS_LABEL[effStatus]}</Badge>
                      {overdue && (
                        <Badge variant="red">
                          <AlertTriangle size={9} /> Gecikti
                        </Badge>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(it)} className="p-1 text-text3 hover:text-accent rounded">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirmAction({ title: "Kayıt silinsin mi?", message: "Bu işlem geri alınamaz.", danger: true, confirmText: "Sil" })) {
                            del(it.id);
                          }
                        }}
                        className="p-1 text-text3 hover:text-red rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </TD>
                </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>

      <InvoiceForm
        open={creating}
        title="Yeni İşveren Faturası"
        milestones={milestones}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          add({ ...data, projectId, direction: "owner_incoming" });
          setCreating(false);
        }}
      />
      <InvoiceForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        title="İşveren Faturası — Düzenle"
        milestones={milestones}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          update(editing.id, data);
          setEditing(null);
        }}
      />
    </>
  );
}

// ============================================================
// TAB 2: Alt Yüklenici Sözleşmeleri
// ============================================================
function SubcontractsTab({
  projectId,
  items,
}: {
  projectId: string;
  items: Subcontractor[];
}) {
  const billing = useStore((s) => s.billing);
  const update = useStore((s) => s.updateSubcontractor);
  const del = useStore((s) => s.deleteSubcontractor);

  const [editing, setEditing] = useState<Subcontractor | null>(null);

  const totals = useMemo(() => {
    const m: Record<Currency, { contract: number; invoiced: number; paid: number }> = {
      TRY: { contract: 0, invoiced: 0, paid: 0 },
      USD: { contract: 0, invoiced: 0, paid: 0 },
      EUR: { contract: 0, invoiced: 0, paid: 0 },
    };
    for (const s of items) {
      if (s.status === "iptal") continue;
      m[s.currency].contract += s.contractAmount;
    }
    for (const b of billing) {
      if (b.direction !== "subcontractor_outgoing") continue;
      if (b.projectId !== projectId) continue;
      if (b.status === "iptal") continue;
      m[b.currency].invoiced += b.amount;
      if (b.status === "odendi") m[b.currency].paid += b.amount;
    }
    return m;
  }, [items, billing, projectId]);

  function getProgress(scId: string, currency: Currency) {
    const sc = items.find((x) => x.id === scId);
    if (!sc) return { invoiced: 0, paid: 0, pct: 0 };
    const myBills = billing.filter(
      (b) =>
        b.direction === "subcontractor_outgoing" &&
        b.projectId === projectId &&
        b.subcontractorId === scId &&
        b.currency === currency &&
        b.status !== "iptal"
    );
    const invoiced = myBills.reduce((s, b) => s + b.amount, 0);
    const paid = myBills.filter((b) => b.status === "odendi").reduce((s, b) => s + b.amount, 0);
    return {
      invoiced,
      paid,
      pct: sc.contractAmount > 0 ? (invoiced / sc.contractAmount) * 100 : 0,
    };
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {(["TRY", "USD", "EUR"] as Currency[]).map((c) => (
          <Card key={c} className="!p-4">
            <div className="text-[10px] text-text3 uppercase font-bold tracking-wider mb-1">
              {c} Sözleşme Tutarı
            </div>
            <div className="font-mono text-xl font-bold text-text tabular-nums">
              {formatMoney(totals[c].contract, c)}
            </div>
            <div className="text-[11px] text-text3 mt-1">
              Faturalanan: <span className="font-mono">{formatMoney(totals[c].invoiced, c)}</span>
            </div>
            <div className="text-[11px] text-text3">
              Ödenen: <span className="font-mono text-green">{formatMoney(totals[c].paid, c)}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
        <p className="text-sm text-text2">Bu projedeki alt yüklenici sözleşmeleri (sadece görüntüleme)</p>
        <Link
          href="/master/subcontractors"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-accent/40 bg-accent/8 text-accent text-sm font-bold hover:bg-accent/15 transition-colors"
        >
          <Plus size={14} /> Master Data&apos;dan Sözleşme Ekle →
        </Link>
      </div>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Alt Yüklenici</TH>
              <TH>İş Kapsamı</TH>
              <TH>Disiplin</TH>
              <TH className="text-right">Sözleşme Tutarı</TH>
              <TH className="text-right">Faturalanan / İlerleme</TH>
              <TH>Tarih</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {items.length === 0 ? (
              <Empty colSpan={8}>Henüz alt yüklenici sözleşmesi yok.</Empty>
            ) : (
              items.map((s) => {
                const p = getProgress(s.id, s.currency);
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="font-semibold">{s.name}</div>
                      {s.contactName && <div className="text-[11px] text-text3">{s.contactName}</div>}
                    </TD>
                    <TD className="text-sm">{s.scopeOfWork}</TD>
                    <TD>{s.discipline && <Badge variant="blue">{s.discipline}</Badge>}</TD>
                    <TD className="text-right font-mono font-semibold tabular-nums">
                      {formatMoney(s.contractAmount, s.currency)}
                    </TD>
                    <TD className="text-right">
                      <div className="font-mono text-xs tabular-nums">
                        {formatMoney(p.invoiced, s.currency)}
                      </div>
                      <div className="h-1.5 bg-bg3 rounded-full overflow-hidden mt-1 w-32 ml-auto">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${Math.min(100, p.pct)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-text3 mt-0.5">{p.pct.toFixed(1)}%</div>
                    </TD>
                    <TD className="text-xs text-text2">
                      <div>{formatDate(s.contractDate)}</div>
                      {s.endDate && <div className="text-text3">→ {formatDate(s.endDate)}</div>}
                    </TD>
                    <TD>
                      <Badge variant={SC_STATUS_VARIANT[s.status]}>{SC_STATUS_LABEL[s.status]}</Badge>
                    </TD>
                    <TD>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditing(s)} className="p-1 text-text3 hover:text-accent rounded">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={async () => {
                            if (await confirmAction({
                              title: `${s.name} silinsin mi?`,
                              message: `Bu alt yüklenici ve TÜM faturaları silinecek. İşlem geri alınamaz.`,
                              danger: true,
                              confirmText: "Sil",
                            })) {
                              del(s.id);
                            }
                          }}
                          className="p-1 text-text3 hover:text-red rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>

      <SubcontractForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          update(editing.id, data);
          setEditing(null);
        }}
      />
    </>
  );
}

// ============================================================
// TAB 3: Alt Yüklenici Faturaları
// ============================================================
function SubInvoicesTab({
  projectId,
  items,
  subcontractors,
  milestones,
  contracts,
}: {
  projectId: string;
  items: BillingItem[];
  subcontractors: Subcontractor[];
  milestones: PaymentMilestone[];
  contracts: Record<Currency, number>;
}) {
  const add = useStore((s) => s.addBilling);
  const update = useStore((s) => s.updateBilling);
  const del = useStore((s) => s.deleteBilling);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BillingItem | null>(null);
  const [filterSc, setFilterSc] = useState<string>("");
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filtered = useMemo(
    () => (filterSc ? items.filter((i) => i.subcontractorId === filterSc) : items),
    [items, filterSc]
  );

  const totals = useMemo(() => {
    const m: Record<Currency, { received: number; paid: number }> = {
      TRY: { received: 0, paid: 0 },
      USD: { received: 0, paid: 0 },
      EUR: { received: 0, paid: 0 },
    };
    for (const it of items) {
      if (it.status === "iptal") continue;
      m[it.currency].received += it.amount;
      let paidForThis = 0;
      for (const ms of milestones) {
        for (const p of ms.payments ?? []) {
          if (p.billingItemId === it.id) paidForThis += p.amount;
        }
      }
      if (paidForThis === 0 && it.status === "odendi") paidForThis = it.amount;
      m[it.currency].paid += paidForThis;
    }
    return m;
  }, [items, milestones]);

  if (subcontractors.length === 0) {
    return (
      <Alert variant="warning">
        Önce <strong>Alt Yüklenici Sözleşmeleri</strong> sekmesinden bir alt yüklenici ekleyin.
        Fatura kaydı için alt yüklenici bilgisi gereklidir.
      </Alert>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 sm:max-w-lg">
        <InvoiceMultiCurrencyCard
          label="Gelen Fatura / Sözleşme"
          values={{
            TRY: totals.TRY.received,
            USD: totals.USD.received,
            EUR: totals.EUR.received,
          }}
          denominators={contracts}
        />
        <InvoiceMultiCurrencyCard
          label="Ödenen / Gelen Fatura"
          values={{
            TRY: totals.TRY.paid,
            USD: totals.USD.paid,
            EUR: totals.EUR.paid,
          }}
          denominators={{
            TRY: totals.TRY.received,
            USD: totals.USD.received,
            EUR: totals.EUR.received,
          }}
          valueClass="text-green"
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text3 font-semibold">Alt Yüklenici:</span>
          <Select
            value={filterSc}
            onChange={(e) => setFilterSc(e.target.value)}
            className="!h-9 !min-w-[200px] !py-0"
          >
            <option value="">Tümü</option>
            {subcontractors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="accent" onClick={() => setCreating(true)}>
          <Plus size={14} /> Yeni Fatura
        </Button>
      </div>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Fatura No</TH>
              <TH>Alt Yüklenici</TH>
              <TH>Açıklama</TH>
              <TH className="text-right">Tutar</TH>
              <TH>Düzenleme</TH>
              <TH>Vade</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={8}>Henüz alt yüklenici faturası yok.</Empty>
            ) : (
              filtered.map((it) => {
                const sc = subcontractors.find((s) => s.id === it.subcontractorId);
                const effStatus = getEffectiveInvoiceStatus(it, milestones);
                const overdue = isInvoiceOverdue(it, effStatus, todayISO);
                return (
                  <TR key={it.id} className={cn(overdue && "bg-red/5")}>
                    <TD className="font-mono text-xs text-text2">{it.invoiceNo || "—"}</TD>
                    <TD className="text-sm font-medium">{sc?.name ?? "—"}</TD>
                    <TD className="text-sm">{it.description}</TD>
                    <TD className="text-right font-mono font-semibold tabular-nums">
                      {formatMoney(it.amount, it.currency)}
                    </TD>
                    <TD className="text-xs text-text2">{formatDate(it.issueDate)}</TD>
                    <TD className={cn("text-xs", overdue ? "text-red font-bold" : "text-text2")}>
                      {it.dueDate ? formatDate(it.dueDate) : "—"}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant={STATUS_VARIANT[effStatus]}>{STATUS_LABEL[effStatus]}</Badge>
                        {overdue && (
                          <Badge variant="red">
                            <AlertTriangle size={9} /> Gecikti
                          </Badge>
                        )}
                      </div>
                    </TD>
                    <TD>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditing(it)} className="p-1 text-text3 hover:text-accent rounded">
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Silinsin mi?")) del(it.id);
                          }}
                          className="p-1 text-text3 hover:text-red rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>

      <InvoiceForm
        open={creating}
        title="Yeni Alt Yüklenici Faturası"
        showSubcontractor
        subcontractors={subcontractors}
        milestones={milestones}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          add({ ...data, projectId, direction: "subcontractor_outgoing" });
          setCreating(false);
        }}
      />
      <InvoiceForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        title="Alt Yüklenici Faturası — Düzenle"
        showSubcontractor
        subcontractors={subcontractors}
        milestones={milestones}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          update(editing.id, data);
          setEditing(null);
        }}
      />
    </>
  );
}

// ============================================================
// Forms
// ============================================================
function InvoiceForm({
  open,
  title,
  initial,
  showSubcontractor,
  subcontractors,
  milestones,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: BillingItem;
  showSubcontractor?: boolean;
  subcontractors?: Subcontractor[];
  milestones?: PaymentMilestone[];
  onClose: () => void;
  onSubmit: (data: Omit<BillingItem, "id" | "projectId" | "direction">) => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "TRY");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [paidDate, setPaidDate] = useState(initial?.paidDate ?? "");
  const [status, setStatus] = useState<BillingItem["status"]>(initial?.status ?? "gonderildi");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [subcontractorId, setSubcontractorId] = useState(initial?.subcontractorId ?? "");

  const isEdit = !!initial;

  // Faturayla ilişkili olabilecek planlanmış hakedişler (iptal olanlar hariç).
  // Alt yüklenici modunda: seçili sub'a ait outgoing hakedişler
  // İşveren modunda: tüm owner_incoming hakedişler
  const subMilestoneInfo = useMemo(() => {
    if (!milestones) return [];
    if (showSubcontractor) {
      if (!subcontractorId) return [];
      return milestones
        .filter(
          (m) =>
            m.direction === "subcontractor_outgoing" &&
            m.subcontractorId === subcontractorId &&
            m.status !== "cancelled"
        )
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    }
    return milestones
      .filter((m) => m.direction === "owner_incoming" && m.status !== "cancelled")
      .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  }, [showSubcontractor, subcontractorId, milestones]);

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {showSubcontractor && (
          <Field label="Alt Yüklenici" className="sm:col-span-2">
            <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              <option value="">Seçin</option>
              {(subcontractors || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatMoney(s.contractAmount, s.currency)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {subMilestoneInfo.length > 0 && (
          <div className="sm:col-span-2 rounded-md bg-accent/5 border border-accent/30 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-accent mb-1.5 flex items-center gap-1">
              <CalendarCheck size={11} /> Planlı Hakediş Tarihleri
            </div>
            <div className="flex flex-col gap-0.5 text-xs">
              {subMilestoneInfo.map((m) => {
                const isRealized = m.status === "realized";
                const isPartial = m.status === "partial";
                // Tıklayınca prefill edilecek tutar:
                // - realized: actualAmount (ödenmiş kadar fatura)
                // - partial: kalan (plan - alınan)
                // - planned: tam plan tutarı
                const prefillAmount = isRealized
                  ? m.actualAmount ?? m.plannedAmount
                  : isPartial
                  ? Math.max(0, m.plannedAmount - (m.actualAmount ?? 0))
                  : m.plannedAmount;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setIssueDate(m.plannedDate);
                      if (!isEdit) {
                        setAmount(prefillAmount);
                        setCurrency(m.currency);
                        if (!description) setDescription(m.description);
                      }
                    }}
                    className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-accent/10 text-left"
                    title="Bu hakedişten tarih/tutar/açıklamayı al"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-text2">{formatDate(m.plannedDate)}</span>
                      <span className="text-text truncate">— {m.description}</span>
                      {isPartial && <Badge variant="blue">Kısmi</Badge>}
                      {isRealized && <Badge variant="green">Ödendi</Badge>}
                    </span>
                    <span className="font-mono text-text font-semibold whitespace-nowrap">
                      {formatMoney(m.plannedAmount, m.currency, 0)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-text3 mt-1">
              Bir satıra tıklayarak tarih, tutar ve açıklamayı bu hakedişten doldurabilirsin.
            </div>
          </div>
        )}
        <Field label="Fatura No" className={isEdit ? undefined : "sm:col-span-2"}>
          <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </Field>
        {isEdit && (
          <Field label="Durum">
            <Select value={status} onChange={(e) => setStatus(e.target.value as BillingItem["status"])}>
              {status === "taslak" && <option value="taslak">Taslak</option>}
              <option value="gonderildi">Beklemede (Ödenmedi)</option>
              <option value="kismi">Kısmi Ödendi</option>
              <option value="odendi">Ödendi</option>
              <option value="iptal">İptal</option>
            </Select>
          </Field>
        )}
        <Field label="Açıklama" className="sm:col-span-2">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hakediş No.1 — Şubat 2026"
          />
        </Field>
        <Field label="Tutar">
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              className="flex-1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
            />
            <Select className="w-24" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </div>
        </Field>
        <Field label="Düzenleme Tarihi">
          <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </Field>
        <Field label="Vade">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Notlar" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() => {
            if (showSubcontractor && !subcontractorId) {
              alert("Alt yüklenici seçin");
              return;
            }
            onSubmit({
              invoiceNo: invoiceNo || undefined,
              description,
              amount,
              currency,
              issueDate,
              dueDate: dueDate || undefined,
              paidDate: paidDate || undefined,
              status,
              notes: notes || undefined,
              subcontractorId: showSubcontractor ? subcontractorId : undefined,
            });
          }}
        >
          Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

function SubcontractForm({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial?: Subcontractor;
  onClose: () => void;
  onSubmit: (data: Omit<Subcontractor, "id" | "projectId" | "createdAt" | "updatedAt">) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [taxNo, setTaxNo] = useState(initial?.taxNo ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(initial?.scopeOfWork ?? "");
  const [discipline, setDiscipline] = useState<Discipline | "">(initial?.discipline ?? "");
  const [contractAmount, setContractAmount] = useState(initial?.contractAmount ?? 0);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "TRY");
  const [contractDate, setContractDate] = useState(initial?.contractDate ?? new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [status, setStatus] = useState<Subcontractor["status"]>(initial?.status ?? "aktif");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Alt Yüklenici — Düzenle" : "Yeni Alt Yüklenici"} size="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Firma Adı" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="X İnşaat Ltd. Şti." />
        </Field>
        <Field label="Vergi No">
          <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
        </Field>
        <Field label="Yetkili">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="E-posta">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="İş Kapsamı" className="sm:col-span-2">
          <Input
            value={scopeOfWork}
            onChange={(e) => setScopeOfWork(e.target.value)}
            placeholder="Taşıyıcı sistem montajı"
          />
        </Field>
        <Field label="Disiplin">
          <Select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)}>
            <option value="">—</option>
            <option value="mekanik">Mekanik</option>
            <option value="elektrik">Elektrik</option>
            <option value="insaat">İnşaat</option>
            <option value="muhendislik">Mühendislik</option>
            <option value="idari">İdari</option>
            <option value="diger">Diğer</option>
          </Select>
        </Field>
        <Field label="Sözleşme Tutarı">
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.01"
              className="flex-1"
              value={contractAmount}
              onChange={(e) => setContractAmount(Number(e.target.value) || 0)}
            />
            <Select className="w-24" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </div>
        </Field>
        <Field label="Sözleşme Tarihi">
          <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
        </Field>
        <Field label="Başlama">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Bitiş">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Subcontractor["status"])}>
            <option value="aktif">Aktif</option>
            <option value="askida">Askıda</option>
            <option value="tamamlandi">Tamamlandı</option>
            <option value="iptal">İptal</option>
          </Select>
        </Field>
        <Field label="Notlar" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() =>
            onSubmit({
              name,
              taxNo: taxNo || undefined,
              contactName: contactName || undefined,
              phone: phone || undefined,
              email: email || undefined,
              scopeOfWork,
              discipline: (discipline || undefined) as Discipline | undefined,
              contractAmount,
              currency,
              contractDate,
              startDate: startDate || undefined,
              endDate: endDate || undefined,
              status,
              notes: notes || undefined,
            })
          }
        >
          Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ============================================================
// TAB 4: Hakediş Planı
// ============================================================

const MS_STATUS_LABEL: Record<PaymentMilestoneStatus, string> = {
  planned: "Planlandı",
  realized: "Gerçekleşti",
  partial: "Kısmi",
  cancelled: "İptal",
};
const MS_STATUS_VARIANT: Record<PaymentMilestoneStatus, "yellow" | "green" | "blue" | "red"> = {
  planned: "yellow",
  realized: "green",
  partial: "blue",
  cancelled: "red",
};

function isMilestoneOverdue(m: PaymentMilestone, todayISO: string): boolean {
  // Tamamen ödenmiş veya iptal edilmişler gecikmiş sayılmaz.
  // "Kısmi" durumda bile kalan tutar varsa ve tarih geçmişse gecikme sayılır.
  if (m.status === "realized" || m.status === "cancelled") return false;
  return m.plannedDate < todayISO;
}

function PaymentPlanTab({
  projectId,
  milestones,
  subcontractors,
  projectBudget,
  projectCurrency,
  projectStartDate,
  projectEndDate,
  directionFilter,
  contracts,
}: {
  projectId: string;
  milestones: PaymentMilestone[];
  subcontractors: Subcontractor[];
  projectBudget: number;
  projectCurrency: Currency;
  projectStartDate: string;
  projectEndDate: string;
  directionFilter: BillingDirection;
  contracts: Record<Currency, number>;
}) {
  const showOwner = directionFilter === "owner_incoming";
  const showSub = directionFilter === "subcontractor_outgoing";
  const add = useStore((s) => s.addPaymentMilestone);
  const update = useStore((s) => s.updatePaymentMilestone);
  const del = useStore((s) => s.deletePaymentMilestone);
  const setMilestonePayments = useStore((s) => s.setMilestonePayments);
  const projectBilling = useStore((s) => s.billing).filter((b) => b.projectId === projectId);

  const [scFilter, setScFilter] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMilestone | null>(null);
  const [realizing, setRealizing] = useState<PaymentMilestone | null>(null);
  // Yeni hakediş eklerken default tip — bu sekmenin direction'ı
  const [createDirection, setCreateDirection] = useState<BillingDirection>(directionFilter);

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const horizon30 = useMemo(() => toISODate(addDays(new Date(), 30)), []);

  // İşveren hakedişleri — tarih sırasında
  const ownerMilestones = useMemo(
    () =>
      milestones
        .filter((m) => m.direction === "owner_incoming")
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
    [milestones]
  );

  // Alt yüklenici hakedişleri — firma başına ayrılarak render'da gruplanıyor
  const subMilestones = useMemo(
    () =>
      milestones
        .filter((m) => m.direction === "subcontractor_outgoing")
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
    [milestones]
  );

  // Yön bazlı özet hesabı
  const computeSummary = (list: PaymentMilestone[]) => {
    const m: Record<Currency, { planned: number; realized: number }> = {
      TRY: { planned: 0, realized: 0 },
      USD: { planned: 0, realized: 0 },
      EUR: { planned: 0, realized: 0 },
    };
    let overdueCount = 0;
    let upcomingCount = 0;
    let activeCount = 0;
    for (const it of list) {
      if (it.status === "cancelled") continue;
      activeCount++;
      m[it.currency].planned += it.plannedAmount;
      m[it.currency].realized += it.actualAmount ?? 0;
      if (isMilestoneOverdue(it, todayISO)) overdueCount++;
      const isUnpaid = it.status === "planned" || it.status === "partial";
      if (isUnpaid && it.plannedDate >= todayISO && it.plannedDate <= horizon30) {
        upcomingCount++;
      }
    }
    return { m, overdueCount, upcomingCount, activeCount };
  };

  const ownerSummary = useMemo(
    () => computeSummary(milestones.filter((m) => m.direction === "owner_incoming")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [milestones, todayISO, horizon30]
  );
  const subSummary = useMemo(
    () =>
      computeSummary(milestones.filter((m) => m.direction === "subcontractor_outgoing")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [milestones, todayISO, horizon30]
  );

  // Faturasız ödeme sayısı + toplam tutar (sadece bu sekmenin yönü)
  const uninvoicedStats = useMemo(() => {
    let count = 0;
    const byCurrency: Record<Currency, number> = { TRY: 0, USD: 0, EUR: 0 };
    for (const m of milestones) {
      if (m.direction !== directionFilter) continue;
      for (const p of m.payments ?? []) {
        if (!p.billingItemId) {
          count++;
          byCurrency[m.currency] += p.amount;
        }
      }
    }
    return { count, byCurrency };
  }, [milestones, directionFilter]);

  // Akkordiyon — ilk gecikmiş firmayı açık başlat (yoksa hepsi kapalı)
  const firstOverdueSubIdx = useMemo(() => {
    return subcontractors
      .filter((sc) => sc.status !== "iptal")
      .findIndex((sc) =>
        milestones.some(
          (m) =>
            m.direction === "subcontractor_outgoing" &&
            m.subcontractorId === sc.id &&
            isMilestoneOverdue(m, todayISO)
        )
      );
  }, [subcontractors, milestones, todayISO]);

  // İşveren plan kapsama (proje bütçesi referans)
  const ownerCoverage = useMemo(() => {
    const sameCurrency = ownerMilestones.filter(
      (m) => m.status !== "cancelled" && m.currency === projectCurrency
    );
    const planned = sameCurrency.reduce((s, m) => s + m.plannedAmount, 0);
    const realized = sameCurrency.reduce((s, m) => s + (m.actualAmount ?? 0), 0);
    const otherCurrency = ownerMilestones.some(
      (m) => m.status !== "cancelled" && m.currency !== projectCurrency
    );
    return {
      planned,
      realized,
      total: projectBudget,
      pct: projectBudget > 0 ? (planned / projectBudget) * 100 : 0,
      realizedPct: projectBudget > 0 ? (realized / projectBudget) * 100 : 0,
      otherCurrency,
    };
  }, [ownerMilestones, projectBudget, projectCurrency]);

  // Alt yüklenici plan kapsama (her sözleşme için)
  const subCoverages = useMemo(() => {
    return subcontractors
      .filter((sc) => sc.status !== "iptal")
      .map((sc) => {
        const myMs = milestones.filter(
          (m) =>
            m.direction === "subcontractor_outgoing" &&
            m.subcontractorId === sc.id &&
            m.status !== "cancelled"
        );
        const sameCurrency = myMs.filter((m) => m.currency === sc.currency);
        const planned = sameCurrency.reduce((s, m) => s + m.plannedAmount, 0);
        const realized = sameCurrency.reduce((s, m) => s + (m.actualAmount ?? 0), 0);
        const otherCurrency = myMs.some((m) => m.currency !== sc.currency);
        return {
          sc,
          planned,
          realized,
          total: sc.contractAmount,
          pct: sc.contractAmount > 0 ? (planned / sc.contractAmount) * 100 : 0,
          realizedPct: sc.contractAmount > 0 ? (realized / sc.contractAmount) * 100 : 0,
          count: myMs.length,
          otherCurrency,
        };
      });
  }, [subcontractors, milestones]);

  // Belirli direction + sözleşme bağlamı için "Sözleşme Tutarı" (referans değer)
  function getContextTotal(m: PaymentMilestone): { amount: number; currency: Currency } {
    if (m.direction === "owner_incoming") {
      return { amount: projectBudget, currency: projectCurrency };
    }
    const sc = subcontractors.find((s) => s.id === m.subcontractorId);
    return { amount: sc?.contractAmount ?? 0, currency: sc?.currency ?? projectCurrency };
  }

  // Yeni hakediş için varsayılan değerler
  function nextSequenceNo(direction: BillingDirection, subcontractorId?: string): number {
    const peers = milestones.filter(
      (m) => m.direction === direction && (direction === "owner_incoming" || m.subcontractorId === subcontractorId)
    );
    if (peers.length === 0) return 1;
    return Math.max(...peers.map((p) => p.sequenceNo)) + 1;
  }

  function openCreate(dir: BillingDirection) {
    setCreateDirection(dir);
    setCreating(true);
  }

  return (
    <>
      {/* FATURASIZ ÖDEME UYARISI */}
      {uninvoicedStats.count > 0 && (
        <div className="mb-4 rounded-lg border border-yellow/40 bg-yellow/8 px-3.5 py-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-yellow shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-text">
                Faturasız ödeme var · Dikkat: muhasebeye haber verin
              </div>
              <div className="text-xs text-text2 mt-0.5">
                <span className="font-bold">{uninvoicedStats.count}</span> ödeme faturaya
                bağlanmamış:{" "}
                {(Object.keys(uninvoicedStats.byCurrency) as Currency[])
                  .filter((c) => uninvoicedStats.byCurrency[c] > 0)
                  .map((c) => (
                    <span key={c} className="font-mono font-bold text-yellow mr-2">
                      {formatMoney(uninvoicedStats.byCurrency[c], c, 0)}
                    </span>
                  ))}
                · Hakediş kartlarındaki <strong>⚠ Faturasız</strong> etiketli satırlar fatura
                eklenip ödeme bağlandığında düzelir.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY — sadece bu sekmenin yönü */}
      <div className="mb-4">
        {showOwner ? (
          <SummaryRow
            icon={<Building2 size={14} className="text-blue" />}
            label="İşveren"
            summary={ownerSummary}
            currency={projectCurrency}
            contracts={contracts}
          />
        ) : (
          <SummaryRow
            icon={<Users2 size={14} className="text-yellow" />}
            label="Alt Yüklenici"
            summary={subSummary}
            currency={projectCurrency}
            contracts={contracts}
          />
        )}
      </div>

      {/* GENEL AKSİYONLAR */}
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setGenOpen(true)}>
          <Wand2 size={13} /> Hızlı Plan
        </Button>
        <Button variant="accent" onClick={() => openCreate(directionFilter)}>
          <Plus size={14} /> Hakediş Planla
        </Button>
      </div>

      {/* ═════════ İŞVEREN HAKEDİŞLERİ ═════════ */}
      {showOwner && (
      <>
      <div className="text-[11px] text-text3 mb-3 flex items-center flex-wrap gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm border-2 border-navy" />
          Açık (seçili) — kalın lacivert
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm border-2 border-red" />
          Gecikmiş varsa kırmızı vurgulanır (seçili olsa da kırmızı kalır)
        </span>
      </div>
      <details
        open
        className={cn(
          "group rounded-xl border bg-white mb-3 overflow-hidden shadow-soft",
          ownerSummary.overdueCount > 0
            ? "border-red/40 open:border-4 open:border-red open:ring-8 open:ring-red/30 open:shadow-large"
            : "border-border open:border-4 open:border-navy open:ring-8 open:ring-navy/25 open:shadow-large"
        )}
      >
        <summary className="cursor-pointer list-none">
          <div className="px-3 py-2 flex items-center gap-2">
            <ChevronDown
              size={14}
              className="text-text3 transition-transform group-open:rotate-180 shrink-0"
            />
            <Building2 size={14} className="text-blue shrink-0" />
            <h3 className="font-display font-bold text-sm text-text">İşveren Hakedişleri</h3>
            <Badge variant="gray">{ownerMilestones.length}</Badge>
            <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" onClick={() => openCreate("owner_incoming")}>
                <Plus size={12} /> Ekle
              </Button>
            </div>
          </div>
          <div className="px-3 pb-2">
            <CoverageBar
              label={`Plan Kapsama${ownerCoverage.otherCurrency ? " · Farklı para birimi var" : ""}`}
              planned={ownerCoverage.planned}
              realized={ownerCoverage.realized}
              total={ownerCoverage.total}
              pct={ownerCoverage.pct}
              realizedPct={ownerCoverage.realizedPct}
              currency={projectCurrency}
              compact
            />
          </div>
        </summary>
        <div className="border-t border-border">
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>#</TH>
                  <TH>Açıklama</TH>
                  <TH>Planlanan Tarih</TH>
                  <TH className="text-right">Planlanan Tutar</TH>
                  <TH className="text-right">%</TH>
                  <TH>Durum</TH>
                  <TH>Gerçekleşen</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {ownerMilestones.length === 0 ? (
                  <Empty colSpan={8}>
                    Henüz işveren hakediş planı yok. <strong>Ekle</strong> veya{" "}
                    <strong>Hızlı Plan</strong> ile oluşturun.
                  </Empty>
                ) : (
                  ownerMilestones.map((m) => (
                    <MilestoneRow
                      key={m.id}
                      m={m}
                      context={getContextTotal(m)}
                      todayISO={todayISO}
                      onRealize={() => setRealizing(m)}
                      onEdit={() => setEditing(m)}
                      onDelete={async () => {
                        if (await confirmAction({ title: "Hakediş silinsin mi?", message: "Bu hakediş kaydı silinecek. Bağlı ödemeler de silinir.", danger: true, confirmText: "Sil" })) {
                          del(m.id);
                        }
                      }}
                    />
                  ))
                )}
              </TBody>
            </Table>
          </TableWrap>
        </div>
      </details>
      </>
      )}

      {/* ═════════ ALT YÜKLENİCİ HAKEDİŞLERİ — firma başına bir kart ═════════ */}
      {showSub && (
        subcontractors.length === 0 ? (
          <Alert variant="info">
            Önce <strong>Master Data → Alt Yüklenici</strong> sayfasından alt yüklenici ekleyin.
          </Alert>
        ) : (
          <>
            <div className="text-[11px] text-text3 mb-3 flex items-center flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm border-2 border-navy" />
                Seçili firma — kalın lacivert
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm border-2 border-red" />
                Gecikmiş firma kırmızı vurgulanır (seçilse de kırmızı kalır)
              </span>
            </div>
            <div className="space-y-8">
            {subCoverages.map((c, idx) => {
              const myMilestones = subMilestones.filter((m) => m.subcontractorId === c.sc.id);
              const hasOverdue = myMilestones.some((m) => isMilestoneOverdue(m, todayISO));
              const overdueCount = myMilestones.filter((m) => isMilestoneOverdue(m, todayISO)).length;
              // Sonraki ödeme — geçmişteki gecikmiş varsa onu, yoksa en yakın geleceği seç
              const planned = myMilestones
                .filter((m) => m.status === "planned" || m.status === "partial")
                .slice()
                .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
              const next = planned[0];
              const nextOverdue = next ? next.plannedDate < todayISO : false;
              const nextDays = next ? daysBetween(todayISO, next.plannedDate) : 0;
              const realizedPct = c.planned > 0 ? (c.realized / c.planned) * 100 : 0;
              const uninvoicedCount = myMilestones.reduce(
                (sum, m) =>
                  sum + (m.payments?.filter((p) => !p.billingItemId).length ?? 0),
                0
              );

              return (
                <details
                  key={c.sc.id}
                  name="sub-payments-accordion"
                  open={idx === firstOverdueSubIdx}
                  className={cn(
                    "group rounded-xl border bg-white overflow-hidden shadow-soft hover:shadow-medium",
                    hasOverdue
                      ? "border-red/40 open:border-4 open:border-red open:ring-8 open:ring-red/30 open:shadow-large"
                      : "border-border open:border-4 open:border-navy open:ring-8 open:ring-navy/25 open:shadow-large"
                  )}
                >
                  <summary className="cursor-pointer list-none">
                    {/* HEADER — numara + firma adı + aksiyonlar */}
                    <div className="p-3.5 flex items-start gap-3">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl font-display font-extrabold text-xl flex items-center justify-center shrink-0 tabular-nums",
                          hasOverdue ? "bg-red/10 text-red" : "bg-yellow/15 text-yellow"
                        )}
                      >
                        {idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h4 className="font-display font-bold text-base text-text truncate">
                            {c.sc.name}
                          </h4>
                          {c.sc.discipline && <Badge variant="blue">{c.sc.discipline}</Badge>}
                          <Badge variant="gray">{c.count} hakediş</Badge>
                          {hasOverdue && (
                            <Badge variant="red">
                              <AlertTriangle size={9} /> {overdueCount} gecikmiş
                            </Badge>
                          )}
                          {uninvoicedCount > 0 && (
                            <Badge variant="yellow">
                              <AlertTriangle size={9} /> {uninvoicedCount} faturasız ödeme
                            </Badge>
                          )}
                        </div>
                        {c.sc.scopeOfWork && (
                          <div className="text-xs text-text3 truncate">{c.sc.scopeOfWork}</div>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCreateDirection("subcontractor_outgoing");
                            setScFilter(c.sc.id);
                            setCreating(true);
                          }}
                        >
                          <Plus size={12} /> Ekle
                        </Button>
                      </div>

                      <ChevronDown
                        size={16}
                        className="text-text3 transition-transform group-open:rotate-180 shrink-0 mt-3.5"
                      />
                    </div>

                    {/* MINI STATS */}
                    {myMilestones.length > 0 && (
                      <div className="px-3.5 pb-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <StatPill label="Planlanan" value={formatMoney(c.planned, c.sc.currency, 0)} />
                        <StatPill
                          label="Gerçekleşen"
                          value={formatMoney(c.realized, c.sc.currency, 0)}
                          sub={c.planned > 0 ? `%${realizedPct.toFixed(0)}` : "—"}
                          valueClass="text-green"
                        />
                        <StatPill
                          label="Sonraki Ödeme"
                          value={next ? formatDate(next.plannedDate) : "—"}
                          sub={
                            !next
                              ? "—"
                              : nextOverdue
                              ? `${Math.abs(nextDays)} gün gecikti`
                              : nextDays === 0
                              ? "bugün"
                              : `${nextDays} gün sonra`
                          }
                          valueClass={
                            !next
                              ? "text-text3"
                              : nextOverdue
                              ? "text-red"
                              : nextDays <= 3
                              ? "text-red"
                              : nextDays <= 7
                              ? "text-yellow"
                              : "text-accent"
                          }
                        />
                        <StatPill
                          label="Sözleşme"
                          value={formatMoney(c.total, c.sc.currency, 0)}
                        />
                      </div>
                    )}

                    {/* COVERAGE BAR */}
                    <div className="px-3.5 pb-3">
                      <CoverageBar
                        label={`Plan Kapsama${c.otherCurrency ? " · Farklı para birimi var" : ""}`}
                        planned={c.planned}
                        realized={c.realized}
                        total={c.total}
                        pct={c.pct}
                        realizedPct={c.realizedPct}
                        currency={c.sc.currency}
                        compact
                      />
                    </div>
                  </summary>

                  <div className="border-t border-border bg-bg2/30">
                    <TableWrap>
                      <Table>
                        <THead>
                          <TR>
                            <TH>#</TH>
                            <TH>Açıklama</TH>
                            <TH>Planlanan Tarih</TH>
                            <TH className="text-right">Planlanan Tutar</TH>
                            <TH className="text-right">%</TH>
                            <TH>Durum</TH>
                            <TH>Gerçekleşen</TH>
                            <TH></TH>
                          </TR>
                        </THead>
                        <TBody>
                          {myMilestones.length === 0 ? (
                            <Empty colSpan={8}>
                              Bu firma için henüz hakediş planı yok.{" "}
                              <strong>Ekle</strong> butonuyla başlayabilirsin.
                            </Empty>
                          ) : (
                            myMilestones.map((m) => (
                              <MilestoneRow
                                key={m.id}
                                m={m}
                                context={getContextTotal(m)}
                                todayISO={todayISO}
                                onRealize={() => setRealizing(m)}
                                onEdit={() => setEditing(m)}
                                onDelete={() => {
                                  if (confirm("Silinsin mi?")) del(m.id);
                                }}
                              />
                            ))
                          )}
                        </TBody>
                      </Table>
                    </TableWrap>
                  </div>
                </details>
              );
            })}
          </div>
          </>
        )
      )}

      {/* CREATE */}
      <MilestoneForm
        key={creating ? `create-${createDirection}-${scFilter}` : "create-closed"}
        open={creating}
        title="Hakediş Planla"
        subcontractors={subcontractors}
        projectBudget={projectBudget}
        projectCurrency={projectCurrency}
        defaultDirection={createDirection}
        defaultSubcontractorId={
          createDirection === "subcontractor_outgoing" ? scFilter || undefined : undefined
        }
        nextSequenceNo={nextSequenceNo}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          add({ ...data, projectId, status: "planned" });
          setCreating(false);
        }}
      />

      {/* EDIT */}
      <MilestoneForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        title="Hakediş — Düzenle"
        subcontractors={subcontractors}
        projectBudget={projectBudget}
        projectCurrency={projectCurrency}
        initial={editing || undefined}
        defaultDirection={editing?.direction ?? "owner_incoming"}
        defaultSubcontractorId={editing?.subcontractorId}
        nextSequenceNo={nextSequenceNo}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          update(editing.id, data);
          setEditing(null);
        }}
      />

      {/* REALIZE — ödeme defteri */}
      <RealizeForm
        key={realizing?.id ?? "realize-empty"}
        open={!!realizing}
        milestone={realizing}
        billingItems={projectBilling}
        onClose={() => setRealizing(null)}
        onSubmit={(payments, notes) => {
          if (!realizing) return;
          setMilestonePayments(realizing.id, payments, notes);
          setRealizing(null);
        }}
      />

      {/* QUICK PLAN GENERATOR */}
      <QuickPlanForm
        open={genOpen}
        subcontractors={subcontractors}
        projectBudget={projectBudget}
        projectCurrency={projectCurrency}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        onClose={() => setGenOpen(false)}
        onGenerate={(items) => {
          for (const it of items) add({ ...it, projectId, status: "planned" });
          setGenOpen(false);
        }}
      />
    </>
  );
}

function MilestoneForm({
  open,
  title,
  initial,
  subcontractors,
  projectBudget,
  projectCurrency,
  defaultDirection,
  defaultSubcontractorId,
  nextSequenceNo,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial?: PaymentMilestone;
  subcontractors: Subcontractor[];
  projectBudget: number;
  projectCurrency: Currency;
  defaultDirection: BillingDirection;
  defaultSubcontractorId?: string;
  nextSequenceNo: (direction: BillingDirection, subcontractorId?: string) => number;
  onClose: () => void;
  onSubmit: (
    data: Omit<PaymentMilestone, "id" | "projectId" | "createdAt" | "updatedAt" | "status"> & {
      status?: PaymentMilestoneStatus;
    }
  ) => void;
}) {
  const [direction, setDirection] = useState<BillingDirection>(initial?.direction ?? defaultDirection);
  const [subcontractorId, setSubcontractorId] = useState<string>(
    initial?.subcontractorId ?? defaultSubcontractorId ?? ""
  );
  const [sequenceNo, setSequenceNo] = useState<number>(
    initial?.sequenceNo ?? nextSequenceNo(defaultDirection, defaultSubcontractorId)
  );
  const [description, setDescription] = useState(initial?.description ?? `Hakediş No.${sequenceNo}`);
  const [plannedDate, setPlannedDate] = useState(initial?.plannedDate ?? toISODate(new Date()));
  const [plannedAmount, setPlannedAmount] = useState<number>(initial?.plannedAmount ?? 0);
  const [amountStr, setAmountStr] = useState<string>(String(initial?.plannedAmount ?? 0));
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? projectCurrency);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Bağlam toplamı (yüzde dönüşümü için referans)
  const contextTotal = useMemo<{ amount: number; currency: Currency; label: string }>(() => {
    if (direction === "owner_incoming") {
      return { amount: projectBudget, currency: projectCurrency, label: "Proje bütçesi" };
    }
    const sc = subcontractors.find((s) => s.id === subcontractorId);
    if (sc) return { amount: sc.contractAmount, currency: sc.currency, label: `${sc.name} sözleşmesi` };
    return { amount: 0, currency: projectCurrency, label: "—" };
  }, [direction, subcontractorId, subcontractors, projectBudget, projectCurrency]);

  const [pctStr, setPctStr] = useState<string>(() =>
    contextTotal.amount > 0
      ? (((initial?.plannedAmount ?? 0) / contextTotal.amount) * 100).toFixed(2)
      : ""
  );

  // Bağlam değiştiğinde % değerini tutardan yeniden türet
  // (kullanıcı direction veya subcontractor değiştirirse rakam aynı kalır, oran güncellenir)
  function recalcPctFromAmount(amount: number, total: number) {
    if (total > 0) setPctStr(((amount / total) * 100).toFixed(2));
    else setPctStr("");
  }

  function onAmountChange(s: string) {
    setAmountStr(s);
    const num = Number(s);
    if (!isNaN(num)) {
      setPlannedAmount(num);
      recalcPctFromAmount(num, contextTotal.amount);
    }
  }

  function onPctChange(s: string) {
    setPctStr(s);
    const num = Number(s);
    if (!isNaN(num) && contextTotal.amount > 0) {
      const amt = Math.round((num / 100) * contextTotal.amount * 100) / 100;
      setPlannedAmount(amt);
      setAmountStr(String(amt));
    }
  }

  // Direction/subcontractor değişince currency + % yeniden hesapla
  function syncCurrencyFor(dir: BillingDirection, scId: string) {
    let newTotal = 0;
    if (dir === "subcontractor_outgoing") {
      const sc = subcontractors.find((s) => s.id === scId);
      if (sc) {
        newTotal = sc.contractAmount;
        if (!initial) setCurrency(sc.currency);
      }
    } else {
      newTotal = projectBudget;
      if (!initial) setCurrency(projectCurrency);
    }
    recalcPctFromAmount(plannedAmount, newTotal);
  }

  const pctNum = Number(pctStr) || 0;
  const pctWarning = contextTotal.amount > 0 && pctNum > 100;

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tip">
          <Select
            value={direction}
            onChange={(e) => {
              const d = e.target.value as BillingDirection;
              setDirection(d);
              syncCurrencyFor(d, subcontractorId);
              if (!initial) setSequenceNo(nextSequenceNo(d, subcontractorId));
            }}
            disabled={!!initial}
          >
            <option value="owner_incoming">İşverenden Alacak</option>
            <option value="subcontractor_outgoing">Alt Yükleniciye Ödeme</option>
          </Select>
        </Field>
        {direction === "subcontractor_outgoing" && (
          <Field label="Alt Yüklenici">
            <Select
              value={subcontractorId}
              onChange={(e) => {
                const v = e.target.value;
                setSubcontractorId(v);
                syncCurrencyFor("subcontractor_outgoing", v);
                if (!initial) setSequenceNo(nextSequenceNo("subcontractor_outgoing", v));
              }}
              disabled={!!initial}
            >
              <option value="">Seçin</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatMoney(s.contractAmount, s.currency)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Açıklama" className="sm:col-span-2">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Hakediş No.1 — Mart 2026"
          />
        </Field>
        <Field label="Planlanan Tarih">
          <Input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </Field>
        <Field label="Para Birimi">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Planlanan Tutar">
              <Input
                type="number"
                step="0.01"
                value={amountStr}
                onChange={(e) => onAmountChange(e.target.value)}
              />
            </Field>
            <Field label={`Yüzde (% / ${contextTotal.label})`}>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={pctStr}
                  onChange={(e) => onPctChange(e.target.value)}
                  disabled={contextTotal.amount === 0}
                  placeholder={contextTotal.amount === 0 ? "Sözleşme tutarı yok" : "örn. 10"}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 text-sm font-mono pointer-events-none">
                  %
                </span>
              </div>
            </Field>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-text3">
            {contextTotal.amount > 0 ? (
              <>
                <span>
                  {contextTotal.label}:{" "}
                  <span className="font-mono text-text">
                    {formatMoney(contextTotal.amount, contextTotal.currency)}
                  </span>
                </span>
                {currency !== contextTotal.currency && (
                  <span className="text-yellow font-semibold">
                    ⚠ Hakediş para birimi sözleşmeden farklı — %&apos;lik referans yine sözleşme tutarı.
                  </span>
                )}
                {pctWarning && (
                  <span className="text-red font-semibold">⚠ Sözleşme tutarını aştın (%{pctNum.toFixed(1)})</span>
                )}
              </>
            ) : (
              <span>Yüzde girişi için sözleşme/bütçe tutarı tanımlanmalı.</span>
            )}
          </div>
        </div>
        <Field label="Notlar" className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() => {
            if (direction === "subcontractor_outgoing" && !subcontractorId) {
              alert("Alt yüklenici seçin");
              return;
            }
            if (!description.trim() || plannedAmount <= 0) {
              alert("Açıklama ve tutar gerekli");
              return;
            }
            onSubmit({
              direction,
              subcontractorId: direction === "subcontractor_outgoing" ? subcontractorId : undefined,
              sequenceNo,
              description: description.trim(),
              plannedDate,
              plannedAmount,
              currency,
              notes: notes || undefined,
            });
          }}
        >
          Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// Eski (legacy) tek-girişli kayıtları ledger'a normalize et
function getEffectivePayments(m: PaymentMilestone): PaymentEntry[] {
  if (m.payments && m.payments.length > 0) return m.payments;
  if ((m.actualAmount ?? 0) > 0 && m.actualDate) {
    return [
      {
        id: `${m.id}-legacy`,
        date: m.actualDate,
        amount: m.actualAmount ?? 0,
        recordedAt: m.updatedAt,
      },
    ];
  }
  return [];
}

function RealizeForm({
  open,
  milestone,
  billingItems,
  onClose,
  onSubmit,
}: {
  open: boolean;
  milestone: PaymentMilestone | null;
  billingItems: BillingItem[];
  onClose: () => void;
  onSubmit: (payments: PaymentEntry[], notes?: string) => void;
}) {
  const initial = useMemo(() => (milestone ? getEffectivePayments(milestone) : []), [milestone]);
  const [payments, setPayments] = useState<PaymentEntry[]>(initial);
  const [notes, setNotes] = useState(milestone?.notes ?? "");

  const [newDate, setNewDate] = useState(toISODate(new Date()));
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newBillingId, setNewBillingId] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);

  // Bu hakedişe uygun faturalar — aynı yön + alt yüklenici, iptal değil, aynı para birimi
  const eligibleInvoices = useMemo(() => {
    if (!milestone) return [] as BillingItem[];
    return billingItems
      .filter(
        (b) =>
          b.direction === milestone.direction &&
          b.status !== "iptal" &&
          b.currency === milestone.currency &&
          (milestone.direction !== "subcontractor_outgoing" ||
            b.subcontractorId === milestone.subcontractorId)
      )
      .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  }, [billingItems, milestone]);

  if (!milestone) return null;

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, milestone.plannedAmount - total);
  const isPartial = total > 0 && total < milestone.plannedAmount - 0.005;
  const isOverage = total > milestone.plannedAmount + 0.005;
  const isComplete = !isPartial && !isOverage && total > 0;
  const hasNoInvoices = eligibleInvoices.length === 0;

  function pickInvoice(id: string) {
    setNewBillingId(id);
    if (!id) return;
    const inv = eligibleInvoices.find((b) => b.id === id);
    if (inv) {
      setNewAmount(inv.amount);
      // Vade tarihi varsa onu, yoksa düzenleme tarihini öner; ama çoğunlukla bugün ödenir
      // Kullanıcı isterse değiştirsin — varsayılan bugün kalsın
    }
  }

  function addPayment() {
    if (newAmount <= 0) {
      alert("Tutar 0'dan büyük olmalı");
      return;
    }
    setPayments((prev) =>
      [
        ...prev,
        {
          id: uid(),
          date: newDate,
          amount: newAmount,
          billingItemId: newBillingId || undefined,
          recordedAt: new Date().toISOString(),
        },
      ].sort((a, b) => a.date.localeCompare(b.date))
    );
    // Sonraki ödeme için reset + paneli kapat
    setNewDate(toISODate(new Date()));
    setNewAmount(Math.max(0, remaining - newAmount));
    setNewBillingId("");
    setAddOpen(false);
  }

  function openAddPanel() {
    // Açılırken default değerleri prefill et
    setNewDate(toISODate(new Date()));
    setNewAmount(remaining > 0 ? remaining : 0);
    setNewBillingId("");
    setAddOpen(true);
  }

  function removePayment(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  // Yardımcı: bir ödemeye bağlı fatura no'sunu bul
  function invoiceLabelFor(p: PaymentEntry): string | null {
    if (!p.billingItemId) return null;
    const inv = billingItems.find((b) => b.id === p.billingItemId);
    if (!inv) return null;
    return inv.invoiceNo || inv.description.slice(0, 30);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Hakediş Ödemeleri" size="md">
      <div className="space-y-3">
        {/* Başlık özeti */}
        <div className="rounded-lg bg-bg2 border border-border p-3 text-xs">
          <div className="font-semibold text-sm mb-1">{milestone.description}</div>
          <div className="text-text3">
            Planlanan: <span className="font-mono text-text">{formatDate(milestone.plannedDate)}</span> ·{" "}
            <span className="font-mono text-text">{formatMoney(milestone.plannedAmount, milestone.currency)}</span>
          </div>
        </div>

        {/* Ödeme defteri */}
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-text2 mb-1.5 flex items-center gap-2">
            Ödeme Geçmişi
            {payments.length > 0 && <Badge variant="gray">{payments.length}</Badge>}
          </div>
          {payments.length === 0 ? (
            <div className="text-xs text-text3 px-3 py-2 rounded-md bg-bg2 border border-border italic">
              Henüz ödeme kaydı yok. Aşağıdan ekle.
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <tbody>
                  {payments.map((p, idx) => {
                    const invLabel = invoiceLabelFor(p);
                    return (
                      <tr key={p.id} className="border-b border-border last:border-b-0">
                        <td className="px-2 py-1.5 font-mono text-text3 w-7 text-center">
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5">
                          <div>{formatDate(p.date)}</div>
                          {invLabel ? (
                            <div className="mt-0.5 flex items-center gap-1 flex-wrap text-[10px]">
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-green/10 text-green font-bold">
                                <FileText size={9} /> Faturalı
                              </span>
                              <span className="text-text3 font-mono">{invLabel}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mt-0.5 rounded bg-yellow/15 text-yellow font-bold text-[10px]">
                              <AlertTriangle size={9} /> Faturasız!
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums">
                          {formatMoney(p.amount, milestone.currency)}
                        </td>
                        <td className="px-2 py-1.5 w-8 text-right">
                          <button
                            onClick={() => removePayment(p.id)}
                            className="p-0.5 text-text3 hover:text-red rounded"
                            title="Bu ödemeyi sil"
                          >
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Toplam + kalan/fazla — tek satır kompakt */}
          <div
            className={cn(
              "mt-1.5 text-xs px-3 py-1.5 rounded-md border flex items-center justify-between font-mono",
              isPartial
                ? "bg-blue/5 border-blue/30 text-blue"
                : isOverage
                ? "bg-green/5 border-green/30 text-green"
                : isComplete
                ? "bg-green/5 border-green/30 text-green"
                : "bg-bg2 border-border text-text3"
            )}
          >
            <span className="font-bold">Toplam</span>
            <div className="flex items-center gap-3">
              <span className="font-bold">{formatMoney(total, milestone.currency)}</span>
              {isPartial && (
                <span>
                  Eksik:{" "}
                  <span className="font-bold">
                    {formatMoney(milestone.plannedAmount - total, milestone.currency)}
                  </span>
                </span>
              )}
              {isOverage && (
                <span>
                  Fazla:{" "}
                  <span className="font-bold">
                    +{formatMoney(total - milestone.plannedAmount, milestone.currency)}
                  </span>
                </span>
              )}
              {isComplete && <span>✓ Tam</span>}
            </div>
          </div>
        </div>

        {/* Yeni ödeme — varsayılan kapalı, butonla açılır */}
        {!addOpen ? (
          <Button variant="accent" onClick={openAddPanel} className="w-full justify-center">
            <Plus size={14} /> Ödeme Ekle
          </Button>
        ) : (
          <div className="rounded-lg bg-white border border-accent/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider font-bold text-accent">
                Yeni Ödeme
              </div>
              <button
                onClick={() => setAddOpen(false)}
                className="text-[10px] text-text3 hover:text-text font-semibold"
              >
                Kapat
              </button>
            </div>

            {/* Fatura seçici / uyarı */}
            {hasNoInvoices ? (
              <div className="rounded-md border border-red/40 bg-red/5 px-2.5 py-1.5 text-xs">
                <div className="font-bold text-red flex items-center gap-1">
                  <AlertTriangle size={12} /> Dikkat: Faturasız ödeme yapmaktasınız!
                </div>
                <div className="text-[11px] text-text2 mt-0.5">
                  {milestone.direction === "owner_incoming" ? "İşveren" : "Bu alt yüklenici"}{" "}
                  için <strong>{milestone.currency}</strong> cinsinden uygun fatura bulunamadı.
                  Önce <strong>Faturalar</strong> sekmesinden hakediş faturasını kesip sonra ödemeyi
                  kaydetmen önerilir.
                </div>
              </div>
            ) : (
              <Field label="Fatura (faturadan çek)">
                <Select
                  value={newBillingId}
                  onChange={(e) => pickInvoice(e.target.value)}
                >
                  <option value="">— Faturasız ödeme —</option>
                  {eligibleInvoices.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.invoiceNo ? `${b.invoiceNo} · ` : ""}
                      {b.description.slice(0, 40)} · {formatMoney(b.amount, b.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {!hasNoInvoices && !newBillingId && (
              <div className="text-[10px] text-yellow font-semibold flex items-center gap-1">
                <AlertTriangle size={10} /> Fatura seçilmedi — faturasız ödeme kaydedilecek.
              </div>
            )}

            <div className="flex gap-2 items-end">
              <Field label="Tarih" className="flex-1">
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </Field>
              <Field label={`Tutar (${milestone.currency})`} className="flex-1">
                <Input
                  type="number"
                  step="0.01"
                  value={newAmount || ""}
                  placeholder={remaining > 0 ? String(remaining) : "0"}
                  onChange={(e) => setNewAmount(Number(e.target.value) || 0)}
                />
              </Field>
              <Button variant="accent" size="sm" onClick={addPayment} className="mb-0.5">
                <Plus size={14} /> Ekle
              </Button>
            </div>
            {remaining > 0 && newAmount === 0 && !newBillingId && (
              <button
                type="button"
                onClick={() => setNewAmount(remaining)}
                className="text-[10px] text-accent hover:underline"
              >
                Kalan tutar: {formatMoney(remaining, milestone.currency)} — tıklayarak kullan
              </button>
            )}
          </div>
        )}

        <Field label="Notlar">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button variant="accent" onClick={() => onSubmit(payments, notes || undefined)}>
          Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

type QuickPlanItem = { date: string; amount: number };

function autoDistributeItems(
  count: number,
  total: number,
  startDate: string,
  intervalDays: number
): QuickPlanItem[] {
  if (count <= 0) return [];
  const per = Math.round((total / count) * 100) / 100;
  const last = total - per * (count - 1);
  const items: QuickPlanItem[] = [];
  for (let i = 0; i < count; i++) {
    items.push({
      date: toISODate(addDays(new Date(startDate), i * intervalDays)),
      amount: i === count - 1 ? Math.round(last * 100) / 100 : per,
    });
  }
  return items;
}

function QuickPlanForm({
  open,
  subcontractors,
  projectBudget,
  projectCurrency,
  projectStartDate,
  projectEndDate,
  onClose,
  onGenerate,
}: {
  open: boolean;
  subcontractors: Subcontractor[];
  projectBudget: number;
  projectCurrency: Currency;
  projectStartDate: string;
  projectEndDate: string;
  onClose: () => void;
  onGenerate: (items: Omit<PaymentMilestone, "id" | "projectId" | "createdAt" | "updatedAt" | "status">[]) => void;
}) {
  const [direction, setDirection] = useState<BillingDirection>("owner_incoming");
  const [subcontractorId, setSubcontractorId] = useState<string>("");
  const [count, setCount] = useState<number>(6);
  const [firstDate, setFirstDate] = useState<string>(toISODate(new Date()));
  const [intervalDays, setIntervalDays] = useState<number>(30);
  const [totalAmount, setTotalAmount] = useState<number>(projectBudget || 0);
  const [totalAmountStr, setTotalAmountStr] = useState<string>(String(projectBudget || 0));
  const [currency, setCurrency] = useState<Currency>(projectCurrency);

  // Taksit satırları (manuel düzenlenebilir)
  const [items, setItems] = useState<QuickPlanItem[]>(() =>
    autoDistributeItems(6, projectBudget || 0, toISODate(new Date()), 30)
  );

  // Bağlam referansı (sözleşme tutarı) — % girişi için
  const contextTotal = useMemo<{ amount: number; currency: Currency; label: string }>(() => {
    if (direction === "owner_incoming") {
      return { amount: projectBudget, currency: projectCurrency, label: "Proje bütçesi" };
    }
    const sc = subcontractors.find((s) => s.id === subcontractorId);
    if (sc) return { amount: sc.contractAmount, currency: sc.currency, label: `${sc.name} sözleşmesi` };
    return { amount: 0, currency: projectCurrency, label: "—" };
  }, [direction, subcontractorId, subcontractors, projectBudget, projectCurrency]);

  // Sözleşme süresi — taksit tarihleri için referans
  const contractPeriod = useMemo<{ start: string; end: string; label: string } | null>(() => {
    if (direction === "owner_incoming") {
      return projectStartDate && projectEndDate
        ? { start: projectStartDate, end: projectEndDate, label: "Proje süresi" }
        : null;
    }
    const sc = subcontractors.find((s) => s.id === subcontractorId);
    if (sc) {
      const start = sc.startDate || sc.contractDate;
      const end = sc.endDate || "";
      return start && end ? { start, end, label: `${sc.name} sözleşmesi` } : null;
    }
    return null;
  }, [direction, subcontractorId, subcontractors, projectStartDate, projectEndDate]);

  const [pctStr, setPctStr] = useState<string>(() =>
    contextTotal.amount > 0 && totalAmount > 0
      ? ((totalAmount / contextTotal.amount) * 100).toFixed(2)
      : "100.00"
  );

  // Toplamlar
  const sumOfItems = items.reduce((s, it) => s + it.amount, 0);
  const amountMismatch = Math.abs(sumOfItems - totalAmount) > 0.01;

  function changeCount(n: number) {
    const clamped = Math.max(1, Math.min(60, n));
    setCount(clamped);
    setItems((prev) => {
      const result = [...prev];
      while (result.length < clamped) {
        const lastDate =
          result.length > 0 ? result[result.length - 1].date : firstDate;
        result.push({
          date: toISODate(addDays(new Date(lastDate), intervalDays)),
          amount: totalAmount / clamped,
        });
      }
      while (result.length > clamped) result.pop();
      return result;
    });
  }

  function setAmountFromStr(s: string) {
    setTotalAmountStr(s);
    const num = Number(s);
    if (!isNaN(num)) {
      setTotalAmount(num);
      if (contextTotal.amount > 0) setPctStr(((num / contextTotal.amount) * 100).toFixed(2));
    }
  }

  function setPctFromStr(s: string) {
    setPctStr(s);
    const num = Number(s);
    if (!isNaN(num) && contextTotal.amount > 0) {
      const amt = Math.round((num / 100) * contextTotal.amount * 100) / 100;
      setTotalAmount(amt);
      setTotalAmountStr(String(amt));
    }
  }

  function pickSubcontractor(scId: string) {
    setSubcontractorId(scId);
    const sc = subcontractors.find((s) => s.id === scId);
    if (sc) {
      setTotalAmount(sc.contractAmount);
      setTotalAmountStr(String(sc.contractAmount));
      setCurrency(sc.currency);
      setPctStr("100.00");
    }
  }

  function changeDirection(d: BillingDirection) {
    setDirection(d);
    if (d === "owner_incoming") {
      setTotalAmount(projectBudget);
      setTotalAmountStr(String(projectBudget));
      setCurrency(projectCurrency);
      setPctStr(projectBudget > 0 ? "100.00" : "");
    } else {
      setSubcontractorId("");
      setTotalAmount(0);
      setTotalAmountStr("0");
      setPctStr("");
    }
  }

  function updateItem(i: number, patch: Partial<QuickPlanItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function distributeDates() {
    setItems((prev) =>
      prev.map((it, i) => ({
        ...it,
        date: toISODate(addDays(new Date(firstDate), i * intervalDays)),
      }))
    );
  }

  function spanContractPeriod() {
    if (!contractPeriod) return;
    setFirstDate(contractPeriod.start);
    if (count <= 1) {
      setItems((prev) =>
        prev.map((it, i) => (i === 0 ? { ...it, date: contractPeriod.start } : it))
      );
      return;
    }
    const span = daysBetween(contractPeriod.start, contractPeriod.end);
    const newInterval = Math.max(1, Math.floor(span / (count - 1)));
    setIntervalDays(newInterval);
    setItems((prev) =>
      prev.map((it, i) => ({
        ...it,
        date:
          i === prev.length - 1
            ? contractPeriod.end
            : toISODate(addDays(new Date(contractPeriod.start), i * newInterval)),
      }))
    );
  }

  function distributeAmounts() {
    if (count <= 0) return;
    const per = Math.round((totalAmount / count) * 100) / 100;
    const last = totalAmount - per * (count - 1);
    setItems((prev) =>
      prev.map((it, i) => ({
        ...it,
        amount: i === count - 1 ? Math.round(last * 100) / 100 : per,
      }))
    );
  }

  function generate() {
    if (count <= 0 || count > 60) {
      alert("Hakediş sayısı 1-60 arasında olmalı");
      return;
    }
    if (direction === "subcontractor_outgoing" && !subcontractorId) {
      alert("Alt yüklenici seçin");
      return;
    }
    if (items.some((it) => it.amount <= 0)) {
      alert("Tüm hakediş tutarları 0'dan büyük olmalı");
      return;
    }
    if (items.some((it) => !it.date)) {
      alert("Tüm tarihler dolu olmalı");
      return;
    }
    const out: Omit<PaymentMilestone, "id" | "projectId" | "createdAt" | "updatedAt" | "status">[] =
      items.map((it, i) => ({
        direction,
        subcontractorId: direction === "subcontractor_outgoing" ? subcontractorId : undefined,
        sequenceNo: i + 1,
        description: `Hakediş No.${i + 1}`,
        plannedDate: it.date,
        plannedAmount: it.amount,
        currency,
      }));
    onGenerate(out);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Hızlı Plan Oluştur" size="lg">
      <Alert variant="info" className="mb-3">
        Her hakedişin tarih ve tutarını aşağıdaki listede tek tek düzenleyebilirsin. Otomatik
        dağıtma yardımcılarını da kullanabilirsin.
      </Alert>

      {/* ÜST: tip / firma / para / sayı / toplam / yüzde */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tip">
          <Select value={direction} onChange={(e) => changeDirection(e.target.value as BillingDirection)}>
            <option value="owner_incoming">İşverenden Alacak</option>
            <option value="subcontractor_outgoing">Alt Yükleniciye Ödeme</option>
          </Select>
        </Field>
        {direction === "subcontractor_outgoing" && (
          <Field label="Alt Yüklenici">
            <Select value={subcontractorId} onChange={(e) => pickSubcontractor(e.target.value)}>
              <option value="">Seçin</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Para Birimi">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label="Hakediş Sayısı">
          <Input
            type="number"
            min={1}
            max={60}
            value={count}
            onChange={(e) => changeCount(Number(e.target.value) || 1)}
          />
        </Field>
        <div className="sm:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Toplam Tutar">
              <Input
                type="number"
                step="0.01"
                value={totalAmountStr}
                onChange={(e) => setAmountFromStr(e.target.value)}
              />
            </Field>
            <Field label={`Yüzde (% / ${contextTotal.label})`}>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={pctStr}
                  onChange={(e) => setPctFromStr(e.target.value)}
                  disabled={contextTotal.amount === 0}
                  placeholder={contextTotal.amount === 0 ? "Sözleşme tutarı yok" : "100"}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 text-sm font-mono pointer-events-none">
                  %
                </span>
              </div>
            </Field>
          </div>
          {contextTotal.amount > 0 && (
            <div className="mt-1.5 text-[11px] text-text3">
              {contextTotal.label}:{" "}
              <span className="font-mono text-text">
                {formatMoney(contextTotal.amount, contextTotal.currency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SÖZLEŞME SÜRESİ — taksit tarihleri için referans */}
      {contractPeriod ? (
        <div className="mt-3 rounded-lg bg-accent/5 border border-accent/30 px-3 py-2 flex flex-wrap items-center gap-2 text-xs">
          <CalendarCheck size={14} className="text-accent shrink-0" />
          <span className="font-bold text-text">{contractPeriod.label}:</span>
          <span className="font-mono text-text">
            {formatDate(contractPeriod.start)} → {formatDate(contractPeriod.end)}
          </span>
          <span className="font-mono text-text3">
            ({daysBetween(contractPeriod.start, contractPeriod.end)}g)
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFirstDate(contractPeriod.start)}
              title="İlk hakediş tarihi alanını sözleşme başlangıcına çeker"
            >
              ⇤ İlk tarihi başa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={spanContractPeriod}
              title="Tüm hakedişleri sözleşme başı ile bitişi arasına eşit dağıtır"
            >
              ⇥ Sözleşmeye yay
            </Button>
          </div>
        </div>
      ) : direction === "subcontractor_outgoing" && !subcontractorId ? null : (
        <div className="mt-3 rounded-lg bg-bg2 border border-border px-3 py-2 text-[11px] text-text3">
          Sözleşme başlangıç/bitiş tarihleri tanımlanmamış. Master Data&apos;dan ekleyebilirsin.
        </div>
      )}

      {/* OTOMATİK DAĞITMA YARDIMCISI */}
      <div className="mt-3 rounded-lg bg-bg2 border border-border p-2.5">
        <div className="text-[10px] uppercase tracking-wider font-bold text-text2 mb-1.5">
          Otomatik Dağıt
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="İlk Tarih" className="flex-1 min-w-[140px] !mb-0">
            <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
          </Field>
          <Field label="Aralık (gün)" className="w-28 !mb-0">
            <Input
              type="number"
              min={1}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value) || 30)}
            />
          </Field>
          <Button variant="ghost" size="sm" onClick={distributeDates}>
            <Wand2 size={12} /> Tarihleri Dağıt
          </Button>
          <Button variant="ghost" size="sm" onClick={distributeAmounts}>
            <Wand2 size={12} /> Tutarları Eşitle
          </Button>
        </div>
      </div>

      {/* TAKSİT LİSTESİ — her satır tarih + tutar + aradaki gün */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text2">
            Hakedişler ({items.length})
          </div>
          <div className="text-[11px] text-text3 font-mono">
            Σ{" "}
            <span className={cn(amountMismatch ? "text-yellow font-bold" : "text-text font-semibold")}>
              {formatMoney(sumOfItems, currency)}
            </span>
            {amountMismatch && (
              <span className="ml-2 text-yellow">
                (Toplam farkı: {formatMoney(sumOfItems - totalAmount, currency)})
              </span>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-border overflow-hidden max-h-[280px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-bg2 sticky top-0">
              <tr className="text-[10px] uppercase tracking-wider text-text2 font-bold">
                <th className="px-2 py-1.5 text-center w-8">#</th>
                <th className="px-2 py-1.5 text-left">Tarih</th>
                <th className="px-2 py-1.5 text-left w-14">Aralık</th>
                <th className="px-2 py-1.5 text-right w-24">%</th>
                <th className="px-2 py-1.5 text-right">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const prevDate = i > 0 ? items[i - 1].date : null;
                const dayDiff = prevDate ? daysBetween(prevDate, it.date) : 0;
                const outOfRange =
                  contractPeriod &&
                  it.date &&
                  (it.date < contractPeriod.start || it.date > contractPeriod.end);
                const pctVal =
                  contextTotal.amount > 0 ? (it.amount / contextTotal.amount) * 100 : 0;
                return (
                  <tr
                    key={`${it.date}-${it.amount}-${i}`}
                    className={cn(
                      "border-t border-border first:border-t-0",
                      outOfRange && "bg-red/5"
                    )}
                  >
                    <td className="px-2 py-1 font-mono text-text3 text-center">{i + 1}</td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={it.date}
                          onChange={(e) => updateItem(i, { date: e.target.value })}
                          className={cn(
                            "!h-7 !py-0 !text-xs",
                            outOfRange && "!border-red/40 !text-red"
                          )}
                        />
                        {outOfRange && (
                          <span
                            className="text-red shrink-0"
                            title="Sözleşme süresi dışında"
                          >
                            <AlertTriangle size={11} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1 font-mono text-text3 text-[11px]">
                      {i === 0 ? <span className="text-text3">—</span> : `+${dayDiff}g`}
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={contextTotal.amount > 0 ? pctVal.toFixed(2) : ""}
                        disabled={contextTotal.amount === 0}
                        placeholder={contextTotal.amount === 0 ? "—" : "0"}
                        onChange={(e) => {
                          const num = Number(e.target.value);
                          if (!isNaN(num) && contextTotal.amount > 0) {
                            const amt =
                              Math.round((num / 100) * contextTotal.amount * 100) / 100;
                            updateItem(i, { amount: amt });
                          }
                        }}
                        className="!h-7 !py-0 !text-xs text-right font-mono"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={it.amount}
                        onChange={(e) =>
                          updateItem(i, { amount: Number(e.target.value) || 0 })
                        }
                        className="!h-7 !py-0 !text-xs text-right font-mono"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button variant="accent" onClick={generate}>
          <Wand2 size={14} /> Oluştur ({count} hakediş)
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ============================================================
// Hakediş Planı — yardımcı bileşenler
// ============================================================

type DirectionSummary = {
  m: Record<Currency, { planned: number; realized: number }>;
  overdueCount: number;
  upcomingCount: number;
  activeCount: number;
};

function SummaryRow({
  icon,
  label,
  summary,
  contracts,
}: {
  icon: React.ReactNode;
  label: string;
  summary: DirectionSummary;
  currency: Currency;
  contracts: Record<Currency, number>;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-xs font-bold text-text">
        {icon}
        <span>{label}</span>
        <Badge variant="gray">{summary.activeCount}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <InvoiceMultiCurrencyCard
          label="Planlanan / Sözleşme"
          values={{
            TRY: summary.m.TRY.planned,
            USD: summary.m.USD.planned,
            EUR: summary.m.EUR.planned,
          }}
          denominators={contracts}
        />
        <InvoiceMultiCurrencyCard
          label="Gerçekleşen / Planlanan"
          values={{
            TRY: summary.m.TRY.realized,
            USD: summary.m.USD.realized,
            EUR: summary.m.EUR.realized,
          }}
          denominators={{
            TRY: summary.m.TRY.planned,
            USD: summary.m.USD.planned,
            EUR: summary.m.EUR.planned,
          }}
          valueClass="text-green"
        />
        <MiniKpiCard
          label="Gecikmiş"
          value={String(summary.overdueCount)}
          sub={summary.overdueCount > 0 ? "tarihi geçti" : "—"}
          valueClass={summary.overdueCount > 0 ? "text-red" : "text-text3"}
          highlight={summary.overdueCount > 0}
        />
        <MiniKpiCard
          label="30 Gün"
          value={String(summary.upcomingCount)}
          sub="yaklaşan"
          valueClass="text-accent"
        />
      </div>
    </div>
  );
}

function MultiCurrencyCard({
  label,
  data,
  field,
  showPercent,
  valueClass,
}: {
  label: string;
  data: Record<Currency, { planned: number; realized: number }>;
  field: "planned" | "realized";
  showPercent?: boolean;
  valueClass?: string;
}) {
  const items = (["TRY", "USD", "EUR"] as Currency[])
    .map((c) => ({ currency: c, value: data[c][field], planned: data[c].planned }))
    .filter((it) => it.value > 0 || it.planned > 0);

  return (
    <div className="rounded-md border bg-white border-border px-2.5 py-1.5 leading-tight">
      <div className="text-[9px] uppercase tracking-wider font-bold text-text3">{label}</div>
      {items.length === 0 ? (
        <div className="font-mono text-sm font-bold text-text3 mt-0.5">—</div>
      ) : (
        <div className="mt-0.5 space-y-0.5">
          {items.map((it) => {
            const pct = showPercent && it.planned > 0 ? (it.value / it.planned) * 100 : 0;
            return (
              <div
                key={it.currency}
                className="flex items-baseline justify-between gap-1.5"
              >
                <span
                  className={cn(
                    "font-mono text-[13px] font-bold tabular-nums",
                    valueClass ?? "text-text"
                  )}
                >
                  {formatMoney(it.value, it.currency, 0)}
                </span>
                <span className="text-[9px] text-text3 font-mono whitespace-nowrap">
                  {it.currency}
                  {showPercent && it.planned > 0 && (
                    <span className="ml-1">%{pct.toFixed(0)}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniKpiCard({
  label,
  value,
  sub,
  valueClass,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-white px-2.5 py-1.5 leading-tight",
        highlight ? "border-red/40 bg-red/5" : "border-border"
      )}
    >
      <div className="text-[9px] uppercase tracking-wider font-bold text-text3">{label}</div>
      <div className={cn("font-mono text-sm font-bold tabular-nums mt-0.5", valueClass ?? "text-text")}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-text3 mt-0.5">{sub}</div>}
    </div>
  );
}

function InvoiceMultiCurrencyCard({
  label,
  values,
  denominators,
  valueClass,
}: {
  label: string;
  values: Record<Currency, number>;
  denominators?: Record<Currency, number>;
  valueClass?: string;
}) {
  const items = (["TRY", "USD", "EUR"] as Currency[])
    .map((c) => ({
      currency: c,
      value: values[c],
      denominator: denominators?.[c] ?? 0,
    }))
    .filter((it) => it.value > 0 || it.denominator > 0);

  return (
    <div className="rounded-md border bg-white border-border px-2.5 py-1.5 leading-tight">
      <div className="text-[9px] uppercase tracking-wider font-bold text-text3 mb-1">
        {label}
      </div>
      {items.length === 0 ? (
        <div className="font-mono text-sm font-bold text-text3">—</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const hasDenom = !!denominators && it.denominator > 0;
            const pct = hasDenom ? (it.value / it.denominator) * 100 : 0;
            const mismatch = hasDenom && Math.abs(it.value - it.denominator) > 0.01;
            const pctTone = !hasDenom
              ? "text-text3"
              : mismatch && it.value < it.denominator
              ? "text-yellow"
              : mismatch && it.value > it.denominator
              ? "text-red"
              : "text-green";
            return (
              <div key={it.currency}>
                {/* 1. satır: değer + para birimi */}
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      "font-mono text-[14px] font-bold tabular-nums",
                      valueClass ?? "text-text"
                    )}
                  >
                    {formatMoney(it.value, it.currency, 0)}
                  </span>
                  <span className="text-[10px] text-text3 font-mono">{it.currency}</span>
                </div>
                {/* 2. satır (varsa): / sözleşme + % */}
                {hasDenom && (
                  <div className="flex items-baseline justify-between gap-1 text-[10px] font-mono text-text3">
                    <span>
                      / {formatMoney(it.denominator, it.currency, 0)}
                    </span>
                    <span className={cn("font-bold", pctTone)}>%{pct.toFixed(0)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md bg-bg2 border border-border px-2 py-1 leading-tight">
      <div className="text-[9px] uppercase tracking-wider font-bold text-text3">{label}</div>
      <div className={cn("font-mono text-[13px] font-bold tabular-nums", valueClass ?? "text-text")}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-text3">{sub}</div>}
    </div>
  );
}

function CoverageBar({
  label,
  planned,
  realized,
  total,
  pct,
  realizedPct,
  currency,
}: {
  label: string;
  planned: number;
  realized: number;
  total: number;
  pct: number;
  realizedPct: number;
  currency: Currency;
  count?: number;
  compact?: boolean;
}) {
  const noContract = total <= 0;
  const isOver = !noContract && pct > 100.5;

  return (
    <div className="rounded-lg bg-white border border-border px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider font-bold text-text2 mb-2 flex items-center justify-between">
        <span className="truncate">{label}</span>
        {!noContract && (
          <span className="text-text3 font-mono text-[10px] normal-case tracking-normal">
            Sözleşme: {formatMoney(total, currency, 0)}
          </span>
        )}
      </div>

      {/* PLANLANAN BARI */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-orange" />
            <span className="font-semibold text-text">Planlanan</span>
          </span>
          <span className="font-mono tabular-nums whitespace-nowrap">
            <span className="text-text font-bold">{formatMoney(planned, currency, 0)}</span>
            {!noContract && (
              <span className="text-orange font-bold ml-2 text-xs">%{pct.toFixed(0)}</span>
            )}
          </span>
        </div>
        <div className="h-3 bg-bg2 rounded-full overflow-hidden relative">
          {!noContract ? (
            <>
              <div
                className="absolute h-full bg-orange transition-[width] duration-500"
                style={{ width: `${Math.min(100, pct)}%` }}
              />
              {isOver && (
                <div className="absolute right-0 top-0 h-full w-1 bg-red animate-pulse-soft" />
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* GERÇEKLEŞEN BARI */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green" />
            <span className="font-semibold text-text">Gerçekleşen</span>
          </span>
          <span className="font-mono tabular-nums whitespace-nowrap">
            <span className="text-green font-bold">{formatMoney(realized, currency, 0)}</span>
            {!noContract && (
              <span className="text-green font-bold ml-2 text-xs">
                %{realizedPct.toFixed(0)}
              </span>
            )}
          </span>
        </div>
        <div className="h-3 bg-bg2 rounded-full overflow-hidden relative">
          {!noContract ? (
            <div
              className="absolute h-full bg-green transition-[width] duration-500"
              style={{ width: `${Math.min(100, realizedPct)}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MilestoneRow({
  m,
  subName,
  context,
  todayISO,
  onRealize,
  onEdit,
  onDelete,
}: {
  m: PaymentMilestone;
  subName?: string;
  context: { amount: number; currency: Currency };
  todayISO: string;
  onRealize: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pct = context.amount > 0 ? (m.plannedAmount / context.amount) * 100 : 0;
  const overdue = isMilestoneOverdue(m, todayISO);
  const showSubCol = subName !== undefined;

  return (
    <TR className={cn(overdue && "bg-red/5")}>
      <TD className="font-mono text-xs text-text2">{m.sequenceNo}</TD>
      {showSubCol && (
        <TD>
          <Badge variant="yellow">{subName ?? "Alt Yük."}</Badge>
        </TD>
      )}
      <TD className="text-sm font-medium">{m.description}</TD>
      <TD className="text-xs">
        <div className={cn(overdue ? "text-red font-bold" : "text-text2")}>
          {formatDate(m.plannedDate)}
        </div>
        {overdue && (
          <div className="text-[10px] text-red flex items-center gap-1 mt-0.5">
            <AlertTriangle size={10} /> Gecikti
          </div>
        )}
      </TD>
      <TD className="text-right font-mono font-semibold tabular-nums">
        {formatMoney(m.plannedAmount, m.currency)}
      </TD>
      <TD className="text-right font-mono text-xs text-text3 tabular-nums">
        {context.amount > 0 ? `%${pct.toFixed(1)}` : "—"}
      </TD>
      <TD>
        <Badge variant={MS_STATUS_VARIANT[m.status]}>{MS_STATUS_LABEL[m.status]}</Badge>
      </TD>
      <TD className="text-xs">
        {(() => {
          const entries = getEffectivePayments(m);
          if (entries.length === 0) return <span className="text-text3">—</span>;
          const total = entries.reduce((s, p) => s + p.amount, 0);
          const shortfall = m.plannedAmount - total;
          const overage = total - m.plannedAmount;
          return (
            <div className="space-y-0.5">
              {entries.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-text2">{formatDate(p.date)}</span>
                  <span className="font-mono text-text3">{formatMoney(p.amount, m.currency, 0)}</span>
                </div>
              ))}
              {entries.length > 1 && (
                <div className="border-t border-border pt-0.5 mt-0.5 flex items-center justify-between gap-2 text-[10px] font-bold">
                  <span className="text-text2">Toplam</span>
                  <span className="font-mono text-text">{formatMoney(total, m.currency, 0)}</span>
                </div>
              )}
              {m.status === "partial" && shortfall > 0.005 && (
                <div className="text-[10px] text-red font-bold pt-0.5">
                  Eksik: {formatMoney(shortfall, m.currency, 0)}
                </div>
              )}
              {m.status === "realized" && overage > 0.005 && (
                <div className="text-[10px] text-green font-bold pt-0.5">
                  +{formatMoney(overage, m.currency, 0)}
                </div>
              )}
            </div>
          );
        })()}
      </TD>
      <TD>
        <div className="flex gap-1 justify-end">
          {m.status !== "cancelled" && (
            <button
              onClick={onRealize}
              className={cn(
                "p-1 rounded",
                m.status === "realized"
                  ? "text-text3 hover:text-green hover:bg-green/10"
                  : "text-green hover:bg-green/10"
              )}
              title={
                m.status === "planned"
                  ? "Gerçekleşti olarak işaretle"
                  : m.status === "partial"
                  ? "Kalan ödemeyi gir"
                  : "Gerçekleşmeyi düzelt"
              }
            >
              <CheckCircle2 size={14} />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1 text-text3 hover:text-accent rounded"
            title="Düzenle"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-text3 hover:text-red rounded"
            title="Sil"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </TD>
    </TR>
  );
}
