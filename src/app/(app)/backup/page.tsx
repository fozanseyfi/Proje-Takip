"use client";

import { useRef, useState } from "react";
import { Database, Download, Upload, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { loadingOverlay } from "@/lib/ui-loading";

export default function BackupPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast((s) => s.push);
  const [importing, setImporting] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState<string | null>(null);

  // Tüm store'u JSON olarak dök
  function exportAll() {
    loadingOverlay.start("Yedek hazırlanıyor");
    try {
      const raw = localStorage.getItem("ges-store");
      if (!raw) {
        toast("Yedeklenecek veri bulunamadı", "error");
        return;
      }
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, 19);
      const filename = `proje-takip-yedek-${stamp}.json`;

      // Pretty-print + meta bilgi
      const parsed = JSON.parse(raw);
      const payload = {
        platform: "proje-takip",
        exportedAt: new Date().toISOString(),
        version: 1,
        store: parsed,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Bilgi
      const sizeKb = (blob.size / 1024).toFixed(1);
      const projectCount = parsed?.state?.projects?.length ?? 0;
      setLastExportInfo(
        `${filename} — ${sizeKb} KB · ${projectCount} proje`
      );
      try {
        localStorage.setItem("ges-store-last-export", new Date().toISOString());
      } catch {
        // ignore
      }
      toast("Yedek indirildi", "success");
    } catch (err) {
      console.error(err);
      toast("Yedek alınırken hata oluştu", "error");
    } finally {
      loadingOverlay.stop();
    }
  }

  // Dosyadan içe aktar
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !confirm(
        "DİKKAT: Mevcut tüm verilerin (projeler, WBS, puantaj, faturalar…) yedek dosyası ile DEĞİŞTİRİLECEK. Önce mevcut verini export'tan yedekle. Devam edilsin mi?"
      )
    ) {
      e.target.value = "";
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // İki olası şekil: ya tam zustand persist objesi ({state, version}) ya da bizim wrapper
      const storeObj = parsed?.store ?? parsed;
      if (
        !storeObj ||
        typeof storeObj !== "object" ||
        !storeObj.state ||
        !storeObj.state.projects
      ) {
        toast("Geçersiz yedek dosyası — proje bulunamadı", "error");
        setImporting(false);
        e.target.value = "";
        return;
      }

      localStorage.setItem("ges-store", JSON.stringify(storeObj));
      toast("Yedek geri yüklendi — sayfa yenileniyor", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      toast("Yedek dosyası okunamadı — geçerli bir JSON mu?", "error");
      setImporting(false);
    }
    e.target.value = "";
  }

  // Mevcut özet
  const summary = (() => {
    try {
      const raw = localStorage.getItem("ges-store");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const s = parsed?.state ?? {};
      return {
        projects: (s.projects ?? []).length,
        wbs: (s.wbs ?? []).length,
        personnel: (s.personnelMaster ?? []).length,
        machines: (s.machinesMaster ?? []).length,
        attendance:
          (s.personnelAttendance ?? []).length + (s.machineAttendance ?? []).length,
        bills: (s.billing ?? []).length,
        procurement: (s.procurement ?? []).length,
      };
    } catch {
      return null;
    }
  })();

  const lastExportAt = (() => {
    try {
      return localStorage.getItem("ges-store-last-export");
    } catch {
      return null;
    }
  })();

  return (
    <>
      <PageHeader
        title="Veri Yedeği"
        description="Tüm projelerin, WBS, puantaj, fatura, ayar — JSON olarak indir / geri yükle."
        icon={Database}
      />

      <Alert variant="warning" className="mb-4">
        <strong>Önemli:</strong> Bu platform şu an verileri sadece bu tarayıcının
        localStorage&apos;ında tutar. Tarayıcı temizlenirse veya site verisi silinirse
        veriler <strong>geri dönmez</strong>. Düzenli olarak yedek alın.
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Mevcut durum */}
        <Card>
          <CardTitle>Mevcut Verin</CardTitle>
          {summary ? (
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <Stat label="Proje" value={summary.projects} />
              <Stat label="WBS Kalem" value={summary.wbs} />
              <Stat label="Personel" value={summary.personnel} />
              <Stat label="Makine" value={summary.machines} />
              <Stat label="Puantaj Kaydı" value={summary.attendance} />
              <Stat label="Fatura" value={summary.bills} />
              <Stat label="Tedarik" value={summary.procurement} />
            </div>
          ) : (
            <p className="text-sm text-text2">Henüz veri yok.</p>
          )}
          {lastExportAt && (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-text3">
              <Clock size={11} />
              Son yedek: <span className="font-mono">{new Date(lastExportAt).toLocaleString("tr-TR")}</span>
            </div>
          )}
        </Card>

        {/* Yedek al */}
        <Card>
          <CardTitle>
            <Download size={16} className="inline mr-1.5" />
            Yedek Al (Export)
          </CardTitle>
          <p className="text-sm text-text2 leading-relaxed mb-3">
            Tüm verilerini tek bir JSON dosyası olarak bilgisayarına indirir. Dosyayı
            güvenli bir yerde sakla — gerektiğinde geri yükleyebilirsin.
          </p>
          <Button variant="accent" onClick={exportAll}>
            <Download size={14} /> JSON Yedek İndir
          </Button>
          {lastExportInfo && (
            <div className="mt-3 inline-flex items-start gap-2 text-[11.5px] text-green bg-green/5 border border-green/20 rounded-md px-2.5 py-1.5">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
              <span>{lastExportInfo}</span>
            </div>
          )}
        </Card>
      </div>

      {/* Geri yükle */}
      <Card>
        <CardTitle>
          <Upload size={16} className="inline mr-1.5" />
          Yedek Geri Yükle (Import)
        </CardTitle>
        <Alert variant="error" className="mb-3">
          <AlertTriangle size={14} className="inline mr-1" />
          <strong>Geri yükleme mevcut verilerinin ÜZERİNE yazar.</strong> Önce şu anki
          durumunu Yedek Al ile indir, sonra geri yüklemeye geç.
        </Alert>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          <Upload size={14} /> {importing ? "İçe aktarılıyor…" : "JSON Dosyası Seç"}
        </Button>
      </Card>

      <Alert variant="info" className="mt-4">
        <strong>İpucu:</strong> Yedek alma alışkanlığı edin — her hafta sonu veya önemli
        veri girişi sonrası &quot;JSON Yedek İndir&quot;e bas. Dosya küçük (genelde 50 KB
        - 1 MB), istediğin bulut depoya da yedekleyebilirsin (Drive, Dropbox vb.).
      </Alert>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between px-3 py-2 rounded-md bg-bg2/40 border border-border">
      <span className="text-text3 text-[11px] uppercase tracking-wider font-semibold">{label}</span>
      <span className="font-mono font-bold text-text">{value}</span>
    </div>
  );
}
