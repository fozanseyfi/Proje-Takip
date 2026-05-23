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
  RefreshCw,
  Wind,
  Droplets,
} from "lucide-react";
import { useStore, useCurrentProject, useCurrentUser, useProjectWbs, useProjectRealized } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDate, toISODate, daysBetween } from "@/lib/utils";
import { fetchWeatherDayCached, type WeatherDay } from "@/lib/data/weather";

// Hava durumu artık Open-Meteo'dan gerçek zamanlı çekiliyor — bkz. fetchWeatherDayCached

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
  const wbs = useProjectWbs(project?.id);
  const realized = useProjectRealized(project?.id);

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

  // Open-Meteo'dan asenkron hava durumu — proje konumu varsa otomatik çek
  const [weather, setWeather] = useState<WeatherDay | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [summary, setSummary] = useState("");
  const [issues, setIssues] = useState("");
  const [tomorrowPlan, setTomorrowPlan] = useState("");
  const [photos, setPhotos] = useState<{ url: string; caption?: string; uploadedAt: string }[]>([]);
  const [workStopped, setWorkStopped] = useState(false);
  const [workStoppedReason, setWorkStoppedReason] = useState("");

  // Hava durumunu çek — sadece koordinat varsa ve "existing weather" yoksa
  useEffect(() => {
    setWeatherError(null);
    if (!project || existing?.weather) {
      setWeather(null);
      return;
    }
    if (project.latitude == null || project.longitude == null) {
      // Koordinat yok — uyarı göster, hava otomatik dolmasın
      setWeather(null);
      setWeatherError("Proje ayarlarında enlem/boylam tanımlı değil — hava otomatik çekilemez");
      return;
    }
    let cancelled = false;
    setWeatherLoading(true);
    fetchWeatherDayCached(project.latitude, project.longitude, date)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setWeather(null);
          setWeatherError(err instanceof Error ? err.message : "Hava durumu alınamadı");
        }
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, date, existing?.weather]);

  // Tarihten existing'i ilkleme — state'i resetle
  useEffect(() => {
    setSummary(existing?.summary ?? "");
    setIssues(existing?.issues ?? "");
    setTomorrowPlan(existing?.tomorrowPlan ?? "");
    setPhotos(existing?.photos ?? []);
    setWorkStopped(existing?.workStopped ?? false);
    setWorkStoppedReason(existing?.workStoppedReason ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id]);

  // Hava durumu yüklendikten sonra workStopped'ı otomatik aktive et (yalnız existing yoksa)
  useEffect(() => {
    if (!weather || existing) return;
    if (weather.workStopped) {
      setWorkStopped(true);
      setWorkStoppedReason(weather.workStoppedReason);
    }
  }, [weather, existing]);

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

  async function downloadDCR() {
    if (!project) return;
    const { downloadDCRPDF } = await import("@/lib/pdf/dcr");
    await downloadDCRPDF({
      project,
      report: existing,
      date,
      personnelAttendance,
      machineAttendance,
      wbs,
      realized,
      preparedBy: user?.fullName,
    });
    toast("DCR PDF indirildi", "success");
  }

  return (
    <>
      <PageHeader
        title="Günlük Rapor"
        description={`Sahada günlük durum raporu`}
        icon={FileText}
        actions={
          <>
            <Button variant="outline" onClick={downloadDCR} disabled={!existing && !summary} title="Daily Construction Report — saha mühendisinin imzalanan tek-sayfa A4 raporu">
              <FileText size={14} /> DCR PDF
            </Button>
            <Button variant="accent" onClick={save}>
              <Save size={14} /> Kaydet
            </Button>
          </>
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
          <CardTitle>
            Hava Durumu
            {weather && (
              <span className="ml-auto text-[10px] text-text3 font-mono">Open-Meteo</span>
            )}
          </CardTitle>
          <div className="space-y-2">
            {weatherLoading ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-bg3 text-text3 text-sm">
                <RefreshCw size={14} className="animate-spin" />
                Hava verisi alınıyor…
              </div>
            ) : weatherError && !existing?.weather ? (
              <div className="p-3 rounded-lg bg-yellow/10 border border-yellow/30 text-yellow-dark text-xs">
                <strong>⚠ Otomatik hava yok:</strong> {weatherError}
                <div className="mt-1 text-text3">
                  Hava bilgilerini manuel girebilir veya{" "}
                  <a href="/settings" className="text-accent underline">
                    proje ayarları
                  </a>
                  &apos;ndan enlem/boylam ekleyebilirsin.
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-bg3">
                  {weatherIcon(existing?.weather ?? weather?.condition)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{existing?.weather ?? weather?.condition ?? "—"}</div>
                    <div className="text-xs text-text3 font-mono">
                      {existing?.temperatureMin ?? weather?.tempMin ?? "—"}°C —{" "}
                      {existing?.temperatureMax ?? weather?.tempMax ?? "—"}°C
                    </div>
                  </div>
                  {weather && (
                    <Badge variant={existing?.weather ? "gray" : "accent"} className="ml-auto">
                      {existing?.weather ? "kayıtlı" : "otomatik"}
                    </Badge>
                  )}
                </div>
                {/* Detay satırı — sadece otomatik veride */}
                {weather && !existing?.weather && (
                  <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] text-text2 flex-wrap">
                    <span className="inline-flex items-center gap-1" title="Günlük toplam yağış">
                      <Droplets size={11} className="text-blue" />
                      <span className="font-mono">{weather.precipitation.toFixed(1)} mm</span>
                    </span>
                    <span className="inline-flex items-center gap-1" title="Maks. rüzgar hızı">
                      <Wind size={11} className="text-text3" />
                      <span className="font-mono">{weather.windMax} km/h</span>
                    </span>
                  </div>
                )}
                {/* İş durdu otomatik bilgilendirme */}
                {weather?.workStopped && !existing?.weather && (
                  <Alert variant="warning" className="!py-2 !text-xs">
                    ⚠ Otomatik tespit: <strong>{weather.workStoppedReason}</strong> — iş durdu bayrağı aktif edildi
                  </Alert>
                )}
              </>
            )}
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
            Telefon kamerası kullanılabilir (öndeki/arkadaki). Hava durumu otomatik dolar
            (Open-Meteo, proje koordinatları). DCR PDF butonu kayıt sonrası imzalanan günlük
            rapor üretir.
          </Alert>
        </Card>
        {/* Mobile alt boşluk — sticky bottom action bar için */}
        <div className="md:hidden h-20" aria-hidden="true" />
      </div>

      {/* MOBILE: Sticky bottom action bar */}
      <div
        className="md:hidden fixed left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-border px-3 py-2 flex gap-2 shadow-large"
        style={{
          bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          onClick={() => shift(-1)}
          disabled={!canPrev}
          className="flex-1 h-12 rounded-lg bg-white border border-border text-text2 flex items-center justify-center gap-1 font-semibold text-sm disabled:opacity-40 active:scale-95 transition-all"
        >
          <ChevronLeft size={16} />
          Önceki
        </button>
        <button
          onClick={save}
          className="flex-[2] h-12 rounded-lg bg-accent text-white flex items-center justify-center gap-2 font-bold text-sm shadow-medium active:scale-95 transition-all"
        >
          <Save size={16} />
          Kaydet
        </button>
        <button
          onClick={() => shift(1)}
          disabled={!canNext}
          className="flex-1 h-12 rounded-lg bg-white border border-border text-text2 flex items-center justify-center gap-1 font-semibold text-sm disabled:opacity-40 active:scale-95 transition-all"
        >
          Sonraki
          <ChevronRight size={16} />
        </button>
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
