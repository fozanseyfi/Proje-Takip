"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Plus, FolderKanban, MapPin, Calendar, ArrowRight, Sun, ChevronDown, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore, isDemoProject } from "@/lib/store";
import type { Project, ProjectStatus } from "@/lib/store/types";
import { CloneProjectDialog } from "@/components/projects/clone-project-dialog";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatDate, toISODate, addDays } from "@/lib/utils";
import { useCurrentUser } from "@/lib/store";
import type { Currency } from "@/lib/utils";
import { SAMPLE_PROJECT_NAME } from "@/lib/data/sample-loader";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  completed: "Tamamlandı",
  archived: "Arşiv",
};
const STATUS_VARIANT: Record<ProjectStatus, "gray" | "yellow" | "green" | "blue"> = {
  draft: "yellow",
  active: "green",
  completed: "blue",
  archived: "gray",
};

export default function ProjectsPage() {
  const projects = useStore((s) => s.projects);
  const createProject = useStore((s) => s.createProject);
  const updateProject = useStore((s) => s.updateProject);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const wipeAndStartFresh = useStore((s) => s.wipeAndStartFresh);
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState<Project | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // ?new=1 → diyalog otomatik aç
  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setOpen(true);
      // URL'i temizle
      router.replace("/projects");
    }
  }, [searchParams, router]);

  // Örnek proje her zaman en başta sabit
  const sortedProjects = useMemo(
    () =>
      [...projects].sort((a, b) => {
        if (a.name === SAMPLE_PROJECT_NAME) return -1;
        if (b.name === SAMPLE_PROJECT_NAME) return 1;
        return a.name.localeCompare(b.name);
      }),
    [projects]
  );

  const [form, setForm] = useState({
    name: "",
    location: "",
    startDate: toISODate(new Date()),
    durationDays: 180,
    installedCapacityMw: "",
    totalBudget: "",
    budgetCurrency: "TRY" as Currency,
    mainContractorName: "",
    investorName: "",
  });

  function submit() {
    if (!form.name || !form.location || !user) return;
    const start = new Date(form.startDate);
    const end = addDays(start, form.durationDays);
    createProject({
      name: form.name,
      location: form.location,
      wbsNo: "1",
      startDate: form.startDate,
      durationDays: form.durationDays,
      plannedEnd: toISODate(end),
      contractEnd: toISODate(end),
      reportDate: toISODate(new Date()),
      installedCapacityMw: form.installedCapacityMw ? Number(form.installedCapacityMw) : null,
      totalBudget: form.totalBudget ? Number(form.totalBudget) : null,
      budgetCurrency: form.budgetCurrency,
      status: "active",
      mainContractorName: form.mainContractorName.trim() || undefined,
      investorName: form.investorName.trim() || undefined,
      createdBy: user.id,
    });
    setOpen(false);
    setForm({
      ...form,
      name: "",
      location: "",
      installedCapacityMw: "",
      totalBudget: "",
      mainContractorName: "",
      investorName: "",
    });
  }

  return (
    <>
      <PageHeader
        title="Projeler"
        description="Tüm projelerin listesi"
        icon={FolderKanban}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (
                  confirm(
                    "TÜM örnek verileri (Ankara Polatlı GES projesi, personel, makine, alt yüklenici, atamalar) silinecek. Hesabın korunur. Devam edilsin mi?"
                  )
                ) {
                  wipeAndStartFresh();
                  window.location.reload();
                }
              }}
              className="text-red border-red/40 hover:bg-red/5"
            >
              <Trash2 size={14} /> Örnekleri Sil · Sıfırdan Başla
            </Button>
            <Button variant="accent" onClick={() => setOpen(true)}>
              <Plus size={14} /> Yeni Proje
            </Button>
          </>
        }
      />

      {projects.length === 0 ? (
        <Card className="text-center py-12">
          <FolderKanban size={36} className="mx-auto text-text3 mb-3" />
          <CardTitle>Henüz proje yok</CardTitle>
          <p className="text-sm text-text2 mb-4">İlk projeni oluşturmak için aşağıdaki butonu kullan.</p>
          <Button variant="accent" onClick={() => setOpen(true)}>
            <Plus size={14} /> İlk Projeyi Oluştur
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProjects.map((p, i) => {
            const isSample = p.name === SAMPLE_PROJECT_NAME;
            return (
            <Card
              key={p.id}
              className={cn(
                "hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-medium transition-all duration-300",
                "animate-slide-up",
                i === 0 && "animate-slide-up-delay-1",
                i === 1 && "animate-slide-up-delay-2",
                i === 2 && "animate-slide-up-delay-3",
                i >= 3 && "animate-slide-up-delay-4",
                isSample && "border-accent/30 bg-gradient-to-br from-accent/5 to-white"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-display font-bold text-lg text-text truncate">{p.name}</div>
                    {isSample && <Badge variant="accent">📌 Örnek</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-text3">
                    <MapPin size={12} />
                    {p.location}
                  </div>
                </div>
                {isDemoProject(p) ? (
                  <span
                    className="inline-flex items-center px-2.5 h-7 rounded-md border border-accent/30 bg-accent/8 text-accent text-[11px] font-bold uppercase tracking-wider shrink-0"
                    title="Örnek proje — durumu değiştirilemez"
                  >
                    Örnek Proje
                  </span>
                ) : (
                  <StatusSelector
                    status={p.status}
                    onChange={(next) => updateProject(p.id, { status: next })}
                  />
                )}
              </div>
              <div className="space-y-2 text-xs text-text2 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-text3" />
                  <span>
                    {formatDate(p.startDate)} → {formatDate(p.plannedEnd)}
                  </span>
                  <span className="text-text3 ml-auto font-mono">{p.durationDays}g</span>
                </div>
                {p.installedCapacityMw != null && (
                  <div className="flex items-center gap-2">
                    <Sun size={12} className="text-yellow" />
                    <span className="text-text3">Kurulu Güç</span>
                    <span className="font-mono text-text ml-auto">{p.installedCapacityMw} MW</span>
                  </div>
                )}
                {p.totalBudget != null && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 inline-flex items-center justify-center text-text3 text-[10px]">₺</span>
                    <span className="text-text3">Bütçe</span>
                    <span className="font-mono text-text ml-auto">
                      {p.totalBudget.toLocaleString("tr-TR")} {p.budgetCurrency}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard" className="flex-1">
                  <Button
                    variant="accent"
                    size="sm"
                    className="w-full"
                    onClick={() => setCurrentProject(p.id)}
                  >
                    Aç <ArrowRight size={12} />
                  </Button>
                </Link>
                {isDemoProject(p) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCloneSource(p)}
                    title="Bu örnek projeyi klonla"
                  >
                    <Copy size={12} /> Klonla
                  </Button>
                )}
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentProject(p.id)}
                  >
                    Ayarlar
                  </Button>
                </Link>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Yeni Proje" size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Proje Adı">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="örn. Konya GES 2"
            />
          </Field>
          <Field label="Konum">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="il, ilçe"
            />
          </Field>
          <Field label="Ana Yüklenici (Panel Sahibi)" hint="Personel/makine ekleme şirket listesinde otomatik gözükür">
            <Input
              value={form.mainContractorName}
              onChange={(e) => setForm({ ...form, mainContractorName: e.target.value })}
              placeholder="örn. Kontrolmatik Teknoloji A.Ş."
            />
          </Field>
          <Field label="Yatırımcı (İşveren)" hint="Projenin sahibi firma">
            <Input
              value={form.investorName}
              onChange={(e) => setForm({ ...form, investorName: e.target.value })}
              placeholder="örn. ABC Enerji A.Ş."
            />
          </Field>
          <Field label="Başlangıç Tarihi">
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </Field>
          <Field label="Süre (gün)">
            <Input
              type="number"
              value={form.durationDays}
              onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Kurulu Güç (MW)">
            <Input
              type="number"
              step="0.01"
              value={form.installedCapacityMw}
              onChange={(e) => setForm({ ...form, installedCapacityMw: e.target.value })}
            />
          </Field>
          <Field label="Toplam Bütçe">
            <div className="flex gap-2">
              <Input
                type="number"
                className="flex-1"
                value={form.totalBudget}
                onChange={(e) => setForm({ ...form, totalBudget: e.target.value })}
              />
              <Select
                className="w-24"
                value={form.budgetCurrency}
                onChange={(e) => setForm({ ...form, budgetCurrency: e.target.value as Currency })}
              >
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>İptal</Button>
          <Button variant="accent" onClick={submit}>Oluştur</Button>
        </DialogFooter>
      </Dialog>

      <CloneProjectDialog
        open={!!cloneSource}
        onClose={() => setCloneSource(null)}
        source={cloneSource}
      />
    </>
  );
}

function StatusSelector({
  status,
  onChange,
}: {
  status: ProjectStatus;
  onChange: (s: ProjectStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const variant = STATUS_VARIANT[status];
  const variantBg: Record<string, string> = {
    green: "bg-green/12 text-green border-green/30",
    yellow: "bg-yellow/12 text-yellow border-yellow/30",
    blue: "bg-blue/12 text-blue border-blue/30",
    gray: "bg-bg2 text-text3 border-border",
  };
  const options: ProjectStatus[] = ["draft", "active", "completed"];
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all",
          variantBg[variant]
        )}
      >
        {STATUS_LABEL[status]}
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-7 right-0 z-40 min-w-[120px] py-1 rounded-lg bg-white border border-border shadow-medium">
          {options.map((opt) => (
            <button
              key={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "block w-full text-left px-3 py-1.5 text-xs hover:bg-bg2 transition-colors",
                opt === status ? "text-accent font-bold" : "text-text2"
              )}
            >
              {STATUS_LABEL[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
