// Client-safe types for the credit-card statement-cycle report (no server-only / Prisma imports).

export type CyclePoint = {
  cycleLabel: string; // short display label for the close date, e.g. "5 Jun"
  closeDate: string; // ISO date (yyyy-mm-dd)
  dueDate: string | null; // ISO date the bill for this cycle is due
  charges: number; // sum of charges posted within this cycle (positive magnitude)
  payments: number; // sum of payments posted within this cycle (positive magnitude)
  closingOwed: number; // running amount owed as of this cycle's close
};

export type CycleReport = {
  accountId: string;
  cycles: CyclePoint[]; // oldest to newest
};
