"use client";

import { useState } from "react";
import { HeartHandshake, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthMissionCard() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-yellow/30 bg-gradient-to-br from-yellow/8 via-white to-white overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <span className="inline-flex items-center justify-center size-10 rounded-lg bg-yellow text-white shadow-sm shrink-0">
          <HeartHandshake className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold uppercase tracking-[1.4px] text-yellow">
            Bağımsız İnisiyatif
          </div>
          <h4 className="text-[13px] font-bold text-text mt-0.5 leading-tight">
            Bilgi Paylaşımı Amacıyla Geliştirilmiş Ücretsiz Platform
          </h4>
          <p className="text-[12px] text-text2 mt-1.5 leading-relaxed">
            Sahada yaşadığım operasyonel ihtiyaçlardan doğan bu platform, ticari beklenti olmaksızın
            sektör paydaşlarının kullanımına sunulmuştur.
          </p>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-yellow hover:brightness-90 transition-all"
          >
            Geliştiricinin notu
            <ChevronDown
              className={cn("size-3 transition-transform", open && "rotate-180")}
            />
          </button>

          <div
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out",
              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="overflow-hidden">
              <p className="mt-3 text-[12px] text-text2 leading-relaxed">
                Yenilenebilir enerji sektöründe elektrik mühendisi olarak çalışırken — saha
                gerçekleşmesi, puantaj, satınalma ve raporlama akışlarında her gün benzer Excel
                tablolarını yeniden ürettiğimizi fark ettim. Bu süreçleri tek bir yerde toplayan,
                ekiplerin kolayca kullanabileceği ve müşteriye saygın bir görsel sunan bir araç
                eksikti.
              </p>
              <p className="mt-2 text-[12px] text-text2 leading-relaxed">
                Platform, gönüllü zamanlarımda geliştirildi ve ücretsiz. Hiçbir aşamada kullanıcı
                verileri reklam veya satış amacıyla işlenmez. Geri bildirimleriniz doğrudan bana
                ulaşır, hızlıca yeni özelliklere dönüşür.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Pill>Bireysel katkı</Pill>
                <Pill>Veri sizin</Pill>
                <Pill>Geri bildirim açık</Pill>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-yellow/30 text-[10px] font-bold text-yellow uppercase tracking-wider">
      {children}
    </span>
  );
}
