"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  User,
  Project,
  ProjectMember,
  Invitation,
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
  BillingItem,
  BudgetCategory,
  BudgetActual,
  LookaheadItem,
  AuditEntry,
  NotificationItem,
  Role,
  Subcontractor,
  PaymentMilestone,
  PaymentEntry,
  PaymentMilestoneStatus,
  TeslimAlmaReport,
  TeslimAlmaMeta,
  TeslimAlmaItemResult,
  TeslimAlmaStatus,
} from "./types";
import { DEFAULT_WBS, type WbsTemplateItem } from "@/lib/data/default-wbs";
import { uid, toISODate } from "@/lib/utils";
// Sample seed kaldırıldı (2026-05-23) — Ankara Polatlı GES örnek projesi artık
// yüklenmez. Yeni kullanıcılar boş bir workspace ile başlar; gerçek proje açar.
// sample-loader.ts ve sample-pools.ts dosyaları da repo'dan silindi.

// ============================================================
// State shape
// ============================================================
export interface StoreState {
  // Auth
  currentUserId: string | null;
  users: User[];

  // Multi-project
  projects: Project[];
  currentProjectId: string | null;
  members: ProjectMember[];
  invitations: Invitation[];

  // Per-project iş verileri
  wbs: WbsItem[];
  planned: Record<string, DateQuantityMap>;   // { projectId: { code: { date: qty } } }
  realized: Record<string, DateQuantityMap>;
  /** Baseline (PMP) — onaylanmış orijinal plan. Her sihirbaz kaydında ilk seferde otomatik
   *  set edilir; kullanıcı isterse manuel olarak yeniden baseline'lar. */
  baseline: Record<string, DateQuantityMap>;
  /** Baseline'ın hangi tarihte donduğu — proje bazında. */
  baselineSetAt: Record<string, string>;

  // Master data (user-bound, proje-bağımsız)
  personnelMaster: PersonnelMaster[];
  machinesMaster: MachineMaster[];
  personnelAssignments: PersonnelAssignment[];
  machineAssignments: MachineAssignment[];

  // Puantaj
  personnelAttendance: PersonnelAttendance[];
  machineAttendance: MachineAttendance[];

  // Puantaj kilidi — Kaydet'e basılınca o gün kilitlenir; başka sayfaya gidip dönünce korunur.
  // { [projectId]: { [date]: true } } — personel ve makine ayrı izlenir.
  personnelAttendanceLocks: Record<string, Record<string, true>>;
  machineAttendanceLocks: Record<string, Record<string, true>>;

  // Diğer modüller
  dailyReports: DailyReport[];
  procurement: ProcurementItem[];
  billing: BillingItem[];
  subcontractors: Subcontractor[];
  paymentMilestones: PaymentMilestone[];
  budgetCategories: BudgetCategory[];
  budgetActuals: BudgetActual[];
  lookahead: LookaheadItem[];

  // Sistem
  auditLog: AuditEntry[];
  notifications: NotificationItem[];

  // Teslim Alma raporları — projectId → rapor (proje başına tek kayıt)
  teslimAlma: Record<string, TeslimAlmaReport>;

  _seeded: boolean;

  // ===== Actions =====
  seedIfEmpty: () => void;
  resetAll: () => void;
  wipeAndStartFresh: () => void;

  // Auth
  setCurrentUser: (userId: string | null) => void;
  addUser: (u: Omit<User, "id" | "createdAt">) => User;

