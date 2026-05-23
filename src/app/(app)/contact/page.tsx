"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  MessageSquare,
  Send,
  Sparkles,
  Globe,
  ShieldCheck,
  Info,
  Bug,
  Lightbulb,
  HelpCircle,
  Trophy,
  FolderKanban,
  TrendingUp,
  Wrench,
  ArrowUpRight,
  LineChart,
  ShieldAlert,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/lib/store";
import { cn } from "@/lib/utils";
import { sendContactMessage } from "./actions";

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const DEV = {
  name: "Furkan Ozan Seyfi",
  title: "Elektrik Mühendisi",
  phone: "+90 506 684 29 33",
  email: "fozanseyfi@gmail.com",
  linkedin: "https://www.linkedin.com/in/fozanseyfi/",
  website: "https://fozanseyfi.com",
};

type Topic = "feedback" | "bug" | "feature" | "question";

const TOPICS: { key: Topic; label: string; icon: React.ComponentType<{ className?: string }>; tone: keyof typeof TOPIC_TONES }[] = [
  { key: "feedback", label: "Genel Geri Bildirim", icon: MessageSquare, tone: "blue" },
  { key: "bug", label: "Hata Bildirimi", icon: Bug, tone: "rose" },
  { key: "feature", label: "Özellik Önerisi", icon: Lightbulb, tone: "amber" },
  { key: "question", label: "Soru / Yardım", icon: HelpCircle, tone: "violet" },
];

const TOPIC_TONES = {
  blue: "border-blue/40 bg-blue/8 text-blue",
  rose: "border-red/40 bg-red/8 text-red",
  amber: "border-yellow/40 bg-yellow/8 text-yellow",
  violet: "border-purple/40 bg-purple/8 text-purple",
} as const;

