// Client-safe types for the full-history + forecast timeline (no server-only / Prisma imports).

export type TimelinePoint = {
  date: string; // ISO date (yyyy-mm-dd)
  label: string; // short display label
  value: number;
  projected: boolean; // false = real history (incl. today), true = forecasted
};

export type FullTimeline = {
  hasTarget: boolean;
  targetName: string | null;
  todayDate: string | null;
  cashFlow: TimelinePoint[];
  netWorth: TimelinePoint[];
};
