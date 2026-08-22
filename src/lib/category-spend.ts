import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toNumber } from "@/lib/money";
import { RANGE_KEYS, type RangeKey } from "@/lib/trends-shared";
import type { CategoryBreakdown, CategorySlice } from "@/lib/category-spend-shared";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function windowStart(range: RangeKey, earliest: Date): Date {
  if (range === "1M") return daysAgo(30);
  if (range === "3M") return daysAgo(90);
  if (range === "1Y") return daysAgo(365);
  return earliest;
}

/** Spending by category, bucketed into the same Month/Quarter/Year/All windows used by Trends. */
export async function getCategoryBreakdown(): Promise<CategoryBreakdown> {
  const txns = await prisma.transaction.findMany({
    where: { userId: DEFAULT_USER_ID, kind: "EXPENSE" },
    select: { amount: true, date: true, category: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const earliest = txns.length ? txns[0].date : new Date();

  const out = {} as CategoryBreakdown;
  for (const range of RANGE_KEYS) {
    const start = windowStart(range, earliest);
    const byCategory = new Map<string, CategorySlice>();
    let total = 0;
    for (const t of txns) {
      if (t.date < start) continue;
      const amount = toNumber(t.amount);
      const key = t.category?.id ?? "uncategorized";
      const name = t.category?.name ?? "Uncategorized";
      const slice = byCategory.get(key) ?? { categoryId: t.category?.id ?? null, categoryName: name, amount: 0 };
      slice.amount += amount;
      byCategory.set(key, slice);
      total += amount;
    }
    out[range] = {
      total: Math.round(total),
      items: [...byCategory.values()]
        .map((s) => ({ ...s, amount: Math.round(s.amount) }))
        .sort((a, b) => b.amount - a.amount),
    };
  }
  return out;
}
