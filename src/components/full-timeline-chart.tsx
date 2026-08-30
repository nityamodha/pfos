"use client";

import { useMemo } from "react";
import { Area, AreaChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import type { TimelinePoint } from "@/lib/full-timeline-shared";
import { formatINR } from "@/lib/format";
import { Card } from "@/components/ui/card";

const PX_PER_DAY = 6;
const MIN_WIDTH = 600;

export function FullTimelineChart({
  title,
  points,
  todayDate,
  accent = "var(--chart-1)",
}: {
  title: string;
  points: TimelinePoint[];
  todayDate: string;
  accent?: string;
}) {
  const { data, width, latest } = useMemo(() => {
    const merged = points.map((p) => ({
      label: p.label,
      date: p.date,
      actual: p.projected ? null : p.value,
      forecast: p.projected ? p.value : null,
    }));
    let lastActualIdx = -1;
    for (let i = 0; i < merged.length; i++) if (merged[i].actual != null) lastActualIdx = i;
    if (lastActualIdx >= 0 && merged[lastActualIdx + 1]) {
      merged[lastActualIdx].forecast = merged[lastActualIdx].actual;
    }
    return {
      data: merged,
      width: Math.max(MIN_WIDTH, points.length * PX_PER_DAY),
      latest: points.find((p) => p.date === todayDate)?.value ?? points[0]?.value ?? 0,
    };
  }, [points, todayDate]);

  return (
    <Card className="gap-3 p-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums">{formatINR(latest)}</p>
      </div>

      <div className="overflow-x-auto">
        <AreaChart
          width={width}
          height={220}
          data={data}
          margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`fill-actual-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <ReferenceLine
            x={points.find((p) => p.date === todayDate)?.label}
            stroke="var(--border)"
            strokeDasharray="3 3"
            label={{ value: "Today", position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
              color: "var(--popover-foreground)",
            }}
            formatter={(value: unknown, name: unknown) =>
              [formatINR(Number(value)), name === "forecast" ? "Projected" : "Actual"] as [string, string]
            }
          />
          <Area
            type="monotone"
            dataKey="actual"
            stroke={accent}
            strokeWidth={2}
            fill={`url(#fill-actual-${title})`}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            stroke={accent}
            strokeWidth={2}
            strokeDasharray="5 4"
            fill="transparent"
            connectNulls={false}
          />
        </AreaChart>
      </div>
    </Card>
  );
}
