"use client";

import {
  Sparkles,
  Lightbulb,
  ChevronDown,
  HelpCircle,
  Layers,
  ListChecks,
  Calendar,
  Target,
  HardHat,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Share2,
  CheckCircle2,
} from "lucide-react";

interface Step {
  num: string;
  title: string;
  summary: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  details: {
    intro: string;
    bullets: { label: string; value: string }[];
    tip?: string;
  };
}

const STEPS: Step[] = [
  {
    num: "01",
    title: "Proje Kurulumu",
    summary: "Müşteri, lokasyon, sözleşme tarihi, kurulu güç ve bütçe bilgileri.",
    icon: Sparkles,
    details: {
      intro:
        "Yeni bir proje açtığında temel parametreleri girersin. GES için kurulu MW, RES için türbin sayısı, sözleşme ve planlı bitiş tarihleri. Bu bilgiler tüm hesaplamaların (SPI, EAC, S-eğrisi) referansını oluşturur.",
      bullets: [
        { label: "Tip", value: "GES / RES / HES / Endüstriyel" },
        { label: "Para birimi", value: "TRY · USD · EUR" },
        { label: "Kapsam", value: "Sözleşme tarihi + planlı bitiş + raporlama günü" },
      ],
      tip: "Sözleşme bitişi ve plan bitişi farklı olabilir — gecikme sürelerini ayrı takip edersin.",
    },
  },
  {
    num: "02",
    title: "WBS Yapısı (İş Ağacı)",
    summary: "Ana başlık → alt başlık → iş kalemi hiyerarşisi + ağırlık dağılımı.",
    icon: Layers,
    details: {
      intro:
        "79 maddelik hazır WBS şablonuyla projeni başlat ya da sıfırdan ekle. Her seviyenin ağırlığı üst seviye toplamına oranlanır (L1 × L2 × L3 = nihai ağırlık). Birim ve miktar girdiğin iş kalemlerinden ilerleme yüzdeleri otomatik üretilir.",
      bullets: [
        { label: "Şablon", value: "79 madde hazır geliyor" },
        { label: "Hiyerarşi", value: "L1 ana · L2 alt · L3 kalem" },
        { label: "Hesap", value: "Multiplikatif ağırlık (toplam %100)" },
      ],
      tip: "Sadece iş kalemlerine (leaf) ağırlık girersin. Üst başlıklar otomatik toplanır.",
    },
  },
  {
    num: "03",
    title: "Planlama — Baseline",
    summary: "Hangi günde hangi kalemden ne kadar yapılacağını gir.",
    icon: Calendar,
    details: {
      intro:
        "Her iş kalemi için gün gün baseline planı oluşturursun. WBS × tarih matrisinde hücreye miktar yaz; istersen 'Otomatik Dağıt' ile başlangıç-bitiş arasını eşit böl. Excel şablonu indir-doldur-yükle akışıyla saha dışında da hazırlanabilir.",
      bullets: [
        { label: "Görünüm", value: "Aylık matris · sticky kolonlar" },
        { label: "Otomatik dağıtım", value: "Tarih aralığında eşit miktar" },
        { label: "Excel I/O", value: "Şablon indir → doldur → yükle" },
      ],
      tip: "Planı bir kez kurup baseline olarak dondur — sonradan değişikliği claim/tutanak olarak takip et.",
    },
  },
  {
    num: "04",
    title: "Günlük Gerçekleşme",
    summary: "Sahada o gün ne yapıldıysa rakam olarak gir, sistem ilerlemeyi anında çıkarır.",
    icon: CheckCircle2,
    details: {
      intro:
        "Her gün için iş kalemlerine gerçekleşen miktarı girersin — sistem otomatik kümülatif ilerleme yüzdesi, SPI ve Plan vs Gerçekleşme farkını gösterir. 'Saha Formu PDF' butonu ile A4 form bastırıp sahada elle doldurabilirsin.",
      bullets: [
        { label: "Giriş", value: "Tek satır numerik · Tab/ok ile gezin" },
        { label: "Önceki günden kopyala", value: "Tek tıkla tekrarlanan kayıtlar" },
        { label: "PDF saha formu", value: "Profesyonel A4 elle doldurma" },
      ],
      tip: "Saha mühendisi gün sonunda 5 dakikada günlük gerçekleşmeyi tamamlar.",
    },
  },
  {
    num: "05",
    title: "Puantaj & Saha Raporu",
    summary: "Personel ve makine günlüğü + hava + foto + serbest açıklama.",
    icon: HardHat,
    details: {
      intro:
        "Personel ve makine listesinden o gün sahada olanları işaretle — sistem adam-saat ve makine-saat metriklerini toplar. Günlük rapora hava durumu otomatik gelir (Open-Meteo), foto yükleyebilirsin.",
      bullets: [
        { label: "Personel puantaj", value: "Master listeden hızlı seçim" },
        { label: "Makine puantaj", value: "Plaka/isim ile autocomplete" },
        { label: "Daily report", value: "Hava + foto + serbest metin" },
      ],
      tip: "Master Data'ya bir kez personel/makine ekledikten sonra her gün listeden seçersin.",
    },
  },
  {
    num: "06",
    title: "Satın Alma & Finansal",
    summary: "PO, EXW, teslim, fatura ve bütçe takibini tek yerden yönet.",
    icon: ShoppingCart,
    details: {
      intro:
        "Satın alma kalemlerini planlı (RFQ → PO → EXW → Teslim) ve gerçekleşen tarihleriyle takip et. Faturalandırmada hem işveren faturasını hem alt yüklenici sözleşmesini ayrı yönet. Bütçe modülü CPI ve EAC üretir.",
      bullets: [
        { label: "Procurement", value: "5 milestone + kritik bayrağı" },
        { label: "Faturalandırma", value: "Owner / alt yüklenici çift yön" },
        { label: "Çoklu para birimi", value: "TCMB kuru otomatik" },
      ],
      tip: "Kritik malzeme için yıldız bayrağı koy — dashboard'da öne çıkar.",
    },
  },
  {
    num: "07",
    title: "SPI / CPI / S-Eğrisi",
    summary: "Performans göstergeleri ve grafiksel ilerleme her sayfada hazır.",
    icon: TrendingUp,
    details: {
      intro:
        "Dashboard üzerinde Plan vs Gerçekleşen S-Curve, bölüm bazlı mini S-Curve, SPI/CPI değerleri, kümülatif ilerleme yüzdesi anlık güncellenir. Süre, maliyet ve kapsam üçgenini tek bakışta görürsün.",
      bullets: [
        { label: "Hesaplar", value: "SPI · CPI · EAC · ETC · TCPI" },
        { label: "Grafikler", value: "S-curve · trend · headcount" },
        { label: "Bölüm bazlı", value: "Her L1 başlığa ayrı görünüm" },
      ],
      tip: "SPI 0.95 altına düşerse dashboard kırmızı uyarır — aksiyon alma zamanı.",
    },
  },
  {
    num: "08",
    title: "Kritik İşler & Tutanak",
    summary: "15-gün kritik aksiyon listesi, claim, tutanak, ihbar tek panelde.",
    icon: AlertTriangle,
    details: {
      intro:
        "Önümüzdeki 15 günde dikkat edilmesi gereken kritik kalemleri tek liste halinde gör. Claim, tutanak, ihbar, yazışma gibi konuları aynı yerde sınıflandır. Kapatılanlar otomatik 'Kapanan Konular' arşivine düşer.",
      bullets: [
        { label: "Tip", value: "Kritik İş · Claim · Tutanak · Yazışma · İhbar" },
        { label: "Sorumlu", value: "Master personel listesinden ata" },
        { label: "Arşiv", value: "Kapatılan kayıtlar saklanır" },
      ],
      tip: "Yüklendiğinde takvim üzerinde yaklaşan/geciken kalemler kırmızıya döner.",
    },
  },
  {
    num: "09",
    title: "Çıktı & Paylaşım",
    summary: "PDF / Excel raporlar + müşteriye public link.",
    icon: Share2,
    details: {
      intro:
        "Her sayfada PDF/Excel butonu profesyonel çıktılar üretir — Türkçe karakterler düzgün, marka renklerinde. Müşteriye public bir link gönderebilirsin, sadece seçtiğin modüller görünür, link şifreli ve süreli olur.",
      bullets: [
        { label: "PDF", value: "Saha formu · personel/makine listesi · rapor" },
        { label: "Excel", value: "Planlama matris şablonu" },
        { label: "Public share", value: "Şifre + süre + modül seçim" },
      ],
      tip: "Müşteriye giden link sende kalır, istediğin zaman iptal edersin.",
    },
  },
];

