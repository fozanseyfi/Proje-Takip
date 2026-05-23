import type { Currency } from "@/lib/utils";

export type Role = "super_admin" | "project_manager" | "field_engineer" | "viewer";

export type Discipline = "mekanik" | "elektrik" | "insaat" | "muhendislik" | "idari" | "diger";

export type MachineType =
  | "ekskavator"
  | "kamyon"
  | "vinc"
  | "forklift"
  | "loder"
  | "greyder"
  | "silindir"
  | "jenerator"
  | "diger";

export type FuelType = "dizel" | "benzin" | "elektrik" | "diger";

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export type Priority = "low" | "medium" | "high" | "critical";

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  wbsNo: string;
  startDate: string;       // ISO
  durationDays: number;
  plannedEnd: string;      // ISO
  contractEnd: string;     // ISO
  reportDate: string;      // ISO
  installedCapacityMw?: number | null;
  totalBudget?: number | null;
  budgetCurrency: Currency;
  status: ProjectStatus;
  /** Panel sahibi / ana yüklenici firma adı — işverenle sözleşmesi olan tarafımız.
   *  Hiçbir alt yüklenici listesinde gözükmez ama personel/makine ekleme şirket
   *  seçicisinde her zaman seçilebilir olur. */
  mainContractorName?: string;
  /** Yatırımcı (işveren) firma adı — projenin sahibi. */
  investorName?: string;
  publicShareToken?: string | null;
  publicShareExpiresAt?: string | null;
  /** Demo/örnek proje — UI'da banner gösterilir, tüm yazma aksiyonları no-op. */
  isDemo?: boolean;
  createdBy: string;       // userId
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: Role;
  invitedBy: string;
  invitedAt: string;
  acceptedAt?: string | null;
}

export interface Invitation {
  id: string;
  projectId: string;
  email: string;
  role: Role;
  token: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
}

/** İlişki tipi:
 * - FS: Finish→Start (A bitince B başlar)
 * - SS: Start→Start (A başlayınca B başlar)
 * - FF: Finish→Finish (A bitince B biter)
 */
export type PredecessorType = "FS" | "SS" | "FF";

export interface PredecessorLink {
  wbsCode: string;   // bağlanılan öncül kalemin kodu
  type: PredecessorType;
  lagDays: number;   // + öteleme / − ön çekim
  /** Lag birimi:
   *  - "calendar"  → Takvim günü (Cmt/Pz dahil, default)
   *  - "work"      → Cumartesi-Pazar hariç (5 günlük iş haftası)
   *  - "no-sunday" → Pazar hariç (6 günlük iş haftası, Cmt çalışılır)
   */
  lagUnit?: "calendar" | "work" | "no-sunday";
}

/**
 * Aktivite tipi (PMP standart):
 * - "work" (default): ölçülebilir iş. Miktar × birim. Gün-gün dağıtılır.
 * - "milestone": tek tarih olayı (sözleşme imzası, izin, test başladı). 0% veya 100%.
 *
 * Boş bırakılırsa "work" varsayılır (eski kayıtlarla geriye uyum).
 */
export type ActivityType = "work" | "milestone";

