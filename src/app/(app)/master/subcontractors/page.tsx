"use client";

import { useMemo, useState } from "react";
import {
  Truck,
  Plus,
  Search,
  FolderKanban,
  Building2,
  Briefcase,
  Activity,
  FileText,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { confirmAction } from "@/components/ui/confirm";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { formatMoney, formatDate, toISODate, cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { downloadMasterListPDF } from "@/lib/pdf/master-list";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { Subcontractor, Discipline } from "@/lib/store/types";
import type { Currency } from "@/lib/utils";

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

export default function SubcontractorsMasterPage() {
  const subs = useStore((s) => s.subcontractors);
  const projects = useStore((s) => s.projects);
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const personnelAssignments = useStore((s) => s.personnelAssignments);
  const addSubcontractor = useStore((s) => s.addSubcontractor);
  const updateSubcontractor = useStore((s) => s.updateSubcontractor);
  const deleteSubcontractor = useStore((s) => s.deleteSubcontractor);
  const user = useCurrentUser();
  const toast = useToast((s) => s.push);

  const [search, setSearch] = useState("");
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [editing, setEditing] = useState<Subcontractor | null>(null);
  const [creating, setCreating] = useState(false);

  function projectName(id: string): string {
    return projects.find((p) => p.id === id)?.name ?? "—";
  }

  // Toplam istatistikler
  const stats = useMemo(() => {
    const uniqueCompanies = new Set(subs.map((s) => s.name));
    const projectIds = new Set(subs.map((s) => s.projectId));
    const total = subs.length;
    const aktif = subs.filter((s) => s.status === "aktif").length;
    return {
      total,
      aktif,
      uniqueCompanies: uniqueCompanies.size,
      activeProjects: projectIds.size,
    };
  }, [subs]);

  // Firma × Proje matrisi: hangi firma hangi projelerde çalışmış
  const companyProjects = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const s of subs) {
      if (!map[s.name]) map[s.name] = new Set();
      map[s.name].add(s.projectId);
    }
    return Object.entries(map)
      .map(([company, projectIds]) => ({ company, projectCount: projectIds.size, projectIds: Array.from(projectIds) }))
      .sort((a, b) => b.projectCount - a.projectCount);
  }, [subs]);

  // Proje × Firma sayısı
  const projectCompanyCount = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const s of subs) {
      if (!map[s.projectId]) map[s.projectId] = new Set();
      map[s.projectId].add(s.name);
    }
    return projects
      .map((p) => ({ project: p, count: map[p.id]?.size ?? 0 }))
      .filter((x) => x.count > 0);
  }, [subs, projects]);

  // Personel × Firma: her firmanın hangi projede kaç kişisi var
  // (PersonnelAssignments aktif olanlardan personel master üzerinden company alarak hesaplanır)
  const companyPersonnelByProject = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    const personById = new Map(personnel.map((p) => [p.id, p]));
    for (const a of personnelAssignments) {
      if (a.assignedTo) continue; // sadece aktif
      const p = personById.get(a.personnelMasterId);
      if (!p) continue;
      if (!m[p.company]) m[p.company] = {};
      m[p.company][a.projectId] = (m[p.company][a.projectId] ?? 0) + 1;
    }
    return m;
  }, [personnelAssignments, personnel]);

  // Tüm firma listesi (filter dropdown)
  const allCompanies = useMemo(() => {
    return Array.from(new Set(subs.map((s) => s.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
  }, [subs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return subs.filter((s) => {
      if (filterCompanies.length > 0 && !filterCompanies.includes(s.name)) return false;
      if (filterProjects.length > 0 && !filterProjects.includes(s.projectId)) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(s.status)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.scopeOfWork.toLowerCase().includes(q) ||
        (s.taxNo ?? "").includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q)
      );
    });
  }, [subs, search, filterCompanies, filterProjects, filterStatuses]);

  async function exportPDF() {
    const subtitle = [
      `${filtered.length} kayıt`,
      filterCompanies.length > 0 ? filterCompanies.join(", ") : "",
      filterProjects.length > 0 ? `Proje: ${filterProjects.map(projectName).join(", ")}` : "",
      filterStatuses.length > 0
        ? filterStatuses.map((s) => STATUS_LABEL[s as Subcontractor["status"]]).join(", ")
        : "",
      search ? `arama: ${search}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    await downloadMasterListPDF({
      title: "ALT YÜKLENİCİ MASTER DATA",
      subtitle,
      tone: "blue",
      projectName: filterProjects.length === 1 ? projectName(filterProjects[0]) : undefined,
      columns: [
        { key: "no", label: "#", width: "32px", align: "center", mono: true },
        { key: "company", label: "Firma", bold: true },
        { key: "project", label: "Proje" },
        { key: "scope", label: "İş Kapsamı" },
        { key: "contractAmount", label: "Sözleşme Tutarı", align: "right", mono: true, width: "120px" },
        { key: "contractDate", label: "Sözleşme", mono: true, width: "85px" },
        { key: "status", label: "Durum", align: "center", width: "85px" },
      ],
      rows: filtered.map((s, i) => ({
        no: i + 1,
        company: s.name,
        project: projectName(s.projectId),
        scope: s.scopeOfWork,
        contractAmount: formatMoney(s.contractAmount, s.currency, 0),
        contractDate: formatDate(s.contractDate),
        status: STATUS_LABEL[s.status],
      })),
      fileName: `alt-yuklenici-master-${toISODate(new Date())}`,
    });
  }

  return (
    <>
      <PageHeader
        title="Alt Yüklenici Master Data"
        description={`${subs.length} sözleşme · ${stats.uniqueCompanies} farklı firma`}
        icon={Truck}
        actions={
          <>
            <Button variant="outline" onClick={exportPDF}>
              <FileText size={14} /> PDF İndir
            </Button>
            <Button variant="accent" onClick={() => setCreating(true)}>
              <Plus size={14} /> Yeni Sözleşme
            </Button>
          </>
        }
      />

      {/* KPI ŞERİDİ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiTile icon={Building2} label="Toplam Sözleşme" value={String(stats.total)} sub={`${stats.aktif} aktif`} tone="accent" />
        <KpiTile icon={Briefcase} label="Farklı Firma" value={String(stats.uniqueCompanies)} sub={companyProjects[0]?.company ?? "—"} tone="blue" />
        <KpiTile icon={FolderKanban} label="Aktif Proje" value={String(stats.activeProjects)} sub="Sözleşmeli" tone="purple" />
        <KpiTile icon={Activity} label="Statü Çeşidi" value={String(new Set(subs.map((s) => s.status)).size)} sub="Aktif · Tamam. · İptal" tone="yellow" />
      </div>

      {/* PROJE × FİRMA SAYISI */}
      {projectCompanyCount.length > 0 && (
        <Card className="mb-4 !p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">
            Hangi Projede Kaç Alt Yüklenici Çalışmış
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {projectCompanyCount.map(({ project, count }) => (
              <button
                key={project.id}
                onClick={() =>
                  setFilterProjects((s) =>
                    s.includes(project.id) ? s.filter((x) => x !== project.id) : [...s, project.id]
                  )
                }
                className={cn(
                  "text-left rounded-lg border px-3 py-2 transition-all",
                  filterProjects.includes(project.id)
                    ? "border-accent bg-accent/8 ring-1 ring-accent/30"
                    : "border-border bg-white hover:border-accent/30 hover:bg-accent/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <FolderKanban size={12} className="text-text3" />
                  <span className="font-mono text-base font-extrabold text-accent tabular-nums leading-none">
                    {count}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-text mt-1 truncate">{project.name}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* FİRMA × KAÇ PROJE */}
      {companyProjects.length > 0 && (
        <Card className="mb-4 !p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">
            Firma · Çalıştığı Proje Sayısı
          </div>
          <div className="flex flex-wrap gap-2">
            {companyProjects.slice(0, 16).map((c) => (
              <button
                key={c.company}
                onClick={() =>
                  setFilterCompanies((s) =>
                    s.includes(c.company) ? s.filter((x) => x !== c.company) : [...s, c.company]
                  )
                }
                className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all",
                  filterCompanies.includes(c.company)
                    ? "border-accent bg-accent/8 ring-1 ring-accent/30"
                    : "border-border bg-bg2/40 hover:border-accent/30 hover:bg-accent/5"
                )}
                title={c.projectIds.map(projectName).join(", ")}
              >
                <span className="text-[11.5px] font-semibold text-text">{c.company}</span>
                <span className="font-mono text-[10px] font-bold text-accent tabular-nums">{c.projectCount} proje</span>
                {companyPersonnelByProject[c.company] && (
                  <span className="font-mono text-[9px] text-text3">
                    {Object.values(companyPersonnelByProject[c.company]).reduce((s, n) => s + n, 0)} kişi
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* KOMPAKT FİLTRE */}
      <div className="mb-4 rounded-xl border border-border bg-white px-3 py-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
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
            placeholder="Tüm firmalar"
            options={allCompanies.map((c) => ({ value: c, label: c }))}
            selected={filterCompanies}
            onChange={setFilterCompanies}
          />
          <MultiSelectFilter
            label="Proje"
            placeholder="Tüm projeler"
            options={projects.map((p) => ({ value: p.id, label: p.name, sub: p.location }))}
            selected={filterProjects}
            onChange={setFilterProjects}
          />
          <MultiSelectFilter
            label="Durum"
            placeholder="Tüm durumlar"
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
        {(search || filterCompanies.length > 0 || filterProjects.length > 0 || filterStatuses.length > 0) && (
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-text3">
              <strong className="text-text">{filtered.length}</strong> / {subs.length} kayıt
            </div>
            <button
              onClick={() => {
                setSearch("");
                setFilterCompanies([]);
                setFilterProjects([]);
                setFilterStatuses([]);
              }}
              className="text-[11px] text-accent font-bold hover:underline"
            >
              Filtreleri Temizle ×
            </button>
          </div>
        )}
      </div>

      {/* TABLO */}
      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Firma</TH>
              <TH>Proje</TH>
              <TH>İş Kapsamı</TH>
              <TH className="text-right">Sözleşme Tutarı</TH>
              <TH>Sözleşme</TH>
              <TH>Durum</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={7}>
                {search || filterCompanies.length > 0 || filterProjects.length > 0 || filterStatuses.length > 0
                  ? "Filtreyle eşleşen kayıt yok."
                  : "Henüz alt yüklenici eklenmemiş."}
              </Empty>
            ) : (
              filtered.map((s) => {
                const personnelCount = companyPersonnelByProject[s.name]?.[s.projectId] ?? 0;
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="font-semibold text-text">{s.name}</div>
                      <div className="text-[11px] text-text3 mt-0.5">
                        {s.contactName && <span>{s.contactName}</span>}
                        {s.phone && <span className="ml-2">{s.phone}</span>}
                      </div>
                    </TD>
                    <TD>
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg2 text-[11px] font-semibold text-text2">
                        <FolderKanban size={11} className="text-text3" />
                        {projectName(s.projectId)}
                      </div>
                      {personnelCount > 0 && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-text3 font-mono">
                          <Users size={9} /> {personnelCount} kişi
                        </div>
                      )}
                    </TD>
                    <TD className="text-xs text-text2 max-w-[20rem]">
                      <div className="truncate" title={s.scopeOfWork}>{s.scopeOfWork}</div>
                      {s.discipline && (
                        <Badge variant="blue" className="mt-1">{s.discipline}</Badge>
                      )}
                    </TD>
                    <TD className="text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(s.contractAmount, s.currency, 0)}
                    </TD>
                    <TD className="font-mono text-[11px] text-text3 whitespace-nowrap">
                      {formatDate(s.contractDate)}
                    </TD>
                    <TD>
                      <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
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
                              message: "Alt yüklenici ve bu firmanın TÜM faturaları silinecek. Bu işlem geri alınamaz.",
                              danger: true,
                              confirmText: "Sil",
                            })) {
                              deleteSubcontractor(s.id);
                              toast("Alt yüklenici silindi.", "info");
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

      <SubcontractorForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          if (!user) return;
          addSubcontractor(data);
          setCreating(false);
          toast("Alt yüklenici eklendi.", "success");
        }}
        projects={projects}
        companies={allCompanies}
      />
      <SubcontractorForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          updateSubcontractor(editing.id, data);
          setEditing(null);
          toast("Alt yüklenici güncellendi.", "success");
        }}
        projects={projects}
        companies={allCompanies}
      />
    </>
  );
}

function SubcontractorForm({
  open,
  initial,
  onClose,
  onSubmit,
  projects,
  companies,
}: {
  open: boolean;
  initial?: Subcontractor;
  onClose: () => void;
  onSubmit: (data: Omit<Subcontractor, "id" | "createdAt" | "updatedAt">) => void;
  projects: { id: string; name: string }[];
  companies: string[];
}) {
  const [projectId, setProjectId] = useState(initial?.projectId ?? projects[0]?.id ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [taxNo, setTaxNo] = useState(initial?.taxNo ?? "");
  const [contactName, setContactName] = useState(initial?.contactName ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [scopeOfWork, setScopeOfWork] = useState(initial?.scopeOfWork ?? "");
  const [discipline, setDiscipline] = useState<Discipline | "">(initial?.discipline ?? "");
  const [contractAmount, setContractAmount] = useState<string>(initial?.contractAmount?.toString() ?? "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "TRY");
  const [contractDate, setContractDate] = useState(initial?.contractDate ?? toISODate(new Date()));
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [status, setStatus] = useState<Subcontractor["status"]>(initial?.status ?? "aktif");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const datalistId = `sub-companies-${initial?.id ?? "new"}`;

  function submit() {
    if (!projectId || !name || !scopeOfWork) return;
    onSubmit({
      projectId,
      name: name.trim(),
      taxNo: taxNo || undefined,
      contactName: contactName || undefined,
      phone: phone || undefined,
      email: email || undefined,
      scopeOfWork: scopeOfWork.trim(),
      discipline: (discipline || undefined) as Discipline | undefined,
      contractAmount: Number(contractAmount) || 0,
      currency,
      contractDate,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
      notes: notes || undefined,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Alt Yüklenici Düzenle" : "Yeni Alt Yüklenici"} size="lg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Proje">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Proje seç —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Firma Adı" hint="Mevcuttan seç veya yeni firma yaz">
          <Input value={name} onChange={(e) => setName(e.target.value)} list={datalistId} />
          {companies.length > 0 && (
            <datalist id={datalistId}>
              {companies.map((c) => <option key={c} value={c} />)}
            </datalist>
          )}
        </Field>
        <Field label="Vergi No">
          <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
        </Field>
        <Field label="İletişim Kişi">
          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </Field>
        <Field label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="E-posta">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="İş Kapsamı" className="sm:col-span-2">
          <Input value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} placeholder="Örn. Kablo serim ve montaj" />
        </Field>
        <Field label="Disiplin">
          <Select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline | "")}>
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
            <Input type="number" value={contractAmount} onChange={(e) => setContractAmount(e.target.value)} className="flex-1" />
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="w-24">
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </div>
        </Field>
        <Field label="Sözleşme Tarihi">
          <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
        </Field>
        <Field label="İş Başlangıç">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="İş Bitiş (planlı)">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value as Subcontractor["status"])}>
            <option value="aktif">Aktif</option>
            <option value="tamamlandi">Tamamlandı</option>
            <option value="askida">Askıda</option>
            <option value="iptal">İptal</option>
          </Select>
        </Field>
        <Field label="Notlar" className="sm:col-span-2">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button variant="accent" onClick={submit}>Kaydet</Button>
      </DialogFooter>
    </Dialog>
  );
}

const KPI_TONE: Record<string, { bg: string; text: string; iconBg: string }> = {
  accent: { bg: "bg-gradient-to-br from-accent/8 to-white", text: "text-accent", iconBg: "bg-accent/12 text-accent" },
  blue:   { bg: "bg-gradient-to-br from-blue/8 to-white",   text: "text-blue",   iconBg: "bg-blue/12 text-blue" },
  purple: { bg: "bg-gradient-to-br from-purple/8 to-white", text: "text-purple", iconBg: "bg-purple/12 text-purple" },
  yellow: { bg: "bg-gradient-to-br from-yellow/10 to-white", text: "text-yellow", iconBg: "bg-yellow/14 text-yellow" },
};

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: keyof typeof KPI_TONE;
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
      <div className={`font-mono text-[24px] font-extrabold tabular-nums leading-none ${t.text}`}>{value}</div>
      {sub && <div className="text-[11px] text-text3 mt-1.5 truncate">{sub}</div>}
    </div>
  );
}
