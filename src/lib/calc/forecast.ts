/**
 * EVM (Earned Value Management) — schedule-bazlı performans + tahmin.
 *
 * Schedule-EVM kullanır (cost-bazlı CPI/AC/EAC$ yok — actual cost tutarlı izlenmiyor).
 *
 * Metrikler:
 *   PV (Planned Value)        — bu tarihe kadar PLANLA göre yapılması gereken % (0..1)
 *   EV (Earned Value)         — bu tarihe kadar gerçekten kazanılan % (0..1)
 *   SV (Schedule Variance)    — EV − PV (negatif = gerideyiz)
 *   SPI (Schedule Perf. Idx.) — EV / PV (1 = zamanında, <1 = geride, >1 = önde)
 *   Tahmini Bitiş             — startDate + originalDuration / SPI
 *   Sapma (gün)               — tahmini bitiş − planlanan bitiş
 */

import type { DateQuantityMap } from "@/lib/store/types";
import { addDays, daysBetween, toISODate } from "@/lib/utils";
import {
  computeProgress,
  buildSCurve,
  type WbsItemForCalc,
  type SCurvePoint,
} from "./progress";

export interface ForecastResult {
  /** Planlanan değer % (0..1) — bu tarihe kadar planda olması gereken */
  pv: number;
  /** Earned Value % (0..1) — gerçekleşen */
  ev: number;
  /** Schedule Variance — EV − PV. + öndeyiz, − gerideyiz. */
  sv: number;
  /** Schedule Performance Index — EV/PV. null = PV sıfır (henüz başlamadı). */
  spi: number | null;
  /** Bu hızda devam edersek bitiş tarihi (ISO). null = SPI hesaplanamıyor. */
  forecastEnd: string | null;
  /** Tahmini bitiş − planlanan bitiş (gün). 0 = zamanında, + = geç, − = erken. */
  deltaDays: number;
  /** Planlanan süre (gün) — referans için */
  plannedDurationDays: number;
}

export function computeForecast(
  items: WbsItemForCalc[],
  planned: DateQuantityMap,
  realized: DateQuantityMap,
  filterDate: string,
  projectStart: string,
  plannedEnd: string
): ForecastResult {
  const { planPct: pv, realPct: ev } = computeProgress(items, planned, realized, filterDate);
  const sv = ev - pv;
  const spi = pv > 0 ? ev / pv : null;
  const plannedDurationDays = Math.max(1, daysBetween(projectStart, plannedEnd) + 1);

  let forecastEnd: string | null = null;
  let deltaDays = 0;
  if (spi && spi > 0) {
    // Tahmini toplam süre = planlanan süre / SPI
    const forecastDuration = Math.round(plannedDurationDays / spi);
    const fe = addDays(new Date(projectStart), forecastDuration - 1);
    forecastEnd = toISODate(fe);
    deltaDays = daysBetween(plannedEnd, forecastEnd);
  }

  return {
    pv,
    ev,
    sv,
    spi,
    forecastEnd,
    deltaDays,
    plannedDurationDays,
  };
}

export interface ForecastCurvePoint {
  date: string;
  /** Plan (PV) % 0..100 — projenin tamamı için */
  pv: number;
  /** Earned (EV) % 0..100 — filterDate sonrası NaN olur */
  ev: number;
  /** Tahmin % 0..100 — filterDate'ten başlayarak SPI hızıyla 100'e ekstrapolasyon. Öncesi NaN. */
  forecast: number;
}

// ────────────────────────────────────────────────────────────────────
// PMP güvenilirlik kademeleri — EVM tahmininin EV%'ye göre güvenilirliği.
// Christensen (1993): %20 sonrası SPI/CPI stabilizasyon noktası.
// ────────────────────────────────────────────────────────────────────

export type ConfidenceTier = "none" | "very-low" | "low" | "medium" | "high";

export interface ConfidenceInfo {
  tier: ConfidenceTier;
  /** Kullanıcıya gösterilecek kısa etiket */
  label: string;
  /** Tooltip / açıklama */
  description: string;
  /** Badge tonunu */
  badgeColor: "red" | "yellow" | "blue" | "green" | "gray";
  /** Tahmin çizgisi gösterilsin mi */
  showForecast: boolean;
  /** Forecast çizgisinin opacity'si (0..1) */
  forecastOpacity: number;
  /** KPI değerleri "—" gösterilsin mi */
  hideValues: boolean;
}

/**
 * EV (0..1 arası) değerine göre PMP güvenilirlik kademesi.
 * Threshold'lar:
 *   < %5   → none      (gösterme)
 *   < %15  → very-low  (kırmızı uyarı, soluk göster)
 *   < %20  → low       (sarı uyarı)
 *   < %50  → medium    (mavi, orta)
 *   ≥ %50  → high      (yeşil, yüksek)
 */
