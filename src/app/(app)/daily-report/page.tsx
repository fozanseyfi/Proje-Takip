"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudRain,
  Sun,
  CloudSnow,
  Camera,
  X,
  Save,
} from "lucide-react";
import { useStore, useCurrentProject, useCurrentUser } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDate, toISODate, daysBetween } from "@/lib/utils";

// Mock hava durumu — gerçek API entegrasyonunda Open-Meteo kullanılacak
function mockWeather(date: string) {
  const seed = date.split("-").reduce((s, p) => s + Number(p), 0);
  const conditions = ["Güneşli", "Parçalı Bulutlu", "Bulutlu", "Yağmurlu", "Karlı"];
  const idx = seed % conditions.length;
  const condition = conditions[idx];
  const tempMin = 5 + (seed % 15);
  const tempMax = tempMin + 5 + (seed % 10);
  return {
    condition,
    tempMin,
    tempMax,
    workStopped: condition === "Yağmurlu" || condition === "Karlı",
  };
}

function weatherIcon(condition?: string) {
  if (!condition) return <Cloud size={18} />;
  if (condition.includes("Güneş")) return <Sun size={18} className="text-yellow" />;
  if (condition.includes("Yağmur")) return <CloudRain size={18} className="text-blue" />;
  if (condition.includes("Kar")) return <CloudSnow size={18} className="text-blue" />;
  return <Cloud size={18} className="text-text2" />;
}

