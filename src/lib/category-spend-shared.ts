// Client-safe types for the category spending breakdown (no server-only / Prisma imports).
import type { RangeKey } from "@/lib/trends-shared";

export type CategorySlice = { categoryId: string | null; categoryName: string; amount: number };
export type CategoryWindow = { total: number; items: CategorySlice[] };
export type CategoryBreakdown = Record<RangeKey, CategoryWindow>;

export type { RangeKey };
