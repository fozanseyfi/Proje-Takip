"use client";

import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Check,
  X,
  CircleDot,
  Circle,
  Download,
  FileWarning,
  RotateCcw,
  MessageSquarePlus,
  Filter,
  AlertTriangle,
  ListPlus,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { cn, formatDate } from "@/lib/utils";
import type { TeslimAlmaStatus, TeslimAlmaItemResult } from "@/lib/store/types";
import {
  TESLIM_ALMA_TEMPLATE,
  TESLIM_ALMA_TOTAL_ITEMS,
  type TeslimAlmaItem,
} from "@/lib/data/teslim-alma-template";
import { downloadTeslimAlmaPDF } from "@/lib/pdf/teslim-alma";
import { loadingOverlay } from "@/lib/ui-loading";
import { confirmAction } from "@/components/ui/confirm";

export default function TeslimAlmaPage() {
  const project = useStore((s) =>
    s.currentProjectId ? s.projects.find((p) => p.id === s.currentProjectId) : null
  );
  const report = useStore((s) =>
    s.currentProjectId ? s.teslimAlma[s.currentProjectId] : undefined
  );
  const ensureReport = useStore((s) => s.ensureTeslimAlmaReport);
  const updateItem = useStore((s) => s.updateTeslimAlmaItem);
  const updateMeta = useStore((s) => s.updateTeslimAlmaMeta);
  const resetReport = useStore((s) => s.resetTeslimAlmaReport);
  const addLookahead = useStore((s) => s.addLookahead);
  const existingLookahead = useStore((s) =>
    s.currentProjectId ? s.lookahead.filter((l) => l.projectId === s.currentProjectId) : []
  );
  const toast = useToast((p) => p.push);

  const [filterMode, setFilterMode] = useState<"all" | "pending" | "issues">("all");
  const [pdfBusy, setPdfBusy] = useState<"blank" | "filled" | "ncr" | null>(null);

  // Rapor yoksa boş yapı kullan (hook'ların altında erken çıkış için)
  // useMemo'lar her render'da çağrılmalı — koşulsuz.
  const items = useMemo(() => report?.items ?? {}, [report?.items]);
  const meta = report?.meta ?? { inspectionDate: new Date().toISOString().slice(0, 10) };

  // Sayım
  const counts = useMemo(() => {
    let ok = 0, fail = 0, conditional = 0;
    for (const r of Object.values(items)) {
      if (r.status === "ok") ok++;
      else if (r.status === "fail") fail++;
      else if (r.status === "conditional") conditional++;
    }
    const pending = TESLIM_ALMA_TOTAL_ITEMS - ok - fail - conditional;
    const answered = ok + fail + conditional;
    const pct = TESLIM_ALMA_TOTAL_ITEMS > 0 ? (answered / TESLIM_ALMA_TOTAL_ITEMS) * 100 : 0;
    return { ok, fail, conditional, pending, answered, pct };
  }, [items]);

  // Major NCR sayısı (fail + conditional, severity=major)
  const majorIssues = useMemo(() => {
    let n = 0;
    for (const sec of TESLIM_ALMA_TEMPLATE) {
      for (const sub of sec.subsections) {
        for (const it of sub.items) {
          const st = items[it.id]?.status;
          if ((st === "fail" || st === "conditional") && it.severity === "major") n++;
        }
      }
    }
    return n;
  }, [items]);

  // Proje seçili değilse erken çık — hook'lardan SONRA
  if (!project) {
    return (
      <>
        <PageHeader
          title="Teslim Alma Listesi"
          description="GES saha denetimi ve geçici kabul kontrol listesi."
          icon={ClipboardCheck}
        />
        <Alert variant="warning">Önce bir proje seçin.</Alert>
      </>
    );
  }

  function setStatus(itemId: string, status: TeslimAlmaStatus) {
    if (!project) return;
    if (!report) ensureReport(project.id);
    const existing = items[itemId];
    updateItem(project.id, itemId, {
      status,
      condition: existing?.condition,
      note: existing?.note,
    });
  }

  function setCondition(itemId: string, condition: string) {
    if (!project) return;
    const existing = items[itemId];
    updateItem(project.id, itemId, {
      status: existing?.status ?? "conditional",
      condition,
      note: existing?.note,
    });
  }

  function setNote(itemId: string, note: string) {
    if (!project) return;
    const existing = items[itemId];
    updateItem(project.id, itemId, {
      status: existing?.status ?? "pending",
      condition: existing?.condition,
      note,
    });
  }

  async function downloadPDF(mode: "blank" | "filled" | "ncr") {
    if (!project) return;
    setPdfBusy(mode);
    const label =
      mode === "blank" ? "Taslak PDF hazırlanıyor"
      : mode === "ncr" ? "NCR raporu hazırlanıyor"
      : "Doldurulmuş PDF hazırlanıyor";
    try {
      if (!report) ensureReport(project.id);
      const currentReport = useStore.getState().teslimAlma[project.id]!;
      await loadingOverlay.run(
        () => downloadTeslimAlmaPDF({ mode, project, report: currentReport }),
        label
      );
      toast(
        mode === "blank" ? "Taslak PDF indirildi"
        : mode === "ncr" ? "NCR raporu indirildi"
        : "Doldurulmuş PDF indirildi",
        "success"
      );
    } catch (err) {
      console.error(err);
      toast("PDF oluşturulurken hata oluştu", "error");
    } finally {
      setPdfBusy(null);
    }
  }

  /**
   * Uygunsuz / şartlı maddeleri Lookahead'e "Kritik İş" olarak aktar.
   * Daha önce aktarılmış olanlar atlanır (task metni = "Teslim Alma · <itemId>" ile match).
   */
  async function exportNCRtoLookahead() {
    if (!project) return;
    // fail + conditional maddeleri topla
    const issues: Array<{ id: string; text: string; severity: "major" | "minor"; status: TeslimAlmaStatus; sectionId: string; subsectionId: string; condition?: string; note?: string }> = [];
    for (const sec of TESLIM_ALMA_TEMPLATE) {
      for (const sub of sec.subsections) {
        for (const it of sub.items) {
          const r = items[it.id];
          if (r?.status === "fail" || r?.status === "conditional") {
            issues.push({
              id: it.id,
              text: it.text,
              severity: it.severity,
              status: r.status,
              sectionId: sec.id,
              subsectionId: sub.id,
              condition: r.condition,
              note: r.note,
            });
          }
        }
      }
    }
    if (issues.length === 0) {
      toast("Aktarılacak uygunsuzluk yok — tüm maddeler uygun veya beklemede", "info");
      return;
    }
    // Daha önce eklenmiş olanları tanı (notes alanında "TA:<itemId>" tag'i kullanıyoruz)
    const alreadyExported = new Set(
      existingLookahead
        .map((l) => l.notes?.match(/TA:([\w-]+)/)?.[1])
        .filter(Boolean) as string[]
    );
    const fresh = issues.filter((i) => !alreadyExported.has(i.id));
    if (fresh.length === 0) {
      toast("Tüm uygunsuzluklar zaten Lookahead'de mevcut", "info");
      return;
    }
    const ok = await confirmAction({
      title: `${fresh.length} uygunsuzluk aktarılsın`,
      message: `Teslim Alma listesindeki ${fresh.length} uygunsuz / şartlı madde, "Kritik & Tutanak" sayfasına "kritik iş" olarak eklenecek.\n\nMajor seviye: critical priority\nMinor seviye: high priority\n\nDevam edilsin mi?`,
      confirmText: `${fresh.length} Maddeyi Aktar`,
    });
    if (!ok) return;
    // Her madde için lookahead item üret
    const today = new Date().toISOString().slice(0, 10);
    for (const i of fresh) {
      addLookahead({
        projectId: project.id,
        task: `[${i.sectionId}.${i.subsectionId.replace(/^[A-Z]\./, "")} · ${i.id}] ${i.text}`,
        date: today,
        priority: i.severity === "major" ? "critical" : "high",
        kind: "kritik_is",
        done: false,
        notes: [
          `Teslim Alma denetimi · ${i.status === "fail" ? "Uygun Değil" : "Şartlı"} (${i.severity})`,
          i.condition ? `Şart: ${i.condition}` : null,
          i.note ? `Açıklama: ${i.note}` : null,
          `TA:${i.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }
    toast(`${fresh.length} uygunsuzluk Lookahead'e aktarıldı`, "success");
  }

  async function handleReset() {
    if (!project) return;
    if (!(await confirmAction({
      title: "Teslim Alma sıfırlansın",
      message: `"${project.name}" projesinin TÜM Teslim Alma cevapları silinecek. Bu işlem geri alınamaz.`,
      danger: true,
      confirmText: "Sıfırla",
    }))) return;
    resetReport(project.id);
    toast("Teslim Alma raporu sıfırlandı", "info");
  }

  return (
    <>
      <PageHeader
        title="Teslim Alma Listesi"
        description="GES saha denetimi ve geçici kabul kontrol listesi · v1.0"
        icon={ClipboardCheck}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadPDF("blank")}
              disabled={pdfBusy !== null}
              title="Boş taslak PDF — sahada el ile doldurmak için"
            >
              <Download size={14} />
              {pdfBusy === "blank" ? "Hazırlanıyor…" : "Taslak PDF"}
            </Button>
            <Button
              variant="accent"
              size="sm"
              onClick={() => downloadPDF("filled")}
              disabled={pdfBusy !== null}
              title="Doldurulmuş raporu indir"
            >
              <Download size={14} />
              {pdfBusy === "filled" ? "Hazırlanıyor…" : "Dolduran PDF"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadPDF("ncr")}
              disabled={pdfBusy !== null || (counts.fail + counts.conditional) === 0}
              title="Sadece uygunsuz + şartlı maddeler (NCR)"
              className="border-red/40 text-red hover:bg-red/5"
            >
              <FileWarning size={14} />
              NCR ({counts.fail + counts.conditional})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportNCRtoLookahead}
              disabled={(counts.fail + counts.conditional) === 0}
              title="Uygunsuz + şartlı maddeleri 'Kritik & Tutanak' listesine aktar"
              className="border-yellow/40 text-yellow-dark hover:bg-yellow/5"
            >
              <ListPlus size={14} />
              Lookahead'e Aktar
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} title="Tüm cevapları sil">
              <RotateCcw size={14} />
            </Button>
          </>
        }
      />

      {/* Doluluk uyarısı (Ö10) */}
      {counts.pending > TESLIM_ALMA_TOTAL_ITEMS * 0.2 && (
        <Alert variant="warning" className="mb-4">
          <AlertTriangle size={14} className="inline mr-1.5" />
          <strong>{counts.pending} madde</strong> hâlâ <strong>beklemede</strong> ({Math.round((counts.pending / TESLIM_ALMA_TOTAL_ITEMS) * 100)}%).
          Doldurulmuş PDF çıkarmadan önce tüm maddeleri cevaplamanız önerilir.
        </Alert>
      )}

      {majorIssues > 0 && (
        <Alert variant="error" className="mb-4">
          <AlertTriangle size={14} className="inline mr-1.5" />
          <strong>{majorIssues} Major uygunsuzluk</strong> tespit edildi. Geçici kabul öncesi tümü kapatılmalıdır.
        </Alert>
      )}

      {/* Özet kartı */}
      <Card className="mb-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-display text-base font-extrabold text-text">Denetim İlerlemesi</h2>
              <span className="font-mono text-sm font-bold text-text">{counts.pct.toFixed(0)}%</span>
            </div>
            <div className="h-3 rounded-full bg-bg2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent via-accent to-green transition-all duration-300"
                style={{ width: `${counts.pct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-text3">
              {counts.answered} / {TESLIM_ALMA_TOTAL_ITEMS} madde cevaplandı
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <StatChip label="Uygun" value={counts.ok} icon={Check} tone="green" />
            <StatChip label="Uygun Değil" value={counts.fail} icon={X} tone="red" />
            <StatChip label="Şartlı" value={counts.conditional} icon={CircleDot} tone="yellow" />
            <StatChip label="Beklemede" value={counts.pending} icon={Circle} tone="gray" />
          </div>
        </div>

        {/* Genel karar */}
        <div className="mt-4 pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-bold text-text2">Genel Karar:</span>
          <div className="flex gap-2 flex-wrap">
            {(["approved", "conditional", "rejected"] as const).map((d) => {
              const labels = {
                approved: "Geçici Kabul Uygundur",
                conditional: "Şartlı Uygundur",
                rejected: "Geçici Kabul Uygun Değildir",
              };
              const colors = {
                approved: "bg-green/15 text-green border-green/40 hover:bg-green/25",
                conditional: "bg-yellow/15 text-yellow-dark border-yellow/40 hover:bg-yellow/25",
                rejected: "bg-red/15 text-red border-red/40 hover:bg-red/25",
              };
              const active = meta.overallDecision === d;
              return (
                <button
                  key={d}
                  onClick={() => updateMeta(project.id, { overallDecision: active ? undefined : d })}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-bold border transition-colors",
                    active ? colors[d] + " ring-2 ring-offset-1 ring-current" : "bg-white text-text3 border-border hover:border-text2"
                  )}
                >
                  {labels[d]}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Proje bilgileri */}
      <CollapsibleCard
        title="Proje Bilgileri"
        icon={<ClipboardCheck size={16} />}
        tone="accent"
        defaultOpen={false}
        className="mb-4"
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <MetaField label="Proje Adı" value={project.name} readOnly />
          <MetaField label="Konum" value={project.location ?? ""} readOnly />
          <MetaField
            label="DC Kurulu Güç (kWp)"
            value={String(meta.dcCapacityKwp ?? (project.installedCapacityMw ? project.installedCapacityMw * 1000 : ""))}
            onChange={(v) => updateMeta(project.id, { dcCapacityKwp: v === "" ? undefined : Number(v) || 0 })}
            type="number"
          />
          <MetaField
            label="AC Kurulu Güç (kWe)"
            value={String(meta.acCapacityKwe ?? "")}
            onChange={(v) => updateMeta(project.id, { acCapacityKwe: v === "" ? undefined : Number(v) || 0 })}
            type="number"
          />
          <MetaField
            label="Panel Marka / Model"
            value={meta.panelBrandModel ?? ""}
            onChange={(v) => updateMeta(project.id, { panelBrandModel: v })}
          />
          <MetaField
            label="Panel Adedi"
            value={String(meta.panelCount ?? "")}
            onChange={(v) => updateMeta(project.id, { panelCount: v === "" ? undefined : Number(v) || 0 })}
            type="number"
          />
          <MetaField
            label="Inverter Marka / Model"
            value={meta.inverterBrandModel ?? ""}
            onChange={(v) => updateMeta(project.id, { inverterBrandModel: v })}
          />
          <MetaField
            label="Inverter Adedi"
            value={String(meta.inverterCount ?? "")}
            onChange={(v) => updateMeta(project.id, { inverterCount: v === "" ? undefined : Number(v) || 0 })}
            type="number"
          />
          <MetaField
            label="EPC Yüklenici"
            value={meta.epcContractor ?? project.mainContractorName ?? ""}
            onChange={(v) => updateMeta(project.id, { epcContractor: v })}
          />
          <MetaField
            label="Denetim Tarihi"
            value={meta.inspectionDate}
            onChange={(v) => updateMeta(project.id, { inspectionDate: v })}
            type="date"
          />
          <MetaField
            label="Denetimi Yapan"
            value={meta.inspectorName ?? ""}
            onChange={(v) => updateMeta(project.id, { inspectorName: v })}
          />
          <MetaField
            label="Denetimi Yapan — Ünvan"
            value={meta.inspectorTitle ?? ""}
            onChange={(v) => updateMeta(project.id, { inspectorTitle: v })}
          />
          <MetaField
            label="İşveren Temsilcisi"
            value={meta.ownerRepName ?? ""}
            onChange={(v) => updateMeta(project.id, { ownerRepName: v })}
          />
          <MetaField
            label="İşveren Temsilcisi — Ünvan"
            value={meta.ownerRepTitle ?? ""}
            onChange={(v) => updateMeta(project.id, { ownerRepTitle: v })}
          />
          <MetaField
            label="EPC Yüklenici Temsilcisi"
            value={meta.epcRepName ?? ""}
            onChange={(v) => updateMeta(project.id, { epcRepName: v })}
          />
          <MetaField
            label="EPC Temsilci — Ünvan"
            value={meta.epcRepTitle ?? ""}
            onChange={(v) => updateMeta(project.id, { epcRepTitle: v })}
          />
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text3 mb-1">Genel Notlar / Tespitler</label>
            <textarea
              value={meta.generalNotes ?? ""}
              onChange={(e) => updateMeta(project.id, { generalNotes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-white focus:border-accent focus:outline-none"
              placeholder="Genel denetim notları, özet tespitler..."
            />
          </div>
        </div>
      </CollapsibleCard>

      {/* Filtre */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-text3" />
        <span className="text-xs font-bold text-text2 mr-1">Göster:</span>
        {(["all", "pending", "issues"] as const).map((f) => {
          const labels = { all: "Tümü", pending: "Sadece Beklemede", issues: "Sadece Uygunsuzluklar" };
          const counts2 = { all: TESLIM_ALMA_TOTAL_ITEMS, pending: counts.pending, issues: counts.fail + counts.conditional };
          return (
            <button
              key={f}
              onClick={() => setFilterMode(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-bold border transition-colors",
                filterMode === f
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-text2 border-border hover:border-accent hover:text-accent"
              )}
            >
              {labels[f]} <span className="font-mono opacity-70">({counts2[f]})</span>
            </button>
          );
        })}
      </div>

      {/* Ana içerik — bölüm bölüm */}
      <div className="space-y-3">
        {TESLIM_ALMA_TEMPLATE.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            items={items}
            filterMode={filterMode}
            onStatusChange={setStatus}
            onConditionChange={setCondition}
            onNoteChange={setNote}
          />
        ))}
      </div>

      <Alert variant="info" className="mt-6">
        <strong>İpucu:</strong> Cevaplar tarayıcıda otomatik kaydedilir. PDF taslağını ve doldurulmuş raporu istediğin zaman indirebilirsin. Yedek almayı unutma — &quot;Veri Yedeği&quot; bölümünden tüm projenin verilerini yedekle.
      </Alert>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bölüm bloğu
// ─────────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  items,
  filterMode,
  onStatusChange,
  onConditionChange,
  onNoteChange,
}: {
  section: (typeof TESLIM_ALMA_TEMPLATE)[number];
  items: Record<string, TeslimAlmaItemResult>;
  filterMode: "all" | "pending" | "issues";
  onStatusChange: (id: string, status: TeslimAlmaStatus) => void;
  onConditionChange: (id: string, c: string) => void;
  onNoteChange: (id: string, n: string) => void;
}) {
  // Filtreyi uygula
  const allItems = section.subsections.flatMap((sub) => sub.items.map((it) => ({ ...it, subsection: sub })));
  const visibleItems = allItems.filter((it) => {
    const st = items[it.id]?.status ?? "pending";
    if (filterMode === "pending") return st === "pending";
    if (filterMode === "issues") return st === "fail" || st === "conditional";
    return true;
  });

  if (visibleItems.length === 0) return null;

  // Sayım — bu bölümde
  let secOk = 0, secFail = 0, secCond = 0;
  for (const it of allItems) {
    const st = items[it.id]?.status ?? "pending";
    if (st === "ok") secOk++;
    else if (st === "fail") secFail++;
    else if (st === "conditional") secCond++;
  }
  const secTotal = allItems.length;
  const secDone = secOk + secFail + secCond;

  // Alt-bölümleri filtrele ve grupla
  const subGroups = section.subsections
    .map((sub) => ({
      sub,
      items: sub.items.filter((it) => {
        const st = items[it.id]?.status ?? "pending";
        if (filterMode === "pending") return st === "pending";
        if (filterMode === "issues") return st === "fail" || st === "conditional";
        return true;
      }),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <CollapsibleCard
      title={
        <span>
          <span className="text-accent font-mono mr-2">{section.id}</span>
          {section.title}
        </span>
      }
      icon={<span className="font-mono font-black text-sm">{section.id}</span>}
      tone={section.tone}
      defaultOpen={false}
      badge={
        <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-text2 bg-white/70 px-2 py-0.5 rounded border border-border">
          <span className="text-green">✓{secOk}</span>
          {secFail > 0 && <span className="text-red">✗{secFail}</span>}
          {secCond > 0 && <span className="text-yellow-dark">◐{secCond}</span>}
          <span className="text-text3">/{secTotal}</span>
        </span>
      }
    >
      <div className="p-4 space-y-4">
        <p className="text-xs text-text2 italic leading-relaxed">{section.description}</p>
        <div className="flex items-center gap-2 text-[10px] text-text3">
          <div className="flex-1 h-1.5 rounded-full bg-bg2 overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${secTotal > 0 ? (secDone / secTotal) * 100 : 0}%` }} />
          </div>
          <span className="font-mono">{secDone}/{secTotal}</span>
        </div>

        {subGroups.map(({ sub, items: subItems }) => (
          <div key={sub.id} className="space-y-2">
            <div className="flex items-baseline gap-2 pb-1 border-b border-border">
              <span className="font-mono text-xs font-bold text-accent">{sub.id}</span>
              <span className="font-bold text-sm text-text">{sub.title}</span>
            </div>
            <div className="space-y-1.5">
              {subItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  result={items[item.id]}
                  onStatusChange={onStatusChange}
                  onConditionChange={onConditionChange}
                  onNoteChange={onNoteChange}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleCard>
  );
}

// ─────────────────────────────────────────────────────────────────
// Madde satırı
// ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  result,
  onStatusChange,
  onConditionChange,
  onNoteChange,
}: {
  item: TeslimAlmaItem;
  result: TeslimAlmaItemResult | undefined;
  onStatusChange: (id: string, status: TeslimAlmaStatus) => void;
  onConditionChange: (id: string, c: string) => void;
  onNoteChange: (id: string, n: string) => void;
}) {
  const status: TeslimAlmaStatus = result?.status ?? "pending";
  const [noteOpen, setNoteOpen] = useState(Boolean(result?.note));

  // Satır arka plan rengi statüye göre
  const rowBg =
    status === "ok"
      ? "bg-green/[0.03] border-green/15"
      : status === "fail"
      ? "bg-red/[0.04] border-red/20"
      : status === "conditional"
      ? "bg-yellow/[0.04] border-yellow/25"
      : "bg-white border-border";

  return (
    <div className={cn("rounded-md border px-3 py-2 transition-colors", rowBg)}>
      <div className="flex items-start gap-2 flex-wrap">
        <span className="font-mono text-[10px] text-text3 font-bold mt-1 shrink-0 w-12">{item.id}</span>
        <span className="flex-1 min-w-[200px] text-sm text-text leading-snug">{item.text}</span>
        <span className="shrink-0 flex items-center gap-1.5">
          <SeverityBadge severity={item.severity} />
          <StatusButtons currentStatus={status} onChange={(s) => onStatusChange(item.id, s)} />
          <button
            onClick={() => setNoteOpen((v) => !v)}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors",
              result?.note
                ? "bg-blue/10 text-blue border-blue/30"
                : noteOpen
                ? "bg-accent/10 text-accent border-accent/30"
                : "bg-white text-text3 border-border hover:border-accent hover:text-accent"
            )}
            title={result?.note ? "Açıklama mevcut" : "Açıklama ekle"}
          >
            <MessageSquarePlus size={13} />
          </button>
        </span>
      </div>

      {/* Şart — conditional seçilince */}
      {status === "conditional" && (
        <div className="mt-2 pl-14">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-yellow-dark mb-1">
            Şart koşulu (zorunlu)
          </label>
          <textarea
            value={result?.condition ?? ""}
            onChange={(e) => onConditionChange(item.id, e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-xs rounded border border-yellow/30 bg-yellow/[0.04] focus:border-yellow focus:outline-none"
            placeholder="Örn: Pano kapağındaki conta yenilenecek..."
          />
        </div>
      )}

      {/* Açıklama */}
      {(noteOpen || result?.note) && (
        <div className="mt-2 pl-14">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-text3 mb-1">
            Açıklama / Tespit
          </label>
          <textarea
            value={result?.note ?? ""}
            onChange={(e) => onNoteChange(item.id, e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-xs rounded border border-border bg-white focus:border-accent focus:outline-none"
            placeholder="Eksik/hata detayı, ölçüm değeri, cihaz bilgisi..."
          />
        </div>
      )}

      {result?.updatedAt && status !== "pending" && (
        <div className="mt-1 pl-14 text-[9px] text-text3 font-mono">
          Son güncelleme: {formatDate(result.updatedAt)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Yardımcı bileşenler
// ─────────────────────────────────────────────────────────────────

function StatusButtons({
  currentStatus,
  onChange,
}: {
  currentStatus: TeslimAlmaStatus;
  onChange: (s: TeslimAlmaStatus) => void;
}) {
  const buttons: { status: TeslimAlmaStatus; label: string; icon: React.ElementType; activeClass: string; idleClass: string }[] = [
    {
      status: "ok",
      label: "Uygun",
      icon: Check,
      activeClass: "bg-green text-white border-green",
      idleClass: "bg-white text-green border-green/30 hover:bg-green/10",
    },
    {
      status: "fail",
      label: "Uygun Değil",
      icon: X,
      activeClass: "bg-red text-white border-red",
      idleClass: "bg-white text-red border-red/30 hover:bg-red/10",
    },
    {
      status: "conditional",
      label: "Şartlı",
      icon: CircleDot,
      activeClass: "bg-yellow text-white border-yellow",
      idleClass: "bg-white text-yellow-dark border-yellow/30 hover:bg-yellow/10",
    },
  ];
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden bg-white">
      {buttons.map((b) => {
        const active = currentStatus === b.status;
        const Ic = b.icon;
        return (
          <button
            key={b.status}
            onClick={() => onChange(active ? "pending" : b.status)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-bold border-r last:border-r-0 transition-colors",
              active ? b.activeClass : b.idleClass
            )}
            title={b.label}
          >
            <Ic size={11} />
            <span className="hidden sm:inline">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "major" | "minor" }) {
  if (severity === "major") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-red/10 text-red border border-red/25">
        Major
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-bg2 text-text2 border border-border">
      Minor
    </span>
  );
}

function StatChip({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: "green" | "red" | "yellow" | "gray";
}) {
  const tones = {
    green: "bg-green/10 text-green border-green/25",
    red: "bg-red/10 text-red border-red/25",
    yellow: "bg-yellow/12 text-yellow-dark border-yellow/30",
    gray: "bg-bg2 text-text2 border-border",
  };
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border", tones[tone])}>
      <Icon size={12} />
      <span className="font-mono font-extrabold text-sm">{value}</span>
      <span className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</span>
    </div>
  );
}

function MetaField({
  label,
  value,
  onChange,
  type = "text",
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: "text" | "number" | "date";
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-text3 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full px-3 py-1.5 text-sm rounded-md border border-border",
          readOnly ? "bg-bg2/40 text-text2 cursor-not-allowed" : "bg-white focus:border-accent focus:outline-none"
        )}
      />
    </div>
  );
}
