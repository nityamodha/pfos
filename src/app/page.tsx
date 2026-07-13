import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Wallet, CreditCard, CalendarClock } from "lucide-react";
import { getDashboard } from "@/lib/queries";
import { getReminders } from "@/lib/reminders";
import { getTrends } from "@/lib/trends";
import { getForecast } from "@/lib/forecast";
import { formatINR } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { AccountRow } from "@/components/account-row";
import { TrendsSection } from "@/components/trends-section";
import { ForecastSection } from "@/components/forecast-section";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [data, reminders, trends, forecast] = await Promise.all([
    getDashboard(),
    getReminders(),
    getTrends(),
    getForecast(),
  ]);
  const hasAccounts = data.accounts.length > 0;
  const up = data.monthChange >= 0;

  return (
    <div className="space-y-6">
      {/* Net worth hero */}
      <section className="pt-6">
        <p className="text-sm font-medium text-muted-foreground">Net Worth</p>
        <h1 className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
          {formatINR(data.netWorth)}
        </h1>
        <p
          className={`mt-2 flex items-center gap-1 text-sm font-medium ${
            up ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
          {formatINR(Math.abs(data.monthChange))} this month
        </p>
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
        <>
          {/* Reminders */}
          {reminders.length > 0 ? (
            <section className="space-y-2">
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
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                          soon ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="truncate text-xs text-muted-foreground first-letter:uppercase">{r.subtitle}</p>
                      </div>
                      {r.amount != null ? (
                        <span className="text-sm font-semibold tabular-nums text-red-400">
                          {formatINR(r.amount)}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </Card>
            </section>
          ) : null}

          {/* Assets vs liabilities */}
          <section className="grid grid-cols-2 gap-3">
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium text-muted-foreground">Assets</p>
              <p className="text-xl font-semibold tabular-nums">{formatINR(data.assets)}</p>
            </Card>
            <Card className="gap-1 p-4">
              <p className="text-xs font-medium text-muted-foreground">Liabilities</p>
              <p className="text-xl font-semibold tabular-nums text-red-400">
                {formatINR(data.liabilities)}
              </p>
            </Card>
          </section>

          {/* Forecast */}
          <ForecastSection forecast={forecast} />

          {/* Trends */}
          <TrendsSection trends={trends} />

          {/* Breakdown by account type */}
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-medium text-muted-foreground">Breakdown</h2>
            <Card className="divide-y divide-border/60 p-0">
              {data.byType.map((t) => (
                <div key={t.typeId} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium">{t.typeName}</span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      t.nature === "LIABILITY" ? "text-red-400" : ""
                    }`}
                  >
                    {formatINR(t.total)}
                  </span>
                </div>
              ))}
            </Card>
          </section>

          {/* Accounts */}
          <section className="space-y-2">
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
        </>
      )}
    </div>
  );
}
