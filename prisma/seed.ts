import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });
const USER_ID = "user_default";
// Credentials live in .env (gitignored) — see SEED_USERNAME / SEED_PASSWORD.
// Only set on seed if both are provided, so re-running seed without them is a no-op for auth.
const USERNAME = process.env.SEED_USERNAME;
const PASSWORD = process.env.SEED_PASSWORD;

// Master data — all editable in-app later; this is just a sensible starting set.
const ACCOUNT_TYPES: {
  name: string;
  nature: "ASSET" | "LIABILITY";
  icon: string;
  sortOrder: number;
  isInvestment?: boolean;
  hasStatementCycle?: boolean;
}[] = [
  { name: "Bank", nature: "ASSET", icon: "landmark", sortOrder: 10 },
  { name: "Cash", nature: "ASSET", icon: "wallet", sortOrder: 20 },
  { name: "Credit Card", nature: "LIABILITY", icon: "credit-card", sortOrder: 30, hasStatementCycle: true },
  { name: "Mutual Fund", nature: "ASSET", icon: "chart-line", sortOrder: 40, isInvestment: true },
  { name: "Stock", nature: "ASSET", icon: "trending-up", sortOrder: 50, isInvestment: true },
  { name: "Debt Fund", nature: "ASSET", icon: "piggy-bank", sortOrder: 60, isInvestment: true },
  { name: "Gold", nature: "ASSET", icon: "coins", sortOrder: 70, isInvestment: true },
  { name: "Loan", nature: "LIABILITY", icon: "hand-coins", sortOrder: 80 },
  { name: "Other", nature: "ASSET", icon: "circle", sortOrder: 90 },
];

const CATEGORIES: { name: string; kind?: "INCOME" | "EXPENSE" | "TRANSFER"; sortOrder: number }[] = [
  { name: "Salary", kind: "INCOME", sortOrder: 10 },
  { name: "Food", kind: "EXPENSE", sortOrder: 20 },
  { name: "Travel", kind: "EXPENSE", sortOrder: 30 },
  { name: "Shopping", kind: "EXPENSE", sortOrder: 40 },
  { name: "Fuel", kind: "EXPENSE", sortOrder: 50 },
  { name: "Health", kind: "EXPENSE", sortOrder: 60 },
  { name: "Entertainment", kind: "EXPENSE", sortOrder: 70 },
  { name: "Subscriptions", kind: "EXPENSE", sortOrder: 80 },
  { name: "Bills", kind: "EXPENSE", sortOrder: 90 },
  { name: "Luxury", kind: "EXPENSE", sortOrder: 100 },
  { name: "Investment", kind: "TRANSFER", sortOrder: 110 },
  { name: "Transfer", kind: "TRANSFER", sortOrder: 120 },
  { name: "Misc", sortOrder: 130 },
];

const TXN_TYPES: { name: string; kind: "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT" | "WITHDRAWAL" | "ADJUSTMENT"; icon: string; sortOrder: number }[] = [
  { name: "Income", kind: "INCOME", icon: "arrow-down-left", sortOrder: 10 },
  { name: "Expense", kind: "EXPENSE", icon: "arrow-up-right", sortOrder: 20 },
  { name: "Transfer", kind: "TRANSFER", icon: "arrow-left-right", sortOrder: 30 },
  { name: "Investment", kind: "INVESTMENT", icon: "trending-up", sortOrder: 40 },
  { name: "Withdrawal", kind: "WITHDRAWAL", icon: "banknote", sortOrder: 50 },
  { name: "Adjustment", kind: "ADJUSTMENT", icon: "settings-2", sortOrder: 60 },
];

async function main() {
  const credentials =
    USERNAME && PASSWORD
      ? { username: USERNAME, passwordHash: hashPassword(PASSWORD) }
      : {};

  await prisma.user.upsert({
    where: { id: USER_ID },
    update: credentials,
    create: {
      id: USER_ID,
      name: "Me",
      baseCurrency: "INR",
      ...credentials,
    },
  });

  for (const t of ACCOUNT_TYPES) {
    await prisma.accountType.upsert({
      where: { userId_name: { userId: USER_ID, name: t.name } },
      update: {
        nature: t.nature,
        icon: t.icon,
        sortOrder: t.sortOrder,
        isInvestment: t.isInvestment ?? false,
        hasStatementCycle: t.hasStatementCycle ?? false,
        isSystem: true,
      },
      create: {
        userId: USER_ID,
        isSystem: true,
        isInvestment: t.isInvestment ?? false,
        hasStatementCycle: t.hasStatementCycle ?? false,
        ...t,
      },
    });
  }

  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { userId_name: { userId: USER_ID, name: c.name } },
      update: { kind: c.kind, sortOrder: c.sortOrder, isSystem: true },
      create: { userId: USER_ID, isSystem: true, ...c },
    });
  }

  for (const t of TXN_TYPES) {
    await prisma.transactionType.upsert({
      where: { userId_name: { userId: USER_ID, name: t.name } },
      update: { kind: t.kind, icon: t.icon, sortOrder: t.sortOrder, isSystem: true },
      create: { userId: USER_ID, isSystem: true, ...t },
    });
  }

  console.log("Seed complete: user + account types + categories + transaction types.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
