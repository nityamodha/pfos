"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, ArrowDownCircle, ArrowUpCircle, TrendingUp, CheckCircle2, Undo2 } from "lucide-react";
import {
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  confirmRecurringOccurrence,
  resetRecurringConfirmation,
} from "@/lib/actions";
import type { RecurringRuleItem } from "@/lib/queries";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Account = { id: string; name: string; typeName: string };

const KINDS = [
  { value: "INCOME", label: "Income (salary)" },
  { value: "EXPENSE", label: "Expense (EMI, rent)" },
  { value: "INVESTMENT", label: "Investment (SIP)" },
];

function kindMeta(kind: string) {
  if (kind === "INCOME") return { icon: ArrowUpCircle, color: "text-emerald-400", sign: "+" };
  if (kind === "INVESTMENT") return { icon: TrendingUp, color: "text-blue-400", sign: "−" };
  return { icon: ArrowDownCircle, color: "text-rose-400", sign: "−" };
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtShortDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}

export function PlannedRules({
  rules,
  accounts,
}: {
  rules: RecurringRuleItem[];
  accounts: Account[];
}) {
  const [editing, setEditing] = useState<RecurringRuleItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function markDone(r: RecurringRuleItem) {
    if (!r.pendingConfirmDate) return;
    startTransition(async () => {
      await confirmRecurringOccurrence(r.id, r.pendingConfirmDate!);
      toast.success("Marked done");
      router.refresh();
    });
  }

  function resetConfirmation(r: RecurringRuleItem) {
    startTransition(async () => {
      await resetRecurringConfirmation(r.id);
      toast.success("Confirmation reset");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">Recurring money</h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No recurring money yet. Add your salary, SIPs and EMIs so the forecast can predict your
          balance.
        </Card>
      ) : (
        <Card className="divide-y divide-border/60 p-0">
          {rules.map((r) => {
            const m = kindMeta(r.kind);
            const Icon = m.icon;
            return (
              <div key={r.id} className="flex w-full items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Icon className={cn("size-5 shrink-0", m.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.dayOfMonth ? `Monthly · ${ordinal(r.dayOfMonth)}` : "Monthly"}
                      {r.nextOccurrenceDate ? ` · next ${fmtShortDate(r.nextOccurrenceDate)}` : ""}
                      {r.confirmedThrough ? ` · confirmed thru ${fmtShortDate(r.confirmedThrough)}` : ""}
                    </p>
                  </div>
                </button>
                {r.confirmedThrough ? (
                  <button
                    type="button"
                    title="Undo confirmation"
                    disabled={pending}
                    onClick={() => resetConfirmation(r)}
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <Undo2 className="size-4" />
                  </button>
                ) : r.pendingConfirmDate ? (
                  <button
                    type="button"
                    title={`Mark ${fmtShortDate(r.pendingConfirmDate)} as already happened`}
                    disabled={pending}
                    onClick={() => markDone(r)}
                    className="text-muted-foreground transition-colors hover:text-emerald-400 disabled:opacity-50"
                  >
                    <CheckCircle2 className="size-4" />
                  </button>
                ) : null}
                <span className={cn("font-mono text-sm font-semibold tabular-nums", m.color)}>
                  {m.sign}
                  {formatINR(r.amount)}
                </span>
              </div>
            );
          })}
        </Card>
      )}

      {adding ? (
        <RuleDialog
          open={adding}
          onOpenChange={setAdding}
          accounts={accounts}
        />
      ) : null}
      {editing ? (
        <RuleDialog
          open={editing !== null}
          onOpenChange={(v) => !v && setEditing(null)}
          rule={editing}
          accounts={accounts}
        />
      ) : null}
    </>
  );
}

function RuleDialog({
  open,
  onOpenChange,
  rule,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rule?: RecurringRuleItem;
  accounts: Account[];
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [kind, setKind] = useState(rule?.kind ?? "INCOME");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [day, setDay] = useState(rule?.dayOfMonth ? String(rule.dayOfMonth) : "");
  const [account, setAccount] = useState(
    (kind === "INCOME" ? rule?.toAccountId : rule?.fromAccountId) ?? "",
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const accountLabel = kind === "INCOME" ? "Lands in" : "Comes from";

  function submit() {
    const fd = new FormData();
    if (rule) fd.set("id", rule.id);
    fd.set("name", name);
    fd.set("kind", kind);
    fd.set("amount", amount);
    fd.set("dayOfMonth", day);
    if (kind === "INCOME") fd.set("toAccountId", account);
    else fd.set("fromAccountId", account);

    startTransition(async () => {
      try {
        await (rule ? updateRecurringRule(fd) : createRecurringRule(fd));
        toast.success(rule ? "Rule updated" : "Rule added");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  function onDelete() {
    if (!rule) return;
    if (!confirm(`Delete "${rule.name}"?`)) return;
    const fd = new FormData();
    fd.set("id", rule.id);
    startTransition(async () => {
      try {
        await deleteRecurringRule(fd);
        toast.success("Rule deleted");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "Add recurring money"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v ?? "INCOME")} items={KINDS}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Salary, Nifty SIP, Car EMI"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="rule-amount">Amount</Label>
              <Input
                id="rule-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-day">Day of month</Label>
              <Input
                id="rule-day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                type="number"
                min={1}
                max={31}
                placeholder="e.g. 28"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{accountLabel}</Label>
            <Select
              value={account}
              onValueChange={(v) => setAccount(v ?? "")}
              items={accounts.map((a) => ({ label: a.name, value: a.id }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    <span className="ml-2 text-xs text-muted-foreground">{a.typeName}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={submit} disabled={pending} className="w-full">
              {pending ? "Saving…" : rule ? "Save changes" : "Add rule"}
            </Button>
            {rule ? (
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={onDelete}
                className="w-full"
              >
                Delete rule
              </Button>
            ) : null}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
