/**
 * Öncül (predecessor) ilişkilerinden earliestStart hesabı.
 *
 * Forward-pass:
 * - Her leaf için, planlama verilerinden A.start ve A.end türetilir.
 * - Predecessor linklerine göre B.earliestStart hesaplanır.
 * - Cycle detection: A→B→A varsa link reddedilir.
 */

import type { WbsItem, DateQuantityMap, PredecessorType } from "@/lib/store/types";
import { toISODate, addDays } from "@/lib/utils";
import { endDateFromDuration, startDateFromDuration, workingDates } from "./distribution";

export interface LeafSchedule {
  /** Planlamada en erken dolu gün — yoksa undefined */
  plannedStart?: string;
  /** Planlamada en geç dolu gün — yoksa undefined */
  plannedEnd?: string;
  /** Öncüller dikkate alındığında en erken başlayabileceği gün (FS/SS) */
  earliestStart: string;
  /** Öncüller dikkate alındığında en erken bitebileceği gün (FF) — yoksa undefined */
  earliestEnd?: string;
  /** Backward pass — projeyi geciktirmeden en geç başlayabileceği gün */
  latestStart?: string;
  /** Backward pass — projeyi geciktirmeden en geç bitebileceği gün */
  latestEnd?: string;
  /** Total Float (gün) = latestStart − earliestStart. 0 ise kritik. */
  totalFloat?: number;
  /**
   * Free Float (gün) = hiçbir successor'ı geciktirmeden kayabileceği gün.
   * ALAP yerleşimi için kullanılır — Total Float'a göre cascade yapmaz.
   * Terminal kalemler için Free Float = Total Float (proje sonuna kadar).
   */
  freeFloat?: number;
  /** scheduleType'a göre etkili başlangıç: ALAP → earliestStart + freeFloat, ASAP → earliestStart */
  effectiveStart?: string;
  /** scheduleType'a göre etkili bitiş: ALAP → earliestEnd + freeFloat, ASAP → earliestEnd */
  effectiveEnd?: string;
  /** Kritik yolda mı (totalFloat === 0) */
  isCritical?: boolean;
  /** Açıklama (UI tooltip için) */
  reason?: string;
}

/**
 * Bir kalemin planlamasından (date→qty map) start ve end tarihlerini türet.
 */
export function getPlanRange(byDate: Record<string, number> | undefined): {
  start?: string;
  end?: string;
} {
  if (!byDate) return {};
  const dates = Object.entries(byDate)
    .filter(([, q]) => q > 0)
    .map(([d]) => d)
    .sort();
  if (dates.length === 0) return {};
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * Bir kalemin etkili tarih aralığı — milestone ise milestoneDate, work ise planned'tan.
 * Milestone'un miktarı YOK; sadece tek tarihte gerçekleşir, start = end = milestoneDate.
 */
export function getEffectiveRange(
  item: WbsItem | undefined,
  byDate: Record<string, number> | undefined
): { start?: string; end?: string } {
  if (!item) return getPlanRange(byDate);
  if (item.activityType === "milestone") {
    const d = item.milestoneDate;
    return d ? { start: d, end: d } : {};
  }
  return getPlanRange(byDate);
}

/**
 * Bir Date objesini YYYY-MM-DD string'e yerel saat dilimiyle çevirir.
 *
 * NEDEN: Standart `toISODate()` yardımcısı `toISOString().split("T")[0]` ile UTC
 * çıkışı üretir. `new Date("2026-05-15T00:00:00")` yerel midnight olarak parse
 * edilir; Türkiye'de bu UTC önceki gün 21:00'a denk geldiğinden `toISOString()`
 * **bir gün geri** kayar. Bu fonksiyon getFullYear/Month/Date kullanarak yerel
 * tarihi koruduğu için TR (ve diğer pozitif offset bölgelerde) doğru sonuç verir.
 */
function fmtLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Bir tarihe N gün ekler — hafta sonu kuralı `skipDow` ile verilir.
 * `skipDow` true dönerse o gün atlanır (sayılmaz).
 *
 * NOT: Çıkış için fmtLocalISO kullanılır; toISODate Türkiye saat diliminde
 * 1 gün geriye kayar (UTC dönüşümü), o yüzden bu yardımcıda kullanılmaz.
 */
function addDaysSkipping(
  fromISO: string,
  days: number,
  skipDow: (dow: number) => boolean
): string {
  if (days === 0) return fromISO;
  const cur = new Date(fromISO + "T00:00:00");
  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    cur.setDate(cur.getDate() + step);
    if (!skipDow(cur.getDay())) remaining--;
  }
  return fmtLocalISO(cur);
}