export function getConfidenceTier(ev: number): ConfidenceInfo {
  const pct = ev * 100;
  if (pct < 5) {
    return {
      tier: "none",
      label: "Yetersiz veri",
      description: `EV %${pct.toFixed(1)} — Tahmin için en az %5 gerçekleşme gerekir. PMP eşiği %20 (Christensen).`,
      badgeColor: "gray",
      showForecast: false,
      forecastOpacity: 0,
      hideValues: true,
    };
  }
  if (pct < 15) {
    return {
      tier: "very-low",
      label: "Çok düşük güvenilirlik",
      description: `EV %${pct.toFixed(1)} — Tahmin yön bilgisi bile değil. SPI günlük dalgalanır. PMP eşiği %20.`,
      badgeColor: "red",
      showForecast: true,
      forecastOpacity: 0.35,
      hideValues: false,
    };
  }
  if (pct < 20) {
    return {
      tier: "low",
      label: "Düşük güvenilirlik",
      description: `EV %${pct.toFixed(1)} — Tahmin yön belirtir, kesin tarih sayma. PMP eşiği %20.`,
      badgeColor: "yellow",
      showForecast: true,
      forecastOpacity: 0.6,
      hideValues: false,
    };
  }
  if (pct < 50) {
    return {
      tier: "medium",
      label: "Orta güvenilirlik",
      description: `EV %${pct.toFixed(1)} — PMP eşiğinin üstünde, tahmin makul. Christensen stabilizasyon noktası.`,
      badgeColor: "blue",
      showForecast: true,
      forecastOpacity: 1,
      hideValues: false,
    };
  }
  return {
    tier: "high",
    label: "Yüksek güvenilirlik",
    description: `EV %${pct.toFixed(1)} — Tahmin oldukça stabil, EVM literatürüne göre güvenilir.`,
    badgeColor: "green",
    showForecast: true,
    forecastOpacity: 1,
    hideValues: false,
  };
}

/**
 * S-eğrisi noktaları + filterDate'ten itibaren forecast extrapolasyonu.
 * Forecast: filterDate'teki EV'den başlayarak, original_curve × (1/SPI) hızıyla 100'e.
 */
export function buildForecastCurve(
  items: WbsItemForCalc[],
  planned: DateQuantityMap,
  realized: DateQuantityMap,
  filterDate: string,
  projectStart: string,
  plannedEnd: string
): { points: ForecastCurvePoint[]; forecastEnd: string | null } {
  const fc = computeForecast(items, planned, realized, filterDate, projectStart, plannedEnd);
  // Önce mevcut S-curve'ü al — buildSCurve filterDate'i geçen tarihlerde realPct=NaN döner
  const baseCurve: SCurvePoint[] = buildSCurve(items, planned, realized, filterDate);

  // Forecast bitiş tarihine kadar uzat
  const endIso = fc.forecastEnd && fc.forecastEnd > plannedEnd ? fc.forecastEnd : plannedEnd;
  // Mevcut curve'de bu tarihler yoksa ekle (PV %100 olarak devam, EV NaN)
  const existingDates = new Set(baseCurve.map((p) => p.date));
  const extra: SCurvePoint[] = [];
  let cursor = new Date(plannedEnd);
  const stop = new Date(endIso);
  while (cursor <= stop) {
    const d = toISODate(cursor);
    if (!existingDates.has(d)) {
      extra.push({ date: d, planPct: 100, realPct: NaN });
    }
    cursor = addDays(cursor, 1);
  }
  const fullCurve = [...baseCurve, ...extra].sort((a, b) => a.date.localeCompare(b.date));

  // Forecast çizgisi: filterDate'teki EV'den başlar, forecastEnd'de 100'e ulaşır.
  // Lineer interpolasyon. Eğer SPI null veya forecastEnd yoksa forecast çizgisi yok (hep NaN).
  const points: ForecastCurvePoint[] = fullCurve.map((p) => {
    const ev = p.realPct;
    let forecast: number = NaN;
    if (fc.forecastEnd && fc.spi) {
      if (p.date < filterDate) {
        forecast = NaN;
      } else if (p.date === filterDate) {
        forecast = isNaN(ev) ? fc.ev * 100 : ev;
      } else if (p.date <= fc.forecastEnd) {
        const totalSpan = daysBetween(filterDate, fc.forecastEnd);
        const elapsed = daysBetween(filterDate, p.date);
        const startV = fc.ev * 100;
        const t = totalSpan > 0 ? elapsed / totalSpan : 1;
        forecast = startV + (100 - startV) * t;
      } else {
        forecast = 100;
      }
    }
    return {
      date: p.date,
      pv: p.planPct,
      ev,
      forecast,
    };
  });

  return { points, forecastEnd: fc.forecastEnd };
}