  // Projects
  setCurrentProject: (id: string | null) => void;
  createProject: (p: Omit<Project, "id" | "createdAt" | "updatedAt">) => Project;
  updateProject: (id: string, patch: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  /** Bir projeyi demo/örnek olarak işaretle veya kilidini aç. Demo guard'ı bypass eder. */
  setProjectDemo: (id: string, isDemo: boolean) => void;
  /** Demo (veya başka bir) projeyi seçimli klonla. */
  cloneProject: (
    sourceId: string,
    opts: {
      name: string;
      location?: string;
      startDate: string;
      durationDays: number;
      cloneWbs: boolean;
      clonePlanned: boolean;
      clonePersonnelAssignments: boolean;
      cloneMachineAssignments: boolean;
    }
  ) => Project | null;

  // Members & invites
  addMember: (m: Omit<ProjectMember, "id" | "invitedAt">) => void;
  updateMemberRole: (memberId: string, role: Role) => void;
  removeMember: (memberId: string) => void;
  createInvitation: (i: Omit<Invitation, "id" | "token" | "invitedAt" | "expiresAt">) => Invitation;
  acceptInvitation: (token: string, userId: string) => void;
  cancelInvitation: (id: string) => void;

  // WBS
  addWbs: (item: Omit<WbsItem, "id">) => void;
  updateWbs: (id: string, patch: Partial<WbsItem>) => void;
  softDeleteWbs: (id: string) => void;
  restoreWbs: (id: string) => void;
  hardDeleteWbs: (id: string) => void;
  /** Bir WBS kalemine yeni bir öncül ekle. Cycle kontrolünden geçmezse hata fırlatır. */
  setWbsPredecessors: (wbsId: string, predecessors: WbsItem["predecessors"]) => void;
  /**
   * Bir projedeki TÜM leaf'lerin scheduleType'ını set eder:
   *  - alapCodes içindekiler → "alap"
   *  - geri kalanlar         → undefined (asap)
   * Tek `set` çağrısı içinde toplu yapılır.
   */
  setWbsScheduleTypes: (projectId: string, alapCodes: Set<string>) => void;
  /** Bir kalemin planlanan miktarını shiftDays kadar sağa kaydır (key'leri yeniden adlandırır). */
  shiftWbsPlan: (projectId: string, wbsCode: string, shiftDays: number) => void;
  /** Bir kalemin TÜM plan'ını yeni byDate map'i ile değiştirir (atomik). */
  replaceWbsPlan: (projectId: string, wbsCode: string, byDate: Record<string, number>) => void;
  /** Kullanıcının kendi şablonu — varsa yeni projeler bunu kullanır, yoksa DEFAULT_WBS. */
  customWbsTemplate?: WbsTemplateItem[];
  /** Verilen projenin mevcut WBS yapısını "tüm yeni projeler için şablon" olarak kaydeder. */
  saveProjectWbsAsTemplate: (projectId: string) => void;

  // Planning & Realization
  setPlanned: (projectId: string, code: string, date: string, qty: number) => void;
  setRealized: (projectId: string, code: string, date: string, qty: number) => void;
  /** Bir kalemin (code) baseline değerlerini set eder. mode="if-empty" = sadece henüz yoksa,
   *  mode="overwrite" = mevcut baseline'ı ezerek yeniden alır. */
  snapshotBaseline: (
    projectId: string,
    code: string,
    byDate: Record<string, number>,
    mode: "if-empty" | "overwrite"
  ) => void;
  /** Bir kalemin baseline'ını temizle. */
  clearBaselineForCode: (projectId: string, code: string) => void;
  /** Tüm baseline'ı current planned'tan al (PMP "Set Baseline" işlemi). */
  rebaselineAll: (projectId: string) => void;
  /** Çoklu kalem için plan/baseline/öncül/realized'i seçimli temizle. */
  bulkClearWbsData: (
    projectId: string,
    codes: string[],
    opts: { planned?: boolean; baseline?: boolean; predecessors?: boolean; realized?: boolean }
  ) => { plannedCleared: number; baselineCleared: number; predecessorsCleared: number; realizedCleared: number };

  // Master data
  addPersonnel: (p: Omit<PersonnelMaster, "id" | "createdAt" | "updatedAt">) => PersonnelMaster;
  updatePersonnel: (id: string, patch: Partial<PersonnelMaster>) => void;
  softDeletePersonnel: (id: string) => void;

  addMachine: (m: Omit<MachineMaster, "id" | "createdAt" | "updatedAt">) => MachineMaster;
  updateMachine: (id: string, patch: Partial<MachineMaster>) => void;
  softDeleteMachine: (id: string) => void;

  assignPersonnel: (a: Omit<PersonnelAssignment, "id">) => void;
  assignMachine: (a: Omit<MachineAssignment, "id">) => void;
  unassignPersonnel: (id: string) => void;
  unassignMachine: (id: string) => void;

  // Attendance
  setPersonnelAttendance: (records: Omit<PersonnelAttendance, "id" | "recordedAt">[]) => void;
  setMachineAttendance: (records: Omit<MachineAttendance, "id" | "recordedAt">[]) => void;

  // Puantaj kilit/aç — kalıcı (zustand persist ile saklanır).
  lockPersonnelAttendanceDay: (projectId: string, date: string) => void;
  unlockPersonnelAttendanceDay: (projectId: string, date: string) => void;
  lockMachineAttendanceDay: (projectId: string, date: string) => void;
  unlockMachineAttendanceDay: (projectId: string, date: string) => void;

  // Daily report
  upsertDailyReport: (r: Omit<DailyReport, "id" | "createdAt" | "updatedAt"> & { id?: string }) => DailyReport;
  deleteDailyReport: (id: string) => void;

  // Procurement / Billing
  addProcurement: (p: Omit<ProcurementItem, "id">) => void;
  updateProcurement: (id: string, patch: Partial<ProcurementItem>) => void;
  deleteProcurement: (id: string) => void;
  addBilling: (b: Omit<BillingItem, "id">) => void;
  updateBilling: (id: string, patch: Partial<BillingItem>) => void;
  deleteBilling: (id: string) => void;

  // Subcontractors
  addSubcontractor: (s: Omit<Subcontractor, "id" | "createdAt" | "updatedAt">) => Subcontractor;
  updateSubcontractor: (id: string, patch: Partial<Subcontractor>) => void;
  deleteSubcontractor: (id: string) => void;

  // Payment milestones (hakediş planı)
  addPaymentMilestone: (m: Omit<PaymentMilestone, "id" | "createdAt" | "updatedAt">) => PaymentMilestone;
  updatePaymentMilestone: (id: string, patch: Partial<PaymentMilestone>) => void;
  deletePaymentMilestone: (id: string) => void;
  /** Bir hakedişin ödeme defterini değiştir; toplam/son tarih/durum otomatik hesaplanır. */
  setMilestonePayments: (id: string, payments: PaymentEntry[], notes?: string) => void;

  // Budget
  addBudgetCategory: (c: Omit<BudgetCategory, "id">) => void;
  updateBudgetCategory: (id: string, patch: Partial<BudgetCategory>) => void;
  deleteBudgetCategory: (id: string) => void;
  addBudgetActual: (a: Omit<BudgetActual, "id" | "recordedAt">) => void;

  // Lookahead
  addLookahead: (l: Omit<LookaheadItem, "id">) => void;
  updateLookahead: (id: string, patch: Partial<LookaheadItem>) => void;
  deleteLookahead: (id: string) => void;
  toggleLookaheadDone: (id: string) => void;

  // Audit & Notifications
  addAudit: (e: Omit<AuditEntry, "id" | "createdAt">) => void;
  addNotification: (n: Omit<NotificationItem, "id" | "createdAt" | "readAt">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Teslim Alma
  /** Bir proje için rapor yoksa boş yapı oluştur. Idempotent. */
  ensureTeslimAlmaReport: (projectId: string) => TeslimAlmaReport;
  updateTeslimAlmaItem: (projectId: string, itemId: string, patch: Partial<TeslimAlmaItemResult> & { status: TeslimAlmaStatus }) => void;
  updateTeslimAlmaMeta: (projectId: string, patch: Partial<TeslimAlmaMeta>) => void;
  /** Tüm madde cevaplarını ve meta'yı sıfırla (proje silmez). */
  resetTeslimAlmaReport: (projectId: string) => void;

  // App / Panel ayarları
  panelName: string;
  setPanelName: (name: string) => void;
  updateCurrentUser: (patch: Partial<Pick<User, "fullName" | "email" | "phone" | "avatarUrl">>) => void;
}

// ============================================================
// Helpers
// ============================================================
const now = () => new Date().toISOString();

function pushNotification(
  list: NotificationItem[],
  partial: Omit<NotificationItem, "id" | "createdAt" | "readAt">
): NotificationItem[] {
  return [
    { id: uid(), createdAt: now(), readAt: null, ...partial },
    ...list,
  ].slice(0, 200);
}

const DEFAULT_USER: User = {
  id: "",
  email: "ozan.seyfi@kontrolmatik.com",
  fullName: "Ozan Seyfi",
  isSuperAdmin: true,
  createdAt: "",
};

// ============================================================
// Store
// ============================================================
const initialState: Omit<StoreState, keyof Actions> = {
  currentUserId: null,
  users: [],
  projects: [],
  currentProjectId: null,
  members: [],
  invitations: [],
  wbs: [],
  planned: {},
  realized: {},
  baseline: {},
  baselineSetAt: {},
  personnelMaster: [],
  machinesMaster: [],
  personnelAssignments: [],
  machineAssignments: [],
  personnelAttendance: [],
  machineAttendance: [],
  personnelAttendanceLocks: {},
  machineAttendanceLocks: {},
  dailyReports: [],
  procurement: [],
  billing: [],
  subcontractors: [],
  paymentMilestones: [],
  budgetCategories: [],
  budgetActuals: [],
  lookahead: [],
  auditLog: [],
  notifications: [],
  teslimAlma: {},
  panelName: "",
  _seeded: false,
};

// Action keys to subtract from state shape above
type Actions = {
  [K in keyof StoreState as StoreState[K] extends (...args: never[]) => unknown ? K : never]: StoreState[K];
};

/**
 * Demo proje tespiti — store içinden state ile çağrılır.
 * Demo projeye yapılan tüm yazma aksiyonları no-op olur (sessizce başarısız).
 */
function isStateDemo(s: { projects: Project[] }, projectId: string): boolean {
  const p = s.projects.find((x) => x.id === projectId);
  return p?.isDemo === true;
}

/** Bir ID'ye sahip kayıtın proje sahibinin demo olup olmadığını kontrol et. */
function isItemInDemo<T extends { id: string; projectId: string }>(
  s: { projects: Project[] },
  collection: T[],
  itemId: string
): boolean {
  const item = collection.find((x) => x.id === itemId);
  if (!item) return false;
  return isStateDemo(s, item.projectId);
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      seedIfEmpty: () => {
        const s = get();

        // Sample (Ankara Polatlı GES) artık otomatik yüklenmez.
        // Sadece varsayılan super admin user'ı yarat (giriş için lazım) ve
        // _seeded işaretini set et — ilk render sonrası boş workspace gösterilir.
        if (s._seeded) return;

        let userId = s.currentUserId;
        let users = s.users;
        if (!userId) {
          const newUser: User = {
            ...DEFAULT_USER,
            id: uid(),
            createdAt: now(),
          };
          users = [...s.users, newUser];
          userId = newUser.id;
        }

        set({
          users,
          currentUserId: userId,
          _seeded: true,
        });
      },

      resetAll: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("ges-store");
        }
        set({ ...initialState });
      },

      // Tüm örnek verileri / projeleri / master data'yı siler ama kullanıcıyı korur.
      // _seeded=true bırakır → otomatik re-seed yapmaz.
      wipeAndStartFresh: () => {
        const s = get();
        const currentUser = s.users.find((u) => u.id === s.currentUserId);
        set({
          ...initialState,
          users: currentUser ? [currentUser] : [],
          currentUserId: currentUser?.id ?? null,
          _seeded: true, // bir daha auto-seed olma
          panelName: s.panelName,
        });
      },

      setCurrentUser: (id) => set({ currentUserId: id }),