export default function ContactPage() {
  const user = useCurrentUser();
  const toast = useToast((s) => s.push);

  const [topic, setTopic] = useState<Topic>("feedback");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || message.trim().length < 10) {
      toast("Konu ve en az 10 karakterlik mesaj gerekli.", "error");
      return;
    }
    if (!user) {
      toast("Mesaj göndermek için önce giriş yap.", "error");
      return;
    }
    setSending(true);
    try {
      const topicLabel = TOPICS.find((t) => t.key === topic)?.label ?? "Geri Bildirim";
      await sendContactMessage({
        topic: topicLabel,
        subject: subject.trim(),
        message: message.trim(),
        senderName: user.fullName,
        senderEmail: user.email,
      });
      toast(`Mesajınız ${DEV.email} adresine iletildi.`, "success");
      setSubject("");
      setMessage("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gönderim hatası", "error");
    } finally {
      setSending(false);
    }
  }

  function mailto() {
    const topicLabel = TOPICS.find((t) => t.key === topic)?.label ?? "";
    const body = `Konu: ${subject}\n\n${message}`;
    window.location.href = `mailto:${DEV.email}?subject=${encodeURIComponent(
      `[${topicLabel}] ${subject || "Geri Bildirim"}`
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
    <div className="mx-auto max-w-7xl space-y-8">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bg2 via-white to-accent/5 p-8 md:p-12">
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-accent/8 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-blue/6 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-bold text-accent uppercase tracking-wider">
            <MessageSquare className="size-3" />
            İletişim
          </div>
          <h1 className="font-display text-3xl md:text-[36px] font-extrabold tracking-tight text-text leading-[1.1]">
            Sizden gelen her geri bildirim<br className="hidden md:block" />
            <span className="text-accent">platformu daha iyi yapar.</span>
          </h1>
          <p className="mt-3 text-[15px] md:text-base text-text2 leading-relaxed max-w-2xl">
            Hata bildirimi, özellik önerisi veya genel sorularınız için aşağıdaki formdan veya
            doğrudan iletişim kanallarından bana ulaşabilirsiniz.
          </p>
        </div>
      </div>

      {/* DEV CARD + FORM */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Geliştirici kartı */}
        <Card className="overflow-hidden !p-0 shadow-soft lg:col-span-5">
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-7 text-white">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent/15 blur-2xl pointer-events-none" />
            <div className="relative">
              <div className="bg-accent/20 ring-accent/30 flex size-12 items-center justify-center rounded-xl ring-1 backdrop-blur">
                <Sparkles className="text-white size-5" />
              </div>
              <div className="mt-5 text-[10px] font-bold tracking-[0.18em] text-accent uppercase">
                Geliştirici
              </div>
              <h2 className="mt-1.5 text-2xl font-bold tracking-tight">{DEV.name}</h2>
              <div className="text-sm text-slate-300 mt-0.5">{DEV.title}</div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-slate-300/95 max-w-md">
                Yenilenebilir enerji ve EPC projelerinde aktif çalışan bir mühendis olarak saha
                operasyonu, planlama ve raporlama süreçlerinde yaşadığım operasyonel ihtiyaçlardan
                doğan bu platformu sektör paydaşlarının kullanımına sunuyorum.
              </p>
            </div>
          </div>

          <CardContent className="space-y-1 p-4">
            <ContactRow href={`tel:${DEV.phone.replace(/\s/g, "")}`} icon={Phone} label="Telefon" value={DEV.phone} />
            <ContactRow href={`mailto:${DEV.email}`} icon={Mail} label="E-posta" value={DEV.email} />
            <ContactRow href={DEV.linkedin} external icon={LinkedinIcon} label="LinkedIn" value="linkedin.com/in/fozanseyfi" />
            <ContactRow href={DEV.website} external icon={Globe} label="Web Sitesi" value="fozanseyfi.com" />
          </CardContent>
        </Card>

        {/* Mesaj formu */}
        <Card className="!p-0 shadow-soft lg:col-span-7">
          <CardContent className="p-6 md:p-8">
            <div className="mb-6 pb-4 border-b border-border">
              <div className="inline-flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-accent">
                <Send className="size-3" />
                Mesaj Formu
              </div>
              <h3 className="font-display text-xl font-extrabold tracking-tight text-text">
                Mesajınızı Bırakın
              </h3>
              <p className="text-sm text-text2 mt-1.5 max-w-xl">
                Aşağıdaki formu doldurun, hesabınıza bağlı olarak takip edilebilen bir mesaj olarak iletilir.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-6">
              {/* Konu tipi */}
              <div>
                <Label className="!mb-2 text-[11px] font-bold uppercase tracking-wider text-text3">Konu Türü</Label>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {TOPICS.map((t) => {
                    const Icon = t.icon;
                    const active = topic === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTopic(t.key)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-xs font-semibold transition-all",
                          active
                            ? TOPIC_TONES[t.tone]
                            : "border-border bg-white text-text3 hover:bg-bg2 hover:text-text2"
                        )}
                      >
                        <Icon className="size-4" />
                        <span className="text-center leading-tight">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Konu */}
              <div>
                <Label htmlFor="subject" className="!mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text3">
                  Konu
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Kısa bir özet — örn. PDF çıktısında font sorunu"
                  required
                />
              </div>

              {/* Mesaj */}
              <div>
                <Label htmlFor="message" className="!mb-1.5 text-[11px] font-bold uppercase tracking-wider text-text3">
                  Mesaj
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detaylı açıklama: hangi sayfada, hangi adımda yaşandı, ne bekleniyordu, ne oldu?"
                  rows={7}
                  required
                  minLength={10}
                />
                <div className="flex justify-between text-[11px] text-text3 mt-1">
                  <span>En az 10 karakter</span>
                  <span className={cn(message.length >= 10 && "text-accent font-semibold")}>
                    {message.length} karakter
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={mailto} disabled={sending}>
                  <Mail className="size-4" />
                  E-posta ile Gönder
                </Button>
                <Button type="submit" variant="accent" disabled={sending}>
                  <Send className="size-4" />
                  {sending ? "Gönderiliyor…" : "Gönder"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* INFO KARTLARI */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard
          icon={ShieldCheck}
          tone="green"
          eyebrow="Veri Gizliliği"
          title="Verileriniz size aittir"
        >
          Tüm proje, puantaj, fatura ve personel verileri kendi hesabınızda izole tutulur.
          Geliştirici dahil <strong>hiçbir üçüncü taraf</strong> proje verilerinizi göremez.
          Supabase'e geçişle birlikte tüm tablolar <strong>RLS</strong> politikalarıyla korunacak.
        </InfoCard>

        <InfoCard
          icon={Info}
          tone="yellow"
          eyebrow="Sorumluluk Reddi"
          title="Yardımcı araç"
        >
          Platform; planlama, gerçekleşme, SPI/CPI ve raporlamada yol gösterici bir yardımcıdır.
          Üretilen PDF/Excel çıktıları
          <strong> resmi belge / hak ediş / hukuki delil yerine geçmez</strong>; nihai kararlar
          kullanıcı sorumluluğundadır.
        </InfoCard>
      </div>

      {/* YASAL BİLDİRİM — DISCLAIMER (AÇIK) */}
      <DisclaimerSection />

      {/* DİĞER PLATFORMLAR — üst bölümlerle aynı genişlik */}
      <OtherPlatformsSection />
    </div>
    </>
  );
}

interface PlatformItem {
  title: string;
  subtitle: string;
  href?: string;
  status: "here" | "live" | "soon";
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof PLATFORM_TONES;
}

const PLATFORM_TONES = {
  purple: { iconBg: "bg-purple/15 text-purple", ring: "ring-purple/40" },
  yellow: { iconBg: "bg-yellow/20 text-yellow", ring: "ring-yellow/50" },
  blue:   { iconBg: "bg-blue/15 text-blue",     ring: "ring-blue/40" },
  red:    { iconBg: "bg-red/15 text-red",       ring: "ring-red/40" },
  green:  { iconBg: "bg-green/15 text-green",   ring: "ring-green/40" },
} as const;

const PLATFORMS: PlatformItem[] = [
  {
    title: "Proje Yönetim Platformu",
    subtitle: "Çoklu proje, ekip & ilerleme takibi",
    status: "here",
    icon: FolderKanban,
    tone: "purple",
  },
  {
    title: "Satınalma Karar Destek",
    subtitle: "Çoklu kriterli skor ile en doğru tedarik",
    href: "https://karardestek.fozanseyfi.com",
    status: "live",
    icon: Trophy,
    tone: "yellow",
  },
  {
    title: "Teklif Platformu",
    subtitle: "Solar EPC teklif yönetimi & kapsam-maliyet",
    href: "https://teklif.fozanseyfi.com",
    status: "live",
    icon: TrendingUp,
    tone: "blue",
  },
  {
    title: "Solar Fizibilite Platformu",
    subtitle: "Solar yatırım & geri ödeme analizi",
    status: "soon",
    icon: LineChart,
    tone: "green",
  },
  {
    title: "GES Mühendislik Platformu",
    subtitle: "Tasarım, hesap & teknik dokümantasyon",
    status: "soon",
    icon: Wrench,
    tone: "red",
  },
];

function OtherPlatformsSection() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-yellow/30 bg-gradient-to-br from-yellow/10 via-yellow/5 to-white p-6 md:p-8 mt-8">
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
        Hepsi tamamen ücretsiz, <strong className="text-text">bağımsız bir inisiyatifle</strong> sektör
        paydaşlarına sunuluyor. Diğer platformlara ulaşmak için kart üzerine tıklamanız yeterli.
      </p>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PLATFORMS.map((p) => (
          <PlatformCard key={p.title} item={p} />
        ))}
      </div>
    </section>
  );
}

function PlatformCard({ item }: { item: PlatformItem }) {
  const Icon = item.icon;
  const tone = PLATFORM_TONES[item.tone];
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
        <span className={cn("inline-flex items-center justify-center w-10 h-10 rounded-lg", tone.iconBg)}>
          <Icon className="size-5" />
        </span>
        <StatusBadge status={item.status} />
      </div>
      <div className="font-display text-sm font-bold text-text leading-tight tracking-tight">
        {item.title}
      </div>
      <div className="mt-1 text-[12px] text-text2 leading-snug">{item.subtitle}</div>
      {!isHere && !isSoon && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-accent">
          Aç <ArrowUpRight className="size-3" />
        </div>
      )}
    </div>
  );

  if (item.href && !isHere && !isSoon) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
      >
        {inner}
      </a>
    );
  }
  return inner;
}

function StatusBadge({ status }: { status: PlatformItem["status"] }) {
  if (status === "here") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-yellow text-white text-[9px] font-bold uppercase tracking-wider shadow-sm">
        Buradasın
      </span>
    );
  }
  if (status === "soon") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-bg3 text-text3 text-[9px] font-bold uppercase tracking-wider">
        Yakında
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green/10 text-green text-[9px] font-bold uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-soft" />
      Canlı
    </span>
  );
}

const DISCLAIMER_SECTIONS = [
  {
    n: "1",
    title: "Kullanım Amacı",
    body: (
      <>
        Proje Yönetim Platformu; saha ekiplerinin günlük gerçekleşme, puantaj, planlama ve ilerleme
        takibini kolaylaştırmak amacıyla geliştirilmiş bir <strong className="text-text">iç araç</strong>tır.
        Hesaplanan değerler (SPI, CPI, EAC, S-eğrisi vb.) yönlendirici göstergelerdir; proje yönetim
        kararları için ek doğrulama gerektirir.
      </>
    ),
  },
  {
    n: "2",
    title: "Veri Sorumluluğu",
    body: (
      <>
        Sisteme girilen tüm bilgilerin doğruluğundan ve güncelliğinden kullanıcı sorumludur. Uygulama,
        eksik veya yanlış girilen veriler üzerinden yapılan hesaplamaların sonuçlarından doğacak{" "}
        <strong className="text-text">hiçbir maddi, manevi veya hukuki zarardan</strong> sorumlu
        tutulamaz. Üçüncü taraflarla (işveren, alt yüklenici, müfettişlik vb.) paylaşılan raporların
        doğrulanması ilgili proje yöneticisinin sorumluluğundadır.
      </>
    ),
  },
  {
    n: "3",
    title: "Hukuki Bağlayıcılık",
    body: (
      <>
        Bu platformdan alınan PDF/Excel çıktıları, dijital raporlar, panel görselleri ve hesaplamalar{" "}
        <strong className="text-text">hukuki delil veya resmi belge niteliği taşımaz.</strong> Hak ediş,
        fatura, sözleşme değişikliği, ihbar, claim, tutanak gibi resmi süreçlerde imzalı ıslak veya KEP
        üzerinden gönderilmiş orijinal belgeler esas alınır. Bu uygulamadaki kayıtlar yalnızca ön
        çalışma ve takip amaçlıdır.
      </>
    ),
  },
  {
    n: "4",
    title: "KVKK & Gizlilik",
    body: (
      <>
        Personel TC kimlik numarası, telefon, yevmiye gibi kişisel veriler 6698 sayılı Kişisel Verilerin
        Korunması Kanunu (KVKK) kapsamında işlenir. Bu verilerin sisteme girilmesi, ilgili kişiden açık
        rıza alındığı varsayımıyla yapılır. Verilerin saklanması, paylaşılması ve silinmesi proje
        yöneticisinin sorumluluğundadır. Uygulama yöneticileri sızıntı, yetkisiz erişim veya veri kaybı
        durumlarından doğacak zararlardan sorumlu değildir.
      </>
    ),
  },
  {
    n: "5",
    title: "Yedekleme & Kayıp",
    body: (
      <>
        Verilerin yedeklenmesinden kullanıcı sorumludur. Uygulama; donanım arızası, internet kesintisi,
        tarayıcı verisi silinmesi, beklenmedik hatalar veya 3. parti servis kesintileri sebebiyle
        oluşabilecek veri kaybından <strong className="text-text">sorumlu tutulamaz</strong>. Kritik
        veriler için düzenli aralıklarla Excel/PDF yedek alınması önerilir.
      </>
    ),
  },
  {
    n: "6",
    title: "Üçüncü Taraf Servisler",
    body: (
      <>
        Hava durumu (Open-Meteo), döviz kuru (TCMB), e-posta (Resend / Gmail SMTP) gibi üçüncü taraf
        servislerin kullanımı, ilgili servis sağlayıcının kendi koşullarına tabidir. Bu servislerin
        geçici veya kalıcı çalışmaması uygulamanın sorumluluğu altında değildir.
      </>
    ),
  },
  {
    n: "7",
    title: "Telif & Lisans",
    body: (
      <>
        Uygulamadaki tüm yazılım kodu, tasarım ve dokümantasyon geliştiricinin telif kapsamındadır.
        İzinsiz kopyalanması, dağıtılması veya tersine mühendislik yapılması yasaktır.
      </>
    ),
  },
  {
    n: "8",
    title: "Sorumluluk Reddi",
    body: (
      <>
        Uygulamayı kullanmaya devam eden her kullanıcı, yukarıdaki maddeleri okuduğunu, anladığını ve
        kabul ettiğini beyan etmiş sayılır. Anlaşmazlık durumunda Ankara mahkemeleri yetkilidir.
      </>
    ),
  },
] as const;

function DisclaimerSection() {
  return (
    <section className="rounded-2xl border border-border bg-white overflow-hidden shadow-soft">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-yellow/12 via-yellow/8 to-white border-b border-yellow/30 px-6 py-5 flex items-start gap-4">
        <span className="inline-flex items-center justify-center size-11 rounded-xl bg-yellow text-white shadow-sm shrink-0">
          <Scale className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-yellow">
            <ShieldAlert className="size-3" />
            Yasal Bildirim
          </div>
          <h3 className="font-display text-xl font-extrabold tracking-tight text-text mt-1 leading-tight">
            Disclaimer · Sorumluluk Reddi
          </h3>
          <p className="text-[13px] text-text2 mt-1 leading-relaxed max-w-3xl">
            Bu uygulama bir proje takip yardımcısıdır. Sözleşme, hukuki süreçler ve resmi raporlama için
            tek başına bağlayıcı kabul edilemez. Platformu kullanmaya devam ederek aşağıdaki şartları
            kabul etmiş sayılırsınız.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {DISCLAIMER_SECTIONS.map((s) => (
          <div key={s.n} className="flex gap-3">
            <div className="shrink-0">
              <span className="inline-flex items-center justify-center size-6 rounded-md bg-yellow/15 text-yellow text-[11px] font-mono font-bold tabular-nums">
                {s.n}
              </span>
            </div>
            <div className="min-w-0">
              <h4 className="text-[13px] font-bold text-text tracking-tight">{s.title}</h4>
              <p className="text-[12.5px] text-text2 leading-relaxed mt-1">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-6 py-3 border-t border-border bg-bg2/30 text-[10px] text-text3 font-mono flex justify-between">
        <span>Son güncelleme: 2026-05-12</span>
        <span>proje-yonetim-platformu</span>
      </div>
    </section>
  );
}

const INFO_TONES = {
  green:  { border: "border-green/30 bg-green/5",   iconBg: "bg-green text-white",   text: "text-green" },
  blue:   { border: "border-blue/30 bg-blue/5",     iconBg: "bg-blue text-white",    text: "text-blue" },
  yellow: { border: "border-yellow/30 bg-yellow/5", iconBg: "bg-yellow text-white",  text: "text-yellow" },
} as const;

function InfoCard({
  icon: Icon,
  tone,
  eyebrow,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof INFO_TONES;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  const t = INFO_TONES[tone];
  return (
    <Card className={cn("!p-0", t.border)}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm", t.iconBg)}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className={cn("text-[10px] font-bold tracking-wider uppercase", t.text)}>
              {eyebrow}
            </div>
            <h4 className="mt-0.5 text-sm font-bold text-text">{title}</h4>
            <p className="mt-2 text-xs leading-relaxed text-text2">{children}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactRow({
  href,
  external,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  external?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-bg2"
    >
      <div className="bg-bg2 flex size-9 shrink-0 items-center justify-center rounded-lg text-text2">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-text3 text-[10px] font-bold tracking-wider uppercase">{label}</div>
        <div className="text-text truncate text-sm font-semibold">{value}</div>
      </div>
    </a>
  );
}
