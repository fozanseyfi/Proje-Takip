"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useStore, useCurrentProject } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDate, toISODate, cn, addDays, daysBetween } from "@/lib/utils";
import type { Priority, LookaheadKind } from "@/lib/store/types";

const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const PRIORITY_VARIANT: Record<Priority, "gray" | "blue" | "yellow" | "red"> = {
  low: "gray",
  medium: "blue",
  high: "yellow",
  critical: "red",
};

const KIND_LABEL: Record<LookaheadKind, string> = {
  kritik_is: "Kritik İş",
  claim:     "Claim",
  tutanak:   "Tutanak",
  yazisma:   "Yazışma",
  ihbar:     "İhbar",
};

const KIND_STYLES: Record<LookaheadKind, { bg: string; text: string; border: string }> = {
  kritik_is: { bg: "bg-red/10",    text: "text-red",    border: "border-red/30" },
  claim:     { bg: "bg-purple/10", text: "text-purple", border: "border-purple/30" },
  tutanak:   { bg: "bg-blue/10",   text: "text-blue",   border: "border-blue/30" },
  yazisma:   { bg: "bg-accent/10", text: "text-accent", border: "border-accent/30" },
  ihbar:     { bg: "bg-yellow/10", text: "text-yellow", border: "border-yellow/30" },
};

