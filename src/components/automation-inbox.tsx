"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash2, CopyCheck, Inbox, Mail, Pencil, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AutomationProposalItem, GmailConnectionStatus } from "@/lib/automation";
import {
  approveTransactionProposal,
  createDemoAutomationProposals,
  markTransactionProposalDuplicate,
  reopenTransactionProposal,
  rejectTransactionProposal,
  syncGmailAutomationInbox,
  updateTransactionProposal,
} from "@/lib/automation-actions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TxnType = { id: string; name: string; kind: string };
type Category = { id: string; name: string };
type Account = { id: string; name: string; typeName: string };

const OUTFLOW = new Set(["EXPENSE", "WITHDRAWAL"]);
const INFLOW = new Set(["INCOME"]);
const REVIEWABLE = new Set(["PENDING", "NEEDS_REVIEW"]);
const NEEDS_FROM = new Set(["EXPENSE", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);
const NEEDS_TO = new Set(["INCOME", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);
const NONE = "__none__";

function fmtDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(isoDate + "T00:00:00"),
  );
}

function statusVariant(status: string) {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED" || status === "DUPLICATE") return "outline";
  if (status === "NEEDS_REVIEW") return "destructive";
  return "secondary";
}

function amountMeta(kind: string) {
  if (OUTFLOW.has(kind)) return { sign: "-", className: "text-rose-400" };
  if (INFLOW.has(kind)) return { sign: "+", className: "text-emerald-400" };
  return { sign: "", className: "" };
}

function accountLine(p: AutomationProposalItem) {
  if (p.fromAccount && p.toAccount) return `${p.fromAccount.name} -> ${p.toAccount.name}`;
  return p.fromAccount?.name ?? p.toAccount?.name ?? "No account mapped";
}

