import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { nextOccurrence, previousOccurrence } from "@/lib/reminders";
import type { CyclePoint, CycleReport } from "@/lib/cycles-shared";

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

/**
 * Reconstruct a card's last `cycleCount` statement cycles from its ledger history —
 * no cycle boundaries are stored anywhere, so this walks statement-day boundaries
 * backward (via previousOccurrence) and replays ledger entries between them, the
 * same style as trends.ts's checkpoint replay, but statement-aligned
 * instead of calendar-aligned.
 */
export async function getCardCycles(accountId: string, cycleCount = 6): Promise<CycleReport> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { openingBalance: true, statementDayOfMonth: true, dueDayOfMonth: true },
  });
  const statementDay = account.statementDayOfMonth;
  if (statementDay == null) return { accountId, cycles: [] };

  const today = startOfDay(new Date());

  // Walk backward to find cycleCount+1 statement-close boundaries (oldest to newest).
  const closes: Date[] = [previousOccurrence(statementDay, today)];
  for (let i = 0; i < cycleCount; i++) {
    const prior = addDays(closes[0], -1);
    closes.unshift(previousOccurrence(statementDay, prior));
  }

  const [priorAgg, entries] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { accountId, date: { lte: closes[0] } },
      _sum: { amount: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { accountId, date: { gt: closes[0] } },
      select: { amount: true, date: true },
      orderBy: { date: "asc" },
    }),
  ]);

  let running = toNumber(account.openingBalance) + toNumber(priorAgg._sum.amount);
  let idx = 0;
  const cycles: CyclePoint[] = [];

  for (let i = 1; i < closes.length; i++) {
    const end = closes[i];
    let charges = 0;
    let payments = 0;
    while (idx < entries.length && startOfDay(entries[idx].date) <= end) {
      const amt = toNumber(entries[idx].amount);
      running += amt;
      // Net-worth-frame convention: negative entry = balance up (a charge), positive = balance down (a payment).
      if (amt < 0) charges += -amt;
      else payments += amt;
      idx++;
    }
    const due = account.dueDayOfMonth != null ? nextOccurrence(account.dueDayOfMonth, addDays(end, 1)) : null;
    cycles.push({
      cycleLabel: shortFmt.format(end),
      closeDate: iso(end),
      dueDate: due ? iso(due) : null,
      charges: Math.round(charges),
      payments: Math.round(payments),
      closingOwed: Math.round(-running),
    });
  }

  return { accountId, cycles };
}
