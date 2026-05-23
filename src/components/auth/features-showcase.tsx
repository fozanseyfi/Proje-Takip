"use client";

import { useState } from "react";
import {
  FolderKanban,
  CheckSquare,
  Users,
  Shield,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectsDemo } from "./projects-demo";
import { MilestonesDemo } from "./milestones-demo";
import { TeamDemo } from "./team-demo";
import { RolesDemo } from "./roles-demo";

type TabKey = "projects" | "milestones" | "team" | "roles";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "projects", label: "Proje Yönetimi", icon: FolderKanban },
  { key: "milestones", label: "Görev & Milestone", icon: CheckSquare },
  { key: "team", label: "Takım & Yük", icon: Users },
  { key: "roles", label: "Roller & İzinler", icon: Shield },
];

export function FeaturesShowcase() {
  const [active, setActive] = useState<TabKey>("projects");

  return (
    <section className="space-y-6">
      {/* Üst başlık */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[10px] font-bold tracking-[1.5px] text-accent uppercase">
          <Sparkles className="size-3" />
          Nasıl Çalışır
        </div>
        <h2 className="font-display text-2xl md:text-[34px] font-extrabold tracking-tight text-text mt-3 leading-tight">
          Projelerinizi yönetmenin daha kolay yolu
        </h2>
        <p className="text-text2 mt-2 text-[15px] leading-relaxed">
          Sahadan yöneticiye, tek bir platformda — proje, milestone, takım yükü ve rol yönetimi
          her gün kullandığınız akışlara göre tasarlandı.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                isActive
                  ? "border-accent bg-accent text-white shadow-sm"
                  : "border-border bg-white text-text2 hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="rounded-3xl border border-border bg-white p-6 md:p-8 shadow-soft min-h-[600px] md:min-h-[560px]">
        {active === "projects" && (
          <FeatureLayout
            title="Tüm projelerinizi tek panelden izleyin"
            bullets={[
              "Her projenin ilerleme yüzdesi, durumu ve riskleri tek bakışta görünür.",
              "Öne çıkan projeyi otomatik vurgular — aktif ekibin enerjisi nereye gidiyor?",
              "İlerleme sıralaması ile geride kalan projeleri hızlıca tespit edin.",
              "4 KPI strip: Toplam proje, aktif görev, tamamlanan, geciken — anında sayılarla.",
            ]}
            demo={<ProjectsDemo />}
          />
        )}
        {active === "milestones" && (
          <FeatureLayout
            title="Kanban + milestone — günlük ritmi koru"
            bullets={[
              "Yapılacak / Devam Eden / Tamamlandı sürükle-bırak kolonlar.",
              "Milestone zaman çizgisi — sırada ne, ne kadar kalmış?",
              "Görev detayı: atanan kişi, deadline, alt görev checklisti.",
              "Yaklaşan tarih otomatik sarı, geçenler kırmızı uyarılı.",
            ]}
            demo={<MilestonesDemo />}
          />
        )}
        {active === "team" && (
          <FeatureLayout
            title="Takım yükünü görmeden yönetilmez"
            bullets={[
              "Üyelerin yüzde bazlı iş yük dağılımı — kim dolu, kim boş?",
              "Atama matrisi: kim hangi projede çalışıyor, tek bakışta gör.",
              "Aşırı yüklenme otomatik uyarısı — dengeleme önerisiyle birlikte.",
              "Yedek/devirleme önerileri ile bottleneck'leri çöz.",
            ]}
            demo={<TeamDemo />}
          />
        )}
        {active === "roles" && (
          <FeatureLayout
            title="Roller & izinler — net sınırlar, az risk"
            bullets={[
              "3 hazır rol: Yönetici, Üye, Görüntüleyici. İhtiyaca göre tek tıkla değiştir.",
              "Her rolün yapabilecekleri ve yapamayacakları net tanımlı.",
              "Davet edilen kişi sadece kendi projesini görür — RLS ile DB seviyesinde izole.",
              "Görüntüleyici hesabı müşteriye, paydaşa, denetçiye verilebilir — yazma yetkisi yok.",
            ]}
            demo={<RolesDemo />}
            compact
          />
        )}
      </div>
    </section>
  );
}

function FeatureLayout({
  title,
  bullets,
  demo,
  compact,
}: {
  title: string;
  bullets: string[];
  demo: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-7 lg:items-center",
        compact ? "lg:grid-cols-[1fr_500px]" : "lg:grid-cols-2"
      )}
    >
      <div className="space-y-4">
        <h3 className="font-display text-xl md:text-2xl font-extrabold tracking-tight text-text">
          {title}
        </h3>
        <ul className="space-y-2.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-text2 leading-relaxed">
              <Check className="text-accent mt-0.5 size-4 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>{demo}</div>
    </div>
  );
}
