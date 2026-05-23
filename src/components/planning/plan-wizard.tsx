"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, AlertTriangle, Wand2, RotateCcw, Pencil, Lock } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn, formatNumber, toISODate } from "@/lib/utils";
import {
  computeDistribution,
  workingDates,
  allDatesInRange,
  endDateFromDuration,
  durationFromDates,
  type DistributionShape,
} from "@/lib/calc/distribution";
import type { WbsItem } from "@/lib/store/types";

const SHAPE_OPTIONS: { value: DistributionShape; label: string; icon: string; desc: string }[] = [
  { value: "uniform", label: "Düzgün", icon: "▬", desc: "Eşit dağılım — her güne aynı miktar" },
  { value: "s-curve", label: "S-eğrisi", icon: "∿", desc: "Ortada yoğun, kenarlar yumuşak" },
  { value: "front-loaded", label: "Önden Yüklü", icon: "◤", desc: "Başta yoğun, sonda azalan" },
  { value: "back-loaded", label: "Sondan Yüklü", icon: "◢", desc: "Başta az, sonda yoğun" },
  { value: "daily-fixed", label: "Sabit Günlük", icon: "≡", desc: "Her gün sabit miktar, kalanı son güne" },
];

/**
 * PlanWizard — bir leaf WBS aktivitesi için planlama sihirbazı.
 *
 * Akış:
 * 1. Aktivite tipi work ise: şablon seç + başlangıç + (süre veya bitiş) + Cmt/Pz checkbox
 * 2. "Önizleme" tablosu — günlük dağılım gösterilir
 * 3. Manuel oynama: hücrelere elle değer girilebilir (sıkı toplam validasyonu — eşit olmazsa Tamam kapalı)
 * 4. Tamam → onSubmit(byDate) çağrılır
 *
 * Aktivite tipi milestone ise: tek tarih seç + onaylama.
 */

export interface PlanWizardProps {
  open: boolean;
  onClose: () => void;
  item: WbsItem | null;
  /** Mevcut günlük plan (varsa). */
  existingByDate: Record<string, number>;
  /** Çağrılır: yeni günlük plan kaydet (record formatında {date: qty}). */
  onSubmit: (byDate: Record<string, number>) => void;
  /** Milestone: tek tarih kaydet. */
  onSubmitMilestone?: (date: string) => void;
  /** Öncül kısıtı — başlangıç bu tarihten önce olamaz. */
  earliestStart?: string;
  /** Öncül kısıtı — bitiş bu tarihten sonra olamaz. */
  latestEnd?: string;
  /** Kısıt sebebi (tooltip için). */
  constraintReason?: string;
}

export function PlanWizard({
  open,
  onClose,
  item,
  existingByDate,
  onSubmit,
  onSubmitMilestone,
  earliestStart,
  latestEnd,
  constraintReason,
}: PlanWizardProps) {
  if (!item) return null;
  // Aktivite tipine göre ayrı sihirbaz
  if (item.activityType === "milestone") {
    return (
      <MilestoneWizard
        key={item.id}
        open={open}
        onClose={onClose}
        item={item}
        existingByDate={existingByDate}
        onSubmit={onSubmitMilestone}
        earliestStart={earliestStart}
        latestEnd={latestEnd}
        constraintReason={constraintReason}
      />
    );
  }
  return (
    <WorkWizard
      key={item.id}
      open={open}
      onClose={onClose}
      item={item}
      existingByDate={existingByDate}
      onSubmit={onSubmit}
      earliestStart={earliestStart}
      latestEnd={latestEnd}
      constraintReason={constraintReason}
    />
  );
}

// ───────────────────────────────────────────────────────────────
// WORK WIZARD
// ───────────────────────────────────────────────────────────────

