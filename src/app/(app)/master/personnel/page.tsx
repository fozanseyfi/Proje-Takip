"use client";

import { useMemo, useState } from "react";
import { UserCog, Plus, Pencil, Trash2, Search, FolderKanban, FileText, ClipboardList, AlertCircle, FileBadge, ChevronDown, FolderHeart, ShieldCheck, Lock } from "lucide-react";
import { useStore, useCurrentUser, useCurrentProject } from "@/lib/store";
import { Users, Briefcase, Building2, Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { confirmAction } from "@/components/ui/confirm";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { toISODate, cn } from "@/lib/utils";
import { downloadMasterListPDF } from "@/lib/pdf/master-list";
import { HR_TEMPLATES, downloadHRTemplatePDF, downloadDocumentChecklistPDF, type HRTemplate } from "@/lib/pdf/hr-templates";
import { useToast } from "@/components/ui/toast";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { PersonnelMaster, Discipline } from "@/lib/store/types";
import type { Currency } from "@/lib/utils";

const DISCIPLINE_LABEL_TR: Record<Discipline, string> = {
  mekanik: "Mekanik",
  elektrik: "Elektrik",
  insaat: "İnşaat",
  muhendislik: "Mühendislik",
  idari: "İdari",
  diger: "Diğer",
};

export default function PersonnelMasterPage() {
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const projects = useStore((s) => s.projects);
  const subcontractors = useStore((s) => s.subcontractors);
  const user = useCurrentUser();
  const assignments = useStore((s) => s.personnelAssignments);
  const addPersonnel = useStore((s) => s.addPersonnel);
  const updatePersonnel = useStore((s) => s.updatePersonnel);
  const softDeletePersonnel = useStore((s) => s.softDeletePersonnel);
  const assignPersonnel = useStore((s) => s.assignPersonnel);
  const unassignPersonnel = useStore((s) => s.unassignPersonnel);
  const toast = useToast((s) => s.push);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PersonnelMaster | null>(null);
  const [creating, setCreating] = useState(false);
  const [filterDisciplines, setFilterDisciplines] = useState<string[]>([]);
  const [filterCompanies, setFilterCompanies] = useState<string[]>([]);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]); // "active" | "separated"
  const [assignDialogFor, setAssignDialogFor] = useState<PersonnelMaster | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [legalExpanded, setLegalExpanded] = useState(false);
  const currentProject = useCurrentProject();

  async function downloadDocList() {
    try {
      await downloadDocumentChecklistPDF({ projectName: currentProject?.name });
      toast("İstenen Belgeler Listesi indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("PDF üretilirken hata oluştu", "error");
    }
  }

  const stats = useMemo(() => {
    const total = personnel.length;
    const active = personnel.filter((p) => p.status === "active").length;
    // Atama: bu kullanıcıya görünen projelerde atanmış personel sayısı
    const assignedSet = new Set(assignments.filter((a) => !a.assignedTo).map((a) => a.personnelMasterId));
    const assigned = assignedSet.size;
    const companies = new Set(personnel.map((p) => p.company));
    return { total, active, assigned, companies: companies.size };
  }, [personnel, assignments]);

  // Firma bazında dağılım
  const companyStats = useMemo(() => {
    const byCompany: Record<string, number> = {};
    for (const p of personnel) byCompany[p.company] = (byCompany[p.company] ?? 0) + 1;
    return Object.entries(byCompany)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count);
  }, [personnel]);

  // Disiplin bazında dağılım
  const disciplineStats = useMemo(() => {
    const byDisc: Record<string, number> = {};
    for (const p of personnel) byDisc[p.discipline] = (byDisc[p.discipline] ?? 0) + 1;
    return Object.entries(byDisc).map(([d, count]) => ({ discipline: d, count }));
  }, [personnel]);

  // Personnel → assigned project IDs (active = no assignedTo, geçmiş = assignedTo set)
  const personnelProjectMap = useMemo(() => {
    const m: Record<string, { active: string[]; past: string[] }> = {};
    for (const a of assignments) {
      if (!m[a.personnelMasterId]) m[a.personnelMasterId] = { active: [], past: [] };
      if (!a.assignedTo) m[a.personnelMasterId].active.push(a.projectId);
      else m[a.personnelMasterId].past.push(a.projectId);
    }
    return m;
  }, [assignments]);

  // Proje × kaç kişi atanmış (KPI için)
  const projectAssignedCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of assignments) {
      if (!a.assignedTo) m[a.projectId] = (m[a.projectId] ?? 0) + 1;
    }
    return projects.map((p) => ({ project: p, count: m[p.id] ?? 0 }));
  }, [assignments, projects]);

  // Şirket seçim listesi — kullanıcı sadece bu listeden seçer, serbest yazamaz.
  //   1) Her projenin "Ana Yüklenici (Panel Sahibi)" adı (Settings → Ana Yüklenici)
  //   2) Tüm alt yüklenicilerin (Subcontractor) firma adları
  //   3) Mevcut personel kayıtlarında geçen firmalar (geriye dönük)
  // Proje adı şirket olarak EKLENMEZ — sadece panel sahibi adı kullanılır.
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
    for (const p of personnel) {
      if (p.company && p.company.trim()) set.add(p.company.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [projects, subcontractors, personnel]);

  function projectName(id: string): string {
    return projects.find((p) => p.id === id)?.name ?? "—";
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return personnel.filter((p) => {
      if (filterDisciplines.length > 0 && !filterDisciplines.includes(p.discipline)) return false;
      if (filterCompanies.length > 0 && !filterCompanies.includes(p.company)) return false;
      if (filterStatus.length > 0) {
        const isSeparated = !!p.terminationDate || p.status === "inactive";
        const flag = isSeparated ? "separated" : "active";
        if (!filterStatus.includes(flag)) return false;
      }
      if (filterProjects.length > 0) {
        const list = personnelProjectMap[p.id];
        const has = list?.active.some((pid) => filterProjects.includes(pid)) ?? false;
        if (!has) return false;
      }
      if (!q) return true;
      return (
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.company.toLowerCase().includes(q) ||
        (p.tcKimlikNo || "").includes(q)
      );
    });
  }, [personnel, search, filterDisciplines, filterCompanies, filterProjects, filterStatus, personnelProjectMap]);

  function isAssignedToProject(personnelId: string, projectId: string) {
    return assignments.some(
      (a) => a.personnelMasterId === personnelId && a.projectId === projectId && !a.assignedTo
    );
  }

  function toggleProjectAssignment(personnelMasterId: string, projectId: string) {
    const ex = assignments.find(
      (a) => a.personnelMasterId === personnelMasterId && a.projectId === projectId && !a.assignedTo
    );
    if (ex) {
      unassignPersonnel(ex.id);
      toast("Atama kaldırıldı.", "info");
    } else {
      const p = projects.find((x) => x.id === projectId);
      assignPersonnel({
        projectId,
        personnelMasterId,
        assignedFrom: p?.reportDate ?? toISODate(new Date()),
      });
      toast(`${p?.name ?? "Proje"}'ye atandı.`, "success");
    }
  }

  async function exportPDF() {
    const subtitle = [
      `${filtered.length} kayıt`,
      filterStatus.length === 1
        ? filterStatus[0] === "active" ? "Aktif" : "Ayrılmış"
        : "",
      filterDisciplines.length > 0
        ? filterDisciplines.map((d) => DISCIPLINE_LABEL_TR[d as Discipline]).join(", ")
        : "",
      filterCompanies.length > 0 ? filterCompanies.join(", ") : "",
      filterProjects.length > 0
        ? `Proje: ${filterProjects.map(projectName).join(", ")}`
        : "",
      search ? `arama: ${search}` : "",
    ].filter(Boolean).join(" · ");

    await downloadMasterListPDF({
      title: "PERSONEL MASTER DATA",
      subtitle,
      tone: "accent",
      projectName: filterProjects.length === 1 ? projectName(filterProjects[0]) : undefined,
      columns: [
        { key: "no", label: "#", width: "30px", align: "center", mono: true },
        { key: "name", label: "Ad Soyad", bold: true },
        { key: "tc", label: "TC", mono: true, width: "85px" },
        { key: "phone", label: "Telefon", mono: true, width: "95px" },
        { key: "company", label: "Firma" },
        { key: "discipline", label: "Disiplin", width: "75px" },
        { key: "jobTitle", label: "Görev" },
        { key: "startDate", label: "İşe Giriş", mono: true, width: "78px", align: "center" },
        { key: "termDate", label: "İşten Çıkış", mono: true, width: "82px", align: "center" },
        { key: "status", label: "Durum", width: "70px", align: "center", bold: true },
      ],
      rows: filtered.map((p, i) => {
        const status = p.terminationDate
          ? "Ayrıldı"
          : p.status === "active"
          ? "Çalışıyor"
          : "Pasif";
        return {
          no: i + 1,
          name: `${p.firstName} ${p.lastName}`,
          tc: p.tcKimlikNo || "—",
          phone: p.phone || "—",
          company: p.company,
          discipline: DISCIPLINE_LABEL_TR[p.discipline],
          jobTitle: p.jobTitle || "—",
          startDate: p.startDate || "—",
          termDate: p.terminationDate || "—",
          status,
        };
      }),
      fileName: `personel-master-${toISODate(new Date())}`,
    });
  }

  return (
    <>
      <PageHeader
        title="Personel Master Data"
        description={`${personnel.length} kayıtlı personel · Tüm projeler ortak havuz`}
        icon={UserCog}
        actions={
          <>
            <Button variant="outline" onClick={downloadDocList}>
              <ClipboardList size={14} /> Belgeler Listesi
            </Button>
            <div className="relative">
              <Button variant="outline" onClick={() => setTemplatesOpen((v) => !v)}>
                <FileBadge size={14} /> Boş Şablonlar
                <ChevronDown
                  size={12}
                  className={cn("transition-transform", templatesOpen && "rotate-180")}
                />
              </Button>
              {templatesOpen && (
                <HRTemplatesPanel
                  onClose={() => setTemplatesOpen(false)}
                  onPick={async (t) => {
                    setTemplatesOpen(false);
                    try {
                      await downloadHRTemplatePDF(t, {
                        projectName: currentProject?.name,
                      });
                      toast(`${t.title} indirildi`, "success");
                    } catch (err) {
                      console.error(err);
                      toast("PDF üretilirken hata oluştu", "error");
                    }
                  }}
                />
              )}
            </div>
            <Button variant="primary" onClick={exportPDF}>
              <FileText size={14} /> PDF İndir
            </Button>
            <Button variant="accent" onClick={() => setCreating(true)}>
              <Plus size={14} /> Yeni Personel
            </Button>
          </>
        }
      />

      <Alert variant="warning" className="mb-4">
        <div className="text-[12px] leading-relaxed">
          <div className="font-bold text-text mb-1.5 uppercase tracking-wider text-[11px]">
            İşveren Yükümlülüğü — Eksik Belgeli Personel Çalıştırma Yasaktır
          </div>
          <div className="mb-2">
            Personel kaydı yaparken özlük (kimlik, nüfus kaydı, ikametgah, MYK·diploma, AGİ,
            KVKK aydınlatma + açık rıza, SGK işe giriş, sağlık raporu, banka…) ve İSG (genel
            eğitim, KKD zimmet, kurallar, yüksekte çalışma yetki, periyodik muayene…){" "}
            <strong>evraklarının tamamı</strong> mutlaka alınmalı ve özlük dosyasına işlenmelidir.{" "}
            <strong>İstenen Belgeler Listesi</strong> butonundan kontrol listesini indir, personele ver.
          </div>
          <button
            type="button"
            onClick={() => setLegalExpanded((v) => !v)}
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors",
              "text-yellow hover:text-yellow/80"
            )}
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
                  • <strong>6331 sayılı İSG Kanunu Md. 17</strong> — İSG eğitimi almamış çalışan
                  istihdam edilemez; çalışan başına idari para cezası.
                </li>
                <li>
                  • <strong>6331 Md. 19, 24, 26</strong> — Risk değerlendirmesi, sağlık gözetimi
                  ve İSG belgelerinde eksiklik → çalışan başına ayrı para cezası.
                </li>
                <li>
                  • <strong>5510 sayılı SGK Kanunu Md. 8</strong> — İşe girişten en geç{" "}
                  <strong>1 gün önce</strong> SGK&apos;ya bildirim zorunlu; bildirilmeyen çalışan
                  başına aylık brüt asgari ücret tutarında ceza.
                </li>
                <li>
                  • <strong>4857 sayılı İş Kanunu Md. 8, 32, 75</strong> — Yazılı iş sözleşmesi ve
                  özlük dosyası tutulması zorunlu; eksiklikte ceza + işçi lehine yorum.
                </li>
                <li>
                  • <strong>6698 sayılı KVKK</strong> — Kişisel veri işlemeden önce aydınlatma + açık
                  rıza zorunlu; ihlal halinde Kurul tarafından{" "}
                  <strong>milyonlarca TL ceza</strong>.
                </li>
                <li>
                  • <strong>4857 Md. 77</strong> — KKD zimmet imzası alınmamışsa iş kazasında işveren{" "}
                  <strong>tam kusurlu</strong> sayılır, rücu hakkı kaybolur.
                </li>
              </ul>
              <div className="mt-2 font-semibold">
                Sonuç: Eksik belgeli çalıştırma ⇒ idari para cezası + iş kazasında{" "}
                <strong>cezai sorumluluk (TCK Md. 22, 85)</strong> + rücu hakkı kaybı.
              </div>
            </div>
          )}
        </div>
      </Alert>

      {/* KPI ÖZET ŞERİDİ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiTile icon={Users} label="Toplam Personel" value={String(stats.total)} sub={`${stats.active} aktif`} tone="accent" />
        <KpiTile icon={Briefcase} label="Atanmış (Aktif Proje)" value={String(stats.assigned)} sub={`${stats.total - stats.assigned} havuzda`} tone="blue" />
        <KpiTile icon={Building2} label="Farklı Firma" value={String(stats.companies)} sub={`${companyStats[0]?.company ?? "—"} en kalabalık`} tone="purple" />
        <KpiTile icon={Activity} label="Disiplin Çeşidi" value={String(disciplineStats.length)} sub="Mekanik · Elektrik · İnşaat ..." tone="yellow" />
      </div>

      {/* PROJE BAZLI ATANMIŞ PERSONEL */}
      {projectAssignedCounts.length > 0 && (
        <Card className="mb-4 !p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wider font-bold text-text3">
              Hangi Projede Kaç Kişi Atanmış
            </div>
            <div className="text-[10px] text-text3 font-mono">
              {projectAssignedCounts.length} proje
            </div>
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
                    ? "border-accent bg-accent/8 ring-1 ring-accent/30"
                    : "border-border bg-white hover:border-accent/30 hover:bg-accent/5"
                )}
              >
                <div className="flex items-center justify-between">
                  <FolderKanban size={12} className="text-text3" />
                  <span className="font-mono text-base font-extrabold text-accent tabular-nums leading-none">
                    {pc.count}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-text mt-1 truncate">
                  {pc.project.name}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* FİRMA DAĞILIMI MİNİ */}
      {companyStats.length > 0 && (
        <Card className="mb-4 !p-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-text3 mb-2">
            Firmaya Göre Dağılım
          </div>
          <div className="flex flex-wrap gap-2">
            {companyStats.slice(0, 12).map((c) => {
              const pct = stats.total > 0 ? (c.count / stats.total) * 100 : 0;
              return (
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
                >
                  <span className="text-[11.5px] font-semibold text-text">{c.company}</span>
                  <span className="font-mono text-[10px] font-bold text-accent tabular-nums">{c.count}</span>
                  <span className="text-[9px] text-text3 font-mono">%{pct.toFixed(0)}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* KOMPAKT FİLTRE ŞERİDİ */}
      <div className="mb-4 rounded-xl border border-border bg-white px-3 py-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-text3 mb-1">Ara</div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ad / soyad / TC"
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
            label="Disiplin"
            placeholder="Tüm disiplinler"
            options={[
              { value: "mekanik", label: "Mekanik" },
              { value: "elektrik", label: "Elektrik" },
              { value: "insaat", label: "İnşaat" },
              { value: "muhendislik", label: "Mühendislik" },
              { value: "idari", label: "İdari" },
              { value: "diger", label: "Diğer" },
            ]}
            selected={filterDisciplines}
            onChange={setFilterDisciplines}
          />
          <MultiSelectFilter
            label="Durum"
            placeholder="Aktif + Ayrılmış"
            options={[
              { value: "active", label: "Aktif", sub: "Çalışıyor" },
              { value: "separated", label: "Ayrılmış", sub: "Çıkışlı / Pasif" },
            ]}
            selected={filterStatus}
            onChange={setFilterStatus}
          />
        </div>
        {(search || filterCompanies.length > 0 || filterProjects.length > 0 || filterDisciplines.length > 0 || filterStatus.length > 0) && (
          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-text3">
              <strong className="text-text">{filtered.length}</strong> / {personnel.length} kayıt
            </div>
            <button
              onClick={() => {
                setSearch("");
                setFilterCompanies([]);
                setFilterProjects([]);
                setFilterDisciplines([]);
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
              <TH>Ad Soyad</TH>
              <TH>TC</TH>
              <TH>Firma</TH>
              <TH>Disiplin</TH>
              <TH>Görev</TH>
              <TH>Atandığı Projeler</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <Empty colSpan={7}>
                {search ? `"${search}" için eşleşme yok.` : "Henüz personel eklenmemiş."}
                {search && (
                  <button
                    onClick={() => setCreating(true)}
                    className="ml-2 text-accent underline"
                  >
                    + Yeni Personel Ekle: &quot;{search}&quot;
                  </button>
                )}
              </Empty>
            ) : (
              filtered.map((p) => {
                const map = personnelProjectMap[p.id];
                const activeProjects = map?.active ?? [];
                const pastProjects = map?.past ?? [];
                return (
                <TR key={p.id}>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{p.firstName} {p.lastName}</span>
                      {p.terminationDate ? (
                        <span
                          title={`Çıkış: ${p.terminationDate}`}
                          className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-red/10 text-red"
                        >
                          Çıkış
                        </span>
                      ) : p.status === "active" ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-green/10 text-green">
                          <span className="size-1 rounded-full bg-green" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-bg2 text-text3">
                          Pasif
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text3 mt-0.5">
                      {p.phone && <span>{p.phone}</span>}
                      {p.startDate && <span className="ml-2">İşe giriş: <strong className="text-text2 font-mono">{p.startDate}</strong></span>}
                      {p.terminationDate && <span className="ml-2 text-red">Çıkış: <strong className="font-mono">{p.terminationDate}</strong></span>}
                    </div>
                  </TD>
                  <TD className="font-mono text-xs text-text2">{p.tcKimlikNo || "—"}</TD>
                  <TD className="text-xs">{p.company}</TD>
                  <TD>
                    <Badge variant="blue">{p.discipline}</Badge>
                  </TD>
                  <TD className="text-xs">{p.jobTitle || "—"}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1 items-center">
                      {activeProjects.length === 0 && pastProjects.length === 0 ? (
                        <span className="text-text3 text-[11px]">Atama yok</span>
                      ) : (
                        <>
                          {activeProjects.map((pid) => (
                            <span
                              key={pid}
                              title={projectName(pid)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider max-w-[120px]"
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
                      {p.terminationDate ? (
                        <span
                          title={`Çıkış yaptı (${p.terminationDate}) — atama yapılamaz`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-text3/40 text-text3/60 text-[10px] font-bold uppercase tracking-wider cursor-not-allowed bg-bg2/50"
                        >
                          <Lock size={9} /> Atama Kapalı
                        </span>
                      ) : (
                        <button
                          onClick={() => setAssignDialogFor(p)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed border-text3 text-text3 hover:text-accent hover:border-accent text-[10px] font-bold uppercase tracking-wider"
                        >
                          <Plus size={9} /> Ata
                        </button>
                      )}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setEditing(p)}
                        className="p-1 text-text3 hover:text-accent rounded"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirmAction({
                            title: `${p.firstName} ${p.lastName} silinsin mi?`,
                            message: "Personel master listesinden çıkarılacak (Çöp Kutusu'ndan geri yüklenebilir).",
                            danger: true,
                            confirmText: "Sil",
                          })) {
                            softDeletePersonnel(p.id);
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

      <PersonnelForm
        open={creating}
        defaultFirstName={search}
        companies={allCompanies}
        onClose={() => {
          setCreating(false);
          setSearch("");
        }}
        onSubmit={(data) => {
          if (!user) return;
          addPersonnel({ ...data, ownerUserId: user.id });
          setCreating(false);
        }}
      />
      <PersonnelForm
        key={editing?.id ?? "edit-empty"}
        open={!!editing}
        initial={editing || undefined}
        onClose={() => setEditing(null)}
        onSubmit={(data) => {
          if (!editing) return;
          updatePersonnel(editing.id, data);
          setEditing(null);
        }}
        companies={allCompanies}
      />

      {/* PROJE ATAMA DİYALOGU */}
      <Dialog
        open={!!assignDialogFor}
        onClose={() => setAssignDialogFor(null)}
        title={assignDialogFor ? `Proje Ataması — ${assignDialogFor.firstName} ${assignDialogFor.lastName}` : "Proje Ataması"}
        size="md"
      >
        {assignDialogFor && (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm text-text2 mb-3">
              Bu personeli hangi projelere atamak/çıkarmak istersin? Açıkkı rozeti olanlar şu an aktif.
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
                      active ? "border-accent/40 bg-accent/5" : "border-border bg-white"
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
    </>
  );
}

function PersonnelForm({
  open,
  initial,
  defaultFirstName,
  onClose,
  onSubmit,
  companies,
}: {
  open: boolean;
  initial?: PersonnelMaster;
  defaultFirstName?: string;
  onClose: () => void;
  onSubmit: (
    data: Omit<PersonnelMaster, "id" | "ownerUserId" | "createdAt" | "updatedAt" | "deletedAt">
  ) => void;
  companies?: string[];
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? defaultFirstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [tcKimlikNo, setTcKimlikNo] = useState(initial?.tcKimlikNo ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [discipline, setDiscipline] = useState<Discipline>(initial?.discipline ?? "diger");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? "");
  const [terminationDate, setTerminationDate] = useState<string>(initial?.terminationDate ?? "");
  const [dailyRate, setDailyRate] = useState<string>(initial?.dailyRate?.toString() ?? "");
  const [dailyRateCurrency, setDailyRateCurrency] = useState<Currency>(
    initial?.dailyRateCurrency ?? "TRY"
  );
  // Çıkış tarihi varsa otomatik "inactive"
  const [status, setStatus] = useState<"active" | "inactive">(initial?.status ?? "active");

  function submit() {
    if (!firstName || !lastName || !company) return;
    const finalStatus = terminationDate ? "inactive" : status;
    onSubmit({
      firstName,
      lastName,
      tcKimlikNo: tcKimlikNo || undefined,
      company,
      discipline,
      jobTitle: jobTitle || undefined,
      phone: phone || undefined,
      startDate: startDate || undefined,
      terminationDate: terminationDate || undefined,
      dailyRate: dailyRate ? Number(dailyRate) : undefined,
      dailyRateCurrency: dailyRate ? dailyRateCurrency : undefined,
      status: finalStatus,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={initial ? "Personel Düzenle" : "Yeni Personel"} size="md">
      {!initial && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-blue/5 border border-blue/20 flex items-start gap-2 text-[11.5px] leading-relaxed">
          <AlertCircle size={13} className="text-blue shrink-0 mt-0.5" />
          <span className="text-text2">
            <strong className="text-text">Önemli:</strong> Kayıt sırasında özlük (kimlik, ikametgah,
            sözleşme, AGİ, KVKK, banka) ve İSG (genel eğitim, KKD zimmet, sağlık raporu, kurallar)
            evraklarının <strong>tamamı</strong> alınmalı. Üst menüdeki{" "}
            <strong>İstenen Belgeler Listesi</strong> butonundan kontrol listesini indir, personele ver.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Ad">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Soyad">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
        <Field label="TC Kimlik No" hint="11 haneli">
          <Input
            value={tcKimlikNo}
            onChange={(e) => setTcKimlikNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
            inputMode="numeric"
          />
        </Field>
        <Field
          label="Şirket *"
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
        <Field label="Disiplin">
          <Select value={discipline} onChange={(e) => setDiscipline(e.target.value as Discipline)}>
            <option value="mekanik">Mekanik</option>
            <option value="elektrik">Elektrik</option>
            <option value="insaat">İnşaat</option>
            <option value="muhendislik">Mühendislik</option>
            <option value="idari">İdari</option>
            <option value="diger">Diğer</option>
          </Select>
        </Field>
        <Field label="Görev">
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Kaynakçı, Usta..." />
        </Field>
        <Field label="Telefon">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="İşe Giriş">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="İşten Çıkış" hint="Doluysa otomatik 'Pasif' olur">
          <Input type="date" value={terminationDate} onChange={(e) => setTerminationDate(e.target.value)} />
        </Field>
        <Field label="Günlük Yevmiye">
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
        <Field label="Durum">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")} disabled={!!terminationDate}>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </Select>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={submit}
          disabled={!firstName || !lastName || !company}
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

// ─── HR Belge Şablonları paneli (boş, doldurulabilir formlar) ────
function HRTemplatesPanel({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (t: HRTemplate) => void;
}) {
  const ozluk = HR_TEMPLATES.filter((t) => t.category === "ozluk");
  const isg = HR_TEMPLATES.filter((t) => t.category === "isg");
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full mt-2 z-50 w-[640px] max-w-[95vw] bg-white rounded-xl shadow-large border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-2.5 bg-gradient-to-r from-purple/10 to-red/10 border-b border-border">
          <div className="font-display font-extrabold text-[14px] text-text leading-tight">
            Boş Belge Şablonları
          </div>
          <div className="text-[10.5px] text-text2 mt-0.5">
            Doldurulabilir formlar — yazdır, personele doldurt, tarayıp dosyala.
          </div>
        </div>
        <div className="grid grid-cols-2 max-h-[480px] overflow-y-auto">
          <div className="border-r border-border">
            <div className="px-4 py-2 bg-purple/5 border-b border-border sticky top-0 flex items-center gap-2">
              <FolderHeart size={13} className="text-purple" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple">
                Özlük ({ozluk.length})
              </span>
            </div>
            <div className="divide-y divide-border">
              {ozluk.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t)}
                  className="w-full text-left px-4 py-2.5 hover:bg-purple/[0.06] transition-colors flex items-start gap-2 group"
                >
                  <FileText size={13} className="text-purple/70 shrink-0 mt-0.5 group-hover:text-purple" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-text leading-tight">{t.title}</div>
                    <div className="text-[10.5px] text-text3 leading-tight mt-0.5 truncate">
                      {t.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="px-4 py-2 bg-red/5 border-b border-border sticky top-0 flex items-center gap-2">
              <ShieldCheck size={13} className="text-red" />
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-red">
                İSG ({isg.length})
              </span>
            </div>
            <div className="divide-y divide-border">
              {isg.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPick(t)}
                  className="w-full text-left px-4 py-2.5 hover:bg-red/[0.06] transition-colors flex items-start gap-2 group"
                >
                  <FileText size={13} className="text-red/70 shrink-0 mt-0.5 group-hover:text-red" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-text leading-tight">{t.title}</div>
                    <div className="text-[10.5px] text-text3 leading-tight mt-0.5 truncate">
                      {t.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

