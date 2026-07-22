// Client-safe types for the monthly spending budget (no server-only / Prisma imports).

export type MonthlyBudget = {
  hasTarget: boolean;
  targetName: string | null;
  savingsTarget: number;
  projectedMonthEnd: number; // balance if no further discretionary spending happens
  remaining: number; // projectedMonthEnd − savingsTarget
  daysLeft: number;
};
