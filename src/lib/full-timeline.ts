import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toNumber } from "@/lib/money";
import { getForecast } from "@/lib/forecast";
import type { FullTimeline, TimelinePoint } from "@/lib/full-timeline-shared";

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

type Event = { amount: number; date: number };

/**
 * Daily running-balance series from `from` to `to` (inclusive), summing a flat list
 * of already-net-worth-frame-signed events — no per-account sign flip needed, since
 * every LedgerEntry.amount (and openingBalance) is already a signed net-worth
 * contribution by construction (see prisma/schema.prisma header).
 */
function dailySeries(events: Event[], from: Date, to: Date): TimelinePoint[] {
  const sorted = [...events].sort((a, b) => a.date - b.date);
  const totalDays = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const points: TimelinePoint[] = [];
  let idx = 0;
  let running = 0;
  for (let i = 0; i <= totalDays; i++) {
    const d = addDays(from, i);
    const ms = d.getTime();
    while (idx < sorted.length && sorted[idx].date <= ms) {
      running += sorted[idx].amount;
      idx++;
    }
    points.push({ date: iso(d), label: shortFmt.format(d), value: Math.round(running), projected: false });
  }
  return points;
}

export async function getFullTimeline(): Promise<FullTimeline> {
  const today = startOfDay(new Date());

  const [accounts, entries, forecast] = await Promise.all([
    prisma.account.findMany({
      where: { userId: DEFAULT_USER_ID, isArchived: false },
      include: { accountType: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { account: { userId: DEFAULT_USER_ID, isArchived: false } },
      select: { accountId: true, amount: true, date: true },
      orderBy: { date: "asc" },
    }),
    getForecast(undefined, 90),
  ]);

  if (!forecast.hasTarget) {
    return { hasTarget: false, targetName: null, todayDate: null, cashFlow: [], netWorth: [] };
  }

  const entriesByAccount = new Map<string, Event[]>();
  const allEvents: Event[] = [];
  let earliestMs = today.getTime();

  for (const a of accounts) {
    const bucketed = a.accountType.nature === "ASSET" || a.accountType.nature === "LIABILITY";
    if (!bucketed) continue;

    const opening = toNumber(a.openingBalance);
    const openingMs = (a.openingDate ?? new Date(0)).getTime();
    const accountEvents: Event[] = [];
    if (opening !== 0) accountEvents.push({ amount: opening, date: openingMs });
    for (const e of entries) {
      if (e.accountId !== a.id) continue;
      accountEvents.push({ amount: toNumber(e.amount), date: e.date.getTime() });
    }
    accountEvents.sort((x, y) => x.date - y.date);
    if (accountEvents.length) earliestMs = Math.min(earliestMs, accountEvents[0].date);

    entriesByAccount.set(a.id, accountEvents);
    allEvents.push(...accountEvents);
  }

  const earliest = startOfDay(new Date(earliestMs));
  const targetEvents = entriesByAccount.get(forecast.targetId!) ?? [];

  // Historical halves (earliest activity → today), daily resolution throughout.
  const cashFlowHistory = dailySeries(targetEvents, earliest, today);
  const netWorthHistory = dailySeries(allEvents, earliest, today);

  // Future halves: forecast.points is already a daily series from today (i=0) to
  // +90 days for the target account. Drop its day-0 point (duplicates today, which
  // the historical half already covers) and mark the rest as projected.
  const cashFlowFuture: TimelinePoint[] = forecast.points.slice(1).map((p) => ({
    date: p.date,
    label: p.label,
    value: p.balance,
    projected: true,
  }));

  // Net worth has no general forecasting model beyond the primary account, so hold
  // every other account's contribution constant and apply only the primary
  // account's forecasted delta on top of today's actual net worth.
  const netWorthToday = netWorthHistory[netWorthHistory.length - 1]?.value ?? 0;
  const primaryToday = forecast.points[0]?.balance ?? 0;
  const netWorthFuture: TimelinePoint[] = forecast.points.slice(1).map((p) => ({
    date: p.date,
    label: p.label,
    value: netWorthToday + (p.balance - primaryToday),
    projected: true,
  }));

  return {
    hasTarget: true,
    targetName: forecast.targetName,
    todayDate: iso(today),
    cashFlow: [...cashFlowHistory, ...cashFlowFuture],
    netWorth: [...netWorthHistory, ...netWorthFuture],
  };
}
