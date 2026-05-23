"use client";

import { useLayoutEffect, useMemo, useState, type RefObject } from "react";
import type { WbsItem } from "@/lib/store/types";

/**
 * Mini-Gantt için öncül oku katmanı.
 *
 * Primavera P6 prensipleri:
 *  - FS: predecessor.end → successor.start. Source: sağ kenar; target: sol kenar.
 *  - SS: predecessor.start → successor.start. Source: sol kenar; target: sol kenar.
 *  - FF: predecessor.end → successor.end. Source: sağ kenar; target: sağ kenar.
 *
 * Çizgiler ortogonal (90° dönüşler) ve **birbirine karışmaz**:
 *  - Her kaynak satırın çıkış kanalları farklı x-offset'inde dizilir
 *  - Her hedef satırın giriş kanalları farklı x-offset'inde dizilir
 *  - Source ve target row'ların gönderim sırasına göre yatay segmentler kademelendirilir
 *
 * Kritik yol okları kırmızı, normal oklar koyu gri.
 *
 * SVG koordinat sistemi pixel cinsindendir — overlay parent `position: relative`
 * olmalı ve verilen `width × (visible.length * rowHeight)` kadar yer kaplar.
 */
export type ArrowMode = "off" | "all" | "selected";

export interface GanttArrowsProps {
  visible: Array<{ item: WbsItem; range: { start: string; end: string; isFromPlan: boolean } }>;
  /** Bar alanının pixel genişliği. ResizeObserver ile parent'tan ölçülür. */
  barAreaWidth: number;
  /**
   * Satırları içeren wrapper (her <li>'de data-row-code attribute olmalı).
   * GanttArrows bu wrapper'dan satır y-pozisyonlarını DOM'dan ölçer.
   * Border'lar (1px / 2px grup) ve diğer layout farklarından bağımsız.
   */
  rowsWrapperRef: RefObject<HTMLDivElement | null>;
  /** projectStart..projectEnd üzerinden ISO → 0..100 yüzde dönüşümü. */
  pct: (iso: string) => number;
  /** Kritik yol kalemleri — okun rengi için. */
  criticalCodes: Set<string>;
  /** Görünür mod. */
  mode: ArrowMode;
  /** "selected" modunda gösterilecek kalem kodları (kaynak veya hedef). */
  selectedCodes: Set<string>;
  /**
   * Odaklanan kalem kodu — bar'a tıklayınca set edilir. Bu kaleme bağlı tüm
   * oklar (gelen + giden) **bright blue** ile vurgulanır (Primavera tarzı).
   * null ise vurgulama yok.
   */
  focusedCode?: string | null;
}

interface ArrowComputed {
  key: string;
  type: "FS" | "SS" | "FF";
  sourceCode: string;
  targetCode: string;
  isCritical: boolean;
  /** Odaklanan bar'a bağlı mı (source veya target focusedCode ise true) */
  isFocused: boolean;
  /** Lag (gün) — etiket için. 0 ise etiket çizilmez. */
  lag: number;
  /** Path: SVG d attribute (orthogonal, 90° corners). */
  d: string;
  /** Etiket pozisyonu — yatay segmentin orta noktası. */
  labelX?: number;
  labelY?: number;
}

const ARROW_HEAD_SIZE = 5; // px
const MIN_JOG = 6;         // px — bar kenarından çıkış mesafesi
const JOG_STEP = 3;        // px — aynı kaynak/hedeften gelen okların kanalları arası

