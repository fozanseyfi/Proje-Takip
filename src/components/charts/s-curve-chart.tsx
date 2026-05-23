"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatDate } from "@/lib/utils";

/**
 * Dikey çizgiye paralel yazılı etiket render fonksiyonu.
 * - "bottom": Etiket tablo tabanından başlar, yukarı doğru okunur.
 * - "middle": Etiket dikey çizginin ortasına denk gelir, yukarı doğru okunur.
 */
export function makeVerticalLabel(
  text: string,
  color: string,
  position: "bottom" | "middle"
) {
  return function VerticalLabel(props: {
    viewBox?: { x?: number; y?: number; height?: number };
  }) {
    const vx = props.viewBox?.x ?? 0;
    const vy = props.viewBox?.y ?? 0;
    const vh = props.viewBox?.height ?? 0;
    const labelX = vx + 5;
    const labelY = position === "bottom" ? vy + vh - 4 : vy + vh / 2;
    return (
      <text
        x={labelX}
        y={labelY}
        fill={color}
        fontSize={10}
        fontWeight={700}
        textAnchor={position === "bottom" ? "start" : "middle"}
        transform={`rotate(-90 ${labelX} ${labelY})`}
      >
        {text}
      </text>
    );
  };
}

export interface SCurveDataPoint {
  date: string;
  planPct: number;
  realPct: number | null;
  /** Opsiyonel — SPI-bazlı tahmin çizgisi (rapor tarihinden sonra 100'e ekstrapolasyon) */
  forecast?: number;
}

export function SCurveChart({
  data,
  reportDate,
  plannedEnd,
  forecastEnd,
  forecastOpacity = 1,
  height = 320,
}: {
  data: SCurveDataPoint[];
  reportDate?: string;
  plannedEnd?: string | null;
  forecastEnd?: string | null;
  forecastOpacity?: number;
  height?: number;
}) {
  const hasForecast = data.some((p) => typeof p.forecast === "number" && !isNaN(p.forecast));
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            fontSize={11}
            tickFormatter={(d) => formatDate(d)}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              color: "#0f172a",
              fontSize: 12,
              boxShadow: "0 12px 28px -8px rgba(15, 23, 42, 0.12)",
              padding: "8px 12px",
            }}
            labelStyle={{ color: "#475569", fontWeight: 600, fontSize: 11, marginBottom: 4 }}
            labelFormatter={(d) => formatDate(d as string)}
            formatter={(v, name) => [
              typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)}%` : "—",
              name === "planPct"
                ? "Planlanan"
                : name === "realPct"
                  ? "Gerçekleşen"
                  : "Tahmin",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#475569", paddingTop: 12, fontWeight: 600 }}
            formatter={(v) =>
              v === "planPct"
                ? "Planlanan %"
                : v === "realPct"
                  ? "Gerçekleşen %"
                  : "Tahmin %"
            }
          />
          {reportDate && (
            <ReferenceLine
              x={reportDate}
              stroke="#059669"
              strokeDasharray="4 3"
              label={makeVerticalLabel("Rapor günü", "#059669", "middle")}
            />
          )}
          {plannedEnd && (
            <ReferenceLine
              x={plannedEnd}
              stroke="#3b82f6"
              strokeDasharray="2 2"
              label={makeVerticalLabel("Planlanan Bitiş", "#3b82f6", "bottom")}
            />
          )}
          {forecastEnd && forecastEnd !== plannedEnd && (
            <ReferenceLine
              x={forecastEnd}
              stroke="#f97316"
              strokeDasharray="2 2"
              label={makeVerticalLabel("Tahmini Bitiş", "#f97316", "bottom")}
            />
          )}
          <Line
            type="monotone"
            dataKey="planPct"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="realPct"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
          />
          {hasForecast && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#f97316"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeOpacity={forecastOpacity}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
