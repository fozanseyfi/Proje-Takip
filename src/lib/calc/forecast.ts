/**
 * EVM (Earned Value Management) — schedule-bazlı performans + tahmin.
 *
 * Schedule-EVM kullanır (cost-bazlı CPI/AC/EAC$ yok — actual cost tutarlı izlenmiyor).
 *
 * Geleneksel metrikler (computeForecast):
 *   PV (Planned Value)        — bu tarihe kadar PLANLA göre yapılması gereken % (0..1)
 *   EV (Earned Value)         — bu tarihe kadar gerçekten kazanılan % (0..1)
 *   SV (Schedule Variance)    — EV − PV (negatif = gerideyiz)
 *   SPI (Schedule Perf. Idx.) — EV / PV (1 = zamanında, <1 = geride, >1 = önde)
 *   Tahmini Bitiş             — startDate + originalDuration / SPI
 *   Sapma (gün)               — tahmini bitiş − planlanan bitiş
 *
 * Earned Schedule (Lipke, 2003) — modern PMP standardı (computeEarnedSchedule):
 *   AT (Actual Time)          — startDate'ten filterDate'e kadar geçen gün
 *   ES (Earned Schedule)      — EV'ye PV eğrisinde ulaşılması gereken zaman (gün)
 *                              PV eğrisinde EV'yi geçen ilk noktanın lineer
 *                              interpolasyonu ile bulunur
 *   SV(t)                     — ES − AT (gün) · negatif = gerideyiz
 *   SPI(t)                    — ES / AT (zamana göre normalize) · klasik SPI'nin
 *                              %85+ patolojisini düzeltir (proje sona yaklaşırken
 *                              klasik SPI hep 1'e gider, SPI(t) ise sapmayı korur)
 *   IEAC(t)                   — Independent Estimate at Completion (time)
 *                              = PD / SPI(t)
 *   Tahmini Bitiş (ES)        — startDate + IEAC(t)
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

// ────────────────────────────────────────────────────────────────────
// Earned Schedule (Lipke 2003) — modern PMP zaman-bazlı SPI
// ────────────────────────────────────────────────────────────────────

export interface EarnedScheduleResult {
  /** Geçen süre (gün) — startDate'ten filterDate'e */
  at: number;
  /** Earned Schedule (gün) — EV'ye PV eğrisinde ulaşılması gereken zaman */
  es: number;
  /** SV(t) = ES − AT (gün). Negatif = gerideyiz. */
  svt: number;
  /** SPI(t) = ES / AT. null = AT sıfır. Klasik SPI'nin %85+ patolojisini düzeltir. */
  spit: number | null;
  /** Independent Estimate at Completion (time) = PD / SPI(t). null = SPI(t) yoksa. */
  ieact: number | null;
  /** Tahmini bitiş tarihi (ES'e dayalı). */
  forecastEndES: string | null;
  /** Tahmini bitiş − planlanan bitiş (gün) */
  deltaDaysES: number;
  /** Planlanan süre */
  plannedDurationDays: number;
}

/**
 * PV S-curve'de hedef değere (EV) lineer interpolasyonla ulaşılan zamanı (gün) döner.
 * Curve'ün sondaki PV genellikle 100 — EV ≥ son PV ise projectDuration döner (önde).
 *
 * Curve formatı: [{ date, planPct (0..100) }, ...] sıralı.
 */
function interpolatePvTime(
  curve: SCurvePoint[],
  evPct: number, // 0..100
  projectStart: string
): number {
  if (curve.length === 0 || evPct <= 0) return 0;
  // İlk geçen noktayı bul
  for (let i = 1; i < curve.length; i++) {
    const prev = curve[i - 1];
    const cur = curve[i];
    if (cur.planPct >= evPct) {
      // prev.planPct < evPct ≤ cur.planPct — lineer interpolasyon
      const dPv = cur.planPct - prev.planPct;
      const tPrev = daysBetween(projectStart, prev.date) + 1;
      const tCur = daysBetween(projectStart, cur.date) + 1;
      const dT = tCur - tPrev;
      if (dPv <= 0) return tCur; // PV değişmemiş (flat) — son noktayı dön
      const ratio = (evPct - prev.planPct) / dPv;
      return tPrev + ratio * dT;
    }
  }
  // Hiç geçmedi → EV planlanan max'tan büyük (önde) → curve sonundaki AT döner
  const last = curve[curve.length - 1];
  return daysBetween(projectStart, last.date) + 1;
}

export function computeEarnedSchedule(
  items: WbsItemForCalc[],
  planned: DateQuantityMap,
  realized: DateQuantityMap,
  filterDate: string,
  projectStart: string,
  plannedEnd: string
): EarnedScheduleResult {
  const { realPct: ev } = computeProgress(items, planned, realized, filterDate);
  const at = Math.max(0, daysBetween(projectStart, filterDate) + 1);
  const plannedDurationDays = Math.max(1, daysBetween(projectStart, plannedEnd) + 1);

  // PV curve'ünü ELDE EDERKEN filterDate sonrasını da dahil et — EV önde olabilir,
  // ES'i projeden büyük gösterebiliriz.
  const curve = buildSCurve(items, planned, realized);
  // curve.planPct zaten 0..100 cinsinden

  const evPct = ev * 100;
  const es = interpolatePvTime(curve, evPct, projectStart);
  const svt = es - at;
  const spit = at > 0 ? es / at : null;

  let ieact: number | null = null;
  let forecastEndES: string | null = null;
  let deltaDaysES = 0;
  if (spit && spit > 0) {
    ieact = plannedDurationDays / spit;
    const fe = addDays(new Date(projectStart), Math.round(ieact) - 1);
    forecastEndES = toISODate(fe);
    deltaDaysES = daysBetween(plannedEnd, forecastEndES);
  }

  return {
    at,
    es,
    svt,
    spit,
    ieact,
    forecastEndES,
    deltaDaysES,
    plannedDurationDays,
  };
}

// ────────────────────────────────────────────────────────────────────

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