export interface WbsItem {
  id: string;
  projectId: string;
  code: string;
  name: string;
  level: 0 | 1 | 2 | 3;
  parentCode?: string;
  isLeaf: boolean;
  weight: number;
  quantity: number;
  unit: string;
  discipline?: Discipline;
  /** Aktivite tipi — work (default) veya milestone. */
  activityType?: ActivityType;
  /** Milestone için planlanan tek tarih. */
  milestoneDate?: string;
  /** Milestone için gerçekleşme tarihi (yapıldıysa). */
  milestoneCompletedAt?: string;
  /**
   * PMP "Estimate Activity Durations" — tahmini süre (çalışma günü).
   * Planlama sihirbazı default başlangıç değeri olarak bu alanı kullanır.
   * Boş ise sihirbaz kendi tahmin eder (miktar tabanlı veya 10 gün).
   */
  estimatedDurationDays?: number;
  /**
   * Bu aktivitenin çalışma haftası şablonu:
   * - "mon-fri" → Pzt-Cum (Cmt/Pz kapalı)
   * - "mon-sat" → Pzt-Cmt (Pz kapalı, Cmt açık)
   * - "mon-sun" → Pzt-Pz (her gün açık)
   * Sihirbaz açılırken default Cmt/Pz seçimini bu alanı baz alarak set eder.
   */
  workweek?: "mon-fri" | "mon-sat" | "mon-sun";
  /**
   * Zamanlama tipi:
   * - "asap" (default) → forward pass (earliestStart) ile en erken konuma yerleşir.
   * - "alap"           → backward pass (latestStart) ile projeyi geciktirmeden
   *                      en geç konuma yerleşir. Tedarik / commissioning gibi
   *                      geç yapılması doğru olan kalemler için.
   * Boş bırakılırsa "asap" kabul edilir.
   */
  scheduleType?: "asap" | "alap";
  plannedStart?: string;
  plannedEnd?: string;
  realizedStart?: string;
  realizedEnd?: string;
  /** Öncüllükler — bu kalemin bağlı olduğu önceki kalemler. */
  predecessors?: PredecessorLink[];
  deletedAt?: string | null;
}

// Planning & Realization: { [code]: { [isoDate]: quantity } }
export type DateQuantityMap = Record<string, Record<string, number>>;

