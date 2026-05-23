"use client";

import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Save,
  Building2,
  Shield,
  Calendar,
  KeyRound,
  Mail,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { useStore, useCurrentUser, usePanelName } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export default function AccountPage() {
  const user = useCurrentUser();
  const updateUser = useStore((s) => s.updateCurrentUser);
  const storedPanelName = useStore((s) => s.panelName);
  const setPanelName = useStore((s) => s.setPanelName);
  const effectivePanelName = usePanelName(); // boşsa otomatik fullName döner
  const toast = useToast((s) => s.push);

  const [fullName, setFullName] = useState("");
  const [panel, setPanel] = useState("");
  const [pwd, setPwd] = useState({ current: "", next: "", repeat: "" });

  useEffect(() => {
    if (user) setFullName(user.fullName);
  }, [user?.id, user?.fullName]);

  useEffect(() => {
    setPanel(storedPanelName);
  }, [storedPanelName]);

  if (!user) {
    return (
      <Card>
        <div className="text-sm text-text2">Kullanıcı bilgisi bulunamadı.</div>
      </Card>
    );
  }

  function saveProfile() {
    updateUser({ fullName: fullName.trim() });
    toast("Profil bilgileri kaydedildi.", "success");
  }

  function savePanel() {
    setPanelName(panel.trim());
    toast("Panel adı güncellendi.", "success");
  }

  function savePassword() {
    if (!pwd.current) return toast("Mevcut şifreyi girin.", "error");
    if (pwd.next.length < 8) return toast("Yeni şifre en az 8 karakter olmalı.", "error");
    if (pwd.next !== pwd.repeat) return toast("Yeni şifre ile tekrar eşleşmiyor.", "error");
    // Local-mod: gerçek şifre kontrolü yok; sadece simülasyon
    setPwd({ current: "", next: "", repeat: "" });
    toast("Şifre güncellendi (lokal mod).", "success");
  }

  const initials = (user.fullName || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* PROFİL HEADER KARTI */}
      <Card className="!p-0 overflow-hidden border-accent/25">
        <div className="bg-gradient-to-br from-accent/10 via-white to-accent/5 p-6">
          <div className="flex items-start gap-4 flex-wrap">
            {/* Avatar */}
            <div
              className="flex items-center justify-center size-20 rounded-2xl text-white font-extrabold text-2xl shadow-sm shrink-0"
              style={{ background: "linear-gradient(135deg, #10b981 0%, #047857 100%)" }}
            >
              {initials}
            </div>

            {/* İsim & email */}
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[1.4px] text-accent">
                <UserIcon className="size-3" />
                Profilim
              </div>
              <h1 className="font-display text-2xl md:text-[28px] font-extrabold text-text tracking-tight mt-2 leading-tight">
                {user.fullName}
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {user.isSuperAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent text-white text-[10px] font-bold uppercase tracking-wider">
                    <Shield className="size-3" />
                    Yönetici
                  </span>
                )}
                <span className="text-[13px] text-text2 inline-flex items-center gap-1">
                  <Mail className="size-3.5 text-text3" />
                  {user.email}
                </span>
              </div>
            </div>
          </div>

          {/* 3 info chip */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <InfoChip
              icon={Building2}
              label="Şirket / Panel"
              value={effectivePanelName || "—"}
            />
            <InfoChip
              icon={Shield}
              label="Rol"
              value={user.isSuperAdmin ? "Yönetici" : "Kullanıcı"}
            />
            <InfoChip
              icon={Calendar}
              label="Üyelik Tarihi"
              value={formatDate(user.createdAt)}
            />
          </div>
        </div>
      </Card>

      {/* PROFİL BİLGİLERİ */}
      <SectionCard
        icon={UserIcon}
        title="Profil bilgileri"
        description="Görünen adınızı güncelleyin — ekip arkadaşlarınız sizi bu isimle görür."
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="!mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text3">
              Ad Soyad
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Adınız Soyadınız"
            />
          </div>
          <div>
            <Label className="!mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text3">
              E-posta
            </Label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
              <Input
                value={user.email}
                readOnly
                disabled
                className="pl-9 cursor-not-allowed bg-bg2"
              />
            </div>
            <p className="text-[11px] text-text3 mt-1 inline-flex items-center gap-1">
              <Lock className="size-3" />
              E-posta değiştirilemez. Değişim için iletişime geçin.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <Button variant="accent" onClick={saveProfile}>
            <Save className="size-4" />
            Kaydet
          </Button>
        </div>
      </SectionCard>

      {/* ŞİRKET / PANEL ADI */}
      <SectionCard
        icon={Building2}
        title="Şirket / Panel Adı"
        description={
          <>
            Topbar'da görünen ad. Varsayılan olarak <strong className="text-text">ad-soyadınız</strong>{" "}
            kullanılır; şirket veya ekip adı yazmak isterseniz aşağıdan değiştirebilirsiniz.
          </>
        }
      >
        <Label className="!mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text3">
          Şirket / Panel Adı
        </Label>
        <Input
          value={panel}
          onChange={(e) => setPanel(e.target.value)}
          placeholder={user.fullName ? `Otomatik: ${user.fullName}` : "Şirket / panel adı"}
        />
        <div className="text-[11px] text-text3 mt-1.5">
          Şu an gösterilen:{" "}
          <strong className="text-text font-semibold">{effectivePanelName || "—"}</strong>
          {!storedPanelName.trim() && (
            <span className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded bg-accent/10 text-accent text-[9px] font-bold uppercase tracking-wider">
              Otomatik
            </span>
          )}
        </div>
        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <Button variant="accent" onClick={savePanel}>
            <Save className="size-4" />
            Kaydet
          </Button>
          {storedPanelName.trim() && (
            <Button
              variant="ghost"
              onClick={() => {
                setPanelName("");
                setPanel("");
                toast("Otomatik (ad-soyad) kullanılıyor.", "info");
              }}
            >
              Varsayılana Döndür
            </Button>
          )}
        </div>
      </SectionCard>

      {/* ŞİFRE GÜVENLİĞİ */}
      <SectionCard
        icon={KeyRound}
        title="Şifre güvenliği"
        description={
          <>
            Mevcut şifrenizi onaylayarak yeni bir şifre belirleyin. Şifrenizi unuttuysanız çıkış
            yapıp <strong className="text-text">"Şifremi unuttum"</strong> bağlantısını kullanın.
          </>
        }
      >
        <div>
          <Label className="!mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text3">
            Mevcut Şifre
          </Label>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
            <Input
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
              className="pl-9"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div>
            <Label className="!mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text3">
              Yeni Şifre
            </Label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
              <Input
                type="password"
                value={pwd.next}
                onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
                className="pl-9"
                placeholder="En az 8 karakter"
              />
            </div>
          </div>
          <div>
            <Label className="!mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text3">
              Yeni Şifre (Tekrar)
            </Label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3" />
              <Input
                type="password"
                value={pwd.repeat}
                onChange={(e) => setPwd({ ...pwd, repeat: e.target.value })}
                className="pl-9"
                placeholder="En az 8 karakter"
              />
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center flex-wrap gap-3">
          <Button variant="accent" onClick={savePassword}>
            <Save className="size-4" />
            Şifreyi Güncelle
          </Button>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-text3">
            <ShieldAlert className="size-3.5 text-yellow" />
            Şifre değişiminden sonra mevcut oturumlar bozulmaz.
          </span>
        </div>
      </SectionCard>
    </div>
  );
}

function InfoChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 flex items-center gap-2.5">
      <span className="inline-flex items-center justify-center size-8 rounded-lg bg-accent/12 text-accent shrink-0">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-text3">{label}</div>
        <div className="text-[13px] font-semibold text-text truncate">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="!p-0">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-5">
          <span className="inline-flex items-center justify-center size-10 rounded-xl bg-accent/12 text-accent shrink-0">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold text-text tracking-tight">{title}</h3>
            <p className="text-[13px] text-text2 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </Card>
  );
}
