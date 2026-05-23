"use client";

import {
  Trophy,
  FileSpreadsheet,
  LineChart,
  Wrench,
  ExternalLink,
  Boxes,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "amber" | "emerald" | "blue" | "rose";

interface Platform {
  key: string;
  title: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  href: string | null;
}

/**
 * ÖNEMLİ: Bu projenin kendi kartı listede YOK ("Proje Yönetim Platformu").
 * Kullanıcı zaten burada — kendini listelemek mantıksız.
 */
const PLATFORMS: Platform[] = [
  {
    key: "karar-destek",
    title: "Satınalma Karar Destek",
    tagline: "Çoklu kriterli tedarik kararı",
    description:
      "GES/RES projeleri için 10 metrikli ağırlıklı skor algoritması. Şablon klonu, revize takibi, " +
      "PDF/Excel çıktı. Taşeron, malzeme ve hizmet tekliflerini tek panelden değerlendir.",
    icon: Trophy,
    tone: "amber",
    href: "https://karardestek.fozanseyfi.com/login",
  },
  {
    key: "teklif-platformu",
    title: "Teklif Platformu",
    tagline: "Teklif yönetimi & takibi",
    description:
      "Tüm teklifleri tek panelden topla, durum ve revizyonlarını izle. Müşteri, kalem ve fiyat geçmişi " +
      "tek yerde — kim ne teklif vermiş, hangi aşamada, anında gör.",
    icon: FileSpreadsheet,
    tone: "emerald",
    href: "https://teklif.fozanseyfi.com",
  },
  {
    key: "fizibilite",
    title: "Solar Fizibilite Platformu",
    tagline: "Yatırım & geri ödeme analizi",
    description:
      "Solar yatırım kararları için geri ödeme süresi, IRR ve NPV hesaplamaları. Senaryo " +
      "karşılaştırması ve risk değerlendirme — yatırımcıya gitmeden önce sayıları gör.",
    icon: LineChart,
    tone: "blue",
    href: null,
  },
  {
    key: "ges-muhendislik",
    title: "GES Mühendislik Platformu",
    tagline: "Tasarım, hesap & dokümantasyon",
    description:
      "Tasarım hesabı, kayıp analizi, kablo & inverter seçimi. Tek hat şeması ve teknik dokümantasyon " +
      "üretimi — sahaya inmeden önce her şey hazır.",
    icon: Wrench,
    tone: "rose",
    href: null,
  },
];

const TONE_STYLES: Record<
  Tone,
  { iconBg: string; iconText: string; hoverBorder: string; gradient: string; btnBg: string }
> = {
  amber: {
    iconBg: "bg-yellow/15",
    iconText: "text-yellow",
    hoverBorder: "hover:border-yellow/50",
    gradient: "from-yellow/8 via-white to-white",
    btnBg: "bg-yellow hover:brightness-110 text-white",
  },
  emerald: {
    iconBg: "bg-accent/15",
    iconText: "text-accent",
    hoverBorder: "hover:border-accent/50",
    gradient: "from-accent/8 via-white to-white",
    btnBg: "bg-accent hover:brightness-110 text-white",
  },
  blue: {
    iconBg: "bg-blue/15",
    iconText: "text-blue",
    hoverBorder: "hover:border-blue/50",
    gradient: "from-blue/8 via-white to-white",
    btnBg: "bg-blue hover:brightness-110 text-white",
  },
  rose: {
    iconBg: "bg-red/15",
    iconText: "text-red",
    hoverBorder: "hover:border-red/50",
    gradient: "from-red/8 via-white to-white",
    btnBg: "bg-red hover:brightness-110 text-white",
  },
};

export default function PlatformsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-yellow/30 bg-gradient-to-br from-yellow/10 via-white to-white p-7 md:p-10">
        <div className="pointer-events-none absolute -top-24 -right-20 size-56 rounded-full bg-yellow/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-yellow/8 blur-3xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow/40 bg-yellow/12 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-yellow uppercase">
            <Boxes className="size-3" />
            Diğer Platformlar
          </div>
          <h1 className="mt-3 font-display text-3xl md:text-4xl font-extrabold tracking-tight text-text leading-tight">
            Geliştirdiğim diğer platformlara da göz atın
          </h1>
          <p className="mt-3 text-base leading-relaxed text-text2 md:text-[17px]">
            Hepsi tamamen ücretsiz, <strong className="text-text">bağımsız bir inisiyatifle</strong>{" "}
            sektör paydaşlarına sunuluyor. Yakında olan platformlara erişim için bildirim almak istersen
            iletişime geç.
          </p>
        </div>
      </div>

      {/* PLATFORMS GRID */}
      <div className="grid gap-4 md:grid-cols-2">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p.key} platform={p} />
        ))}
      </div>
    </div>
  );
}

function PlatformCard({ platform }: { platform: Platform }) {
  const tone = TONE_STYLES[platform.tone];
  const Icon = platform.icon;
  const isLive = platform.href !== null;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-br p-6 shadow-soft transition-all",
        tone.gradient,
        isLive ? `hover:shadow-medium hover:-translate-y-0.5 ${tone.hoverBorder}` : "opacity-95"
      )}
    >
      {/* Header: icon + status badge */}
      <div className="flex items-start justify-between">
        <div className={cn("flex size-12 items-center justify-center rounded-xl", tone.iconBg, tone.iconText)}>
          <Icon className="size-6" />
        </div>
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-green/30 bg-green/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-green">
            <span className="size-1.5 rounded-full bg-green animate-pulse-soft" />
            CANLIDA
          </span>
        ) : (
          <span className="rounded-full border border-border bg-bg2 px-2.5 py-1 text-[10px] font-bold tracking-wider text-text3">
            YAKINDA
          </span>
        )}
      </div>

      {/* Body */}
      <div className="mt-4 flex-1">
        <div className={cn("text-[11px] font-bold tracking-[0.14em] uppercase", tone.iconText)}>
          {platform.tagline}
        </div>
        <h3 className="mt-1 font-display text-lg md:text-xl font-extrabold tracking-tight text-text">
          {platform.title}
        </h3>
        <p className="mt-2 text-[13.5px] leading-relaxed text-text2">{platform.description}</p>
      </div>

      {/* Footer */}
      <div className="mt-5">
        {isLive ? (
          <a
            href={platform.href!}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition-all",
              tone.btnBg
            )}
          >
            İncele
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-bg2 px-4 py-2 text-sm font-semibold text-text3"
          >
            Yakında
            <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}
