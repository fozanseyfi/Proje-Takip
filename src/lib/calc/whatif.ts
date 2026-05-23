/**
 * What-If Senaryoları — hipotetik durumların proje takvimine etkisini hesaplar.
 *
 * KRİTİK: Canlı veriyi DEĞİŞTİRMEZ. Tüm hesaplar `planned` ve `wbs` kopyaları
 * üzerinde yapılır. Sonuç bir `ScenarioResult` döner.
 *
 * Desteklenen senaryolar:
 * - "activity-delay"     → X aktivitesi N gün gecikirse
 * - "project-shift"      → Tüm proje başlangıcı N gün kayarsa
 * - "crash"              → Hedef bitiş tarihi için kritik aktiviteleri kısalt
 * - "holiday"            → Belirli tarih aralığı kapalı (tüm aktiviteleri etkiler)
 * - "resource-absence"   → Belirli aktiviteler N gün geciktir (kaynak tabanlı)
 * - "predecessor-change" → A→B linkinin tipi/lag'i değişirse
 * - "quantity-change"    → X aktivitesinin miktarı %N değişirse (süre lineer)
 * - "weather-risk"       → Bir ay aralığında haftada N gün kayıp
 */

import { addDays, toISODate } from "@/lib/utils";
import type { WbsItem, DateQuantityMap, PredecessorType } from "@/lib/store/types";
import {
  computeEarliestStarts,
  computeCriticalPath,
  getEffectiveRange,
} from "./predecessors";

export type ScenarioType =
  | "activity-delay"
  | "project-shift"
  | "crash"
  | "holiday"
  | "resource-absence"
  | "predecessor-change"
  | "quantity-change"
  | "weather-risk";

export type ScenarioParams =
  | { type: "activity-delay"; code: string; days: number }
  | { type: "project-shift"; days: number }
  | { type: "crash"; targetEndDate: string }
  | { type: "holiday"; from: string; to: string }
  | { type: "resource-absence"; codes: string[]; days: number }
  | {
      type: "predecessor-change";
      targetCode: string;
      predCode: string;
      newType: PredecessorType;
      newLagDays: number;
    }
  | { type: "quantity-change"; code: string; percent: number }
  | { type: "weather-risk"; fromMonth: number; toMonth: number; daysPerWeek: number };

export interface ScenarioResult {
  /** Eski proje bitişi (mevcut planlamadaki en geç tarih). */
  currentEnd: string;
  /** Senaryo sonrası proje bitişi. */
  scenarioEnd: string;
  /** Δ gün (pozitif = gecikme, negatif = erkene). */
  deltaDays: number;
  /** Etkilenen aktiviteler — kod, eski, yeni tarihler. */
  affected: Array<{
    code: string;
    name: string;
    oldStart?: string;
    oldEnd?: string;
    newStart?: string;
    newEnd?: string;
    shiftDays: number;
  }>;
  /** Eski kritik yol kod seti. */
  currentCritical: Set<string>;
  /** Yeni kritik yol kod seti. */
  scenarioCritical: Set<string>;
  /** Crash senaryoları için: hangi aktiviteler kaç gün kısaltıldı. */
  crashSuggestions?: Array<{ code: string; name: string; daysReduced: number }>;
  /** Genel kullanıcıya gösterilecek özet mesaj. */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────
// Yardımcılar
// ─────────────────────────────────────────────────────────────────

function shiftDateMap(map: Record<string, number>, deltaDays: number): Record<string, number> {
  if (!map || deltaDays === 0) return { ...map };
  const out: Record<string, number> = {};
  for (const [d, v] of Object.entries(map)) {
    const newDate = toISODate(addDays(new Date(d), deltaDays));
    out[newDate] = v;
  }
  return out;
}

function shiftPlannedAll(planned: DateQuantityMap, deltaDays: number): DateQuantityMap {
  const out: DateQuantityMap = {};
  for (const [code, map] of Object.entries(planned)) {
    out[code] = shiftDateMap(map, deltaDays);
  }
  return out;
}

function clonePlanned(planned: DateQuantityMap): DateQuantityMap {
  const out: DateQuantityMap = {};
  for (const [code, map] of Object.entries(planned)) {
    out[code] = { ...map };
  }
  return out;
}

function projectMaxEnd(wbs: WbsItem[], planned: DateQuantityMap, projectStart: string): string {
  const leaves = wbs.filter((w) => !w.deletedAt && w.isLeaf);
  let max = projectStart;
  for (const w of leaves) {
    const r = getEffectiveRange(w, planned[w.code]);
    if (r.end && r.end > max) max = r.end;
  }
  return max;
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 86400000);
}

