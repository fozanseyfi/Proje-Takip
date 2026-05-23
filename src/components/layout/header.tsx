"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Menu,
  FolderKanban,
  Building2,
} from "lucide-react";
import { useStore, useCurrentProject, useCurrentUser, useUnreadCount, usePanelName } from "@/lib/store";
import { cn } from "@/lib/utils";
import { allNavItems, isMainScope } from "./nav-config";
import { ProjectStatsTicker } from "./project-stats-ticker";
import { isSandboxMode } from "@/lib/sandbox";

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const currentProject = useCurrentProject();
  const currentUser = useCurrentUser();
  const unreadCount = useUnreadCount();
  const panelName = usePanelName();
  const pathname = usePathname();
  const sandbox = isSandboxMode();

  // Sadece proje scope'unda proje gösterimi yap. Sandbox modunda proje seçici gizli
  // (kullanıcı tek proje üzerinde çalışsın diye).
  const mainMode = isMainScope(pathname);
  const showProjectInHeader = !sandbox && !mainMode && currentProject != null;

  // Current page label
  const currentNav = useMemo(
    () => allNavItems.find((n) => pathname === n.href || pathname?.startsWith(n.href + "/")),
    [pathname]
  );

  const userInitial = currentUser?.fullName?.[0]?.toUpperCase() ?? "K";

  return (
    <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 flex items-center gap-3 sm:gap-5 bg-white border-b border-border">
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-bg3 text-text2"
          aria-label="Menü"
        >
          <Menu size={18} />
        </button>
      )}

      {/* SOL: Panel adı + (proje scope ise) aktif proje */}
      <div className="flex items-center gap-2 min-w-0">
        {sandbox && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow text-white shadow-soft">
            <span className="text-base">🧪</span>
            <span className="font-bold text-[11.5px] uppercase tracking-widest">
              Planlama Atölyesi
            </span>
          </div>
        )}
        {!sandbox && panelName && (
          <Link
            href="/account"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent/10 hover:bg-accent/15 text-accent transition-colors"
            title="Panel adını düzenle"
          >
            <Building2 size={13} />
            <strong className="text-shimmer text-[12.5px] font-bold tracking-tight max-w-[200px] truncate">
              {panelName}
            </strong>
          </Link>
        )}

        {showProjectInHeader && (
          <div
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg2 border border-border ml-1"
            title="Aktif proje"
          >
            <FolderKanban size={13} className="text-text3" />
            <span className="text-text3 text-[11px] uppercase font-bold tracking-wider">Proje</span>
            <strong className="text-[12.5px] font-semibold text-text truncate max-w-[200px]">
              {currentProject!.name}
            </strong>
          </div>
        )}

        {/* Mobile başlık */}
        <div className="md:hidden flex-1 min-w-0">
          {currentNav ? (
            <div className="text-sm font-bold text-text truncate">{currentNav.label}</div>
          ) : (
            <div className="text-sm font-bold text-text truncate">
              {showProjectInHeader ? currentProject!.name : panelName}
            </div>
          )}
        </div>
      </div>

      {/* ORTA-SAĞ: Proje stat ticker — sürekli rotasyon (sandbox'ta gizli) */}
      <div className="flex-1 flex items-center justify-end">
        {!sandbox && <ProjectStatsTicker />}
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/notifications"
          aria-label="Bildirimler"
          title="Bildirimler"
          className="relative p-2 rounded-lg hover:bg-bg3 text-text2 hover:text-text transition-colors"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 inline-flex items-center justify-center rounded-full bg-red text-white text-[9px] font-bold ring-2 ring-white tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <UserMenu userInitial={userInitial} currentUser={currentUser} />
      </div>
    </header>
  );
}

function UserMenu({
  userInitial,
  currentUser,
}: {
  userInitial: string;
  currentUser: ReturnType<typeof useCurrentUser>;
}) {
  return (
    <div className="relative group">
      <button className="flex items-center gap-2.5 pl-1 pr-2 sm:pr-3 py-1 rounded-lg hover:bg-bg2 transition-colors">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: "linear-gradient(135deg, #10b981 0%, #047857 100%)" }}
        >
          {userInitial}
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-xs font-semibold text-text leading-tight">
            {currentUser?.fullName ?? "—"}
          </div>
          <div className="text-[10px] text-text3 leading-tight">
            {currentUser?.isSuperAdmin ? "Yönetici" : "Kullanıcı"}
          </div>
        </div>
        <ChevronDown size={14} className="text-text3 hidden sm:block" />
      </button>
      <div className="absolute top-12 right-0 min-w-[200px] py-1 rounded-xl bg-white border border-border shadow-medium z-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <Link
          href="/account"
          className="flex items-center gap-2 px-3 py-2 text-sm text-text2 hover:bg-bg2 hover:text-text"
        >
          <UserIcon size={14} /> Profilim
        </Link>
        <div className="border-t border-border my-1" />
        <Link
          href="/login"
          className="flex items-center gap-2 px-3 py-2 text-sm text-text2 hover:bg-bg2 hover:text-text"
        >
          <LogOut size={14} /> Çıkış
        </Link>
      </div>
    </div>
  );
}
