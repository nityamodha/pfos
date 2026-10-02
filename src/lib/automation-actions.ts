"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { postTransaction } from "@/lib/accounting";
import { syncGmailFinancialEmails } from "@/lib/gmail";
import { toDecimal, toNumber } from "@/lib/money";
import type { TxnKind } from "@/generated/prisma/client";

const REVIEWABLE_STATUSES = new Set(["PENDING", "NEEDS_REVIEW"]);
const APPROVABLE_KINDS = new Set<TxnKind>(["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);
const NEEDS_FROM = new Set<TxnKind>(["EXPENSE", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);
const NEEDS_TO = new Set<TxnKind>(["INCOME", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);

function revalidateAutomation() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/automation");
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 30, 0, 0);
  return d;
}

async function getOrCreateDemoSource() {
  const existing = await prisma.automationSource.findFirst({
    where: { userId: DEFAULT_USER_ID, kind: "GMAIL", externalAccountId: "demo-gmail" },
  });
  if (existing) return existing;

  return prisma.automationSource.create({
    data: {
      userId: DEFAULT_USER_ID,
      kind: "GMAIL",
      name: "Demo Gmail",
      externalAccountId: "demo-gmail",
    },
  });
}

async function categoryId(name: string) {
  const category = await prisma.category.findFirst({
    where: { userId: DEFAULT_USER_ID, name },
    select: { id: true },
  });
  return category?.id ?? null;
}

/**
 * Creates safe sample Gmail-derived proposals so the Automation Inbox flow can be
 * built and tested before a real Gmail connection is wired in.
 */
export async function createDemoAutomationProposals() {
  const [source, accounts, subscriptionsId, shoppingId, salaryId] = await Promise.all([
    getOrCreateDemoSource(),
    prisma.account.findMany({
      where: { userId: DEFAULT_USER_ID, isArchived: false },
      include: { accountType: true },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    categoryId("Subscriptions"),
    categoryId("Shopping"),
    categoryId("Salary"),
  ]);

  const cashAccount = accounts.find((a) => a.accountType.nature === "ASSET" && !a.accountType.isInvestment);
  const cardAccount = accounts.find((a) => a.accountType.nature === "LIABILITY") ?? cashAccount;
  if (!cashAccount || !cardAccount) {
    throw new Error("Add at least one cash or card account before creating automation proposals");
  }

  const samples = [
    {
      messageId: "demo-gmail-netflix-799",
      from: "alerts@bank.example",
      subject: "Card transaction alert: Netflix",
      snippet: "INR 799 spent on your card at NETFLIX.COM.",
      receivedAt: daysAgo(1),
      kind: "EXPENSE" as TxnKind,
      amount: 799,
      description: "Netflix subscription",
      merchantName: "Netflix",
      categoryId: subscriptionsId,
      fromAccountId: cardAccount.id,
      toAccountId: null,
      confidence: 0.91,
      extractionNotes: "Demo extraction from a card spend alert.",
    },
    {
      messageId: "demo-gmail-amazon-2499",
      from: "alerts@bank.example",
      subject: "Debit card transaction at Amazon",
      snippet: "You spent INR 2,499 at AMAZON using your account.",
      receivedAt: daysAgo(2),
      kind: "EXPENSE" as TxnKind,
      amount: 2499,
      description: "Amazon purchase",
      merchantName: "Amazon",
      categoryId: shoppingId,
      fromAccountId: cashAccount.id,
      toAccountId: null,
      confidence: 0.86,
      extractionNotes: "Demo extraction from a bank debit alert.",
    },
    {
      messageId: "demo-gmail-salary-85000",
      from: "payroll@example.com",
      subject: "Salary credited",
      snippet: "Salary of INR 85,000 has been credited to your account.",
      receivedAt: daysAgo(5),
      kind: "INCOME" as TxnKind,
      amount: 85000,
      description: "Salary credited",
      merchantName: "Payroll",
      categoryId: salaryId,
      fromAccountId: null,
      toAccountId: cashAccount.id,
      confidence: 0.94,
      extractionNotes: "Demo extraction from a salary credit email.",
    },
  ];

  let created = 0;
  for (const sample of samples) {
    const email = await prisma.rawFinancialEmail.upsert({
      where: { sourceId_externalMessageId: { sourceId: source.id, externalMessageId: sample.messageId } },
      update: {
        from: sample.from,
        subject: sample.subject,
        snippet: sample.snippet,
        receivedAt: sample.receivedAt,
      },
      create: {
        userId: DEFAULT_USER_ID,
        sourceId: source.id,
        externalMessageId: sample.messageId,
        from: sample.from,
        subject: sample.subject,
        snippet: sample.snippet,
        receivedAt: sample.receivedAt,
        rawMetadata: { demo: true },
      },
    });

    const existing = await prisma.transactionProposal.findFirst({
      where: { userId: DEFAULT_USER_ID, rawEmailId: email.id },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.transactionProposal.create({
      data: {
        userId: DEFAULT_USER_ID,
        rawEmailId: email.id,
        kind: sample.kind,
        date: sample.receivedAt,
        amount: toDecimal(sample.amount),
        description: sample.description,
        categoryId: sample.categoryId,
        fromAccountId: sample.fromAccountId,
        toAccountId: sample.toAccountId,
        merchantName: sample.merchantName,
        referenceText: sample.messageId,
        confidence: toDecimal(sample.confidence),
        extractionNotes: sample.extractionNotes,
        extractedPayload: { demo: true, snippet: sample.snippet },
      },
    });
    created++;
  }

  revalidatePath("/automation");
  return { created };
}

export async function syncGmailAutomationInbox() {
  const result = await syncGmailFinancialEmails();
  revalidateAutomation();
  return result;
}

export async function approveTransactionProposal(proposalId: string) {
  if (!proposalId) throw new Error("Proposal is required");

  const result = await prisma.$transaction(async (tx) => {
    const proposal = await tx.transactionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      include: { rawEmail: true },
    });

    if (proposal.userId !== DEFAULT_USER_ID) throw new Error("Proposal does not belong to this user");
    if (!REVIEWABLE_STATUSES.has(proposal.status)) throw new Error("Only pending proposals can be approved");
    if (!APPROVABLE_KINDS.has(proposal.kind)) throw new Error(`Proposal kind ${proposal.kind} cannot be approved`);

    const type = await tx.transactionType.findFirst({
      where: { userId: DEFAULT_USER_ID, kind: proposal.kind },
    });
    if (!type) throw new Error(`No ${proposal.kind.toLowerCase()} transaction type configured`);

    const transaction = await postTransaction(
      {
        typeId: type.id,
        kind: proposal.kind,
        amount: toNumber(proposal.amount),
        date: proposal.date,
        fromAccountId: proposal.fromAccountId,
        toAccountId: proposal.toAccountId,
        categoryId: proposal.categoryId,
        description: proposal.description ?? proposal.merchantName,
        note: proposal.extractionNotes,
      },
      tx,
    );

    const reviewedAt = new Date();
    await tx.transactionProposal.update({
      where: { id: proposal.id },
      data: {
        status: "APPROVED",
        approvedTransactionId: transaction.id,
        reviewedAt,
      },
    });

    if (proposal.rawEmailId) {
      await tx.rawFinancialEmail.update({
        where: { id: proposal.rawEmailId },
        data: { processingStatus: "PROCESSED", processingError: null },
      });
    }

    return { proposalId: proposal.id, transactionId: transaction.id };
  });

  revalidateAutomation();
  return result;
}

export async function updateTransactionProposal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const typeId = String(formData.get("typeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const dateStr = String(formData.get("date") ?? "");
  const fromAccountId = String(formData.get("fromAccountId") ?? "") || null;
  const toAccountId = String(formData.get("toAccountId") ?? "") || null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const merchantName = String(formData.get("merchantName") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!id) throw new Error("Proposal is required");
  if (!typeId) throw new Error("Type is required");
  if (!amount || amount <= 0) throw new Error("Enter an amount greater than zero");
  if (!dateStr) throw new Error("Date is required");

  const type = await prisma.transactionType.findUniqueOrThrow({ where: { id: typeId } });
  const kind = type.kind as TxnKind;
  if (!APPROVABLE_KINDS.has(kind)) throw new Error(`Proposal kind ${kind} cannot be posted`);
  if (NEEDS_FROM.has(kind) && !fromAccountId) throw new Error("Pick the source account");
  if (NEEDS_TO.has(kind) && !toAccountId) throw new Error("Pick the destination account");
  if (fromAccountId && toAccountId && fromAccountId === toAccountId) {
    throw new Error("Source and destination must differ");
  }

  const result = await prisma.transactionProposal.updateMany({
    where: {
      id,
      userId: DEFAULT_USER_ID,
      status: { in: ["PENDING", "NEEDS_REVIEW"] },
    },
    data: {
      kind,
      amount: toDecimal(amount),
      date: new Date(dateStr + "T00:00:00"),
      fromAccountId: NEEDS_FROM.has(kind) ? fromAccountId : null,
      toAccountId: NEEDS_TO.has(kind) ? toAccountId : null,
      categoryId,
      description,
      merchantName,
      note,
      status: "PENDING",
    },
  });

  if (result.count === 0) throw new Error("Only pending proposals can be edited");
  revalidatePath("/automation");
}

export async function reopenTransactionProposal(proposalId: string) {
  if (!proposalId) throw new Error("Proposal is required");

  await prisma.$transaction(async (tx) => {
    const proposal = await tx.transactionProposal.findUniqueOrThrow({
      where: { id: proposalId },
      select: {
        id: true,
        userId: true,
        status: true,
        rawEmailId: true,
        approvedTransactionId: true,
      },
    });

    if (proposal.userId !== DEFAULT_USER_ID) throw new Error("Proposal does not belong to this user");
    if (REVIEWABLE_STATUSES.has(proposal.status)) throw new Error("Proposal is already open");

    if (proposal.approvedTransactionId) {
      await tx.transaction.delete({ where: { id: proposal.approvedTransactionId } });
    }

    await tx.transactionProposal.update({
      where: { id: proposal.id },
      data: {
        status: "PENDING",
        approvedTransactionId: null,
        reviewedAt: null,
      },
    });

    if (proposal.rawEmailId) {
      await tx.rawFinancialEmail.update({
        where: { id: proposal.rawEmailId },
        data: { processingStatus: "PENDING", processingError: null },
      });
    }
  });

  revalidateAutomation();
}

export async function rejectTransactionProposal(proposalId: string) {
  if (!proposalId) throw new Error("Proposal is required");

  const result = await prisma.transactionProposal.updateMany({
    where: { id: proposalId, userId: DEFAULT_USER_ID },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Proposal not found");
  revalidateAutomation();
}

export async function markTransactionProposalDuplicate(proposalId: string) {
  if (!proposalId) throw new Error("Proposal is required");

  const result = await prisma.transactionProposal.updateMany({
    where: { id: proposalId, userId: DEFAULT_USER_ID },
    data: { status: "DUPLICATE", reviewedAt: new Date() },
  });
  if (result.count === 0) throw new Error("Proposal not found");
  revalidateAutomation();
}
