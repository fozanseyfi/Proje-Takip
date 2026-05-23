"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Truck,
  ChevronLeft,
  ChevronRight,
  Cog,
  Check,
  Lock,
  Unlock,
  Search,
  X,
} from "lucide-react";
import { useStore, useCurrentProject, useCurrentUser } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDate, toISODate, cn } from "@/lib/utils";

type DayStatus = "worked" | "absent";

export default function MachineAttendancePage() {
  const project = useCurrentProject();
  const user = useCurrentUser();
  const machines = useStore((s) => s.machinesMaster).filter((m) => !m.deletedAt);
  const assignments = useStore((s) => s.machineAssignments);
  const attendance = useStore((s) => s.machineAttendance);
  const setAttendance = useStore((s) => s.setMachineAttendance);
  const machineLocks = useStore((s) => s.machineAttendanceLocks);
  const lockDay = useStore((s) => s.lockMachineAttendanceDay);
  const unlockDay = useStore((s) => s.unlockMachineAttendanceDay);
  const toast = useToast((s) => s.push);

  const [date, setDate] = useState(toISODate(new Date()));
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Kilit durumu — store'dan, sayfa değiştirip dönünce korunur.
  const isLocked = !!project && !!machineLocks[project.id]?.[date];
  function unlock() {
    if (!project) return;
    unlockDay(project.id, date);
  }

  // Tüm atanmış makineler — seçili güne göre atama VE makine iş başı/ayrılış kontrolü.
  const allAssigned = useMemo(() => {
    if (!project) return [];
    const ids = new Set(
      assignments
        .filter(
          (a) =>
            a.projectId === project.id &&
            (!a.assignedFrom || a.assignedFrom <= date) &&
            (!a.assignedTo || a.assignedTo >= date)
        )
        .map((a) => a.machineMasterId)
    );
    return machines.filter(
      (m) =>
        ids.has(m.id) &&
        (!m.startDate || m.startDate <= date) &&
        (!m.terminationDate || m.terminationDate >= date)
    );
  }, [assignments, machines, project, date]);

  const companies = useMemo(
    () =>
      Array.from(new Set(allAssigned.map((m) => m.company).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "tr")
      ),
    [allAssigned]
  );

  const assignedMachines = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allAssigned
      .filter((m) => !filterCompany || m.company === filterCompany)
      .filter((m) => {
        if (!q) return true;
        return (
          m.name.toLowerCase().includes(q) ||
          m.company.toLowerCase().includes(q) ||
          (m.licensePlate || "").toLowerCase().includes(q) ||
          (m.machineType || "").toLowerCase().includes(q)
        );
      });
  }, [allAssigned, filterCompany, search]);

  const existingAttendance = useMemo(() => {
    if (!project) return new Map<string, { status: DayStatus; hours: number; fuelConsumed?: number }>();
    const m = new Map<string, { status: DayStatus; hours: number; fuelConsumed?: number }>();
    for (const a of attendance) {
      if (a.projectId === project.id && a.date === date) {
        const status: DayStatus = a.present && a.hours > 0 ? "worked" : "absent";
        m.set(a.machineMasterId, { status, hours: a.hours, fuelConsumed: a.fuelConsumed });
      }
    }
    return m;
  }, [attendance, project, date]);

  type Draft = { status: DayStatus; hours: number; fuelConsumed?: number };
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  // Tarih veya atanan makine sayısı değişince draft'ı yenile.
  // Default: hiçbir makine seçili değil (absent), 8 saat varsayılan.
  useEffect(() => {
    const d: Record<string, Draft> = {};
    for (const m of allAssigned) {
      const ex = existingAttendance.get(m.id);
      d[m.id] = ex ?? { status: "absent", hours: 8 };
    }
    setDraft(d); // eslint-disable-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, allAssigned.length]);

  function setHours(id: string, hours: number) {
    if (isLocked) return;
    setDraft((s) => ({ ...s, [id]: { ...s[id], status: s[id]?.status ?? "worked", hours } }));
  }

  function setFuel(id: string, fuel: number) {
    if (isLocked) return;
    setDraft((s) => ({ ...s, [id]: { ...s[id], status: s[id]?.status ?? "worked", hours: s[id]?.hours ?? 8, fuelConsumed: fuel } }));
  }

  // Kart gövdesine tıklayınca: gelmediyse "çalıştı" yap, çalıştıysa "gelmedi"ye geri al.
  function toggleCardWorked(id: string) {
    if (isLocked) return;
    setDraft((s) => {
      const cur = s[id] ?? { status: "absent" as DayStatus, hours: 8 };
      if (cur.status === "worked") return { ...s, [id]: { ...cur, status: "absent" } };
      return { ...s, [id]: { ...cur, status: "worked", hours: cur.hours || 8 } };
    });
  }

  function save() {
    if (!project || !user) return;
    const records = allAssigned.map((m) => {
      const d = draft[m.id] ?? { status: "absent" as DayStatus, hours: 8 };
      return {
        projectId: project.id,
        machineMasterId: m.id,
        date,
        present: d.status === "worked",
        hours: d.status === "worked" ? d.hours : 0,
        fuelConsumed: d.status === "worked" ? d.fuelConsumed : undefined,
        recordedBy: user.id,
      };
    });
    setAttendance(records);
    lockDay(project.id, date);
    toast(`${records.length} makine puantajı kaydedildi · gün kilitlendi`, "success");
  }

  const todayISO = toISODate(new Date());
  const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const dayName = TR_DAYS[new Date(date + "T00:00:00").getDay()];

  function shiftDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const next = toISODate(d);
    if (next > todayISO) return;
    setDate(next);
  }
  function setDateClamped(d: string) {
    setDate(d > todayISO ? todayISO : d);
  }

  const totalWorkedCount = useMemo(
    () => allAssigned.filter((m) => draft[m.id]?.status === "worked").length,
    [allAssigned, draft]
  );
  const visibleWorkedCount = useMemo(
    () => assignedMachines.filter((m) => draft[m.id]?.status === "worked").length,
    [assignedMachines, draft]
  );
  const allVisibleWorked =
    assignedMachines.length > 0 && visibleWorkedCount === assignedMachines.length;

  function toggleAllVisible() {
    if (isLocked) return;
    const newStatus: DayStatus = allVisibleWorked ? "absent" : "worked";
    setDraft((s) => {
      const newDraft = { ...s };
      for (const m of assignedMachines) {
        newDraft[m.id] = {
          ...newDraft[m.id],
          status: newStatus,
          hours: newDraft[m.id]?.hours ?? 8,
        };
      }
      return newDraft;
    });
  }

  function clearFilters() {
    setSearch("");
    setFilterCompany("");
  }
  const hasActiveFilter = !!(search || filterCompany);

  if (!project) {
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
        <p className="text-sm text-text2">Önce bir proje seç.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Makine Puantajı"
        description="Tüm makineler varsayılan olarak 'pasif'. Çalışan makinenin kartına tıkla (8 saat). Listede sadece o gün atama tarihleri içinde olan makineler görünür."
        icon={Truck}
        actions={
          isLocked ? (
            <Button variant="outline" onClick={unlock}>
              <Unlock size={14} /> Kilidi Aç
            </Button>
          ) : (
            <Button variant="accent" onClick={save}>
              Kaydet ({totalWorkedCount}/{allAssigned.length})
            </Button>
          )
        }
      />

      {isLocked && (
        <Alert variant="warning" className="mb-3 flex items-center gap-3">
          <Lock size={14} className="shrink-0" />
          <span className="flex-1">
            <strong>{formatDate(date)} puantajı kilitli.</strong> Yanlışlıkla makine seçimini
            önlemek için Kaydet&apos;ten sonra otomatik kilitlendi. Değişiklik yapmak için kilidi
            aç.
          </span>
          <Button size="sm" variant="outline" onClick={unlock}>
            <Unlock size={12} /> Kilidi Aç
          </Button>
        </Alert>
      )}

      <Card className="mb-4 !p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Tarih navigasyon — bugünden ileri gidilemez */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="w-10 h-10 rounded-lg bg-white border border-border hover:bg-bg2 hover:border-text3 text-text2 flex items-center justify-center transition-all shadow-soft"
            >
              <ChevronLeft size={16} />
            </button>
            <Input
              type="date"
              value={date}
              max={todayISO}
              onChange={(e) => setDateClamped(e.target.value)}
              className="w-44 !h-10 font-mono text-sm"
            />
            <button
              onClick={() => shiftDate(1)}
              disabled={date >= todayISO}
              title={date >= todayISO ? "Bugünden ileri gidilemez" : "Sonraki gün"}
              className="w-10 h-10 rounded-lg bg-white border border-border hover:bg-bg2 hover:border-text3 text-text2 flex items-center justify-center transition-all shadow-soft disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-border"
            >
              <ChevronRight size={16} />
            </button>
            <span
              className="inline-flex items-center px-2.5 h-10 rounded-lg bg-purple/10 border border-purple/30 text-purple font-semibold text-[11px] uppercase tracking-wider"
              title={`${dayName} — ${formatDate(date)}`}
            >
              {dayName}
              {date === todayISO && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-purple text-white text-[9px] font-bold">
                  BUGÜN
                </span>
              )}
            </span>
          </div>

          {/* Arama */}
          <Field label="Ara" className="min-w-[200px]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text3 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="isim / plaka / firma / tip"
                className="pl-9 pr-8"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text3 hover:text-text hover:bg-bg3"
                  aria-label="Temizle"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </Field>

          {/* Firma filtresi */}
          <Field label="Firma" className="min-w-[180px]">
            <Select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
              <option value="">Tümü ({companies.length})</option>
              {companies.map((c) => {
                const n = allAssigned.filter((m) => m.company === c).length;
                return (
                  <option key={c} value={c}>
                    {c} ({n})
                  </option>
                );
              })}
            </Select>
          </Field>

          {hasActiveFilter && (
            <Button variant="outline" onClick={clearFilters} size="md">
              <X size={14} /> Filtreyi Temizle
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={allVisibleWorked ? "soft" : "outline"}
              onClick={toggleAllVisible}
              size="md"
              disabled={isLocked}
            >
              {allVisibleWorked ? "Görünürlerin Tikini Kaldır" : "Görünürlerin Hepsini Seç"}
            </Button>
            <div className="flex flex-col items-end gap-0.5 ml-1">
              <Badge variant="green">
                {totalWorkedCount} / {allAssigned.length} çalıştı
              </Badge>
              {hasActiveFilter && (
                <Badge variant="gray">
                  {visibleWorkedCount} / {assignedMachines.length} görünür
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {allAssigned.length === 0 ? (
        <Card>
          <CardTitle>Atanmış makine yok</CardTitle>
          <p className="text-sm text-text2 mb-3">
            Bu projeye o gün için atanmış makine bulunamadı.
          </p>
          <Link href="/master/machines">
            <Button variant="accent">
              <Cog size={14} /> Master Data&apos;ya git
            </Button>
          </Link>
        </Card>
      ) : assignedMachines.length === 0 ? (
        <Card>
          <CardTitle>Filtreye uyan kayıt yok</CardTitle>
          <p className="text-sm text-text2 mb-3">
            Arama: <strong className="text-text">{search || "—"}</strong> ·
            Firma: <strong className="text-text">{filterCompany || "tümü"}</strong>
          </p>
          <Button variant="accent" onClick={clearFilters}>
            <X size={14} /> Filtreyi Temizle
          </Button>
        </Card>
      ) : (
        <Card>
          <CardTitle>{formatDate(date)} — Makine Puantajı</CardTitle>
          <div className="space-y-4">
            {(() => {
              const byCompany = new Map<string, typeof assignedMachines>();
              for (const m of assignedMachines) {
                const key = m.company || "—";
                if (!byCompany.has(key)) byCompany.set(key, []);
                byCompany.get(key)!.push(m);
              }
              const companyOrder = Array.from(byCompany.keys()).sort((a, b) =>
                a.localeCompare(b, "tr")
              );
              return companyOrder.map((company) => {
                const list = byCompany.get(company)!;
                const workedN = list.filter((m) => draft[m.id]?.status === "worked").length;
                return (
                  <fieldset
                    key={company}
                    className="border border-purple/25 rounded-xl px-4 pb-3 pt-1 bg-purple/[0.03]"
                  >
                    <legend className="px-2 py-0.5 flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-purple">
                        {company}
                      </span>
                      <span className="text-[10px] text-text3 font-mono">
                        {list.length} makine · çalıştı {workedN}
                      </span>
                    </legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      {list.map((m) => {
                        const d = draft[m.id] ?? { status: "absent" as DayStatus, hours: 8 };
                        return (
                          <div
                            key={m.id}
                            onClick={() => toggleCardWorked(m.id)}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg transition-all border select-none",
                              isLocked ? "cursor-not-allowed opacity-90" : "cursor-pointer",
                              d.status === "worked" &&
                                "bg-purple/5 border-purple/40 " +
                                  (isLocked ? "" : "hover:bg-purple/10"),
                              d.status === "absent" &&
                                "bg-white border-border " +
                                  (isLocked ? "" : "hover:border-purple/40 hover:bg-purple/[0.02]")
                            )}
                          >
                            {/* Sol göstergeç — kart durumu */}
                            <div
                              className={cn(
                                "w-7 h-7 rounded inline-flex items-center justify-center shrink-0 transition-colors",
                                d.status === "worked" && "bg-purple text-white",
                                d.status === "absent" && "bg-bg3 text-text3"
                              )}
                            >
                              {d.status === "worked" && <Check size={14} />}
                              {d.status === "absent" && (
                                <span className="text-[12px] font-bold">—</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div
                                className={cn(
                                  "font-medium truncate",
                                  d.status === "absent" ? "text-text2" : "text-text"
                                )}
                              >
                                {m.name}
                              </div>
                              <div className="text-[11px] text-text3 truncate">
                                {m.licensePlate || m.machineType}
                                {m.machineType && m.licensePlate && ` · ${m.machineType}`}
                              </div>
                            </div>

                            {/* Saat + Yakıt — kart tıklamasından izole */}
                            <div
                              className="grid grid-cols-2 gap-1.5 w-28 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div>
                                <div className="text-[8.5px] text-text3 uppercase mb-0.5 font-bold tracking-wider">
                                  Saat
                                </div>
                                {d.status === "worked" ? (
                                  <input
                                    type="number"
                                    step="0.5"
                                    value={d.hours}
                                    onChange={(e) =>
                                      setHours(m.id, Number(e.target.value) || 0)
                                    }
                                    disabled={isLocked}
                                    className={cn(
                                      "w-full px-1.5 py-1 text-xs font-mono bg-white border border-border rounded text-right",
                                      isLocked && "opacity-60 cursor-not-allowed"
                                    )}
                                  />
                                ) : (
                                  <div className="w-full px-1.5 py-1 text-xs font-mono bg-transparent text-text3 text-right">
                                    —
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="text-[8.5px] text-text3 uppercase mb-0.5 font-bold tracking-wider">
                                  Yakıt (L)
                                </div>
                                {d.status === "worked" ? (
                                  <input
                                    type="number"
                                    step="1"
                                    value={d.fuelConsumed ?? ""}
                                    onChange={(e) =>
                                      setFuel(m.id, Number(e.target.value) || 0)
                                    }
                                    disabled={isLocked}
                                    className={cn(
                                      "w-full px-1.5 py-1 text-xs font-mono bg-white border border-border rounded text-right",
                                      isLocked && "opacity-60 cursor-not-allowed"
                                    )}
                                  />
                                ) : (
                                  <div className="w-full px-1.5 py-1 text-xs font-mono bg-transparent text-text3 text-right">
                                    —
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              });
            })()}
          </div>
        </Card>
      )}

      {assignedMachines.length > 5 && !isLocked && (
        <Alert variant="info" className="mt-4">
          Tip: Tüm makineler varsayılan <strong>pasif</strong>. Çalışan makinenin kartına tıkla
          → çalıştı (8 saat). Yakıt opsiyonel. Listede sadece o gün için <em>atama</em>{" "}
          tarihleri içinde olan makineler görünür. Bitiminde <strong>Kaydet</strong>.
        </Alert>
      )}
    </>
  );
}
