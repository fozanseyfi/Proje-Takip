"use client";

import { useState } from "react";
import { Share2, Copy, Check, Plus, X } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { confirmAction } from "@/components/ui/confirm";
import { formatDate, uid, toISODate, addDays } from "@/lib/utils";

export default function SharePage() {
  const project = useCurrentProject();
  const updateProject = useStore((s) => s.updateProject);
  const [copied, setCopied] = useState(false);

  if (!project)
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
      </Card>
    );

  function createToken() {
    if (!project) return;
    const token = uid().replace(/-/g, "");
    const expires = toISODate(addDays(new Date(), 30));
    updateProject(project.id, {
      publicShareToken: token,
      publicShareExpiresAt: expires,
    });
  }

  async function revoke() {
    if (!project) return;
    if (!(await confirmAction({
      title: "Public link iptal edilsin mi?",
      message: "Mevcut paylaşım linki devre dışı kalır. Bu link ile sayfayı açanlar artık erişemez.",
      danger: true,
      confirmText: "İptal Et",
    }))) return;
    updateProject(project.id, {
      publicShareToken: null,
      publicShareExpiresAt: null,
    });
  }

  function copyLink() {
    if (!project?.publicShareToken) return;
    const url = `${window.location.origin}/p/${project.publicShareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <PageHeader
        title="Public Paylaşım"
        description="Müşteriye/yatırımcıya read-only link gönder"
        icon={Share2}
      />

      <Card className="mb-4">
        <CardTitle>Public Link Durumu</CardTitle>
        {!project.publicShareToken ? (
          <div className="space-y-3">
            <p className="text-sm text-text2">
              Henüz public link oluşturulmamış. Müşteriye gönderebileceğin read-only bir bağlantı üretebilirsin.
            </p>
            <Button variant="accent" onClick={createToken}>
              <Plus size={14} /> Link Oluştur
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="green">Aktif</Badge>
              {project.publicShareExpiresAt && (
                <span className="text-xs text-text3">
                  Son geçerlilik: {formatDate(project.publicShareExpiresAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/p/${project.publicShareToken}`}
                readOnly
                className="font-mono text-xs"
              />
              <Button onClick={copyLink} variant="accent">
                {copied ? (
                  <>
                    <Check size={14} /> Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy size={14} /> Kopyala
                  </>
                )}
              </Button>
            </div>
            <Button variant="danger" onClick={revoke}>
              <X size={14} /> Linki İptal Et
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Görünür Modüller</CardTitle>
        <Alert variant="info" className="mb-3">
          Bu sürümde tüm okunabilir modüller (Dashboard, S-eğrisi, WBS, Günlük Rapor özeti) public link&apos;te
          gösterilir. Bütçe ve hassas veriler (TC, yevmiye) <strong>her zaman gizli</strong>.
        </Alert>
        <ul className="text-sm text-text2 space-y-1 list-disc list-inside ml-1">
          <li>Dashboard (KPI, S-eğrisi, ilerleme)</li>
          <li>WBS Yapısı (genel görünüm)</li>
          <li>Günlük Rapor (foto + özet)</li>
          <li className="text-text3">Personel TC, yevmiye — gizli</li>
          <li className="text-text3">Bütçe & finansal detaylar — gizli</li>
        </ul>
      </Card>
    </>
  );
}