      addUser: (u) => {
        const user: User = { id: uid(), createdAt: now(), ...u };
        set((s) => ({ users: [...s.users, user] }));
        return user;
      },

      setCurrentProject: (id) => set({ currentProjectId: id }),

      createProject: (p) => {
        const project: Project = { id: uid(), createdAt: now(), updatedAt: now(), ...p };
        // Yeni projeye WBS yükle: kullanıcı şablonu varsa onu, yoksa DEFAULT_WBS'i kullan
        const template = get().customWbsTemplate ?? DEFAULT_WBS;
        const wbsItems: WbsItem[] = template.map((w) => ({
          id: uid(),
          projectId: project.id,
          code: w.code,
          name: w.name,
          level: w.level,
          isLeaf: w.isLeaf,
          weight: w.weight,
          quantity: w.quantity,
          unit: w.unit,
          parentCode: w.code.includes(".") ? w.code.split(".").slice(0, -1).join(".") : undefined,
        }));
        const userId = get().currentUserId;
        const member: ProjectMember = {
          id: uid(),
          projectId: project.id,
          userId: userId || project.createdBy,
          role: "project_manager",
          invitedBy: userId || project.createdBy,
          invitedAt: now(),
          acceptedAt: now(),
        };
        set((s) => ({
          projects: [...s.projects, project],
          wbs: [...s.wbs, ...wbsItems],
          members: [...s.members, member],
          currentProjectId: project.id,
        }));
        return project;
      },

