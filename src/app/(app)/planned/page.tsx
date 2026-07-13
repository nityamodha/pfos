import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAccountsWithBalances, getRecurringRules } from "@/lib/queries";
import { PlannedRules } from "@/components/planned-rules";

export const dynamic = "force-dynamic";

export default async function PlannedPage() {
  const [rules, accounts] = await Promise.all([getRecurringRules(), getAccountsWithBalances()]);

  return (
    <div className="space-y-4 pt-2">
      <Link
        href="/"
        className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Home
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planned</h1>
        <p className="text-sm text-muted-foreground">
          Salary, SIPs and EMIs that drive your cash-flow forecast.
        </p>
      </div>

      <PlannedRules
        rules={rules}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, typeName: a.typeName }))}
      />
    </div>
  );
}
