/**
 * Plan dağılım hesaplayıcıları — gün sayısı + toplam miktar + şablon → günlük miktarlar.
 *
 * Şablonlar (kullanıcı tarafından PMP/Primavera standardına yakın):
 * - "uniform"      = düzgün / eşit dağılım (her gün aynı)
 * - "s-curve"      = S-eğrisi / çan eğrisi (ortada yoğun, kenarlar yumuşak)
 * - "front-loaded" = önden yüklü (başta yoğun, sonda azalan)
 * - "back-loaded"  = sondan yüklü (başta az, sonda yoğun)
 * - "daily-fixed"  = günlük sabit miktar + kalanı son güne ata
 *
 * Eski adlar "linear", "ramp", "bell", "daily" ile geriye uyumlu — `mapLegacyMode()`.
 */

export type DistributionShape =
  | "uniform"
  | "s-curve"
  | "front-loaded"
  | "back-loaded"
  | "daily-fixed";

/** Eski isimler → yeni standart. */
export function mapLegacyMode(
  mode: "linear" | "ramp" | "bell" | "daily"
): DistributionShape {
  switch (mode) {
    case "linear":
      return "uniform";
    case "ramp":
      return "back-loaded";
    case "bell":
      return "s-curve";
    case "daily":
      return "daily-fixed";
  }
}

/** Türkçe gösterim ismi. */
export function distributionLabel(s: DistributionShape): string {
  switch (s) {
    case "uniform":
      return "Düzgün (eşit)";
    case "s-curve":
      return "S-eğrisi (orta yoğun)";
    case "front-loaded":
      return "Önden yüklü";
    case "back-loaded":
      return "Sondan yüklü";
    case "daily-fixed":
      return "Sabit günlük";
  }
}

/**
 * Toplam miktarı `days` gün sayısına dağıtır.
 * Sonuç toplamı = `total` (yuvarlamadan kaynaklı sapma son güne eklenir).
 *
 * @param total     Toplam dağıtılacak miktar
 * @param days      Çalışma günü sayısı
 * @param shape     Dağılım şekli
 * @param dailyFixed (sadece "daily-fixed" için) günlük sabit miktar
 */
