import "server-only";

import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toNumber } from "@/lib/money";

export type AutomationProposalItem = {
  id: string;
  status: string;
  kind: string;
  date: string;
  amount: number;
  description: string | null;
  note: string | null;
  merchantName: string | null;
  confidence: number | null;
  extractionNotes: string | null;
  categoryId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  rawEmail: {
    from: string | null;
    subject: string | null;
    snippet: string | null;
    receivedAt: string;
  } | null;
  category: { id: string; name: string } | null;
  fromAccount: { id: string; name: string } | null;
  toAccount: { id: string; name: string } | null;
  approvedTransactionId: string | null;
};

export type GmailConnectionStatus = {
  configured: boolean;
  connected: boolean;
  name: string | null;
  email: string | null;
  lastSyncedAt: string | null;
};

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function getAutomationProposals(): Promise<AutomationProposalItem[]> {
  const proposals = await prisma.transactionProposal.findMany({
    where: { userId: DEFAULT_USER_ID },
    include: {
      rawEmail: true,
      category: { select: { id: true, name: true } },
      fromAccount: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return proposals.map((p) => ({
    id: p.id,
    status: p.status,
    kind: p.kind,
    date: isoDate(p.date),
    amount: toNumber(p.amount),
    description: p.description,
    note: p.note,
    merchantName: p.merchantName,
    confidence: p.confidence == null ? null : toNumber(p.confidence),
    extractionNotes: p.extractionNotes,
    categoryId: p.categoryId,
    fromAccountId: p.fromAccountId,
    toAccountId: p.toAccountId,
    rawEmail: p.rawEmail
      ? {
          from: p.rawEmail.from,
          subject: p.rawEmail.subject,
          snippet: p.rawEmail.snippet,
          receivedAt: p.rawEmail.receivedAt.toISOString(),
        }
      : null,
    category: p.category,
    fromAccount: p.fromAccount,
    toAccount: p.toAccount,
    approvedTransactionId: p.approvedTransactionId,
  }));
}

export async function getAutomationProposalCounts() {
  const counts = await prisma.transactionProposal.groupBy({
    by: ["status"],
    where: { userId: DEFAULT_USER_ID },
    _count: { status: true },
  });
  return Object.fromEntries(counts.map((c) => [c.status, c._count.status]));
}

export async function getGmailConnectionStatus(): Promise<GmailConnectionStatus> {
  const source = await prisma.automationSource.findFirst({
    where: {
      userId: DEFAULT_USER_ID,
      kind: "GMAIL",
      isActive: true,
      NOT: { externalAccountId: "demo-gmail" },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    configured: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
    connected: !!source,
    name: source?.name ?? null,
    email: source?.externalAccountId ?? null,
    lastSyncedAt: source?.lastSyncedAt?.toISOString() ?? null,
  };
}