function buildAffected(
  leaves: WbsItem[],
  currentPlanned: DateQuantityMap,
  scenarioPlanned: DateQuantityMap
): ScenarioResult["affected"] {
  const out: ScenarioResult["affected"] = [];
  for (const w of leaves) {
    const oldR = getEffectiveRange(w, currentPlanned[w.code]);
    const newR = getEffectiveRange(w, scenarioPlanned[w.code]);
    const shiftDays =
      oldR.start && newR.start ? daysBetween(oldR.start, newR.start) : 0;
    const endShift =
      oldR.end && newR.end ? daysBetween(oldR.end, newR.end) : 0;
    if (shiftDays !== 0 || endShift !== 0) {
      out.push({
        code: w.code,
        name: w.name,
        oldStart: oldR.start,
        oldEnd: oldR.end,
        newStart: newR.start,
        newEnd: newR.end,
        shiftDays: Math.max(Math.abs(shiftDays), Math.abs(endShift)) * (shiftDays >= 0 ? 1 : -1),
      });
    }
  }
  // En çok kayan en üstte
  return out.sort((a, b) => Math.abs(b.shiftDays) - Math.abs(a.shiftDays));
}

// ─────────────────────────────────────────────────────────────────
// Senaryo simülasyonu
// ─────────────────────────────────────────────────────────────────

