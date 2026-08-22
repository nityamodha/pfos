"use client";

import { useState } from "react";
import { RANGE_KEYS, RANGE_LABELS, type RangeKey } from "@/lib/trends-shared";
import type { CategoryBreakdown } from "@/lib/category-spend-shared";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const MAX_ROWS = 7;

export function CategoryBreakdownSection({ breakdown }: { breakdown: CategoryBreakdown }) {
  const [range, setRange] = useState<RangeKey>("1M");
  const window = breakdown[range];

  const items =
    window.items.length > MAX_ROWS + 1
      ? [
          ...window.items.slice(0, MAX_ROWS),
          {
            categoryId: null,
            categoryName: "Other",
            amount: window.items.slice(MAX_ROWS).reduce((s, i) => s + i.amount, 0),
          },
        ]
      : window.items;
  const max = items.length ? items[0].amount : 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">Spending by category</h2>
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

      <Card className="gap-3 p-4">
        <p className="font-mono text-2xl font-semibold tabular-nums">{formatINR(window.total)}</p>

        {items.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            No spending in this window
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => (
              <div key={item.categoryId ?? item.categoryName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{item.categoryName}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{formatINR(item.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-rose-400"
                    style={{ width: max > 0 ? `${Math.max(2, (item.amount / max) * 100)}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