export function AutomationInbox({
  proposals,
  gmail,
  txnTypes,
  categories,
  accounts,
}: {
  proposals: AutomationProposalItem[];
  gmail: GmailConnectionStatus;
  txnTypes: TxnType[];
  categories: Category[];
  accounts: Account[];
}) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutomationProposalItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function runAction(label: string, action: () => Promise<unknown>) {
    setPendingAction(label);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setPendingAction(null);
      }
    });
  }

  function createDemo() {
    runAction("demo", async () => {
      const result = await createDemoAutomationProposals();
      toast.success(result.created ? `Created ${result.created} proposal${result.created === 1 ? "" : "s"}` : "Demo proposals already exist");
    });
  }

  function syncGmail() {
    runAction("gmail-sync", async () => {
      const result = await syncGmailAutomationInbox();
      toast.success(
        `Scanned ${result.emailsScanned} email${result.emailsScanned === 1 ? "" : "s"} · created ${result.proposalsCreated} proposal${result.proposalsCreated === 1 ? "" : "s"}`,
      );
    });
  }

  function approve(id: string) {
    runAction(`approve:${id}`, async () => {
      await approveTransactionProposal(id);
      toast.success("Proposal posted to ledger");
    });
  }

  function reject(id: string) {
    runAction(`reject:${id}`, async () => {
      await rejectTransactionProposal(id);
      toast.success("Proposal rejected");
    });
  }

  function duplicate(id: string) {
    runAction(`duplicate:${id}`, async () => {
      await markTransactionProposalDuplicate(id);
      toast.success("Marked duplicate");
    });
  }

  function reopen(proposal: AutomationProposalItem) {
    if (
      proposal.status === "APPROVED" &&
      !confirm("Reopening an approved proposal removes the transaction it posted to the ledger. Reopen it?")
    ) {
      return;
    }

    runAction(`reopen:${proposal.id}`, async () => {
      await reopenTransactionProposal(proposal.id);
      toast.success("Proposal reopened");
    });
  }

  const busy = isPending || pendingAction !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Review queue</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gmail-derived proposals wait here before they enter your ledger.
          </p>
        </div>
        <Button variant="outline" onClick={createDemo} disabled={busy}>
          <Sparkles className="size-4" />
          Demo proposals
        </Button>
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Mail className="size-4 text-primary" />
            Gmail ingestion
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {!gmail.configured
              ? "Add Google OAuth credentials to .env to enable live Gmail sync."
              : gmail.connected
              ? `${gmail.email ?? gmail.name} connected${gmail.lastSyncedAt ? ` · last sync ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(gmail.lastSyncedAt))}` : ""}`
              : "Connect Gmail to import recent financial alerts into this inbox."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {gmail.configured ? (
            <Link href="/api/gmail/connect" className={buttonVariants({ variant: gmail.connected ? "outline" : "default" })}>
              <Mail className="size-4" />
              {gmail.connected ? "Reconnect" : "Connect Gmail"}
            </Link>
          ) : (
            <Button variant="outline" disabled>
              <Mail className="size-4" />
              Connect Gmail
            </Button>
          )}
          <Button variant="outline" onClick={syncGmail} disabled={busy || !gmail.connected}>
            <RefreshCw className="size-4" />
            Sync Gmail
          </Button>
        </div>
      </Card>

      {proposals.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Inbox className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No automation proposals yet</p>
            <p className="text-sm text-muted-foreground">
              Create demo proposals to test the approval flow before Gmail is connected.
            </p>
          </div>
          <Button onClick={createDemo} disabled={busy}>
            <Sparkles className="size-4" />
            Create demo proposals
          </Button>
        </Card>
      ) : (
        <Card className="divide-y divide-border/60 p-0">
          {proposals.map((p) => {
            const amount = amountMeta(p.kind);
            const reviewable = REVIEWABLE.has(p.status);
            return (
              <div key={p.id} className="space-y-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {p.description || p.merchantName || p.rawEmail?.subject || p.kind}
                      </p>
                      <Badge variant={statusVariant(p.status)}>{p.status.replace("_", " ").toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{accountLine(p)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-mono text-sm font-semibold tabular-nums", amount.className)}>
                      {amount.sign}
                      {formatINR(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDate(p.date)}</p>
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="min-w-0 space-y-1">
                    {p.rawEmail ? (
                      <>
                        <p className="truncate">
                          <span className="text-foreground/75">Email:</span> {p.rawEmail.subject ?? "No subject"}
                        </p>
                        <p className="truncate">{p.rawEmail.from ?? "Unknown sender"}</p>
                      </>
                    ) : (
                      <p>No source email attached</p>
                    )}
                    <p className="truncate">
                      <span className="text-foreground/75">Category:</span> {p.category?.name ?? "Uncategorized"}
                      {p.confidence != null ? ` · confidence ${Math.round(p.confidence * 100)}%` : ""}
                    </p>
                    {p.extractionNotes ? <p className="truncate">{p.extractionNotes}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {reviewable ? (
                      <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditing(p)}
                        disabled={busy}
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approve(p.id)}
                        disabled={busy}
                      >
                        <CheckCircle2 className="size-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => duplicate(p.id)}
                        disabled={busy}
                      >
                        <CopyCheck className="size-4" />
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => reject(p.id)}
                        disabled={busy}
                      >
                        <CircleSlash2 className="size-4" />
                        Reject
                      </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reopen(p)}
                        disabled={busy}
                      >
                        <RotateCcw className="size-4" />
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {editing ? (
        <EditProposalDialog
          open={editing !== null}
          onOpenChange={(v) => !v && setEditing(null)}
          proposal={editing}
          txnTypes={txnTypes}
          categories={categories}
          accounts={accounts}
        />
      ) : null}
    </div>
  );
}

function EditProposalDialog({
  open,
  onOpenChange,
  proposal,
  txnTypes,
  categories,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposal: AutomationProposalItem;
  txnTypes: TxnType[];
  categories: Category[];
  accounts: Account[];
}) {
  const usableTypes = txnTypes.filter((t) => t.kind !== "ADJUSTMENT");
  const initialTypeId = usableTypes.find((t) => t.kind === proposal.kind)?.id ?? usableTypes[0]?.id ?? "";
  const [typeId, setTypeId] = useState(initialTypeId);
  const [amount, setAmount] = useState(String(proposal.amount));
  const [date, setDate] = useState(proposal.date);
  const [description, setDescription] = useState(proposal.description ?? "");
  const [merchantName, setMerchantName] = useState(proposal.merchantName ?? "");
  const [note, setNote] = useState(proposal.note ?? "");
  const [categoryId, setCategoryId] = useState(proposal.categoryId ?? NONE);
  const [fromAccountId, setFromAccountId] = useState(proposal.fromAccountId ?? "");
  const [toAccountId, setToAccountId] = useState(proposal.toAccountId ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const kind = usableTypes.find((t) => t.id === typeId)?.kind ?? "";
  const needsFrom = NEEDS_FROM.has(kind);
  const needsTo = NEEDS_TO.has(kind);

  function submit() {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }

    const fd = new FormData();
    fd.set("id", proposal.id);
    fd.set("typeId", typeId);
    fd.set("amount", amount);
    fd.set("date", date);
    if (needsFrom) fd.set("fromAccountId", fromAccountId);
    if (needsTo) fd.set("toAccountId", toAccountId);
    fd.set("categoryId", categoryId === NONE ? "" : categoryId);
    fd.set("description", description);
    fd.set("merchantName", merchantName);
    fd.set("note", note);

    startTransition(async () => {
      try {
        await updateTransactionProposal(fd);
        toast.success("Proposal updated");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit proposal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={typeId}
              onValueChange={(v) => setTypeId(v ?? "")}
              items={usableTypes.map((t) => ({ label: t.name, value: t.id }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {usableTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="proposal-amount">Amount</Label>
              <Input
                id="proposal-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-date">Date</Label>
              <Input id="proposal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {needsFrom ? (
            <AccountSelect
              label={kind === "EXPENSE" ? "Account" : "From"}
              value={fromAccountId}
              onChange={setFromAccountId}
              accounts={accounts}
            />
          ) : null}
          {needsTo ? (
            <AccountSelect label="To" value={toAccountId} onChange={setToAccountId} accounts={accounts} />
          ) : null}

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => setCategoryId(v ?? NONE)}
              items={[
                { label: "Uncategorized", value: NONE },
                ...categories.map((c) => ({ label: c.name, value: c.id })),
              ]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Uncategorized</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-description">Description</Label>
            <Input
              id="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Netflix subscription"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="proposal-merchant">Merchant</Label>
              <Input id="proposal-merchant" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposal-note">Note</Label>
              <Input id="proposal-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accounts: Account[];
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? "")}
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
  );
}
