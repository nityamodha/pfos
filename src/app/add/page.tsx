import Link from "next/link";
import { getAccountsWithBalances, getMasterData } from "@/lib/queries";
import { AddTransactionForm } from "@/components/add-transaction-form";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const [accounts, master] = await Promise.all([getAccountsWithBalances(), getMasterData()]);

  if (accounts.length === 0) {
    return (
      <div className="space-y-4 pt-8 text-center">
        <p className="text-muted-foreground">Add an account before recording transactions.</p>
        <Link href="/accounts" className={buttonVariants()}>
          Go to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Add transaction</h1>
      <AddTransactionForm
        txnTypes={master.txnTypes}
        categories={master.categories}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, typeName: a.typeName }))}
      />
    </div>
  );
}
