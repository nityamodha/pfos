"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendGroup, RangeKey } from "@/lib/trends-shared";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const PALETTE = [
  "var(--chart-1)", // teal
  "var(--chart-2)", // orange
  "var(--chart-3)", // blue
  "var(--chart-4)", // red
  "var(--chart-5)", // violet
  "#d97706", // amber
  "#0891b2", // cyan
  "#65a30d", // green
];

type Mode = "total" | "individual";

export function TrendChart({
  title,
  group,
  range,
  accent = "var(--chart-1)",
  liability = false,
}: {
  title: string;
  group: TrendGroup;
  range: RangeKey;
  accent?: string;
  liability?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("total");
  const hasMultiple = group.accounts.length > 1;
  const effectiveMode: Mode = hasMultiple ? mode : "total";
  const points = group.series[range];

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn("font-mono text-2xl font-semibold tabular-nums", liability && "text-rose-400")}>
            {formatINR(group.latestTotal)}
          </p>
        </div>
        {hasMultiple ? (
          <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
            {(["total", "individual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-full px-2.5 py-1 capitalize transition-colors",
                  effectiveMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {group.accounts.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No accounts yet
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`fill-${title}`} x1="0" y1="0" x2="0" y2="1">
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
                minTickGap={20}
              />
              <YAxis hide domain={["auto", "auto"]} />
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
                  [formatINR(Number(value)), String(name)] as [string, string]
                }
              />
              {effectiveMode === "total" ? (
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke={accent}
                  strokeWidth={2}
                  fill={`url(#fill-${title})`}
                />
              ) : (
                group.accounts.map((a, i) => (
                  <Area
                    key={a.id}
                    type="monotone"
                    dataKey={a.id}
                    name={a.name}
                    stroke={PALETTE[i % PALETTE.length]}
                    fill={PALETTE[i % PALETTE.length]}
                    fillOpacity={0.2}
                    strokeWidth={1.5}
                  />
                ))
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
