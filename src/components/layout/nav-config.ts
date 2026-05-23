import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Globe,
  BarChart3,
  FolderTree,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  HardHat,
  Truck,
  FileText,
  ShoppingCart,
  Receipt,
  Wallet,
  AlertTriangle,
  UserCog,
  Cog,
  History,
  Settings,
  Users,
  Share2,
  BookOpen,
  Briefcase,
  Building,
  User,
  Bell,
  MessageCircle,
  Boxes,
  Database,
  ClipboardCheck,
} from "lucide-react";

export type NavTone = "accent" | "blue" | "yellow" | "green" | "purple" | "red" | "gray";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
  mobile?: boolean;
}

export interface NavGroup {
  title: string;
  tone: NavTone;
  items: NavItem[];
}

/** Portfolio en üstte ayrı renderlandığı için navGroups'a dahil DEĞİL. */
export const portfolioItem: NavItem = {
  href: "/portfolio",
  label: "Portfolio",
  icon: Globe,
  superAdminOnly: true,
};

export const navGroups: NavGroup[] = [
  {
    title: "Genel",
    tone: "accent",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
      { href: "/timeline", label: "Timeline & Gantt", icon: BarChart3 },
      { href: "/plan-status", label: "Plan / Gerçekleşme", icon: CheckCircle2 },
      { href: "/monthly-timesheet", label: "Aylık Puantaj", icon: CalendarRange },
    ],
  },
  {
    title: "Planlama",
    tone: "blue",
    items: [
      { href: "/wbs", label: "WBS Yapısı", icon: FolderTree },
      { href: "/planning", label: "Planlama", icon: CalendarDays },
    ],
  },
  {
    title: "Günlük Operasyon",
    tone: "yellow",
    items: [
      { href: "/realization", label: "Günlük Gerçekleşme", icon: CheckCircle2, mobile: true },
      { href: "/lookahead", label: "Kritik & Tutanak", icon: AlertTriangle },
      { href: "/personnel", label: "Personel Puantajı", icon: HardHat, mobile: true },
      { href: "/machines", label: "Makine Puantajı", icon: Truck },
      { href: "/daily-report", label: "Günlük Rapor", icon: FileText, mobile: true },
    ],
  },
  {
    title: "Finansal",
    tone: "green",
    items: [
      { href: "/procurement", label: "Procurement", icon: ShoppingCart },
      { href: "/billing", label: "Hakediş & Fatura", icon: Receipt },
      { href: "/labor-cost", label: "Personel & Makina Maliyeti", icon: HardHat },
      { href: "/budget", label: "Bütçe & CPI", icon: Wallet },
    ],
  },
  {
    title: "Proje Takımı",
    tone: "purple",
    items: [
      { href: "/team-personnel", label: "Personel", icon: HardHat },
      { href: "/team-machines", label: "Makineler", icon: Truck },
      { href: "/team-subcontractors", label: "Alt Yükleniciler", icon: Building },
    ],
  },
  {
    title: "Yönetim",
    tone: "gray",
    items: [
      { href: "/teslim-alma", label: "Teslim Alma Listesi", icon: ClipboardCheck },
      { href: "/settings", label: "Proje Ayarları", icon: Settings },
    ],
  },
];

/** Ana Sidebar — portfolio + workspace scope */
export const mainNavGroups: NavGroup[] = [
  {
    title: "Çalışma Alanı",
    tone: "accent",
    items: [
      { href: "/projects", label: "Projeler", icon: Briefcase },
      { href: "/customers", label: "Müşteriler", icon: Building },
      { href: "/master/personnel", label: "Personel Master Data", icon: UserCog },
      { href: "/master/machines", label: "Makine Master Data", icon: Cog },
      { href: "/master/subcontractors", label: "Alt Yüklenici Master", icon: Truck },
    ],
  },
  {
    title: "Yönetim",
    tone: "blue",
    items: [
      { href: "/account", label: "Profilim", icon: User },
      { href: "/users", label: "Kullanıcılar", icon: Users },
      { href: "/share", label: "Paylaşım Linkleri", icon: Share2 },
      { href: "/audit", label: "Aktivite Kayıtları", icon: History },
      { href: "/notifications", label: "Bildirimler", icon: Bell },
      { href: "/backup", label: "Veri Yedeği", icon: Database },
    ],
  },
  {
    title: "Destek",
    tone: "purple",
    items: [
      { href: "/how-it-works", label: "Nasıl Çalışır", icon: BookOpen },
      { href: "/contact", label: "İletişime Geç", icon: MessageCircle },
    ],
  },
  {
    title: "Diğer Platformlar",
    tone: "yellow",
    items: [
      { href: "/platforms", label: "Diğer Platformlar", icon: Boxes },
    ],
  },
];

/** Hangi route'larda ANA sidebar (workspace) gösterilir */
const MAIN_SCOPE_PREFIXES = [
  "/portfolio",
  "/projects",
  "/customers",
  "/users",
  "/share",
  "/audit",
  "/account",
  "/notifications",
  "/contact",
  "/platforms",
  "/how-it-works",
  "/master",
];

export function isMainScope(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return MAIN_SCOPE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export const allNavItems: NavItem[] = [
  portfolioItem,
  ...navGroups.flatMap((g) => g.items),
  ...mainNavGroups.flatMap((g) => g.items),
];

export const mobileNavItems = allNavItems.filter((i) => i.mobile);