const STATS = [
  { icon: Layers, value: "79", label: "WBS Şablon Maddesi" },
  { icon: ListChecks, value: "15+", label: "Modül" },
  { icon: Calendar, value: "9 adım", label: "Kurulum Akışı" },
  { icon: Target, value: "5+", label: "Performans Göstergesi" },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* HERO KART */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-accent/8 via-white to-white p-5 sm:p-6 mb-4 animate-slide-up">
        <div className="flex items-start gap-4">
          <span className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent text-white shadow-soft shrink-0">
            <HelpCircle size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-[1.5px]">
              <Sparkles size={11} /> NASIL ÇALIŞIR
            </span>
            <h1 className="font-display text-2xl sm:text-[28px] font-extrabold text-text leading-tight tracking-tight mt-2">
              Platformu Adım Adım Tanıyın
            </h1>
            <p className="text-sm text-text2 mt-2 max-w-3xl leading-relaxed">
              Proje kurulumundan müşteriyle paylaşıma kadar tüm akış {STEPS.length} adımda anlatıldı.
              Her adımda ne yapıldığını, hangi değerin otomatik hesaplandığını ve hangi pratik
              özelliklerin işini kolaylaştırdığını detayda görebilirsin.
            </p>
          </div>
        </div>
      </div>

      {/* KPI ŞERİDİ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 animate-slide-up">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-white px-4 py-3 flex items-center gap-3 hover:-translate-y-0.5 hover:shadow-soft transition-all"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-accent/10 text-accent shrink-0">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-lg font-extrabold text-text leading-none tabular-nums">
                  {s.value}
                </div>
                <div className="text-[11px] text-text3 mt-0.5">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* İPUCU */}
      <div className="rounded-xl border border-blue/25 bg-blue/5 px-4 py-3 mb-5 flex items-start gap-3 animate-slide-up">
        <Lightbulb size={18} className="text-blue shrink-0 mt-0.5" />
        <div className="text-[13px] text-text2 leading-relaxed">
          <strong className="text-blue font-bold">İpucu:</strong> Bir kez WBS ağırlıklarını ve planlamayı kurduğunda,
          günlük operasyon (gerçekleşme + puantaj) saha mühendisinin işidir. Sen sadece SPI / CPI eşiği aşıldığında
          Dashboard'dan uyarı alır, kritik konulara odaklanırsın.
        </div>
      </div>

      {/* ADIM KARTLARI */}
      <div className="space-y-2.5">
        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} defaultOpen={i === 0} />
        ))}
      </div>

      <div className="mt-8 mb-2 text-center">
        <div className="text-[11px] text-text3 font-mono">
          {STEPS.length} adımda eksiksiz proje yönetimi · proje-yonetim-platformu
        </div>
      </div>
    </>
  );
}