/** Lag uygula — birime göre. */
function addLag(
  fromISO: string,
  lagDays: number,
  unit: "calendar" | "work" | "no-sunday" | undefined
): string {
  if (unit === "work") {
    // Cumartesi (6) + Pazar (0) atla
    return addDaysSkipping(fromISO, lagDays, (dow) => dow === 0 || dow === 6);
  }
  if (unit === "no-sunday") {
    // Sadece Pazar (0) atla
    return addDaysSkipping(fromISO, lagDays, (dow) => dow === 0);
  }
  return toISODate(addDays(new Date(fromISO), lagDays));
}

/**
 * Bir linke göre B'nin kısıtlarını hesapla.
 * - FS / SS → startConstraint (B en erken bu tarihte başlayabilir)
 * - FF       → endConstraint   (B en erken bu tarihte bitebilir)
 */
function applyLink(
  type: PredecessorType,
  lagDays: number,
  lagUnit: "calendar" | "work" | "no-sunday" | undefined,
  aStart: string | undefined,
  aEnd: string | undefined,
  projectStart: string
): { startConstraint?: string; endConstraint?: string } {
  switch (type) {
    case "FS":
      // FS: A bittikten lag gün sonra başla → A.end + lag + 1
      if (!aEnd) return { startConstraint: projectStart };
      return { startConstraint: addLag(aEnd, lagDays + 1, lagUnit) };
    case "SS":
      // SS: A başladıktan lag gün sonra başla
      if (!aStart) return { startConstraint: projectStart };
      return { startConstraint: addLag(aStart, lagDays, lagUnit) };
    case "FF":
      // FF: A bittikten lag gün sonra biter → B.end ≥ A.end + lag
      if (!aEnd) return {};
      return { endConstraint: addLag(aEnd, lagDays, lagUnit) };
  }
}

/**
 * Tüm leaf'ler için earliestStart hesabı.
 * Topolojik sıralama ile yapılır; cycle varsa o link es geçilir + uyarı.
 *
 * `cycleNodes` — döngüye dahil olan kalemlerin code Set'i. Backward pass bu
 * node'lar için latestEnd hesaplayamaz (Kahn unreachable), bu yüzden UI'da
 * "döngü" badge'i ile ayrılır; kritik yol kararı verilemez.
 */
