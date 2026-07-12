import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toNumber } from "@/lib/money";
import { RANGE_KEYS, type RangeKey, type TrendPoint, type TrendGroup, type Trends } from "@/lib/trends-shared";

export type { RangeKey, TrendPoint, TrendGroup, Trends };
export { RANGE_KEYS, RANGE_LABELS } from "@/lib/trends-shared";

type Bucket = "savings" | "investments" | "liabilities";

function bucketFor(nature: string, isInvestment: boolean): Bucket | null {
  if (nature === "LIABILITY") return "liabilities";
  if (isInvestment) return "investments";
  if (nature === "ASSET") return "savings";
  return null;
}

/** An account's balance history as a sorted list of signed net-worth-frame events. */
type Event = { amount: number; date: number };

/**
 * Build the checkpoint dates (period ends) + labels for a range.
 * Granularity adapts to the window: daily for a month, weekly for a quarter,
 * monthly for a year / all-time.
 */
function buildCheckpoints(range: RangeKey, earliest: Date): { date: Date; label: string }[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const dayFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
  const out: { date: Date; label: string }[] = [];

  const endOfDay = (d: Date) => {
    d.setHours(23, 59, 59, 999);
    return d;
  };

  if (range === "1M") {
    for (let k = 29; k >= 0; k--) {
      const d = new Date(today);
      d.setDate(today.getDate() - k);
      out.push({ date: endOfDay(d), label: dayFmt.format(d) });
    }
    return out;
  }

  if (range === "3M") {
    for (let k = 12; k >= 0; k--) {
      const d = new Date(today);
      d.setDate(today.getDate() - k * 7);
      out.push({ date: endOfDay(d), label: dayFmt.format(d) });
    }
    return out;
  }

  // Monthly buckets for 1Y / ALL.
  const monthEnd = (yearsBackMonths: number) => {
    const d = new Date(today.getFullYear(), today.getMonth() - yearsBackMonths + 1, 0, 23, 59, 59, 999);
    return d > today ? today : d;
  };

  if (range === "1Y") {
    const moFmt = new Intl.DateTimeFormat("en-IN", { month: "short" });
    for (let k = 11; k >= 0; k--) {
      const d = monthEnd(k);
      out.push({ date: d, label: moFmt.format(d) });
    }
    return out;
  }

  // ALL: from one month before the earliest activity (a zero baseline) to now.
  const start = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const span = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  const multiYear = start.getFullYear() !== today.getFullYear();
  const moFmt = new Intl.DateTimeFormat("en-IN", multiYear ? { month: "short", year: "2-digit" } : { month: "short" });
  for (let k = span + 1; k >= 0; k--) {
    const d = monthEnd(k);
    out.push({ date: d, label: moFmt.format(d) });
  }
  return out;
}

/** Running-balance value per account at each checkpoint, plus the total. */
function seriesForCheckpoints(
  checkpoints: { date: Date; label: string }[],
  accounts: { id: string; events: Event[]; liability: boolean }[],
): TrendPoint[] {
  const points: TrendPoint[] = checkpoints.map((c) => ({ label: c.label }));
  for (const a of accounts) {
    let idx = 0;
    let running = 0;
    checkpoints.forEach((cp, ci) => {
      const cpMs = cp.date.getTime();
      while (idx < a.events.length && a.events[idx].date <= cpMs) {
        running += a.events[idx].amount;
        idx++;
      }
      // Liabilities are shown as a positive amount owed.
      points[ci][a.id] = Math.round(a.liability ? -running : running);
    });
  }
  // Totals per checkpoint.
  const ids = accounts.map((a) => a.id);
  points.forEach((p) => {
    p.total = ids.reduce((s, id) => s + ((p[id] as number) ?? 0), 0);
  });
  return points;
}

export async function getTrends(): Promise<Trends> {
  const accounts = await prisma.account.findMany({
    where: { userId: DEFAULT_USER_ID, isArchived: false },
    include: { accountType: true },
    orderBy: [{ accountType: { sortOrder: "asc" } }, { name: "asc" }],
  });

  const entries = await prisma.ledgerEntry.findMany({
    where: { account: { userId: DEFAULT_USER_ID, isArchived: false } },
    select: { accountId: true, amount: true, date: true },
    orderBy: { date: "asc" },
  });

  const entriesByAccount = new Map<string, Event[]>();
  for (const e of entries) {
    const arr = entriesByAccount.get(e.accountId) ?? [];
    arr.push({ amount: toNumber(e.amount), date: e.date.getTime() });
    entriesByAccount.set(e.accountId, arr);
  }

  // Per-account event streams. The opening balance is treated as an event on the
  // account's opening date — not as always-having-existed — so accounts funded via
  // an opening balance and via a ledger entry behave identically on the timeline.
  type AccInfo = { id: string; name: string; bucket: Bucket; events: Event[]; liability: boolean };
  const infos: AccInfo[] = [];
  let earliestMs = Date.now();

  for (const a of accounts) {
    const bucket = bucketFor(a.accountType.nature, a.accountType.isInvestment);
    if (!bucket) continue;
    const opening = toNumber(a.openingBalance);
    const openingMs = (a.openingDate ?? new Date(0)).getTime();
    const events: Event[] = [];
    if (opening !== 0) events.push({ amount: opening, date: openingMs });
    events.push(...(entriesByAccount.get(a.id) ?? []));
    events.sort((x, y) => x.date - y.date);
    if (events.length) earliestMs = Math.min(earliestMs, events[0].date);
    infos.push({
      id: a.id,
      name: a.name,
      bucket,
      events,
      liability: a.accountType.nature === "LIABILITY",
    });
  }

  const earliest = new Date(earliestMs);

  const groups: Record<Bucket, TrendGroup> = {
    savings: { accounts: [], series: emptySeries(), latestTotal: 0 },
    investments: { accounts: [], series: emptySeries(), latestTotal: 0 },
    liabilities: { accounts: [], series: emptySeries(), latestTotal: 0 },
  };

  for (const bucket of ["savings", "investments", "liabilities"] as Bucket[]) {
    const members = infos.filter((i) => i.bucket === bucket);
    groups[bucket].accounts = members.map((m) => ({ id: m.id, name: m.name }));
    const memberSeriesInput = members.map((m) => ({ id: m.id, events: m.events, liability: m.liability }));

    for (const range of RANGE_KEYS) {
      const cps = buildCheckpoints(range, earliest);
      groups[bucket].series[range] = seriesForCheckpoints(cps, memberSeriesInput);
    }
    const yearPoints = groups[bucket].series["1Y"];
    groups[bucket].latestTotal = yearPoints.length ? (yearPoints[yearPoints.length - 1].total as number) : 0;
  }

  return groups;
}

function emptySeries(): Record<RangeKey, TrendPoint[]> {
  return { "1M": [], "3M": [], "1Y": [], ALL: [] };
}