      setProjectDemo: (id, isDemo) =>
        set((s) => ({
          // Demo guard yok — bu özel aksiyon kilitleyi açıp kapatabilir.
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, isDemo, updatedAt: now() } : p
          ),
        })),

      cloneProject: (sourceId, opts) => {
        const state = get();
        const source = state.projects.find((p) => p.id === sourceId);
        if (!source) return null;
        const userId = state.currentUserId ?? source.createdBy;

        // Yeni proje
        const newId = uid();
        const startDt = new Date(opts.startDate);
        const plannedEnd = toISODate(
          new Date(startDt.getTime() + opts.durationDays * 86400000)
        );
        const newProject: Project = {
          ...source,
          id: newId,
          name: opts.name,
          location: opts.location ?? source.location,
          startDate: opts.startDate,
          durationDays: opts.durationDays,
          plannedEnd,
          contractEnd: plannedEnd,
          reportDate: toISODate(new Date()),
          isDemo: false,
          status: "draft",
          publicShareToken: null,
          publicShareExpiresAt: null,
          createdBy: userId,
          createdAt: now(),
          updatedAt: now(),
        };

        // Tarih kaydırma deltası — kaynak başlangıçtan yeni başlangıca
        const sourceStart = new Date(source.startDate);
        const deltaMs = startDt.getTime() - sourceStart.getTime();
        const shiftDate = (iso: string): string =>
          toISODate(new Date(new Date(iso).getTime() + deltaMs));

        // WBS klonu (yeni id, aynı code)
        const newWbs: WbsItem[] = opts.cloneWbs
          ? state.wbs
              .filter((w) => w.projectId === sourceId)
              .map((w) => ({ ...w, id: uid(), projectId: newId, predecessors: w.predecessors }))
          : [];

        // Planlama klonu — codes değişmez, sadece tarihler delta kadar ötele
        const newPlannedMap: Record<string, Record<string, number>> = {};
        if (opts.clonePlanned && opts.cloneWbs) {
          const src = state.planned[sourceId] || {};
          for (const [code, byDate] of Object.entries(src)) {
            const shifted: Record<string, number> = {};
            for (const [d, q] of Object.entries(byDate)) {
              shifted[shiftDate(d)] = q;
            }
            newPlannedMap[code] = shifted;
          }
        }

        // Personel atamaları
        const newPersonnelAssignments: PersonnelAssignment[] = opts.clonePersonnelAssignments
          ? state.personnelAssignments
              .filter((a) => a.projectId === sourceId)
              .map((a) => ({
                ...a,
                id: uid(),
                projectId: newId,
                assignedFrom: shiftDate(a.assignedFrom),
                assignedTo: a.assignedTo ? shiftDate(a.assignedTo) : a.assignedTo,
              }))
          : [];

        // Makine atamaları
        const newMachineAssignments: MachineAssignment[] = opts.cloneMachineAssignments
          ? state.machineAssignments
              .filter((a) => a.projectId === sourceId)
              .map((a) => ({
                ...a,
                id: uid(),
                projectId: newId,
                assignedFrom: shiftDate(a.assignedFrom),
                assignedTo: a.assignedTo ? shiftDate(a.assignedTo) : a.assignedTo,
              }))
          : [];

        const member: ProjectMember = {
          id: uid(),
          projectId: newId,
          userId,
          role: "project_manager",
          invitedBy: userId,
          invitedAt: now(),
          acceptedAt: now(),
        };

        set((s) => ({
          projects: [...s.projects, newProject],
          wbs: [...s.wbs, ...newWbs],
          planned: opts.clonePlanned && opts.cloneWbs
            ? { ...s.planned, [newId]: newPlannedMap }
            : s.planned,
          personnelAssignments: [...s.personnelAssignments, ...newPersonnelAssignments],
          machineAssignments: [...s.machineAssignments, ...newMachineAssignments],
          members: [...s.members, member],
          currentProjectId: newId,
        }));

        return newProject;
      },

      updateProject: (id, patch) =>
        set((s) => {
          if (isStateDemo(s, id)) return {};
          return {
            projects: s.projects.map((p) =>
              p.id === id ? { ...p, ...patch, updatedAt: now() } : p
            ),
          };
        }),

      deleteProject: (id) =>
        set((s) => {
          if (isStateDemo(s, id)) return {};
          const newTeslimAlma = { ...s.teslimAlma };
          delete newTeslimAlma[id];
          return {
            projects: s.projects.filter((p) => p.id !== id),
            wbs: s.wbs.filter((w) => w.projectId !== id),
            members: s.members.filter((m) => m.projectId !== id),
            paymentMilestones: s.paymentMilestones.filter((m) => m.projectId !== id),
            teslimAlma: newTeslimAlma,
            currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
          };
        }),

      addMember: (m) => {
        const member: ProjectMember = { id: uid(), invitedAt: now(), ...m };
        set((s) => {
          const project = s.projects.find((p) => p.id === m.projectId);
          const inviter = s.users.find((u) => u.id === m.invitedBy);
          return {
            members: [...s.members, member],
            notifications: pushNotification(s.notifications, {
              userId: m.userId,
              projectId: m.projectId,
              type: "share",
              title: `${project?.name ?? "Proje"} ekibine eklendin`,
              body: inviter
                ? `${inviter.fullName} seni "${project?.name}" projesine ${m.role} olarak ekledi.`
                : `"${project?.name}" projesine ${m.role} olarak eklendin.`,
              link: `/dashboard`,
            }),
          };
        });
      },

      updateMemberRole: (memberId, role) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
        })),

      removeMember: (memberId) =>
        set((s) => ({ members: s.members.filter((m) => m.id !== memberId) })),

      createInvitation: (i) => {
        const expires = new Date();
        expires.setDate(expires.getDate() + 7);
        const inv: Invitation = {
          id: uid(),
          token: uid().replace(/-/g, ""),
          invitedAt: now(),
          expiresAt: expires.toISOString(),
          ...i,
        };
        set((s) => ({ invitations: [...s.invitations, inv] }));
        return inv;
      },

      acceptInvitation: (token, userId) => {
        const inv = get().invitations.find((x) => x.token === token);
        if (!inv) return;
        const member: ProjectMember = {
          id: uid(),
          projectId: inv.projectId,
          userId,
          role: inv.role,
          invitedBy: inv.invitedBy,
          invitedAt: inv.invitedAt,
          acceptedAt: now(),
        };
        set((s) => ({
          members: [...s.members, member],
          invitations: s.invitations.map((x) =>
            x.id === inv.id ? { ...x, acceptedAt: now() } : x
          ),
        }));
      },

      cancelInvitation: (id) =>
        set((s) => ({ invitations: s.invitations.filter((x) => x.id !== id) })),

      addWbs: (item) => {
        const wbs: WbsItem = { id: uid(), ...item };
        set((s) => {
          if (isStateDemo(s, item.projectId)) return {};
          return { wbs: [...s.wbs, wbs] };
        });
      },

      updateWbs: (id, patch) =>
        set((s) => {
          const old = s.wbs.find((w) => w.id === id);
          if (!old) return s;
          if (isStateDemo(s, old.projectId)) return {};
          // Kod değişmiyorsa basit güncelleme
          if (patch.code === undefined || patch.code === old.code) {
            return {
              wbs: s.wbs.map((w) => (w.id === id ? { ...w, ...patch } : w)),
            };
          }
          // Kod değişti → tüm alt satırların kodlarını ve planlama/gerçekleşme key'lerini güncelle
          const oldCode = old.code;
          const newCode = patch.code;
          const projectId = old.projectId;

          const updatedWbs = s.wbs.map((w) => {
            if (w.projectId !== projectId) return w;
            if (w.id === id) {
              const newParentCode = newCode.includes(".")
                ? newCode.split(".").slice(0, -1).join(".")
                : undefined;
              return { ...w, ...patch, parentCode: newParentCode };
            }
            // Gerçek descendant kontrolü: SADECE "oldCode." ile başlayanlar (kendisi hariç)
            // Aynı kodu paylaşan duplicate satırlar dokunulmaz — onlar bu satırın çocuğu değil.
            if (w.code.startsWith(oldCode + ".")) {
              const newDescCode = newCode + w.code.slice(oldCode.length);
              const newDescParent = newDescCode.includes(".")
                ? newDescCode.split(".").slice(0, -1).join(".")
                : undefined;
              return { ...w, code: newDescCode, parentCode: newDescParent };
            }
            return w;
          });

          // Planlama ve gerçekleşme verilerini de göç ettir
          const remapKeys = (map: Record<string, Record<string, number>>) => {
            const out: Record<string, Record<string, number>> = {};
            for (const [code, byDate] of Object.entries(map)) {
              if (code === oldCode) {
                out[newCode] = byDate;
              } else if (code.startsWith(oldCode + ".")) {
                out[newCode + code.slice(oldCode.length)] = byDate;
              } else {
                out[code] = byDate;
              }
            }
            return out;
          };

          const oldPlanned = s.planned[projectId] || {};
          const oldRealized = s.realized[projectId] || {};
          return {
            wbs: updatedWbs,
            planned: { ...s.planned, [projectId]: remapKeys(oldPlanned) },
            realized: { ...s.realized, [projectId]: remapKeys(oldRealized) },
          };
        }),

      softDeleteWbs: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.wbs, id)) return {};
          return {
            wbs: s.wbs.map((w) => (w.id === id ? { ...w, deletedAt: now() } : w)),
          };
        }),

      restoreWbs: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.wbs, id)) return {};
          return {
            wbs: s.wbs.map((w) => (w.id === id ? { ...w, deletedAt: null } : w)),
          };
        }),

      hardDeleteWbs: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.wbs, id)) return {};
          return { wbs: s.wbs.filter((w) => w.id !== id) };
        }),

      setWbsPredecessors: (wbsId, predecessors) =>
        set((s) => {
          if (isItemInDemo(s, s.wbs, wbsId)) return {};
          return {
            wbs: s.wbs.map((w) =>
              w.id === wbsId ? { ...w, predecessors: predecessors && predecessors.length > 0 ? predecessors : undefined } : w
            ),
          };
        }),

      setWbsScheduleTypes: (projectId, alapCodes) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          return {
            wbs: s.wbs.map((w) => {
              if (w.projectId !== projectId || !w.isLeaf) return w;
              const shouldBeAlap = alapCodes.has(w.code);
              const currentAlap = w.scheduleType === "alap";
              if (shouldBeAlap === currentAlap) return w; // değişiklik yok
              return {
                ...w,
                scheduleType: shouldBeAlap ? ("alap" as const) : undefined,
              };
            }),
          };
        }),

      shiftWbsPlan: (projectId, wbsCode, shiftDays) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          if (shiftDays === 0) return s;
          const pp = { ...(s.planned[projectId] || {}) };
          const byDate = pp[wbsCode];
          if (!byDate) return s;
          const newByDate: Record<string, number> = {};
          for (const [date, qty] of Object.entries(byDate)) {
            if (qty <= 0) continue;
            const d = new Date(date);
            d.setDate(d.getDate() + shiftDays);
            const newDate = d.toISOString().slice(0, 10);
            newByDate[newDate] = qty;
          }
          pp[wbsCode] = newByDate;
          return { planned: { ...s.planned, [projectId]: pp } };
        }),

      replaceWbsPlan: (projectId, wbsCode, byDate) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const pp = { ...(s.planned[projectId] || {}) };
          // Sıfır veya negatif değerleri filtrele (boş entries tutma)
          const clean: Record<string, number> = {};
          for (const [d, q] of Object.entries(byDate)) {
            if (q > 0) clean[d] = q;
          }
          pp[wbsCode] = clean;
          return { planned: { ...s.planned, [projectId]: pp } };
        }),

      saveProjectWbsAsTemplate: (projectId) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          // Projedeki aktif WBS satırlarını sırala + minimal template formatına dönüştür
          const items = s.wbs
            .filter((w) => w.projectId === projectId && !w.deletedAt)
            .slice()
            .sort((a, b) =>
              a.code.localeCompare(b.code, undefined, { numeric: true })
            );
          const template: WbsTemplateItem[] = items.map((w) => ({
            code: w.code,
            name: w.name,
            quantity: w.quantity,
            level: w.level,
            isLeaf: w.isLeaf,
            unit: w.unit,
            weight: w.weight,
          }));
          return { customWbsTemplate: template };
        }),

      setPlanned: (projectId, code, date, qty) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const pp = { ...(s.planned[projectId] || {}) };
          const byCode = { ...(pp[code] || {}) };
          if (qty <= 0 || Number.isNaN(qty)) {
            delete byCode[date];
          } else {
            byCode[date] = qty;
          }
          if (Object.keys(byCode).length === 0) {
            delete pp[code];
          } else {
            pp[code] = byCode;
          }
          return { planned: { ...s.planned, [projectId]: pp } };
        }),

      snapshotBaseline: (projectId, code, byDate, mode) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const projBaseline = { ...(s.baseline[projectId] || {}) };
          const existing = projBaseline[code];
          // "if-empty" modunda zaten baseline varsa dokunma
          if (mode === "if-empty" && existing && Object.keys(existing).length > 0) {
            return {};
          }
          const cleaned: Record<string, number> = {};
          for (const [d, v] of Object.entries(byDate)) {
            const n = Number(v) || 0;
            if (n > 0) cleaned[d] = n;
          }
          if (Object.keys(cleaned).length === 0) {
            delete projBaseline[code];
          } else {
            projBaseline[code] = cleaned;
          }
          // baselineSetAt — proje için ilk kayıtta set et
          const setAt = { ...s.baselineSetAt };
          if (!setAt[projectId]) {
            setAt[projectId] = new Date().toISOString();
          }
          return {
            baseline: { ...s.baseline, [projectId]: projBaseline },
            baselineSetAt: setAt,
          };
        }),

      clearBaselineForCode: (projectId, code) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const projBaseline = { ...(s.baseline[projectId] || {}) };
          delete projBaseline[code];
          return { baseline: { ...s.baseline, [projectId]: projBaseline } };
        }),

      rebaselineAll: (projectId) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          // Mevcut planned'ı baseline'a kopyala
          const currentPlanned = s.planned[projectId] || {};
          const newBaseline: DateQuantityMap = {};
          for (const [code, byDate] of Object.entries(currentPlanned)) {
            newBaseline[code] = { ...byDate };
          }
          return {
            baseline: { ...s.baseline, [projectId]: newBaseline },
            baselineSetAt: { ...s.baselineSetAt, [projectId]: new Date().toISOString() },
          };
        }),

      bulkClearWbsData: (projectId, codes, opts) => {
        // Sayım için ön kontrol (state değişmeden önce)
        const before = get();
        if (isStateDemo(before, projectId)) {
          return { plannedCleared: 0, baselineCleared: 0, predecessorsCleared: 0, realizedCleared: 0 };
        }
        const codeSet = new Set(codes);
        let plannedCleared = 0;
        let baselineCleared = 0;
        let predecessorsCleared = 0;
        let realizedCleared = 0;
        if (opts.planned) {
          const pp = before.planned[projectId] || {};
          for (const c of codeSet) if (pp[c] && Object.keys(pp[c]).length > 0) plannedCleared++;
        }
        if (opts.baseline) {
          const bb = before.baseline[projectId] || {};
          for (const c of codeSet) if (bb[c] && Object.keys(bb[c]).length > 0) baselineCleared++;
        }
        if (opts.predecessors) {
          for (const w of before.wbs) {
            if (w.projectId !== projectId) continue;
            if (!codeSet.has(w.code)) continue;
            if ((w.predecessors?.length ?? 0) > 0) predecessorsCleared++;
          }
        }
        if (opts.realized) {
          const pr = before.realized[projectId] || {};
          for (const c of codeSet) if (pr[c] && Object.keys(pr[c]).length > 0) realizedCleared++;
        }

        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const updates: Partial<StoreState> = {};

          if (opts.planned) {
            const pp = { ...(s.planned[projectId] || {}) };
            for (const c of codeSet) delete pp[c];
            updates.planned = { ...s.planned, [projectId]: pp };
          }
          if (opts.baseline) {
            const bb = { ...(s.baseline[projectId] || {}) };
            for (const c of codeSet) delete bb[c];
            updates.baseline = { ...s.baseline, [projectId]: bb };
          }
          if (opts.realized) {
            const pr = { ...(s.realized[projectId] || {}) };
            for (const c of codeSet) delete pr[c];
            updates.realized = { ...s.realized, [projectId]: pr };
          }
          if (opts.predecessors) {
            // Hedefi temizle: bu kalemler kimin öncülü ise direkt sıfırla.
            // Ayrıca diğer kalemlerden bu kalemlere bağlı linkleri de düşür.
            const newWbs = s.wbs.map((w) => {
              if (w.projectId !== projectId) return w;
              // 1) Bu kalemin kendi predecessors listesini boşalt
              if (codeSet.has(w.code) && (w.predecessors?.length ?? 0) > 0) {
                return { ...w, predecessors: [] };
              }
              // 2) Başka kalemlerin pred listesinde bu kodlar varsa kaldır
              if (w.predecessors && w.predecessors.some((p) => codeSet.has(p.wbsCode))) {
                return {
                  ...w,
                  predecessors: w.predecessors.filter((p) => !codeSet.has(p.wbsCode)),
                };
              }
              return w;
            });
            updates.wbs = newWbs;
          }
          return updates;
        });

        return { plannedCleared, baselineCleared, predecessorsCleared, realizedCleared };
      },

      setRealized: (projectId, code, date, qty) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const pr = { ...(s.realized[projectId] || {}) };
          const byCode = { ...(pr[code] || {}) };
          if (qty <= 0 || Number.isNaN(qty)) {
            delete byCode[date];
          } else {
            byCode[date] = qty;
          }
          if (Object.keys(byCode).length === 0) {
            delete pr[code];
          } else {
            pr[code] = byCode;
          }
          return { realized: { ...s.realized, [projectId]: pr } };
        }),

      addPersonnel: (p) => {
        const person: PersonnelMaster = {
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
          ...p,
        };
        set((s) => ({ personnelMaster: [...s.personnelMaster, person] }));
        return person;
      },

      updatePersonnel: (id, patch) =>
        set((s) => ({
          personnelMaster: s.personnelMaster.map((p) =>
            p.id === id ? { ...p, ...patch, updatedAt: now() } : p
          ),
        })),

      softDeletePersonnel: (id) =>
        set((s) => ({
          personnelMaster: s.personnelMaster.map((p) =>
            p.id === id ? { ...p, deletedAt: now() } : p
          ),
        })),

      addMachine: (m) => {
        const machine: MachineMaster = {
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
          ...m,
        };
        set((s) => ({ machinesMaster: [...s.machinesMaster, machine] }));
        return machine;
      },

      updateMachine: (id, patch) =>
        set((s) => ({
          machinesMaster: s.machinesMaster.map((m) =>
            m.id === id ? { ...m, ...patch, updatedAt: now() } : m
          ),
        })),

      softDeleteMachine: (id) =>
        set((s) => ({
          machinesMaster: s.machinesMaster.map((m) =>
            m.id === id ? { ...m, deletedAt: now() } : m
          ),
        })),

      assignPersonnel: (a) => {
        const ass: PersonnelAssignment = { id: uid(), ...a };
        set((s) => {
          if (isStateDemo(s, a.projectId)) return {};
          return { personnelAssignments: [...s.personnelAssignments, ass] };
        });
      },

      assignMachine: (a) => {
        const ass: MachineAssignment = { id: uid(), ...a };
        set((s) => {
          if (isStateDemo(s, a.projectId)) return {};
          return { machineAssignments: [...s.machineAssignments, ass] };
        });
      },

      unassignPersonnel: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.personnelAssignments, id)) return {};
          return { personnelAssignments: s.personnelAssignments.filter((a) => a.id !== id) };
        }),

      unassignMachine: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.machineAssignments, id)) return {};
          return { machineAssignments: s.machineAssignments.filter((a) => a.id !== id) };
        }),

      setPersonnelAttendance: (records) => {
        const recordedAt = now();
        set((s) => {
          // Demo proje kayıtlarını sessizce ele
          const writable = records.filter((r) => !isStateDemo(s, r.projectId));
          if (writable.length === 0) return {};
          // Aynı (projectId, personnelMasterId, date) varsa üzerine yaz
          const keep = s.personnelAttendance.filter((r) =>
            !writable.some(
              (n) =>
                n.projectId === r.projectId &&
                n.personnelMasterId === r.personnelMasterId &&
                n.date === r.date
            )
          );
          const fresh: PersonnelAttendance[] = writable.map((r) => ({
            id: uid(),
            recordedAt,
            ...r,
          }));
          return { personnelAttendance: [...keep, ...fresh] };
        });
      },

      setMachineAttendance: (records) => {
        const recordedAt = now();
        set((s) => {
          const writable = records.filter((r) => !isStateDemo(s, r.projectId));
          if (writable.length === 0) return {};
          const keep = s.machineAttendance.filter((r) =>
            !writable.some(
              (n) =>
                n.projectId === r.projectId &&
                n.machineMasterId === r.machineMasterId &&
                n.date === r.date
            )
          );
          const fresh: MachineAttendance[] = writable.map((r) => ({
            id: uid(),
            recordedAt,
            ...r,
          }));
          return { machineAttendance: [...keep, ...fresh] };
        });
      },

      lockPersonnelAttendanceDay: (projectId, date) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          return {
            personnelAttendanceLocks: {
              ...s.personnelAttendanceLocks,
              [projectId]: { ...(s.personnelAttendanceLocks[projectId] ?? {}), [date]: true },
            },
          };
        }),

      unlockPersonnelAttendanceDay: (projectId, date) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const proj = { ...(s.personnelAttendanceLocks[projectId] ?? {}) };
          delete proj[date];
          return {
            personnelAttendanceLocks: {
              ...s.personnelAttendanceLocks,
              [projectId]: proj,
            },
          };
        }),

      lockMachineAttendanceDay: (projectId, date) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          return {
            machineAttendanceLocks: {
              ...s.machineAttendanceLocks,
              [projectId]: { ...(s.machineAttendanceLocks[projectId] ?? {}), [date]: true },
            },
          };
        }),

      unlockMachineAttendanceDay: (projectId, date) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const proj = { ...(s.machineAttendanceLocks[projectId] ?? {}) };
          delete proj[date];
          return {
            machineAttendanceLocks: {
              ...s.machineAttendanceLocks,
              [projectId]: proj,
            },
          };
        }),

      upsertDailyReport: (r) => {
        // Demo proje kontrolü
        if (isStateDemo(get(), r.projectId)) {
          // Mevcut bir kayıt güncelleniyorsa onu, yoksa boş bir kayıt döndür
          const existing = r.id ? get().dailyReports.find((x) => x.id === r.id) : undefined;
          return (existing ?? { id: uid(), createdAt: now(), updatedAt: now(), ...r }) as DailyReport;
        }
        const existing = r.id ? get().dailyReports.find((x) => x.id === r.id) : undefined;
        if (existing) {
          const updated: DailyReport = { ...existing, ...r, updatedAt: now() };
          set((s) => ({
            dailyReports: s.dailyReports.map((x) => (x.id === updated.id ? updated : x)),
          }));
          return updated;
        }
        const created: DailyReport = {
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
          ...r,
        } as DailyReport;
        set((s) => ({ dailyReports: [...s.dailyReports, created] }));
        return created;
      },

      deleteDailyReport: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.dailyReports, id)) return {};
          return { dailyReports: s.dailyReports.filter((d) => d.id !== id) };
        }),

      addProcurement: (p) =>
        set((s) => {
          if (isStateDemo(s, p.projectId)) return {};
          return { procurement: [...s.procurement, { id: uid(), ...p }] };
        }),
      updateProcurement: (id, patch) =>
        set((s) => {
          if (isItemInDemo(s, s.procurement, id)) return {};
          const old = s.procurement.find((p) => p.id === id);
          const updated = old ? { ...old, ...patch } : null;
          let notifications = s.notifications;
          // Delivery actual set edildi → bildirim
          if (
            updated &&
            old &&
            !old.actualDeliveredDate &&
            updated.actualDeliveredDate &&
            s.currentUserId
          ) {
            const project = s.projects.find((p) => p.id === updated.projectId);
            notifications = pushNotification(notifications, {
              userId: s.currentUserId,
              projectId: updated.projectId,
              type: "status_change",
              title: "Malzeme teslim alındı",
              body: `${updated.material}${project ? ` · ${project.name}` : ""} teslim olarak işaretlendi.`,
              link: `/procurement`,
            });
          }
          return {
            procurement: s.procurement.map((p) => (p.id === id ? { ...p, ...patch } : p)),
            notifications,
          };
        }),
      deleteProcurement: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.procurement, id)) return {};
          return { procurement: s.procurement.filter((p) => p.id !== id) };
        }),

      addBilling: (b) =>
        set((s) => {
          if (isStateDemo(s, b.projectId)) return {};
          return { billing: [...s.billing, { id: uid(), ...b }] };
        }),
      updateBilling: (id, patch) =>
        set((s) => {
          if (isItemInDemo(s, s.billing, id)) return {};
          const old = s.billing.find((b) => b.id === id);
          const updated = old ? { ...old, ...patch } : null;
          let notifications = s.notifications;
          // Status → odendi
          if (
            updated &&
            old &&
            old.status !== "odendi" &&
            updated.status === "odendi" &&
            s.currentUserId
          ) {
            const project = s.projects.find((p) => p.id === updated.projectId);
            notifications = pushNotification(notifications, {
              userId: s.currentUserId,
              projectId: updated.projectId,
              type: "decision",
              title: "Fatura ödendi",
              body: `${updated.invoiceNo ? updated.invoiceNo + " · " : ""}${updated.description}${project ? ` · ${project.name}` : ""} ödenmiş olarak işaretlendi.`,
              link: `/billing`,
            });
          }
          return {
            billing: s.billing.map((b) => (b.id === id ? { ...b, ...patch } : b)),
            notifications,
          };
        }),
      deleteBilling: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.billing, id)) return {};
          return { billing: s.billing.filter((b) => b.id !== id) };
        }),

      addSubcontractor: (sc) => {
        const item: Subcontractor = {
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
          ...sc,
        };
        set((s) => ({ subcontractors: [...s.subcontractors, item] }));
        return item;
      },
      updateSubcontractor: (id, patch) =>
        set((s) => ({
          subcontractors: s.subcontractors.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: now() } : x
          ),
        })),
      deleteSubcontractor: (id) =>
        set((s) => ({
          subcontractors: s.subcontractors.filter((x) => x.id !== id),
          // İlgili alt yüklenici faturalarını + hakediş planını sil
          billing: s.billing.filter((b) => b.subcontractorId !== id),
          paymentMilestones: s.paymentMilestones.filter((m) => m.subcontractorId !== id),
        })),

      addPaymentMilestone: (m) => {
        const item: PaymentMilestone = {
          id: uid(),
          createdAt: now(),
          updatedAt: now(),
          ...m,
        };
        set((s) => {
          if (isStateDemo(s, m.projectId)) return {};
          return { paymentMilestones: [...s.paymentMilestones, item] };
        });
        return item;
      },

      updatePaymentMilestone: (id, patch) =>
        set((s) => {
          if (isItemInDemo(s, s.paymentMilestones, id)) return {};
          return {
            paymentMilestones: s.paymentMilestones.map((m) =>
              m.id === id ? { ...m, ...patch, updatedAt: now() } : m
            ),
          };
        }),

      deletePaymentMilestone: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.paymentMilestones, id)) return {};
          return {
            paymentMilestones: s.paymentMilestones.filter((m) => m.id !== id),
          };
        }),

      setMilestonePayments: (id, payments, notes) =>
        set((s) => {
          if (isItemInDemo(s, s.paymentMilestones, id)) return s;
          const old = s.paymentMilestones.find((m) => m.id === id);
          if (!old) return s;
          // Tarihe göre sırala — son ödeme tarihi son satıra düşer
          const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
          const total = sorted.reduce((sum, p) => sum + p.amount, 0);
          const lastDate = sorted.length > 0 ? sorted[sorted.length - 1].date : undefined;

          // Durum belirleme — cancelled değişmez
          let status: PaymentMilestoneStatus = old.status;
          if (old.status !== "cancelled") {
            if (total <= 0) status = "planned";
            else if (total < old.plannedAmount - 0.005) status = "partial";
            else status = "realized";
          }

          const updated: PaymentMilestone = {
            ...old,
            payments: sorted,
            actualAmount: total > 0 ? total : undefined,
            actualDate: lastDate,
            status,
            notes: notes ?? old.notes,
            updatedAt: now(),
          };

          // ===== Fatura durumu auto-sync =====
          // Bu güncelleme sonrası tüm milestone'ların final hali
          const newMilestones = s.paymentMilestones.map((m) =>
            m.id === id ? updated : m
          );

          // Etkilenen fatura ID'leri — eski ve yeni payment'lardan
          const oldInvIds = new Set(
            (old.payments ?? []).map((p) => p.billingItemId).filter(Boolean) as string[]
          );
          const newInvIds = new Set(
            sorted.map((p) => p.billingItemId).filter(Boolean) as string[]
          );
          const affectedInvIds = new Set([...oldInvIds, ...newInvIds]);

          const updatedBilling = s.billing.map((b) => {
            if (b.status === "iptal") return b; // iptal'i değiştirme
            if (!affectedInvIds.has(b.id)) return b;

            // Tüm milestone'lar arasında bu faturaya bağlı ödemeleri topla
            let paidSum = 0;
            let lastDate: string | undefined;
            for (const m of newMilestones) {
              for (const p of m.payments ?? []) {
                if (p.billingItemId === b.id) {
                  paidSum += p.amount;
                  if (!lastDate || p.date > lastDate) lastDate = p.date;
                }
              }
            }

            // Durumu fatura tutarına göre belirle
            let newStatus: BillingItem["status"];
            let newPaidDate: string | undefined;
            if (paidSum <= 0) {
              newStatus = "gonderildi";
              newPaidDate = undefined;
            } else if (paidSum < b.amount - 0.005) {
              newStatus = "kismi";
              newPaidDate = lastDate;
            } else {
              newStatus = "odendi";
              newPaidDate = lastDate;
            }
            return { ...b, status: newStatus, paidDate: newPaidDate };
          });

          let notifications = s.notifications;
          if (s.currentUserId) {
            const wasIncomplete = (old.actualAmount ?? 0) < old.plannedAmount - 0.005;
            const isNowComplete = total >= old.plannedAmount - 0.005;
            if (wasIncomplete && isNowComplete && old.status !== "cancelled") {
              const project = s.projects.find((p) => p.id === updated.projectId);
              const dirLabel = updated.direction === "owner_incoming" ? "İşveren hakediş" : "Alt yüklenici hakediş";
              notifications = pushNotification(notifications, {
                userId: s.currentUserId,
                projectId: updated.projectId,
                type: "decision",
                title: `${dirLabel} tam alındı`,
                body: `${updated.description}${project ? ` · ${project.name}` : ""}`,
                link: `/billing`,
              });
            }
          }
          return {
            paymentMilestones: s.paymentMilestones.map((m) => (m.id === id ? updated : m)),
            billing: updatedBilling,
            notifications,
          };
        }),

      addBudgetCategory: (c) =>
        set((s) => {
          if (isStateDemo(s, c.projectId)) return {};
          return { budgetCategories: [...s.budgetCategories, { id: uid(), ...c }] };
        }),
      updateBudgetCategory: (id, patch) =>
        set((s) => {
          if (isItemInDemo(s, s.budgetCategories, id)) return {};
          return {
            budgetCategories: s.budgetCategories.map((c) =>
              c.id === id ? { ...c, ...patch } : c
            ),
          };
        }),
      deleteBudgetCategory: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.budgetCategories, id)) return {};
          return { budgetCategories: s.budgetCategories.filter((c) => c.id !== id) };
        }),

      addBudgetActual: (a) =>
        set((s) => {
          if (isStateDemo(s, a.projectId)) return {};
          return {
            budgetActuals: [...s.budgetActuals, { id: uid(), recordedAt: now(), ...a }],
          };
        }),

      addLookahead: (l) =>
        set((s) => {
          if (isStateDemo(s, l.projectId)) return {};
          return { lookahead: [...s.lookahead, { id: uid(), ...l }] };
        }),
      updateLookahead: (id, patch) =>
        set((s) => {
          if (isItemInDemo(s, s.lookahead, id)) return {};
          return {
            lookahead: s.lookahead.map((l) => (l.id === id ? { ...l, ...patch } : l)),
          };
        }),
      deleteLookahead: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.lookahead, id)) return {};
          return { lookahead: s.lookahead.filter((l) => l.id !== id) };
        }),
      toggleLookaheadDone: (id) =>
        set((s) => {
          if (isItemInDemo(s, s.lookahead, id)) return s;
          const old = s.lookahead.find((l) => l.id === id);
          const becameDone = old && !old.done;
          let notifications = s.notifications;
          if (becameDone && s.currentUserId && old) {
            const project = s.projects.find((p) => p.id === old.projectId);
            const kindLabel: Record<string, string> = {
              kritik_is: "Kritik iş",
              claim: "Claim",
              tutanak: "Tutanak",
              yazisma: "Yazışma",
              ihbar: "İhbar",
            };
            const kind = kindLabel[old.kind ?? "kritik_is"] ?? "Kayıt";
            notifications = pushNotification(notifications, {
              userId: s.currentUserId,
              projectId: old.projectId,
              type: "decision",
              title: `${kind} kapatıldı`,
              body: `${old.task}${project ? ` · ${project.name}` : ""}`,
              link: `/lookahead`,
            });
          }
          return {
            lookahead: s.lookahead.map((l) =>
              l.id === id ? { ...l, done: !l.done } : l
            ),
            notifications,
          };
        }),

      addAudit: (e) =>
        set((s) => ({
          auditLog: [...s.auditLog, { id: uid(), createdAt: now(), ...e }].slice(-1000),
        })),

      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { id: uid(), createdAt: now(), readAt: null, ...n },
            ...s.notifications,
          ].slice(0, 200),
        })),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, readAt: now() } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.readAt ? n : { ...n, readAt: now() }
          ),
        })),

      setPanelName: (name) => set({ panelName: name }),

      updateCurrentUser: (patch) =>
        set((s) => ({
          users: s.users.map((u) => (u.id === s.currentUserId ? { ...u, ...patch } : u)),
        })),

      // ───── Teslim Alma ─────
      ensureTeslimAlmaReport: (projectId) => {
        const existing = get().teslimAlma[projectId];
        if (existing) return existing;
        const user = get().users.find((u) => u.id === get().currentUserId);
        const today = toISODate(new Date());
        const fresh: TeslimAlmaReport = {
          projectId,
          meta: {
            inspectorName: user?.fullName ?? "",
            inspectionDate: today,
          },
          items: {},
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ teslimAlma: { ...s.teslimAlma, [projectId]: fresh } }));
        return fresh;
      },

      updateTeslimAlmaItem: (projectId, itemId, patch) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const cur = s.teslimAlma[projectId];
          const baseReport: TeslimAlmaReport = cur ?? {
            projectId,
            meta: { inspectionDate: toISODate(new Date()) },
            items: {},
            createdAt: now(),
            updatedAt: now(),
          };
          const updatedAt = now();
          const newItem: TeslimAlmaItemResult = {
            status: patch.status,
            condition: patch.condition,
            note: patch.note,
            updatedAt,
          };
          return {
            teslimAlma: {
              ...s.teslimAlma,
              [projectId]: {
                ...baseReport,
                items: { ...baseReport.items, [itemId]: newItem },
                updatedAt,
              },
            },
          };
        }),

      updateTeslimAlmaMeta: (projectId, patch) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const cur = s.teslimAlma[projectId];
          const baseReport: TeslimAlmaReport = cur ?? {
            projectId,
            meta: { inspectionDate: toISODate(new Date()) },
            items: {},
            createdAt: now(),
            updatedAt: now(),
          };
          return {
            teslimAlma: {
              ...s.teslimAlma,
              [projectId]: {
                ...baseReport,
                meta: { ...baseReport.meta, ...patch },
                updatedAt: now(),
              },
            },
          };
        }),

      resetTeslimAlmaReport: (projectId) =>
        set((s) => {
          if (isStateDemo(s, projectId)) return {};
          const user = s.users.find((u) => u.id === s.currentUserId);
          const today = toISODate(new Date());
          return {
            teslimAlma: {
              ...s.teslimAlma,
              [projectId]: {
                projectId,
                meta: {
                  inspectorName: user?.fullName ?? "",
                  inspectionDate: today,
                },
                items: {},
                createdAt: now(),
                updatedAt: now(),
              },
            },
          };
        }),
    }),
    {
      name: "ges-store",
      storage: createJSONStorage(() => localStorage),
      version: 5,
      migrate: (persistedState, version) => {
        let s = persistedState as Partial<StoreState>;
        // v1 → v2: eski "Konya GES 1" default seed'ini temizle.
        if (version < 2) {
          const filteredProjects = (s.projects ?? []).filter((p) => p.name !== "Konya GES 1");
          const removedIds = new Set(
            (s.projects ?? []).filter((p) => p.name === "Konya GES 1").map((p) => p.id)
          );
          const filteredPlanned = { ...(s.planned ?? {}) };
          const filteredRealized = { ...(s.realized ?? {}) };
          for (const id of removedIds) {
            delete filteredPlanned[id];
            delete filteredRealized[id];
          }
          s = {
            ...s,
            projects: filteredProjects,
            wbs: (s.wbs ?? []).filter((w) => !removedIds.has(w.projectId)),
            members: (s.members ?? []).filter((m) => !removedIds.has(m.projectId)),
            currentProjectId: removedIds.has(s.currentProjectId ?? "")
              ? null
              : s.currentProjectId ?? null,
            planned: filteredPlanned,
            realized: filteredRealized,
            _seeded: false,
          };
        }
        // v2 → v3: non-leaf WBS satırlarındaki disiplin/miktar/birim alanlarını temizle.
        if (version < 3) {
          s = {
            ...s,
            wbs: (s.wbs ?? []).map((w) =>
              w.isLeaf
                ? w
                : { ...w, discipline: undefined, quantity: 0, unit: "" }
            ),
          };
        }
        // v3 → v4: Project.mainContractorName alanı eklendi.
        // Boş projeler için: o projenin personel kayıtlarında en sık geçen firmayı set et
        // (genellikle "ana yüklenici / panel sahibi"). Hiç personel yoksa undefined kalır.
        if (version < 4) {
          const personnelList = s.personnelMaster ?? [];
          const updatedProjects = (s.projects ?? []).map((p) => {
            if (p.mainContractorName) return p;
            const counts: Record<string, number> = {};
            for (const pm of personnelList) {
              if (!pm.company) continue;
              counts[pm.company] = (counts[pm.company] ?? 0) + 1;
            }
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
            return top ? { ...p, mainContractorName: top[0] } : p;
          });
          s = { ...s, projects: updatedProjects };
        }
        // v4 → v5: isDemo alanı opsiyonel. Otomatik işaretleme YAPMAZ — kullanıcı kendi
        // projesini Settings'ten manuel demo olarak işaretler.
        return s as StoreState;
      },
    }
  )
);