export default function LookaheadPage() {
  const project = useCurrentProject();
  const items = useStore((s) => s.lookahead).filter((l) => l.projectId === project?.id);
  const add = useStore((s) => s.addLookahead);
  const del = useStore((s) => s.deleteLookahead);
  const toggle = useStore((s) => s.toggleLookaheadDone);

  const [creating, setCreating] = useState(false);
  const [filterKind, setFilterKind] = useState<LookaheadKind | "">("");

  const matchesKind = (it: typeof items[number]) =>
    !filterKind || (it.kind ?? "kritik_is") === filterKind;

  const activeItems = useMemo(
    () =>
      items
        .filter((i) => !i.done)
        .filter(matchesKind)
        .sort((a, b) => a.date.localeCompare(b.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filterKind]
  );
  const doneItems = useMemo(
    () =>
      items
        .filter((i) => i.done)
        .filter(matchesKind)
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, filterKind]
  );

  const kindCounts = useMemo(() => {
    const c: Record<LookaheadKind, number> = { kritik_is: 0, claim: 0, tutanak: 0, yazisma: 0, ihbar: 0 };
    for (const i of items.filter((x) => !x.done)) {
      const k = (i.kind ?? "kritik_is") as LookaheadKind;
      c[k]++;
    }
    return c;
  }, [items]);

  const today = toISODate(new Date());

  if (!project)
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
      </Card>
    );

  return (
    <>
      <PageHeader
        title="Kritik İşler · Tutanak · Claim"
        description="15 günlük yakın takip — kritik iş kalemleri, tutanaklar, claim, yazışma, ihbar"
        icon={AlertTriangle}
        actions={
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus size={14} /> Yeni Kayıt
          </Button>
        }
      />

      {/* Tip filtreleri */}
      <div className="flex flex-wrap gap-2 mb-4">
        <KindFilterChip
          active={filterKind === ""}
          onClick={() => setFilterKind("")}
          label="Tümü"
          count={items.filter((i) => !i.done).length}
          colors={{ bg: "bg-bg2", text: "text-text", border: "border-border" }}
        />
        {(Object.keys(KIND_LABEL) as LookaheadKind[]).map((k) => (
          <KindFilterChip
            key={k}
            active={filterKind === k}
            onClick={() => setFilterKind(k)}
            label={KIND_LABEL[k]}
            count={kindCounts[k]}
            colors={KIND_STYLES[k]}
          />
        ))}
      </div>

      {activeItems.length === 0 && doneItems.length === 0 ? (
        <Card>
          <CardTitle>Kayıt yok</CardTitle>
          <p className="text-sm text-text2">Yeni kayıt eklemek için yukarıdaki butonu kullan.</p>
        </Card>
      ) : (
        <>
          {/* AKTİF */}
          {activeItems.length === 0 ? (
            <Card className="!py-6 text-center text-text3 text-sm mb-4">
              Aktif kayıt yok 🎉 — kapanan konuları aşağıdan görebilirsiniz.
            </Card>
          ) : (
            <div className="space-y-2 mb-6">
              {activeItems.map((it) => {
                const daysLeft = daysBetween(today, it.date);
                const overdue = daysLeft < 0;
                const kind = (it.kind ?? "kritik_is") as LookaheadKind;
                const ks = KIND_STYLES[kind];
                return (
                  <Card
                    key={it.id}
                    className={cn(
                      "!p-3 flex items-start gap-3 transition-all !border-l-4",
                      overdue && "border-red/40",
                      ks.border.replace("border-", "border-l-")
                    )}
                  >
                    <button
                      onClick={() => toggle(it.id)}
                      className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 border-text3 hover:border-accent hover:bg-accent/10"
                      title="Tamamlandı olarak işaretle"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn("text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded", ks.bg, ks.text)}>
                          {KIND_LABEL[kind]}
                        </span>
                        <span className="font-medium text-text">{it.task}</span>
                      </div>
                      {it.notes && <div className="text-xs text-text3 mt-0.5">{it.notes}</div>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs">
                        <Badge variant={PRIORITY_VARIANT[it.priority]}>{PRIORITY_LABEL[it.priority]}</Badge>
                        <span className="text-text3">
                          📅 {formatDate(it.date)}
                          <span
                            className={cn(
                              "ml-1",
                              daysLeft < 0 ? "text-red" : daysLeft <= 3 ? "text-yellow" : "text-text3"
                            )}
                          >
                            ({daysLeft < 0 ? `${-daysLeft} gün gecikme` : `${daysLeft} gün`})
                          </span>
                        </span>
                        {it.owner && <span className="text-text3">👤 {it.owner}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Silinsin mi?")) del(it.id);
                      }}
                      className="p-1.5 text-text3 hover:text-red rounded shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  </Card>
                );
              })}
            </div>
          )}

          {/* KAPANAN KONULAR — collapsible */}
          {doneItems.length > 0 && (
            <details className="group rounded-xl border border-border bg-bg2/40 mb-4">
              <summary className="cursor-pointer px-5 py-3 list-none flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green" />
                <span className="font-display text-sm font-bold text-text">Kapanan Konular</span>
                <Badge variant="green">{doneItems.length}</Badge>
                <span className="text-[10px] text-text3 ml-2">arşiv · işareti kaldır ile aktife döner</span>
                <span className="ml-auto text-text3 transition-transform group-open:rotate-180">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <div className="border-t border-border bg-white">
                <div className="divide-y divide-border">
                  {doneItems.map((it) => {
                    const kind = (it.kind ?? "kritik_is") as LookaheadKind;
                    const ks = KIND_STYLES[kind];
                    return (
                      <div key={it.id} className="flex items-start gap-3 p-3 hover:bg-bg2/40">
                        <button
                          onClick={() => toggle(it.id)}
                          className="mt-0.5 w-5 h-5 rounded-md bg-green border-green flex items-center justify-center shrink-0"
                          title="Aktife döndür"
                        >
                          <CheckCircle2 size={12} className="text-white" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={cn("text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded", ks.bg, ks.text)}>
                              {KIND_LABEL[kind]}
                            </span>
                            <span className="text-sm font-medium text-text2 line-through">{it.task}</span>
                          </div>
                          <div className="text-[11px] text-text3">
                            Kapatıldı · {formatDate(it.date)}
                            {it.owner && <span> · {it.owner}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm("Kalıcı olarak silinsin mi?")) del(it.id);
                          }}
                          className="p-1.5 text-text3 hover:text-red rounded shrink-0"
                          title="Kalıcı sil"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </details>
          )}
        </>
      )}

      {items.some((i) => !i.done && daysBetween(today, i.date) < 0) && (
        <Alert variant="error" className="mt-4">
          Gecikmiş işler var. Hızlıca güncelleme yap.
        </Alert>
      )}

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSubmit={(data) => {
          add({ ...data, projectId: project.id, done: false });
          setCreating(false);
        }}
      />
    </>
  );
}

function KindFilterChip({
  active,
  onClick,
  label,
  count,
  colors,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  colors: { bg: string; text: string; border: string };
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold transition-all border",
        active ? [colors.bg, colors.text, colors.border, "shadow-soft"] : "bg-white border-border text-text2 hover:text-text"
      )}
    >
      {label}
      <span className={cn("inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-md text-[10px] font-bold tabular-nums",
        active ? colors.bg : "bg-bg3")}>
        {count}
      </span>
    </button>
  );
}

function CreateDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { task: string; date: string; priority: Priority; owner?: string; notes?: string; kind: LookaheadKind }) => void;
}) {
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const addPersonnel = useStore((s) => s.addPersonnel);
  const currentUser = useStore((s) => s.users.find((u) => u.id === s.currentUserId));

  const [task, setTask] = useState("");
  const [date, setDate] = useState(toISODate(addDays(new Date(), 7)));
  const [priority, setPriority] = useState<Priority>("medium");
  const [kind, setKind] = useState<LookaheadKind>("kritik_is");
  const [ownerId, setOwnerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Hızlı personel ekleme form state
  const [qFirstName, setQFirstName] = useState("");
  const [qLastName, setQLastName] = useState("");
  const [qCompany, setQCompany] = useState("");
  const [qJobTitle, setQJobTitle] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qDiscipline, setQDiscipline] = useState<"mekanik" | "elektrik" | "insaat" | "muhendislik" | "idari" | "diger">("muhendislik");

  function quickAdd() {
    if (!qFirstName || !qLastName || !qCompany || !currentUser) {
      alert("Ad, soyad ve firma zorunlu");
      return;
    }
    const p = addPersonnel({
      ownerUserId: currentUser.id,
      firstName: qFirstName,
      lastName: qLastName,
      company: qCompany,
      jobTitle: qJobTitle || undefined,
      phone: qPhone || undefined,
      discipline: qDiscipline,
      status: "active",
    });
    setOwnerId(p.id);
    setShowQuickAdd(false);
    setQFirstName("");
    setQLastName("");
    setQCompany("");
    setQJobTitle("");
    setQPhone("");
  }

  const selectedPerson = personnel.find((p) => p.id === ownerId);
  const ownerName = selectedPerson ? `${selectedPerson.firstName} ${selectedPerson.lastName}` : undefined;

  return (
    <Dialog open={open} onClose={onClose} title="Yeni Kayıt" size="md">
      <div className="space-y-3">
        <Field label="Tip">
          <div className="grid grid-cols-5 gap-1.5">
            {(Object.keys(KIND_LABEL) as LookaheadKind[]).map((k) => {
              const ks = KIND_STYLES[k];
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    "h-10 rounded-lg text-xs font-bold transition-all border",
                    active ? [ks.bg, ks.text, ks.border, "shadow-soft"] : "bg-white border-border text-text3 hover:text-text"
                  )}
                >
                  {KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label={kind === "kritik_is" ? "İş Tanımı" : kind === "claim" ? "Claim Konusu" : kind === "tutanak" ? "Tutanak Konusu" : kind === "yazisma" ? "Yazışma Konusu" : "İhbar Konusu"}>
          <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder={kind === "kritik_is" ? "örn. Trafo teslimi" : "Konu / başlık"} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tarih">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Öncelik">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
              <option value="critical">Kritik</option>
            </Select>
          </Field>
        </div>

        <Field label="Sorumlu Personel">
          <div className="flex gap-2">
            <Select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="flex-1"
            >
              <option value="">— Sorumlu seç —</option>
              {personnel
                .sort((a, b) =>
                  `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "tr")
                )
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} — {p.company}
                    {p.jobTitle ? ` (${p.jobTitle})` : ""}
                  </option>
                ))}
            </Select>
            <Button
              variant="soft"
              onClick={() => setShowQuickAdd(true)}
              type="button"
              title="Listede yoksa hızlıca ekle"
            >
              <Plus size={14} /> Ekle
            </Button>
          </div>
        </Field>

        {showQuickAdd && (
          <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-accent">Hızlı Personel Ekle</div>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="text-xs text-text3 hover:text-text"
              >
                İptal
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ad *">
                <Input value={qFirstName} onChange={(e) => setQFirstName(e.target.value)} />
              </Field>
              <Field label="Soyad *">
                <Input value={qLastName} onChange={(e) => setQLastName(e.target.value)} />
              </Field>
              <Field label="Firma *">
                <Input value={qCompany} onChange={(e) => setQCompany(e.target.value)} />
              </Field>
              <Field label="Disiplin">
                <Select
                  value={qDiscipline}
                  onChange={(e) => setQDiscipline(e.target.value as typeof qDiscipline)}
                >
                  <option value="muhendislik">Mühendislik</option>
                  <option value="elektrik">Elektrik</option>
                  <option value="mekanik">Mekanik</option>
                  <option value="insaat">İnşaat</option>
                  <option value="idari">İdari</option>
                  <option value="diger">Diğer</option>
                </Select>
              </Field>
              <Field label="Görev">
                <Input value={qJobTitle} onChange={(e) => setQJobTitle(e.target.value)} placeholder="Şantiye Şefi, ..." />
              </Field>
              <Field label="Telefon">
                <Input value={qPhone} onChange={(e) => setQPhone(e.target.value)} placeholder="0532..." />
              </Field>
            </div>
            <Button variant="accent" onClick={quickAdd} size="sm" className="w-full">
              <Plus size={14} /> Personel Oluştur ve Sorumlu Yap
            </Button>
          </div>
        )}

        <Field label="Notlar">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button
          variant="accent"
          onClick={() =>
            onSubmit({
              task,
              date,
              priority,
              owner: ownerName,
              notes: notes || undefined,
              kind,
            })
          }
        >
          Ekle
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