function WorkWizard({
  open,
  onClose,
  item,
  existingByDate,
  onSubmit,
  earliestStart,
  latestEnd,
  constraintReason,
}: {
  open: boolean;
  onClose: () => void;
  item: WbsItem;
  existingByDate: Record<string, number>;
  onSubmit: (byDate: Record<string, number>) => void;
  earliestStart?: string;
  latestEnd?: string;
  constraintReason?: string;
}) {
  const toast = useToast((s) => s.push);

  // Mevcut plandan başlangıç/bitiş tahmin et
  const existingDates = Object.keys(existingByDate).sort();
  const existingStartRaw = existingDates[0] ?? toISODate(new Date());
  const existingEnd = existingDates[existingDates.length - 1] ?? "";
  // Başlangıç tarihi öncül kısıtından önce olamaz
  const existingStart =
    earliestStart && existingStartRaw < earliestStart ? earliestStart : existingStartRaw;

  const [startDate, setStartDate] = useState(existingStart);
  // Kalemin tanımlı workweek'i varsa Cmt/Pz default'larını ondan türet
  const [workSat, setWorkSat] = useState(() => {
    if (item.workweek === "mon-fri") return false;
    return true; // mon-sat (default) + mon-sun → Cmt açık
  });
  const [workSun, setWorkSun] = useState(() => item.workweek === "mon-sun");
  const [shape, setShape] = useState<DistributionShape>("uniform");
  const [dailyFixed, setDailyFixed] = useState<number>(0);
  const totalQty = item.quantity || 0;

  // Hesaplanmış (önizleme) günlük tablo
  const [draft, setDraft] = useState<Record<string, number>>(existingByDate);
  const [manuallyEdited, setManuallyEdited] = useState(false);

  // Açılışta süre + bitiş varsa süre türet, yoksa 10 gün default
  const initialDuration = (() => {
    if (existingStart && existingEnd) {
      return durationFromDates(existingStart, existingEnd, true, false);
    }
    // PMP "Estimate Activity Durations" — kalemin kendi tahminini öncelikle kullan
    if (item.estimatedDurationDays && item.estimatedDurationDays > 0) {
      return Math.max(1, Math.round(item.estimatedDurationDays));
    }
    return Math.max(1, item.quantity > 0 ? Math.min(30, item.quantity) : 10);
  })();
  const [duration, setDuration] = useState<number>(initialDuration);
  const [endDate, setEndDate] = useState(
    existingEnd || endDateFromDuration(existingStart, initialDuration, true, false)
  );

  // Süre ya da bitiş değişince diğeri otomatik hesaplanır
  function clampStart(s: string): string {
    if (earliestStart && s < earliestStart) return earliestStart;
    return s;
  }
  function clampEnd(e: string): string {
    if (latestEnd && e > latestEnd) return latestEnd;
    return e;
  }
  function applyDurationChange(d: number) {
    if (d <= 0) return;
    setDuration(d);
    const candidate = endDateFromDuration(startDate, d, workSat, workSun);
    setEndDate(clampEnd(candidate));
  }
  function applyEndDateChange(e: string) {
    const clamped = clampEnd(e);
    setEndDate(clamped);
    if (clamped && startDate) {
      const d = durationFromDates(startDate, clamped, workSat, workSun);
      setDuration(Math.max(1, d));
    }
    if (clamped !== e && latestEnd) {
      toast(`Bitiş tarihi öncül kısıtı: en geç ${latestEnd}`, "info");
    }
  }
  function applyStartChange(s: string) {
    const clamped = clampStart(s);
    setStartDate(clamped);
    if (duration > 0) {
      const candidate = endDateFromDuration(clamped, duration, workSat, workSun);
      setEndDate(clampEnd(candidate));
    }
    if (clamped !== s && earliestStart) {
      toast(`Başlangıç tarihi öncül kısıtı: en erken ${earliestStart}`, "info");
    }
  }

  // Şablon/tarih/checkbox değiştikçe otomatik yeniden hesapla — kullanıcı manuel edit yapmadıkça.
  useEffect(() => {
    if (manuallyEdited) return;
    if (!startDate || !endDate) return;
    const dates = workingDates(startDate, endDate, workSat, workSun);
    if (dates.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft({});
      return;
    }
    const portions = computeDistribution(totalQty, dates.length, shape, dailyFixed);
    const next: Record<string, number> = {};
    for (let i = 0; i < dates.length; i++) {
      if (portions[i] > 0) next[dates[i]] = portions[i];
    }
    setDraft(next);
  }, [shape, startDate, endDate, workSat, workSun, dailyFixed, totalQty, manuallyEdited]);

  // Manuel düzenlemeleri sıfırla ve şablona dön
  function resetToShape() {
    setManuallyEdited(false);
  }

  // Bir hücreyi değiştir — yalnızca çalışma günleri editlenebilir
  function setCell(date: string, val: number, isWorkDay: boolean) {
    if (!isWorkDay) return;
    const v = Math.max(0, Number(val) || 0);
    setDraft((s) => {
      const n = { ...s };
      if (v === 0) delete n[date];
      else n[date] = v;
      return n;
    });
    setManuallyEdited(true);
  }

  // Önizleme tarih listesi — TÜM günler (hafta sonu dahil, kilit gösterimi için)
  const previewAll = useMemo(() => {
    if (!startDate || !endDate) return [];
    return allDatesInRange(startDate, endDate, workSat, workSun);
  }, [startDate, endDate, workSat, workSun]);
  const workDayCount = useMemo(
    () => previewAll.filter((d) => d.isWorkDay).length,
    [previewAll]
  );

  const draftTotal = useMemo(
    () => Object.values(draft).reduce((a, b) => a + (Number(b) || 0), 0),
    [draft]
  );
  const totalMatches = Math.abs(draftTotal - totalQty) < 0.0001;

  function submit() {
    if (!totalMatches) {
      toast(
        `Toplam tutmuyor: günlük toplamı ${formatNumber(draftTotal, 2)}, gereken ${formatNumber(totalQty, 2)}`,
        "error"
      );
      return;
    }
    onSubmit(draft);
    onClose();
  }

  const hasExisting = Object.keys(existingByDate).length > 0;

  return (
    <Dialog open={open} onClose={onClose} title={`Planla — ${item.name}`} size="xl">
      <div className="space-y-4">
        {/* Üst bilgi şeridi */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg2/60 border border-border text-[12px]">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent/15 text-accent text-[10px] font-bold uppercase tracking-wider">
            <Wand2 size={11} /> Work
          </span>
          <span className="text-text3">Kod:</span>
          <span className="font-mono font-bold text-text">{item.code}</span>
          <span className="text-text3 ml-3">Toplam:</span>
          <span className="font-mono font-bold text-text">
            {formatNumber(totalQty, 2)} {item.unit || ""}
          </span>
          {hasExisting && (
            <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow/15 text-yellow text-[10px] font-bold uppercase tracking-wider">
              <Pencil size={10} /> Düzenle modu — mevcut planı koruyor
            </span>
          )}
        </div>

        {/* Şablon — sekme görünümlü segmented control */}
        <div>
          <label className="block text-[10.5px] font-bold uppercase tracking-wider text-text2 mb-1.5">
            Dağılım Şablonu
          </label>
          <div className="inline-flex p-1 bg-bg3 rounded-lg border border-border gap-0.5 flex-wrap">
            {SHAPE_OPTIONS.map((opt) => {
              const active = shape === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setShape(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                    active
                      ? "bg-white text-accent shadow-soft border border-accent/30"
                      : "text-text2 hover:text-text hover:bg-white/60"
                  )}
                  title={opt.desc}
                >
                  <span className="mr-1">{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tarih + süre */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Field
            label="Başlangıç Tarihi"
            hint={earliestStart ? `Öncül: en erken ${earliestStart}` : undefined}
          >
            <Input
              type="date"
              value={startDate}
              min={earliestStart}
              max={latestEnd}
              onChange={(e) => applyStartChange(e.target.value)}
            />
          </Field>
          <Field
            label="Süre (çalışma günü)"
            hint={
              item.estimatedDurationDays && item.estimatedDurationDays > 0
                ? `WBS tahmini: ${item.estimatedDurationDays} gün`
                : undefined
            }
          >
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => applyDurationChange(Number(e.target.value) || 0)}
            />
          </Field>
          <Field
            label="Bitiş Tarihi"
            hint={latestEnd ? `Öncül: en geç ${latestEnd}` : undefined}
          >
            <Input
              type="date"
              value={endDate}
              min={earliestStart}
              max={latestEnd}
              onChange={(e) => applyEndDateChange(e.target.value)}
            />
          </Field>
        </div>

        {(earliestStart || latestEnd) && (
          <div className="px-3 py-2 rounded-md bg-blue/5 border border-blue/25 text-[11.5px] text-text2 flex items-start gap-2">
            <Lock size={12} className="text-blue shrink-0 mt-0.5" />
            <span>
              <strong className="text-blue">Öncül kısıtı aktif.</strong>{" "}
              {constraintReason ?? "Bağımlı olduğu aktivitelerin bitişine göre bu satırın başlangıcı/bitişi sınırlandı."}
              {earliestStart && (
                <>
                  {" "}En erken başlangıç: <strong className="font-mono">{earliestStart}</strong>.
                </>
              )}
              {latestEnd && (
                <>
                  {" "}En geç bitiş: <strong className="font-mono">{latestEnd}</strong>.
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 flex-wrap">
          <label className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={workSat}
              onChange={(e) => setWorkSat(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            Cumartesi çalış
          </label>
          <label className="inline-flex items-center gap-2 text-[12.5px] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={workSun}
              onChange={(e) => setWorkSun(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            Pazar çalış
          </label>
          {shape === "daily-fixed" && (
            <Field label="Günlük Sabit Miktar" className="ml-auto">
              <Input
                type="number"
                step="0.01"
                value={dailyFixed}
                onChange={(e) => setDailyFixed(Number(e.target.value) || 0)}
                className="w-32"
              />
            </Field>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text3 font-mono">
            <Wand2 size={11} className="text-accent" /> Değişiklikler otomatik uygulanır
          </span>
        </div>

        {manuallyEdited && (
          <div className="px-3 py-2 rounded-md bg-yellow/8 border border-yellow/25 text-[11.5px] text-text2 flex items-center gap-2">
            <AlertTriangle size={12} className="text-yellow" />
            Manuel düzenleme yaptın — şablonu değiştirsen bile otomatik dağıtım yapılmıyor.
            <button
              onClick={resetToShape}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-yellow hover:underline"
            >
              <RotateCcw size={11} /> Şablona Dön
            </button>
          </div>
        )}

        {/* Önizleme tablosu — TÜM günler, hafta sonu kilitli görünür */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-1.5 bg-bg2 border-b border-border flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-text2">
            <CalendarDays size={11} /> Günlük Dağılım Önizlemesi
            <span className="ml-auto font-mono text-text3 normal-case tracking-normal">
              {workDayCount} çalışma günü · {previewAll.length - workDayCount} kapalı gün
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {previewAll.length === 0 ? (
              <div className="px-3 py-6 text-center text-text3 text-[12px]">
                Başlangıç ve bitiş tarihi seç, şablon uygula.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-bg2/40 sticky top-0">
                  <tr className="text-[10px] uppercase tracking-wider text-text3">
                    <th className="px-3 py-1.5 text-left w-32">Tarih</th>
                    <th className="px-3 py-1.5 text-left w-16">Gün</th>
                    <th className="px-3 py-1.5 text-right">Miktar ({item.unit || ""})</th>
                  </tr>
                </thead>
                <tbody>
                  {previewAll.map(({ date: d, isWorkDay }) => {
                    const dt = new Date(d + "T00:00:00");
                    const dowIdx = dt.getDay();
                    const dow = ["Pzr", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][dowIdx];
                    const isWeekend = dowIdx === 0 || dowIdx === 6;
                    return (
                      <tr
                        key={d}
                        className={cn(
                          "border-t border-border/40",
                          !isWorkDay && "bg-bg3/60",
                          isWorkDay && isWeekend && "bg-yellow/[0.04]"
                        )}
                      >
                        <td className={cn("px-3 py-1 font-mono", isWorkDay ? "text-text2" : "text-text3")}>{d}</td>
                        <td className={cn(
                          "px-3 py-1 text-[11px] font-bold",
                          !isWorkDay ? "text-text3" : isWeekend ? "text-yellow" : "text-text3"
                        )}>
                          {dow}
                          {!isWorkDay && <span className="ml-1 text-text3">·kapalı</span>}
                        </td>
                        <td className="px-3 py-0.5 text-right">
                          {isWorkDay ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={draft[d] ?? ""}
                              onChange={(e) => setCell(d, Number(e.target.value) || 0, true)}
                              placeholder="0"
                              className="w-28 px-2 py-1 text-xs font-mono bg-white border border-border rounded text-right focus:outline-none focus:border-accent"
                            />
                          ) : (
                            <span
                              className="inline-flex items-center justify-end gap-1 w-28 px-2 py-1 text-xs font-mono bg-bg3 border border-border rounded text-text3 select-none"
                              title="Kapalı gün (Cmt/Pz çalış işaretli değil)"
                            >
                              <Lock size={10} /> —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-bg2 font-bold">
                    <td className="px-3 py-2" colSpan={2}>
                      Toplam
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono",
                        totalMatches ? "text-green" : "text-red"
                      )}
                    >
                      {formatNumber(draftTotal, 2)} / {formatNumber(totalQty, 2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Validasyon mesajı */}
        {!totalMatches && workDayCount > 0 && (
          <div className="px-3 py-2 rounded-md bg-red/8 border border-red/25 text-[11.5px] text-red flex items-center gap-2">
            <AlertTriangle size={12} />
            <strong>Toplam eşleşmiyor.</strong> Günlük toplam{" "}
            <span className="font-mono font-bold">{formatNumber(draftTotal, 2)}</span> olmalı{" "}
            <span className="font-mono font-bold">{formatNumber(totalQty, 2)}</span>. Aradaki fark{" "}
            <span className="font-mono font-bold">{formatNumber(draftTotal - totalQty, 2)}</span>.
          </div>
        )}
        {totalMatches && workDayCount > 0 && (
          <div className="px-3 py-2 rounded-md bg-green/8 border border-green/25 text-[11.5px] text-green flex items-center gap-2">
            <CheckCircle2 size={12} />
            <strong>Toplam tutuyor.</strong> Plan onaya hazır.
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button variant="accent" onClick={submit} disabled={!totalMatches || workDayCount === 0}>
          <CheckCircle2 size={14} /> Tamam ve Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ───────────────────────────────────────────────────────────────
// MILESTONE WIZARD
// ───────────────────────────────────────────────────────────────

function MilestoneWizard({
  open,
  onClose,
  item,
  existingByDate,
  onSubmit,
  earliestStart,
  latestEnd,
  constraintReason,
}: {
  open: boolean;
  onClose: () => void;
  item: WbsItem;
  existingByDate: Record<string, number>;
  onSubmit?: (date: string) => void;
  earliestStart?: string;
  latestEnd?: string;
  constraintReason?: string;
}) {
  // Milestone tarihi: önce item.milestoneDate, sonra mevcut byDate'in ilk tarihi, sonra bugün
  const initial =
    item.milestoneDate ??
    Object.keys(existingByDate).sort()[0] ??
    toISODate(new Date());
  // Kısıta göre clamp
  const clampedInitial = (() => {
    let d = initial;
    if (earliestStart && d < earliestStart) d = earliestStart;
    if (latestEnd && d > latestEnd) d = latestEnd;
    return d;
  })();
  const [date, setDate] = useState(clampedInitial);
  const toast = useToast((s) => s.push);

  function setClamped(v: string) {
    let d = v;
    if (earliestStart && d < earliestStart) d = earliestStart;
    if (latestEnd && d > latestEnd) d = latestEnd;
    setDate(d);
    if (d !== v) toast("Tarih öncül kısıtına göre düzeltildi", "info");
  }

  function submit() {
    if (!date) {
      toast("Tarih seçmelisin", "error");
      return;
    }
    onSubmit?.(date);
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={`Kilometre Taşı — ${item.name}`} size="md">
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple/8 border border-purple/25 text-[12px]">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple/20 text-purple text-[10px] font-bold uppercase tracking-wider">
            ◆ Milestone
          </span>
          <span className="text-text3">Kod:</span>
          <span className="font-mono font-bold text-text">{item.code}</span>
          <span className="ml-auto text-[11px] text-text2">
            Miktar/birim yok — tek tarih + 0/100 tamamlanma
          </span>
        </div>

        <p className="text-[13px] text-text2 leading-relaxed">
          Bu bir kilometre taşıdır (örn. sözleşme imzası, izin alındı, test başladı). Sadece{" "}
          <strong>hedef tarih</strong> girilir, gün-gün dağılım yapılmaz.
        </p>

        <Field
          label="Hedef Tarih"
          hint={
            earliestStart || latestEnd
              ? `Öncül kısıtı: ${earliestStart ?? "—"} ile ${latestEnd ?? "—"} arası`
              : undefined
          }
        >
          <Input
            type="date"
            value={date}
            min={earliestStart}
            max={latestEnd}
            onChange={(e) => setClamped(e.target.value)}
          />
        </Field>

        {(earliestStart || latestEnd) && (
          <div className="px-3 py-2 rounded-md bg-blue/5 border border-blue/25 text-[11.5px] text-text2 flex items-start gap-2">
            <Lock size={12} className="text-blue shrink-0 mt-0.5" />
            <span>
              <strong className="text-blue">Öncül kısıtı aktif.</strong>{" "}
              {constraintReason ?? "Bağımlı olduğu aktivitelerin bitişine göre bu milestone'un tarihi sınırlandı."}
            </span>
          </div>
        )}

        {/* Salt-okunur tamamlanma bilgisi (yapıldı işareti Gerçekleşme sayfasında verilir) */}
        {item.milestoneCompletedAt ? (
          <div className="px-3 py-2 rounded-md bg-green/8 border border-green/30 text-[12px] flex items-center gap-2">
            <CheckCircle2 size={13} className="text-green shrink-0" />
            <span className="text-green font-bold">Gerçekleşti</span>
            <span className="font-mono text-text2 text-[11px]">{item.milestoneCompletedAt}</span>
            <span className="ml-auto text-[10.5px] text-text3">
              Gerçekleşme kaydı için <strong>Gerçekleşme</strong> sayfasını kullan.
            </span>
          </div>
        ) : (
          <div className="px-3 py-2 rounded-md bg-bg2/40 border border-border text-[11.5px] text-text3">
            ℹ Bu milestone&apos;un &quot;yapıldı&quot; işareti planlamadan değil,{" "}
            <strong className="text-text2">Gerçekleşme</strong> sayfasından girilir.
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button variant="accent" onClick={submit}>
          <CheckCircle2 size={14} /> Kaydet
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
