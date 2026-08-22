"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toDecimal } from "@/lib/money";
import {
  postTransaction,
  snapshotAccount,
  updateTransaction as updateTransactionEntries,
  deleteTransaction as deleteTransactionRow,
} from "@/lib/accounting";
import type { TxnKind } from "@/generated/prisma/client";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

export async function updateSavingsTarget(amount: number) {
  const target = Math.max(0, Math.round(amount));
  await prisma.user.update({
    where: { id: DEFAULT_USER_ID },
    data: { monthlySavingsTarget: toDecimal(target) },
  });
  revalidatePath("/");
  revalidatePath("/settings");
}

function optionalNumber(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Parse a 1–31 day-of-month, or null. */
function dayOfMonth(v: FormDataEntryValue | null): number | null {
  const n = optionalNumber(v);
  if (n === null) return null;
  const d = Math.round(n);
  return d >= 1 && d <= 31 ? d : null;
}

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const accountTypeId = String(formData.get("accountTypeId") ?? "");
  const institution = String(formData.get("institution") ?? "").trim() || null;

  if (!name) throw new Error("Account name is required");
  if (!accountTypeId) throw new Error("Account type is required");

  const type = await prisma.accountType.findUniqueOrThrow({ where: { id: accountTypeId } });

  // Investment accounts capture invested + current value; current value is the balance that
  // counts toward net worth. Non-investment accounts just use a single opening balance.
  const investedValue = type.isInvestment ? optionalNumber(formData.get("investedValue")) : null;
  const openingDisplay = type.isInvestment
    ? optionalNumber(formData.get("currentValue")) ?? 0
    : Number(formData.get("openingBalance") ?? 0) || 0;

  // Store opening balance in the net-worth frame.
  const openingSigned = type.nature === "LIABILITY" ? -openingDisplay : openingDisplay;
  const now = new Date();

  const statementDayOfMonth = type.hasStatementCycle ? dayOfMonth(formData.get("statementDayOfMonth")) : null;
  const dueDayOfMonth = type.hasStatementCycle ? dayOfMonth(formData.get("dueDayOfMonth")) : null;

  await prisma.account.create({
    data: {
      userId: DEFAULT_USER_ID,
      name,
      accountTypeId,
      institution,
      statementDayOfMonth,
      dueDayOfMonth,
      openingBalance: toDecimal(openingSigned),
      openingDate: now,
      // For investments, record an opening snapshot so gain/loss history starts from day one.
      snapshots: type.isInvestment
        ? {
            create: [
              {
                date: now,
                balance: toDecimal(openingSigned),
                currentValue: toDecimal(openingDisplay),
                investedValue: investedValue === null ? null : toDecimal(investedValue),
              },
            ],
          }
        : undefined,
    },
  });
  revalidateAll();
}

export type ImportRow = {
  date: string; // yyyy-mm-dd
  description: string | null;
  amount: number; // signed: negative = expense, positive = income
  categoryId: string | null;
};

export type ImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

/**
 * Bulk-import transactions for a single account. Amount sign determines kind
 * (negative → EXPENSE from the account, positive → INCOME to the account) —
 * matches typical bank/card statement CSV exports. Each row is posted through
 * the same postTransaction() engine call as the manual form, one at a time
 * (not wrapped in a single all-or-nothing DB transaction) so a few malformed
 * rows don't block the rest of the batch; failures are collected and returned
 * instead of thrown.
 */
