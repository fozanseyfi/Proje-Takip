"use client";

import { useStore } from "@/lib/store";
import { DEFAULT_WBS } from "@/lib/data/default-wbs";
import { uid, toISODate, addDays } from "@/lib/utils";
import {
  MALE_NAMES,
  FEMALE_NAMES,
  LAST_NAMES,
  SAMPLE_COMPANIES,
  PERSONNEL_PLAN,
  SAMPLE_MACHINES,
  QUANTITY_OVERRIDE,
  PLAN_SCHEDULE,
  BUDGET_CATEGORIES,
  SAMPLE_SUBCONTRACTORS,
} from "./sample-pools";
import type {
  Project,
  ProjectMember,
  WbsItem,
  DateQuantityMap,
  PersonnelMaster,
  MachineMaster,
  PersonnelAssignment,
  MachineAssignment,
  PersonnelAttendance,
  MachineAttendance,
  DailyReport,
  ProcurementItem,
  LookaheadItem,
  BudgetCategory,
  BudgetActual,
  Subcontractor,
  BillingItem,
  Discipline,
  Priority,
} from "@/lib/store/types";

export const SAMPLE_PROJECT_NAME = "Ankara Polatlı GES";

export interface SamplePayload {
  project: Project;
  member: ProjectMember;
  wbs: WbsItem[];
  planned: DateQuantityMap;
  realized: DateQuantityMap;
  personnel: PersonnelMaster[];
  personnelAssignments: PersonnelAssignment[];
  personnelAttendance: PersonnelAttendance[];
  machines: MachineMaster[];
  machineAssignments: MachineAssignment[];
  machineAttendance: MachineAttendance[];
  dailyReports: DailyReport[];
  procurement: ProcurementItem[];
  lookahead: LookaheadItem[];
  budgetCategories: BudgetCategory[];
  budgetActuals: BudgetActual[];
  subcontractors: Subcontractor[];
  billing: BillingItem[];
}

