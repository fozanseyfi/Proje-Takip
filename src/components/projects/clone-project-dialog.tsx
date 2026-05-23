"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderTree, CalendarDays, Users, Truck, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { toISODate, cn } from "@/lib/utils";
import type { Project } from "@/lib/store/types";

export function CloneProjectDialog({
  open,
  onClose,
  source,
  redirectOnSuccess = true,
}: {
  open: boolean;
  onClose: () => void;
  source: Project | null;
  redirectOnSuccess?: boolean;
}) {
  if (!source) return null;
  return (
    <Dialog open={open} onClose={onClose} title="Projeyi Klonla" size="md">
      {/* key ile source değişince form state'i sıfırlanır */}
      <CloneForm
        key={source.id}
        source={source}
        onClose={onClose}
        redirectOnSuccess={redirectOnSuccess}
      />
    </Dialog>
  );
}

function CloneForm({
  source,
  onClose,
  redirectOnSuccess,
}: {
  source: Project;
  onClose: () => void;
  redirectOnSuccess: boolean;
}) {
  const cloneProject = useStore((s) => s.cloneProject);
  const toast = useToast((s) => s.push);
  const router = useRouter();

  const [name, setName] = useState(`${source.name} (Kopya)`);
  const [location, setLocation] = useState(source.location);
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [durationDays, setDurationDays] = useState(source.durationDays);

  const [cloneWbs, setCloneWbs] = useState(true);
  const [clonePlanned, setClonePlanned] = useState(true);
  const [clonePersonnel, setClonePersonnel] = useState(true);
  const [cloneMachine, setCloneMachine] = useState(true);

  function submit() {
    if (!name.trim()) {
      toast("Proje adı boş olamaz", "error");
      return;
    }
    const result = cloneProject(source.id, {
      name: name.trim(),
      location,
      startDate,
      durationDays,
      cloneWbs,
      clonePlanned: clonePlanned && cloneWbs, // planlama WBS olmadan anlamsız
      clonePersonnelAssignments: clonePersonnel,
      cloneMachineAssignments: cloneMachine,
    });
    if (!result) {
      toast("Klonlama başarısız", "error");
      return;
    }
    toast(`"${result.name}" oluşturuldu`, "success");
    onClose();
    if (redirectOnSuccess) router.push("/dashboard");
  }

  return (
    <>
      <div className="mb-4 px-3 py-2 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-2 text-[12px] leading-relaxed">
        <Sparkles size={14} className="text-accent shrink-0 mt-0.5" />
        <span className="text-text2">
          <strong className="text-text">{source.name}</strong> projesini klonluyorsun.
          Aşağıdan hangi verilerin kopyalanacağını seç. Gerçekleşme (realized) verisi
          kopyalanmaz — yeni proje boş başlar.
        </span>
      </div>

      <div className="space-y-3 mb-5">
        <Field label="Yeni Proje Adı">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Lokasyon">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Başlangıç Tarihi">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Süre (gün)">
            <Input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-2">
          Klonlanacak Veriler
        </div>
        <div className="space-y-1.5">
          <CloneOption
            icon={FolderTree}
            label="WBS Yapısı"
            desc="İş kalemleri, kodlar, miktarlar, ağırlıklar"
            checked={cloneWbs}
            onChange={(v) => {
              setCloneWbs(v);
              if (!v) setClonePlanned(false); // WBS yoksa planlama anlamsız
            }}
          />
          <CloneOption
            icon={CalendarDays}
            label="Planlama (planned)"
            desc={
              cloneWbs
                ? "Planlanan miktarlar — tarihler yeni başlangıca ötelenecek"
                : "Önce WBS yapısı işaretlenmeli"
            }
            checked={clonePlanned}
            onChange={setClonePlanned}
            disabled={!cloneWbs}
          />
          <CloneOption
            icon={Users}
            label="Personel Atamaları"
            desc="Master kayıtlar kopyalanmaz; sadece bu projeye atama dönemleri"
            checked={clonePersonnel}
            onChange={setClonePersonnel}
          />
          <CloneOption
            icon={Truck}
            label="Makine Atamaları"
            desc="Master kayıtlar kopyalanmaz; sadece bu projeye atama dönemleri"
            checked={cloneMachine}
            onChange={setCloneMachine}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          İptal
        </Button>
        <Button variant="accent" onClick={submit}>
          <Copy size={14} /> Klonla
        </Button>
      </DialogFooter>
    </>
  );
}

function CloneOption({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none",
        disabled
          ? "opacity-50 cursor-not-allowed bg-bg2 border-border"
          : checked
          ? "bg-accent/5 border-accent/40 hover:bg-accent/8"
          : "bg-white border-border hover:border-accent/30 hover:bg-accent/[0.02]"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-accent shrink-0"
      />
      <Icon size={16} className={cn("shrink-0 mt-0.5", checked ? "text-accent" : "text-text3")} />
      <div className="flex-1 min-w-0">
        <div className={cn("font-semibold text-[13px] leading-tight", checked ? "text-text" : "text-text2")}>
          {label}
        </div>
        <div className="text-[11px] text-text3 leading-snug mt-0.5">{desc}</div>
      </div>
    </label>
  );
}