function StepCard({ step, defaultOpen = false }: { step: Step; defaultOpen?: boolean }) {
  const Icon = step.icon;
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-border bg-white overflow-hidden transition-all open:border-l-4 open:border-l-accent open:shadow-soft"
    >
      <summary className="cursor-pointer list-none px-4 py-3.5 flex items-center gap-3.5 hover:bg-bg2/40 transition-colors">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent text-white shrink-0 shadow-sm">
          <Icon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[1.5px] font-bold text-accent">
            ADIM {step.num}
          </div>
          <div className="font-display font-extrabold text-[15px] sm:text-base text-text tracking-tight leading-tight mt-0.5">
            {step.title}
          </div>
          <div className="text-[12.5px] text-text2 mt-0.5 truncate sm:whitespace-normal">
            {step.summary}
          </div>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-text3 font-medium shrink-0 group-open:hidden">
          Detaylar
          <ChevronDown size={14} />
        </span>
        <span className="hidden group-open:flex items-center gap-1 text-[11px] text-accent font-bold shrink-0">
          Kapat
          <ChevronDown size={14} className="rotate-180" />
        </span>
      </summary>

      <div className="px-4 pb-4 pt-1 border-t border-border bg-bg2/20">
        <p className="text-[13px] text-text leading-relaxed mt-3">
          {step.details.intro}
        </p>

        {step.details.bullets.length > 0 && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {step.details.bullets.map((b) => (
              <div
                key={b.label}
                className="rounded-lg border border-border bg-white px-3 py-2"
              >
                <div className="text-[9px] uppercase tracking-wider font-bold text-text3">
                  {b.label}
                </div>
                <div className="text-xs font-semibold text-text mt-0.5">{b.value}</div>
              </div>
            ))}
          </div>
        )}

        {step.details.tip && (
          <div className="mt-3 rounded-lg bg-yellow/8 border border-yellow/30 px-3 py-2 flex items-start gap-2">
            <Lightbulb size={13} className="text-yellow shrink-0 mt-0.5" />
            <span className="text-[12px] text-text2">
              <strong className="text-yellow font-bold">İpucu:</strong> {step.details.tip}
            </span>
          </div>
        )}
      </div>
    </details>
  );
}
