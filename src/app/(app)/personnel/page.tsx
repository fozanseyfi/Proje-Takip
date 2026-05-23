"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HardHat, ChevronLeft, ChevronRight, Users, Search, X, Check, Lock, Unlock } from "lucide-react";
import { useStore, useCurrentProject, useCurrentUser } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { formatDate, toISODate, cn } from "@/lib/utils";

type DayStatus = "worked" | "rapor" | "absent";

export default function PersonnelAttendancePage() {
  const project = useCurrentProject();
  const user = useCurrentUser();
  const personnel = useStore((s) => s.personnelMaster).filter((p) => !p.deletedAt);
  const assignments = useStore((s) => s.personnelAssignments);
  const attendance = useStore((s) => s.personnelAttendance);
  const setAttendance = useStore((s) => s.setPersonnelAttendance);
  const personnelLocks = useStore((s) => s.personnelAttendanceLocks);
  const lockDay = useStore((s) => s.lockPersonnelAttendanceDay);
  const unlockDay = useStore((s) => s.unlockPersonnelAttendanceDay);

  const [date, setDate] = useState(toISODate(new Date()));
  const [filterDiscipline, setFilterDiscipline] = useState<string>("");
  const [filterCompany, setFilterCompany] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  // Kaydet'e basılan günler kilitlenir — yanlışlıkla personel seçimini önler.
  // Kilit store'da tutulduğu için sayfa değiştirip dönünce korunur.
  const isLocked = !!project && !!personnelLocks[project.id]?.[date];
  function unlock() {
    if (!project) return;
    unlockDay(project.id, date);
  }

  // Tüm atanmış personel (filtre uygulanmamış — toplam sayım için)
  // Seçili güne göre filtre: işe giriş/çıkış tarihi ve atama tarihi aralığı.
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
        .map((a) => a.personnelMasterId)
    );
    return personnel.filter(
      (p) =>
        ids.has(p.id) &&
        (!p.startDate || p.startDate <= date) &&
        (!p.terminationDate || p.terminationDate >= date)
    );
  }, [assignments, personnel, project, date]);

  // Atanmış personeldeki benzersiz firmalar
  const companies = useMemo(
    () =>
      Array.from(new Set(allAssigned.map((p) => p.company).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "tr")
      ),
    [allAssigned]
  );

  const assignedPersonnel = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allAssigned
      .filter((p) => !filterDiscipline || p.discipline === filterDiscipline)
      .filter((p) => !filterCompany || p.company === filterCompany)
      .filter((p) => {
        if (!q) return true;
        return (
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.company.toLowerCase().includes(q) ||
          (p.jobTitle || "").toLowerCase().includes(q) ||
          (p.tcKimlikNo || "").includes(q)
        );
      });
  }, [allAssigned, filterDiscipline, filterCompany, search]);

  // Mevcut puantaj durumu (date için)
  const existingAttendance = useMemo(() => {
    if (!project) return new Map<string, { status: DayStatus; hours: number }>();
    const m = new Map<string, { status: DayStatus; hours: number }>();
    for (const a of attendance) {
      if (a.projectId === project.id && a.date === date) {
        const status: DayStatus =
          a.status === "rapor" ? "rapor" : a.present && a.hours > 0 ? "worked" : "absent";
        m.set(a.personnelMasterId, { status, hours: a.hours });
      }
    }
    return m;
  }, [attendance, project, date]);

  // Yerel state: bu sayfa için draft (default: tüm atanmışlar gelmedi, 8 saat)
  type Draft = { status: DayStatus; hours: number };
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  // İlk yükte veya tarih değişince draft'ı yenile (tüm atanmışlar için, search'ten bağımsız).
  // Default: gelmedi (absent). Sadece gelen personele tıklanır → çalıştı (8 saat).
  useEffect(() => {
    const d: Record<string, Draft> = {};
    for (const p of allAssigned) {
      const ex = existingAttendance.get(p.id);
      d[p.id] = ex ?? { status: "absent", hours: 8 };
    }
    setDraft(d); // eslint-disable-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, allAssigned.length]);

  function setStatus(id: string, status: DayStatus) {
    if (isLocked) return;
    setDraft((s) => ({ ...s, [id]: { status, hours: s[id]?.hours ?? 8 } }));
  }

  function setHours(id: string, hours: number) {
    if (isLocked) return;
    setDraft((s) => ({ ...s, [id]: { status: s[id]?.status ?? "worked", hours } }));
  }

  // Kart gövdesine tıklayınca: gelmediyse "çalıştı" yap, çalıştıysa "gelmedi"ye geri al.
  function toggleCardWorked(id: string) {
    if (isLocked) return;
    setDraft((s) => {
      const cur = s[id] ?? { status: "absent" as DayStatus, hours: 8 };
      if (cur.status === "worked") return { ...s, [id]: { ...cur, status: "absent" } };
      return { ...s, [id]: { status: "worked", hours: cur.hours || 8 } };
    });
  }

  const toast = useToast((s) => s.push);

  function save() {
    if (!project || !user) return;
    // Save tüm atanmış personeli kaydet (görünür olanlarla sınırlı değil)
    const records = allAssigned.map((p) => {
      const d = draft[p.id] ?? { status: "absent", hours: 8 };
      return {
        projectId: project.id,
        personnelMasterId: p.id,
        date,
        present: d.status === "worked",
        hours: d.status === "worked" ? d.hours : 0,
        status: d.status === "rapor" ? ("rapor" as const) : undefined,
        recordedBy: user.id,
      };
    });
    setAttendance(records);
    lockDay(project.id, date);
    toast(`${records.length} personel puantajı kaydedildi · gün kilitlendi`, "success");
  }

  const todayISO = toISODate(new Date());
  const TR_DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
  const dayName = TR_DAYS[new Date(date + "T00:00:00").getDay()];

  function shiftDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const next = toISODate(d);
    // Bugünden ileri gidemez
    if (next > todayISO) return;
    setDate(next);
  }
  function setDateClamped(d: string) {
    setDate(d > todayISO ? todayISO : d);
  }

  // Toplam: tüm atanmış personelden "Çalıştı" sayısı (sayım için)
  const totalWorkedCount = useMemo(
    () => allAssigned.filter((p) => draft[p.id]?.status === "worked").length,
    [allAssigned, draft]
  );
  const totalRaporCount = useMemo(
    () => allAssigned.filter((p) => draft[p.id]?.status === "rapor").length,
    [allAssigned, draft]
  );
  // Görünür olanların kaçı çalıştı işaretli
  const visibleWorkedCount = useMemo(
    () => assignedPersonnel.filter((p) => draft[p.id]?.status === "worked").length,
    [assignedPersonnel, draft]
  );
  const allVisibleWorked =
    assignedPersonnel.length > 0 && visibleWorkedCount === assignedPersonnel.length;

  function toggleAllVisible() {
    if (isLocked) return;
    const newStatus: DayStatus = allVisibleWorked ? "absent" : "worked";
    setDraft((s) => {
      const newDraft = { ...s };
      for (const p of assignedPersonnel) {
        newDraft[p.id] = { status: newStatus, hours: newDraft[p.id]?.hours ?? 8 };
      }
      return newDraft;
    });
  }

  function clearFilters() {
    setSearch("");
    setFilterDiscipline("");
    setFilterCompany("");
  }

  const hasActiveFilter = !!(search || filterDiscipline || filterCompany);

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
        title="Personel Puantajı"
        description="Tüm personel varsayılan olarak 'gelmedi'. Gelen personelin kartına tıkla (8 saat). Raporluysa R butonuna bas."
        icon={HardHat}
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
            <strong>{formatDate(date)} puantajı kilitli.</strong> Yanlışlıkla personel seçimini
            önlemek için Kaydet&apos;ten sonra otomatik kilitlendi. Değişiklik yapmak için kilidi aç.
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
              className="inline-flex items-center px-2.5 h-10 rounded-lg bg-accent/10 border border-accent/30 text-accent font-semibold text-[11px] uppercase tracking-wider"
              title={`${dayName} — ${formatDate(date)}`}
            >
              {dayName}
              {date === todayISO && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-accent text-white text-[9px] font-bold">
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
                placeholder="ad / soyad / firma / görev"
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

          {/* Disiplin filtresi */}
          <Field label="Disiplin" className="w-40">
            <Select value={filterDiscipline} onChange={(e) => setFilterDiscipline(e.target.value)}>
              <option value="">Tümü</option>
              <option value="mekanik">Mekanik</option>
              <option value="elektrik">Elektrik</option>
              <option value="insaat">İnşaat</option>
              <option value="muhendislik">Mühendislik</option>
              <option value="idari">İdari</option>
              <option value="diger">Diğer</option>
            </Select>
          </Field>

          {/* Firma filtresi */}
          <Field label="Firma" className="min-w-[180px]">
            <Select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}>
              <option value="">Tümü ({companies.length})</option>
              {companies.map((c) => {
                const n = allAssigned.filter((p) => p.company === c).length;
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
              {totalRaporCount > 0 && (
                <Badge variant="blue">{totalRaporCount} raporlu</Badge>
              )}
              {hasActiveFilter && (
                <Badge variant="gray">
                  {visibleWorkedCount} / {assignedPersonnel.length} görünür
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Card>

      {allAssigned.length === 0 ? (
        <Card>
          <CardTitle>Atanmış personel yok</CardTitle>
          <p className="text-sm text-text2 mb-3">
            Bu projeye henüz personel ataması yapılmamış.
          </p>
          <Link href="/master/personnel">
            <Button variant="accent">
              <Users size={14} /> Master Data&apos;ya git
            </Button>
          </Link>
        </Card>
      ) : assignedPersonnel.length === 0 ? (
        <Card>
          <CardTitle>Filtreye uyan kayıt yok</CardTitle>
          <p className="text-sm text-text2 mb-3">
            Arama: <strong className="text-text">{search || "—"}</strong> ·
            Disiplin: <strong className="text-text">{filterDiscipline || "tümü"}</strong> ·
            Firma: <strong className="text-text">{filterCompany || "tümü"}</strong>
          </p>
          <Button variant="accent" onClick={clearFilters}>
            <X size={14} /> Filtreyi Temizle
          </Button>
        </Card>
      ) : (
        <Card>
          <CardTitle>{formatDate(date)} — Puantaj</CardTitle>
          <div className="space-y-4">
            {(() => {
              // Firma firma grupla — kullanıcının görmek istediği çerçeveli düzen.
              const byCompany = new Map<string, typeof assignedPersonnel>();
              for (const p of assignedPersonnel) {
                const key = p.company || "—";
                if (!byCompany.has(key)) byCompany.set(key, []);
                byCompany.get(key)!.push(p);
              }
              const companyOrder = Array.from(byCompany.keys()).sort((a, b) =>
                a.localeCompare(b, "tr")
              );
              return companyOrder.map((company) => {
                const list = byCompany.get(company)!;
                const workedN = list.filter((p) => draft[p.id]?.status === "worked").length;
                const raporN = list.filter((p) => draft[p.id]?.status === "rapor").length;
                return (
                  <fieldset
                    key={company}
                    className="border border-accent/25 rounded-xl px-4 pb-3 pt-1 bg-accent/[0.03]"
                  >
                    <legend className="px-2 py-0.5 flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                        {company}
                      </span>
                      <span className="text-[10px] text-text3 font-mono">
                        {list.length} kişi · çalıştı {workedN}
                        {raporN > 0 && ` · raporlu ${raporN}`}
                      </span>
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-1">
                      {list.map((p) => {
                        const d = draft[p.id] ?? { status: "absent" as DayStatus, hours: 8 };
                        return (
                          <div
                            key={p.id}
                            onClick={() => toggleCardWorked(p.id)}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-lg transition-all border select-none",
                              isLocked ? "cursor-not-allowed opacity-90" : "cursor-pointer",
                              d.status === "worked" &&
                                "bg-green/5 border-green/40 " +
                                  (isLocked ? "" : "hover:bg-green/10"),
                              d.status === "rapor" &&
                                "bg-blue/5 border-blue/30 " + (isLocked ? "" : "hover:bg-blue/10"),
                              d.status === "absent" &&
                                "bg-white border-border " +
                                  (isLocked ? "" : "hover:border-green/40 hover:bg-green/[0.02]")
                            )}
                          >
                            {/* Sol göstergeç — kart durumu */}
                            <div
                              className={cn(
                                "w-7 h-7 rounded inline-flex items-center justify-center shrink-0 transition-colors",
                                d.status === "worked" && "bg-green text-white",
                                d.status === "rapor" && "bg-blue text-white",
                                d.status === "absent" && "bg-bg3 text-text3"
                              )}
                            >
                              {d.status === "worked" && <Check size={14} />}
                              {d.status === "rapor" && (
                                <span className="text-[11px] font-bold">R</span>
                              )}
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
                                {p.firstName} {p.lastName}
                              </div>
                              <div className="text-[11px] text-text3 truncate">
                                {p.discipline}
                                {p.jobTitle && ` · ${p.jobTitle}`}
                              </div>
                            </div>

                            {/* Rapor butonu — kart tıklamasından izole */}
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatus(p.id, d.status === "rapor" ? "absent" : "rapor");
                              }}
                              title={
                                isLocked
                                  ? "Kilitli — değişiklik için kilidi aç"
                                  : d.status === "rapor"
                                  ? "Raporu kaldır"
                                  : "Raporlu işaretle"
                              }
                              className={cn(
                                "shrink-0 w-7 h-7 rounded text-[11px] font-bold border transition-colors",
                                d.status === "rapor"
                                  ? "bg-blue text-white border-blue"
                                  : "bg-white text-blue border-blue/40 hover:bg-blue/10",
                                isLocked && "opacity-50 cursor-not-allowed hover:bg-white"
                              )}
                            >
                              R
                            </button>

                            <div
                              className="w-14 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {d.status === "worked" ? (
                                <input
                                  type="number"
                                  step="0.5"
                                  value={d.hours}
                                  onChange={(e) => setHours(p.id, Number(e.target.value) || 0)}
                                  disabled={isLocked}
                                  className={cn(
                                    "w-full px-2 py-1 text-xs font-mono bg-white border border-border rounded text-right",
                                    isLocked && "opacity-60 cursor-not-allowed"
                                  )}
                                />
                              ) : (
                                <div className="w-full px-2 py-1 text-xs font-mono bg-transparent text-text3 text-right">
                                  {d.status === "rapor" ? "R" : "—"}
                                </div>
                              )}
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

      {assignedPersonnel.length > 5 && (
        <Alert variant="info" className="mt-4">
          Tip: Tüm personel varsayılan <strong>gelmedi</strong>. Sahaya gelen personelin
          kartına tıkla → çalıştı (8 saat). Raporluysa sağdaki <strong>R</strong> butonuna bas.
          Listede sadece o gün <em>işe giriş–çıkış</em> ve <em>atama</em> tarihleri içinde olan
          personel görünür. Bitiminde <strong>Kaydet</strong>.
        </Alert>
      )}
    </>
  );
}
