import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toNumber } from "@/lib/money";
import { getAccountsWithBalances, type AccountWithBalance } from "@/lib/queries";
import { nextOccurrence, previousOccurrence } from "@/lib/reminders";
import type {
  Forecast,
  ForecastCard,
  ForecastEvent,
  ForecastEventKind,
  ForecastPoint,
} from "@/lib/forecast-shared";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function iso(d: Date) {
  const x = startOfDay(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
const shortFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function ruleKind(kind: string, isInflow: boolean): ForecastEventKind {
  if (kind === "INCOME") return "salary";
  if (kind === "INVESTMENT") return "sip";
  if (kind === "EXPENSE") return "emi";
  return isInflow ? "income" : "expense";
}

/** Compute the due date a charge made *today* on this card would settle on. */
function unbilledDueDate(statementDay: number | null, dueDay: number, today: Date): Date {
  if (statementDay == null) {
    // No statement boundary known: assume it rolls to the due date after the next one.
    const firstDue = nextOccurrence(dueDay, today);
    return nextOccurrence(dueDay, addDays(firstDue, 1));
  }
  const nextStatement = nextOccurrence(statementDay, addDays(today, 1));
  return nextOccurrence(dueDay, addDays(nextStatement, 1));
}

export async function getForecast(accountId?: string, days = 90): Promise<Forecast> {
  const accounts = await getAccountsWithBalances();
  const today = startOfDay(new Date());
  const end = addDays(today, days);

  // Resolve the target account: explicit → primary → highest-balance cash account.
  const cashAccounts = accounts.filter((a) => a.nature === "ASSET" && !a.isInvestment);
  const target =
    (accountId ? accounts.find((a) => a.id === accountId) : undefined) ??
    accounts.find((a) => a.isPrimary) ??
    [...cashAccounts].sort((a, b) => b.displayBalance - a.displayBalance)[0];

  const cardAccounts = accounts.filter((a) => a.hasStatementCycle && a.dueDayOfMonth != null);

  // Per-card metadata for the what-if simulator (independent of who the target is).
  const cards: ForecastCard[] = cardAccounts.map((c) => {
    const due = unbilledDueDate(c.statementDayOfMonth, c.dueDayOfMonth!, today);
    return {
      id: c.id,
      name: c.name,
      owed: c.displayBalance,
      settlesToTarget: !!target && c.settlementAccountId === target.id,
      unbilledDueDate: iso(due),
      unbilledDueLabel: shortFmt.format(due),
    };
  });

  if (!target) {
    return {
      hasTarget: false,
      targetId: null,
      targetName: null,
      startBalance: 0,
      endBalance: 0,
      lowPoint: null,
      goesNegative: false,
      days,
      points: [],
      events: [],
      cards,
    };
  }

  const events: ForecastEvent[] = [];

  // 1) Recurring rules that flow into or out of the target account.
  const rules = await prisma.recurringRule.findMany({
    where: { userId: DEFAULT_USER_ID, isActive: true },
  });
  for (const r of rules) {
    if (r.dayOfMonth == null) continue;
    const isInflow = r.toAccountId === target.id;
    const isOutflow = r.fromAccountId === target.id;
    if (!isInflow && !isOutflow) continue;
    const amount = toNumber(r.amount) * (isInflow ? 1 : -1);
    let d = nextOccurrence(r.dayOfMonth, today);
    let guard = 0;
    while (d <= end && guard++ < 60) {
      events.push({
        id: `${r.id}:${iso(d)}`,
        date: iso(d),
        label: r.name,
        amount,
        kind: ruleKind(r.kind, isInflow),
      });
      d = nextOccurrence(r.dayOfMonth, addDays(d, 1));
    }
  }

  // 2) Credit-card bill settlements that debit the target account.
  const settlingCards = cardAccounts.filter((c) => c.settlementAccountId === target.id);
  if (settlingCards.length) {
    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId: { in: settlingCards.map((c) => c.id) } },
      select: { accountId: true, amount: true, date: true },
    });

    for (const c of settlingCards) {
      const owed = c.displayBalance;
      if (owed <= 0) continue;
      const cutoff =
        c.statementDayOfMonth != null ? previousOccurrence(c.statementDayOfMonth, today) : null;
      if (!cutoff) continue;

      // Bucket not-yet-billed charges by the statement cycle each one actually
      // closes under (a purchase dated further out than the very next statement
      // — e.g. a post-dated entry — settles on a later cycle, not the next one).
      const byClose = new Map<string, number>();
      for (const e of entries) {
        if (e.accountId !== c.id) continue;
        const d = startOfDay(e.date);
        if (d <= cutoff) continue;
        const close = nextOccurrence(c.statementDayOfMonth!, d);
        const key = iso(close);
        byClose.set(key, Math.max(0, (byClose.get(key) ?? 0) - toNumber(e.amount)));
      }

      const rawTotal = [...byClose.values()].reduce((s, v) => s + v, 0);
      const totalUnbilled = Math.max(0, Math.min(owed, Math.round(rawTotal)));
      const scale = rawTotal > 0 ? totalUnbilled / rawTotal : 0;
      const billed = owed - totalUnbilled;

      if (billed > 0) {
        const due = nextOccurrence(c.dueDayOfMonth!, today);
        if (due <= end)
          events.push({ id: `${c.id}:billed`, date: iso(due), label: `${c.name} bill`, amount: -billed, kind: "bill" });
      }

      for (const [closeKey, rawAmount] of [...byClose.entries()].sort()) {
        const amount = Math.round(rawAmount * scale);
        if (amount <= 0) continue;
        const due = nextOccurrence(c.dueDayOfMonth!, addDays(new Date(closeKey), 1));
        if (due <= end)
          events.push({
            id: `${c.id}:unbilled:${closeKey}`,
            date: iso(due),
            label: `${c.name} bill`,
            amount: -amount,
            kind: "bill",
          });
      }
    }
  }

  // 3) Walk day-by-day, applying the net delta on each date.
  const deltaByDate = new Map<string, number>();
  for (const e of events) deltaByDate.set(e.date, (deltaByDate.get(e.date) ?? 0) + e.amount);

  const points: ForecastPoint[] = [];
  let balance = target.displayBalance;
  let lowPoint = { date: iso(today), label: shortFmt.format(today), balance };
  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i);
    const key = iso(d);
    balance += deltaByDate.get(key) ?? 0;
    const label = shortFmt.format(d);
    points.push({ date: key, label, balance: Math.round(balance) });
    if (balance < lowPoint.balance) lowPoint = { date: key, label, balance: Math.round(balance) };
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    hasTarget: true,
    targetId: target.id,
    targetName: target.name,
    startBalance: Math.round(target.displayBalance),
    endBalance: points.length ? points[points.length - 1].balance : Math.round(target.displayBalance),
    lowPoint,
    goesNegative: lowPoint.balance < 0,
    days,
    points,
    events,
    cards,
  };
}

export type { AccountWithBalance };