// ============================================================
// Selector helpers — stable empty references + useMemo to avoid
// infinite re-renders from new object/array creation in selectors
// ============================================================
import { useMemo } from "react";

const EMPTY_DQM: DateQuantityMap = Object.freeze({}) as DateQuantityMap;
const EMPTY_WBS: WbsItem[] = Object.freeze([]) as unknown as WbsItem[];
const EMPTY_MEMBERS: ProjectMember[] = Object.freeze([]) as unknown as ProjectMember[];

export const useCurrentUser = () => {
  const userId = useStore((s) => s.currentUserId);
  const users = useStore((s) => s.users);
  return useMemo(() => users.find((u) => u.id === userId) || null, [users, userId]);
};

/** Demo (örnek) proje tespiti — sadece kullanıcının manuel işaretlediği projeler. */
export function isDemoProject(p: { isDemo?: boolean } | null | undefined): boolean {
  if (!p) return false;
  return p.isDemo === true;
}

/** Demo proje raporlama tarihi — her zaman 15 Mayıs 2026'da donmuş. */
export const DEMO_REPORT_DATE = "2026-05-15";

export const useCurrentProject = () => {
  const id = useStore((s) => s.currentProjectId);
  const projects = useStore((s) => s.projects);
  // reportDate her zaman bugün — kullanıcı ayarlardan değiştiremez. Demo projede ise
  // sabit DEMO_REPORT_DATE kullanılır.
  return useMemo(() => {
    const p = projects.find((p) => p.id === id);
    if (!p) return null;
    const reportDate = isDemoProject(p) ? DEMO_REPORT_DATE : toISODate(new Date());
    return { ...p, reportDate };
  }, [projects, id]);
};

