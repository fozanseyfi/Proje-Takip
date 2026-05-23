"use client";

import { useEffect, useState } from "react";
import { Settings, Save, Trash2, Eye, Lock, Unlock } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { addDays, toISODate } from "@/lib/utils";
import type { Currency } from "@/lib/utils";
import type { Project } from "@/lib/store/types";

export default function SettingsPage() {
  const project = useCurrentProject();
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const setProjectDemo = useStore((s) => s.setProjectDemo);

  const [form, setForm] = useState<Partial<Project>>({});

  useEffect(() => {
    if (project) setForm({ ...project });
  }, [project?.id]);

  if (!project)
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
      </Card>
    );

  const toast = useToast((s) => s.push);

  function save() {
    if (!project) return;
    let plannedEnd = form.plannedEnd;
    if (form.startDate && form.durationDays != null) {
      plannedEnd = toISODate(addDays(form.startDate, form.durationDays));
    }
    updateProject(project.id, { ...form, plannedEnd });
    toast("Proje ayarları kaydedildi", "success");
  }

  return (
    <>
      <PageHeader
        title="Proje Ayarları"
        icon={Settings}
        actions={
          <Button variant="accent" onClick={save}>
            <Save size={14} /> Kaydet
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardTitle>Genel</CardTitle>
          <div className="space-y-3">
            <Field label="Proje Adı">
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Konum">
              <Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field
              label="Ana Yüklenici (Panel Sahibi)"
              hint="İşverenle sözleşmesi olan tarafımız. Personel ekleme şirket listesinde otomatik gözükür; alt yüklenici listelerinde gözükmez."
            >
              <Input
                value={form.mainContractorName ?? ""}
                onChange={(e) => setForm({ ...form, mainContractorName: e.target.value })}
                placeholder="örn. ABC Enerji A.Ş."
              />
            </Field>
            <Field label="Durum">
              <Select
                value={form.status ?? "active"}
                onChange={(e) => setForm({ ...form, status: e.target.value as Project["status"] })}
              >
                <option value="draft">Taslak</option>
                <option value="active">Aktif</option>
                <option value="completed">Tamamlandı</option>
                <option value="archived">Arşivlendi</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Tarih & Süre</CardTitle>
          <div className="space-y-3">
            <Field label="Başlangıç">
              <Input
                type="date"
                value={form.startDate ?? ""}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field label="Süre (gün)">
              <Input
                type="number"
                value={form.durationDays ?? 0}
                onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Sözleşme Bitiş">
              <Input
                type="date"
                value={form.contractEnd ?? ""}
                onChange={(e) => setForm({ ...form, contractEnd: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Finansal</CardTitle>
          <div className="space-y-3">
            <Field label="Kurulu Güç (MWp)">
              <Input
                type="number"
                step="0.01"
                value={form.installedCapacityMw ?? ""}
                onChange={(e) =>
                  setForm({ ...form, installedCapacityMw: Number(e.target.value) || null })
                }
              />
            </Field>
            <Field label="Sözleşme Bedeli">
              <Input
                type="number"
                value={form.totalBudget ?? ""}
                onChange={(e) => setForm({ ...form, totalBudget: Number(e.target.value) || null })}
              />
            </Field>
            <Field label="Para Birimi">
              <Select
                value={form.budgetCurrency ?? "TRY"}
                onChange={(e) => setForm({ ...form, budgetCurrency: e.target.value as Currency })}
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </Select>
            </Field>
          </div>
        </Card>
      </div>

      <Card className="mt-4 border-accent/30">
        <CardTitle>Örnek (Demo) Olarak İşaretle</CardTitle>
        <div className="text-[12.5px] text-text2 leading-relaxed mb-3">
          <strong>Bu projeyi platformda örnek/sergi projesi olarak işaretle.</strong> Demo
          projede:
          <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
            <li>Tüm yazma aksiyonları kilitlenir (Kaydet/Sil/Düzenle no-op).</li>
            <li>Rapor tarihi <strong>15 Mayıs 2026</strong> tarihinde donmuş kalır.</li>
            <li>Sayfa üstünde sarı banner görünür.</li>
            <li>Diğer kullanıcılar Klonla ile kendi kopyalarını oluşturabilir.</li>
          </ul>
        </div>
        {project.isDemo ? (
          <Button
            variant="outline"
            onClick={() => {
              if (
                confirm(
                  `"${project.name}" projesi örnek modundan çıkarılsın mı? Yeniden düzenlenebilir hale gelir.`
                )
              ) {
                setProjectDemo(project.id, false);
                toast("Örnek modu kapatıldı — proje yeniden düzenlenebilir", "success");
              }
            }}
          >
            <Unlock size={14} /> Örnek Modunu Kapat
          </Button>
        ) : (
          <Button
            variant="accent"
            onClick={() => {
              if (
                confirm(
                  `"${project.name}" projesi örnek olarak işaretlensin mi? Bu sayfada yazma aksiyonları kilitlenecek.`
                )
              ) {
                setProjectDemo(project.id, true);
                toast("Proje örnek olarak işaretlendi — kilit aktif", "success");
              }
            }}
          >
            <Lock size={14} /> Bu Projeyi Örnek Olarak İşaretle
          </Button>
        )}
        {project.isDemo && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow/15 text-yellow text-[11px] font-bold">
            <Eye size={11} /> Şu an örnek modunda — değişiklikler kaydedilmez
          </div>
        )}
      </Card>

      <Card className="mt-4 border-red/30">
        <CardTitle>Tehlikeli Bölge</CardTitle>
        <Alert variant="warning" className="mb-3">
          Projeyi silmek geri alınamaz bir işlem değildir — tüm bağlı veriler (WBS, planlama, gerçekleşme,
          puantaj, vb.) silinir. (Lokal sürümde localStorage&apos;dan kaldırılır.)
        </Alert>
        <Button
          variant="danger"
          onClick={() => {
            if (confirm(`"${project.name}" projesi ve tüm verileri silinsin mi?`)) {
              deleteProject(project.id);
            }
          }}
        >
          <Trash2 size={14} /> Projeyi Sil
        </Button>
      </Card>
    </>
  );
}
