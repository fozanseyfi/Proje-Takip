"use client";

import { useMemo, useState } from "react";
import { Sparkles, CheckCircle2, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import type { WbsItem, DateQuantityMap, PredecessorType } from "@/lib/store/types";
import {
  SCENARIO_PRESETS,
  simulateScenario,
  type ScenarioParams,
  type ScenarioResult,
  type ScenarioType,
} from "@/lib/calc/whatif";

/**
 * What-If Senaryoları Dialog'u.
 *
 * Adım 1: Preset seç (8 kart)
 * Adım 2: Parametre formu (türe göre değişir)
 * Adım 3: Sade KPI + etkilenen aktivite listesi
 *
 * KRİTİK: Canlı veriye dokunmaz — simulateScenario salt-okuma kopya üzerinde çalışır.
 */
export interface WhatIfDialogProps {
  open: boolean;
  onClose: () => void;
  wbs: WbsItem[];
  leafs: WbsItem[];
  planned: DateQuantityMap;
  projectStart: string;
}

type Step = "pick" | "params" | "result";

export function WhatIfDialog({ open, onClose, wbs, leafs, planned, projectStart }: WhatIfDialogProps) {
  const [step, setStep] = useState<Step>("pick");
  const [scenarioType, setScenarioType] = useState<ScenarioType | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);

  // Param state (her senaryoda farklı kullanılır)
  const [delayCode, setDelayCode] = useState("");
  const [delayDays, setDelayDays] = useState(5);
  const [shiftDays, setShiftDays] = useState(7);
  const [targetEnd, setTargetEnd] = useState("");
  const [holidayFrom, setHolidayFrom] = useState("");
  const [holidayTo, setHolidayTo] = useState("");
  const [absenceCodes, setAbsenceCodes] = useState<string[]>([]);
  const [absenceDays, setAbsenceDays] = useState(7);
  const [predTargetCode, setPredTargetCode] = useState("");
  const [predPredCode, setPredPredCode] = useState("");
  const [predNewType, setPredNewType] = useState<PredecessorType>("FS");
  const [predNewLag, setPredNewLag] = useState(0);
  const [qtyCode, setQtyCode] = useState("");
  const [qtyPercent, setQtyPercent] = useState(20);
  const [weatherFrom, setWeatherFrom] = useState(2);
  const [weatherTo, setWeatherTo] = useState(3);
  const [weatherDays, setWeatherDays] = useState(2);

  function reset() {
    setStep("pick");
    setScenarioType(null);
    setResult(null);
  }

  function buildParams(): ScenarioParams | null {
    if (!scenarioType) return null;
    switch (scenarioType) {
      case "activity-delay":
        if (!delayCode) return null;
        return { type: "activity-delay", code: delayCode, days: delayDays };
      case "project-shift":
        return { type: "project-shift", days: shiftDays };
      case "crash":
        if (!targetEnd) return null;
        return { type: "crash", targetEndDate: targetEnd };
      case "holiday":
        if (!holidayFrom || !holidayTo) return null;
        return { type: "holiday", from: holidayFrom, to: holidayTo };
      case "resource-absence":
        if (absenceCodes.length === 0) return null;
        return { type: "resource-absence", codes: absenceCodes, days: absenceDays };
      case "predecessor-change":
        if (!predTargetCode || !predPredCode) return null;
        return {
          type: "predecessor-change",
          targetCode: predTargetCode,
          predCode: predPredCode,
          newType: predNewType,
          newLagDays: predNewLag,
        };
      case "quantity-change":
        if (!qtyCode) return null;
        return { type: "quantity-change", code: qtyCode, percent: qtyPercent };
      case "weather-risk":
        return { type: "weather-risk", fromMonth: weatherFrom, toMonth: weatherTo, daysPerWeek: weatherDays };
    }
  }

  function runScenario() {
    const params = buildParams();
    if (!params) return;
    const r = simulateScenario(params, wbs, planned, projectStart);
    setResult(r);
    setStep("result");
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="🔮 What-If Senaryoları"
      size="xl"
    >
      {step === "pick" && (
        <PickStep
          onPick={(t) => {
            setScenarioType(t);
            setStep("params");
          }}
        />
      )}

      {step === "params" && scenarioType && (
        <ParamsStep
          scenarioType={scenarioType}
          leafs={leafs}
          wbs={wbs}
          state={{
            delayCode, setDelayCode,
            delayDays, setDelayDays,
            shiftDays, setShiftDays,
            targetEnd, setTargetEnd,
            holidayFrom, setHolidayFrom,
            holidayTo, setHolidayTo,
            absenceCodes, setAbsenceCodes,
            absenceDays, setAbsenceDays,
            predTargetCode, setPredTargetCode,
            predPredCode, setPredPredCode,
            predNewType, setPredNewType,
            predNewLag, setPredNewLag,
            qtyCode, setQtyCode,
            qtyPercent, setQtyPercent,
            weatherFrom, setWeatherFrom,
            weatherTo, setWeatherTo,
            weatherDays, setWeatherDays,
          }}
        />
      )}

      {step === "result" && result && <ResultStep result={result} wbs={wbs} />}

      <DialogFooter>
        {step === "pick" && (
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Kapat</Button>
        )}
        {step === "params" && (
          <>
            <Button variant="ghost" onClick={() => setStep("pick")}>← Geri</Button>
            <Button variant="accent" onClick={runScenario} disabled={buildParams() == null}>
              <Sparkles size={14} /> Hesapla
            </Button>
          </>
        )}
        {step === "result" && (
          <>
            <Button variant="ghost" onClick={() => setStep("params")}>← Parametreleri Düzenle</Button>
            <Button variant="outline" onClick={() => setStep("pick")}>
              <RotateCcw size={13} /> Yeni Senaryo
            </Button>
            <Button variant="accent" onClick={() => { reset(); onClose(); }}>
              <CheckCircle2 size={14} /> Kapat
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────
// Step 1 — Preset kart grid
// ─────────────────────────────────────────────────────────────────

function PickStep({ onPick }: { onPick: (t: ScenarioType) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text2">
        Bir hipotetik durum seç. Hesaplama <strong>canlı veriyi değiştirmez</strong> — sadece etki
        analizi.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {SCENARIO_PRESETS.map((p) => (
          <button
            key={p.type}
            type="button"
            onClick={() => onPick(p.type)}
            className="text-left p-3 rounded-lg border border-border bg-white hover:border-accent hover:shadow-soft hover:bg-accent/[0.02] transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl leading-none">{p.icon}</span>
              <span className="font-display font-bold text-[12.5px] text-text group-hover:text-accent">
                {p.label}
              </span>
            </div>
            <div className="text-[11px] text-text2 leading-snug">{p.description}</div>
            <div className="text-[10px] text-text3 italic mt-1 leading-snug">{p.example}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Step 2 — Parametre formu (senaryoya göre)
// ─────────────────────────────────────────────────────────────────

type ParamsState = {
  delayCode: string; setDelayCode: (v: string) => void;
  delayDays: number; setDelayDays: (v: number) => void;
  shiftDays: number; setShiftDays: (v: number) => void;
  targetEnd: string; setTargetEnd: (v: string) => void;
  holidayFrom: string; setHolidayFrom: (v: string) => void;
  holidayTo: string; setHolidayTo: (v: string) => void;
  absenceCodes: string[]; setAbsenceCodes: (v: string[]) => void;
  absenceDays: number; setAbsenceDays: (v: number) => void;
  predTargetCode: string; setPredTargetCode: (v: string) => void;
  predPredCode: string; setPredPredCode: (v: string) => void;
  predNewType: PredecessorType; setPredNewType: (v: PredecessorType) => void;
  predNewLag: number; setPredNewLag: (v: number) => void;
  qtyCode: string; setQtyCode: (v: string) => void;
  qtyPercent: number; setQtyPercent: (v: number) => void;
  weatherFrom: number; setWeatherFrom: (v: number) => void;
  weatherTo: number; setWeatherTo: (v: number) => void;
  weatherDays: number; setWeatherDays: (v: number) => void;
};

function ParamsStep({
  scenarioType,
  leafs,
  wbs,
  state,
}: {
  scenarioType: ScenarioType;
  leafs: WbsItem[];
  wbs: WbsItem[];
  state: ParamsState;
}) {
  const meta = SCENARIO_PRESETS.find((p) => p.type === scenarioType)!;

  // Öncül linkleri seçimi için flat liste
  const predLinks = useMemo(() => {
    const out: Array<{ targetCode: string; targetName: string; predCode: string; predName: string }> = [];
    for (const w of wbs) {
      if (w.deletedAt || !w.predecessors) continue;
      for (const p of w.predecessors) {
        const a = wbs.find((x) => x.code === p.wbsCode);
        out.push({
          targetCode: w.code,
          targetName: w.name,
          predCode: p.wbsCode,
          predName: a?.name ?? "?",
        });
      }
    }
    return out;
  }, [wbs]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent/8 border border-accent/25">
        <span className="text-xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-text text-[13px]">{meta.label}</div>
          <div className="text-[11.5px] text-text2">{meta.description}</div>
        </div>
      </div>

      {scenarioType === "activity-delay" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Hangi aktivite gecikecek?" className="sm:col-span-2">
            <LeafSelect leafs={leafs} value={state.delayCode} onChange={state.setDelayCode} />
          </Field>
          <Field label="Kaç gün geciksin?" hint="+ gecikme, − öne çekme">
            <Input
              type="number"
              value={state.delayDays}
              onChange={(e) => state.setDelayDays(parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
      )}

      {scenarioType === "project-shift" && (
        <Field label="Tüm proje kaç gün kaysın?" hint="+ geç başla, − erken başla">
          <Input
            type="number"
            value={state.shiftDays}
            onChange={(e) => state.setShiftDays(parseInt(e.target.value) || 0)}
          />
        </Field>
      )}

      {scenarioType === "crash" && (
        <Field
          label="Hedef bitiş tarihi"
          hint="Sistem critical path üzerindeki aktiviteleri %50'ye kadar kısaltarak hedefe ulaşmayı dener."
        >
          <Input
            type="date"
            value={state.targetEnd}
            onChange={(e) => state.setTargetEnd(e.target.value)}
          />
        </Field>
      )}

      {scenarioType === "holiday" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tatil başlangıcı">
            <Input
              type="date"
              value={state.holidayFrom}
              onChange={(e) => state.setHolidayFrom(e.target.value)}
            />
          </Field>
          <Field label="Tatil bitişi">
            <Input
              type="date"
              value={state.holidayTo}
              onChange={(e) => state.setHolidayTo(e.target.value)}
            />
          </Field>
        </div>
      )}

      {scenarioType === "resource-absence" && (
        <div className="space-y-2">
          <Field label="Hangi aktiviteler etkilensin? (kaynak kullanıyor olanlar)">
            <LeafMultiSelect
              leafs={leafs}
              selected={state.absenceCodes}
              onChange={state.setAbsenceCodes}
            />
          </Field>
          <Field label="Kaç gün yapamayacaklar?">
            <Input
              type="number"
              min={1}
              value={state.absenceDays}
              onChange={(e) => state.setAbsenceDays(parseInt(e.target.value) || 1)}
            />
          </Field>
        </div>
      )}

      {scenarioType === "predecessor-change" && (
        <>
          {predLinks.length === 0 ? (
            <div className="px-3 py-4 text-center text-text3 text-[12px] bg-bg2 rounded-lg border border-border">
              Henüz öncül linki yok — önce öncül ekle.
            </div>
          ) : (
            <>
              <Field label="Hangi link?" hint="Mevcut bir öncül-bağımlı çiftini seç">
                <Select
                  value={`${state.predTargetCode}|${state.predPredCode}`}
                  onChange={(e) => {
                    const [t, p] = e.target.value.split("|");
                    state.setPredTargetCode(t);
                    state.setPredPredCode(p);
                  }}
                >
                  <option value="|">— Seç —</option>
                  {predLinks.map((l) => (
                    <option
                      key={`${l.targetCode}|${l.predCode}`}
                      value={`${l.targetCode}|${l.predCode}`}
                    >
                      {l.predCode} → {l.targetCode} ({l.targetName})
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Yeni tip">
                  <Select
                    value={state.predNewType}
                    onChange={(e) => state.setPredNewType(e.target.value as PredecessorType)}
                  >
                    <option value="FS">FS — Finish→Start</option>
                    <option value="SS">SS — Start→Start</option>
                    <option value="FF">FF — Finish→Finish</option>
                  </Select>
                </Field>
                <Field label="Yeni lag (gün)">
                  <Input
                    type="number"
                    value={state.predNewLag}
                    onChange={(e) => state.setPredNewLag(parseInt(e.target.value) || 0)}
                  />
                </Field>
              </div>
            </>
          )}
        </>
      )}

      {scenarioType === "quantity-change" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Hangi aktivite?" className="sm:col-span-2">
            <LeafSelect leafs={leafs} value={state.qtyCode} onChange={state.setQtyCode} />
          </Field>
          <Field label="Miktar yüzde değişim (%)" hint="+20 = artış, −10 = azalış. Süre orantılı uzar.">
            <Input
              type="number"
              value={state.qtyPercent}
              onChange={(e) => state.setQtyPercent(parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>
      )}

      {scenarioType === "weather-risk" && (
        <div className="grid grid-cols-3 gap-3">
          <Field label="Başlangıç ayı" hint="1=Oca, 12=Ara">
            <Input
              type="number"
              min={1}
              max={12}
              value={state.weatherFrom}
              onChange={(e) => state.setWeatherFrom(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
            />
          </Field>
          <Field label="Bitiş ayı">
            <Input
              type="number"
              min={1}
              max={12}
              value={state.weatherTo}
              onChange={(e) => state.setWeatherTo(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
            />
          </Field>
          <Field label="Haftada kaç gün kayıp?">
            <Input
              type="number"
              min={0}
              max={7}
              step="0.5"
              value={state.weatherDays}
              onChange={(e) => state.setWeatherDays(Math.max(0, Math.min(7, parseFloat(e.target.value) || 0)))}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function LeafSelect({
  leafs,
  value,
  onChange,
}: {
  leafs: WbsItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Seç —</option>
      {leafs.map((l) => (
        <option key={l.code} value={l.code}>
          {l.code} · {l.name}
          {l.activityType === "milestone" ? " (◆ Milestone)" : ""}
        </option>
      ))}
    </Select>
  );
}

function LeafMultiSelect({
  leafs,
  selected,
  onChange,
}: {
  leafs: WbsItem[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-white">
      {leafs.map((l) => {
        const checked = selected.includes(l.code);
        return (
          <label
            key={l.code}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 border-b border-border/40 cursor-pointer text-[11.5px]",
              checked ? "bg-accent/8" : "hover:bg-bg2/40"
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                if (checked) onChange(selected.filter((c) => c !== l.code));
                else onChange([...selected, l.code]);
              }}
              className="w-4 h-4 accent-accent"
            />
            <span className="font-mono text-[10px] text-text3 w-16 shrink-0">{l.code}</span>
            <span className="flex-1 truncate text-text">{l.name}</span>
          </label>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Step 3 — Sonuç ekranı: KPI'lar + etkilenen liste
// ─────────────────────────────────────────────────────────────────

function ResultStep({ result, wbs }: { result: ScenarioResult; wbs: WbsItem[] }) {
  const delta = result.deltaDays;
  const deltaColor = delta > 0 ? "text-red" : delta < 0 ? "text-green" : "text-text2";
  const newCriticalCount = result.scenarioCritical.size;
  const oldCriticalCount = result.currentCritical.size;
  const criticalDelta = newCriticalCount - oldCriticalCount;

  // Yeni / çıkan critical kalemler
  const addedCritical = Array.from(result.scenarioCritical).filter(
    (c) => !result.currentCritical.has(c)
  );
  const removedCritical = Array.from(result.currentCritical).filter(
    (c) => !result.scenarioCritical.has(c)
  );

  return (
    <div className="space-y-4">
      <div className="px-3 py-2 rounded-lg bg-accent/8 border border-accent/25 text-[12px] text-text2 flex items-start gap-2">
        <Sparkles size={14} className="text-accent shrink-0 mt-0.5" />
        <span>{result.summary}</span>
      </div>

      {/* KPI'lar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi
          label="Proje Bitişi"
          value={
            <>
              <div className="font-mono text-[11px] text-text3 line-through">
                {formatDate(result.currentEnd)}
              </div>
              <div className="font-mono text-[14px] font-bold text-text">
                {formatDate(result.scenarioEnd)}
              </div>
            </>
          }
          delta={
            <span className={cn("font-mono text-[11px] font-bold", deltaColor)}>
              {delta > 0 ? "+" : ""}
              {delta} gün
            </span>
          }
        />
        <Kpi
          label="Critical Path"
          value={
            <>
              <div className="font-mono text-[11px] text-text3">
                Eski: {oldCriticalCount} kalem
              </div>
              <div className="font-mono text-[14px] font-bold text-text">
                {newCriticalCount} kalem
              </div>
            </>
          }
          delta={
            criticalDelta !== 0 ? (
              <span
                className={cn(
                  "font-mono text-[11px] font-bold",
                  criticalDelta > 0 ? "text-red" : "text-green"
                )}
              >
                {criticalDelta > 0 ? "+" : ""}
                {criticalDelta} kalem
              </span>
            ) : (
              <span className="font-mono text-[11px] text-text3">değişmedi</span>
            )
          }
        />
        <Kpi
          label="Etkilenen Aktivite"
          value={
            <div className="font-mono text-[14px] font-bold text-text">
              {result.affected.length}
            </div>
          }
          delta={
            <span className="font-mono text-[11px] text-text3">
              / {wbs.filter((w) => w.isLeaf && !w.deletedAt).length} kalem
            </span>
          }
        />
      </div>

      {/* Crash önerileri */}
      {result.crashSuggestions && result.crashSuggestions.length > 0 && (
        <div className="rounded-lg border border-blue/30 overflow-hidden">
          <div className="px-3 py-2 bg-blue/8 border-b border-blue/25 text-[12px] font-bold text-blue">
            🔧 Crash önerileri ({result.crashSuggestions.length} aktivite)
          </div>
          <ul className="divide-y divide-blue/15">
            {result.crashSuggestions.map((c) => (
              <li
                key={c.code}
                className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] hover:bg-blue/[0.04]"
              >
                <span className="font-mono text-[10px] text-blue font-bold w-16 shrink-0">
                  {c.code}
                </span>
                <span className="flex-1 truncate text-text2">{c.name}</span>
                <span className="font-mono text-[10.5px] text-blue font-bold shrink-0">
                  −{c.daysReduced} gün
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical path değişiklikleri */}
      {(addedCritical.length > 0 || removedCritical.length > 0) && (
        <div className="rounded-lg border border-red/30 overflow-hidden">
          <div className="px-3 py-2 bg-red/8 border-b border-red/25 text-[12px] font-bold text-red flex items-center gap-2">
            <AlertTriangle size={12} /> Critical Path Değişikliği
          </div>
          <div className="px-3 py-2 text-[11.5px] space-y-1">
            {addedCritical.length > 0 && (
              <div>
                <strong className="text-red">Eklenen ({addedCritical.length}):</strong>{" "}
                <span className="font-mono text-[10.5px] text-text2">
                  {addedCritical.join(", ")}
                </span>
              </div>
            )}
            {removedCritical.length > 0 && (
              <div>
                <strong className="text-green">Çıkan ({removedCritical.length}):</strong>{" "}
                <span className="font-mono text-[10.5px] text-text2">
                  {removedCritical.join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Etkilenen aktivite listesi */}
      {result.affected.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 bg-bg2 border-b border-border text-[10.5px] font-bold uppercase tracking-wider text-text2">
            Etkilenen Aktiviteler ({result.affected.length})
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-bg2/60 sticky top-0">
                <tr className="text-[10px] uppercase tracking-wider text-text3">
                  <th className="px-3 py-1.5 text-left w-16">Kod</th>
                  <th className="px-3 py-1.5 text-left">Kalem</th>
                  <th className="px-3 py-1.5 text-left w-24">Eski Başl.</th>
                  <th className="px-3 py-1.5 text-left w-24">Yeni Başl.</th>
                  <th className="px-3 py-1.5 text-right w-20">Δ</th>
                </tr>
              </thead>
              <tbody>
                {result.affected.map((a) => (
                  <tr key={a.code} className="border-t border-border/40">
                    <td className="px-3 py-1 font-mono text-[10.5px] text-text3">{a.code}</td>
                    <td className="px-3 py-1 text-text2 truncate max-w-[18rem]">{a.name}</td>
                    <td className="px-3 py-1 font-mono text-[10.5px] text-text3 line-through">
                      {a.oldStart ?? "—"}
                    </td>
                    <td className="px-3 py-1 font-mono text-[10.5px] text-text">
                      {a.newStart ?? "—"}
                    </td>
                    <td className="px-3 py-1 text-right">
                      <span
                        className={cn(
                          "font-mono font-bold text-[10.5px]",
                          a.shiftDays > 0
                            ? "text-red"
                            : a.shiftDays < 0
                              ? "text-green"
                              : "text-text3"
                        )}
                      >
                        {a.shiftDays > 0 ? "+" : ""}
                        {a.shiftDays}g
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="px-3 py-6 text-center text-text3 text-[12px] rounded-lg border border-border bg-bg2/40">
          Hiçbir aktivite etkilenmedi — bu senaryo proje takvimine dokunmadı.
        </div>
      )}

      <div className="px-3 py-2 rounded-md bg-yellow/5 border border-yellow/25 text-[11px] text-text2 flex items-start gap-2">
        <span className="text-yellow shrink-0">ℹ</span>
        <span>
          Bu sadece bir <strong>etki analizi</strong>. Sonuçlar canlı plana yazılmaz — dialog&apos;u
          kapatınca her şey sıfırlanır.
        </span>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
}: {
  label: string;
  value: React.ReactNode;
  delta: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-text3 mb-1">{label}</div>
      <div>{value}</div>
      <div className="mt-1 flex items-center gap-1">
        <ArrowRight size={10} className="text-text3" />
        {delta}
      </div>
    </div>
  );
}
