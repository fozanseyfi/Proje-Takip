"use client";

import {
  Wallet,
  Lock,
  Target,
  TrendingUp,
  PieChart,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export default function BudgetPage() {
  return (
    <>
      <PageHeader
        title="Bütçe & CPI"
        description="Kazanılmış Değer Analizi · Maliyet Performans Endeksi"
        icon={Wallet}
      />

      <Card className="max-w-3xl mx-auto !p-8">
        <div className="flex items-start gap-4 mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/10 text-accent shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="font-display text-xl font-extrabold text-text leading-tight">
              Bu modül bu sürümde kapalı.
            </h2>
          </div>
        </div>

        {/* Modül kısa açıklama */}
        <div className="border-t border-border pt-5 mb-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text3 mb-3">
            Bu modülde neler var?
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Feature
              icon={Target}
              title="CPI — Maliyet Performans Endeksi"
              desc="Her TL harcamaya karşılık ne kadar değer üretildiğini ölçer. 1.0 altı uyarı eşiği."
            />
            <Feature
              icon={TrendingUp}
              title="EAC — Tahmini Bitiş Maliyeti"
              desc="Mevcut performansla projenin gerçek bitiş maliyeti otomatik tahmin edilir."
            />
            <Feature
              icon={PieChart}
              title="Kategori Bazlı Sapma"
              desc="İşçilik, malzeme, taşeron, ekipman — hangi kalem bütçeyi aşıyor, anlık görülür."
            />
            <Feature
              icon={AlertTriangle}
              title="Erken Uyarı"
              desc="Bütçe aşımı sinyali sözleşmenin %20'sinde belirir; gecikmeden müdahale edilir."
            />
          </div>
        </div>
      </Card>
    </>
  );
}

function Feature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-bg2/40 border border-border">
      <Icon size={14} className="text-accent shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="font-semibold text-[12.5px] text-text leading-tight mb-0.5">{title}</div>
        <div className="text-[11.5px] text-text3 leading-snug">{desc}</div>
      </div>
    </div>
  );
}
