import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toNumber } from "@/lib/money";
import { getForecast } from "@/lib/forecast";
import type { MonthlyBudget } from "@/lib/budget-shared";

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Whether a date falls in the last 3 days of its own month, regardless of month length. */
function isMonthEndDate(d: Date): boolean {
  return d.getDate() >= daysInMonth(d.getFullYear(), d.getMonth()) - 2;
}

function isMonthEnd(isoDate: string): boolean {
  return isMonthEndDate(new Date(isoDate + "T00:00:00"));
}

/**
 * How much more the primary account could still spend this month before dropping
 * below the configured savings target — reuses the forecast's day-by-day projection
 * (recurring rules + card-bill settlements) bounded to the current calendar month
 * instead of the usual 90-day window, since today's actual balance already nets out
 * whatever discretionary spending has happened so far this month.
 */
export async function getMonthlyBudget(): Promise<MonthlyBudget> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysLeft = Math.round((monthEnd.getTime() - today.getTime()) / 86_400_000);

  const [user, forecast] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: DEFAULT_USER_ID }, select: { monthlySavingsTarget: true } }),
    getForecast(undefined, daysLeft),
  ]);
  const savingsTarget = toNumber(user.monthlySavingsTarget);

  if (!forecast.hasTarget) {
    return {
      hasTarget: false,
      targetName: null,
      savingsTarget,
      projectedMonthEnd: 0,
      remaining: 0,
      daysLeft,
    };
  }

  // Salary landing in the last few days of the month is really meant to fund next
  // month, not top up this one — exclude it from the budget's own projection (the
  // dashboard Forecast chart is untouched and still shows the real balance).
  const monthEndSalary = forecast.events
    .filter((e) => e.kind === "salary" && isMonthEnd(e.date))
    .reduce((s, e) => s + e.amount, 0);

  // If that same month-end salary already landed early (a real transaction/snapshot
  // already reflected in today's balance) and was confirmed via "mark done", it's
  // baked into forecast.endBalance already — claw it back out too, so an early
  // credit doesn't inflate this month's budget just because it beat the calendar.
  const confirmedSalaryRules = forecast.targetId
    ? await prisma.recurringRule.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          isActive: true,
          kind: "INCOME",
          toAccountId: forecast.targetId,
          confirmedThrough: { not: null },
        },
      })
    : [];
  const earlyReceivedSalary = confirmedSalaryRules.reduce((sum, r) => {
    const c = r.confirmedThrough!;
    const sameMonth = c.getFullYear() === today.getFullYear() && c.getMonth() === today.getMonth();
    return sameMonth && isMonthEndDate(c) ? sum + toNumber(r.amount) : sum;
  }, 0);

  const projectedMonthEnd = forecast.endBalance - monthEndSalary - earlyReceivedSalary;

  return {
    hasTarget: true,
    targetName: forecast.targetName,
    savingsTarget,
    projectedMonthEnd,
    remaining: Math.round(projectedMonthEnd - savingsTarget),
    daysLeft,
  };
}
