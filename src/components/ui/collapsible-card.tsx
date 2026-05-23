"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type CardTone =
  | "accent"
  | "purple"
  | "blue"
  | "yellow"
  | "red"
  | "green"
  | "gray";

// Tone -> gradient header bg, icon chip bg, icon color, title color
const TONE: Record<
  CardTone,
  { headerBg: string; chipBg: string; chipText: string; border: string }
> = {
  accent: {
    headerBg: "bg-gradient-to-r from-accent/10 via-accent/[0.06] to-white",
    chipBg: "bg-accent",
    chipText: "text-white",
    border: "border-accent/20",
  },
  purple: {
    headerBg: "bg-gradient-to-r from-purple/12 via-purple/[0.06] to-white",
    chipBg: "bg-purple",
    chipText: "text-white",
    border: "border-purple/20",
  },
  blue: {
    headerBg: "bg-gradient-to-r from-blue/12 via-blue/[0.06] to-white",
    chipBg: "bg-blue",
    chipText: "text-white",
    border: "border-blue/20",
  },
  yellow: {
    headerBg: "bg-gradient-to-r from-yellow/15 via-yellow/[0.07] to-white",
    chipBg: "bg-yellow",
    chipText: "text-white",
    border: "border-yellow/30",
  },
  red: {
    headerBg: "bg-gradient-to-r from-red/12 via-red/[0.06] to-white",
    chipBg: "bg-red",
    chipText: "text-white",
    border: "border-red/20",
  },
  green: {
    headerBg: "bg-gradient-to-r from-green/12 via-green/[0.06] to-white",
    chipBg: "bg-green",
    chipText: "text-white",
    border: "border-green/20",
  },
  gray: {
    headerBg: "bg-gradient-to-r from-bg2 via-bg2/40 to-white",
    chipBg: "bg-text2",
    chipText: "text-white",
    border: "border-border",
  },
};

/**
 * Tek başlıklı, gradyan başlıklı collapsible card.
 * Header daha belirgin: gradient bg, renkli icon chip, kalın başlık, alt çizgi.
 */
export function CollapsibleCard({
  title,
  icon,
  link,
  badge,
  tone = "accent",
  defaultOpen = true,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  link?: { href: string; label: string };
  badge?: React.ReactNode;
  tone?: CardTone;
  defaultOpen?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const t = TONE[tone];
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-2xl bg-white border border-border shadow-soft overflow-hidden",
        className
      )}
    >
      <summary
        className={cn(
          "cursor-pointer list-none px-4 py-3 flex items-center gap-3 transition-colors",
          t.headerBg,
          "group-open:border-b-2",
          t.border,
          "hover:brightness-[0.98]"
        )}
      >
        {icon && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 shadow-sm",
              t.chipBg,
              t.chipText
            )}
          >
            {icon}
          </span>
        )}
        <span className="font-display text-[15px] font-extrabold text-text tracking-tight">
          {title}
        </span>
        {badge && <span className="ml-1">{badge}</span>}
        {link && (
          <Link
            href={link.href}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-[11px] text-accent font-bold hover:underline whitespace-nowrap"
          >
            {link.label}
          </Link>
        )}
        <ChevronDown
          size={16}
          className={cn(
            "text-text3 transition-transform group-open:rotate-180 shrink-0",
            !link && "ml-auto"
          )}
        />
      </summary>
      <div className={cn(bodyClassName)}>{children}</div>
    </details>
  );
}
