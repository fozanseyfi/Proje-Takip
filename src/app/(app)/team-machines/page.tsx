"use client";

import { useMemo, useState } from "react";
import { Truck, Search, FileText, Building2, Activity, CheckCircle2, XCircle, ArrowUpDown } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { formatDate, toISODate, cn } from "@/lib/utils";
import { downloadMasterListPDF } from "@/lib/pdf/master-list";
import type { MachineType } from "@/lib/store/types";

const TYPE_LABEL: Record<MachineType, string> = {
  ekskavator: "Ekskavatör",
  kamyon: "Kamyon",
  vinc: "Vinç",
  forklift: "Forklift",
  loder: "Loder",
  greyder: "Greyder",
  silindir: "Silindir",
  jenerator: "Jeneratör",
  diger: "Diğer",
};

type StatusFilter = "active" | "exited";
type SortKey = "name" | "assignedFrom";

export default function TeamMachinesPage() {
  const project = useCurrentProject();
  const machines = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);
  const assignments = useStore((s) => s.machineAssignments);
  const unassignMachine = useStore((s) => s.unassignMachine);

  const [search, setSearch] = useState("");
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<StatusFilter[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("assignedFrom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const projectId = project?.id;
  const projectAssignments = useMemo(
    () => (projectId ? assignments.filter((a) => a.projectId === projectId) : []),
    [assignments, projectId]
  );

  const assignmentsByMachine = useMemo(() => {
    const map: Record<string, typeof projectAssignments> = {};
    for (const a of projectAssignments) {
      if (!map[a.machineMasterId]) map[a.machineMasterId] = [];
      map[a.machineMasterId].push(a);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => b.assignedFrom.localeCompare(a.assignedFrom));
    }
    return map;
  }, [projectAssignments]);

  const machineById = new Map(machines.map((m) => [m.id, m]));
  const allRows = useMemo(() => {
    return Object.keys(assignmentsByMachine)
      .map((id) => {
        const m = machineById.get(id);
        if (!m) return null;
        const periods = assignmentsByMachine[id];
        // Makineden çıkış (terminationDate) varsa atama hâlâ açık görünse bile "çıkış" sayılır.
        const isCurrentlyAssigned =
          !m.terminationDate && periods.some((a) => !a.assignedTo);
        const latest = periods[0];
        return { machine: m, periods, isCurrentlyAssigned, latestAssignedFrom: latest?.assignedFrom ?? null };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentsByMachine, machines]);

  const stats = useMemo(() => {
    const active = allRows.filter((r) => r.isCurrentlyAssigned).length;
    const exited = allRows.length - active;
    const companies = new Set(allRows.map((r) => r.machine.company));
    const types = new Set(allRows.map((r) => r.machine.machineType));
    return { total: allRows.length, active, exited, companies: companies.size, types: types.size };
  }, [allRows]);

  // Firma / Tip dağılımı — aktif/çıkış sayılarıyla
  const companyStats = useMemo(() => {
    const m: Record<string, { total: number; active: number; exited: number }> = {};
    for (const r of allRows) {
      const c = r.machine.company;
      if (!m[c]) m[c] = { total: 0, active: 0, exited: 0 };
      m[c].total++;
      if (r.isCurrentlyAssigned) m[c].active++;
      else m[c].exited++;
    }
    return Object.entries(m)
      .map(([c, v]) => ({ company: c, count: v.total, active: v.active, exited: v.exited }))
      .sort((a, b) => b.count - a.count);
  }, [allRows]);

  const typeStats = useMemo(() => {
    const m: Record<string, { total: number; active: number; exited: number }> = {};
    for (const r of allRows) {
      const t = r.machine.machineType;
      if (!m[t]) m[t] = { total: 0, active: 0, exited: 0 };
      m[t].total++;
      if (r.isCurrentlyAssigned) m[t].active++;
      else m[t].exited++;
    }
    return Object.entries(m)
      .map(([t, v]) => ({ type: t as MachineType, count: v.total, active: v.active, exited: v.exited }))
      .sort((a, b) => b.count - a.count);
  }, [allRows]);

  const allCompanies = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.machine.company))).sort((a, b) => a.localeCompare(b, "tr")),
    [allRows]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let rows = allRows.filter(({ machine: m, isCurrentlyAssigned }) => {
      if (filterCompanies.length > 0 && !filterCompanies.includes(m.company)) return false;
      if (filterTypes.length > 0 && !filterTypes.includes(m.machineType)) return false;
      if (filterStatus.length > 0) {
        const sk: StatusFilter = isCurrentlyAssigned ? "active" : "exited";
        if (!filterStatus.includes(sk)) return false;
      }
      if (q) {
        return (
          m.name.toLowerCase().includes(q) ||
          m.company.toLowerCase().includes(q) ||
          (m.licensePlate ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.machine.name.localeCompare(b.machine.name, "tr");
      } else {
        cmp = (a.latestAssignedFrom ?? "0").localeCompare(b.latestAssignedFrom ?? "0");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [allRows, search, filterCompanies, filterTypes, filterStatus, sortKey, sortDir]);

  async function exportPDF() {
    if (!project) return;
    const subtitle = [
      `${filtered.length} makine · ${project.name}`,
      filterCompanies.length > 0 ? filterCompanies.join(", ") : "",
      search ? `arama: ${search}` : "",
    ].filter(Boolean).join(" · ");

    await downloadMasterListPDF({
      title: "PROJE MAKİNELERİ",
      subtitle,
      tone: "yellow",
      projectName: project.name,
      columns: [
        { key: "no", label: "#", width: "32px", align: "center", mono: true },
        { key: "name", label: "Makine", bold: true },
        { key: "type", label: "Tip", width: "85px" },
        { key: "plate", label: "Plaka", mono: true, width: "90px" },
        { key: "company", label: "Firma" },
        { key: "assignedFrom", label: "Proje Başlangıç", mono: true, width: "100px" },
        { key: "periods", label: "Dönem", align: "center", mono: true, width: "55px" },
        { key: "status", label: "Durum", align: "center", width: "80px" },
      ],
      rows: filtered.map((r, i) => ({
        no: i + 1,
        name: r.machine.name,
        type: TYPE_LABEL[r.machine.machineType],
        plate: r.machine.licensePlate ?? "—",
        company: r.machine.company,
        assignedFrom: r.latestAssignedFrom ? formatDate(r.latestAssignedFrom) : "—",
        periods: String(r.periods.length),
        status: r.isCurrentlyAssigned ? "Aktif" : "Çıkış",
      })),
      fileName: `proje-makine-${project.name.replace(/\s+/g, "-")}-${toISODate(new Date())}`,
    });
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
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
        title="Proje Makineleri"
        description={`${project.name} · Geçmiş + Mevcut atamalar`}
        icon={Truck}
        actions={<Button variant="outline" onClick={exportPDF}><FileText size={14} /> PDF İndir</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiTile icon={Truck} label="Toplam (Tüm Zamanlar)" value={String(stats.total)} sub={`${stats.active} aktif · ${stats.exited} çıkış`} tone="yellow" />
        <KpiTile icon={CheckCircle2} label="Şu An Aktif" value={String(stats.active)} sub="Sahada" tone="accent" />
        <KpiTile icon={XCircle} label="Çıkış" value={String(stats.exited)} sub="Atama bitmiş veya ayrılmış" tone="red" />
        <KpiTile icon={Building2} label="Firma" value={String(stats.companies)} sub="Sahip firmalar" tone="blue" />
        <KpiTile icon={Activity} label="Tip" value={String(stats.types)} sub="Makine tipi" tone="purple" />
      </div>

      {/* Firma + Tip dağılım chip'leri — her birinde aktif/çıkış sayısı */}
      {(companyStats.length > 0 || typeStats.length > 0) && (
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
                    title={`${c.company} · ${c.count} makine (${c.active} aktif, ${c.exited} çıkış)`}
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
              <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">Tipe Göre</div>
              <div className="flex flex-wrap gap-1.5">
                {typeStats.map((t) => (
                  <button
                    key={t.type}
                    onClick={() =>
                      setFilterTypes((s) =>
                        s.includes(t.type) ? s.filter((x) => x !== t.type) : [...s, t.type]
                      )
                    }
                    title={`${TYPE_LABEL[t.type]} · ${t.count} makine (${t.active} aktif, ${t.exited} çıkış)`}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-all",
                      filterTypes.includes(t.type)
                        ? "border-purple bg-purple/8 ring-1 ring-purple/30 text-text"
                        : "border-border bg-bg2/40 text-text2 hover:border-purple/30 hover:bg-purple/5"
                    )}
                  >
                    <span>{TYPE_LABEL[t.type]}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold">
                      <span className="text-text">{t.count}</span>
                      <span className="text-text3">·</span>
                      <span className="text-green">{t.active} aktif</span>
                      {t.exited > 0 && (
                        <>
                          <span className="text-text3">·</span>
                          <span className="text-red">{t.exited} çıkış</span>
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

      <div className="mb-4 rounded-xl border border-border bg-white px-3 py-2.5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="md:col-span-2">
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">Ara</div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="isim / firma / plaka"
                className="w-full h-8 pl-7 pr-2 text-xs rounded-md border border-border2 focus:outline-none focus:border-accent focus:shadow-focus placeholder:text-text3"
              />
            </div>
          </div>
          <MultiSelectFilter label="Firma" placeholder="Tümü" options={allCompanies.map((c) => ({ value: c, label: c }))} selected={filterCompanies} onChange={setFilterCompanies} />
          <MultiSelectFilter label="Tip" placeholder="Tümü" options={Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))} selected={filterTypes} onChange={setFilterTypes} />
          <MultiSelectFilter label="Durum" placeholder="Hepsi" options={[{ value: "active", label: "Aktif" }, { value: "exited", label: "Çıkış" }]} selected={filterStatus} onChange={(v) => setFilterStatus(v as StatusFilter[])} />
        </div>
        <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <div className="text-[11px] text-text3">
            <strong className="text-text">{filtered.length}</strong> / {allRows.length} kayıt
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-text3">Sırala:</span>
            <SortBtn label="Proje Başlangıç" active={sortKey === "assignedFrom"} dir={sortDir} onClick={() => toggleSort("assignedFrom")} />
            <SortBtn label="İsim" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
            {(search || filterCompanies.length > 0 || filterTypes.length > 0 || filterStatus.length > 0) && (
              <button
                onClick={() => { setSearch(""); setFilterCompanies([]); setFilterTypes([]); setFilterStatus([]); }}
                className="text-[11px] text-accent font-bold hover:underline ml-2"
              >
                Temizle ×
              </button>
            )}
          </div>
        </div>
      </div>

      <TableWrap>
        <Table>
          <THead>
            <TR>
              <TH>Makine</TH>
              <TH>Tip</TH>
              <TH>Plaka</TH>
              <TH>Firma</TH>
              <TH>Proje Atama Dönemleri</TH>
              <TH className="text-center">Durum</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={6}>
                {allRows.length === 0
                  ? "Bu projeye henüz makine atanmamış. Makine Master Data'dan atama yap."
                  : "Filtreyle eşleşen kayıt yok."}
              </Empty>
            ) : (
              filtered.map((r) => (
                <TR key={r.machine.id}>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-text">{r.machine.name}</span>
                      {r.periods.length > 1 && (
                        <span className="inline-flex items-center px-1 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-yellow/15 text-yellow">
                          ×{r.periods.length}
                        </span>
                      )}
                    </div>
                  </TD>
                  <TD><Badge variant="purple">{TYPE_LABEL[r.machine.machineType]}</Badge></TD>
                  <TD className="font-mono text-xs">{r.machine.licensePlate || "—"}</TD>
                  <TD className="text-xs">{r.machine.company}</TD>
                  <TD>
                    <div className="flex flex-col gap-1">
                      {r.periods.map((a) => {
                        const isActive = !a.assignedTo && !r.machine.terminationDate;
                        let endText: string;
                        if (a.assignedTo) endText = formatDate(a.assignedTo);
                        else if (r.machine.terminationDate) endText = formatDate(r.machine.terminationDate);
                        else endText = "devam";
                        return (
                          <div
                            key={a.id}
                            title={
                              r.machine.terminationDate && !a.assignedTo
                                ? `Makine ayrılışı: ${r.machine.terminationDate}`
                                : undefined
                            }
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono w-fit",
                              isActive ? "bg-yellow/15 text-yellow font-semibold" : "bg-bg2 text-text3"
                            )}
                          >
                            <span>{formatDate(a.assignedFrom)}</span>
                            <span>→</span>
                            <span>{endText}</span>
                            {isActive && (
                              <button
                                onClick={() => {
                                  if (confirm(`${r.machine.name} bu projeden çıkartılsın mı?`)) {
                                    unassignMachine(a.id);
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
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red/10 text-red text-[10px] font-bold uppercase tracking-wider">
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

function SortBtn({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 h-6 rounded-md border text-[10.5px] font-semibold transition-colors",
        active ? "border-accent bg-accent/8 text-accent" : "border-border bg-white text-text2 hover:border-accent/30"
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
