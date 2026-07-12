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

  await prisma.account.update({
    where: { id },
    data: { name, accountTypeId, institution, statementDayOfMonth, dueDayOfMonth },
  });
  revalidateAll();
  revalidatePath(`/accounts/${id}`);
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
