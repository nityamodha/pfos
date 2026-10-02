import { Bot, CheckCircle2, CircleDashed, CircleSlash2 } from "lucide-react";
import { getAutomationProposalCounts, getAutomationProposals, getGmailConnectionStatus } from "@/lib/automation";
import { getAccountsWithBalances, getMasterData } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { AutomationInbox } from "@/components/automation-inbox";

export const dynamic = "force-dynamic";

const STAT_CARDS = [
  { key: "PENDING", label: "Pending", icon: CircleDashed, color: "text-primary" },
  { key: "APPROVED", label: "Approved", icon: CheckCircle2, color: "text-emerald-400" },
  { key: "REJECTED", label: "Rejected", icon: CircleSlash2, color: "text-muted-foreground" },
];

export default async function AutomationPage() {
  const [proposals, counts, master, accounts, gmail] = await Promise.all([
    getAutomationProposals(),
    getAutomationProposalCounts(),
    getMasterData(),
    getAccountsWithBalances(),
    getGmailConnectionStatus(),
  ]);

  return (
    <div className="space-y-6 pt-2">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <Bot className="size-4" />
            Automation Inbox
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Agent review</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review extracted money events before PFOS posts them as ledger transactions.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key} className="gap-1 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className="font-mono text-2xl font-semibold tabular-nums">{counts[key] ?? 0}</p>
          </Card>
        ))}
      </section>

      <AutomationInbox
        proposals={proposals}
        gmail={gmail}
        txnTypes={master.txnTypes}
        categories={master.categories}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, typeName: a.typeName }))}
      />
    </div>
  );
}