export function computeDistribution(
  total: number,
  days: number,
  shape: DistributionShape,
  dailyFixed: number = 0
): number[] {
  if (days <= 0 || total <= 0) return [];

  // Günlük sabit modu: her güne sabit miktar, eksik kısmı son güne bırak.
  if (shape === "daily-fixed") {
    if (dailyFixed <= 0) return new Array(days).fill(0);
    const result: number[] = [];
    let remaining = total;
    for (let i = 0; i < days; i++) {
      if (i === days - 1) {
        result.push(Math.max(0, remaining));
      } else {
        const take = Math.min(dailyFixed, remaining);
        result.push(Math.max(0, take));
        remaining -= take;
      }
    }
    return result;
  }

  // Ağırlık vektörü
  const weights: number[] = [];
  for (let i = 0; i < days; i++) {
    switch (shape) {
      case "uniform":
        weights.push(1);
        break;
      case "back-loaded":
        // Doğrusal artan: 1, 2, 3, …
        weights.push(i + 1);
        break;
      case "front-loaded":
        // Doğrusal azalan: n, n-1, n-2, …
        weights.push(days - i);
        break;
      case "s-curve": {
        // Üçgen tipi yumuşak çan — ortada en yüksek
        const mid = (days - 1) / 2;
        const dist = Math.abs(i - mid);
        // 1 (uçlarda) → mid+1 (tepe)
        weights.push(Math.max(1, mid + 1 - dist));
        break;
      }
    }
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  // 2-ondalıklı dağıtım. Yüksek quantity'de zaten tam sayı çıkar (100/10 = 10.00),
  // düşük quantity'de doğru fraksiyon (1/14 → her güne 0.07, son güne kalan).
  // floor (round değil) — toplamı aşmamak için. Son güne (toplam − önce dağıtılan).
  const portions = weights.map((w) => Math.floor((total * w * 100) / totalW) / 100);
  const used = portions.reduce((a, b) => a + b, 0);
  if (portions.length > 0) {
    portions[portions.length - 1] =
      Math.round((portions[portions.length - 1] + (total - used)) * 100) / 100;
  }
  return portions;
}

/**
 * İki tarih arasındaki çalışma günü tarihlerini döner.
 * @param startISO Başlangıç tarihi (dahil)
 * @param endISO   Bitiş tarihi (dahil)
 * @param workSat  Cumartesi çalışılıyor mu (default true)
 * @param workSun  Pazar çalışılıyor mu (default false)
 */
export function workingDates(
  startISO: string,
  endISO: string,
  workSat: boolean = true,
  workSun: boolean = false
): string[] {
  const dates: string[] = [];
  const cur = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  while (cur <= end) {
    const dow = cur.getDay(); // 0=Sun, 6=Sat
    const isSunday = dow === 0;
    const isSaturday = dow === 6;
    const skip = (isSunday && !workSun) || (isSaturday && !workSat);
    if (!skip) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, "0");
      const d = String(cur.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Aralıktaki TÜM tarihleri döner (hafta sonu dahil) — önizleme için.
 * Her tarih için `isWorkDay` flag de döner ki UI kilit gösterebilsin.
 */
export function allDatesInRange(
  startISO: string,
  endISO: string,
  workSat: boolean = true,
  workSun: boolean = false
): { date: string; isWorkDay: boolean }[] {
  if (!startISO || !endISO) return [];
  const dates: { date: string; isWorkDay: boolean }[] = [];
  const cur = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  while (cur <= end) {
    const dow = cur.getDay();
    const isSunday = dow === 0;
    const isSaturday = dow === 6;
    const isWorkDay = !((isSunday && !workSun) || (isSaturday && !workSat));
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    dates.push({ date: `${y}-${m}-${d}`, isWorkDay });
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** Çalışma günü sayısı + başlangıç tarihi → bitiş tarihi. */
export function endDateFromDuration(
  startISO: string,
  durationDays: number,
  workSat: boolean = true,
  workSun: boolean = false
): string {
  if (durationDays <= 0) return startISO;
  const cur = new Date(startISO + "T00:00:00");
  let counted = 0;
  while (counted < durationDays) {
    const dow = cur.getDay();
    const skip = (dow === 0 && !workSun) || (dow === 6 && !workSat);
    if (!skip) counted++;
    if (counted < durationDays) cur.setDate(cur.getDate() + 1);
  }
  const y = cur.getFullYear();
  const m = String(cur.getMonth() + 1).padStart(2, "0");
  const d = String(cur.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Çalışma günü sayısı + bitiş tarihi → başlangıç tarihi (geri sayım). FF constraint için. */
export function startDateFromDuration(
  endISO: string,
  durationDays: number,
  workSat: boolean = true,
  workSun: boolean = false
): string {
  if (durationDays <= 0) return endISO;
  const cur = new Date(endISO + "T00:00:00");
  let counted = 0;
  while (counted < durationDays) {
    const dow = cur.getDay();
    const skip = (dow === 0 && !workSun) || (dow === 6 && !workSat);
    if (!skip) counted++;
    if (counted < durationDays) cur.setDate(cur.getDate() - 1);
  }
  const y = cur.getFullYear();
  const m = String(cur.getMonth() + 1).padStart(2, "0");
  const d = String(cur.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Başlangıç ve bitiş arasındaki çalışma günü sayısı (her ikisi dahil). */
export function durationFromDates(
  startISO: string,
  endISO: string,
  workSat: boolean = true,
  workSun: boolean = false
): number {
  return workingDates(startISO, endISO, workSat, workSun).length;
}
