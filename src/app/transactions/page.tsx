import { getAccountsWithBalances, getMasterData, getRecentTransactions } from "@/lib/queries";
import { TransactionList } from "@/components/transaction-list";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [txns, master, accounts] = await Promise.all([
    getRecentTransactions(),
    getMasterData(),
    getAccountsWithBalances(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="pt-4 text-2xl font-semibold tracking-tight">Activity</h1>

      {txns.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <TransactionList
          txns={txns}
          txnTypes={master.txnTypes}
          categories={master.categories}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name, typeName: a.typeName }))}
        />
      )}
    </div>
  );
}
