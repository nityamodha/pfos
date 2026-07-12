import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { displayBalance, toNumber } from "@/lib/money";
import type { AccountNature } from "@/generated/prisma/client";

export type AccountWithBalance = {
  id: string;
  name: string;
  institution: string | null;
  typeId: string;
  typeName: string;
  nature: AccountNature;
  icon: string | null;
  isInvestment: boolean;
  hasStatementCycle: boolean;
  statementDayOfMonth: number | null;
  dueDayOfMonth: number | null;
  displayBalance: number; // assets: cash/current value; liabilities: amount owed
  signedBalance: number; // net-worth contribution
  invested: number | null; // latest snapshot invested value (investments only)
};

/** All active accounts with their computed balances (opening + ledger sum). */
export async function getAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId: DEFAULT_USER_ID, isArchived: false },
    include: {
      accountType: true,
      snapshots: { orderBy: { date: "desc" }, take: 1, select: { investedValue: true } },
    },
    orderBy: [{ accountType: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });

  const sums = await prisma.ledgerEntry.groupBy({
    by: ["accountId"],
    where: { account: { userId: DEFAULT_USER_ID, isArchived: false } },
    _sum: { amount: true },
  });
  const sumByAccount = new Map(sums.map((s) => [s.accountId, toNumber(s._sum.amount)]));

  return accounts.map((a) => {
    const signed = toNumber(a.openingBalance) + (sumByAccount.get(a.id) ?? 0);
    const invested =
      a.accountType.isInvestment && a.snapshots[0]?.investedValue != null
        ? toNumber(a.snapshots[0].investedValue)
        : null;
    return {
      id: a.id,
      name: a.name,
      institution: a.institution,
      typeId: a.accountTypeId,
      typeName: a.accountType.name,
      nature: a.accountType.nature,
      icon: a.accountType.icon,
      isInvestment: a.accountType.isInvestment,
      hasStatementCycle: a.accountType.hasStatementCycle,
      statementDayOfMonth: a.statementDayOfMonth,
      dueDayOfMonth: a.dueDayOfMonth,
      displayBalance: displayBalance(signed, a.accountType.nature),
      signedBalance: signed,
      invested,
    };
  });
}

export type AccountDetail = {
  account: AccountWithBalance;
  history: {
    id: string;
    date: Date;
    description: string | null;
    kind: string;
    typeName: string;
    signedAmount: number; // net-worth-frame delta on this account
    otherAccountName: string | null;
  }[];
};

export async function getAccountDetail(accountId: string): Promise<AccountDetail | null> {
  const all = await getAccountsWithBalances();
  const account = all.find((a) => a.id === accountId);
  if (!account) return null;

  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId },
    include: { transaction: { include: { type: true, fromAccount: true, toAccount: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const history = entries.map((e) => {
    const t = e.transaction;
    const other = t.fromAccountId === accountId ? t.toAccount : t.fromAccount;
    return {
      id: e.id,
      date: e.date,
      description: t.description,
      kind: t.kind,
      typeName: t.type.name,
      signedAmount: toNumber(e.amount),
      otherAccountName: other?.name ?? null,
    };
  });

  return { account, history };
}

export type DashboardData = {
  netWorth: number;
  assets: number;
  liabilities: number;
  monthChange: number;
  byType: { typeId: string; typeName: string; nature: AccountNature; total: number }[];
  accounts: AccountWithBalance[];
};

export async function getDashboard(): Promise<DashboardData> {
  const accounts = await getAccountsWithBalances();

  // Net-worth change this month = sum of this month's ledger entries (each is a signed NW delta).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthAgg = await prisma.ledgerEntry.aggregate({
    where: { account: { userId: DEFAULT_USER_ID, isArchived: false }, date: { gte: monthStart } },
    _sum: { amount: true },
  });
  const monthChange = toNumber(monthAgg._sum.amount);

  let assets = 0;
  let liabilities = 0;
  const typeMap = new Map<string, { typeId: string; typeName: string; nature: AccountNature; total: number }>();

  for (const a of accounts) {
    if (a.nature === "LIABILITY") liabilities += a.displayBalance;
    else assets += a.signedBalance;

    const cur = typeMap.get(a.typeId) ?? { typeId: a.typeId, typeName: a.typeName, nature: a.nature, total: 0 };
    cur.total += a.displayBalance;
    typeMap.set(a.typeId, cur);
  }

  return {
    netWorth: assets - liabilities,
    assets,
    liabilities,
    monthChange,
    byType: [...typeMap.values()].filter((t) => t.total !== 0),
    accounts,
  };
}

/** Master data for pickers. */
export async function getMasterData() {
  const [accountTypes, categories, txnTypes] = await Promise.all([
    prisma.accountType.findMany({ where: { userId: DEFAULT_USER_ID }, orderBy: { sortOrder: "asc" } }),
    prisma.category.findMany({ where: { userId: DEFAULT_USER_ID }, orderBy: { sortOrder: "asc" } }),
    prisma.transactionType.findMany({ where: { userId: DEFAULT_USER_ID }, orderBy: { sortOrder: "asc" } }),
  ]);
  return { accountTypes, categories, txnTypes };
}

export type TransactionListItem = {
  id: string;
  date: Date;
  kind: string;
  typeId: string;
  typeName: string;
  amount: number;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  fromAccountId: string | null;
  fromAccountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
};

export async function getRecentTransactions(limit = 50): Promise<TransactionListItem[]> {
  const txns = await prisma.transaction.findMany({
    where: { userId: DEFAULT_USER_ID },
    include: { type: true, category: true, fromAccount: true, toAccount: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return txns.map((t) => ({
    id: t.id,
    date: t.date,
    kind: t.kind,
    typeId: t.typeId,
    typeName: t.type.name,
    amount: toNumber(t.amount),
    description: t.description,
    categoryId: t.categoryId,
    categoryName: t.category?.name ?? null,
    fromAccountId: t.fromAccountId,
    fromAccountName: t.fromAccount?.name ?? null,
    toAccountId: t.toAccountId,
    toAccountName: t.toAccount?.name ?? null,
  }));
}
