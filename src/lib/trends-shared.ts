// Client-safe types and constants for trends (no server-only / Prisma imports).

export type RangeKey = "1M" | "3M" | "1Y" | "ALL";
export const RANGE_KEYS: RangeKey[] = ["1M", "3M", "1Y", "ALL"];
export const RANGE_LABELS: Record<RangeKey, string> = {
  "1M": "Month",
  "3M": "Quarter",
  "1Y": "Year",
  ALL: "All",
};

export type TrendPoint = { label: string } & Record<string, number | string>;
export type TrendGroup = {
  accounts: { id: string; name: string }[];
  series: Record<RangeKey, TrendPoint[]>;
  latestTotal: number;
};
export type Trends = {
  netWorth: TrendGroup;
  savings: TrendGroup;
  investments: TrendGroup;
  liabilities: TrendGroup;
};