export interface PersonnelMaster {
  id: string;
  ownerUserId: string;
  firstName: string;
  lastName: string;
  tcKimlikNo?: string;
  company: string;
  discipline: Discipline;
  jobTitle?: string;
  phone?: string;
  startDate?: string;       // İşe giriş tarihi (firmaya)
  terminationDate?: string; // İşten çıkış tarihi (boşsa hala çalışıyor)
  dailyRate?: number;
  dailyRateCurrency?: Currency;
  status: "active" | "inactive";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface MachineMaster {
  id: string;
  ownerUserId: string;
  name: string;
  machineType: MachineType;
  licensePlate?: string;
  company: string;
  /** Operatör — PersonnelMaster.id'sine bağlı. Personel listesinden seçilir. */
  operatorPersonnelId?: string;
  /** İş başı tarihi — sahaya/firmaya giriş. */
  startDate?: string;
  /** Ayrıldığı tarih — boşsa hâlâ aktif. */
  terminationDate?: string;
  dailyRate?: number;
  dailyRateCurrency?: Currency;
  fuelType?: FuelType;
  status: "active" | "inactive";
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PersonnelAssignment {
  id: string;
  projectId: string;
  personnelMasterId: string;
  assignedFrom: string;
  assignedTo?: string | null;
  projectSpecificRole?: string;
}

export interface MachineAssignment {
  id: string;
  projectId: string;
  machineMasterId: string;
  assignedFrom: string;
  assignedTo?: string | null;
}

export interface PersonnelAttendance {
  id: string;
  projectId: string;
  personnelMasterId: string;
  date: string;
  present: boolean;
  hours: number;
  /** Raporlu (sick leave): "A" olarak gösterilir, biz ödüyormuş gibi tam yevmiye sayılır. */
  status?: "rapor";
  location?: string;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface MachineAttendance {
  id: string;
  projectId: string;
  machineMasterId: string;
  date: string;
  present: boolean;
  hours: number;
  fuelConsumed?: number;
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface DailyReport {
  id: string;
  projectId: string;
  reportDate: string;
  weather?: string;
  temperatureMin?: number;
  temperatureMax?: number;
  weatherAutoFetched?: boolean;
  workStopped: boolean;
  workStoppedReason?: string;
  summary: string;
  issues?: string;
  tomorrowPlan?: string;
  photos: { url: string; caption?: string; uploadedAt: string }[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementItem {
  id: string;
  projectId: string;
  category: string;
  material: string;
  supplier?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  currency: Currency;
  status: "talep" | "siparis" | "yolda" | "teslim" | "iade";
  notes?: string;

  /** Kritik malzeme bayrağı — dashboard procurement follow-up'ta sürekli görünür */
  isCritical?: boolean;

  // === Planlanan tarihler ===
  /** Teklif Toplama Başlangıç (RFQ start) */
  rfqStartDate?: string;
  /** Teklif Toplama Bitiş (RFQ end / vendor selection) */
  rfqEndDate?: string;
  /** Planlanan Satın Alma Siparişi (PO) tarihi */
  plannedPoDate?: string;
  /** Planlanan EXW Tarihi (fabrika çıkış / hazır olma) */
  plannedExwDate?: string;
  /** Planlanan Teslimat Tarihi (sahaya geliş) */
  plannedDeliveryDate?: string;

  // === Gerçekleşen ===
  /** Gerçek PO tarihi */
  actualPoDate?: string;
  /** Gerçek EXW tarihi */
  actualExwDate?: string;
  /** Gerçek teslim tarihi */
  actualDeliveredDate?: string;
  /** Gerçek miktar (planın altında/üstünde olabilir) */
  actualQuantity?: number;
  /** Gerçek birim fiyat */
  actualUnitPrice?: number;
  /** Gerçek para birimi (genelde aynı, kur değişebilir) */
  actualCurrency?: Currency;
  /** Gerçekleşme notu */
  actualNotes?: string;

  // === Legacy (eski sample data için) — UI'da yenilere fallback yapılır ===
  /** @deprecated plannedPoDate kullanın */
  orderDate?: string;
  /** @deprecated plannedDeliveryDate kullanın */
  expectedDate?: string;
  /** @deprecated actualDeliveredDate kullanın */
  deliveredDate?: string;
}

/**
 * Fatura — iki yönlü:
 * - `owner_incoming`: işverene biz hakediş kestik (gelir)
 * - `subcontractor_outgoing`: alt yükleniciden bize fatura geldi (gider)
 */
export type BillingDirection = "owner_incoming" | "subcontractor_outgoing";

export interface BillingItem {
  id: string;
  projectId: string;
  direction: BillingDirection;
  subcontractorId?: string;          // sadece subcontractor_outgoing için
  invoiceNo?: string;
  description: string;
  amount: number;
  currency: Currency;
  issueDate: string;
  dueDate?: string;
  paidDate?: string;
  status: "taslak" | "gonderildi" | "kismi" | "odendi" | "iptal";
  notes?: string;
}

/**
 * Hakediş planı — işveren ya da alt yüklenici için tek bir taksit.
 * direction === "owner_incoming" → işverenden alacağımız (proje bazlı, subcontractorId boş)
 * direction === "subcontractor_outgoing" → alt yükleniciye ödenecek (subcontractorId zorunlu)
 *
 * status:
 * - planned: henüz fatura/ödeme yapılmadı (tarih geçtiyse "gecikmiş" sayılır — UI'da hesaplanır)
 * - realized: tam tutar gerçekleşti (fatura kesildi / alındı)
 * - partial: kısmi gerçekleşti
 * - cancelled: iptal edildi
 */
export type PaymentMilestoneStatus = "planned" | "realized" | "partial" | "cancelled";

/**
 * Bir hakedişe bağlı tek bir ödeme kaydı.
 * Kısmi ödemeler için bir hakediş altında birden çok kayıt olabilir.
 */
export interface PaymentEntry {
  id: string;
  date: string;
  amount: number;
  /** Bağlı fatura (varsa) — faturadan çekilen ödeme. */
  billingItemId?: string;
  notes?: string;
  recordedAt: string;
}

export interface PaymentMilestone {
  id: string;
  projectId: string;
  direction: BillingDirection;
  subcontractorId?: string;       // sadece subcontractor_outgoing için
  sequenceNo: number;             // 1, 2, 3 ...
  description: string;            // "Hakediş No.1 — Mart 2026"
  plannedDate: string;            // ISO
  plannedAmount: number;
  currency: Currency;
  status: PaymentMilestoneStatus;
  /** Ödeme defteri — kısmi/tam tüm ödeme kayıtları (kronolojik). */
  payments?: PaymentEntry[];
  /** Toplam alınan (payments.amount toplamı) — UI için önbellek. */
  actualAmount?: number;
  /** Son ödeme tarihi — UI için önbellek (eski kayıtlar için uyumluluk alanı). */
  actualDate?: string;
  billingItemId?: string;         // ilişkili fatura (varsa)
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Alt yüklenici (subcontractor) — proje bazlı sözleşme.
 */
export interface Subcontractor {
  id: string;
  projectId: string;
  name: string;                  // firma adı
  taxNo?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  scopeOfWork: string;           // iş kapsamı kısa açıklama
  discipline?: Discipline;
  contractAmount: number;        // sözleşme tutarı
  currency: Currency;
  contractDate: string;          // sözleşme tarihi
  startDate?: string;
  endDate?: string;              // planlanan bitiş
  status: "aktif" | "tamamlandi" | "iptal" | "askida";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetCategory {
  id: string;
  projectId: string;
  name: string;
  plannedAmount: number;
  currency: Currency;
  linkedWbsCodes?: string[];
  sortOrder: number;
}

export interface BudgetActual {
  id: string;
  projectId: string;
  categoryId: string;
  date: string;
  amount: number;
  currency: Currency;
  amountInProjectCurrency?: number;
  description?: string;
  invoiceRef?: string;
  recordedBy: string;
  recordedAt: string;
}

export type LookaheadKind = "kritik_is" | "claim" | "tutanak" | "yazisma" | "ihbar";

export interface LookaheadItem {
  id: string;
  projectId: string;
  task: string;
  date: string;
  priority: Priority;
  owner?: string;
  done: boolean;
  notes?: string;
  /** Tip: kritik iş / claim / tutanak / yazışma / ihbar */
  kind?: LookaheadKind;
}

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  projectId?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

// ============================================================
// Teslim Alma (GES Commissioning Checklist)
// ============================================================

/**
 * Bir checklist maddesinin durumu:
 * - "pending": henüz cevaplanmadı
 * - "ok":      uygun (✓)
 * - "fail":    uygun değil (✗) — Major NCR'a girer
 * - "conditional": şartlı uygun (◐) — Punch-list'e girer, şart belirtilmeli
 */
export type TeslimAlmaStatus = "pending" | "ok" | "fail" | "conditional";

/**
 * Tek bir maddenin yanıt kaydı.
 */
export interface TeslimAlmaItemResult {
  status: TeslimAlmaStatus;
  /** Şartlı (conditional) seçildiğinde gerekli — şartın açıklaması. */
  condition?: string;
  /** Opsiyonel ek açıklama / eksik/hata detayı. */
  note?: string;
  /** Son güncelleme zamanı (ISO). */
  updatedAt: string;
}

/**
 * Bir rapor için genel proje + denetim üst-bilgileri.
 * `inspectionDate` otomatik = bugün; `inspectorName` = currentUser.fullName.
 * Diğer alanlar manuel doldurulur.
 */
export interface TeslimAlmaMeta {
  inspectorName?: string;
  inspectorTitle?: string;
  ownerRepName?: string;
  ownerRepTitle?: string;
  epcRepName?: string;
  epcRepTitle?: string;
  inspectionDate: string;
  /** Genel karar: tüm cevaplar değerlendirildikten sonra denetleyenin nihai kararı. */
  overallDecision?: "approved" | "rejected" | "conditional";
  generalNotes?: string;
  /** Saha bilgileri (PDF'in PROJE BİLGİLERİ bölümüne girer; projeden de türetilebilir). */
  dcCapacityKwp?: number;
  acCapacityKwe?: number;
  panelBrandModel?: string;
  panelCount?: number;
  inverterBrandModel?: string;
  inverterCount?: number;
  epcContractor?: string;
}

/**
 * Bir proje için saha denetim / teslim alma raporu (tek kayıt).
 * `items[itemId]` ile maddelere erişilir; bilinmeyen itemId → "pending" varsayılır.
 */
export interface TeslimAlmaReport {
  projectId: string;
  meta: TeslimAlmaMeta;
  /** itemId → result. Mevcut olmayan id'ler "pending" varsayılır. */
  items: Record<string, TeslimAlmaItemResult>;
  createdAt: string;
  updatedAt: string;
}