export const useProjectWbs = (projectId: string | null | undefined) => {
  const wbs = useStore((s) => s.wbs);
  return useMemo(
    () =>
      projectId
        ? wbs.filter((w) => w.projectId === projectId && !w.deletedAt)
        : EMPTY_WBS,
    [wbs, projectId]
  );
};

export const useProjectPlanned = (projectId: string | null | undefined): DateQuantityMap => {
  const planned = useStore((s) => s.planned);
  return projectId ? planned[projectId] || EMPTY_DQM : EMPTY_DQM;
};

export const useProjectRealized = (projectId: string | null | undefined): DateQuantityMap => {
  const realized = useStore((s) => s.realized);
  return projectId ? realized[projectId] || EMPTY_DQM : EMPTY_DQM;
};

/**
 * Projenin baseline planını döner.
 *  - Baseline kayıtlıysa onu kullanır (PMP onaylı orijinal plan).
 *  - Baseline boşsa `planned`'a fallback yapar — kullanıcı henüz baseline almamış olsa
 *    bile Timeline boş kalmasın.
 *
 * `baselineSetAt[projectId]` ile baseline'ın hangi tarihte donduğunu da öğrenmek için
 * `useProjectBaselineSetAt` ayrı hook'tur.
 */
export const useProjectBaseline = (projectId: string | null | undefined): DateQuantityMap => {
  const baseline = useStore((s) => s.baseline);
  const planned = useStore((s) => s.planned);
  return useMemo(() => {
    if (!projectId) return EMPTY_DQM;
    const bl = baseline[projectId];
    if (bl && Object.keys(bl).length > 0) return bl;
    return planned[projectId] || EMPTY_DQM;
  }, [projectId, baseline, planned]);
};

