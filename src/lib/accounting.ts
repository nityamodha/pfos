import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { TxnKind } from "@/generated/prisma/client";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toDecimal } from "@/lib/money";

/**
 * The engine derives SIGNED net-worth-frame ledger entries from a user-facing
 * transaction. See prisma/schema.prisma header for the sign convention.
 *
 *   INCOME       -> +amount to the destination account
 *   EXPENSE      -> -amount from the source account
 *   TRANSFER     -> -amount from source, +amount to destination (sums to 0)
 *   INVESTMENT   -> same as TRANSFER (semantic label only)
 *   WITHDRAWAL   -> same as TRANSFER (semantic label only)
 *   ADJUSTMENT   -> explicit signed delta on a single account
 */

type SignedEntry = { accountId: string; amount: Prisma.Decimal };

export type PostTransactionInput = {
  typeId: string;
  kind: TxnKind;
  amount: number; // positive magnitude
  date: Date;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  categoryId?: string | null;
  description?: string | null;
  note?: string | null;
};

function deriveEntries(kind: TxnKind, amount: Prisma.Decimal, input: PostTransactionInput): SignedEntry[] {
  const { fromAccountId, toAccountId } = input;
  switch (kind) {
    case "INCOME":
      if (!toAccountId) throw new Error("Income needs a destination account");
      return [{ accountId: toAccountId, amount }];
    case "EXPENSE":
      if (!fromAccountId) throw new Error("Expense needs a source account");
      return [{ accountId: fromAccountId, amount: amount.neg() }];
    case "TRANSFER":
    case "INVESTMENT":
    case "WITHDRAWAL":
      if (!fromAccountId || !toAccountId) throw new Error("Transfer needs both source and destination accounts");
      if (fromAccountId === toAccountId) throw new Error("Source and destination must differ");
      return [
        { accountId: fromAccountId, amount: amount.neg() },
        { accountId: toAccountId, amount },
      ];
    case "ADJUSTMENT":
      // Adjustments are posted via reconcile()/postAdjustment() with an explicit delta.
      throw new Error("Use postAdjustment() for adjustments");
    default:
      throw new Error(`Unsupported transaction kind: ${kind}`);
  }
}

/** Create a transaction and its ledger entries atomically. */
export async function postTransaction(input: PostTransactionInput) {
  const amount = toDecimal(input.amount);
  if (amount.lte(0)) throw new Error("Amount must be greater than zero");
  const entries = deriveEntries(input.kind, amount, input);

  return prisma.transaction.create({
    data: {
      userId: DEFAULT_USER_ID,
      typeId: input.typeId,
      kind: input.kind,
      date: input.date,
      amount,
      description: input.description ?? null,
      note: input.note ?? null,
      categoryId: input.categoryId ?? null,
      fromAccountId: input.fromAccountId ?? null,
      toAccountId: input.toAccountId ?? null,
      entries: {
        create: entries.map((e) => ({
          accountId: e.accountId,
          amount: e.amount,
          date: input.date,
        })),
      },
    },
    include: { entries: true },
  });
}

/** Edit a transaction: update its fields and re-derive its ledger entries atomically. */
export async function updateTransaction(input: PostTransactionInput & { id: string }) {
  const amount = toDecimal(input.amount);
  if (amount.lte(0)) throw new Error("Amount must be greater than zero");
  const entries = deriveEntries(input.kind, amount, input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findUniqueOrThrow({ where: { id: input.id } });
    if (existing.kind === "ADJUSTMENT") throw new Error("Adjustments can't be edited");
    await tx.ledgerEntry.deleteMany({ where: { transactionId: input.id } });
    return tx.transaction.update({
      where: { id: input.id },
      data: {
        typeId: input.typeId,
        kind: input.kind,
        date: input.date,
        amount,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        fromAccountId: input.fromAccountId ?? null,
        toAccountId: input.toAccountId ?? null,
        entries: {
          create: entries.map((e) => ({ accountId: e.accountId, amount: e.amount, date: input.date })),
        },
      },
      include: { entries: true },
    });
  });
}

/** Delete a user transaction (its ledger entries cascade). Adjustments are protected. */
export async function deleteTransaction(id: string) {
  const existing = await prisma.transaction.findUniqueOrThrow({ where: { id } });
  if (existing.kind === "ADJUSTMENT") throw new Error("Adjustments can't be deleted directly");
  await prisma.transaction.delete({ where: { id } });
}

