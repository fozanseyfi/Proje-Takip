"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Globe, ArrowUpDown, MapPin, Plus, ShieldAlert, Sparkles, ArrowRight, ChevronDown, Copy } from "lucide-react";
import { useStore, useCurrentUser, isDemoProject, DEMO_REPORT_DATE } from "@/lib/store";
import type { Project, ProjectStatus } from "@/lib/store/types";
import { SAMPLE_PROJECT_NAME } from "@/lib/data/sample-loader";
import { CloneProjectDialog } from "@/components/projects/clone-project-dialog";
import { Card, CardTitle, KpiCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computeProgress } from "@/lib/calc/progress";
import { formatDate, formatPct, spiLevel, cn, daysBetween, toISODate } from "@/lib/utils";

export default function PortfolioPage() {
  const user = useCurrentUser();
  const projects = useStore((s) => s.projects);
  const allWbs = useStore((s) => s.wbs);
  const allPlanned = useStore((s) => s.planned);
  const allRealized = useStore((s) => s.realized);
  const lookahead = useStore((s) => s.lookahead);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const updateProject = useStore((s) => s.updateProject);

  const [sortBy, setSortBy] = useState<"name" | "spi" | "progress">("spi");
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState<Project | null>(null);

  const rows = useMemo(() => {
    const today = toISODate(new Date());
    return projects.map((p) => {
      // Demo projeler için sabit donmuş tarih, diğerleri için bugün.
      const refDate = isDemoProject(p) ? DEMO_REPORT_DATE : today;
      const items = allWbs
        .filter((w) => w.projectId === p.id && !w.deletedAt)
        .map((w) => ({ code: w.code, isLeaf: w.isLeaf, quantity: w.quantity, weight: w.weight }));
      const planned = allPlanned[p.id] || {};
      const realized = allRealized[p.id] || {};
      const { planPct, realPct, spi } = computeProgress(items, planned, realized, refDate);
      const elapsed = Math.max(0, daysBetween(p.startDate, refDate) + 1);
      const critOpen = lookahead.filter((l) => l.projectId === p.id && !l.done && l.priority === "critical").length;
      return { project: p, planPct, realPct, spi, elapsed, criticalOpen: critOpen };
    });
  }, [projects, allWbs, allPlanned, allRealized, lookahead]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      // Örnek proje her zaman en başta sabit
      if (a.project.name === SAMPLE_PROJECT_NAME) return -1;
      if (b.project.name === SAMPLE_PROJECT_NAME) return 1;
      if (sortBy === "name") return a.project.name.localeCompare(b.project.name);
      if (sortBy === "spi") {
        const aSpi = a.spi ?? 1;
        const bSpi = b.spi ?? 1;
        return aSpi - bSpi;
      }
      return a.realPct - b.realPct;
    });
  }, [rows, sortBy]);

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.project.status === "active").length;
    const avgSpi = rows.filter((r) => r.spi != null).reduce((s, r, _, arr) => s + (r.spi! / arr.length), 0);
    const avgReal =
      rows.length > 0
        ? rows.reduce((s, r) => s + r.realPct, 0) / rows.length
        : 0;
    return { total: rows.length, active, avgSpi, avgReal };
  }, [rows]);

  if (!user?.isSuperAdmin) {
    return (
      <Card>
        <CardTitle>Yetki Yok</CardTitle>
        <Alert variant="warning">Portfolio Dashboard sadece Süper Admin tarafından erişilebilir.</Alert>
      </Card>
    );
  }

  const firstName = (user.fullName || "").split(" ")[0] || "Yönetici";

  return (
    <>
      {/* HOŞGELDİN HERO */}
      <div className="relative overflow-hidden rounded-2xl mb-6 shadow-medium animate-slide-up">
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-emerald-600 to-emerald-700" />
        {/* Süs daireleri */}
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 right-32 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute top-1/2 -left-8 w-36 h-36 rounded-full bg-white/5" />

        <div className="relative px-7 py-7 text-white">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-[10px] font-bold uppercase tracking-[1.5px]">
            <Sparkles size={11} />
            Proje Yönetim Platformu · Portfolio
          </span>

          <h1 className="font-display text-2xl sm:text-[28px] font-extrabold mt-3 tracking-tight leading-tight">
            Hoş geldin, {firstName}
          </h1>
          <p className="text-sm sm:text-[14px] text-white/85 mt-2 max-w-2xl leading-relaxed">
            GES projelerinin sağlık durumunu tek ekranda izle. Şantiye verisini gerçek zamanlı topla,
            SPI/CPI/EAC göstergelerini takip et, kritik gecikmeleri zamanında yakala. Yeni bir proje
            açabilir, mevcutları detayda inceleyebilirsin.
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            <Link
              href="/projects?new=1"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-white text-accent font-bold text-sm hover:shadow-medium hover:-translate-y-0.5 transition-all"
            >
              <Plus size={15} />
              Yeni Proje
            </Link>
            <button
              onClick={() => setDisclaimerOpen(true)}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-sm transition-all"
            >
              <ShieldAlert size={15} />
              Disclaimer
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Toplam Proje" value={`${totals.total}`} sub={`${totals.active} aktif`} />
        <KpiCard
          label="Ort. SPI"
          value={totals.avgSpi ? totals.avgSpi.toFixed(3) : "—"}
          valueClassName={
            totals.avgSpi >= 0.95 ? "text-green" : totals.avgSpi >= 0.8 ? "text-yellow" : "text-red"
          }
        />
        <KpiCard
          label="Ort. İlerleme"
          value={formatPct(totals.avgReal, 1)}
          valueClassName="text-realized"
        />
        <KpiCard
          label="Görüntüleme"
          value={`${user.fullName}`}
          sub="Süper Admin"
          valueClassName="!text-sm !leading-tight"
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-sm font-bold text-text uppercase tracking-wider">
          Proje Listesi
        </h2>
        <button
          onClick={() => setSortBy((s) => (s === "spi" ? "name" : s === "name" ? "progress" : "spi"))}
          className="flex items-center gap-1.5 text-xs text-text2 hover:text-text"
        >
          <ArrowUpDown size={12} />
          Sırala: {sortBy === "spi" ? "Kritik" : sortBy === "name" ? "İsim" : "İlerleme"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRows.map((r) => {
          const lvl = spiLevel(r.spi);
          const isSample = r.project.name === SAMPLE_PROJECT_NAME;
          return (
            <div
              key={r.project.id}
              className={cn(
                "relative block rounded-2xl p-5 border bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-medium",
                lvl === "bad" && "border-red/30",
                lvl === "warn" && "border-yellow/30",
                lvl === "good" && "border-green/30",
                !lvl && "border-border",
                isSample && "ring-2 ring-accent/15 bg-gradient-to-br from-accent/5 to-white"
              )}
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <div className="font-display font-bold text-base text-text truncate">
                      {r.project.name}
                    </div>
                    {isSample && <Badge variant="accent">📌 Örnek</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-text3 mt-0.5">
                    <MapPin size={11} />
                    {r.project.location}
                  </div>
                </div>
                {isDemoProject(r.project) ? (
                  <span
                    className="inline-flex items-center px-2.5 h-7 rounded-md border border-accent/30 bg-accent/8 text-accent text-[11px] font-bold uppercase tracking-wider shrink-0"
                    title="Örnek proje — durumu değiştirilemez"
                  >
                    Örnek Proje
                  </span>
                ) : (
                  <StatusSelector
                    status={r.project.status}
                    onChange={(next) => updateProject(r.project.id, { status: next })}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 my-4">
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-display text-text3 mb-0.5">
                    Plan
                  </div>
                  <div className="font-mono text-sm text-planned">{formatPct(r.planPct, 0)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-display text-text3 mb-0.5">
                    Real
                  </div>
                  <div className="font-mono text-sm text-realized">{formatPct(r.realPct, 0)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider font-display text-text3 mb-0.5">
                    SPI
                  </div>
                  <div
                    className={cn(
                      "font-mono text-sm",
                      lvl === "good" && "text-green",
                      lvl === "warn" && "text-yellow",
                      lvl === "bad" && "text-red"
                    )}
                  >
                    {r.spi == null ? "—" : r.spi.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="h-1.5 bg-bg4 rounded-full overflow-hidden mb-2 relative">
                <div
                  className="absolute h-full bg-planned/50"
                  style={{ width: `${r.planPct * 100}%` }}
                />
                <div className="absolute h-full bg-realized" style={{ width: `${r.realPct * 100}%` }} />
              </div>

              <div className="flex items-center justify-between text-[11px] text-text3">
                <span>📅 {formatDate(isDemoProject(r.project) ? DEMO_REPORT_DATE : toISODate(new Date()))}</span>
                <div className="flex items-center gap-2">
                  {r.criticalOpen > 0 && <Badge variant="red">{r.criticalOpen} kritik</Badge>}
                  {isDemoProject(r.project) && (
                    <button
                      onClick={() => setCloneSource(r.project)}
                      title="Bu örnek projeyi klonla"
                      className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md bg-white border border-accent/40 text-accent text-[11px] font-bold hover:bg-accent/10 transition-all"
                    >
                      <Copy size={11} /> Klonla
                    </button>
                  )}
                  <Link
                    href="/dashboard"
                    onClick={() => setCurrentProject(r.project.id)}
                    className="inline-flex items-center gap-1 px-2.5 h-7 rounded-md bg-accent text-white text-[11px] font-bold hover:brightness-110 transition-all"
                  >
                    Aç <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <Card>
          <CardTitle>Proje yok</CardTitle>
          <p className="text-sm text-text2">Henüz proje oluşturulmamış.</p>
        </Card>
      )}

      <Dialog open={disclaimerOpen} onClose={() => setDisclaimerOpen(false)} title="Yasal Bildirim · Disclaimer" size="lg">
        <div className="space-y-4 text-sm text-text2 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          <div className="rounded-lg bg-yellow/8 border border-yellow/30 p-3 flex items-start gap-2.5">
            <ShieldAlert size={16} className="text-yellow shrink-0 mt-0.5" />
            <p className="text-[13px] text-text">
              <strong className="text-yellow">Önemli:</strong> Bu uygulama bir proje takip yardımcısıdır.
              Sözleşme, hukuki süreçler ve resmi raporlama için tek başına bağlayıcı kabul edilemez.
            </p>
          </div>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">1. Kullanım Amacı</h3>
            <p>
              Proje Yönetim Platformu; saha ekiplerinin günlük gerçekleşme, puantaj, planlama ve
              ilerleme takibini kolaylaştırmak amacıyla geliştirilmiş bir <strong className="text-text">iç araç</strong>tır.
              Hesaplanan değerler (SPI, CPI, EAC, S-eğrisi vb.) yönlendirici göstergelerdir;
              proje yönetim kararları için ek doğrulama gerektirir.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">2. Veri Sorumluluğu</h3>
            <p>
              Sisteme girilen tüm bilgilerin doğruluğundan ve güncelliğinden kullanıcı sorumludur.
              Uygulama, eksik veya yanlış girilen veriler üzerinden yapılan hesaplamaların sonuçlarından
              doğacak <strong className="text-text">hiçbir maddi, manevi veya hukuki zarardan</strong> sorumlu tutulamaz.
              Üçüncü taraflarla (işveren, alt yüklenici, müfettişlik vb.) paylaşılan raporların
              doğrulanması ilgili proje yöneticisinin sorumluluğundadır.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">3. Hukuki Bağlayıcılık</h3>
            <p>
              Bu platformdan alınan PDF/Excel çıktıları, dijital raporlar, panel görselleri ve hesaplamalar
              <strong className="text-text"> hukuki delil veya resmi belge niteliği taşımaz.</strong>
              Hak ediş, fatura, sözleşme değişikliği, ihbar, claim, tutanak gibi resmi süreçlerde
              imzalı ıslak veya KEP üzerinden gönderilmiş orijinal belgeler esas alınır. Bu uygulamadaki
              kayıtlar yalnızca ön çalışma ve takip amaçlıdır.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">4. KVKK & Gizlilik</h3>
            <p>
              Personel TC kimlik numarası, telefon, yevmiye gibi kişisel veriler 6698 sayılı
              Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında işlenir. Bu verilerin sisteme
              girilmesi, ilgili kişiden açık rıza alındığı varsayımıyla yapılır. Verilerin saklanması,
              paylaşılması ve silinmesi proje yöneticisinin sorumluluğundadır. Uygulama yöneticileri
              sızıntı, yetkisiz erişim veya veri kaybı durumlarından doğacak zararlardan sorumlu değildir.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">5. Yedekleme & Kayıp</h3>
            <p>
              Verilerin yedeklenmesinden kullanıcı sorumludur. Uygulama, donanım arızası, internet kesintisi,
              tarayıcı verisi silinmesi, beklenmedik hatalar veya 3. parti servis kesintileri sebebiyle
              oluşabilecek veri kaybından <strong className="text-text">sorumlu tutulamaz</strong>.
              Kritik veriler için düzenli aralıklarla Excel/PDF yedek alınması önerilir.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">6. Üçüncü Taraf Servisler</h3>
            <p>
              Hava durumu (Open-Meteo), döviz kuru (TCMB), e-posta (Resend) gibi üçüncü taraf servislerin
              kullanımı, ilgili servis sağlayıcının kendi koşullarına tabidir. Bu servislerin geçici veya
              kalıcı çalışmaması uygulamanın sorumluluğu altında değildir.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">7. Telif & Lisans</h3>
            <p>
              Uygulamadaki tüm yazılım kodu, tasarım ve dokümantasyon geliştiricinin telif kapsamındadır.
              İzinsiz kopyalanması, dağıtılması veya tersine mühendislik yapılması yasaktır.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-text text-[13px] mb-1.5">8. Sorumluluk Reddi</h3>
            <p>
              Uygulamayı kullanmaya devam eden her kullanıcı, yukarıdaki maddeleri okuduğunu, anladığını
              ve kabul ettiğini beyan etmiş sayılır. Anlaşmazlık durumunda Ankara mahkemeleri yetkilidir.
            </p>
          </section>

          <p className="text-[10px] text-text3 font-mono pt-2 border-t border-border">
            Son güncelleme: 2026-05-12 · proje-yonetim-platformu
          </p>
        </div>
        <DialogFooter>
          <Button variant="accent" onClick={() => setDisclaimerOpen(false)}>
            Okudum, Kabul Ediyorum
          </Button>
        </DialogFooter>
      </Dialog>

      <CloneProjectDialog
        open={!!cloneSource}
        onClose={() => setCloneSource(null)}
        source={cloneSource}
      />
    </>
  );
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  completed: "Tamamlandı",
  archived: "Arşiv",
};
const STATUS_VARIANT_BG: Record<ProjectStatus, string> = {
  draft: "bg-yellow/12 text-yellow border-yellow/30",
  active: "bg-green/12 text-green border-green/30",
  completed: "bg-blue/12 text-blue border-blue/30",
  archived: "bg-bg2 text-text3 border-border",
};

function StatusSelector({
  status,
  onChange,
}: {
  status: ProjectStatus;
  onChange: (s: ProjectStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: ProjectStatus[] = ["draft", "active", "completed"];
  return (
    <div className="relative shrink-0">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-all",
          STATUS_VARIANT_BG[status]
        )}
      >
        {STATUS_LABEL[status]}
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-7 right-0 z-40 min-w-[120px] py-1 rounded-lg bg-white border border-border shadow-medium">
          {options.map((opt) => (
            <button
              key={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "block w-full text-left px-3 py-1.5 text-xs hover:bg-bg2 transition-colors",
                opt === status ? "text-accent font-bold" : "text-text2"
              )}
            >
              {STATUS_LABEL[opt]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