/** Baseline'ın hangi ISO tarihte donduğu — yoksa null. */
export const useProjectBaselineSetAt = (projectId: string | null | undefined): string | null => {
  const baselineSetAt = useStore((s) => s.baselineSetAt);
  return projectId ? (baselineSetAt[projectId] ?? null) : null;
};

/** True dönerse proje baseline'a sahip; false ise fallback planned veridir. */
export const useProjectHasBaseline = (projectId: string | null | undefined): boolean => {
  const baseline = useStore((s) => s.baseline);
  if (!projectId) return false;
  const bl = baseline[projectId];
  return Boolean(bl && Object.keys(bl).length > 0);
};

export const useProjectMembers = (projectId: string | null | undefined) => {
  const members = useStore((s) => s.members);
  return useMemo(
    () => (projectId ? members.filter((m) => m.projectId === projectId) : EMPTY_MEMBERS),
    [members, projectId]
  );
};

const EMPTY_NOTIFICATIONS: NotificationItem[] = [];

export const useMyNotifications = () => {
  const userId = useStore((s) => s.currentUserId);
  const items = useStore((s) => s.notifications);
  return useMemo(
    () => (userId ? items.filter((n) => n.userId === userId) : EMPTY_NOTIFICATIONS),
    [items, userId]
  );
};

/** Panel adı — kullanıcı özel ayarlamadıysa otomatik olarak ad soyad döner. */
export const usePanelName = () => {
  const stored = useStore((s) => s.panelName);
  const userId = useStore((s) => s.currentUserId);
  const users = useStore((s) => s.users);
  return useMemo(() => {
    const trimmed = (stored ?? "").trim();
    if (trimmed) return trimmed;
    const u = users.find((x) => x.id === userId);
    return u?.fullName ?? "";
  }, [stored, users, userId]);
};

export const useUnreadCount = () => {
  const userId = useStore((s) => s.currentUserId);
  const items = useStore((s) => s.notifications);
  return useMemo(
    () => (userId ? items.filter((n) => n.userId === userId && !n.readAt).length : 0),
    [items, userId]
  );
};