export default function DailyReportPage() {
  const project = useCurrentProject();
  const user = useCurrentUser();
  const reports = useStore((s) => s.dailyReports);
  const upsertReport = useStore((s) => s.upsertDailyReport);
  const personnelAttendance = useStore((s) => s.personnelAttendance);
  const machineAttendance = useStore((s) => s.machineAttendance);

  const [date, setDate] = useState(toISODate(new Date()));

  // Proje seçilince/değişince tarih aralık dışındaysa otomatik klamp et
  useEffect(() => {
    if (!project) return;
    const td = toISODate(new Date());
    const max = project.plannedEnd < td ? project.plannedEnd : td;
    if (date < project.startDate) setDate(project.startDate);
    else if (date > max) setDate(max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const existing = useMemo(
    () => reports.find((r) => r.projectId === project?.id && r.reportDate === date),
    [reports, project, date]
  );

  const weather = useMemo(() => existing?.weather ? null : mockWeather(date), [date, existing]);

  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [photos, setPhotos] = useState<{ url: string; caption?: string; uploadedAt: string }[]>([]);
  const [workStopped, setWorkStopped] = useState(false);
  const [workStoppedReason, setWorkStoppedReason] = useState("");

  // Tarihten existing'i ilkleme — state'i resetle
  useEffect(() => {
    setSummary(existing?.summary ?? "");
    setIssues(existing?.issues ?? "");
    setTomorrowPlan(existing?.tomorrowPlan ?? "");
    setPhotos(existing?.photos ?? []);
    setWorkStopped(existing?.workStopped ?? weather?.workStopped ?? false);
    setWorkStoppedReason(existing?.workStoppedReason ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id]);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const readers: Promise<{ url: string; caption?: string; uploadedAt: string }>[] = [];
    for (const f of Array.from(files)) {
      readers.push(
        new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res({ url: r.result as string, uploadedAt: new Date().toISOString() });
          r.readAsDataURL(f);
        })
      );
    }
    Promise.all(readers).then((results) => setPhotos((p) => [...p, ...results]));
  }

  function removePhoto(idx: number) {
    setPhotos((p) => p.filter((_, i) => i !== idx));
  }

  const toast = useToast((s) => s.push);

  function save() {
    if (!project || !user) return;
    const w = weather;
    upsertReport({
      id: existing?.id,
      projectId: project.id,
      reportDate: date,
      weather: existing?.weather ?? w?.condition,
      temperatureMin: existing?.temperatureMin ?? w?.tempMin,
      temperatureMax: existing?.temperatureMax ?? w?.tempMax,
      weatherAutoFetched: !existing?.weather,
      workStopped,
      workStoppedReason: workStopped ? workStoppedReason || undefined : undefined,
      summary,
      issues: issues || undefined,
      tomorrowPlan: tomorrowPlan || undefined,
      photos,
      createdBy: user.id,
    });
    toast("Günlük rapor kaydedildi", "success");
  }

  // Tarih sınırları: proje başı/sonu + bugünden ileri gidilmez.
  const today = toISODate(new Date());
  const minDate = project?.startDate ?? "";
  const maxDate = (() => {
    if (!project) return today;
    return project.plannedEnd < today ? project.plannedEnd : today;
  })();

  function clampDate(d: string): string {
    if (!project) return d;
    if (d < minDate) return minDate;
    if (d > maxDate) return maxDate;
    return d;
  }

  function shift(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(clampDate(toISODate(d)));
  }

  // Proje gün sayacı: tarih projenin kaçıncı günü?
  const projectDayNum = project
    ? daysBetween(project.startDate, date) + 1
    : 0;
  const projectTotalDays = project
    ? daysBetween(project.startDate, project.plannedEnd) + 1
    : 0;
  const canPrev = date > minDate;
  const canNext = date < maxDate;

  // Otomatik dahil edilenler
  const personnelToday = project
    ? personnelAttendance.filter(
        (a) => a.projectId === project.id && a.date === date && a.present
      ).length
    : 0;
  const machinesToday = project
    ? machineAttendance.filter((a) => a.projectId === project.id && a.date === date && a.present).length
    : 0;

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
        <p className="text-sm text-text2">Önce bir proje seç.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Günlük Rapor"
        description={`Sahada günlük durum raporu`}
        icon={FileText}
        actions={
          <Button variant="accent" onClick={save}>
            <Save size={14} /> Kaydet
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shift(-1)}
              disabled={!canPrev}
              className="p-2 rounded-md bg-bg4 hover:bg-bg3 disabled:opacity-40 disabled:cursor-not-allowed"
              title={canPrev ? "Önceki gün" : "Proje başlangıcındasın"}
            >
              <ChevronLeft size={14} />
            </button>
            <Input
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDate(clampDate(e.target.value))}
              className="w-44 font-mono"
            />
            <button
              onClick={() => shift(1)}
              disabled={!canNext}
              className="p-2 rounded-md bg-bg4 hover:bg-bg3 disabled:opacity-40 disabled:cursor-not-allowed"
              title={canNext ? "Sonraki gün" : date === today ? "Bugünden ileri gidilemez" : "Proje sonundasın"}
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/10 border border-accent/30">
            <span className="text-[10px] uppercase tracking-wider font-bold text-accent">
              Proje Günü
            </span>
            <span className="font-mono font-bold text-accent">
              {projectDayNum}
            </span>
            <span className="text-text3 font-mono text-xs">/ {projectTotalDays}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {existing ? (
              <Badge variant="green">Mevcut Rapor</Badge>
            ) : (
              <Badge variant="gray">Yeni Rapor</Badge>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardTitle>Hava Durumu</CardTitle>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-bg3">
              {weatherIcon(existing?.weather ?? weather?.condition)}
              <div>
                <div className="font-medium">{existing?.weather ?? weather?.condition}</div>
                <div className="text-xs text-text3 font-mono">
                  {existing?.temperatureMin ?? weather?.tempMin}°C —{" "}
                  {existing?.temperatureMax ?? weather?.tempMax}°C
                </div>
              </div>
              <Badge variant="accent" className="ml-auto">otomatik</Badge>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={workStopped}
                onChange={(e) => setWorkStopped(e.target.checked)}
                className="accent-red"
              />
              <span className="text-text">Hava nedeniyle iş durdu</span>
            </label>
            {workStopped && (
              <Input
                value={workStoppedReason}
                onChange={(e) => setWorkStoppedReason(e.target.value)}
                placeholder="Açıklama (yağmur, fırtına, vs.)"
              />
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Otomatik Veriler</CardTitle>
          <dl className="space-y-2 text-sm">
            <Row label="Personel (puantaj)">{personnelToday}</Row>
            <Row label="Makine (puantaj)">{machinesToday}</Row>
            <Row label="Tarih">{formatDate(date)}</Row>
          </dl>
        </Card>

        <Card>
          <CardTitle>Fotoğraflar ({photos.length})</CardTitle>
          <label className="block w-full cursor-pointer">
            <input type="file" accept="image/*" multiple capture="environment" onChange={onPhotoChange} className="hidden" />
            <div className="border-2 border-dashed border-border2 rounded-lg p-4 text-center hover:border-accent/40 transition-colors">
              <Camera size={24} className="mx-auto text-text3 mb-2" />
              <div className="text-xs text-text3">Foto çek veya seç</div>
            </div>
          </label>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {photos.map((p, i) => (
                <div key={p.uploadedAt + i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption || `Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 bg-black/70 rounded-md text-white hover:bg-red/80"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <Card className="md:col-span-3">
          <CardTitle>Özet</CardTitle>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Bugün sahada yapılan işler, önemli olaylar..."
            rows={4}
          />
        </Card>
        <Card>
          <CardTitle>Sorunlar</CardTitle>
          <Textarea
            value={issues}
            onChange={(e) => setIssues(e.target.value)}
            placeholder="Karşılaşılan sorunlar..."
            rows={4}
          />
        </Card>
        <Card>
          <CardTitle>Yarınki Plan</CardTitle>
          <Textarea
            value={tomorrowPlan}
            onChange={(e) => setTomorrowPlan(e.target.value)}
            placeholder="Yarın yapılacaklar..."
            rows={4}
          />
        </Card>
        <Card>
          <CardTitle>İpuçları</CardTitle>
          <Alert variant="info">
            Telefon kamerası kullanılabilir. Hava durumu mock — gerçek API entegrasyonu sonra eklenecek.
          </Alert>
        </Card>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm py-1">
      <dt className="text-text3 text-xs uppercase tracking-wider">{label}</dt>
      <dd className="font-mono text-text">{children}</dd>
    </div>
  );
}