export function computeEarliestStarts(
  wbs: WbsItem[],
  planned: DateQuantityMap,
  projectStart: string
): {
  schedules: Map<string, LeafSchedule>;
  cycles: string[]; // cycle kodu (örn. "1.2 → 1.3 → 1.2")
  cycleNodes: Set<string>;
} {
  const leaves = wbs.filter((w) => !w.deletedAt && w.isLeaf);
  const byCode = new Map(leaves.map((w) => [w.code, w]));
  const schedules = new Map<string, LeafSchedule>();
  const cycles: string[] = [];
  const cycleNodes = new Set<string>();

  // İlk geçiş: her leaf için planlanan start/end türet (milestone: milestoneDate)
  for (const w of leaves) {
    const range = getEffectiveRange(w, planned[w.code]);
    schedules.set(w.code, {
      plannedStart: range.start,
      plannedEnd: range.end,
      earliestStart: projectStart,
    });
  }

  // Topolojik sıralama (Kahn) — predecessors kullanılmadan basit DFS visit
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(code: string, stack: string[]): void {
    if (visited.has(code)) return;
    if (visiting.has(code)) {
      cycles.push([...stack, code].join(" → "));
      // Stack'te `code` ile kapanan tüm node'lar cycle'a dahil — ayrı set
      const startIdx = stack.indexOf(code);
      if (startIdx >= 0) {
        for (let i = startIdx; i < stack.length; i++) {
          cycleNodes.add(stack[i]);
        }
      }
      cycleNodes.add(code);
      return;
    }
    const item = byCode.get(code);
    if (!item) return;
    visiting.add(code);

    const preds = item.predecessors ?? [];
    let maxStart = projectStart;
    let maxEnd: string | undefined;
    let reason: string | undefined;

    for (const link of preds) {
      // Predecessor'ı önce ziyaret et
      visit(link.wbsCode, [...stack, code]);

      const aSched = schedules.get(link.wbsCode);
      // A'nın efektif bitişi: planned varsa onu, yoksa earliestEnd, son çare earliestStart
      const aEffStart = aSched?.plannedStart ?? aSched?.earliestStart;
      const aEffEnd = aSched?.plannedEnd ?? aSched?.earliestEnd ?? aSched?.earliestStart;
      const c = applyLink(link.type, link.lagDays, link.lagUnit, aEffStart, aEffEnd, projectStart);
      const a = byCode.get(link.wbsCode);
      const unitSuffix =
        link.lagUnit === "work" ? "ig" : link.lagUnit === "no-sunday" ? "g6" : "g";
      const lagPart = link.lagDays === 0
        ? ""
        : ` ${link.lagDays > 0 ? "+" : ""}${link.lagDays}${unitSuffix}`;
      if (c.startConstraint && c.startConstraint > maxStart) {
        maxStart = c.startConstraint;
        reason = `Öncül: ${a?.code ?? link.wbsCode} (${link.type}${lagPart})`;
      }
      if (c.endConstraint && (!maxEnd || c.endConstraint > maxEnd)) {
        maxEnd = c.endConstraint;
        if (!reason) {
          reason = `Öncül: ${a?.code ?? link.wbsCode} (${link.type}${lagPart})`;
        }
      }
    }

    // Hedef kalemin iş haftasına snap'le: FS/SS kısıtı non-work day'e denk gelirse
    // ileriye (bir sonraki çalışma günü), FF kısıtı geri (bir önceki çalışma günü) kaydır.
    // Böylece "Cumartesi biten kaleme FS" → Pzt başlama (mon-fri/mon-sat) otomatik olur.
    {
      const ww = item.workweek;
      const workSat = ww === "mon-fri" ? false : true;
      const workSun = ww === "mon-sun" ? true : false;
      const isOff = (dow: number) =>
        (dow === 0 && !workSun) || (dow === 6 && !workSat);
      const fmt = (dt: Date) =>
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      if (maxStart > projectStart) {
        const cur = new Date(maxStart + "T00:00:00");
        let guard = 0;
        while (isOff(cur.getDay()) && guard++ < 7) {
          cur.setDate(cur.getDate() + 1);
        }
        maxStart = fmt(cur);
      }
      if (maxEnd) {
        const cur = new Date(maxEnd + "T00:00:00");
        let guard = 0;
        while (isOff(cur.getDay()) && guard++ < 7) {
          cur.setDate(cur.getDate() - 1);
        }
        maxEnd = fmt(cur);
      }
    }

    const existing = schedules.get(code);
    // Plan yok ama estimatedDurationDays + workweek varsa, earliestStart/End'i türet:
    //  - FF kısıtı varsa: end = maxEnd, start = end − süre (geri sayım).
    //    Böylece bar süre kadar geriden başlar, kısıtın bitişine kadar gider.
    //  - FF yok: doğal end = start + süre. Successor'lar için earliestEnd lazım.
    // Plan varsa derivedStart=maxStart (FS/SS), derivedEnd=maxEnd (FF) — plan zaten
    // shiftByPredecessorsFresh ile ileriye kaydırılır.
    let derivedStart = maxStart;
    let derivedEnd = maxEnd;
    const isDurationOnlyWork =
      item.activityType !== "milestone" &&
      !existing?.plannedStart &&
      !existing?.plannedEnd &&
      !!item.estimatedDurationDays &&
      item.estimatedDurationDays > 0;
    if (isDurationOnlyWork) {
      const ww = item.workweek;
      const workSat = ww === "mon-fri" ? false : true;
      const workSun = ww === "mon-sun" ? true : false;
      const naturalEnd = endDateFromDuration(
        derivedStart,
        item.estimatedDurationDays!,
        workSat,
        workSun
      );
      if (maxEnd && naturalEnd < maxEnd) {
        // FF link var ve doğal bitiş kısıttan önce → başlangıcı ileri kaydır,
        // bitiş kısıta uysun, süre korunur.
        derivedEnd = maxEnd;
        derivedStart = startDateFromDuration(
          maxEnd,
          item.estimatedDurationDays!,
          workSat,
          workSun
        );
      } else {
        // FF yok veya doğal bitiş kısıttan sonra → doğal bitişi kullan
        derivedEnd = maxEnd && maxEnd > naturalEnd ? maxEnd : naturalEnd;
      }
    }

    schedules.set(code, {
      plannedStart: existing?.plannedStart,
      plannedEnd: existing?.plannedEnd,
      earliestStart: derivedStart,
      earliestEnd: derivedEnd,
      reason,
    });

    visiting.delete(code);
    visited.add(code);
  }

  for (const w of leaves) {
    visit(w.code, []);
  }

  return { schedules, cycles, cycleNodes };
}

