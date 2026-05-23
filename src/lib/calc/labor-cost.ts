/**
 * Personel + Makine işçilik maliyeti hesabı.
 *
 * Formül: cost = (dailyRate / 8) × hours
 *   - Türkiye standardı 8 saat günlük.
 *   - hours == 8  → tam yevmiye.
 *   - hours < 8   → kısmi yevmiye.
 *   - hours > 8   → mesai (orantılı artar).
 *
 * Para birimi: TRY/USD/EUR ayrı toplanır, birbirine ÇEVRİLMEZ.
 * Mazot/yakıt maliyete dahil değildir — sadece yevmiye.
 */

import type {
  PersonnelMaster,
  MachineMaster,
  PersonnelAttendance,
  MachineAttendance,
} from "@/lib/store/types";
import type { Currency } from "@/lib/utils";

export const STANDARD_DAILY_HOURS = 8;

export interface CurrencyTotals {
  TRY: number;
  USD: number;
  EUR: number;
}

export interface CompanyCostRow {
  company: string;
  personnelCost: CurrencyTotals;
  machineCost: CurrencyTotals;
  personnelHours: number;
  machineHours: number;
  personnelManDays: number; // toplam saat / 8
  machineManDays: number;
  personnelCount: number;   // bu firmadan kaç farklı kişi çalıştı
  machineCount: number;     // bu firmadan kaç farklı makine çalıştı
}

export interface PersonnelLineDetail {
  personnel: PersonnelMaster;
  hours: number;
  manDays: number;
  cost: CurrencyTotals;
  daysActive: number; // kaç farklı günde çalıştı
}

export interface MachineLineDetail {
  machine: MachineMaster;
  hours: number;
  manDays: number;
  cost: CurrencyTotals;
  daysActive: number;
}

export interface Filters {
  /** ISO YYYY-MM-DD — dahil */
  startDate?: string;
  /** ISO YYYY-MM-DD — dahil */
  endDate?: string;
  /** Boş ise tüm projeler */
  projectIds?: string[];
  /** Boş ise tüm disiplinler (sadece personel için) */
  disciplines?: string[];
  /** Boş ise tüm firmalar */
  companies?: string[];
}

function emptyCurrency(): CurrencyTotals {
  return { TRY: 0, USD: 0, EUR: 0 };
}

function addToCurrency(c: CurrencyTotals, currency: Currency, amount: number) {
  if (currency === "TRY") c.TRY += amount;
  else if (currency === "USD") c.USD += amount;
  else if (currency === "EUR") c.EUR += amount;
}

