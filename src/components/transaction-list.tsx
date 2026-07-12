"use client";

import { useState } from "react";
import { formatINR } from "@/lib/format";
import type { TransactionListItem } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { EditTransactionForm } from "@/components/edit-transaction-form";

type TxnType = { id: string; name: string; kind: string };
type Category = { id: string; name: string };
type Account = { id: string; name: string; typeName: string };

const OUTFLOW = new Set(["EXPENSE", "WITHDRAWAL"]);
const INFLOW = new Set(["INCOME"]);

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(d));
}

function subtitle(t: TransactionListItem) {
  if (t.fromAccountName && t.toAccountName) return `${t.fromAccountName} → ${t.toAccountName}`;
  return t.fromAccountName ?? t.toAccountName ?? t.categoryName ?? t.typeName;
}

export function TransactionList({
  txns,
  txnTypes,
  categories,
  accounts,
}: {
  txns: TransactionListItem[];
  txnTypes: TxnType[];
  categories: Category[];
  accounts: Account[];
}) {
  const [editing, setEditing] = useState<TransactionListItem | null>(null);

  return (
    <>
      <Card className="divide-y divide-border/60 p-0">
        {txns.map((t) => {
          const sign = OUTFLOW.has(t.kind) ? "-" : INFLOW.has(t.kind) ? "+" : "";
          const color = OUTFLOW.has(t.kind) ? "text-red-400" : INFLOW.has(t.kind) ? "text-emerald-400" : "";
          const editable = t.kind !== "ADJUSTMENT";
          return (
            <button
              key={t.id}
              type="button"
              disabled={!editable}
              onClick={() => editable && setEditing(t)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-muted/40 disabled:cursor-default"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {t.description || t.categoryName || t.typeName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{subtitle(t)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${color}`}>
                  {sign}
                  {formatINR(t.amount)}
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(t.date)}</p>
              </div>
            </button>
          );
        })}
      </Card>

      {editing ? (
        <EditTransactionForm
          open={editing !== null}
          onOpenChange={(v) => !v && setEditing(null)}
          txn={editing}
          txnTypes={txnTypes}
          categories={categories}
          accounts={accounts}
        />
      ) : null}
    </>
  );
}
