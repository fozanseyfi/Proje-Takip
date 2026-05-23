/**
 * LogoLoader — Animasyonlu brand logo (sayfa geçişlerinde + işlem beklemelerinde).
 *
 * Katmanlar (alt → üst):
 *   1. LogoMark — koyu slate gradient zemin + boş bars şekli (opak gri ton)
 *   2. Emerald katman — aynı bars şekli ama brand renginde, clip-path ile alttan
 *      yukarı dolar (logo-fill-loop), sonsuz döngü
 *   3. Shimmer band — yukarıya doğru kayan parlak çizgi
 *   4. Accent dot — sağ üstte nefes alır
 *
 * Glow halkası dış kapsayıcıda; nefes alan emerald shadow.
 */

import { cn } from "@/lib/utils";

export function LogoLoader({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const dotSize = Math.max(8, Math.round(size * 0.16));
  const barsSize = Math.round(size * 0.55);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl relative overflow-hidden",
        className
      )}
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
        animation: "logo-glow-pulse 2s ease-in-out infinite",
      }}
      role="status"
      aria-label="Yükleniyor"
    >
      {/* Katman 1: temel boş bars (mat gri) */}
      <svg
        width={barsSize}
        height={barsSize}
        viewBox="0 0 24 24"
        fill="none"
        className="absolute z-[1]"
        style={{ color: "rgba(255,255,255,0.18)" }}
      >
        <rect x="3" y="14" width="4.5" height="7" rx="1" fill="currentColor" />
        <rect x="9.75" y="9" width="4.5" height="12" rx="1" fill="currentColor" />
        <rect x="16.5" y="4" width="4.5" height="17" rx="1" fill="currentColor" />
      </svg>

      {/* Katman 2: emerald dolu bars — clip-path ile alttan yukarı animasyon */}
      <svg
        width={barsSize}
        height={barsSize}
        viewBox="0 0 24 24"
        fill="none"
        className="absolute z-[2]"
        style={{
          color: "#10b981",
          animation: "logo-fill-loop 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite",
          filter: "drop-shadow(0 0 6px rgba(16, 185, 129, 0.6))",
        }}
      >
        <rect x="3" y="14" width="4.5" height="7" rx="1" fill="currentColor" />
        <rect x="9.75" y="9" width="4.5" height="12" rx="1" fill="currentColor" />
        <rect x="16.5" y="4" width="4.5" height="17" rx="1" fill="currentColor" />
      </svg>

      {/* Katman 3: yukarı kayan parlama bandı */}
      <span
        className="absolute inset-x-0 z-[3] pointer-events-none"
        style={{
          height: "30%",
          background:
            "linear-gradient(to top, rgba(255,255,255,0) 0%, rgba(167, 243, 208, 0.6) 50%, rgba(255,255,255,0) 100%)",
          animation: "logo-shimmer-pan 1.8s linear infinite",
          mixBlendMode: "screen",
        }}
      />

      {/* Katman 4: accent dot (sağ üst) — kalp atışı */}
      <span
        className="absolute rounded-full bg-accent z-[4]"
        style={{
          width: dotSize,
          height: dotSize,
          top: Math.round(size * 0.13),
          right: Math.round(size * 0.13),
          boxShadow: "0 0 0 2px #0f172a, 0 0 12px rgba(16, 185, 129, 0.8)",
          animation: "logo-dot-beat 1.2s ease-in-out infinite",
        }}
      />
    </span>
  );
}