function inRange(date: string, start?: string, end?: string): boolean {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

/** Tek attendance kaydı için cost = (rate / 8) × hours */
function attendanceCost(rate: number, hours: number): number {
  if (!rate || rate <= 0 || !hours || hours <= 0) return 0;
  return (rate / STANDARD_DAILY_HOURS) * hours;
}

export interface ComputeInput {
  personnel: PersonnelMaster[];
  machines: MachineMaster[];
  personnelAttendance: PersonnelAttendance[];
  machineAttendance: MachineAttendance[];
}

export interface ComputeOutput {
  /** Firma bazında toplam */
  byCompany: CompanyCostRow[];
  /** Tüm projelerin toplamı */
  totals: {
    personnelCost: CurrencyTotals;
    machineCost: CurrencyTotals;
    personnelHours: number;
    machineHours: number;
  };
  /** Her firmanın personel detayı (drill-down için) */
  personnelDetails: Map<string, PersonnelLineDetail[]>;
  /** Her firmanın makine detayı (drill-down için) */
  machineDetails: Map<string, MachineLineDetail[]>;
}

export function computeLaborCost(
  input: ComputeInput,
  filters: Filters = {}
): ComputeOutput {
  const personnelById = new Map(input.personnel.map((p) => [p.id, p]));
  const machineById = new Map(input.machines.map((m) => [m.id, m]));

  // Firma → kümülatif
  const byCompanyMap = new Map<string, CompanyCostRow>();
  const personnelLines = new Map<string, Map<string, PersonnelLineDetail>>(); // company → personnelId → detail
  const machineLines = new Map<string, Map<string, MachineLineDetail>>();

  const totals = {
    personnelCost: emptyCurrency(),
    machineCost: emptyCurrency(),
    personnelHours: 0,
    machineHours: 0,
  };

  function ensureCompany(name: string): CompanyCostRow {
    let row = byCompanyMap.get(name);
    if (!row) {
      row = {
        company: name,
        personnelCost: emptyCurrency(),
        machineCost: emptyCurrency(),
        personnelHours: 0,
        machineHours: 0,
        personnelManDays: 0,
        machineManDays: 0,
        personnelCount: 0,
        machineCount: 0,
      };
      byCompanyMap.set(name, row);
    }
    return row;
  }

  // ─── Personel ───
  for (const a of input.personnelAttendance) {
    if (!a.present) continue;
    if (!inRange(a.date, filters.startDate, filters.endDate)) continue;
    if (filters.projectIds && filters.projectIds.length > 0 && !filters.projectIds.includes(a.projectId)) continue;
    const p = personnelById.get(a.personnelMasterId);
    if (!p) continue;
    if (filters.disciplines && filters.disciplines.length > 0 && !filters.disciplines.includes(p.discipline)) continue;
    if (filters.companies && filters.companies.length > 0 && !filters.companies.includes(p.company)) continue;
    const rate = p.dailyRate ?? 0;
    const cur = (p.dailyRateCurrency ?? "TRY") as Currency;
    const hrs = a.hours || 0;
    const cost = attendanceCost(rate, hrs);

    const row = ensureCompany(p.company);
    addToCurrency(row.personnelCost, cur, cost);
    row.personnelHours += hrs;
    row.personnelManDays += hrs / STANDARD_DAILY_HOURS;

    addToCurrency(totals.personnelCost, cur, cost);
    totals.personnelHours += hrs;

    // Drill-down detay
    let companyMap = personnelLines.get(p.company);
    if (!companyMap) {
      companyMap = new Map();
      personnelLines.set(p.company, companyMap);
    }
    let line = companyMap.get(p.id);
    if (!line) {
      line = {
        personnel: p,
        hours: 0,
        manDays: 0,
        cost: emptyCurrency(),
        daysActive: 0,
      };
      companyMap.set(p.id, line);
    }
    line.hours += hrs;
    line.manDays += hrs / STANDARD_DAILY_HOURS;
    addToCurrency(line.cost, cur, cost);
    line.daysActive += 1;
  }

  // ─── Makine ───
  for (const a of input.machineAttendance) {
    if (!a.present) continue;
    if (!inRange(a.date, filters.startDate, filters.endDate)) continue;
    if (filters.projectIds && filters.projectIds.length > 0 && !filters.projectIds.includes(a.projectId)) continue;
    const m = machineById.get(a.machineMasterId);
    if (!m) continue;
    if (filters.companies && filters.companies.length > 0 && !filters.companies.includes(m.company)) continue;
    const rate = m.dailyRate ?? 0;
    const cur = (m.dailyRateCurrency ?? "TRY") as Currency;
    const hrs = a.hours || 0;
    const cost = attendanceCost(rate, hrs);

    const row = ensureCompany(m.company);
    addToCurrency(row.machineCost, cur, cost);
    row.machineHours += hrs;
    row.machineManDays += hrs / STANDARD_DAILY_HOURS;

    addToCurrency(totals.machineCost, cur, cost);
    totals.machineHours += hrs;

    let companyMap = machineLines.get(m.company);
    if (!companyMap) {
      companyMap = new Map();
      machineLines.set(m.company, companyMap);
    }
    let line = companyMap.get(m.id);
    if (!line) {
      line = {
        machine: m,
        hours: 0,
        manDays: 0,
        cost: emptyCurrency(),
        daysActive: 0,
      };
      companyMap.set(m.id, line);
    }
    line.hours += hrs;
    line.manDays += hrs / STANDARD_DAILY_HOURS;
    addToCurrency(line.cost, cur, cost);
    line.daysActive += 1;
  }

  // personnel/machine count'larını detail map'lerinden al
  for (const [company, perMap] of personnelLines.entries()) {
    const row = byCompanyMap.get(company);
    if (row) row.personnelCount = perMap.size;
  }
  for (const [company, macMap] of machineLines.entries()) {
    const row = byCompanyMap.get(company);
    if (row) row.machineCount = macMap.size;
  }

  // Detail map'leri array'e çevir
  const personnelDetails = new Map<string, PersonnelLineDetail[]>();
  for (const [c, m] of personnelLines) {
    personnelDetails.set(
      c,
      Array.from(m.values()).sort((a, b) => b.manDays - a.manDays)
    );
  }
  const machineDetails = new Map<string, MachineLineDetail[]>();
  for (const [c, m] of machineLines) {
    machineDetails.set(
      c,
      Array.from(m.values()).sort((a, b) => b.manDays - a.manDays)
    );
  }

  // Firma kartları — toplam maliyete göre sırala (TRY öncelikli)
  const byCompany = Array.from(byCompanyMap.values()).sort((a, b) => {
    const aTotal = a.personnelCost.TRY + a.machineCost.TRY;
    const bTotal = b.personnelCost.TRY + b.machineCost.TRY;
    return bTotal - aTotal;
  });

  return { byCompany, totals, personnelDetails, machineDetails };
}
