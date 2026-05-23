"use client";

import { useRef, useState } from "react";
import { FlaskConical, Upload, Download, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Sandbox (Planlama Atölyesi) ilk açıldığında — proje yoksa — karşılayan ekran.
 * Kullanıcıya tek tıkla 3000'den indirilmiş JSON yedeğini içe aktarma şansı verir.
 *
 * Sadece sandbox modunda VE proje listesi boşsa render edilir.
 */
export function SandboxWelcome({ children }: { children: React.ReactNode }) {
  const projects = useStore((s) => s.projects);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast((s) => s.push);
  const [importing, setImporting] = useState(false);

  // Sandbox'ta proje var ise normal UI'yı render et
  if (projects.length > 0) return <>{children}</>;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const storeObj = parsed?.store ?? parsed;
      if (!storeObj || !storeObj.state || !storeObj.state.projects) {
        toast("Geçersiz yedek dosyası", "error");
        setImporting(false);
        e.target.value = "";
        return;
      }
      localStorage.setItem("ges-store", JSON.stringify(storeObj));
      toast("İçe aktarıldı — sayfa yenileniyor", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      console.error(err);
      toast("Dosya okunamadı — geçerli JSON mu?", "error");
      setImporting(false);
    }
    e.target.value = "";
  }

  return (
    <div className="min-h-[calc(100vh-180px)] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/[0.04] via-white to-blue/[0.04] p-8 md:p-10 shadow-medium">
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-yellow text-white shrink-0">
              <FlaskConical size={22} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-yellow">
                🧪 Planlama Atölyesi
              </div>
              <h1 className="font-display text-2xl font-extrabold text-text leading-tight">
                Sandbox hazır — şimdi 10 MWp GES verini yükle
              </h1>
            </div>
          </div>

          <p className="text-text2 text-[13.5px] leading-relaxed mb-5">
            Bu ortam <strong>ana projenden tamamen izole</strong> (port 3001, ayrı
            localStorage). Burada ne yaparsan yap <strong>localhost:3000 etkilenmez</strong>.
            Başlamak için ana projenin bir kopyasını içe aktarman gerek (sadece bir kez).
          </p>

          {/* Adımlar */}
          <div className="space-y-3 mb-6">
            <Step
              n={1}
              title="Ana projeden yedek al"
              desc="Yeni sekme aç → http://localhost:3000 → sol menüde Veri Yedeği → 'JSON Yedek İndir' butonuna bas. Dosya masaüstüne iner."
            />
            <Step
              n={2}
              title="Bu sandbox'a yükle"
              desc="Aşağıdaki butona bas → masaüstündeki JSON dosyasını seç. 10 MWp GES projen sandbox'a kopyalanır."
            />
            <Step
              n={3}
              title="Çalış"
              desc="WBS düzenle, planla, sihirbazlarla oyna — özgürce. Ana projen dokunulmaz. Memnunsan sandbox'tan yeni yedek alıp ana projeye geri yükleyebilirsin."
            />
          </div>

          {/* CTA */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            className="hidden"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="accent"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex-1"
            >
              <Upload size={16} />
              {importing ? "Yükleniyor…" : "JSON Dosyası Seç ve İçe Aktar"}
              <ArrowRight size={14} />
            </Button>
            <a
              href="http://localhost:3000/backup"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 px-4 h-12 rounded-xl bg-white border border-border hover:border-accent/40 hover:bg-bg2 text-text2 font-semibold text-sm transition-colors"
            >
              <Download size={14} />
              3000&apos;de Yedek Al
            </a>
          </div>

          <div className="mt-5 pt-4 border-t border-border text-[11.5px] text-text3 leading-relaxed">
            <strong className="text-text2">Not:</strong> Tarayıcı güvenliği nedeniyle ana
            projenin verisi otomatik olarak sandbox&apos;a kopyalanamıyor (farklı portlar = farklı
            origin&apos;ler, JavaScript erişimi yasak). Tek seferlik 5 saniye sürer — sonra sandbox
            hep dolu kalır.
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-[12px] font-bold shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-text text-[13px] leading-tight">{title}</div>
        <div className="text-[12px] text-text2 leading-snug mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
