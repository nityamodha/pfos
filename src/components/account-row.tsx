import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { AccountWithBalance } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { accountIcon } from "@/lib/icons";

export function AccountRow({ account }: { account: AccountWithBalance }) {
  const Icon = accountIcon(account.icon);
  const isLiability = account.nature === "LIABILITY";
  const gain =
    account.isInvestment && account.invested != null
      ? account.displayBalance - account.invested
      : null;

  return (
    <Link href={`/accounts/${account.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <div className="bubble-icon size-9 bg-gradient-to-br from-white/80 to-secondary">
        <Icon className="size-4.5 text-foreground/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{account.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {account.institution ?? account.typeName}
        </p>
      </div>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${isLiability ? "text-red-600" : ""}`}>
          {formatINR(account.displayBalance)}
        </span>
        {gain != null ? (
          <p className={`text-xs font-medium tabular-nums ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {gain >= 0 ? "▲" : "▼"} {formatINR(Math.abs(gain))}
          </p>
        ) : null}
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}
