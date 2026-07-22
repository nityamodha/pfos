import "server-only";
import { getAccountsWithBalances } from "@/lib/queries";

export type Reminder = {
  id: string;
  accountId: string;
  kind: "due" | "statement";
  title: string;
  subtitle: string;
  date: Date;
  daysUntil: number;
  amount: number | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Next date on/after `from` that falls on `dayOfMonth` (clamped to the month's length). */
export function nextOccurrence(dayOfMonth: number, from: Date): Date {
  const base = startOfDay(from);
  for (let i = 0; i < 2; i++) {
    const y = base.getFullYear();
    const m = base.getMonth() + i;
    const year = y + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    const day = Math.min(dayOfMonth, daysInMonth(year, month));
    const candidate = new Date(year, month, day);
    if (candidate >= base) return candidate;
  }
  // Fallback (shouldn't hit): first valid day next month.
  const y = base.getFullYear();
  const m = base.getMonth() + 1;
  return new Date(y + Math.floor(m / 12), ((m % 12) + 12) % 12, dayOfMonth);
}

function diffDays(target: Date, from: Date) {
  return Math.round((startOfDay(target).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

/** Most recent date on/before `from` that falls on `dayOfMonth` (clamped to month length). */
export function previousOccurrence(dayOfMonth: number, from: Date): Date {
  const base = startOfDay(from);
  for (let i = 0; i < 2; i++) {
    const m = base.getMonth() - i;
    const year = base.getFullYear() + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    const day = Math.min(dayOfMonth, daysInMonth(year, month));
    const candidate = new Date(year, month, day);
    if (candidate <= base) return candidate;
  }
  const m = base.getMonth() - 1;
  return new Date(base.getFullYear() + Math.floor(m / 12), ((m % 12) + 12) % 12, dayOfMonth);
}

/** Upcoming statement/due reminders for statement-cycle accounts (credit cards), soonest first. */
export async function getReminders(withinDays = 30): Promise<Reminder[]> {
  const accounts = await getAccountsWithBalances();
  const now = new Date();
  const out: Reminder[] = [];

  for (const a of accounts) {
    if (!a.hasStatementCycle) continue;
    const owed = a.displayBalance; // liability display = amount owed

    if (a.dueDayOfMonth) {
      const date = nextOccurrence(a.dueDayOfMonth, now);
      const daysUntil = diffDays(date, now);
      if (daysUntil <= withinDays) {
        out.push({
          id: `${a.id}:due`,
          accountId: a.id,
          kind: "due",
          title: `${a.name} bill due`,
          subtitle: owed > 0 ? `${fmtWhen(daysUntil)}` : `${fmtWhen(daysUntil)} · no dues`,
          date,
          daysUntil,
          amount: owed > 0 ? owed : null,
        });
      }
    }

    if (a.statementDayOfMonth) {
      const date = nextOccurrence(a.statementDayOfMonth, now);
      const daysUntil = diffDays(date, now);
      if (daysUntil <= withinDays) {
        out.push({
          id: `${a.id}:statement`,
          accountId: a.id,
          kind: "statement",
          title: `${a.name} statement`,
          subtitle: `Generates ${fmtWhen(daysUntil)}`,
          date,
          daysUntil,
          amount: null,
        });
      }
    }
  }

  return out.sort((x, y) => x.daysUntil - y.daysUntil);
}

function fmtWhen(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
