"use client";

import {
  Trophy,
  FileSpreadsheet,
  LineChart,
  Wrench,
  FolderKanban,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "amber" | "emerald" | "blue" | "rose" | "purple";

interface PlatformItem {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  status: "here" | "live" | "soon";
  href?: string;
}

const TONE_STYLES: Record<Tone, { iconBg: string; iconText: string; ring: string }> = {
  amber:   { iconBg: "bg-yellow/20",  iconText: "text-yellow",  ring: "ring-yellow/40" },
  emerald: { iconBg: "bg-accent/15",  iconText: "text-accent",  ring: "ring-accent/40" },
  blue:    { iconBg: "bg-blue/15",    iconText: "text-blue",    ring: "ring-blue/40" },
  rose:    { iconBg: "bg-red/15",     iconText: "text-red",     ring: "ring-red/40" },
  purple:  { iconBg: "bg-purple/15",  iconText: "text-purple",  ring: "ring-purple/40" },
};

const PLATFORMS: PlatformItem[] = [
  {
    key: "proje-yonetim",
    title: "Proje Yönetim Platformu",
    subtitle: "Çoklu proje, ekip & ilerleme takibi",
    icon: FolderKanban,
    tone: "purple",
    status: "here",
  },
  {
    key: "karar-destek",
    title: "Satınalma Karar Destek",
    subtitle: "Çoklu kriterli skor ile en doğru tedarik",
    icon: Trophy,
    tone: "amber",
    status: "live",
    href: "https://karardestek.fozanseyfi.com",
  },
  {
    key: "teklif",
    title: "Teklif Platformu",
    subtitle: "Solar EPC teklif yönetimi & kapsam-maliyet",
    icon: FileSpreadsheet,
    tone: "emerald",
    status: "live",
    href: "https://teklif.fozanseyfi.com",
  },
  {
    key: "fizibilite",
    title: "Solar Fizibilite Platformu",
    subtitle: "Solar yatırım & geri ödeme analizi",
    icon: LineChart,
    tone: "blue",
    status: "soon",
  },
  {
    key: "ges-muh",
    title: "GES Mühendislik Platformu",
    subtitle: "Tasarım, hesap & teknik dokümantasyon",
    icon: Wrench,
    tone: "rose",
    status: "soon",
  },
];

export function PlatformsRow() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-yellow/30 bg-gradient-to-br from-yellow/10 via-yellow/5 to-white p-6 md:p-8">
      <div className="mb-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow/40 bg-yellow/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[1.4px] text-yellow">
          <Sparkles className="size-3" />
          Diğer Ücretsiz Platformlarım
        </span>
      </div>
      <h2 className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-text">
        Geliştirdiğim diğer platformlara da göz atın
      </h2>
      <p className="mt-2 text-sm text-text2 leading-relaxed max-w-3xl">
        Hepsi tamamen ücretsiz, <strong className="text-text">bağımsız bir inisiyatifle</strong>{" "}
        sektör paydaşlarına sunuluyor. Kart üzerine tıklamak yeterli.
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PLATFORMS.map((p) => (
          <Card key={p.key} item={p} />
        ))}
      </div>
    </section>
  );
}

function Card({ item }: { item: PlatformItem }) {
  const Icon = item.icon;
  const tone = TONE_STYLES[item.tone];
  const isHere = item.status === "here";
  const isSoon = item.status === "soon";

  const inner = (
    <div
      className={cn(
        "h-full rounded-xl border bg-white p-4 transition-all relative",
        isHere
          ? `border-yellow/60 ring-2 ${tone.ring} shadow-sm`
          : isSoon
          ? "border-border opacity-90"
          : "border-border hover:-translate-y-0.5 hover:shadow-medium hover:border-text3 cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={cn("inline-flex items-center justify-center w-10 h-10 rounded-lg", tone.iconBg, tone.iconText)}>
          <Icon className="size-5" />
        </span>
        {isHere ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow text-white text-[9px] font-bold uppercase tracking-wider shadow-sm">
            Buradasın
          </span>
        ) : isSoon ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-bg3 text-text3 text-[9px] font-bold uppercase tracking-wider">
            Yakında
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green/10 text-green text-[9px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-soft" />
            Canlı
          </span>
        )}
      </div>
      <div className="font-display text-sm font-bold text-text leading-tight tracking-tight">
        {item.title}
      </div>
      <div className="mt-1 text-[12px] text-text2 leading-snug">{item.subtitle}</div>
      {!isHere && !isSoon && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-accent">
          Aç <ExternalLink className="size-3" />
        </div>
      )}
    </div>
  );

  if (item.href && !isHere && !isSoon) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className="block group">
        {inner}
      </a>
    );
  }
  return inner;
}
