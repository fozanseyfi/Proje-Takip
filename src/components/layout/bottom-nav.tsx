"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { mobileNavItems } from "./nav-config";
import { cn } from "@/lib/utils";
import { useMyNotifications } from "@/lib/store";

/**
 * Mobil bottom navigation — 4 kısayol + 1 menü butonu.
 *
 * İyileştirmeler:
 * - iPhone notch / home indicator için safe-area-inset padding
 * - Aktif sekme: gradient bg + büyüyen icon + üst çizgi
 * - Tap target alanı min 56px (önerilen Apple/Material 48-56px)
 * - Bildirim badge'i menü butonunda (okunmamış sayısı)
 * - Smooth transitions (active scale, fade)
 */
export function BottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const notifications = useMyNotifications();
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-border grid grid-cols-5 shadow-large"
      style={{
        // iPhone safe area — home indicator için
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
      aria-label="Mobil navigasyon"
    >
      {mobileNavItems.slice(0, 4).map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname?.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 transition-all duration-200 select-none",
              "min-h-[56px] touch-manipulation active:scale-95",
              active ? "text-accent" : "text-text3 hover:text-text2"
            )}
            aria-current={active ? "page" : undefined}
          >
            {/* Aktif sekme üst-çubuk */}
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-b-full bg-accent" />
            )}
            {/* Aktif sekme arka plan gradient */}
            {active && (
              <span className="absolute inset-x-2 inset-y-1 -z-10 rounded-xl bg-gradient-to-b from-accent/10 to-accent/0" />
            )}
            <Icon
              size={active ? 22 : 20}
              className={cn("transition-all", active && "drop-shadow-[0_1px_3px_rgba(16,185,129,0.35)]")}
            />
            <span
              className={cn(
                "text-[10px] leading-tight font-semibold transition-all",
                active && "font-extrabold"
              )}
            >
              {item.label.split(" ")[0]}
            </span>
          </Link>
        );
      })}

      {/* MENÜ butonu */}
      <button
        type="button"
        onClick={onMenuClick}
        className="relative flex flex-col items-center justify-center gap-0.5 text-text3 hover:text-text2 transition-all min-h-[56px] touch-manipulation active:scale-95 select-none"
        aria-label="Menüyü aç"
      >
        <div className="relative">
          <Menu size={20} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red text-white text-[9px] font-extrabold leading-none border border-white shadow-soft"
              title={`${unreadCount} okunmamış bildirim`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        <span className="text-[10px] leading-tight font-semibold">Menü</span>
      </button>
    </nav>
  );
}
