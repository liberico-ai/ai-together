"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { useTheme } from "next-themes";

/**
 * Radar 4 trục cho Composite Score (Mục tiêu 2).
 * Trục: Tempo (T) · Completion (C) · Quality (Q) · AI Adoption (AI).
 * Mọi trục nằm trong dải [0.5, 1.5] (đã clamp phía server).
 * Đường "Cam kết" = mức 1.0 (ngưỡng đạt kỳ vọng) để so sánh.
 */

const PINK = "#ec4899";

export interface CompositeRadarProps {
  tempo: number;
  completion: number;
  quality: number;
  ai: number;
  /** Mức cam kết trên mỗi trục, mặc định 1.0 */
  commitment?: number;
  className?: string;
}

export function CompositeRadar({
  tempo,
  completion,
  quality,
  ai,
  commitment = 1.0,
  className,
}: CompositeRadarProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const gridColor = isDark ? "#44403c" : "#e7e5e4";
  const tickColor = isDark ? "#a8a29e" : "#78716c";
  const tooltipBg = isDark ? "#292524" : "#ffffff";
  const tooltipBorder = isDark ? "#44403c" : "#e7e5e4";

  const data = [
    { axis: "Tempo", value: round(tempo), commit: commitment },
    { axis: "Completion", value: round(completion), commit: commitment },
    { axis: "Quality", value: round(quality), commit: commitment },
    { axis: "AI", value: round(ai), commit: commitment },
  ];

  return (
    <div className={className ?? "h-[320px] w-full"}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke={gridColor} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 12, fill: tickColor }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0.5, 1.5]}
            tickCount={5}
            tick={{ fontSize: 10, fill: tickColor }}
            axisLine={false}
          />
          <Radar
            name="Cam kết (1.0)"
            dataKey="commit"
            stroke={isDark ? "#78716c" : "#a8a29e"}
            strokeDasharray="4 4"
            fill="transparent"
            dot={false}
          />
          <Radar
            name="Điểm"
            dataKey="value"
            stroke={PINK}
            fill={PINK}
            fillOpacity={0.35}
            dot={{ r: 3, fill: PINK }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Tooltip
            formatter={(v) => Number(v).toFixed(2)}
            contentStyle={{
              borderRadius: "8px",
              border: `1px solid ${tooltipBorder}`,
              backgroundColor: tooltipBg,
              color: isDark ? "#fdf2f8" : "#1c1917",
              fontSize: 12,
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function round(x: number): number {
  return Math.round((Number(x) || 0) * 100) / 100;
}