export async function importTransactions({
  accountId,
  rows,
}: {
  accountId: string;
  rows: ImportRow[];
}): Promise<ImportResult> {
  if (!accountId) throw new Error("Account is required");
  if (!rows.length) return { imported: 0, skipped: 0, errors: [] };

  const [incomeType, expenseType] = await Promise.all([
    prisma.transactionType.findFirst({ where: { userId: DEFAULT_USER_ID, kind: "INCOME" } }),
    prisma.transactionType.findFirst({ where: { userId: DEFAULT_USER_ID, kind: "EXPENSE" } }),
  ]);
  if (!incomeType) throw new Error("No Income transaction type configured");
  if (!expenseType) throw new Error("No Expense transaction type configured");

  const dates = rows.map((r) => new Date(r.date));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  // Best-effort duplicate guard: skip rows matching an existing transaction on
  // this account by (date, amount, description) — cheap single query up front
  // rather than a per-row lookup.
  const existing = await prisma.transaction.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      date: { gte: minDate, lte: maxDate },
    },
    select: { date: true, amount: true, description: true, kind: true },
  });
  const existingKeys = new Set(
    existing.map((t) => dupeKey(t.date, Number(t.amount), t.description, t.kind === "INCOME" ? 1 : -1)),
  );

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.amount) {
      skipped++;
      errors.push({ row: i, reason: "Amount is zero" });
      continue;
    }
    const sign = row.amount < 0 ? -1 : 1;
    const key = dupeKey(new Date(row.date), Math.abs(row.amount), row.description, sign);
    if (existingKeys.has(key)) {
      skipped++;
      errors.push({ row: i, reason: "Duplicate of an existing transaction" });
      continue;
    }

    try {
      await postTransaction({
        typeId: sign < 0 ? expenseType.id : incomeType.id,
        kind: sign < 0 ? "EXPENSE" : "INCOME",
        amount: Math.abs(row.amount),
        date: new Date(row.date),
        fromAccountId: sign < 0 ? accountId : null,
        toAccountId: sign > 0 ? accountId : null,
        categoryId: row.categoryId,
        description: row.description,
      });
      imported++;
      existingKeys.add(key); // guard against duplicate rows within the same file
    } catch (e) {
      skipped++;
      errors.push({ row: i, reason: e instanceof Error ? e.message : "Could not import" });
    }
  }

  if (imported > 0) revalidateAll();
  return { imported, skipped, errors };
}

function dupeKey(date: Date, amount: number, description: string | null, sign: number) {
  const day = date.toISOString().slice(0, 10);
  return `${day}|${Math.round(amount)}|${sign}|${(description ?? "").trim().toLowerCase()}`;
}

export async function createTransaction(formData: FormData) {
  const typeId = String(formData.get("typeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const dateStr = String(formData.get("date") ?? "");
  const fromAccountId = String(formData.get("fromAccountId") ?? "") || null;
  const toAccountId = String(formData.get("toAccountId") ?? "") || null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!typeId) throw new Error("Transaction type is required");
  if (!amount || amount <= 0) throw new Error("Enter an amount greater than zero");

  const type = await prisma.transactionType.findUniqueOrThrow({ where: { id: typeId } });

  await postTransaction({
    typeId,
    kind: type.kind as TxnKind,
    amount,
    date: dateStr ? new Date(dateStr) : new Date(),
    fromAccountId,
    toAccountId,
    categoryId,
    description,
  });
  revalidateAll();
}

export async function updateTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const typeId = String(formData.get("typeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const dateStr = String(formData.get("date") ?? "");
  const fromAccountId = String(formData.get("fromAccountId") ?? "") || null;
  const toAccountId = String(formData.get("toAccountId") ?? "") || null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!id) throw new Error("Transaction is required");
  if (!typeId) throw new Error("Transaction type is required");
  if (!amount || amount <= 0) throw new Error("Enter an amount greater than zero");

  const type = await prisma.transactionType.findUniqueOrThrow({ where: { id: typeId } });

  await updateTransactionEntries({
    id,
    typeId,
    kind: type.kind as TxnKind,
    amount,
    date: dateStr ? new Date(dateStr) : new Date(),
    fromAccountId,
    toAccountId,
    categoryId,
    description,
  });
  revalidateAll();
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Transaction is required");
  await deleteTransactionRow(id);
  revalidateAll();
}

/** Edit an account's name, institution, type, and (for cards) billing-cycle days. */
export async function updateAccount(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const accountTypeId = String(formData.get("accountTypeId") ?? "");
  const institution = String(formData.get("institution") ?? "").trim() || null;
  if (!id) throw new Error("Account is required");
  if (!name) throw new Error("Account name is required");
  if (!accountTypeId) throw new Error("Account type is required");

  const type = await prisma.accountType.findUniqueOrThrow({ where: { id: accountTypeId } });
  const statementDayOfMonth = type.hasStatementCycle ? dayOfMonth(formData.get("statementDayOfMonth")) : null;
  const dueDayOfMonth = type.hasStatementCycle ? dayOfMonth(formData.get("dueDayOfMonth")) : null;
  const isPrimary = formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true";
  const settlementAccountId = type.hasStatementCycle
    ? String(formData.get("settlementAccountId") ?? "") || null
    : null;

  await prisma.$transaction(async (tx) => {
    // At most one account can be the primary forecast account.
    if (isPrimary) {
      await tx.account.updateMany({
        where: { userId: DEFAULT_USER_ID, isPrimary: true, NOT: { id } },
        data: { isPrimary: false },
      });
    }
    await tx.account.update({
      where: { id },
      data: { name, accountTypeId, institution, statementDayOfMonth, dueDayOfMonth, isPrimary, settlementAccountId },
    });
  });
  revalidateAll();
  revalidatePath(`/accounts/${id}`);
}

const RULE_KINDS = new Set(["INCOME", "EXPENSE", "INVESTMENT"]);

function ruleFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const day = dayOfMonth(formData.get("dayOfMonth"));
  const fromAccountId = String(formData.get("fromAccountId") ?? "") || null;
  const toAccountId = String(formData.get("toAccountId") ?? "") || null;

  if (!name) throw new Error("Give the rule a name");
  if (!RULE_KINDS.has(kind)) throw new Error("Pick a valid type");
  if (!amount || amount <= 0) throw new Error("Enter an amount greater than zero");
  if (day === null) throw new Error("Enter the day of month (1–31)");
  // Income lands in an account; expense/investment leaves an account.
  if (kind === "INCOME" && !toAccountId) throw new Error("Pick the account the money lands in");
  if (kind !== "INCOME" && !fromAccountId) throw new Error("Pick the account the money leaves");

  return {
    name,
    kind: kind as TxnKind,
    amount: toDecimal(amount),
    dayOfMonth: day,
    frequency: "MONTHLY",
    fromAccountId: kind === "INCOME" ? null : fromAccountId,
    toAccountId: kind === "INCOME" ? toAccountId : null,
  };
}

