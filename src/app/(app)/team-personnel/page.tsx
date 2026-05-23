"use client";

import { useMemo, useState } from "react";
import {
  Users,
  Search,
  FileText,
  Building2,
  Activity,
  CheckCircle2,
  XCircle,
  Calendar,
  ArrowUpDown,
} from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { confirmAction } from "@/components/ui/confirm";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { formatDate, toISODate, cn } from "@/lib/utils";
import { downloadMasterListPDF } from "@/lib/pdf/master-list";
import type { Discipline } from "@/lib/store/types";

const DISCIPLINE_LABEL: Record<Discipline, string> = {
  mekanik: "Mekanik",
  elektrik: "Elektrik",
  insaat: "İnşaat",
  muhendislik: "Mühendislik",
  idari: "İdari",
  diger: "Diğer",
};

type StatusFilter = "active" | "exited";
type SortKey = "name" | "hireDate" | "assignedFrom";

export default function TeamPersonnelPage() {
  const project = useCurrentProject();
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const assignments = useStore((s) => s.personnelAssignments);
  const unassignPersonnel = useStore((s) => s.unassignPersonnel);

  const [search, setSearch] = useState("");
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("hireDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Bu projeye ait tüm atama kayıtları (her personel için multiple olabilir = re-hire)
  const projectId = project?.id;
  const projectAssignments = useMemo(
    () => (projectId ? assignments.filter((a) => a.projectId === projectId) : []),
    [assignments, projectId]
  );

  // Personnel-id → tüm assignment periodları (newest first)
  const assignmentsByPerson = useMemo(() => {
    const map: Record<string, typeof projectAssignments> = {};
    for (const a of projectAssignments) {
      if (!map[a.personnelMasterId]) map[a.personnelMasterId] = [];
      map[a.personnelMasterId].push(a);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => b.assignedFrom.localeCompare(a.assignedFrom));
    }
    return map;
  }, [projectAssignments]);

  // Bu projede atanmış / atanmıştı personel listesi
  const personById = new Map(personnel.map((p) => [p.id, p]));
  const allTeamRows = useMemo(() => {
    return Object.keys(assignmentsByPerson)
      .map((personnelId) => {
        const p = personById.get(personnelId);
        if (!p) return null;
        const periods = assignmentsByPerson[personnelId];
        // Şirketten çıkış (terminationDate) varsa atama hâlâ açık görünse bile "çıkış" sayılır.
        const isCurrentlyAssigned =
          !p.terminationDate && periods.some((a) => !a.assignedTo);
        const latest = periods[0];
        return {
          personnel: p,
          periods,
          isCurrentlyAssigned,
          latestAssignedFrom: latest?.assignedFrom ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentsByPerson, personnel]);

  // İstatistikler
  const stats = useMemo(() => {
    const active = allTeamRows.filter((r) => r.isCurrentlyAssigned).length;
    // Çıkış = aktif olmayan (atama bitmiş VEYA şirketten ayrılmış — ikisi de "çıkış" sayılır)
    const exited = allTeamRows.length - active;
    const companies = new Set(allTeamRows.map((r) => r.personnel.company));
    const disciplines = new Set(allTeamRows.map((r) => r.personnel.discipline));
    return {
      total: allTeamRows.length,
      active,
      exited,
      companies: companies.size,
      disciplines: disciplines.size,
    };
  }, [allTeamRows]);

  const allCompanies = useMemo(
    () => Array.from(new Set(allTeamRows.map((r) => r.personnel.company))).sort((a, b) => a.localeCompare(b, "tr")),
    [allTeamRows]
  );

  // Filtre + sıralama
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = allTeamRows.filter(({ personnel: p, isCurrentlyAssigned }) => {
      if (filterCompanies.length > 0 && !filterCompanies.includes(p.company)) return false;
      if (filterDisciplines.length > 0 && !filterDisciplines.includes(p.discipline)) return false;
      if (filterStatus.length > 0) {
        const sk: StatusFilter = isCurrentlyAssigned ? "active" : "exited";
        if (!filterStatus.includes(sk)) return false;
      }
      if (q) {
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          (p.tcKimlikNo || "").includes(q)
        );
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = `${a.personnel.firstName} ${a.personnel.lastName}`.localeCompare(
          `${b.personnel.firstName} ${b.personnel.lastName}`,
          "tr"
        );
      } else if (sortKey === "hireDate") {
        const ah = a.personnel.startDate ?? "0";
        const bh = b.personnel.startDate ?? "0";
        cmp = ah.localeCompare(bh);
      } else {
        const ah = a.latestAssignedFrom ?? "0";
        const bh = b.latestAssignedFrom ?? "0";
        cmp = ah.localeCompare(bh);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [allTeamRows, search, filterCompanies, filterDisciplines, filterStatus, sortKey, sortDir]);

  // Disiplin dağılımı
  const disciplineStats = useMemo(() => {
    const m: Record<string, { total: number; active: number; exited: number }> = {};
    for (const r of allTeamRows) {
      const d = r.personnel.discipline;
      if (!m[d]) m[d] = { total: 0, active: 0, exited: 0 };
      m[d].total++;
      if (r.isCurrentlyAssigned) m[d].active++;
      else m[d].exited++;
    }
    return Object.entries(m).map(([d, v]) => ({
      discipline: d as Discipline,
      count: v.total,
      active: v.active,
      exited: v.exited,
    }));
  }, [allTeamRows]);

  // Firma dağılımı
  const companyStats = useMemo(() => {
    const m: Record<string, { total: number; active: number; exited: number }> = {};
    for (const r of allTeamRows) {
      const c = r.personnel.company;
      if (!m[c]) m[c] = { total: 0, active: 0, exited: 0 };
      m[c].total++;
      if (r.isCurrentlyAssigned) m[c].active++;
      else m[c].exited++;
    }
    return Object.entries(m)
      .map(([c, v]) => ({ company: c, count: v.total, active: v.active, exited: v.exited }))
      .sort((a, b) => b.count - a.count);
  }, [allTeamRows]);

  async function exportPDF() {
    if (!project) return;
    const subtitle = [
      `${filtered.length} kişi · ${project.name}`,
      filterCompanies.length > 0 ? filterCompanies.join(", ") : "",
      filterStatus.length === 1 ? (filterStatus[0] === "active" ? "Aktif" : "Çıkış") : "",
      search ? `arama: ${search}` : "",
    ].filter(Boolean).join(" · ");

    await downloadMasterListPDF({
      title: "PROJE PERSONELİ",
      subtitle,
      tone: "purple",
      projectName: project.name,
      columns: [
        { key: "no", label: "#", width: "32px", align: "center", mono: true },
        { key: "name", label: "Ad Soyad", bold: true },
        { key: "company", label: "Firma" },
        { key: "discipline", label: "Disiplin", width: "85px" },
        { key: "jobTitle", label: "Görev" },
        { key: "hireDate", label: "İşe Giriş", mono: true, width: "90px" },
        { key: "assignedFrom", label: "Proje Başlangıç", mono: true, width: "100px" },
        { key: "periods", label: "Dönem", align: "center", mono: true, width: "55px" },
        { key: "status", label: "Durum", align: "center", width: "80px" },
      ],
      rows: filtered.map((r, i) => ({
        no: i + 1,
        name: `${r.personnel.firstName} ${r.personnel.lastName}`,
        company: r.personnel.company,
        discipline: DISCIPLINE_LABEL[r.personnel.discipline],
        jobTitle: r.personnel.jobTitle ?? "—",
        hireDate: r.personnel.startDate ?? "—",
        assignedFrom: r.latestAssignedFrom ? formatDate(r.latestAssignedFrom) : "—",
        periods: String(r.periods.length),
        status: r.isCurrentlyAssigned ? "Aktif" : "Çıkış",
      })),
      fileName: `proje-personel-${project.name.replace(/\s+/g, "-")}-${toISODate(new Date())}`,
    });
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
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
        title="Proje Personeli"
        description={`${project.name} · Geçmiş + Mevcut atamalar`}
        icon={Users}
        actions={
          <Button variant="outline" onClick={exportPDF}>
            <FileText size={14} /> PDF İndir
          </Button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiTile icon={Users} label="Toplam (Tüm Zamanlar)" value={String(stats.total)} sub={`${stats.active} aktif · ${stats.exited} çıkış`} tone="purple" />
        <KpiTile icon={CheckCircle2} label="Şu An Aktif" value={String(stats.active)} sub="Halen sahada" tone="accent" />
        <KpiTile icon={XCircle} label="Çıkış" value={String(stats.exited)} sub="Atama bitmiş veya şirketten ayrılmış" tone="red" />
        <KpiTile icon={Building2} label="Farklı Firma" value={String(stats.companies)} sub={companyStats[0]?.company ?? "—"} tone="blue" />
        <KpiTile icon={Activity} label="Disiplin Çeşidi" value={String(stats.disciplines)} sub="Mekanik · Elektrik..." tone="yellow" />
      </div>

      {/* Firma + Disiplin chip dağılımı */}
      {(companyStats.length > 0 || disciplineStats.length > 0) && (
        <Card className="mb-4 !p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">Firmaya Göre</div>
              <div className="flex flex-wrap gap-1.5">
                {companyStats.slice(0, 10).map((c) => (
                  <button
                    key={c.company}
                    onClick={() =>
                      setFilterCompanies((s) =>
                        s.includes(c.company) ? s.filter((x) => x !== c.company) : [...s, c.company]
                      )
                    }
                    title={`${c.company} · ${c.count} kişi (${c.active} aktif, ${c.exited} çıkış)`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-all",
                      filterCompanies.includes(c.company)
                        ? "border-accent bg-accent/8 ring-1 ring-accent/30 text-text"
                        : "border-border bg-bg2/40 text-text2 hover:border-accent/30 hover:bg-accent/5"
                    )}
                  >
                    <span>{c.company}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold">
                      <span className="text-text">{c.count}</span>
                      <span className="text-text3">·</span>
                      <span className="text-green">{c.active} aktif</span>
                      {c.exited > 0 && (
                        <>
                          <span className="text-text3">·</span>
                          <span className="text-red">{c.exited} çıkış</span>
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">Disiplin</div>
              <div className="flex flex-wrap gap-1.5">
                {disciplineStats.map((d) => (
                  <button
                    key={d.discipline}
                    onClick={() =>
                      setFilterDisciplines((s) =>
                        s.includes(d.discipline) ? s.filter((x) => x !== d.discipline) : [...s, d.discipline]
                      )
                    }
                    title={`${DISCIPLINE_LABEL[d.discipline]} · ${d.count} kişi (${d.active} aktif, ${d.exited} çıkış)`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-all",
                      filterDisciplines.includes(d.discipline)
                        ? "border-accent bg-accent/8 ring-1 ring-accent/30 text-text"
                        : "border-border bg-bg2/40 text-text2 hover:border-accent/30 hover:bg-accent/5"
                    )}
                  >
                    <span>{DISCIPLINE_LABEL[d.discipline]}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold">
                      <span className="text-text">{d.count}</span>
                      <span className="text-text3">·</span>
                      <span className="text-green">{d.active} aktif</span>
                      {d.exited > 0 && (
                        <>
                          <span className="text-text3">·</span>
                          <span className="text-red">{d.exited} çıkış</span>
                        </>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* KOMPAKT FİLTRE */}
      <div className="mb-4 rounded-xl border border-border bg-white px-3 py-2.5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="md:col-span-2">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">Ara</div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ad / soyad / firma / TC"
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
            label="Disiplin"
            placeholder="Tümü"
            options={Object.entries(DISCIPLINE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            selected={filterDisciplines}
            onChange={setFilterDisciplines}
          />
          <MultiSelectFilter
            label="Durum"
            placeholder="Hepsi"
            options={[
              { value: "active", label: "Aktif (sahada)" },
              { value: "exited", label: "Çıkış yapmış", sub: "Atama bitmiş veya şirketten ayrılmış" },
            ]}
            selected={filterStatus}
            onChange={(v) => setFilterStatus(v as StatusFilter[])}
          />
        </div>
        <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-text3">
            <strong className="text-text">{filtered.length}</strong> / {allTeamRows.length} kayıt
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-text3">Sırala:</span>
            <SortBtn label="İşe Giriş" active={sortKey === "hireDate"} dir={sortDir} onClick={() => toggleSort("hireDate")} />
            <SortBtn label="Proje Başlangıç" active={sortKey === "assignedFrom"} dir={sortDir} onClick={() => toggleSort("assignedFrom")} />
            <SortBtn label="İsim" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
            {(search || filterCompanies.length > 0 || filterDisciplines.length > 0 || filterStatus.length > 0) && (
              <button
                onClick={() => {
                  setSearch("");
                  setFilterCompanies([]);
                  setFilterDisciplines([]);
                  setFilterStatus([]);
                }}
                className="text-[11px] text-accent font-bold hover:underline ml-2"
              >
                Temizle ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TABLO */}
      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Ad Soyad</TH>
              <TH>Firma</TH>
              <TH>Disiplin / Görev</TH>
              <TH>İşe Giriş</TH>
              <TH>Proje Atama Dönemleri</TH>
              <TH className="text-center">Durum</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={6}>
                {allTeamRows.length === 0
                  ? "Bu projeye henüz personel atanmamış. Personel Master Data'dan atama yap."
                  : "Filtreyle eşleşen kayıt yok."}
              </Empty>
            ) : (
              filtered.map((r) => (
                <TR key={r.personnel.id}>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-text">{r.personnel.firstName} {r.personnel.lastName}</span>
                      {r.periods.length > 1 && (
                        <span
                          title={`Bu personel ${r.periods.length} farklı dönem atanmış`}
                          className="inline-flex items-center px-1 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-yellow/15 text-yellow"
                        >
                          ×{r.periods.length}
                        </span>
                      )}
                    </div>
                    {r.personnel.phone && (
                      <div className="text-[11px] text-text3 mt-0.5">{r.personnel.phone}</div>
                    )}
                    {r.personnel.terminationDate && (
                      <div className="text-[10px] text-red mt-0.5 font-mono">
                        Şirketten ayrılma: {r.personnel.terminationDate}
                      </div>
                    )}
                  </TD>
                  <TD className="text-xs">{r.personnel.company}</TD>
                  <TD>
                    <Badge variant="blue">{DISCIPLINE_LABEL[r.personnel.discipline]}</Badge>
                    {r.personnel.jobTitle && (
                      <div className="text-[11px] text-text3 mt-1">{r.personnel.jobTitle}</div>
                    )}
                  </TD>
                  <TD className="text-xs text-text2">
                    {r.personnel.startDate ? (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Calendar size={11} className="text-text3" />
                        {r.personnel.startDate}
                      </span>
                    ) : (
                      <span className="text-text3">—</span>
                    )}
                  </TD>
                  <TD>
                    <div className="flex flex-col gap-1">
                      {r.periods.map((a) => {
                        // Şirketten çıkış yapmışsa atama "açık" görünse bile pasif say.
                        const isActive = !a.assignedTo && !r.personnel.terminationDate;
                        // Sonu için gösterilecek metin
                        let endText: string;
                        if (a.assignedTo) endText = formatDate(a.assignedTo);
                        else if (r.personnel.terminationDate) endText = formatDate(r.personnel.terminationDate);
                        else endText = "devam";
                        return (
                          <div
                            key={a.id}
                            title={
                              r.personnel.terminationDate && !a.assignedTo
                                ? `Şirket çıkışı: ${r.personnel.terminationDate}`
                                : undefined
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono w-fit",
                              isActive
                                ? "bg-accent/10 text-accent font-semibold"
                                : "bg-bg2 text-text3"
                            )}
                          >
                            <span>{formatDate(a.assignedFrom)}</span>
                            <span>→</span>
                            <span>{endText}</span>
                            {isActive && (
                              <button
                                onClick={async () => {
                                  if (await confirmAction({
                                    title: `${r.personnel.firstName} ${r.personnel.lastName} çıkartılsın mı?`,
                                    message: "Bu personel projeden çıkarılır. Master listede kalır.",
                                    confirmText: "Çıkart",
                                  })) {
                                    unassignPersonnel(a.id);
                                  }
                                }}
                                title="Atamayı kaldır"
                                aria-label="Atamayı kaldır"
                                className="inline-flex items-center justify-center size-4 rounded-md hover:bg-red/15 hover:text-red transition-colors -mr-1"
                              >
                                <XCircle size={11} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TD>
                  <TD className="text-center">
                    {r.isCurrentlyAssigned ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green/10 text-green text-[10px] font-bold uppercase tracking-wider">
                        <span className="size-1.5 rounded-full bg-green animate-pulse-soft" />
                        Aktif
                      </span>
                    ) : (
                      <span
                        title={r.personnel.terminationDate ? `Şirketten ayrıldı: ${r.personnel.terminationDate}` : "Proje ataması sonlanmış"}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-red/10 text-red text-[10px] font-bold uppercase tracking-wider"
                      >
                        Çıkış
                      </span>
                    )}
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}

function SortBtn({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10.5px] font-semibold transition-colors",
        active
          ? "border-accent bg-accent/8 text-accent"
          : "border-border bg-white text-text2 hover:border-accent/30"
      )}
    >
      {label}
      {active && <ArrowUpDown size={10} className={cn(dir === "desc" && "rotate-180")} />}
    </button>
  );
}

const KPI_TONE: Record<string, { bg: string; text: string; iconBg: string }> = {
  accent: { bg: "bg-gradient-to-br from-accent/8 to-white", text: "text-accent", iconBg: "bg-accent/12 text-accent" },
  blue:   { bg: "bg-gradient-to-br from-blue/8 to-white",   text: "text-blue",   iconBg: "bg-blue/12 text-blue" },
  purple: { bg: "bg-gradient-to-br from-purple/8 to-white", text: "text-purple", iconBg: "bg-purple/12 text-purple" },
  yellow: { bg: "bg-gradient-to-br from-yellow/10 to-white", text: "text-yellow", iconBg: "bg-yellow/14 text-yellow" },
  red:    { bg: "bg-gradient-to-br from-red/8 to-white",     text: "text-red",     iconBg: "bg-red/12 text-red" },
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
      <div className={`font-mono text-[22px] font-extrabold tabular-nums leading-none ${t.text}`}>{value}</div>
      {sub && <div className="text-[11px] text-text3 mt-1.5 truncate">{sub}</div>}
    </div>
  );
}