/**
 * Bir leaf'in planını N gün sağa kaydır — date key'lerini güncelle.
 * shiftDays > 0 ise sağa, < 0 ise sola kayar.
 */
export function shiftPlanByDays(
  byDate: Record<string, number> | undefined,
  shiftDays: number
): Record<string, number> {
  if (!byDate || shiftDays === 0) return byDate ?? {};
  const result: Record<string, number> = {};
  for (const [date, qty] of Object.entries(byDate)) {
    if (qty <= 0) continue;
    const newDate = toISODate(addDays(new Date(date), shiftDays));
    result[newDate] = qty;
  }
  return result;
}

/**
 * Tam zamanlama hesabı: forward pass + backward pass + float + effective dates.
 *
 * Forward pass: `computeEarliestStarts` → earliestStart/earliestEnd.
 * Backward pass: terminal node'lardan geriye doğru latestEnd/latestStart.
 * Float = latestStart − earliestStart. Float === 0 → kritik.
 * Effective dates: scheduleType "alap" ise latestStart/latestEnd, aksi takdirde
 * earliestStart/earliestEnd kullanılır (shift hedefi + bar görseli için).
 *
 * Proje bitişi: `projectEnd` parametresi (genellikle `project.plannedEnd`).
 * Verilmezse mevcut planların max end'inden türetilir (geriye uyum).
 */
