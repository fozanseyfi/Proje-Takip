"use client";

import { useMemo, useState } from "react";
import { Building2, Search, FileText, Briefcase, Activity, Users } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { formatDate, formatMoney, toISODate, cn } from "@/lib/utils";
import { downloadMasterListPDF } from "@/lib/pdf/master-list";
import type { Subcontractor } from "@/lib/store/types";

const STATUS_LABEL: Record<Subcontractor["status"], string> = {
  aktif: "Aktif",
  tamamlandi: "Tamamlandı",
  askida: "Askıda",
  iptal: "İptal",
};
const STATUS_VARIANT: Record<Subcontractor["status"], "green" | "blue" | "yellow" | "red"> = {
  aktif: "green",
  tamamlandi: "blue",
  askida: "yellow",
  iptal: "red",
};

export default function TeamSubcontractorsPage() {
  const project = useCurrentProject();
  const allSubs = useStore((s) => s.subcontractors);
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const personnelAssignments = useStore((s) => s.personnelAssignments);

  const [search, setSearch] = useState("");
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const projectId = project?.id;
  const projectSubs = useMemo(
    () => (projectId ? allSubs.filter((s) => s.projectId === projectId) : []),
    [allSubs, projectId]
  );

  // Firma × bu projedeki personel sayısı (aktif atanmış)
  const companyPersonnelCount = useMemo(() => {
    if (!projectId) return {} as Record<string, number>;
    const m: Record<string, number> = {};
    const personById = new Map(personnel.map((p) => [p.id, p]));
    for (const a of personnelAssignments) {
      if (a.assignedTo) continue;
      if (a.projectId !== projectId) continue;
      const p = personById.get(a.personnelMasterId);
      if (!p) continue;
      m[p.company] = (m[p.company] ?? 0) + 1;
    }
    return m;
  }, [personnelAssignments, personnel, projectId]);

  const allCompanies = useMemo(
    () => Array.from(new Set(projectSubs.map((s) => s.name))).sort((a, b) => a.localeCompare(b, "tr")),
    [projectSubs]
  );

  const stats = useMemo(() => {
    const total = projectSubs.length;
    const aktif = projectSubs.filter((s) => s.status === "aktif").length;
    const tamamlandi = projectSubs.filter((s) => s.status === "tamamlandi").length;
    const totalAmount = projectSubs.reduce((s, x) => s + x.contractAmount, 0);
    const uniqueCompanies = new Set(projectSubs.map((s) => s.name)).size;
    return { total, aktif, tamamlandi, totalAmount, uniqueCompanies };
  }, [projectSubs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return projectSubs.filter((s) => {
      if (filterCompanies.length > 0 && !filterCompanies.includes(s.name)) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(s.status)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.scopeOfWork.toLowerCase().includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q)
      );
    });
  }, [projectSubs, search, filterCompanies, filterStatuses]);

  async function exportPDF() {
    if (!project) return;
    const subtitle = [
      `${filtered.length} firma · ${project.name}`,
      filterCompanies.length > 0 ? filterCompanies.join(", ") : "",
      filterStatuses.length > 0 ? filterStatuses.map((s) => STATUS_LABEL[s as Subcontractor["status"]]).join(", ") : "",
      search ? `arama: ${search}` : "",
    ].filter(Boolean).join(" · ");

    await downloadMasterListPDF({
      title: "PROJE ALT YÜKLENİCİLERİ",
      subtitle,
      tone: "blue",
      projectName: project.name,
      columns: [
        { key: "no", label: "#", width: "32px", align: "center", mono: true },
        { key: "company", label: "Firma", bold: true },
        { key: "scope", label: "İş Kapsamı" },
        { key: "contractAmount", label: "Sözleşme", align: "right", mono: true, width: "110px" },
        { key: "contractDate", label: "Sözleşme Tarihi", mono: true, width: "100px" },
        { key: "personnel", label: "Personel", align: "center", mono: true, width: "65px" },
        { key: "status", label: "Durum", align: "center", width: "85px" },
      ],
      rows: filtered.map((s, i) => ({
        no: i + 1,
        company: s.name,
        scope: s.scopeOfWork,
        contractAmount: formatMoney(s.contractAmount, s.currency, 0),
        contractDate: formatDate(s.contractDate),
        personnel: String(companyPersonnelCount[s.name] ?? 0),
        status: STATUS_LABEL[s.status],
      })),
      fileName: `proje-altyuklenici-${project.name.replace(/\s+/g, "-")}-${toISODate(new Date())}`,
    });
  }

  if (!project) {
    return (
      <Card>
        <p className="text-sm text-text2">Proje seçili değil.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Proje Alt Yüklenicileri"
        description={`${project.name} · ${stats.uniqueCompanies} farklı firma · ${stats.total} sözleşme`}
        icon={Building2}
        actions={<Button variant="outline" onClick={exportPDF}><FileText size={14} /> PDF İndir</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiTile icon={Building2} label="Toplam Sözleşme" value={String(stats.total)} sub={`${stats.uniqueCompanies} farklı firma`} tone="blue" />
        <KpiTile icon={Briefcase} label="Aktif" value={String(stats.aktif)} sub="Devam eden" tone="accent" />
        <KpiTile icon={Activity} label="Tamamlanan" value={String(stats.tamamlandi)} sub="Bitmiş sözleşme" tone="purple" />
        <KpiTile icon={Users} label="Toplam Tutar" value={formatMoney(stats.totalAmount, "TRY", 0)} sub="Sözleşme bedeli" tone="yellow" />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-white px-3 py-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="md:col-span-2">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">Ara</div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="firma / kapsam / iletişim"
                className="w-full h-8 pl-7 pr-2 text-xs rounded-md border border-border2 focus:outline-none focus:border-accent focus:shadow-focus placeholder:text-text3"
              />
            </div>
          </div>
          <MultiSelectFilter
            label="Firma"
            placeholder="Tümü"
            options={allCompanies.map((c) => ({ value: c, label: c }))}
            selected={filterCompanies}
            onChange={setFilterCompanies}
          />
          <MultiSelectFilter
            label="Durum"
            placeholder="Tümü"
            options={[
              { value: "aktif", label: "Aktif" },
              { value: "tamamlandi", label: "Tamamlandı" },
              { value: "askida", label: "Askıda" },
              { value: "iptal", label: "İptal" },
            ]}
            selected={filterStatuses}
            onChange={setFilterStatuses}
          />
        </div>
        {(search || filterCompanies.length > 0 || filterStatuses.length > 0) && (
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-text3">
              <strong className="text-text">{filtered.length}</strong> / {projectSubs.length} sözleşme
            </div>
            <button
              onClick={() => { setSearch(""); setFilterCompanies([]); setFilterStatuses([]); }}
              className="text-[11px] text-accent font-bold hover:underline"
            >
              Filtreleri Temizle ×
            </button>
          </div>
        )}
      </div>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Firma</TH>
              <TH>İş Kapsamı</TH>
              <TH className="text-right">Sözleşme</TH>
              <TH>Tarih</TH>
              <TH className="text-center">Personel</TH>
              <TH className="text-center">Durum</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={6}>
                {projectSubs.length === 0
                  ? "Bu projeye henüz alt yüklenici eklenmemiş. Alt Yüklenici Master Data'dan ekleyebilirsin."
                  : "Filtreyle eşleşen kayıt yok."}
              </Empty>
            ) : (
              filtered.map((s) => {
                const personnelCount = companyPersonnelCount[s.name] ?? 0;
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="font-semibold text-text">{s.name}</div>
                      <div className="text-[11px] text-text3 mt-0.5">
                        {s.contactName && <span>{s.contactName}</span>}
                        {s.phone && <span className="ml-2">{s.phone}</span>}
                      </div>
                    </TD>
                    <TD className="text-xs text-text2 max-w-[24rem]">
                      <div className="truncate" title={s.scopeOfWork}>{s.scopeOfWork}</div>
                      {s.discipline && <Badge variant="blue" className="mt-1">{s.discipline}</Badge>}
                    </TD>
                    <TD className="text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(s.contractAmount, s.currency, 0)}
                    </TD>
                    <TD className="font-mono text-[11px] text-text3 whitespace-nowrap">
                      {formatDate(s.contractDate)}
                    </TD>
                    <TD className="text-center">
                      {personnelCount > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[11px] font-bold">
                          <Users size={11} /> {personnelCount}
                        </span>
                      ) : (
                        <span className="text-text3 text-[11px]">—</span>
                      )}
                    </TD>
                    <TD className="text-center">
                      <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}

const KPI_TONE: Record<string, { bg: string; text: string; iconBg: string }> = {
  accent: { bg: "bg-gradient-to-br from-accent/8 to-white", text: "text-accent", iconBg: "bg-accent/12 text-accent" },
  blue:   { bg: "bg-gradient-to-br from-blue/8 to-white",   text: "text-blue",   iconBg: "bg-blue/12 text-blue" },
  purple: { bg: "bg-gradient-to-br from-purple/8 to-white", text: "text-purple", iconBg: "bg-purple/12 text-purple" },
  yellow: { bg: "bg-gradient-to-br from-yellow/10 to-white", text: "text-yellow", iconBg: "bg-yellow/14 text-yellow" },
};

function KpiTile({
  icon: Icon, label, value, sub, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string; tone: keyof typeof KPI_TONE;
}) {
  const t = KPI_TONE[tone];
  return (
    <div className={`rounded-xl border border-border ${t.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text3">{label}</span>
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${t.iconBg}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className={`font-mono text-[22px] font-extrabold tabular-nums leading-none ${t.text}`}>{value}</div>
      {sub && <div className="text-[11px] text-text3 mt-1.5 truncate">{sub}</div>}
    </div>
  );
}
