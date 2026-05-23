import { cn } from "@/lib/utils";

/**
 * Marka: Proje Yönetim Platformu
 * - Logo işareti: koyu slate zeminde beyaz "stacked bars" (proje fazları)
 *   ve sağ üstte küçük emerald nokta (canlı / aktif).
 * - Renk paleti: slate-900 → slate-700 gradient (profesyonel, sektör-bağımsız).
 */

export function Logo({
  size = 28,
  showText = true,
  className,
  textClassName,
  compact = false,
}: {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {showText && (
        <div className="leading-tight min-w-0">
          <div className={cn("font-display font-extrabold text-text tracking-tight truncate", textClassName)}>
            Proje Yönetim <span className="text-shimmer">Platformu</span>
          </div>
          {!compact && (
            <div className="text-[10px] text-text3 font-medium tracking-wider uppercase mt-0.5">
              EPC · Saha · Finansal
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl shadow-sm relative overflow-hidden",
        className
      )}
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
      }}
    >
      <BarsMark size={Math.round(size * 0.55)} />
      {/* Sağ üst accent nokta */}
      <span
        className="absolute rounded-full bg-accent shadow-[0_0_0_2px_rgba(15,23,42,1)]"
        style={{
          width: Math.max(4, Math.round(size * 0.18)),
          height: Math.max(4, Math.round(size * 0.18)),
          top: Math.round(size * 0.14),
          right: Math.round(size * 0.14),
        }}
      />
    </span>
  );
}

/** Üç yükselen sütun — proje fazları / ilerleme. */
function BarsMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-white">
      <rect x="3" y="14" width="4.5" height="7" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="9.75" y="9" width="4.5" height="12" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="16.5" y="4" width="4.5" height="17" rx="1" fill="currentColor" />
    </svg>
  );
}