/** Post a single-account adjustment with an explicit signed net-worth-frame delta. */
export async function postAdjustment(params: {
  accountId: string;
  signedDelta: Prisma.Decimal;
  date: Date;
  typeId: string;
  note?: string | null;
  description?: string | null;
  snapshotId?: string | null;
}) {
  return prisma.transaction.create({
    data: {
      userId: DEFAULT_USER_ID,
      typeId: params.typeId,
      kind: "ADJUSTMENT",
      date: params.date,
      amount: params.signedDelta.abs(),
      description: params.description ?? "Balance adjustment",
      note: params.note ?? null,
      toAccountId: params.accountId,
      snapshotId: params.snapshotId ?? null,
      entries: {
        create: [{ accountId: params.accountId, amount: params.signedDelta, date: params.date }],
      },
    },
    include: { entries: true },
  });
}

/** Current signed (net-worth-frame) balance of an account. */
export async function getSignedBalance(accountId: string): Promise<Prisma.Decimal> {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { openingBalance: true },
  });
  const agg = await prisma.ledgerEntry.aggregate({
    where: { accountId },
    _sum: { amount: true },
  });
  return account.openingBalance.plus(agg._sum.amount ?? new Prisma.Decimal(0));
}

/**
 * Reconcile an account to an actual balance the user typed in.
 * `actualDisplayBalance` is what the user sees (assets: cash; liabilities: amount owed).
 * We convert to the net-worth frame, diff against the computed balance, and post an adjustment.
 */
export async function reconcileAccount(params: {
  accountId: string;
  actualDisplayBalance: number;
  date: Date;
  adjustmentTypeId: string;
  note?: string | null;
}) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: params.accountId },
    include: { accountType: true },
  });
  const targetSigned =
    account.accountType.nature === "LIABILITY"
      ? toDecimal(-params.actualDisplayBalance)
      : toDecimal(params.actualDisplayBalance);

  const current = await getSignedBalance(params.accountId);
  const delta = targetSigned.minus(current);
  if (delta.isZero()) return null;

  return postAdjustment({
    accountId: params.accountId,
    signedDelta: delta,
    date: params.date,
    typeId: params.adjustmentTypeId,
    note: params.note ?? "Reconciliation",
    description: "Reconcile balance",
  });
}

/**
 * Record a point-in-time snapshot for an account and auto-post an adjustment so the
 * computed balance matches the target. Handles both plain reconciliation and
 * investment mark-to-market (invested vs current value).
 *
 * `targetDisplayBalance` is what the user sees (assets: cash/current value; liabilities: owed).
 */
export async function snapshotAccount(params: {
  accountId: string;
  targetDisplayBalance: number;
  date: Date;
  adjustmentTypeId: string;
  investedValue?: number | null;
  currentValue?: number | null;
  units?: number | null;
  note?: string | null;
}) {
  const account = await prisma.account.findUniqueOrThrow({
    where: { id: params.accountId },
    include: { accountType: true },
  });
  const targetSigned =
    account.accountType.nature === "LIABILITY"
      ? toDecimal(-params.targetDisplayBalance)
      : toDecimal(params.targetDisplayBalance);

  const snapshot = await prisma.snapshot.create({
    data: {
      accountId: params.accountId,
      date: params.date,
      balance: targetSigned,
      investedValue: params.investedValue == null ? null : toDecimal(params.investedValue),
      currentValue: params.currentValue == null ? null : toDecimal(params.currentValue),
      units: params.units == null ? null : toDecimal(params.units),
      note: params.note ?? null,
    },
  });

  const current = await getSignedBalance(params.accountId);
  const delta = targetSigned.minus(current);
  if (!delta.isZero()) {
    await postAdjustment({
      accountId: params.accountId,
      signedDelta: delta,
      date: params.date,
      typeId: params.adjustmentTypeId,
      note: params.note ?? "Snapshot adjustment",
      description: "Snapshot",
      snapshotId: snapshot.id,
    });
  }
  return snapshot;
}

/** Net worth = sum of every account's signed balance. */
export async function getNetWorth(): Promise<number> {
  const [opening, entries] = await Promise.all([
    prisma.account.aggregate({
      where: { userId: DEFAULT_USER_ID, isArchived: false },
      _sum: { openingBalance: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { account: { userId: DEFAULT_USER_ID, isArchived: false } },
      _sum: { amount: true },
    }),
  ]);
  const sum = (opening._sum.openingBalance ?? new Prisma.Decimal(0)).plus(
    entries._sum.amount ?? new Prisma.Decimal(0),
  );
  return sum.toNumber();
}
