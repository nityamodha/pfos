import { Wallet } from "lucide-react";
import type { MonthlyBudget } from "@/lib/budget-shared";
import { formatINR } from "@/lib/money";
import { Card } from "@/components/ui/card";

export function BudgetCard({ budget }: { budget: MonthlyBudget }) {
  if (!budget.hasTarget) return null;

  const over = budget.remaining < 0;

  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center gap-2">
        <div className="icon-chip size-8">
          <Wallet className="size-4" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Spending budget · this month</p>
      </div>
      <p className={`font-mono text-3xl font-semibold tabular-nums ${over ? "text-rose-400" : "text-emerald-400"}`}>
        {formatINR(budget.remaining)}
      </p>
      <p className="text-xs text-muted-foreground">
        {over
          ? `Projected to land ${formatINR(Math.abs(budget.remaining))} below your ${formatINR(budget.savingsTarget)} target in ${budget.targetName} by month end.`
          : `Room to spend before dipping below your ${formatINR(budget.savingsTarget)} target in ${budget.targetName}, with ${budget.daysLeft} day${budget.daysLeft === 1 ? "" : "s"} left.`}
      </p>
    </Card>
  );
}
