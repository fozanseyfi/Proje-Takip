"use client";

import { useMemo, useState } from "react";
import { Cog, Plus, Pencil, Trash2, Search, Truck, FileText, Briefcase, Building2, Activity, FolderKanban, Fuel, ClipboardList, ChevronDown } from "lucide-react";
import { useStore, useCurrentUser, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { formatMoney, toISODate, cn } from "@/lib/utils";
import { downloadMasterListPDF } from "@/lib/pdf/master-list";
import { downloadMachineDocumentChecklistPDF } from "@/lib/pdf/hr-templates";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { useToast } from "@/components/ui/toast";
import type { MachineMaster, MachineType, FuelType } from "@/lib/store/types";
import type { Currency } from "@/lib/utils";

const MACHINE_TYPE_LABEL: Record<MachineType, string> = {
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

const FUEL_LABEL: Record<FuelType, string> = {
  dizel: "Dizel",
  benzin: "Benzin",
  elektrik: "Elektrik",
  diger: "Diğer",
};

export default function MachinesMasterPage() {
  const machines = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);
  const projects = useStore((s) => s.projects);
  const subcontractors = useStore((s) => s.subcontractors);
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const machineAttendance = useStore((s) => s.machineAttendance);
  const user = useCurrentUser();
  const assignments = useStore((s) => s.machineAssignments);
  const addMachine = useStore((s) => s.addMachine);
  const updateMachine = useStore((s) => s.updateMachine);
  const softDeleteMachine = useStore((s) => s.softDeleteMachine);
  const assignMachine = useStore((s) => s.assignMachine);
  const unassignMachine = useStore((s) => s.unassignMachine);
  const toast = useToast((s) => s.push);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<MachineMaster | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]); // "active" | "separated"
  const [legalExpanded, setLegalExpanded] = useState(false);
  const currentProject = useCurrentProject();

  async function downloadDocList() {
    try {
      await downloadMachineDocumentChecklistPDF({ projectName: currentProject?.name });
      toast("Makine Belgeleri Listesi indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    }
  }
  const [assignDialogFor, setAssignDialogFor] = useState<MachineMaster | null>(null);

  // Makine → atandığı projeler
  const machineProjectMap = useMemo(() => {
    const m: Record<string, { active: string[]; past: string[] }> = {};
    for (const a of assignments) {
      if (!m[a.machineMasterId]) m[a.machineMasterId] = { active: [], past: [] };
      if (!a.assignedTo) m[a.machineMasterId].active.push(a.projectId);
      else m[a.machineMasterId].past.push(a.projectId);
    }
    return m;
  }, [assignments]);

  const projectAssignedCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assignments) {
      if (!a.assignedTo) m[a.projectId] = (m[a.projectId] ?? 0) + 1;
    }
    return projects.map((p) => ({ project: p, count: m[p.id] ?? 0 }));
  }, [assignments, projects]);

  function projectName(id: string): string {
    return projects.find((p) => p.id === id)?.name ?? "—";
  }

  function isAssignedToProject(machineId: string, projectId: string) {
    return assignments.some(
      (a) => a.machineMasterId === machineId && a.projectId === projectId && !a.assignedTo
    );
  }

  function toggleProjectAssignment(machineMasterId: string, projectId: string) {
    const ex = assignments.find(
      (a) => a.machineMasterId === machineMasterId && a.projectId === projectId && !a.assignedTo
    );
    if (ex) {
      unassignMachine(ex.id);
      toast("Atama kaldırıldı.", "info");
    } else {
      const p = projects.find((x) => x.id === projectId);
      assignMachine({
        projectId,
        machineMasterId,
        assignedFrom: p?.reportDate ?? toISODate(new Date()),
      });
      toast(`${p?.name ?? "Proje"}'ye atandı.`, "success");
    }
  }

  // Operatör adaylar — autocomplete için { id, fullName, company } map'i
  const personnelOptions = useMemo(
    () =>
      personnel.map((p) => ({
        id: p.id,
        fullName: `${p.firstName} ${p.lastName}`.trim(),
        company: p.company,
      })),
    [personnel]
  );

  // Toplam mazot tüketimi — tüm makine puantaj kayıtlarından
  const totalFuel = useMemo(() => {
    let sum = 0;
    for (const a of machineAttendance) {
      if (a.fuelConsumed && a.fuelConsumed > 0) sum += a.fuelConsumed;
    }
    return sum;
  }, [machineAttendance]);

  // Bu ay tüketim
  const monthFuel = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let sum = 0;
    for (const a of machineAttendance) {
      if (a.fuelConsumed && a.fuelConsumed > 0 && a.date.startsWith(ym)) {
        sum += a.fuelConsumed;
      }
    }
    return sum;
  }, [machineAttendance]);

  // Şirket listesi — kullanıcı sadece bu listeden seçer, serbest yazamaz.
  //   1) Her projenin "Ana Yüklenici (Panel Sahibi)" adı
  //   2) Tüm alt yüklenicilerin firma adları
  //   3) Mevcut makine kayıtlarında geçen firmalar (geriye dönük)
  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    for (const p of projects) {
      if (p.mainContractorName && p.mainContractorName.trim()) {
        set.add(p.mainContractorName.trim());
      }
    }
    for (const s of subcontractors) {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    }
    for (const m of machines) {
      if (m.company && m.company.trim()) set.add(m.company.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [projects, subcontractors, machines]);

  const stats = useMemo(() => {
    const total = machines.length;
    const active = machines.filter((m) => m.status === "active").length;
    const assignedSet = new Set(assignments.filter((a) => !a.assignedTo).map((a) => a.machineMasterId));
    const assigned = assignedSet.size;
    const companies = new Set(machines.map((m) => m.company));
    return { total, active, assigned, companies: companies.size };
  }, [machines, assignments]);

  const companyStats = useMemo(() => {
    const byCompany: Record<string, number> = {};
    for (const m of machines) byCompany[m.company] = (byCompany[m.company] ?? 0) + 1;
    return Object.entries(byCompany)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count);
  }, [machines]);

  const typeStats = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const m of machines) byType[m.machineType] = (byType[m.machineType] ?? 0) + 1;
    return Object.entries(byType)
      .map(([t, count]) => ({ type: t as MachineType, count }))
      .sort((a, b) => b.count - a.count);
  }, [machines]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return machines.filter((m) => {
      if (filterTypes.length > 0 && !filterTypes.includes(m.machineType)) return false;
      if (filterCompanies.length > 0 && !filterCompanies.includes(m.company)) return false;
      if (filterStatus.length > 0) {
        const isSeparated = !!m.terminationDate || m.status === "inactive";
        const flag = isSeparated ? "separated" : "active";
        if (!filterStatus.includes(flag)) return false;
      }
      if (filterProjects.length > 0) {
        const list = machineProjectMap[m.id];
        const has = list?.active.some((pid) => filterProjects.includes(pid)) ?? false;
        if (!has) return false;
      }
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.company.toLowerCase().includes(q) ||
        (m.licensePlate || "").toLowerCase().includes(q)
      );
    });
  }, [machines, search, filterTypes, filterCompanies, filterProjects, filterStatus, machineProjectMap]);

  async function exportPDF() {
    const subtitle = [
      `${filtered.length} kayıt`,
      filterStatus.length === 1
        ? filterStatus[0] === "active" ? "Aktif" : "Ayrılmış"
        : "",
      filterTypes.length > 0 ? filterTypes.map((t) => MACHINE_TYPE_LABEL[t as MachineType]).join(", ") : "",
      filterCompanies.length > 0 ? filterCompanies.join(", ") : "",
      filterProjects.length > 0 ? `Proje: ${filterProjects.map(projectName).join(", ")}` : "",
      search ? `arama: ${search}` : "",
    ].filter(Boolean).join(" · ");

    await downloadMasterListPDF({
      title: "MAKİNE MASTER DATA",
      subtitle,
      tone: "accent",
      projectName: filterProjects.length === 1 ? projectName(filterProjects[0]) : undefined,
      columns: [
        { key: "no", label: "#", width: "30px", align: "center", mono: true },
        { key: "name", label: "İsim / Makine", bold: true },
        { key: "type", label: "Tip", width: "85px" },
        { key: "plate", label: "Plaka", mono: true, width: "85px" },
        { key: "company", label: "Firma" },
        { key: "fuel", label: "Yakıt", width: "70px", align: "center" },
        { key: "startDate", label: "İş Başı", mono: true, width: "78px", align: "center" },
        { key: "termDate", label: "Ayrılış", mono: true, width: "82px", align: "center" },
        { key: "status", label: "Durum", width: "75px", align: "center", bold: true },
      ],
      rows: filtered.map((m, i) => {
        const status = m.terminationDate
          ? "Ayrıldı"
          : m.status === "active"
          ? "Çalışıyor"
          : "Pasif";
        return {
          no: i + 1,
          name: m.name,
          type: MACHINE_TYPE_LABEL[m.machineType],
          plate: m.licensePlate || "—",
          company: m.company,
          fuel: m.fuelType ? FUEL_LABEL[m.fuelType] : "—",
          startDate: m.startDate || "—",
          termDate: m.terminationDate || "—",
          status,
        };
      }),
      fileName: `makine-listesi-${toISODate(new Date())}`,
    });
  }

  return (
    <>
      <PageHeader
        title="Makine Master Data"
        description={`${machines.length} kayıtlı makine · Tüm projeler ortak havuz`}
        icon={Cog}
        actions={
          <>
            <Button variant="outline" onClick={downloadDocList}>
              <ClipboardList size={14} /> Belgeler Listesi
            </Button>
            <Button variant="primary" onClick={exportPDF}>
              <FileText size={14} /> PDF İndir
            </Button>
            <Button variant="accent" onClick={() => setCreating(true)}>
              <Plus size={14} /> Yeni Makine
            </Button>
          </>
        }
      />

      <Alert variant="warning" className="mb-4">
        <div className="text-[12px] leading-relaxed">
          <div className="font-bold text-text mb-1.5 uppercase tracking-wider text-[11px]">
            İşveren Yükümlülüğü — Eksik Belgeli Makine Çalıştırma Yasaktır
          </div>
          <div className="mb-2">
            Makine kaydı yaparken ruhsat (tescil, trafik sigortası, kasko, emisyon),
            periyodik kontrol (yıllık muayene raporu, bakım kayıtları) ve operatör
            belgelerinin (G sınıfı ehliyet, psikoteknik, sağlık raporu, İSG eğitimi){" "}
            <strong>tamamı</strong> mutlaka alınmalı ve dosyaya işlenmelidir.{" "}
            <strong>Belgeler Listesi</strong> butonundan kontrol listesini indir, makine
            sahibine/operatöre ver.
          </div>
          <button
            type="button"
            onClick={() => setLegalExpanded((v) => !v)}
            className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors text-yellow hover:text-yellow/80"
            aria-expanded={legalExpanded}
          >
            <ChevronDown
              size={12}
              className={cn("transition-transform", legalExpanded && "rotate-180")}
            />
            {legalExpanded ? "Mevzuatı gizle" : "İlgili mevzuatı (işveren cezalarını) göster"}
          </button>
          {legalExpanded && (
            <div className="mt-2 pt-2 border-t border-yellow/30 text-[11px] leading-relaxed">
              <div className="font-bold mb-1">İlgili mevzuat (işveren cezaları):</div>
              <ul className="space-y-0.5 pl-3">
                <li>
                  • <strong>6331 sayılı İSG Kanunu Md. 30</strong> — Periyodik kontrolü yapılmamış
                  iş ekipmanı çalıştırılamaz; her ekipman için idari para cezası.
                </li>
                <li>
                  • <strong>İş Ekipmanlarının Kullanımında Sağlık ve Güvenlik Şartları
                  Yönetmeliği</strong> — Yıllık muayene zorunlu; sürekli kayıt tutulmalı.
                </li>
                <li>
                  • <strong>2918 sayılı Karayolları Trafik Kanunu Md. 36</strong> — Tescilsiz/
                  sigortasız iş makinesi trafiğe çıkamaz; yüksek idari ceza + makinenin trafikten
                  men edilmesi.
                </li>
                <li>
                  • <strong>2918 Md. 91</strong> — Geçerli trafik sigortası olmaksızın araç
                  kullanmak: araç bağlama + ağır idari ceza.
                </li>
                <li>
                  • <strong>6331 Md. 17 (Operatör)</strong> — İSG eğitimi alınmamış operatör
                  çalıştırılamaz; G sınıfı operatör belgesi olmadan iş makinesi kullanımı yasak.
                </li>
                <li>
                  • <strong>4857 sayılı İş Kanunu Md. 77</strong> — Belgesiz makine ile iş kazası
                  → işveren <strong>tam kusurlu</strong> sayılır, sigorta rücu hakkı kaybolur.
                </li>
              </ul>
              <div className="mt-2 font-semibold">
                Sonuç: Eksik belgeli makine çalıştırma ⇒ idari para cezası + iş kazasında{" "}
                <strong>cezai sorumluluk (TCK Md. 22, 85)</strong> + sigorta rücu hakkı kaybı.
              </div>
            </div>
          )}
        </div>
      </Alert>

      {/* KPI ÖZET ŞERİDİ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiTile icon={Truck} label="Toplam Makine" value={String(stats.total)} sub={`${stats.active} aktif`} tone="yellow" />
        <KpiTile icon={Briefcase} label="Atanmış (Aktif Proje)" value={String(stats.assigned)} sub={`${stats.total - stats.assigned} havuzda`} tone="blue" />
        <KpiTile icon={Building2} label="Farklı Firma" value={String(stats.companies)} sub={`${companyStats[0]?.company ?? "—"} en kalabalık`} tone="purple" />
        <KpiTile icon={Activity} label="Makine Tipi" value={String(typeStats.length)} sub={typeStats[0] ? `${MACHINE_TYPE_LABEL[typeStats[0].type]} en çok` : "—"} tone="accent" />
        <KpiTile
          icon={Fuel}
          label="Toplam Mazot"
          value={`${totalFuel.toLocaleString("tr-TR")} L`}
          sub={`Bu ay ${monthFuel.toLocaleString("tr-TR")} L`}
          tone="red"
        />
      </div>

      {/* PROJE BAZLI ATANMIŞ MAKİNE */}
      {projectAssignedCounts.length > 0 && (
        <Card className="mb-4 !p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-text3">
              Hangi Projede Kaç Makine Atanmış
            </div>
            <div className="text-[10px] text-text3 font-mono">{projectAssignedCounts.length} proje</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {projectAssignedCounts.map((pc) => (
              <button
                key={pc.project.id}
                onClick={() =>
                  setFilterProjects((s) =>
                    s.includes(pc.project.id) ? s.filter((x) => x !== pc.project.id) : [...s, pc.project.id]
                  )
                }
                className={cn(
                  "text-left rounded-lg border px-3 py-2 transition-all",
                  filterProjects.includes(pc.project.id)
                    ? "border-yellow bg-yellow/8 ring-1 ring-yellow/30"
                    : "border-border bg-white hover:border-yellow/30 hover:bg-yellow/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <FolderKanban size={12} className="text-text3" />
                  <span className="font-mono text-base font-extrabold text-yellow tabular-nums leading-none">
                    {pc.count}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-text mt-1 truncate">{pc.project.name}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* TİP DAĞILIMI MİNİ */}
      {typeStats.length > 0 && (
        <Card className="mb-4 !p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">
            Tipe Göre Dağılım
          </div>
          <div className="flex flex-wrap gap-2">
            {typeStats.map((t) => {
              const pct = stats.total > 0 ? (t.count / stats.total) * 100 : 0;
              return (
                <div
                  key={t.type}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border bg-bg2/40"
                >
                  <span className="text-[11.5px] font-semibold text-text">{MACHINE_TYPE_LABEL[t.type]}</span>
                  <span className="font-mono text-[10px] font-bold text-yellow tabular-nums">
                    {t.count}
                  </span>
                  <span className="text-[9px] text-text3 font-mono">%{pct.toFixed(0)}</span>
                </div>
              );
            })}
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
                placeholder="isim / firma / plaka"
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
            label="Proje (aktif)"
            placeholder="Tüm projeler"
            options={projects.map((p) => ({ value: p.id, label: p.name, sub: p.location }))}
            selected={filterProjects}
            onChange={setFilterProjects}
          />
          <MultiSelectFilter
            label="Tip"
            placeholder="Tüm tipler"
            options={Object.entries(MACHINE_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))}
            selected={filterTypes}
            onChange={setFilterTypes}
          />
          <MultiSelectFilter
            label="Durum"
            placeholder="Aktif + Ayrılmış"
            options={[
              { value: "active", label: "Aktif", sub: "Çalışıyor" },
              { value: "separated", label: "Ayrılmış", sub: "Pasif" },
            ]}
            selected={filterStatus}
            onChange={setFilterStatus}
          />
        </div>
        {(search || filterTypes.length > 0 || filterCompanies.length > 0 || filterProjects.length > 0 || filterStatus.length > 0) && (
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-text3">
              <strong className="text-text">{filtered.length}</strong> / {machines.length} kayıt
            </div>
            <button
              onClick={() => {
                setSearch("");
                setFilterTypes([]);
                setFilterCompanies([]);
                setFilterProjects([]);
                setFilterStatus([]);
              }}
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
              <TH>İsim</TH>
              <TH>Tip</TH>
              <TH>Plaka</TH>
              <TH>Firma</TH>
              <TH>Operatör</TH>
              <TH>Yakıt</TH>
              <TH className="text-right">Yevmiye</TH>
              <TH>Proje Ataması</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={9}>{search ? `"${search}" eşleşmesi yok.` : "Henüz makine eklenmemiş."}</Empty>
            ) : (
              filtered.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{m.name}</span>
                      {m.terminationDate ? (
                        <span
                          title={`Ayrıldı: ${m.terminationDate}`}
                          className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-red/10 text-red"
                        >
                          Ayrıldı
                        </span>
                      ) : m.status === "active" ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-green/10 text-green">
                          <span className="size-1 rounded-full bg-green" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-bg2 text-text3">
                          Pasif
                        </span>
                      )}
                    </div>
                    {(m.startDate || m.terminationDate) && (
                      <div className="text-[11px] text-text3 mt-0.5">
                        {m.startDate && (
                          <span>
                            İş başı: <strong className="text-text2 font-mono">{m.startDate}</strong>
                          </span>
                        )}
                        {m.terminationDate && (
                          <span className="ml-2 text-red">
                            Ayrıldı: <strong className="font-mono">{m.terminationDate}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <Badge variant="purple">{m.machineType}</Badge>
                  </TD>
                  <TD className="font-mono text-xs">{m.licensePlate || "—"}</TD>
                  <TD className="text-xs">{m.company}</TD>
                  <TD className="text-xs">
                    {m.operatorPersonnelId
                      ? personnelOptions.find((p) => p.id === m.operatorPersonnelId)?.fullName ?? <span className="text-text3">—</span>
                      : <span className="text-text3">—</span>}
                  </TD>
                  <TD className="text-xs text-text3">{m.fuelType || "—"}</TD>
                  <TD className="text-right font-mono text-xs">
                    {m.dailyRate ? formatMoney(m.dailyRate, m.dailyRateCurrency || "TRY") : "—"}
                  </TD>
                  <TD>
                    {(() => {
                      const map = machineProjectMap[m.id];
                      const activeProjects = map?.active ?? [];
                      const pastProjects = map?.past ?? [];
                      return (
                        <div className="flex flex-wrap gap-1 items-center">
                          {activeProjects.length === 0 && pastProjects.length === 0 ? (
                            <span className="text-text3 text-[11px]">Atama yok</span>
                          ) : (
                            <>
                              {activeProjects.map((pid) => (
                                <span
                                  key={pid}
                                  title={projectName(pid)}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow/15 text-yellow text-[10px] font-bold uppercase tracking-wider max-w-[120px]"
                                >
                                  <FolderKanban size={9} />
                                  <span className="truncate">{projectName(pid)}</span>
                                </span>
                              ))}
                              {pastProjects.length > 0 && (
                                <span
                                  title={`Geçmiş: ${pastProjects.map(projectName).join(", ")}`}
                                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-bg2 text-text3 text-[10px] font-bold uppercase tracking-wider"
                                >
                                  +{pastProjects.length} geç.
                                </span>
                              )}
                            </>
                          )}
                          <button
                            onClick={() => setAssignDialogFor(m)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-text3 text-text3 hover:text-accent hover:border-accent text-[10px] font-bold uppercase tracking-wider"
                          >
                            <Plus size={9} /> Ata
                          </button>
                        </div>
                      );
                    })()}
                  </TD>
                  <TD>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(m)} className="p-1 text-text3 hover:text-accent rounded">
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`${m.name} silinsin mi?`)) softDeleteMachine(m.id);
                        }}
                        className="p-1 text-text3 hover:text-red rounded"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </TableWrap>

      <MachineForm
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          if (!user) return;
          addMachine({ ...data, ownerUserId: user.id });
          setCreating(false);
        }}
        companies={allCompanies}
        personnelOptions={personnelOptions}
      />
      {/* PROJE ATAMA DİYALOGU */}
      <Dialog
        open={!!assignDialogFor}
        onClose={() => setAssignDialogFor(null)}
        title={assignDialogFor ? `Proje Ataması — ${assignDialogFor.name}` : "Proje Ataması"}
        size="md"
      >
        {assignDialogFor && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-text2 mb-3">
              Bu makineyi hangi projelere atamak/çıkarmak istersin?
            </p>
            {projects.length === 0 ? (
              <div className="text-sm text-text3 py-4 text-center">Önce proje oluştur.</div>
            ) : (
              projects.map((pr) => {
                const active = isAssignedToProject(assignDialogFor.id, pr.id);
                return (
                  <div
                    key={pr.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-all",
                      active ? "border-yellow/40 bg-yellow/5" : "border-border bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderKanban size={14} className="text-text3 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text truncate">{pr.name}</div>
                        <div className="text-[11px] text-text3 truncate">{pr.location}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={active ? "accent" : "outline"}
                      onClick={() => toggleProjectAssignment(assignDialogFor.id, pr.id)}
                    >
                      {active ? "Atanmış · Kaldır" : "+ Ata"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setAssignDialogFor(null)}>Kapat</Button>
        </DialogFooter>
      </Dialog>

      <MachineForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          updateMachine(editing.id, data);
          setEditing(null);
        }}
        companies={allCompanies}
        personnelOptions={personnelOptions}
      />
    </>
  );
}

function MachineForm({
  open,
  initial,
  onClose,
  onSubmit,
  companies,
  personnelOptions,
}: {
  open: boolean;
  initial?: MachineMaster;
  onClose: () => void;
  onSubmit: (
    data: Omit<MachineMaster, "id" | "ownerUserId" | "createdAt" | "updatedAt" | "deletedAt">
  ) => void;
  companies?: string[];
  personnelOptions?: { id: string; fullName: string; company: string }[];
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [machineType, setMachineType] = useState<MachineType>(initial?.machineType ?? "diger");
  const [licensePlate, setLicensePlate] = useState(initial?.licensePlate ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [fuelType, setFuelType] = useState<FuelType | "">(initial?.fuelType ?? "");
  const [dailyRate, setDailyRate] = useState<string>(initial?.dailyRate?.toString() ?? "");
  const [dailyRateCurrency, setDailyRateCurrency] = useState<Currency>(
    initial?.dailyRateCurrency ?? "TRY"
  );
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "active");
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? "");
  const [terminationDate, setTerminationDate] = useState<string>(initial?.terminationDate ?? "");
  // Operatör autocomplete state'i
  const [operatorPersonnelId, setOperatorPersonnelId] = useState<string | undefined>(
    initial?.operatorPersonnelId
  );
  const initialOperatorName =
    initial?.operatorPersonnelId
      ? personnelOptions?.find((p) => p.id === initial.operatorPersonnelId)?.fullName ?? ""
      : "";
  const [operatorSearch, setOperatorSearch] = useState(initialOperatorName);
  const [operatorOpen, setOperatorOpen] = useState(false);

  // Eşleşen personeller — sadece arama metni 3+ karakterse listele
  const matchedOperators = useMemo(() => {
    const q = operatorSearch.trim().toLowerCase();
    if (q.length < 3) return [];
    return (personnelOptions ?? [])
      .filter((p) => p.fullName.toLowerCase().includes(q))
      .slice(0, 20);
  }, [operatorSearch, personnelOptions]);

  // Eğer operatorSearch geçerli bir isimle birebir eşleşmiyorsa, operatorPersonnelId
  // sıfırlanır (kullanıcı listeden seçmeden manuel yazıyor → kabul etme)
  function selectOperator(p: { id: string; fullName: string }) {
    setOperatorPersonnelId(p.id);
    setOperatorSearch(p.fullName);
    setOperatorOpen(false);
  }
  function clearOperator() {
    setOperatorPersonnelId(undefined);
    setOperatorSearch("");
    setOperatorOpen(false);
  }

  function submit() {
    if (!name || !company) return;
    onSubmit({
      name,
      machineType,
      licensePlate: licensePlate || undefined,
      company,
      operatorPersonnelId,
      fuelType: (fuelType || undefined) as FuelType | undefined,
      dailyRate: dailyRate ? Number(dailyRate) : undefined,
      dailyRateCurrency: dailyRate ? dailyRateCurrency : undefined,
      status,
      startDate: startDate || undefined,
      terminationDate: terminationDate || undefined,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Makine Düzenle" : "Yeni Makine"} size="md">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="İsim">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Komatsu PC200" />
        </Field>
        <Field label="Tip">
          <Select value={machineType} onChange={(e) => setMachineType(e.target.value as MachineType)}>
            <option value="ekskavator">Ekskavatör</option>
            <option value="kamyon">Kamyon</option>
            <option value="vinc">Vinç</option>
            <option value="forklift">Forklift</option>
            <option value="loder">Loder</option>
            <option value="greyder">Greyder</option>
            <option value="silindir">Silindir</option>
            <option value="jenerator">Jeneratör</option>
            <option value="diger">Diğer</option>
          </Select>
        </Field>
        <Field label="Plaka">
          <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="34 ABC 123" />
        </Field>
        <Field
          label="Operatör"
          hint={
            operatorPersonnelId
              ? "✓ Seçildi — listede yoksa silip yeniden ara."
              : "En az 3 harf yaz, açılan listeden seç. Sadece personel master'daki kişiler seçilebilir."
          }
          className="sm:col-span-2"
        >
          <div className="relative">
            <Input
              value={operatorSearch}
              onChange={(e) => {
                setOperatorSearch(e.target.value);
                setOperatorOpen(true);
                if (operatorPersonnelId) setOperatorPersonnelId(undefined);
              }}
              onFocus={() => setOperatorOpen(true)}
              onBlur={() => setTimeout(() => setOperatorOpen(false), 200)}
              placeholder="örn. Ahmet Demir"
              className={cn(
                operatorPersonnelId && "border-green-500 bg-green-50"
              )}
            />
            {operatorSearch && (
              <button
                type="button"
                onClick={clearOperator}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-5 inline-flex items-center justify-center rounded hover:bg-bg2 text-text3 hover:text-red"
                title="Temizle"
              >
                ×
              </button>
            )}
            {operatorOpen && operatorSearch.trim().length >= 3 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-medium max-h-56 overflow-y-auto">
                {matchedOperators.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-text3 text-center">
                    Eşleşen personel yok — Personel Master&apos;dan ekle.
                  </div>
                ) : (
                  matchedOperators.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectOperator(p)}
                      className="w-full text-left px-3 py-2 hover:bg-bg2 border-b border-border last:border-b-0"
                    >
                      <div className="text-xs font-semibold text-text">{p.fullName}</div>
                      <div className="text-[10px] text-text3">{p.company}</div>
                    </button>
                  ))
                )}
              </div>
            )}
            {operatorSearch.trim().length > 0 &&
              operatorSearch.trim().length < 3 &&
              operatorOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-border rounded-lg px-3 py-2 text-[11px] text-text3">
                  En az 3 harf yaz...
                </div>
              )}
          </div>
        </Field>
        <Field
          label="Firma *"
          hint={
            companies && companies.length > 0
              ? "Sadece sistemde tanımlı şirketler seçilebilir."
              : "Önce bir şirket tanımla: Proje Ayarları → 'Ana Yüklenici' veya Alt Yüklenici Master'dan ekle."
          }
        >
          <Select value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">— Şirket seç —</option>
            {(companies ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Yakıt Tipi">
          <Select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)}>
            <option value="">—</option>
            <option value="dizel">Dizel</option>
            <option value="benzin">Benzin</option>
            <option value="elektrik">Elektrik</option>
            <option value="diger">Diğer</option>
          </Select>
        </Field>
        <Field label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </Select>
        </Field>
        <Field label="İş Başı Tarihi" hint="Sahaya/firmaya giriş tarihi">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="Ayrıldığı Tarih" hint="Boşsa hâlâ aktif">
          <Input
            type="date"
            value={terminationDate}
            onChange={(e) => setTerminationDate(e.target.value)}
          />
        </Field>
        <Field label="Günlük Yevmiye" className="sm:col-span-2">
          <div className="flex gap-2">
            <Input
              type="number"
              className="flex-1"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
            />
            <Select
              className="w-24"
              value={dailyRateCurrency}
              onChange={(e) => setDailyRateCurrency(e.target.value as Currency)}
            >
              <option value="TRY">TRY</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </Select>
          </div>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={submit}
          disabled={!name || !company}
          title={!company ? "Şirket seçilmeli" : undefined}
        >
          Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
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
      <div className={`font-mono text-[24px] font-extrabold tabular-nums leading-none ${t.text}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-text3 mt-1.5 truncate">{sub}</div>}
    </div>
  );
}
