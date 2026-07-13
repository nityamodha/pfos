"use client";

import { useState } from "react";
import { TrendChart } from "@/components/trend-chart";
import { RANGE_KEYS, RANGE_LABELS, type RangeKey, type Trends } from "@/lib/trends-shared";
import { cn } from "@/lib/utils";

export function TrendsSection({ trends }: { trends: Trends }) {
  const [range, setRange] = useState<RangeKey>("1Y");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">Trends</h2>
        <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
          {RANGE_KEYS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-2.5 py-1 transition-colors",
                range === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      <TrendChart title="Savings" group={trends.savings} range={range} accent="var(--chart-1)" />
      <TrendChart title="Investments" group={trends.investments} range={range} accent="var(--chart-4)" />
      <TrendChart title="Liabilities" group={trends.liabilities} range={range} accent="var(--chart-5)" liability />
    </section>
  );
}
