import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getAccountDetail, getMasterData, getAccountsWithBalances } from "@/lib/queries";
import { getCardCycles } from "@/lib/cycles";
import { formatINR } from "@/lib/money";
import { accountIcon } from "@/lib/icons";
import { Card } from "@/components/ui/card";
import { SnapshotDialog } from "@/components/snapshot-dialog";
import { EditAccountForm } from "@/components/edit-account-form";
import { CycleReport } from "@/components/cycle-report";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, master, allAccounts, cycleReport] = await Promise.all([
    getAccountDetail(id),
    getMasterData(),
    getAccountsWithBalances(),
    getCardCycles(id),
  ]);
  if (!detail) notFound();

  const { account, history } = detail;
  // Cash accounts that can settle a card bill (exclude investments, liabilities and this account).
  const settlementAccounts = allAccounts
    .filter((a) => a.nature === "ASSET" && !a.isInvestment && a.id !== account.id)
    .map((a) => ({ id: a.id, name: a.name }));
  const Icon = accountIcon(account.icon);
  const isLiability = account.nature === "LIABILITY";

  const gain =
    account.isInvestment && account.invested != null
      ? account.displayBalance - account.invested
      : null;
  const gainPct = gain != null && account.invested ? (gain / account.invested) * 100 : null;

  return (
    <div className="space-y-6 pt-2">
      <Link
        href="/accounts"
        className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Accounts
      </Link>

      {/* Header */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="icon-chip size-11">
            <Icon className="size-5 text-foreground/70" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{account.name}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {account.institution ? `${account.institution} · ` : ""}
              {account.typeName}
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            {isLiability ? "Outstanding" : account.isInvestment ? "Current value" : "Balance"}
          </p>
          <p className={`font-mono text-4xl font-semibold tabular-nums ${isLiability ? "text-rose-400" : ""}`}>
            {formatINR(account.displayBalance)}
          </p>
          {gain != null ? (
            <p className={`mt-1 text-sm font-medium ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {gain >= 0 ? "▲" : "▼"} {formatINR(Math.abs(gain))}
              {gainPct != null ? ` (${gainPct >= 0 ? "+" : "−"}${Math.abs(gainPct).toFixed(1)}%)` : ""}
              <span className="text-muted-foreground"> · invested {formatINR(account.invested!)}</span>
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <SnapshotDialog account={account} />
          <EditAccountForm
            account={{
              id: account.id,
              name: account.name,
              institution: account.institution,
              typeId: account.typeId,
              statementDayOfMonth: account.statementDayOfMonth,
              dueDayOfMonth: account.dueDayOfMonth,
              isPrimary: account.isPrimary,
              settlementAccountId: account.settlementAccountId,
            }}
            accountTypes={master.accountTypes}
            settlementAccounts={settlementAccounts}
          />
        </div>

        {account.hasStatementCycle && (account.statementDayOfMonth || account.dueDayOfMonth) ? (
          <Card className="flex gap-6 p-4 text-sm">
            {account.statementDayOfMonth ? (
              <div>
                <p className="text-xs text-muted-foreground">Statement day</p>
                <p className="font-medium tabular-nums">{account.statementDayOfMonth}</p>
              </div>
            ) : null}
            {account.dueDayOfMonth ? (
              <div>
                <p className="text-xs text-muted-foreground">Due day</p>
                <p className="font-medium tabular-nums">{account.dueDayOfMonth}</p>
              </div>
            ) : null}
          </Card>
        ) : null}
      </section>

      {account.hasStatementCycle ? <CycleReport report={cycleReport} /> : null}

      {/* History */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">History</h2>
        {history.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <Card className="divide-y divide-border/60 p-0">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {h.description || h.typeName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {h.otherAccountName ? `${h.otherAccountName} · ` : ""}
                    {fmtDate(h.date)}
                  </p>
                </div>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    h.signedAmount >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {h.signedAmount >= 0 ? "+" : "−"}
                  {formatINR(Math.abs(h.signedAmount))}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
