# PFOS — Personal Finance Operating System

A dashboard for your financial life. **Not an expense tracker** — its job is to answer
_"what is my net worth and how did it change?"_ Every transaction exists only to explain a
movement in net worth.

- **Stack:** Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui (Base UI) · Prisma 7 · Supabase Postgres · PWA · Vercel
- **Mobile-first**, dark-first, installable.

## The accounting model (why this stays accurate)

Everything is an **Account** (bank, credit card, mutual fund, stock, cash, gold, loan…).
Money moves _between_ accounts. Internally we keep a **double-entry ledger in a "net-worth frame"**:

- Every `LedgerEntry.amount` is a **signed contribution to net worth**.
  `+` = net worth goes up for that account (asset grows, or a liability shrinks); `−` = the opposite.
- **Transfers/settlements sum to 0** (paying a credit-card bill moves cash → card, net worth unchanged).
- **Income/expense** touch one real account; the other side is the external world (equity), so net worth moves.
- **Net worth = sum of every ledger entry + opening balances.** Monthly change = sum of this month's entries.

Displayed balances: assets show positive when funded, liabilities show positive when owed.

Master data — **account types, categories, transaction types, tags — live in tables and are fully
configurable**. The engine keys off stable enum fields (`AccountNature`, `TxnKind`), not the editable names.

### Never lose confidence in your data
- **Reconcile**: type your real balance; the system posts an `Adjustment` to match. It never blocks you.
- **Snapshots**: periodic manual balances / mark-to-market for investments.

## Local setup

1. **Add your Supabase connection strings** to `.env` (see `.env.example`):
   - `DATABASE_URL` — the **pooled** string (port `6543`, add `?pgbouncer=true&connection_limit=1`). Used at runtime.
   - `DIRECT_URL` — the **direct/session** string (port `5432`). Used for migrations.
   Find both in Supabase → Project Settings → Database → Connection string.

2. Install, migrate, seed, run:
   ```bash
   npm install
   npm run db:migrate      # creates tables (uses DIRECT_URL)
   npm run db:seed         # seeds default user + account types + categories + txn types
   npm run dev
   ```

Open http://localhost:3000.

## Useful scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run db:migrate` | Create/apply a migration locally |
| `npm run db:deploy` | Apply migrations (CI / production) |
| `npm run db:seed` | Seed configurable master data |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:studio` | Prisma Studio |

## Deploy to Vercel

1. Push to GitHub, import into Vercel.
2. Set env vars **DATABASE_URL** and **DIRECT_URL** (same as local).
3. Build runs `prisma generate` via `postinstall`. Run `npm run db:deploy` against your DB when the
   schema changes (e.g. as a one-off or a deploy hook).

## App map

- `/` Dashboard — net worth hero, monthly change, assets/liabilities, breakdown by type, accounts.
- `/accounts` — accounts grouped by type; add account.
- `/add` — <10s transaction entry (fields adapt to the transaction kind).
- `/transactions` — recent activity.
- `/settings` — view seeded master data (in-app editing next).

## Roadmap (next)
Reconcile & snapshot UI · in-app master-data editing · goals & reminders on the home screen ·
net-worth trend chart · recurring rules (SIP/salary/EMI) · CSV import · auth (schema already carries `userId`).