export function computeSchedule(
  wbs: WbsItem[],
  planned: DateQuantityMap,
  projectStart: string,
  projectEnd?: string
): {
  schedules: Map<string, LeafSchedule>;
  cycles: string[];
  critical: Set<string>;
  /**
   * Döngüye dahil kalem code'ları. Bu kalemler için `totalFloat` ve `isCritical`
   * güvenilir DEĞİL — backward pass döngü içinden geri çıkamaz. UI'da "döngü"
   * badge'i ile ayrı işaretlenmelidir.
   */
  cycleNodes: Set<string>;
} {
  const { schedules, cycles, cycleNodes } = computeEarliestStarts(wbs, planned, projectStart);
  const leaves = wbs.filter((w) => !w.deletedAt && w.isLeaf);
  const byCode = new Map(leaves.map((w) => [w.code, w]));

  // Forward pass'ten gelen etkili start/end (kritik yol için range hesabı)
  type Range = { start: string; end: string };
  const ranges = new Map<string, Range>();
  for (const w of leaves) {
    const sch = schedules.get(w.code);
    if (!sch) continue;
    const eff = getEffectiveRange(w, planned[w.code]);
    const s = eff.start ?? sch.earliestStart;
    const e = eff.end ?? sch.earliestEnd ?? sch.earliestStart;
    if (s && e) ranges.set(w.code, { start: s, end: e });
  }

  // Proje bitiş tarihi — parametre verildiyse onu, yoksa mevcut range max'ını kullan
  let projEnd = projectEnd ?? projectStart;
  if (!projectEnd) {
    for (const r of ranges.values()) {
      if (r.end > projEnd) projEnd = r.end;
    }
  } else {
    // Parametre var ama range'ler daha ileride bitiyorsa onu da hesaba kat
    for (const r of ranges.values()) {
      if (r.end > projEnd) projEnd = r.end;
    }
  }

  // Successor graph (reverse of predecessor)
  // ÖNEMLİ: lagUnit'i de saklamak ZORUNLU — backward pass forward ile aynı birimde
  // çalışmalı. Aksi takdirde FS+5 work-day lag forward'da iş günü, backward'da
  // takvim günü gibi davranır → float yanlış → kritik yol yanlış.
  const successors = new Map<
    string,
    {
      successorCode: string;
      type: PredecessorType;
      lag: number;
      lagUnit: "calendar" | "work" | "no-sunday" | undefined;
    }[]
  >();
  for (const w of leaves) {
    for (const pred of w.predecessors ?? []) {
      const arr = successors.get(pred.wbsCode) ?? [];
      arr.push({
        successorCode: w.code,
        type: pred.type,
        lag: pred.lagDays,
        lagUnit: pred.lagUnit,
      });
      successors.set(pred.wbsCode, arr);
    }
  }

  // Topological sort (terminal nodes first) — reverseOrder ile geriye doğru ilerleyeceğiz
  const latestEndMap = new Map<string, string>();
  const orderQueue: string[] = [];
  const inDeg = new Map<string, number>();
  for (const code of byCode.keys()) {
    inDeg.set(code, successors.get(code)?.length ?? 0);
  }
  for (const [c, d] of inDeg) {
    if (d === 0) orderQueue.push(c);
  }
  const reverseOrder: string[] = [];
  while (orderQueue.length > 0) {
    const c = orderQueue.shift()!;
    reverseOrder.push(c);
    const w = byCode.get(c);
    for (const pred of w?.predecessors ?? []) {
      const prevDeg = inDeg.get(pred.wbsCode) ?? 0;
      inDeg.set(pred.wbsCode, prevDeg - 1);
      if (prevDeg - 1 === 0) orderQueue.push(pred.wbsCode);
    }
  }

  // Workweek bayraklarını item'dan al (workSat/workSun).
  // Default mon-sat — Türkiye inşaat standardı (Cumartesi çalışılır, Pazar tatil).
  function wwFlags(item: WbsItem | undefined): { workSat: boolean; workSun: boolean } {
    const ww = item?.workweek;
    if (ww === "mon-fri") return { workSat: false, workSun: false };
    if (ww === "mon-sun") return { workSat: true, workSun: true };
    return { workSat: true, workSun: false };
  }

  // Backward pass: terminal'lerden geriye doğru latestEnd hesabı.
  //
  // Lag birimi: forward pass `addLag(date, +lag, unit)` ile ileri taşıyor; backward
  // pass aynı ilişkiyi tersine çevirmek için `addLag(date, -lag, unit)` kullanır.
  // Bu sayede "FS+5 iş günü" backward'da da iş günü olarak değerlendirilir.
  //
  // Süre (succ ve A için): workweek-aware iş günü olarak hesaplanır.
  // Pzt-Cum görev planı 4/13-4/24 = 10 iş günü; geriye sayım da iş günü cinsinden
  // yapılarak hafta sonlarındaki "ücretsiz" günler float'tan düşülmez.
  for (const code of reverseOrder) {
    const r = ranges.get(code);
    if (!r) continue;
    let le = projEnd; // default: proje bitişi (terminal node için)
    const succs = successors.get(code) ?? [];
    const aItem = byCode.get(code);
    const { workSat: aWorkSat, workSun: aWorkSun } = wwFlags(aItem);
    for (const s of succs) {
      const succRange = ranges.get(s.successorCode);
      const succLE = latestEndMap.get(s.successorCode) ?? succRange?.end ?? projEnd;
      if (!succRange) continue;
      const succItem = byCode.get(s.successorCode);
      const { workSat: succWorkSat, workSun: succWorkSun } = wwFlags(succItem);
      // Succ'un iş günü cinsinden süresi — plan range'inde çalışma günü sayısı
      const succWorkingDays = workingDates(
        succRange.start,
        succRange.end,
        succWorkSat,
        succWorkSun
      ).length;
      // B.LS = succ workweek'inde N iş günü geri
      const sLSIso =
        succWorkingDays > 0
          ? startDateFromDuration(succLE, succWorkingDays, succWorkSat, succWorkSun)
          : succLE;

      let cIso: string;
      if (s.type === "FS") {
        // Forward: B.LS = addLag(A.LE, lag+1, unit)
        // Backward: A.LE = addLag(B.LS, -(lag+1), unit)
        cIso = addLag(sLSIso, -(s.lag + 1), s.lagUnit);
      } else if (s.type === "SS") {
        // Forward: B.LS = addLag(A.LS, lag, unit) → A.LS = addLag(B.LS, -lag, unit)
        // A.LE = endDateFromDuration(A.LS, aWorkingDays, A.workweek)
        const aWorkingDays = workingDates(r.start, r.end, aWorkSat, aWorkSun).length;
        const aLSIso = addLag(sLSIso, -s.lag, s.lagUnit);
        cIso =
          aWorkingDays > 0
            ? endDateFromDuration(aLSIso, aWorkingDays, aWorkSat, aWorkSun)
            : aLSIso;
      } else {
        // FF — Forward: B.LE = addLag(A.LE, lag, unit) → A.LE = addLag(B.LE, -lag, unit)
        cIso = addLag(succLE, -s.lag, s.lagUnit);
      }
      if (cIso < le) le = cIso;
    }
    latestEndMap.set(code, le);
  }

  // Workweek snap helper (hedef kalemin iş haftası)
  function snapBackward(iso: string, ww?: "mon-fri" | "mon-sat" | "mon-sun"): string {
    const workSat = ww === "mon-fri" ? false : true;
    const workSun = ww === "mon-sun" ? true : false;
    const cur = new Date(iso + "T00:00:00");
    let guard = 0;
    while (guard++ < 7) {
      const dow = cur.getDay();
      const off = (dow === 0 && !workSun) || (dow === 6 && !workSat);
      if (!off) break;
      cur.setDate(cur.getDate() - 1);
    }
    return toISODate(cur);
  }

  // Bir kalemin "etkili bitiş tarihi" — forward pass için successor'lara
  // aktarılan fallback zinciri (plannedEnd > earliestEnd > earliestStart).
  // Plan hareket ettikçe değişir.
  function endOf(sch: LeafSchedule): string {
    return sch.plannedEnd ?? sch.earliestEnd ?? sch.earliestStart;
  }

  // STABLE earliestEnd — earliestStart'tan N WORKING DAY ileri.
  // N = plan'daki working day sayısı (calendar değil — plan hafta sonu içerip
  // içermemesinden bağımsız STABLE olur).
  // Free Float hesabında bunu kullanmak ZORUNLU: aksi takdirde plan hareket
  // edince planDuration (calendar) değişir, FF değişir, plan yeniden kayar.
  function trueEndOf(code: string, sch: LeafSchedule, item: WbsItem | undefined): string {
    const range = ranges.get(code);
    if (!range) return sch.earliestEnd ?? sch.earliestStart;
    // Plan'daki çalışma günü sayısı (kalemin workweek'i ile)
    const ww = item?.workweek;
    const workSat = ww === "mon-fri" ? false : true;
    const workSun = ww === "mon-sun" ? true : false;
    const planWorkingDays = workingDates(range.start, range.end, workSat, workSun).length;
    if (planWorkingDays <= 0) return sch.earliestStart;
    // earliestStart'tan N working day ilerisi
    return endDateFromDuration(sch.earliestStart, planWorkingDays, workSat, workSun);
  }

  // Free Float hesabı — successor'ların pozisyonunu kullanır.
  //
  // ÖNEMLİ: ALAP zincirinde (A→B→C, A & B ALAP) doğru sonuç için successor'ların
  // ALAP-resolved pozisyonu (effectiveStart/End) kullanılır. Bu, reverseOrder
  // iterasyonunu gerektirir — successor önce işlenir, sonra predecessor.
  //
  // ASAP successor: earliestStart (forward pass)
  // ALAP successor (resolved): effectiveStart (ALAP-late pozisyon)
  // ALAP successor (unresolved): earliestStart fallback (reverseOrder garanti)
  function computeFreeFloat(code: string): number {
    const own = schedules.get(code);
    if (!own) return 0;
    const ownEE = trueEndOf(code, own, byCode.get(code));
    const succs = successors.get(code) ?? [];
    if (succs.length === 0) {
      // Terminal kalem → free float = totalFloat (projeye kadar boş alan)
      const leRaw = latestEndMap.get(code);
      if (!leRaw) return 0;
      const eeTime = new Date(ownEE + "T00:00:00").getTime();
      const leTime = new Date(leRaw + "T00:00:00").getTime();
      return Math.max(0, Math.floor((leTime - eeTime) / 86400000));
    }
    let minSlack = Infinity;
    for (const s of succs) {
      const bSch = schedules.get(s.successorCode);
      if (!bSch) continue;
      const succItem = byCode.get(s.successorCode);
      const isSuccAlap = succItem?.scheduleType === "alap";
      // Successor pozisyonu:
      //  - ALAP successor: effectiveStart (reverseOrder ile zaten resolved)
      //  - Fixed/öncülsüz/milestone successor: plannedStart (user-placed pozisyon)
      //  - Diğer ASAP: earliestStart (forward pass)
      //
      // plannedStart fallback önemli: milestone day 50'de sabitse veya bir kalem
      // ASAP+öncülsüz olarak manuel yerleştirilmişse, FF onun "fiili" pozisyonuna
      // göre hesaplanmalı, earliestStart'a göre değil (aksi takdirde predecessor'lar
      // sabit kalemin önüne ALAP olarak yerleşemez).
      const bES = isSuccAlap && bSch.effectiveStart
        ? bSch.effectiveStart
        : bSch.plannedStart ?? bSch.earliestStart;
      const bEE = isSuccAlap && bSch.effectiveEnd
        ? bSch.effectiveEnd
        : bSch.plannedEnd ?? trueEndOf(s.successorCode, bSch, succItem);
      let slack: number;
      if (s.type === "FS") {
        // A.EF + 1 + lag ≤ B.ES → slack = B.ES − A.EF − lag − 1
        slack = Math.floor(
          (new Date(bES + "T00:00:00").getTime() -
            new Date(ownEE + "T00:00:00").getTime()) /
            86400000
        ) - s.lag - 1;
      } else if (s.type === "SS") {
        // A.ES + lag ≤ B.ES → slack = B.ES − A.ES − lag
        slack = Math.floor(
          (new Date(bES + "T00:00:00").getTime() -
            new Date(own.earliestStart + "T00:00:00").getTime()) /
            86400000
        ) - s.lag;
      } else {
        // FF: A.EF + lag ≤ B.EF → slack = B.EF − A.EF − lag
        slack = Math.floor(
          (new Date(bEE + "T00:00:00").getTime() -
            new Date(ownEE + "T00:00:00").getTime()) /
            86400000
        ) - s.lag;
      }
      if (slack < minSlack) minSlack = slack;
    }
    return Math.max(0, minSlack === Infinity ? 0 : minSlack);
  }

  // ISO + N gün → ISO (calendar gün ekleme).
  // fmtLocalISO kullanılır — toISODate UTC'ye düşer ve TR'de 1 gün geri kayar.
  function addCalendarDays(iso: string, days: number): string {
    if (days === 0) return iso;
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return fmtLocalISO(d);
  }

  // schedules'ı latestStart/latestEnd/totalFloat/freeFloat/effectiveStart/End ile zenginleştir.
  //
  // ÖNEMLİ: reverseOrder iterasyonu — terminal kalemler ÖNCE işlenir, predecessor'lar
  // SONRA. Bu sayede ALAP zincirinde (A→B→C, A & B ALAP) B'nin effectiveStart'ı
  // önce computed olur, sonra A'nın FF hesabında B.effectiveStart kullanılır.
  // Eski "for (const w of leaves)" sırası bunu sağlamıyordu → A.FF=0 hatası.
  const critical = new Set<string>();
  for (const code of reverseOrder) {
    const w = byCode.get(code);
    if (!w) continue;
    const sch = schedules.get(code);
    if (!sch) continue;
    const range = ranges.get(code);
    const { workSat: wSat, workSun: wSun } = wwFlags(w);
    // Süre: kalemin workweek'inde plan range'indeki iş günü sayısı.
    // Plan 4/13-4/24 (mon-fri) → 10 iş günü. Geriye sayım da iş günü cinsinden.
    const workingDayCount = range
      ? workingDates(range.start, range.end, wSat, wSun).length
      : 0;
    const leRaw = latestEndMap.get(code);
    if (!leRaw) {
      sch.effectiveStart = sch.earliestStart;
      sch.effectiveEnd = endOf(sch);
      continue;
    }
    // Workweek snap: latestEnd hedef kalemin son çalışma gününe geri kaydırılır
    const le = snapBackward(leRaw, w.workweek);
    // latestStart = N iş günü geri (workweek-aware) — startDateFromDuration zaten
    // snap'lenmiş bir çalışma günü döner, ek snap gerekmez.
    const ls =
      workingDayCount > 0
        ? startDateFromDuration(le, workingDayCount, wSat, wSun)
        : le;

    sch.latestStart = ls;
    sch.latestEnd = le;

    // Total Float = latestStart − earliestStart (calendar gün)
    const es = sch.earliestStart;
    const floatDays = Math.max(
      0,
      Math.floor(
        (new Date(ls + "T00:00:00").getTime() - new Date(es + "T00:00:00").getTime()) /
          86400000
      )
    );
    sch.totalFloat = floatDays;
    sch.isCritical = floatDays === 0;
    if (floatDays === 0) critical.add(w.code);

    // Free Float — ALAP yerleşimi için
    const ff = computeFreeFloat(w.code);
    sch.freeFloat = ff;

    // Effective dates — scheduleType'a göre
    if (w.scheduleType === "alap") {
      // ALAP yerleşimi:
      //   alapEnd  ← trueEnd + freeFloat                       (successor'ları geciktirme)
      //   clamp    ← max(alapEnd, FF lower bound)              (FF predecessor ihlal etme)
      //   alapEnd  ← snapBackward(alapEnd, item.workweek)      (çalışma gününe yasla)
      //   alapStart ← N working day alapEnd'ten geri           (plan süresi korunsun)
      //
      // FF lower bound: sch.earliestEnd (forward pass'in FF predecessor'dan
      // koyduğu kısıt — B.EF ≥ A.EF + lag). Bu ALT sınırdır; ALAP bunun altına
      // inemez aksi takdirde FF ilişkisi bozulur.
      const ee = trueEndOf(w.code, sch, w);
      const workSat_w = w.workweek === "mon-fri" ? false : true;
      const workSun_w = w.workweek === "mon-sun" ? true : false;
      let alapEnd = addCalendarDays(ee, ff);
      // FF predecessor lower bound — ALAP bunun altına düşemez
      if (sch.earliestEnd && sch.earliestEnd > alapEnd) {
        alapEnd = sch.earliestEnd;
      }
      alapEnd = snapBackward(alapEnd, w.workweek);
      // Working day count (plan varsa plan'dan; yoksa estimatedDurationDays)
      const wRange = ranges.get(w.code);
      let workingDayCount = 0;
      if (wRange) {
        workingDayCount = workingDates(wRange.start, wRange.end, workSat_w, workSun_w).length;
      } else if (w.estimatedDurationDays && w.estimatedDurationDays > 0) {
        workingDayCount = w.estimatedDurationDays;
      }
      const alapStart = workingDayCount > 0
        ? startDateFromDuration(alapEnd, workingDayCount, workSat_w, workSun_w)
        : alapEnd;
      sch.effectiveStart = alapStart;
      sch.effectiveEnd = alapEnd;
    } else {
      sch.effectiveStart = sch.earliestStart;
      sch.effectiveEnd = endOf(sch);
    }
  }

  return { schedules, cycles, critical, cycleNodes };
}

