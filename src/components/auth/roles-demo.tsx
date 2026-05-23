"use client";

import { Crown, User, Eye, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "emerald" | "blue" | "slate";

interface Cap {
  label: string;
  ok: boolean;
}

const TONE_STYLES: Record<
  Tone,
  { header: string; text: string; capBg: string }
> = {
  emerald: { header: "bg-gradient-to-br from-accent to-emerald-700", text: "text-accent", capBg: "bg-accent/10" },
  blue:    { header: "bg-gradient-to-br from-blue to-blue/80",        text: "text-blue",   capBg: "bg-blue/10" },
  slate:   { header: "bg-gradient-to-br from-text2 to-text",          text: "text-text2",  capBg: "bg-bg2" },
};

export function RolesDemo() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <RoleCard
        icon={Crown}
        label="Yönetici"
        tagline="Tam yetki — paneli yönetir"
        tone="emerald"
        caps={[
          { label: "Tüm projeleri görür", ok: true },
          { label: "Üye davet eder", ok: true },
          { label: "Proje silebilir", ok: true },
          { label: "Bütçe ayarlar", ok: true },
          { label: "Raporları indirir", ok: true },
        ]}
      />
      <RoleCard
        icon={User}
        label="Üye"
        tagline="Atanan görevleri yönetir"
        tone="blue"
        caps={[
          { label: "Atanan projeleri görür", ok: true },
          { label: "Görev günceller", ok: true },
          { label: "Yorum yazar", ok: true },
          { label: "Üye davet eder", ok: false },
          { label: "Proje silebilir", ok: false },
        ]}
      />
      <RoleCard
        icon={Eye}
        label="Görüntüleyici"
        tagline="Salt okunur erişim"
        tone="slate"
        caps={[
          { label: "Genel ilerlemeyi görür", ok: true },
          { label: "Raporları indirir", ok: true },
          { label: "Görev günceller", ok: false },
          { label: "Yorum yazar", ok: false },
          { label: "Yapı değiştirir", ok: false },
        ]}
      />
    </div>
  );
}

function RoleCard({
  icon: Icon,
  label,
  tagline,
  tone,
  caps,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tagline: string;
  tone: Tone;
  caps: Cap[];
}) {
  const s = TONE_STYLES[tone];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
      <div className={cn("flex items-center gap-2 p-3 text-white", s.header)}>
        <div className="flex size-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold leading-tight">{label}</div>
          <div className="text-[10px] opacity-90 leading-tight mt-0.5">{tagline}</div>
        </div>
      </div>
      <ul className="space-y-1.5 p-3 text-xs">
        {caps.map((c, i) => (
          <li key={i} className="flex items-start gap-2">
            {c.ok ? (
              <span className={cn("mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full", s.capBg, s.text)}>
                <Check className="size-2" />
              </span>
            ) : (
              <span className="bg-bg3 text-text3 mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full">
                <X className="size-2" />
              </span>
            )}
            <span className={cn("text-[11.5px]", c.ok ? "text-text" : "text-text3")}>{c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
