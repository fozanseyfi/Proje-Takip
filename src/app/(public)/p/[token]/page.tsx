"use client";

import { use, useMemo } from "react";
import { Globe, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardTitle, KpiCard } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SCurveChart } from "@/components/charts/s-curve-chart";
import { computeProgress, buildSCurve } from "@/lib/calc/progress";
import { formatDate, formatPct, spiLevel, daysBetween, cn, toISODate } from "@/lib/utils";

export default function PublicViewer({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const projects = useStore((s) => s.projects);
  const wbsAll = useStore((s) => s.wbs);
  const plannedAll = useStore((s) => s.planned);
  const realizedAll = useStore((s) => s.realized);

  const project = useMemo(() => projects.find((p) => p.publicShareToken === token), [projects, token]);

  const today = toISODate(new Date());
  const stats = useMemo(() => {
    if (!project) return null;
    const items = wbsAll
      .filter((w) => w.projectId === project.id && !w.deletedAt)
      .map((w) => ({ code: w.code, isLeaf: w.isLeaf, quantity: w.quantity, weight: w.weight }));
    const planned = plannedAll[project.id] || {};
    const realized = realizedAll[project.id] || {};
    const { planPct, realPct, spi } = computeProgress(items, planned, realized, today);
    const sCurve = buildSCurve(items, planned, realized, today);
    return { planPct, realPct, spi, sCurve };
  }, [project, wbsAll, plannedAll, realizedAll, today]);

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <Lock size={36} className="mx-auto text-text3 mb-3" />
          <CardTitle>Geçersiz Link</CardTitle>
          <Alert variant="error">
            Bu paylaşım linki bulunamadı veya iptal edilmiş. Lütfen yöneticiyle iletişime geç.
          </Alert>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const expired =
    project.publicShareExpiresAt && new Date(project.publicShareExpiresAt) < new Date();

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <Lock size={36} className="mx-auto text-text3 mb-3" />
          <CardTitle>Link Süresi Dolmuş</CardTitle>
          <Alert variant="warning">Bu paylaşım linkinin süresi {formatDate(project.publicShareExpiresAt!)} tarihinde sona erdi.</Alert>
        </Card>
      </div>
    );
  }

  const spiL = spiLevel(stats.spi);
  const elapsed = Math.max(0, daysBetween(project.startDate, today) + 1);
  const remaining = Math.max(0, project.durationDays - elapsed);

  return (
    <div className="min-h-screen">
      <header className="bg-bg2/95 border-b border-accent/15 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center gap-4">
          <Globe className="text-accent" />
          <div className="flex-1">
            <h1 className="font-display font-bold text-lg">{project.name}</h1>
            <p className="text-xs text-text3">{project.location} · Public Read-only Görüntüleme</p>
          </div>
          <Badge variant="accent">📖 Read Only</Badge>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Planlanan %"
            value={formatPct(stats.planPct, 1)}
            barPct={stats.planPct * 100}
            barColor="var(--planned)"
            valueClassName="text-planned"
          />
          <KpiCard
            label="Gerçekleşen %"
            value={formatPct(stats.realPct, 1)}
            barPct={stats.realPct * 100}
            barColor="var(--realized)"
            valueClassName="text-realized"
          />
          <KpiCard
            label="SPI"
            value={stats.spi == null ? "—" : stats.spi.toFixed(3)}
            valueClassName={cn(
              spiL === "good" && "text-green",
              spiL === "warn" && "text-yellow",
              spiL === "bad" && "text-red"
            )}
          />
          <KpiCard
            label="Geçen / Kalan"
            value={`${elapsed} / ${remaining}`}
            sub={`${project.durationDays} gün`}
          />
        </div>

        <Card>
          <CardTitle>S-Curve</CardTitle>
          {stats.sCurve.length > 0 ? (
            <SCurveChart data={stats.sCurve} reportDate={today} />
          ) : (
            <p className="text-sm text-text3">Henüz veri yok.</p>
          )}
        </Card>

        <Card>
          <CardTitle>Proje Bilgisi</CardTitle>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Info label="Başlangıç" value={formatDate(project.startDate)} />
            <Info label="Bitiş" value={formatDate(project.plannedEnd)} />
            <Info label="Rapor Tarihi" value={formatDate(today)} />
            <Info label="Kurulu Güç" value={project.installedCapacityMw ? `${project.installedCapacityMw} MW` : "—"} />
          </dl>
        </Card>

        <p className="text-center text-[11px] text-text3">
          Bu sayfa salt-okunur paylaşım amaçlıdır. Hassas veriler (TC, yevmiye, bütçe detayları) gizlenmiştir.
        </p>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider font-display text-text3">{label}</dt>
      <dd className="text-text font-medium">{value}</dd>
    </div>
  );
}