export function simulateScenario(
  params: ScenarioParams,
  wbs: WbsItem[],
  planned: DateQuantityMap,
  projectStart: string
): ScenarioResult {
  const currentEnd = projectMaxEnd(wbs, planned, projectStart);
  const currentCritical = computeCriticalPath(wbs, planned, projectStart);
  const leaves = wbs.filter((w) => !w.deletedAt && w.isLeaf);

  let scenarioPlanned: DateQuantityMap = clonePlanned(planned);
  let scenarioWbs: WbsItem[] = wbs;
  let crashSuggestions: ScenarioResult["crashSuggestions"];
  let summary = "";

  switch (params.type) {
    case "activity-delay": {
      // Bir aktivitenin günlük planını N gün öteler. Sonra forward-pass öncüller
      // üzerinden bağımlıları zincirleme öteler.
      const map = scenarioPlanned[params.code];
      if (map) scenarioPlanned[params.code] = shiftDateMap(map, params.days);
      const target = wbs.find((w) => w.code === params.code);
      if (target?.activityType === "milestone" && target.milestoneDate) {
        scenarioWbs = wbs.map((w) =>
          w.code === params.code
            ? { ...w, milestoneDate: toISODate(addDays(new Date(w.milestoneDate!), params.days)) }
            : w
        );
      }
      // Zincir ötelemesi
      scenarioPlanned = cascadeShifts(scenarioWbs, scenarioPlanned, projectStart);
      summary = `${params.code} aktivitesi ${params.days > 0 ? "+" : ""}${params.days} gün ötelendi · bağımlılar otomatik kaydırıldı.`;
      break;
    }

    case "project-shift": {
      scenarioPlanned = shiftPlannedAll(scenarioPlanned, params.days);
      // Milestone'lar da kayar
      scenarioWbs = wbs.map((w) =>
        w.activityType === "milestone" && w.milestoneDate
          ? { ...w, milestoneDate: toISODate(addDays(new Date(w.milestoneDate), params.days)) }
          : w
      );
      summary = `Tüm proje ${params.days > 0 ? "+" : ""}${params.days} gün kaydırıldı.`;
      break;
    }

    case "holiday": {
      // From..to arası kapalı → bu aralıkla çakışan/sonraki aktiviteler N gün gecikir
      const holidayDays = daysBetween(params.from, params.to) + 1;
      for (const w of leaves) {
        const r = getEffectiveRange(w, scenarioPlanned[w.code]);
        if (!r.start) continue;
        // Aktivite tatil aralığından SONRA ise → tamamen tatil günleri kadar ötele
        if (r.start > params.to) {
          const map = scenarioPlanned[w.code];
          if (map) scenarioPlanned[w.code] = shiftDateMap(map, holidayDays);
          if (w.activityType === "milestone" && w.milestoneDate && w.milestoneDate > params.to) {
            scenarioWbs = scenarioWbs.map((x) =>
              x.code === w.code
                ? { ...x, milestoneDate: toISODate(addDays(new Date(w.milestoneDate!), holidayDays)) }
                : x
            );
          }
        } else if (r.start <= params.to && r.end! >= params.from) {
          // Aktivite tatil aralığıyla çakışıyor → çakışma kısmı kadar bitişi öteler
          const overlap =
            Math.min(new Date(r.end!).getTime(), new Date(params.to).getTime()) -
            Math.max(new Date(r.start).getTime(), new Date(params.from).getTime());
          const overlapDays = Math.round(overlap / 86400000) + 1;
          if (overlapDays > 0) {
            // Tatil günlerinden sonraki tarihlerini ötele
            const map = scenarioPlanned[w.code] || {};
            const next: Record<string, number> = {};
            for (const [d, v] of Object.entries(map)) {
              if (d >= params.from && d <= params.to) {
                // bu gün tatil — sona at
                const shifted = toISODate(addDays(new Date(d), holidayDays));
                next[shifted] = (next[shifted] || 0) + v;
              } else if (d > params.to) {
                // sonraki günler de kayar
                const shifted = toISODate(addDays(new Date(d), holidayDays));
                next[shifted] = v;
              } else {
                next[d] = v;
              }
            }
            scenarioPlanned[w.code] = next;
          }
        }
      }
      scenarioPlanned = cascadeShifts(scenarioWbs, scenarioPlanned, projectStart);
      summary = `${params.from} – ${params.to} (${holidayDays} gün) tatil olarak işaretlendi · etkilenen aktiviteler ötelendi.`;
      break;
    }

    case "resource-absence": {
      // Seçili aktiviteler N gün gecikir
      const codeSet = new Set(params.codes);
      for (const code of codeSet) {
        const map = scenarioPlanned[code];
        if (map) scenarioPlanned[code] = shiftDateMap(map, params.days);
      }
      scenarioWbs = wbs.map((w) =>
        codeSet.has(w.code) && w.activityType === "milestone" && w.milestoneDate
          ? { ...w, milestoneDate: toISODate(addDays(new Date(w.milestoneDate), params.days)) }
          : w
      );
      scenarioPlanned = cascadeShifts(scenarioWbs, scenarioPlanned, projectStart);
      summary = `${params.codes.length} aktivite ${params.days} gün kaynak yokluğundan gecikti · bağımlılar otomatik kaydırıldı.`;
      break;
    }

    case "predecessor-change": {
      scenarioWbs = wbs.map((w) => {
        if (w.code !== params.targetCode) return w;
        const newPreds = (w.predecessors ?? []).map((p) =>
          p.wbsCode === params.predCode
            ? { ...p, type: params.newType, lagDays: params.newLagDays }
            : p
        );
        return { ...w, predecessors: newPreds };
      });
      scenarioPlanned = cascadeShifts(scenarioWbs, scenarioPlanned, projectStart);
      summary = `${params.predCode} → ${params.targetCode} bağlantısı ${params.newType}${
        params.newLagDays !== 0 ? ` ${params.newLagDays > 0 ? "+" : ""}${params.newLagDays}g` : ""
      } olarak değişti.`;
      break;
    }

    case "quantity-change": {
      // Miktar %N artarsa, süre LINEAR aynı oranda uzar varsayımı (yumuşak)
      const factor = 1 + params.percent / 100;
      const map = scenarioPlanned[params.code];
      if (map) {
        const dates = Object.keys(map).sort();
        if (dates.length > 0) {
          const oldDuration = dates.length;
          const newDuration = Math.max(1, Math.round(oldDuration * factor));
          const startD = new Date(dates[0]);
          const totalQty = Object.values(map).reduce((a, b) => a + b, 0) * factor;
          const perDay = totalQty / newDuration;
          const next: Record<string, number> = {};
          for (let i = 0; i < newDuration; i++) {
            const d = toISODate(addDays(startD, i));
            next[d] = perDay;
          }
          scenarioPlanned[params.code] = next;
        }
      }
      scenarioPlanned = cascadeShifts(scenarioWbs, scenarioPlanned, projectStart);
      summary = `${params.code} miktarı %${params.percent > 0 ? "+" : ""}${params.percent} değişti · süre orantılı uzadı.`;
      break;
    }

    case "weather-risk": {
      // Belirli aylar arasında haftada N gün kayıp → toplam kayıp günü hesapla,
      // o aylardaki aktiviteleri kayıp gün kadar geciktir
      let lostDays = 0;
      const start = new Date(projectStart);
      const end = new Date(currentEnd);
      const cur = new Date(start);
      // Ay aralığı kapsayıcı (fromMonth, toMonth 1-12)
      while (cur <= end) {
        const m = cur.getMonth() + 1;
        const inRange =
          params.fromMonth <= params.toMonth
            ? m >= params.fromMonth && m <= params.toMonth
            : m >= params.fromMonth || m <= params.toMonth;
        if (inRange) {
          // Haftada N gün → 7 günde N gün kayıp → ay başına ~30 * N / 7 gün
          lostDays += params.daysPerWeek / 7;
        }
        cur.setDate(cur.getDate() + 1);
      }
      lostDays = Math.round(lostDays);
      // Tüm aktiviteleri lostDays kadar şişir (sondan)
      scenarioPlanned = shiftPlannedAll(scenarioPlanned, lostDays);
      scenarioWbs = wbs.map((w) =>
        w.activityType === "milestone" && w.milestoneDate
          ? { ...w, milestoneDate: toISODate(addDays(new Date(w.milestoneDate), lostDays)) }
          : w
      );
      summary = `Hava riski: ${params.fromMonth}.→${params.toMonth}. aylar arası haftada ${params.daysPerWeek} gün kayıp → toplam ~${lostDays} gün gecikme.`;
      break;
    }

    case "crash": {
      // Hedef bitiş tarihine ulaşmak için kritik yoldaki aktiviteleri kısalt
      const targetEnd = params.targetEndDate;
      const targetDays = daysBetween(currentEnd, targetEnd); // negatif olmalı
      if (targetDays >= 0) {
        summary = "Hedef bitiş tarihi mevcut planın gerisinde — crash gerekmez.";
        break;
      }
      const reductionNeeded = -targetDays; // pozitif gün
      // Kritik aktiviteleri en uzun süreliden başlayarak kısaltma adayı yap
      const candidates: Array<{ code: string; name: string; duration: number }> = [];
      for (const code of currentCritical) {
        const w = wbs.find((x) => x.code === code);
        if (!w || w.activityType === "milestone") continue;
        const r = getEffectiveRange(w, planned[code]);
        if (!r.start || !r.end) continue;
        const dur = daysBetween(r.start, r.end) + 1;
        if (dur > 1) candidates.push({ code, name: w.name, duration: dur });
      }
      candidates.sort((a, b) => b.duration - a.duration);
      // Greedy: %20 daralt her aday (max %50)
      crashSuggestions = [];
      let achieved = 0;
      for (const cand of candidates) {
        if (achieved >= reductionNeeded) break;
        const maxReduce = Math.floor(cand.duration * 0.5);
        const target = Math.min(maxReduce, reductionNeeded - achieved);
        if (target <= 0) continue;
        // Aktivitenin süresini kısalt: son N günü çıkar, miktarları kalan günlere yedir
        const map = scenarioPlanned[cand.code];
        if (map) {
          const dates = Object.keys(map).sort();
          const newDuration = Math.max(1, cand.duration - target);
          const totalQty = Object.values(map).reduce((a, b) => a + b, 0);
          const startD = new Date(dates[0]);
          const next: Record<string, number> = {};
          const perDay = totalQty / newDuration;
          for (let i = 0; i < newDuration; i++) {
            next[toISODate(addDays(startD, i))] = perDay;
          }
          scenarioPlanned[cand.code] = next;
          crashSuggestions.push({ code: cand.code, name: cand.name, daysReduced: target });
          achieved += target;
        }
      }
      scenarioPlanned = cascadeShifts(scenarioWbs, scenarioPlanned, projectStart);
      summary =
        achieved >= reductionNeeded
          ? `Hedef ulaşılabilir: ${crashSuggestions.length} kritik aktivite kısaltılarak ${achieved} gün kazanıldı.`
          : `Hedef tam ulaşılamadı: en fazla ${achieved} gün kazanılabilir (${reductionNeeded} gün gerekiyordu).`;
      break;
    }
  }

  const scenarioEnd = projectMaxEnd(scenarioWbs, scenarioPlanned, projectStart);
  const deltaDays = daysBetween(currentEnd, scenarioEnd);
  const scenarioCritical = computeCriticalPath(scenarioWbs, scenarioPlanned, projectStart);
  const affected = buildAffected(leaves, planned, scenarioPlanned);

  return {
    currentEnd,
    scenarioEnd,
    deltaDays,
    affected,
    currentCritical,
    scenarioCritical,
    crashSuggestions,
    summary: summary || `Senaryo uygulandı: ${deltaDays > 0 ? "+" : ""}${deltaDays} gün etki.`,
  };
}

