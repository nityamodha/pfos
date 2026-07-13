import { getAccountsWithBalances, getMasterData } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { Card } from "@/components/ui/card";
import { AccountRow } from "@/components/account-row";
import { AddAccountForm } from "@/components/add-account-form";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, master] = await Promise.all([getAccountsWithBalances(), getMasterData()]);

  // Group accounts by type, preserving the master-data order.
  const groups = master.accountTypes
    .map((t) => ({ type: t, items: accounts.filter((a) => a.typeId === t.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <AddAccountForm accountTypes={master.accountTypes} />
      </header>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No accounts yet. Tap <span className="font-medium text-foreground">Add</span> to create one.
        </p>
      ) : (
        groups.map((g) => {
          const total = g.items.reduce((s, a) => s + a.displayBalance, 0);
          return (
            <section key={g.type.id} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-muted-foreground">{g.type.name}</h2>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {formatINR(total)}
                </span>
              </div>
              <Card className="divide-y divide-border/60 p-0">
                {g.items.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