/**
 * Critical Path — geriye uyum için. `computeSchedule`'i çağırıp sadece kritik
 * Set'ini döner.
 */
export function computeCriticalPath(
  wbs: WbsItem[],
  planned: DateQuantityMap,
  projectStart: string,
  projectEnd?: string
): Set<string> {
  return computeSchedule(wbs, planned, projectStart, projectEnd).critical;
}

/**
 * Cycle olmadan bir linkin eklenebilir olduğunu doğrula.
 * Geriye [false, hata] veya [true] döner.
 */
export function canAddPredecessor(
  wbs: WbsItem[],
  targetCode: string,    // B (predecessor eklenecek satır)
  predecessorCode: string // A (öncül)
): { ok: true } | { ok: false; reason: string } {
  if (targetCode === predecessorCode) {
    return { ok: false, reason: "Bir kalem kendine öncül olamaz" };
  }
  // Predecessor zinciri B'ye dönüyor mu? (cycle)
  // Eğer A → ... → B yolu varsa, B → A eklemek cycle yapar
  const byCode = new Map(wbs.filter((w) => !w.deletedAt).map((w) => [w.code, w]));
  const visited = new Set<string>();

  function reachesTarget(from: string): boolean {
    if (from === targetCode) return true;
    if (visited.has(from)) return false;
    visited.add(from);
    const item = byCode.get(from);
    if (!item) return false;
    for (const link of item.predecessors ?? []) {
      if (reachesTarget(link.wbsCode)) return true;
    }
    return false;
  }

  if (reachesTarget(predecessorCode)) {
    return {
      ok: false,
      reason: `Döngü oluşur: ${targetCode} zaten ${predecessorCode}'a (dolaylı) bağlı`,
    };
  }

  return { ok: true };
}
