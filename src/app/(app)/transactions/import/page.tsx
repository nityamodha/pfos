import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAccountsWithBalances, getMasterData } from "@/lib/queries";
import { ImportTransactions } from "@/components/import-transactions";

export const dynamic = "force-dynamic";

export default async function ImportTransactionsPage() {
  const [accounts, master] = await Promise.all([getAccountsWithBalances(), getMasterData()]);

  return (
    <div className="space-y-4 pt-2">
      <Link
        href="/transactions"
        className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Activity
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import CSV</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-load transactions for one account from a bank or card statement export.
        </p>
      </div>

      <ImportTransactions
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, typeName: a.typeName }))}
        categories={master.categories}
      />
    </div>
  );
}
