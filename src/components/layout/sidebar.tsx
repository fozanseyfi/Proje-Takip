"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ChevronsLeft, ChevronsRight, Globe, ArrowRight } from "lucide-react";
import { navGroups, mainNavGroups, portfolioItem, isMainScope, type NavTone, type NavGroup } from "./nav-config";
import { useCurrentUser } from "@/lib/store";
import { Logo, LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { isSandboxMode, SANDBOX_ALLOWED_ROUTES } from "@/lib/sandbox";

// Tone → renkli stiller
const TONE_STYLES: Record<NavTone, { dot: string; icon: string; activeBg: string; activeText: string }> = {
  accent: { dot: "bg-accent",  icon: "text-accent",  activeBg: "bg-accent/10",  activeText: "text-accent" },
  blue:   { dot: "bg-blue",    icon: "text-blue",    activeBg: "bg-blue/10",    activeText: "text-blue" },
  yellow: { dot: "bg-yellow",  icon: "text-yellow",  activeBg: "bg-yellow/12",  activeText: "text-yellow" },
  green:  { dot: "bg-green",   icon: "text-green",   activeBg: "bg-green/10",   activeText: "text-green" },
  purple: { dot: "bg-purple",  icon: "text-purple",  activeBg: "bg-purple/10",  activeText: "text-purple" },
  red:    { dot: "bg-red",     icon: "text-red",     activeBg: "bg-red/10",     activeText: "text-red" },
  gray:   { dot: "bg-text3",   icon: "text-text3",   activeBg: "bg-bg3",        activeText: "text-text" },
};

function PortfolioBlock({ collapsed, onItemClick }: { collapsed: boolean; onItemClick?: () => void }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  if (!user?.isSuperAdmin) return null;
  const active = pathname === portfolioItem.href || pathname?.startsWith(portfolioItem.href + "/");

  if (collapsed) {
    return (
      <div className="px-2 pt-3 pb-2">
        <Link
          href={portfolioItem.href}
          onClick={onItemClick}
          title="Portfolio"
          className={cn(
            "flex items-center justify-center w-12 h-10 mx-auto rounded-lg transition-all",
            active
              ? "bg-gradient-to-br from-accent to-blue text-white shadow-soft"
              : "bg-bg2 text-text2 hover:bg-bg3"
          )}
        >
          <Globe size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-2">
      <Link
        href={portfolioItem.href}
        onClick={onItemClick}
        className={cn(
          "group block rounded-xl overflow-hidden shadow-soft border transition-all relative",
          active
            ? "border-accent/30 shadow-medium"
            : "border-border hover:border-accent/40 hover:shadow-medium"
        )}
      >
        <div className="bg-gradient-to-br from-accent via-accent/90 to-blue text-white p-3.5 relative">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-8 -mt-8" />
          <div className="absolute bottom-0 left-1/2 w-12 h-12 bg-white/5 rounded-full -mb-6" />
          <div className="relative flex items-center gap-2.5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 backdrop-blur-sm shrink-0">
              <Globe size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[13px] font-extrabold tracking-tight leading-none">Portfolio</div>
              <div className="text-[10px] font-medium opacity-85 mt-0.5">Tüm Projeler</div>
            </div>
            <ArrowRight
              size={14}
              className={cn("opacity-70 transition-transform shrink-0", "group-hover:translate-x-0.5")}
            />
          </div>
        </div>
      </Link>
    </div>
  );
}

function NavList({
  groups,
  onItemClick,
  collapsed = false,
}: {
  groups: NavGroup[];
  onItemClick?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const user = useCurrentUser();

  return (
    <nav className={cn("py-1.5 space-y-2", collapsed ? "px-2" : "px-3")}>
      {groups.map((group) => {
        const items = group.items.filter((i) => !i.superAdminOnly || user?.isSuperAdmin);
        if (items.length === 0) return null;
        const t = TONE_STYLES[group.tone];
        return (
          <div key={group.title}>
            {!collapsed ? (
              <div className="px-2 mb-1 flex items-center gap-1.5">
                <span className={cn("w-1 h-3 rounded-full", t.dot)} />
                <span className="text-[9px] font-bold uppercase tracking-[1.2px] text-text3">
                  {group.title}
                </span>
              </div>
            ) : (
              <div className="h-px bg-border mx-2 mb-1 first:hidden" />
            )}
            <div className="space-y-px">
              {items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center rounded-md text-[12.5px] transition-all relative group",
                      collapsed
                        ? "justify-center w-12 h-8 mx-auto"
                        : "gap-2.5 px-2.5 h-7",
                      active
                        ? cn(t.activeBg, t.activeText, "font-semibold")
                        : "text-text2 hover:bg-bg2 hover:text-text font-medium"
                    )}
                  >
                    <Icon
                      size={15}
                      className={cn(active ? t.icon : cn(t.icon, "opacity-65 group-hover:opacity-100"), "shrink-0")}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {active && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.dot)} />}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function BrandBlock({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("py-3 border-b border-border", collapsed ? "px-2" : "px-3")}>
      <Link
        href="/portfolio"
        className={cn("block", collapsed && "flex justify-center")}
        title={collapsed ? "Portfolio — Tüm Projeler" : "Portfolio — Tüm Projeler"}
      >
        {collapsed ? <LogoMark size={28} /> : <Logo size={28} compact textClassName="text-sm" />}
      </Link>
    </div>
  );
}

function ScopeBadge({ mainMode }: { mainMode: boolean }) {
  return (
    <div className="px-3 pt-2 pb-1">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider",
          mainMode
            ? "bg-blue/10 text-blue"
            : "bg-accent/10 text-accent"
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", mainMode ? "bg-blue" : "bg-accent")} />
        {mainMode ? "Çalışma Alanı" : "Proje Modülleri"}
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const mainMode = isMainScope(pathname);
  const sandbox = isSandboxMode();
  const rawGroups = mainMode ? mainNavGroups : navGroups;
  // Sandbox modunda sadece allow-list edilen route'lar görünür.
  const groups = sandbox
    ? rawGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) =>
            SANDBOX_ALLOWED_ROUTES.some((p) => i.href === p || i.href.startsWith(p + "/"))
          ),
        }))
        .filter((g) => g.items.length > 0)
    : rawGroups;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 border-r sticky top-0 h-screen overflow-y-auto overflow-x-hidden transition-[width,background-color] duration-200 ease-out",
        // Çalışma Alanı (portfolio / workspace) — hafif mavi tint; Proje Modülleri — beyaz
        mainMode
          ? "bg-blue/5 border-blue/15"
          : "bg-white border-border",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {onToggleCollapsed && (
        <div className={cn("flex border-b border-border bg-bg2/30", collapsed ? "px-2 py-1.5 justify-center" : "px-3 py-1.5 justify-end")}>
          <button
            onClick={onToggleCollapsed}
            className={cn(
              "inline-flex items-center gap-1.5 h-6 rounded-md transition-all",
              "text-text3 hover:text-accent hover:bg-white",
              collapsed ? "w-8 justify-center" : "px-2"
            )}
            title={collapsed ? "Sidebar'ı aç" : "Sidebar'ı daralt"}
          >
            {!collapsed && (
              <span className="text-[9px] font-bold uppercase tracking-wider">Daralt</span>
            )}
            {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
          </button>
        </div>
      )}

      <BrandBlock collapsed={collapsed} />
      <PortfolioBlock collapsed={collapsed} />
      {!collapsed && <ScopeBadge mainMode={mainMode} />}
      <NavList groups={groups} collapsed={collapsed} />
    </aside>
  );
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const mainMode = isMainScope(pathname);
  const sandbox = isSandboxMode();
  const rawGroups = mainMode ? mainNavGroups : navGroups;
  const groups = sandbox
    ? rawGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((i) =>
            SANDBOX_ALLOWED_ROUTES.some((p) => i.href === p || i.href.startsWith(p + "/"))
          ),
        }))
        .filter((g) => g.items.length > 0)
    : rawGroups;
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-40 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute top-0 left-0 bottom-0 w-72 bg-white border-r border-border shadow-large overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-4 h-14 border-b border-border bg-white z-10">
          <Link href="/portfolio" onClick={onClose} className="block" title="Portfolio — Tüm Projeler">
            <Logo size={28} compact textClassName="text-base" />
          </Link>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg3 text-text3 hover:text-text">
            <X size={16} />
          </button>
        </div>
        <PortfolioBlock collapsed={false} onItemClick={onClose} />
        <ScopeBadge mainMode={mainMode} />
        <NavList groups={groups} onItemClick={onClose} />
      </div>
    </div>
  );
}