/**
 * Öncül zincirini takip edip ihlal eden aktiviteleri öteler.
 * computeEarliestStarts üzerinden iteratif şekilde çalışır.
 */
function cascadeShifts(
  wbs: WbsItem[],
  planned: DateQuantityMap,
  projectStart: string
): DateQuantityMap {
  const out: DateQuantityMap = clonePlanned(planned);
  const maxIter = 50;
  for (let iter = 0; iter < maxIter; iter++) {
    const { schedules } = computeEarliestStarts(wbs, out, projectStart);
    let didShift = false;
    for (const w of wbs) {
      if (w.deletedAt || !w.isLeaf) continue;
      if (w.activityType === "milestone") continue;
      const sch = schedules.get(w.code);
      const r = getEffectiveRange(w, out[w.code]);
      if (!sch || !r.start) continue;
      if (r.start < sch.earliestStart) {
        // Aktivite öncül kısıtının gerisinde — kaydır
        const delta = daysBetween(r.start, sch.earliestStart);
        if (delta > 0) {
          out[w.code] = shiftDateMap(out[w.code], delta);
          didShift = true;
        }
      }
    }
    if (!didShift) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// UI metadatası — senaryo türü bilgisi (label, açıklama, ikon)
// ─────────────────────────────────────────────────────────────────

export interface ScenarioTypeMeta {
  type: ScenarioType;
  label: string;
  icon: string;
  description: string;
  example: string;
}

export const SCENARIO_PRESETS: ScenarioTypeMeta[] = [
  {
    type: "activity-delay",
    label: "Aktivite Gecikme",
    icon: "⏱",
    description: "Bir aktivite N gün gecikirse zincir nasıl etkilenir?",
    example: 'Örn. "Trafo montajı 5 gün gecikirse?"',
  },
  {
    type: "crash",
    label: "Hızlandırma (Crash)",
    icon: "↓",
    description: "Hedef bitiş tarihine ulaşmak için kritik aktiviteleri kısalt.",
    example: 'Örn. "Projeyi 15 Aralık\'a yetiştirmem lazım — neyi kısaltayım?"',
  },
  {
    type: "holiday",
    label: "Tatil / Bayram",
    icon: "🌴",
    description: "Bir tarih aralığı kapalı olursa proje ne kadar uzar?",
    example: 'Örn. "Ramazan Bayramı 3 gün kapalı."',
  },
  {
    type: "resource-absence",
    label: "Kaynak Yokluğu",
    icon: "👤",
    description: "Belirli aktiviteler N gün yapılamazsa (personel/makine yok)?",
    example: 'Örn. "Vinç 1 hafta arızalı — vinç kullanan aktiviteler gecikir."',
  },
  {
    type: "predecessor-change",
    label: "Öncül Değişikliği",
    icon: "🔗",
    description: "Bir öncül linkinin tipini/lag'ini değiştir, etki gör.",
    example: 'Örn. "A→B bağlantısını FS yerine SS yapsak hızlanır mı?"',
  },
  {
    type: "quantity-change",
    label: "Miktar Değişikliği",
    icon: "📦",
    description: "Bir aktivitenin miktarı %N değişirse (süre orantılı uzar)?",
    example: 'Örn. "Beton miktarı %20 artarsa?"',
  },
  {
    type: "project-shift",
    label: "Toplu Öteleme",
    icon: "➡",
    description: "Tüm proje N gün ileri/geri kaydırılırsa?",
    example: 'Örn. "Proje 10 gün geç başlarsa?"',
  },
  {
    type: "weather-risk",
    label: "Hava Riski",
    icon: "⛈",
    description: "Belirli aylarda haftada N gün hava kaybı varsayalım.",
    example: 'Örn. "Şubatta haftada 2 gün hava kaybı."',
  },
];