export function GanttArrows({
  visible,
  barAreaWidth,
  rowsWrapperRef,
  pct,
  criticalCodes,
  mode,
  selectedCodes,
  focusedCode,
}: GanttArrowsProps) {
  // Satır metrikleri DOM'dan ölçülür: her <li data-row-code> elementinin
  // offsetTop ve offsetHeight'i alınır → bar'ın gerçek vertical center'ı bulunur.
  // Bar inner div'de top-1 bottom-1 (4px) ile vertical centered → bar center = row content center.
  // li offsetHeight = border + content. Bar center = li.offsetTop + (li.offsetHeight - bar_h - 4) ile aynı:
  //   bar_h = 12px (h-5 = 20 minus top-1 - bottom-1 = 4+4)
  //   bar_center_y_relative_to_li_top = (offsetHeight - 20) + 10 = offsetHeight - 10
  // (Border 1 veya 2 px farkı offsetHeight'ten geliyor.)
  type RowMetric = { yCenter: number; topY: number; bottomY: number };
  const [rowMetrics, setRowMetrics] = useState<Map<string, RowMetric>>(
    () => new Map()
  );
  const [totalHeight, setTotalHeight] = useState(0);

  useLayoutEffect(() => {
    const wrapper = rowsWrapperRef.current;
    if (!wrapper) return;
    function measure() {
      const wrapperEl = rowsWrapperRef.current;
      if (!wrapperEl) return;
      const next = new Map<string, RowMetric>();
      const lis = wrapperEl.querySelectorAll<HTMLLIElement>("li[data-row-code]");
      let maxBottom = 0;
      lis.forEach((li) => {
        const code = li.dataset.rowCode;
        if (!code) return;
        const top = li.offsetTop;
        const height = li.offsetHeight;
        // Bar dikey merkezi: li.offsetTop + (offsetHeight - 10) — bar h-5 (20px)
        // içinde top-1 bottom-1 ile ortalanır, içerik alanı bottom'dan 10px yukarı.
        const yCenter = top + height - 10;
        const bottom = top + height;
        next.set(code, { yCenter, topY: top, bottomY: bottom });
        if (bottom > maxBottom) maxBottom = bottom;
      });
      setRowMetrics(next);
      setTotalHeight(maxBottom);
    }
    measure();
    // Resize'da yeniden ölç (font yüklenmesi, vs.)
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [rowsWrapperRef, visible, mode, selectedCodes]);
  // code → index + bar metrics. Y koordinatı DOM ölçümünden (rowMetrics);
  // X koordinatları yüzde × barAreaWidth (gerçek görsel genişlik: minWidth=3px
  // koşulu eklenir — kısa barlarda FF okları doğru sağ kenara yapışsın).
  const codeMeta = useMemo(() => {
    const map = new Map<
      string,
      { idx: number; leftPx: number; rightPx: number; yCenter: number }
    >();
    visible.forEach((v, idx) => {
      const m = rowMetrics.get(v.item.code);
      if (!m) return; // DOM henüz ölçülmedi
      const left = pct(v.range.start);
      const width = Math.max(0.5, pct(v.range.end) - left);
      const leftPx = (left / 100) * barAreaWidth;
      const rawWidthPx = (width / 100) * barAreaWidth;
      const visualWidthPx = Math.max(3, rawWidthPx);
      const rightPx = leftPx + visualWidthPx;
      map.set(v.item.code, { idx, leftPx, rightPx, yCenter: m.yCenter });
    });
    return map;
  }, [visible, barAreaWidth, pct, rowMetrics]);

  const arrows = useMemo<ArrowComputed[]>(() => {
    if (barAreaWidth === 0) return [];
    // mode === "off" + focusedCode yok → hiç ok yok
    if (mode === "off" && !focusedCode) return [];

    // Toplama: ham aday oklar
    type Raw = {
      sourceCode: string;
      targetCode: string;
      type: "FS" | "SS" | "FF";
      lag: number;
    };
    const raw: Raw[] = [];
    for (const v of visible) {
      const preds = v.item.predecessors ?? [];
      for (const link of preds) {
        if (!codeMeta.has(link.wbsCode)) continue;
        if (!codeMeta.has(v.item.code)) continue;
        // focusedCode bu okta yer alıyor mu? (auto-include in any mode)
        const involvesFocused =
          focusedCode != null &&
          (v.item.code === focusedCode || link.wbsCode === focusedCode);
        if (mode === "off") {
          // Sadece odaklanan bar'ın okları gözükür
          if (!involvesFocused) continue;
        } else if (mode === "selected") {
          // Seçili kalemlere ait OR odaklanan
          if (
            !selectedCodes.has(v.item.code) &&
            !selectedCodes.has(link.wbsCode) &&
            !involvesFocused
          ) {
            continue;
          }
        }
        // mode === "all" → hepsi geçer
        raw.push({
          sourceCode: link.wbsCode,
          targetCode: v.item.code,
          type: link.type,
          lag: link.lagDays,
        });
      }
    }

    // Karışmayı önlemek için kanal indeksleri:
    //  - sourceOutIdx: aynı kaynaktan çıkan ok sayacı (her çıkış farklı jog)
    //  - targetInIdx: aynı hedefe giren ok sayacı (her giriş farklı jog)
    const outCounter = new Map<string, number>();   // sourceCode → next idx
    const inCounter = new Map<string, number>();    // targetCode → next idx

    const computed: ArrowComputed[] = [];
    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      const s = codeMeta.get(r.sourceCode)!;
      const t = codeMeta.get(r.targetCode)!;
      const outIdx = outCounter.get(r.sourceCode) ?? 0;
      outCounter.set(r.sourceCode, outIdx + 1);
      const inIdx = inCounter.get(r.targetCode) ?? 0;
      inCounter.set(r.targetCode, inIdx + 1);

      // Source ve target kanal jog'ları
      const outJog = MIN_JOG + outIdx * JOG_STEP;
      const inJog = MIN_JOG + inIdx * JOG_STEP;
      const isCritical =
        criticalCodes.has(r.sourceCode) && criticalCodes.has(r.targetCode);

      // Kaynak/hedef koordinatları link tipine göre
      const sy = s.yCenter;
      const ty = t.yCenter;
      let sx: number;
      let tx: number;
      if (r.type === "FS") {
        sx = s.rightPx;
        tx = t.leftPx;
      } else if (r.type === "SS") {
        sx = s.leftPx;
        tx = t.leftPx;
      } else {
        // FF
        sx = s.rightPx;
        tx = t.rightPx;
      }

      // Orthogonal path (4 nokta, 2 dönüş):
      //   M sx,sy → L midX1,sy → L midX1,midY → L midX2,midY → L midX2,ty → L tx,ty
      // Basitleştirilmiş 3-segment versiyonu daha temiz:
      //   M sx,sy → L jogX,sy → L jogX,ty → L tx,ty
      // jogX seçimi link tipine göre:
      //  - FS: jogX = max(sx, tx) + outJog (sağa fan, sonra inJog ile hedefe yaklaş)
      //  - SS: jogX = min(sx, tx) - outJog (sola fan)
      //  - FF: jogX = max(sx, tx) + outJog (sağa fan)
      //
      // Ama overlap'i azaltmak için 5-segment path kullanıyoruz:
      //   M sx,sy
      //   L sx ± outJog, sy            (kaynaktan çıkış)
      //   L sx ± outJog, midY          (dikey kanal — kaynağa özel)
      //   L tx ± inJog, midY           (yatay köprü)
      //   L tx ± inJog, ty             (hedefe iniş — hedefe özel kanal)
      //   L tx, ty                     (hedefe son giriş)
      //
      // midY: source ve target arasında, hedefin biraz öncesinde (overlap önler)

      const sJogDir = r.type === "SS" ? -1 : 1; // SS sola çıkar, diğerleri sağa
      const tJogDir = r.type === "FF" ? 1 : -1; // FF sağdan girer, diğerleri soldan

      const sJogX = sx + sJogDir * outJog;
      const tJogX = tx + tJogDir * inJog;

      // midY: hedef satırın hemen önündeki kanal — sabit 8px offset hedef
      // satırın üstüne/altına yaslanır. inIdx ile minik dikey kayma → aynı hedefe
      // gelen okların yatay köprüleri üst üste binmesin.
      const goingDown = ty > sy;
      const midY = goingDown ? ty - 8 + inIdx : ty + 8 - inIdx;

      const d = [
        `M ${sx} ${sy}`,
        `L ${sJogX} ${sy}`,
        `L ${sJogX} ${midY}`,
        `L ${tJogX} ${midY}`,
        `L ${tJogX} ${ty}`,
        `L ${tx} ${ty}`,
      ].join(" ");

      // Lag etiketi: orta yatay segmentin orta noktası
      const labelX = (sJogX + tJogX) / 2;
      const labelY = midY - 4;

      const isFocused =
        focusedCode != null &&
        (r.sourceCode === focusedCode || r.targetCode === focusedCode);

      computed.push({
        key: `${r.sourceCode}->${r.targetCode}-${r.type}-${i}`,
        type: r.type,
        sourceCode: r.sourceCode,
        targetCode: r.targetCode,
        isCritical,
        isFocused,
        lag: r.lag,
        d,
        labelX,
        labelY,
      });
    }
    return computed;
  }, [
    visible,
    codeMeta,
    barAreaWidth,
    mode,
    selectedCodes,
    criticalCodes,
    focusedCode,
  ]);

  if (arrows.length === 0 || barAreaWidth === 0) return null;

  const height = totalHeight;
  const width = barAreaWidth;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute top-0 left-0 pointer-events-none"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        {/*
          Marker sabit piksel boyutu (userSpaceOnUse) — stroke width'e göre
          ölçeklenmez, böylece tip her zaman aynı pozisyona düşer.
          refX=10 → triangle tipi (10,5) ile path uç noktası tam üst üste:
          ok ucu BAR'ın kenarına yapışır, içine kaçmaz.
        */}
        <marker
          id="gantt-arrow-normal"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth={ARROW_HEAD_SIZE}
          markerHeight={ARROW_HEAD_SIZE}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
        </marker>
        <marker
          id="gantt-arrow-critical"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth={ARROW_HEAD_SIZE}
          markerHeight={ARROW_HEAD_SIZE}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
        {/* Focused — Primavera tarzı bright blue (sky-500) */}
        <marker
          id="gantt-arrow-focused"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth={ARROW_HEAD_SIZE * 1.2}
          markerHeight={ARROW_HEAD_SIZE * 1.2}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#0ea5e9" />
        </marker>
        <marker
          id="gantt-arrow-focused-critical"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth={ARROW_HEAD_SIZE * 1.2}
          markerHeight={ARROW_HEAD_SIZE * 1.2}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
      </defs>
      {arrows.map((a) => {
        // Renk + stroke hiyerarşisi:
        //  - Focused + Critical → kırmızı (kalın 2px, %100 opak)
        //  - Focused            → sky blue #0ea5e9 (kalın 2px, %100 opak)
        //  - Critical           → kırmızı (1.4px, %100 opak)
        //  - Normal             → koyu gri #475569 (1px, %75 opak)
        // Eğer bir bar odaklanmışsa odakta-olmayan oklar mute olur (opacity 0.15).
        const anyFocused = focusedCode != null;
        let stroke: string;
        let marker: string;
        let strokeWidth: number;
        let opacity: number;
        if (a.isFocused && a.isCritical) {
          stroke = "#dc2626";
          marker = "url(#gantt-arrow-focused-critical)";
          strokeWidth = 2;
          opacity = 1;
        } else if (a.isFocused) {
          stroke = "#0ea5e9";
          marker = "url(#gantt-arrow-focused)";
          strokeWidth = 2;
          opacity = 1;
        } else if (a.isCritical) {
          stroke = "#dc2626";
          marker = "url(#gantt-arrow-critical)";
          strokeWidth = 1.4;
          opacity = anyFocused ? 0.2 : 1;
        } else {
          stroke = "#475569";
          marker = "url(#gantt-arrow-normal)";
          strokeWidth = 1;
          opacity = anyFocused ? 0.15 : 0.75;
        }
        return (
          <g key={a.key}>
            <path
              d={a.d}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              markerEnd={marker}
              opacity={opacity}
            />
            {a.lag !== 0 && a.labelX !== undefined && a.labelY !== undefined && (
              <text
                x={a.labelX}
                y={a.labelY}
                fontSize={8}
                fontFamily="ui-monospace, monospace"
                fill={stroke}
                textAnchor="middle"
                fontWeight="bold"
                opacity={opacity}
              >
                {a.type}
                {a.lag > 0 ? "+" : ""}
                {a.lag}g
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
