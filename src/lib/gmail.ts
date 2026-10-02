import "server-only";

import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { toDecimal } from "@/lib/money";
import type { Account, AccountType, AutomationSource, Category, TxnKind } from "@/generated/prisma/client";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const FINANCIAL_QUERY = "newer_than:30d (INR OR Rs OR transaction OR credited OR debited OR spent OR UPI OR paid)";

type GmailTokenMetadata = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  scope?: string;
  token_type?: string;
  textBody?: string;
};

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

type AccountWithType = Account & { accountType: AccountType };

export function getGmailEnv() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

export function getGmailRedirectUri(origin: string) {
  return process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_URL ?? origin}/api/gmail/callback`;
}

export function buildGmailAuthUrl({ state, redirectUri }: { state: string; redirectUri: string }) {
  const { clientId } = getGmailEnv();
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");

  const url = new URL(GMAIL_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url;
}

export function newOAuthState() {
  return crypto.randomBytes(24).toString("hex");
}

function metadata(source: Pick<AutomationSource, "rawMetadata">): GmailTokenMetadata {
  return typeof source.rawMetadata === "object" && source.rawMetadata !== null
    ? (source.rawMetadata as GmailTokenMetadata)
    : {};
}

async function exchangeToken(body: URLSearchParams) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as GmailTokenMetadata & { error?: string; error_description?: string; expires_in?: number };
  if (!response.ok) {
    throw new Error(json.error_description ?? json.error ?? "Google token exchange failed");
  }
  return json;
}

export async function exchangeGmailCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getGmailEnv();
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");

  return exchangeToken(
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  );
}

async function refreshGmailAccessToken(source: AutomationSource) {
  const { clientId, clientSecret } = getGmailEnv();
  const meta = metadata(source);
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  if (!meta.refresh_token) throw new Error("Gmail refresh token is missing. Reconnect Gmail.");

  const token = await exchangeToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: meta.refresh_token,
      grant_type: "refresh_token",
    }),
  );

  const nextMeta = {
    ...meta,
    access_token: token.access_token,
    expires_at: Date.now() + ((token.expires_in ?? 3600) - 60) * 1000,
    scope: token.scope ?? meta.scope,
    token_type: token.token_type ?? meta.token_type,
  };

  await prisma.automationSource.update({
    where: { id: source.id },
    data: { rawMetadata: nextMeta },
  });

  return nextMeta.access_token!;
}

export async function upsertGmailSourceFromCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const token = await exchangeGmailCode({ code, redirectUri });
  if (!token.access_token) throw new Error("Google did not return an access token");

  const profile = await gmailFetch<{ emailAddress?: string }>(token.access_token, "/profile");
  const emailAddress = profile.emailAddress ?? "me";

  await prisma.automationSource.upsert({
    where: {
      userId_kind_externalAccountId: {
        userId: DEFAULT_USER_ID,
        kind: "GMAIL",
        externalAccountId: emailAddress,
      },
    },
    update: {
      name: `Gmail: ${emailAddress}`,
      isActive: true,
      rawMetadata: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: Date.now() + ((token.expires_in ?? 3600) - 60) * 1000,
        scope: token.scope,
        token_type: token.token_type,
      },
    },
    create: {
      userId: DEFAULT_USER_ID,
      kind: "GMAIL",
      name: `Gmail: ${emailAddress}`,
      externalAccountId: emailAddress,
      rawMetadata: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: Date.now() + ((token.expires_in ?? 3600) - 60) * 1000,
        scope: token.scope,
        token_type: token.token_type,
      },
    },
  });
}

async function getConnectedGmailSource() {
  return prisma.automationSource.findFirst({
    where: {
      userId: DEFAULT_USER_ID,
      kind: "GMAIL",
      isActive: true,
      NOT: { externalAccountId: "demo-gmail" },
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function validAccessToken(source: AutomationSource) {
  const meta = metadata(source);
  if (meta.access_token && meta.expires_at && meta.expires_at > Date.now() + 60_000) {
    return meta.access_token;
  }
  return refreshGmailAccessToken(source);
}

async function gmailFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(json.error?.message ?? "Gmail API request failed");
  }
  return json;
}

function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function textFromPart(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  }
  return part.parts?.map(textFromPart).filter(Boolean).join("\n") ?? "";
}

function messageDate(message: GmailMessage) {
  const internal = message.internalDate ? Number(message.internalDate) : NaN;
  return Number.isFinite(internal) ? new Date(internal) : new Date();
}

function firstAmount(text: string) {
  const match = text.match(/(?:INR|Rs\.?|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function merchantFrom(text: string) {
  const compact = text.replace(/\s+/g, " ");
  const match = compact.match(/\b(?:at|to|from|merchant)\s+([A-Z0-9][A-Z0-9 .&_-]{2,40})/i);
  if (!match) return null;
  return match[1].replace(/\b(?:using|on|for|with|has|was)\b.*$/i, "").trim() || null;
}

function inferKind(text: string): TxnKind | null {
  const lower = text.toLowerCase();
  if (/\b(salary|credited|credit|received|refund)\b/.test(lower)) return "INCOME";
  if (/\b(spent|debited|debit|paid|purchase|transaction|withdrawn)\b/.test(lower)) return "EXPENSE";
  return null;
}

function categoryFor(categories: Category[], kind: TxnKind, merchant: string | null, text: string) {
  const haystack = `${merchant ?? ""} ${text}`.toLowerCase();
  const wanted =
    kind === "INCOME"
      ? "Salary"
      : /netflix|spotify|prime|subscription/.test(haystack)
        ? "Subscriptions"
        : /amazon|flipkart|myntra|shopping/.test(haystack)
          ? "Shopping"
          : /fuel|petrol|diesel/.test(haystack)
            ? "Fuel"
            : /food|zomato|swiggy|restaurant|cafe/.test(haystack)
              ? "Food"
              : "Misc";
  return categories.find((c) => c.name === wanted)?.id ?? null;
}

function accountFor(accounts: AccountWithType[], kind: TxnKind, text: string) {
  const last4 = text.match(/\b(?:xx|x{2,}|ending|card)\s*([0-9]{4})\b/i)?.[1];
  if (last4) {
    const matched = accounts.find((a) => a.last4 === last4);
    if (matched) return matched.id;
  }

  if (kind === "EXPENSE") {
    const card = accounts.find((a) => a.accountType.nature === "LIABILITY");
    if (card && /\b(card|credit)\b/i.test(text)) return card.id;
    return accounts.find((a) => a.accountType.nature === "ASSET" && !a.accountType.isInvestment)?.id ?? null;
  }

  return (
    accounts.find((a) => a.isPrimary)?.id ??
    accounts.find((a) => a.accountType.nature === "ASSET" && !a.accountType.isInvestment)?.id ??
    null
  );
}

async function extractProposal(rawEmailId: string, text: string) {
  const rawEmail = await prisma.rawFinancialEmail.findUniqueOrThrow({ where: { id: rawEmailId } });
  const existing = await prisma.transactionProposal.findFirst({ where: { rawEmailId }, select: { id: true } });
  if (existing) return false;

  const kind = inferKind(text);
  const amount = firstAmount(text);
  if (!kind || !amount) {
    await prisma.rawFinancialEmail.update({
      where: { id: rawEmailId },
      data: { processingStatus: "IGNORED", processingError: "No amount/kind found" },
    });
    return false;
  }

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({
      where: { userId: DEFAULT_USER_ID, isArchived: false },
      include: { accountType: true },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.category.findMany({ where: { userId: DEFAULT_USER_ID } }),
  ]);
  const merchant = merchantFrom(text);
  const accountId = accountFor(accounts, kind, text);
  const categoryId = categoryFor(categories, kind, merchant, text);

  await prisma.transactionProposal.create({
    data: {
      userId: DEFAULT_USER_ID,
      rawEmailId,
      kind,
      date: rawEmail.receivedAt,
      amount: toDecimal(amount),
      description: merchant ? `${merchant} ${kind === "INCOME" ? "credit" : "transaction"}` : rawEmail.subject,
      merchantName: merchant,
      categoryId,
      fromAccountId: kind === "EXPENSE" ? accountId : null,
      toAccountId: kind === "INCOME" ? accountId : null,
      confidence: toDecimal(merchant ? 0.78 : 0.62),
      extractionNotes: "Deterministic Gmail extraction. Review before approving.",
      extractedPayload: {
        extractor: "deterministic-v1",
        subject: rawEmail.subject,
        snippet: rawEmail.snippet,
      },
    },
  });

  await prisma.rawFinancialEmail.update({
    where: { id: rawEmailId },
    data: { processingStatus: "PROCESSED", processingError: null },
  });
  return true;
}

export async function syncGmailFinancialEmails() {
  const source = await getConnectedGmailSource();
  if (!source) throw new Error("Connect Gmail first");

  const accessToken = await validAccessToken(source);
  const list = await gmailFetch<{ messages?: { id: string; threadId?: string }[] }>(
    accessToken,
    `/messages?${new URLSearchParams({ maxResults: "20", q: FINANCIAL_QUERY }).toString()}`,
  );

  let emailsCreated = 0;
  let proposalsCreated = 0;
  const messages = list.messages ?? [];

  for (const item of messages) {
    const message = await gmailFetch<GmailMessage>(
      accessToken,
      `/messages/${encodeURIComponent(item.id)}?${new URLSearchParams({ format: "full" }).toString()}`,
    );
    const headers = message.payload?.headers ?? [];
    const textBody = textFromPart(message.payload);
    const from = header(headers, "From");
    const subject = header(headers, "Subject");
    const receivedAt = messageDate(message);
    const bodyHash = crypto.createHash("sha256").update(textBody || message.snippet || item.id).digest("hex");

    const email = await prisma.rawFinancialEmail.upsert({
      where: {
        sourceId_externalMessageId: {
          sourceId: source.id,
          externalMessageId: item.id,
        },
      },
      update: {
        threadId: message.threadId ?? item.threadId,
        from,
        subject,
        snippet: message.snippet ?? null,
        bodyHash,
        receivedAt,
        rawMetadata: {
          labelIds: message.labelIds ?? [],
          textBody: textBody.slice(0, 8000),
        },
      },
      create: {
        userId: DEFAULT_USER_ID,
        sourceId: source.id,
        externalMessageId: item.id,
        threadId: message.threadId ?? item.threadId,
        from,
        subject,
        snippet: message.snippet ?? null,
        bodyHash,
        receivedAt,
        rawMetadata: {
          labelIds: message.labelIds ?? [],
          textBody: textBody.slice(0, 8000),
        },
      },
    });

    if (email.createdAt.getTime() === email.updatedAt.getTime()) emailsCreated++;
    if (await extractProposal(email.id, `${subject ?? ""}\n${message.snippet ?? ""}\n${textBody}`)) {
      proposalsCreated++;
    }
  }

  await prisma.automationSource.update({
    where: { id: source.id },
    data: { lastSyncedAt: new Date() },
  });

  return { emailsScanned: messages.length, emailsCreated, proposalsCreated };
}