// ============================================================
// Sözde-random (deterministic, her yüklemede aynı veri)
// ============================================================
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// ============================================================
// PROJE
// ============================================================
function buildProject(userId: string): Project {
  const today = new Date();
  const startDate = toISODate(addDays(today, -60));   // bugün gün 60/120
  const start = new Date(startDate);
  const plannedEnd = toISODate(addDays(start, 120));
  return {
    id: uid(),
    name: SAMPLE_PROJECT_NAME,
    location: "Ankara, Polatlı",
    latitude: 39.5836,
    longitude: 32.1465,
    wbsNo: "1",
    startDate,
    durationDays: 120,
    plannedEnd,
    contractEnd: plannedEnd,
    reportDate: toISODate(today),
    installedCapacityMw: 12,
    totalBudget: 5_160_000,
    budgetCurrency: "USD",
    status: "active",
    mainContractorName:
      SAMPLE_COMPANIES.find((c) => c.isMain)?.name ?? "Kontrolmatik Teknoloji A.Ş.",
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================
// WBS (default + quantity override)
// ============================================================
function buildWbs(project: Project): WbsItem[] {
  return DEFAULT_WBS.map((w) => {
    const qty = QUANTITY_OVERRIDE[w.code] ?? w.quantity;
    const code = w.code;
    return {
      id: uid(),
      projectId: project.id,
      code,
      name: w.name,
      level: w.level,
      isLeaf: w.isLeaf,
      weight: w.weight,
      quantity: qty,
      unit: w.unit,
      parentCode: code.includes(".") ? code.split(".").slice(0, -1).join(".") : undefined,
    };
  });
}

// ============================================================
// PLAN: her leaf için startDay-durationDays içinde günlük eşit dağılım
// ============================================================
function buildPlanned(project: Project, wbs: WbsItem[]): DateQuantityMap {
  const start = new Date(project.startDate);
  const planned: DateQuantityMap = {};
  for (const w of wbs) {
    if (!w.isLeaf || w.quantity <= 0) continue;
    const sched = PLAN_SCHEDULE[w.code];
    if (!sched) continue;
    const perDay = w.quantity / sched.durationDays;
    const byDate: Record<string, number> = {};
    for (let i = 0; i < sched.durationDays; i++) {
      const day = sched.startDay - 1 + i;
      if (day >= project.durationDays) break;
      const d = toISODate(addDays(start, day));
      byDate[d] = perDay;
    }
    planned[w.code] = byDate;
  }
  return planned;
}

// ============================================================
// REALIZED: planın bugüne kadarki kısmı × random(0.85, 1.05)
// ============================================================
function buildRealized(
  project: Project,
  planned: DateQuantityMap,
  rng: () => number
): DateQuantityMap {
  const today = project.reportDate;
  const realized: DateQuantityMap = {};
  for (const [code, byDate] of Object.entries(planned)) {
    const newMap: Record<string, number> = {};
    for (const [d, qty] of Object.entries(byDate)) {
      if (d > today) continue;
      const factor = randRange(rng, 0.85, 1.05);
      newMap[d] = qty * factor;
    }
    if (Object.keys(newMap).length > 0) realized[code] = newMap;
  }
  return realized;
}

// ============================================================
// PERSONEL MASTER
// ============================================================
function buildPersonnel(userId: string, rng: () => number): PersonnelMaster[] {
  const usedNames = new Set<string>();
  const out: PersonnelMaster[] = [];
  const now = new Date().toISOString();
  for (const [discipline, cfg] of Object.entries(PERSONNEL_PLAN) as [Discipline, typeof PERSONNEL_PLAN[Discipline]][]) {
    for (let i = 0; i < cfg.count; i++) {
      let fullKey = "";
      let firstName = "";
      let lastName = "";
      // Female %10, male %90
      const isFemale = rng() < 0.1;
      let tries = 0;
      while (tries++ < 25) {
        firstName = pick(rng, isFemale ? FEMALE_NAMES : MALE_NAMES);
        lastName = pick(rng, LAST_NAMES);
        fullKey = `${firstName}-${lastName}`;
        if (!usedNames.has(fullKey)) break;
      }
      usedNames.add(fullKey);
      const company = pick(rng, cfg.companies);
      const jobTitle = pick(rng, cfg.jobs);
      const dailyRate = Math.round(randRange(rng, cfg.dailyRateRange[0], cfg.dailyRateRange[1]) / 50) * 50;
      const phoneMid = randInt(rng, 100, 999);
      const phoneEnd = randInt(rng, 10, 99);
      out.push({
        id: uid(),
        ownerUserId: userId,
        firstName,
        lastName,
        company,
        discipline,
        jobTitle,
        phone: `0532 ${phoneMid} ${randInt(rng, 10, 99)} ${phoneEnd}`,
        dailyRate,
        dailyRateCurrency: "TRY",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return out;
}

// ============================================================
// PERSONEL ASSIGNMENTS — hepsi projeye atanmış
// ============================================================
function buildPersonnelAssignments(project: Project, personnel: PersonnelMaster[]): PersonnelAssignment[] {
  return personnel.map((p) => ({
    id: uid(),
    projectId: project.id,
    personnelMasterId: p.id,
    assignedFrom: project.startDate,
    projectSpecificRole: p.jobTitle,
  }));
}

// ============================================================
// PERSONEL PUANTAJ — çan eğrisi (gauss benzeri)
// ============================================================
function headcountForDay(day: number, total: number): number {
  // Gauss: peak gün 60, sigma 25, peak değer 72
  const target = Math.max(10, Math.round(72 * Math.exp(-Math.pow(day - 60, 2) / (2 * 25 * 25))));
  return Math.min(target, total);
}

function buildPersonnelAttendance(
  project: Project,
  personnel: PersonnelMaster[],
  userId: string,
  rng: () => number
): PersonnelAttendance[] {
  const start = new Date(project.startDate);
  const today = project.reportDate;
  const out: PersonnelAttendance[] = [];
  const total = personnel.length;

  for (let day = 1; day <= 120; day++) {
    const d = toISODate(addDays(start, day - 1));
    if (d > today) break;
    const target = headcountForDay(day, total);

    // Disiplin önceliği: inşaat erkenden başlar, elektrik orta-geç başlar, mekanik orta
    // Basit: bugün için kişileri rastgele seç ama disiplin dağılımı project fazına uygun olsun
    const phase = day < 30 ? "early" : day < 80 ? "mid" : "late";
    const eligible = personnel.filter((p) => {
      if (phase === "early") {
        // İnşaat ağırlıklı + mühendislik + idari
        return ["insaat", "muhendislik", "idari", "diger"].includes(p.discipline);
      }
      if (phase === "mid") {
        return true; // hepsi
      }
      // late: elektrik + mekanik + mühendislik ağırlıklı
      return ["elektrik", "mekanik", "muhendislik", "idari"].includes(p.discipline);
    });

    // Shuffle eligible (Fisher-Yates deterministic)
    const arr = [...eligible];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const presentToday = arr.slice(0, target);

    for (const p of presentToday) {
      const hours = Math.random() < 0.92 ? 9 : Math.random() < 0.5 ? 8 : 10;
      out.push({
        id: uid(),
        projectId: project.id,
        personnelMasterId: p.id,
        date: d,
        present: true,
        hours,
        recordedBy: userId,
        recordedAt: new Date().toISOString(),
      });
    }
  }
  return out;
}

// ============================================================
// MAKİNE MASTER + ASSIGNMENTS + PUANTAJ
// ============================================================
function buildMachines(userId: string): MachineMaster[] {
  const now = new Date().toISOString();
  return SAMPLE_MACHINES.map((m) => ({
    id: uid(),
    ownerUserId: userId,
    name: m.name,
    machineType: m.type,
    licensePlate: m.plate === "—" ? undefined : m.plate,
    company: m.company,
    dailyRate: m.dailyRate,
    dailyRateCurrency: "TRY",
    fuelType: m.fuel,
    status: "active",
    createdAt: now,
    updatedAt: now,
  }));
}

function buildMachineAssignments(project: Project, machines: MachineMaster[]): MachineAssignment[] {
  return machines.map((m) => ({
    id: uid(),
    projectId: project.id,
    machineMasterId: m.id,
    assignedFrom: project.startDate,
  }));
}

function buildMachineAttendance(
  project: Project,
  machines: MachineMaster[],
  userId: string,
  rng: () => number
): MachineAttendance[] {
  const start = new Date(project.startDate);
  const today = project.reportDate;
  const out: MachineAttendance[] = [];

  // Makine aktif gün/tip:
  // ekskavator/loder/kamyon/silindir: erken-mid faz (gün 1-60)
  // vinç/forklift: mid-late (gün 30-110)
  // jeneratör: tüm proje boyunca
  const machinePhase: Record<string, { start: number; end: number; probability: number }> = {
    ekskavator: { start: 1, end: 60, probability: 0.85 },
    loder:      { start: 1, end: 70, probability: 0.7 },
    kamyon:     { start: 1, end: 90, probability: 0.65 },
    silindir:   { start: 15, end: 50, probability: 0.6 },
    greyder:    { start: 10, end: 40, probability: 0.5 },
    vinc:       { start: 30, end: 110, probability: 0.75 },
    forklift:   { start: 40, end: 110, probability: 0.7 },
    jenerator:  { start: 1, end: 120, probability: 0.95 },
    diger:      { start: 1, end: 120, probability: 0.5 },
  };

  for (let day = 1; day <= 120; day++) {
    const d = toISODate(addDays(start, day - 1));
    if (d > today) break;
    for (const m of machines) {
      const phase = machinePhase[m.machineType] || { start: 1, end: 120, probability: 0.5 };
      if (day < phase.start || day > phase.end) continue;
      if (rng() > phase.probability) continue;
      const hours = randInt(rng, 6, 10);
      const fuel = randInt(rng, 50, 180);
      out.push({
        id: uid(),
        projectId: project.id,
        machineMasterId: m.id,
        date: d,
        present: true,
        hours,
        fuelConsumed: fuel,
        recordedBy: userId,
        recordedAt: new Date().toISOString(),
      });
    }
  }
  return out;
}

// ============================================================
// DAILY REPORTS — son 7 gün
// ============================================================
function buildDailyReports(project: Project, userId: string, rng: () => number): DailyReport[] {
  const today = new Date(project.reportDate);
  const summaries = [
    "Taşıyıcı sistem montajı kuzey blokta devam etti. Kiriş montajı blok 3-A tamamlandı. Mıcır serme blok 5'te başladı.",
    "Panel dağıtımı blok 2-B'de tamamlandı. DC kablo çekimi blok 1'de %60 seviyesinde. AC kanal açılması blok 4'te başladı.",
    "Trafo merkezi temel betonu döküldü. Topraklama şerit çekimi blok 5'te tamamlandı. Hücre sevkiyatı geldi.",
    "Panel montajı 2 ekiple paralel ilerliyor. Bugün 480 panel monte edildi. Bobin montaj ekibi blok 3'e geçti.",
    "DC kablo testleri blok 1-A için tamamlandı. Cold commissioning hazırlık çalışmaları başladı. İSG denetimi yapıldı, eksik tespit edilmedi.",
    "Telçit örme çalışmaları kuzey sınırda tamamlandı. Şantiye yolları üzerinde mıcır takviyesi yapıldı. Bekleme alanında düzenleme.",
    "İşveren saha denetimi gerçekleşti. Tespit edilen 3 küçük revizyon listeye alındı. Genel ilerleme onaylandı.",
  ];
  const issues = [
    "Sabah ışıklarının ardından makine arızası, 2 saat işçilik kaybı yaşandı.",
    "Tedarikçi sevkiyatında 1 gün gecikme bildirildi.",
    "",
    "Kuvvetli rüzgar nedeniyle vinç çalışması öğleden sonra durdu.",
    "",
    "Yağmurlu hava nedeniyle sıvılaştırma işlemi ertelendi.",
    "",
  ];
  const tomorrowPlans = [
    "Panel montajına 3. ekip eklenecek. DC kablo çekimi blok 2'ye geçecek.",
    "Topraklama testi yapılacak. OG hücre montajı başlayacak.",
    "Pano montajı başlayacak. Pano sevkiyatı tamamlanacak.",
    "Trafo nakliye ve yerleştirme planlandı. Vinç hazır.",
    "DC sistem testi ve sertifikasyon başlanacak.",
    "Hot commissioning hazırlığı. SCADA bağlantısı.",
    "Devreye alma testleri devam edecek. PMI testleri yapılacak.",
  ];
  const weathers = ["Güneşli", "Parçalı Bulutlu", "Açık", "Bulutlu", "Az Bulutlu"];

  const out: DailyReport[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = toISODate(addDays(today, -i));
    const idx = 6 - i;
    out.push({
      id: uid(),
      projectId: project.id,
      reportDate: date,
      weather: pick(rng, weathers),
      temperatureMin: randInt(rng, 12, 18),
      temperatureMax: randInt(rng, 22, 30),
      weatherAutoFetched: true,
      workStopped: false,
      summary: summaries[idx],
      issues: issues[idx] || undefined,
      tomorrowPlan: tomorrowPlans[idx],
      photos: [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return out;
}

// ============================================================
// PROCUREMENT
// ============================================================
function buildProcurement(project: Project): ProcurementItem[] {
  const start = new Date(project.startDate);
  const day = (n: number) => toISODate(addDays(start, n));

  type Item = Omit<ProcurementItem, "id" | "projectId">;
  const list: Item[] = [
    // 1. Solar Panel — TESLİM (kritik)
    {
      category: "Solar Panel",
      material: "JA Solar JAM72S30 540W",
      supplier: "JA Solar Türkiye Distribütörü",
      quantity: 20000,
      unit: "adet",
      unitPrice: 110,
      currency: "USD",
      status: "teslim",
      isCritical: true,
      rfqStartDate: day(1),
      rfqEndDate: day(10),
      plannedPoDate: day(15),
      plannedExwDate: day(35),
      plannedDeliveryDate: day(45),
      actualPoDate: day(15),
      actualExwDate: day(36),
      actualDeliveredDate: day(44),
      actualQuantity: 20000,
      actualUnitPrice: 112,
      actualCurrency: "USD",
    },
    // 2. İnverter — TESLİM (kritik)
    {
      category: "İnverter",
      material: "Huawei SUN2000-215KTL",
      supplier: "Huawei Türkiye",
      quantity: 50,
      unit: "adet",
      unitPrice: 9_000,
      currency: "USD",
      status: "teslim",
      isCritical: true,
      rfqStartDate: day(3),
      rfqEndDate: day(13),
      plannedPoDate: day(18),
      plannedExwDate: day(40),
      plannedDeliveryDate: day(48),
      actualPoDate: day(20),
      actualExwDate: day(42),
      actualDeliveredDate: day(50),
      actualQuantity: 50,
      actualUnitPrice: 8_900,
      actualCurrency: "USD",
    },
    // 3. Taşıyıcı Sistem — TESLİM
    {
      category: "Taşıyıcı Sistem",
      material: "Galvanizli sabit eğimli konstrüksiyon (kolon+kiriş+aşık)",
      supplier: "Schletter Türkiye",
      quantity: 24000,
      unit: "adet",
      unitPrice: 25,
      currency: "USD",
      status: "teslim",
      rfqStartDate: day(1),
      rfqEndDate: day(10),
      plannedPoDate: day(15),
      plannedExwDate: day(32),
      plannedDeliveryDate: day(40),
      actualPoDate: day(16),
      actualExwDate: day(34),
      actualDeliveredDate: day(42),
      actualQuantity: 24000,
      actualUnitPrice: 25.5,
      actualCurrency: "USD",
    },
    // 4. DC Kablo — TESLİM
    {
      category: "DC Kablo",
      material: "DC Solar kablo 1500V 6mm² + 4mm²",
      supplier: "HES Kablo",
      quantity: 60000,
      unit: "m",
      unitPrice: 3,
      currency: "USD",
      status: "teslim",
      rfqStartDate: day(5),
      rfqEndDate: day(15),
      plannedPoDate: day(20),
      plannedExwDate: day(42),
      plannedDeliveryDate: day(50),
      actualPoDate: day(22),
      actualExwDate: day(41),
      actualDeliveredDate: day(49),
      actualQuantity: 60000,
      actualUnitPrice: 3,
      actualCurrency: "USD",
    },
    // 5. Trafo — YOLDA (kritik)
    {
      category: "Trafo",
      material: "1.6 MVA Yağlı Dağıtım Trafosu",
      supplier: "BEST Trafo",
      quantity: 3,
      unit: "adet",
      unitPrice: 35_000,
      currency: "USD",
      status: "yolda",
      isCritical: true,
      rfqStartDate: day(10),
      rfqEndDate: day(20),
      plannedPoDate: day(25),
      plannedExwDate: day(65),
      plannedDeliveryDate: day(75),
      actualPoDate: day(26),
      actualExwDate: day(66),
    },
    // 6. OG Hücre — YOLDA (kritik)
    {
      category: "OG Hücre",
      material: "36kV SF6 OG Hücre",
      supplier: "ABB Türkiye",
      quantity: 14,
      unit: "adet",
      unitPrice: 4_000,
      currency: "USD",
      status: "yolda",
      isCritical: true,
      rfqStartDate: day(10),
      rfqEndDate: day(20),
      plannedPoDate: day(25),
      plannedExwDate: day(70),
      plannedDeliveryDate: day(80),
      actualPoDate: day(27),
      actualExwDate: day(71),
    },
    // 7. AC/MV Kablo — SİPARİŞ
    {
      category: "AC/MV Kablo",
      material: "33kV NA2XSY 3×95 mm² MV Kablo",
      supplier: "Türk Prysmian Kablo",
      quantity: 8000,
      unit: "m",
      unitPrice: 22,
      currency: "USD",
      status: "siparis",
      rfqStartDate: day(15),
      rfqEndDate: day(25),
      plannedPoDate: day(30),
      plannedExwDate: day(60),
      plannedDeliveryDate: day(70),
      actualPoDate: day(31),
    },
    // 8. Pano — SİPARİŞ
    {
      category: "Pano",
      material: "AC Birleşme Pano + DC Birleşme Pano",
      supplier: "Mitaş Pano Sistemleri",
      quantity: 24,
      unit: "adet",
      unitPrice: 2_800,
      currency: "USD",
      status: "siparis",
      rfqStartDate: day(15),
      rfqEndDate: day(25),
      plannedPoDate: day(30),
      plannedExwDate: day(55),
      plannedDeliveryDate: day(65),
      actualPoDate: day(32),
    },
  ];
  return list.map((it) => ({ id: uid(), projectId: project.id, ...it }));
}

// ============================================================
// LOOKAHEAD (15-Gün Kritik)
// ============================================================
function buildLookahead(project: Project): LookaheadItem[] {
  const today = new Date(project.reportDate);
  type LK = "kritik_is" | "claim" | "tutanak" | "yazisma" | "ihbar";
  const list: Array<{ task: string; daysAhead: number; priority: Priority; owner: string; notes?: string; kind: LK }> = [
    { task: "Trafo merkezi temel beton dökümü", daysAhead: 2, priority: "high", owner: "Hasan Yılmaz", kind: "kritik_is" },
    { task: "Pano sevkiyat tesellümü", daysAhead: 3, priority: "high", owner: "Mehmet Demir", kind: "kritik_is" },
    { task: "Hava muhalefeti — 2 gün iş kaybı tutanağı", daysAhead: -2, priority: "medium", owner: "Şantiye Şefi", kind: "tutanak", notes: "16-17 Nisan günleri yağmur nedeniyle saha çalışması durdu" },
    { task: "Telçit örme batı bölümü bitirilmesi", daysAhead: 5, priority: "medium", owner: "Selim Aksoy", kind: "kritik_is" },
    { task: "İşverene gönderilecek hakediş ekibi yazısı", daysAhead: 1, priority: "medium", owner: "Şantiye Şefi", kind: "yazisma" },
    { task: "DC kablo çekimi blok-2 tamamlanması", daysAhead: 7, priority: "high", owner: "Mehmet Demir", kind: "kritik_is" },
    { task: "İşveren saha denetimi", daysAhead: 8, priority: "high", owner: "Şantiye Şefi", kind: "kritik_is" },
    { task: "Saha tesviye fazla maliyet claim'i", daysAhead: 4, priority: "high", owner: "Şantiye Şefi", kind: "claim", notes: "Beklenmedik kayalık zemin — 18.000 m³ ek hafriyat" },
    { task: "Trafo montaj çalışması başlangıcı", daysAhead: 10, priority: "critical", owner: "Murat Yıldız", kind: "kritik_is" },
    { task: "Süre uzatımı ihbarı (15 günlük)", daysAhead: 6, priority: "high", owner: "Şantiye Şefi", kind: "ihbar", notes: "Hava muhalefeti + tedarikçi gecikmesi nedeniyle" },
    { task: "OG hücre devreye alma testi", daysAhead: 11, priority: "critical", owner: "Mehmet Demir", kind: "kritik_is", notes: "Kalibrasyon ekipmanı önceden hazırlanmalı" },
    { task: "DC sistem yalıtım direnci testi", daysAhead: 14, priority: "critical", owner: "Mehmet Demir", kind: "kritik_is" },
  ];
  return list.map((it) => ({
    id: uid(),
    projectId: project.id,
    task: it.task,
    date: toISODate(addDays(today, it.daysAhead)),
    priority: it.priority,
    owner: it.owner,
    done: false,
    notes: it.notes,
    kind: it.kind,
  }));
}

// ============================================================
// BUDGET (kategoriler + actuals)
// ============================================================
function buildBudgets(project: Project, userId: string, rng: () => number): { cats: BudgetCategory[]; actuals: BudgetActual[] } {
  const start = new Date(project.startDate);
  const cats: BudgetCategory[] = BUDGET_CATEGORIES.map((c, i) => ({
    id: uid(),
    projectId: project.id,
    name: c.name,
    plannedAmount: c.amount,
    currency: "USD",
    linkedWbsCodes: c.linkedWbs,
    sortOrder: i,
  }));

  // Actuals: her kategori için planlanın %50-80'i gerçekleşmiş
  const actuals: BudgetActual[] = [];
  for (const cat of cats) {
    const realizedFactor = randRange(rng, 0.45, 0.85);
    const totalReal = cat.plannedAmount * realizedFactor;
    // 3-5 actual entry, tarihler farklı
    const n = randInt(rng, 3, 5);
    const portions = Array.from({ length: n }, () => rng());
    const sum = portions.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      const amount = Math.round((portions[i] / sum) * totalReal);
      const dayOffset = randInt(rng, 5, 55);
      actuals.push({
        id: uid(),
        projectId: project.id,
        categoryId: cat.id,
        date: toISODate(addDays(start, dayOffset)),
        amount,
        currency: "USD",
        amountInProjectCurrency: amount, // proje currency USD ile aynı
        description: `${cat.name} — gerçekleşme #${i + 1}`,
        recordedBy: userId,
        recordedAt: new Date().toISOString(),
      });
    }
  }
  return { cats, actuals };
}

// ============================================================
// SUBCONTRACTORS
// ============================================================
function buildSubcontractors(project: Project): Subcontractor[] {
  const start = new Date(project.startDate);
  const now = new Date().toISOString();
  return SAMPLE_SUBCONTRACTORS.map((sc) => ({
    id: uid(),
    projectId: project.id,
    name: sc.name,
    taxNo: undefined,
    contactName: sc.contactName,
    phone: sc.phone,
    scopeOfWork: sc.scopeOfWork,
    discipline: sc.discipline,
    contractAmount: sc.contractAmount,
    currency: "USD",
    contractDate: toISODate(addDays(start, -3)),
    startDate: toISODate(addDays(start, 5)),
    endDate: toISODate(addDays(start, 115)),
    status: "aktif",
    notes: undefined,
    createdAt: now,
    updatedAt: now,
  }));
}

// ============================================================
// BILLING (Owner hakediş + Sub fatura)
// ============================================================
function buildBilling(project: Project, subcontractors: Subcontractor[], rng: () => number): BillingItem[] {
  const start = new Date(project.startDate);
  const out: BillingItem[] = [];

  // Owner — 3 hakediş (Mart, Nisan, Mayıs)
  const ownerInvoices: Array<{ desc: string; amount: number; offset: number; status: BillingItem["status"]; paidOffset?: number; invoiceNo: string }> = [
    { desc: "Hakediş No.1 — Mobilizasyon & Saha Hazırlık", amount: 850_000, offset: 25, status: "odendi", paidOffset: 45, invoiceNo: "K-2026/0312" },
    { desc: "Hakediş No.2 — Temel & Taşıyıcı Sistem", amount: 1_350_000, offset: 50, status: "odendi", paidOffset: 58, invoiceNo: "K-2026/0421" },
    { desc: "Hakediş No.3 — Panel Montajı & Kablolama", amount: 980_000, offset: 58, status: "gonderildi", invoiceNo: "K-2026/0506" },
  ];
  for (const o of ownerInvoices) {
    out.push({
      id: uid(),
      projectId: project.id,
      direction: "owner_incoming",
      invoiceNo: o.invoiceNo,
      description: o.desc,
      amount: o.amount,
      currency: "USD",
      issueDate: toISODate(addDays(start, o.offset)),
      dueDate: toISODate(addDays(start, o.offset + 30)),
      paidDate: o.paidOffset != null ? toISODate(addDays(start, o.paidOffset)) : undefined,
      status: o.status,
    });
  }

  // Her subcontractor için 1-2 fatura
  for (const sc of subcontractors) {
    const ratio = randRange(rng, 0.35, 0.6);
    const totalInvoiced = sc.contractAmount * ratio;
    const splitN = sc.contractAmount > 500_000 ? 2 : 1;
    for (let i = 0; i < splitN; i++) {
      const amount = Math.round(totalInvoiced / splitN);
      const offset = randInt(rng, 30, 55);
      const isPaid = i === 0 || rng() > 0.5;
      out.push({
        id: uid(),
        projectId: project.id,
        direction: "subcontractor_outgoing",
        subcontractorId: sc.id,
        invoiceNo: `${sc.name.split(" ")[0].toUpperCase()}-2026/${String(i + 1).padStart(3, "0")}`,
        description: `${sc.scopeOfWork} — ara hakediş ${i + 1}`,
        amount,
        currency: "USD",
        issueDate: toISODate(addDays(start, offset)),
        dueDate: toISODate(addDays(start, offset + 45)),
        paidDate: isPaid ? toISODate(addDays(start, offset + 30)) : undefined,
        status: isPaid ? "odendi" : "gonderildi",
      });
    }
  }
  return out;
}

// ============================================================
// PAYLOAD — sadece data hesaplar, state'e dokunmaz
// (store içinden de UI'dan da çağrılabilir, sirküler import yok)
// ============================================================
export function buildSamplePayload(userId: string): SamplePayload {
  const rng = makeRng(424242);   // deterministic

  const project = buildProject(userId);
  const wbs = buildWbs(project);
  const planned = buildPlanned(project, wbs);
  const realized = buildRealized(project, planned, rng);
  const personnel = buildPersonnel(userId, rng);
  const personnelAssignments = buildPersonnelAssignments(project, personnel);
  const personnelAttendance = buildPersonnelAttendance(project, personnel, userId, rng);
  const machines = buildMachines(userId);
  const machineAssignments = buildMachineAssignments(project, machines);
  const machineAttendance = buildMachineAttendance(project, machines, userId, rng);
  const dailyReports = buildDailyReports(project, userId, rng);
  const procurement = buildProcurement(project);
  const lookahead = buildLookahead(project);
  const { cats: budgetCategories, actuals: budgetActuals } = buildBudgets(project, userId, rng);
  const subcontractors = buildSubcontractors(project);
  const billing = buildBilling(project, subcontractors, rng);

  const member: ProjectMember = {
    id: uid(),
    projectId: project.id,
    userId,
    role: "project_manager",
    invitedBy: userId,
    invitedAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
  };

  return {
    project,
    member,
    wbs,
    planned,
    realized,
    personnel,
    personnelAssignments,
    personnelAttendance,
    machines,
    machineAssignments,
    machineAttendance,
    dailyReports,
    procurement,
    lookahead,
    budgetCategories,
    budgetActuals,
    subcontractors,
    billing,
  };
}

// ============================================================
// UI helper — payload + state mutation (Projeler sayfası butonu için)
// ============================================================
export function loadSampleProject(userId: string): { projectId: string } {
  const p = buildSamplePayload(userId);
  useStore.setState((s) => ({
    projects: [...s.projects, p.project],
    currentProjectId: p.project.id,
    members: [...s.members, p.member],
    wbs: [...s.wbs, ...p.wbs],
    planned: { ...s.planned, [p.project.id]: p.planned },
    realized: { ...s.realized, [p.project.id]: p.realized },
    personnelMaster: [...s.personnelMaster, ...p.personnel],
    personnelAssignments: [...s.personnelAssignments, ...p.personnelAssignments],
    personnelAttendance: [...s.personnelAttendance, ...p.personnelAttendance],
    machinesMaster: [...s.machinesMaster, ...p.machines],
    machineAssignments: [...s.machineAssignments, ...p.machineAssignments],
    machineAttendance: [...s.machineAttendance, ...p.machineAttendance],
    dailyReports: [...s.dailyReports, ...p.dailyReports],
    procurement: [...s.procurement, ...p.procurement],
    lookahead: [...s.lookahead, ...p.lookahead],
    budgetCategories: [...s.budgetCategories, ...p.budgetCategories],
    budgetActuals: [...s.budgetActuals, ...p.budgetActuals],
    subcontractors: [...s.subcontractors, ...p.subcontractors],
    billing: [...s.billing, ...p.billing],
  }));
  return { projectId: p.project.id };
}
