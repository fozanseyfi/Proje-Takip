"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { AuthHeader } from "@/components/auth/auth-header";
import { HeroPreviewCard } from "@/components/auth/hero-preview-card";
import { AuthMissionCard } from "@/components/auth/auth-mission-card";
import { FeaturesShowcase } from "@/components/auth/features-showcase";
import { PlatformsRow } from "@/components/auth/platforms-row";
import { AppFooter } from "@/components/layout/app-footer";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-soft">
      <AuthHeader />

      <main className="flex-1">
        {/* HERO — sol: form, sağ: başlık + canlı demo (sağ daha geniş) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 lg:pt-12 lg:pb-16">
          <div className="grid lg:grid-cols-[440px_1fr] xl:grid-cols-[460px_1fr] gap-8 lg:gap-12 items-start">
            <LoginColumn />
            <div className="space-y-5 lg:space-y-6">
              <HeroHeader />
              <HeroPreviewCard />
            </div>
          </div>
        </section>

        {/* FEATURES SHOWCASE */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <FeaturesShowcase />
        </section>

        {/* PRIVACY BAND */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <PrivacyBand />
        </section>

        {/* PLATFORMS ROW */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <PlatformsRow />
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

function HeroHeader() {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-yellow/40 bg-yellow/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[1.5px] text-yellow">
        <Sparkles className="size-3" />
        Bağımsız Bir İnisiyatif
      </div>
      <h1 className="mt-3 font-display text-[36px] md:text-[44px] xl:text-[48px] font-extrabold text-text tracking-tight leading-[1.05]">
        Tüm projelerinizi<br />
        <span className="text-shimmer">tek panelden</span> yönetin.
      </h1>
      <p className="mt-3 text-[15px] md:text-base text-text2 leading-relaxed max-w-2xl">
        GES, RES, HES ve EPC projelerinde milestone, takım yükü, finansal takip ve rol bazlı erişim —
        hepsi tek panelde. Devam etmek için giriş yapın.
      </p>
    </div>
  );
}

function LoginColumn() {
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push("/portfolio");
  }

  return (
    <div className="space-y-5">
      {/* LOGIN CARD */}
      <div className="rounded-2xl border border-border bg-white p-6 shadow-medium">
        <h2 className="font-display text-xl font-extrabold text-text tracking-tight mb-1">Hoş Geldiniz</h2>
        <p className="text-sm text-text2 mb-5">Devam etmek için giriş yapın.</p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="E-posta">
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text3" />
              <Input
                type="email"
                defaultValue="ozan.seyfi@kontrolmatik.com"
                className="pl-10 h-11"
                placeholder="ornek@firma.com"
              />
            </div>
          </Field>
          <Field label="Şifre">
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text3" />
              <Input
                type="password"
                defaultValue="demo"
                className="pl-10 h-11"
                placeholder="••••••••"
              />
            </div>
          </Field>
          <div className="flex items-center justify-between text-sm pt-1">
            <label className="flex items-center gap-2 text-text2 cursor-pointer select-none">
              <input type="checkbox" className="accent-accent w-4 h-4 rounded" />
              Beni hatırla
            </label>
            <Link href="/forgot-password" className="text-accent hover:underline font-semibold">
              Şifremi unuttum
            </Link>
          </div>
          <Button variant="accent" size="lg" className="w-full" type="submit">
            Giriş Yap <ArrowRight size={14} />
          </Button>
        </form>

        <p className="text-xs text-text3 mt-5 text-center">
          Hesabın yok mu?{" "}
          <Link href="/portfolio" className="text-accent font-bold hover:underline">
            Hemen kayıt ol →
          </Link>
        </p>
      </div>

      <AuthMissionCard />
    </div>
  );
}

function PrivacyBand() {
  const items = [
    "Tüm proje, puantaj, fatura ve personel verileri yalnızca sizin hesabınızda izole tutulur.",
    "Geliştirici dahil hiçbir üçüncü taraf proje verilerinizi göremez veya indiremez.",
    "Veriler şifreli aktarılır, RLS politikaları ile DB seviyesinde korunur.",
    "İstediğin zaman tüm verilerini Excel/PDF olarak indir veya hesabını sil — limit yok.",
  ];
  return (
    <div className="rounded-2xl border border-green/30 bg-gradient-to-br from-green/8 via-white to-white p-6 md:p-8">
      <div className="flex items-start gap-4">
        <span className="inline-flex items-center justify-center size-12 rounded-xl bg-green text-white shadow-sm shrink-0">
          <ShieldCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-green">
            <Sparkles className="size-3" />
            Veri Gizliliği
          </div>
          <h3 className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-text mt-1.5">
            Verileriniz sadece sizin
          </h3>
          <p className="text-sm text-text2 mt-1.5 max-w-3xl leading-relaxed">
            Platform; gizlilik prensiplerini birinci önceliği olarak tutar. KVKK uyumlu, RLS korumalı,
            şeffaf veri politikası — sektörde size güveni hak eden bir araç.
          </p>

          <ul className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-text2 leading-relaxed">
                <Check className="size-4 text-green mt-0.5 shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
