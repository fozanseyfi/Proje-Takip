"use client";

/**
 * PageLoaderOverlay
 *  - useUiLoading store'una bağlı, count > 0 ise ekranı kaplar.
 *  - Backdrop blur + LogoLoader + opsiyonel label.
 *
 * NavigationLoader (aynı dosyada)
 *  - Tüm same-origin <a>/<Link> tıklamalarını yakalar, overlay'i tetikler.
 *  - usePathname değişimini izleyip otomatik kapatır.
 *  - 8 saniye sonra zorla reset (safety) — pathname değişmediği edge case'lerde
 *    stale overlay kalmasın.
 *  - Sadece sol fare tuşu + modifier'sız tıklamalar (yeni sekmede aç vb. atla).
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useUiLoading } from "@/lib/ui-loading";
import { LogoLoader } from "@/components/brand/logo-loader";

const NAV_LOADING_LABEL = "Yükleniyor";
const SAFETY_TIMEOUT_MS = 8000;

export function PageLoaderOverlay() {
  const visible = useUiLoading((s) => s.count > 0);
  const label = useUiLoading((s) => s.label);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center animate-overlay-fade"
      style={{
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5">
        <LogoLoader size={104} />

        <div className="flex flex-col items-center gap-3 max-w-sm text-center px-4">
          <span
            className="text-white font-display font-extrabold tracking-tight text-base"
            style={{ animation: "loader-text-dim 1.4s ease-in-out infinite" }}
          >
            {label ?? NAV_LOADING_LABEL}
            <DotPulse />
          </span>

          {/* İnce indeterminate bar */}
          <div
            className="relative w-56 h-1 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <span
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #34d399 35%, #10b981 50%, #34d399 65%, transparent 100%)",
                animation: "loader-bar 1.4s ease-in-out infinite",
              }}
            />
          </div>

          <span className="text-[10.5px] font-mono uppercase tracking-[2px] text-emerald-300/70">
            Proje Yönetim Platformu
          </span>
        </div>
      </div>
    </div>
  );
}

function DotPulse() {
  // Üç nokta — sırayla yanar
  return (
    <span className="inline-flex ml-0.5 gap-0.5 align-baseline">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block w-1 h-1 rounded-full bg-emerald-300"
          style={{
            animation: `loader-text-dim 1.4s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Same-origin link tıklamalarını yakalayıp loading'i tetikler.
 * AppShell içinde mount edilmelidir.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const start = useUiLoading((s) => s.start);
  const reset = useUiLoading((s) => s.reset);
  const navInFlightRef = useRef(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPathnameRef = useRef(pathname);

  // Click listener — tüm document seviyesinde
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      // Modifier veya sol-dışı tuş → tarayıcı yeni-sekme/window açar, geçiş yok
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // En yakın <a> elementini bul
      const target = e.target as Element | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      // download attribute → dosya indirme
      if (anchor.hasAttribute("download")) return;
      // Aynı origin ve hash-only navigation (sayfa içi anchor) → atla
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Aynı path + hash → loading başlatma
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      // mailto / tel / blob — atla (yukarıda new URL geçti ama yine de kontrol)
      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return;
      }

      // Bu bir navigation — overlay aç
      navInFlightRef.current = true;
      start(NAV_LOADING_LABEL);

      // Safety net — 8 sn sonra zorla kapat
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        if (navInFlightRef.current) {
          navInFlightRef.current = false;
          reset();
        }
      }, SAFETY_TIMEOUT_MS);
    }

    document.addEventListener("click", onDocClick, true);
    return () => {
      document.removeEventListener("click", onDocClick, true);
    };
  }, [start, reset]);

  // pathname değişimi → loading'i kapat (navigation tamamlandı)
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      if (navInFlightRef.current) {
        navInFlightRef.current = false;
        if (safetyTimerRef.current) {
          clearTimeout(safetyTimerRef.current);
          safetyTimerRef.current = null;
        }
        // Sayfa içeriği için kısa bir nefes ver — fade tamamlansın
        reset();
      }
    }
  }, [pathname, reset]);

  // Tarayıcı geri/ileri butonu — popstate
  useEffect(() => {
    function onPopState() {
      navInFlightRef.current = true;
      start(NAV_LOADING_LABEL);
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = setTimeout(() => {
        navInFlightRef.current = false;
        reset();
      }, SAFETY_TIMEOUT_MS);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [start, reset]);

  return null;
}
