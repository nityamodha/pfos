import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Wallet, CreditCard, CalendarClock } from "lucide-react";
import { getDashboard } from "@/lib/queries";
import { getReminders } from "@/lib/reminders";
import { getTrends } from "@/lib/trends";
import { getForecast } from "@/lib/forecast";
import { getMonthlyBudget } from "@/lib/budget";
import { formatINR } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AccountRow } from "@/components/account-row";
import { TrendsSection } from "@/components/trends-section";
import { ForecastSection } from "@/components/forecast-section";
import { BudgetCard } from "@/components/budget-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [data, reminders, trends, forecast, budget] = await Promise.all([
    getDashboard(),
    getReminders(),
    getTrends(),
    getForecast(),
    getMonthlyBudget(),
  ]);
  const hasAccounts = data.accounts.length > 0;
  const up = data.monthChange >= 0;

  return (
    <div className="space-y-6">
      {/* Net worth hero */}
      <section className="pt-6 lg:flex lg:items-start lg:justify-between lg:gap-6">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Net Worth</p>
          <h1 className="mt-1 font-mono text-5xl font-semibold tracking-tight tabular-nums">
            {formatINR(data.netWorth)}
          </h1>
          <p
            className={`mt-2 flex items-center gap-1 text-sm font-medium ${
              up ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
            {formatINR(Math.abs(data.monthChange))} this month
          </p>
        </div>

        {hasAccounts ? (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-0 lg:w-80 lg:shrink-0">
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium text-muted-foreground">Assets</p>
              <p className="font-mono text-xl font-semibold tabular-nums">{formatINR(data.assets)}</p>
            </Card>
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium text-muted-foreground">Liabilities</p>
              <p className="font-mono text-xl font-semibold tabular-nums text-rose-400">
                {formatINR(data.liabilities)}
              </p>
            </Card>
          </div>
        ) : null}
      </section>

      {!hasAccounts ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Wallet className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No accounts yet</p>
            <p className="text-sm text-muted-foreground">
              Add your banks, cards and investments to see your net worth.
            </p>
          </div>
          <Link href="/accounts" className={buttonVariants()}>
            Add your first account
          </Link>
        </Card>
      ) : (
        <div className="space-y-6 lg:space-y-0 dashboard-grid">
          {/* Reminders */}
          {reminders.length > 0 ? (
            <section className="area-reminders space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">Reminders</h2>
              <Card className="divide-y divide-border/60 p-0">
                {reminders.slice(0, 5).map((r) => {
                  const Icon = r.kind === "due" ? CreditCard : CalendarClock;
                  const soon = r.daysUntil <= 3;
                  return (
                    <Link
                      key={r.id}
                      href={`/accounts/${r.accountId}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div
                        className={`icon-chip size-9 ${
                          soon ? "bg-destructive/15 text-rose-400 ring-destructive/25" : "text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground first-letter:uppercase">{r.subtitle}</p>
                      </div>
                      {r.amount != null ? (
                        <span className="font-mono text-sm font-semibold tabular-nums text-rose-400">
                          {formatINR(r.amount)}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </Card>
            </section>
          ) : null}

          {/* Forecast */}
          <div className="area-forecast">
            <ForecastSection forecast={forecast} />
          </div>

          {/* Monthly spending budget */}
          {budget.hasTarget ? (
            <div className="area-budget">
              <BudgetCard budget={budget} />
            </div>
          ) : null}

          {/* Trends */}
          <div className="area-trends">
            <TrendsSection trends={trends} />
          </div>

          {/* Breakdown by account type */}
          <section className="area-breakdown space-y-2">
            <h2 className="px-1 text-sm font-medium text-muted-foreground">Breakdown</h2>
            <Card className="divide-y divide-border/60 p-0">
              {data.byType.map((t) => (
                <div key={t.typeId} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium">{t.typeName}</span>
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      t.nature === "LIABILITY" ? "text-rose-400" : ""
                    }`}
                  >
                    {formatINR(t.total)}
                  </span>
                </div>
              ))}
            </Card>
          </section>

          {/* Accounts */}
          <section className="area-accounts space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-medium text-muted-foreground">Accounts</h2>
              <Link href="/accounts" className="text-sm font-medium text-primary">
                Manage
              </Link>
            </div>
            <Card className="divide-y divide-border/60 p-0">
              {data.accounts.map((a) => (
                <AccountRow key={a.id} account={a} />
              ))}
            </Card>
          </section>
        </div>
      )}
    </div>
  );
}