export async function createRecurringRule(formData: FormData) {
  const data = ruleFields(formData);
  await prisma.recurringRule.create({ data: { userId: DEFAULT_USER_ID, ...data } });
  revalidateAll();
  revalidatePath("/planned");
}

export async function updateRecurringRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Rule is required");
  const data = ruleFields(formData);
  await prisma.recurringRule.update({ where: { id }, data });
  revalidateAll();
  revalidatePath("/planned");
}

export async function deleteRecurringRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Rule is required");
  await prisma.recurringRule.delete({ where: { id } });
  revalidateAll();
  revalidatePath("/planned");
}

export async function archiveAccount(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Account is required");
  await prisma.account.update({ where: { id }, data: { isArchived: true, isActive: false } });
  revalidateAll();
}

/**
 * Save a snapshot for an account. For plain accounts this reconciles the balance;
 * for investment accounts it also records invested vs current value (mark-to-market).
 * Either way an adjustment is auto-posted so the computed balance matches.
 */
export async function saveSnapshot(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "");
  const dateStr = String(formData.get("date") ?? "");
  if (!accountId) throw new Error("Account is required");

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: accountId },
    include: { accountType: true },
  });
  const adjustmentType = await prisma.transactionType.findFirst({
    where: { userId: DEFAULT_USER_ID, kind: "ADJUSTMENT" },
  });
  if (!adjustmentType) throw new Error("No Adjustment transaction type configured");

  const date = dateStr ? new Date(dateStr) : new Date();

  if (account.accountType.isInvestment) {
    const current = optionalNumber(formData.get("currentValue"));
    if (current === null) throw new Error("Enter the current value");
    const invested = optionalNumber(formData.get("investedValue"));
    await snapshotAccount({
      accountId,
      targetDisplayBalance: current,
      currentValue: current,
      investedValue: invested,
      date,
      adjustmentTypeId: adjustmentType.id,
      note: "Value update",
    });
  } else {
    const actual = optionalNumber(formData.get("actualBalance"));
    if (actual === null) throw new Error("Enter the actual balance");
    await snapshotAccount({
      accountId,
      targetDisplayBalance: actual,
      date,
      adjustmentTypeId: adjustmentType.id,
      note: "Reconciliation",
    });
  }
  revalidateAll();
  revalidatePath(`/accounts/${accountId}`);
}
