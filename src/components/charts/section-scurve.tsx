"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatDate } from "@/lib/utils";

export interface MiniSCurvePoint {
  date: string;
  planPct: number;
  realPct: number;
  /** Opsiyonel — SPI-bazlı tahmin (rapor tarihinden 100'e ekstrapolasyon) */
  forecast?: number;
}

export function MiniSCurve({
  data,
  reportDate,
  plannedEnd,
  forecastEnd,
  forecastOpacity = 1,
  height = 140,
}: {
  data: MiniSCurvePoint[];
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
        <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <XAxis dataKey="date" hide />
          <YAxis domain={[0, 100]} hide />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 11,
              boxShadow: "0 8px 24px -8px rgba(15, 23, 42, 0.12)",
            }}
            labelStyle={{ color: "#475569", fontWeight: 600, fontSize: 10 }}
            labelFormatter={(d) => formatDate(d as string)}
            formatter={(v, name) => [
              typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)}%` : "—",
              name === "planPct" ? "Plan" : name === "realPct" ? "Gerçek" : "Tahmin",
            ]}
          />
          {reportDate && (
            <ReferenceLine x={reportDate} stroke="#059669" strokeDasharray="2 2" strokeWidth={1} />
          )}
          {plannedEnd && (
            <ReferenceLine x={plannedEnd} stroke="#3b82f6" strokeDasharray="2 2" strokeWidth={1} />
          )}
          {forecastEnd && forecastEnd !== plannedEnd && (
            <ReferenceLine x={forecastEnd} stroke="#f97316" strokeDasharray="2 2" strokeWidth={1} />
          )}
          <Line type="monotone" dataKey="planPct" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="realPct" stroke="#10b981" strokeWidth={2} dot={false} connectNulls={false} />
          {hasForecast && (
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="#f97316"
              strokeWidth={1.8}
              strokeDasharray="4 3"
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
