"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTransaction, deleteTransaction } from "@/lib/actions";
import type { TransactionListItem } from "@/lib/queries";
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

type TxnType = { id: string; name: string; kind: string };
type Category = { id: string; name: string };
type Account = { id: string; name: string; typeName: string };

const NEEDS_FROM = new Set(["EXPENSE", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);
const NEEDS_TO = new Set(["INCOME", "TRANSFER", "INVESTMENT", "WITHDRAWAL"]);

function dateInput(d: Date) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}

export function EditTransactionForm({
  open,
  onOpenChange,
  txn,
  txnTypes,
  categories,
  accounts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  txn: TransactionListItem;
  txnTypes: TxnType[];
  categories: Category[];
  accounts: Account[];
}) {
  const usableTypes = txnTypes.filter((t) => t.kind !== "ADJUSTMENT");
  const [typeId, setTypeId] = useState(txn.typeId);
  const [amount, setAmount] = useState(String(txn.amount));
  const [fromAccountId, setFromAccountId] = useState(txn.fromAccountId ?? "");
  const [toAccountId, setToAccountId] = useState(txn.toAccountId ?? "");
  const [categoryId, setCategoryId] = useState(txn.categoryId ?? "");
  const [date, setDate] = useState(dateInput(txn.date));
  const [description, setDescription] = useState(txn.description ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const kind = useMemo(() => usableTypes.find((t) => t.id === typeId)?.kind ?? "", [typeId, usableTypes]);
  const needsFrom = NEEDS_FROM.has(kind);
  const needsTo = NEEDS_TO.has(kind);

  function submit() {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const fd = new FormData();
    fd.set("id", txn.id);
    fd.set("typeId", typeId);
    fd.set("amount", amount);
    fd.set("date", date);
    if (needsFrom) fd.set("fromAccountId", fromAccountId);
    if (needsTo) fd.set("toAccountId", toAccountId);
    fd.set("categoryId", categoryId);
    fd.set("description", description);

    startTransition(async () => {
      try {
        await updateTransaction(fd);
        toast.success("Transaction updated");
        onOpenChange(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  function onDelete() {
    if (!confirm("Delete this transaction? This can't be undone.")) return;
    const fd = new FormData();
    fd.set("id", txn.id);
    startTransition(async () => {
      try {
        await deleteTransaction(fd);
        toast.success("Transaction deleted");
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
          <DialogTitle>Edit transaction</DialogTitle>
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

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount</Label>
            <Input
              id="edit-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
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
              onValueChange={(v) => setCategoryId(v ?? "")}
              items={categories.map((c) => ({ label: c.name, value: c.id }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-note">Note</Label>
              <Input
                id="edit-note"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Zomato"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={submit} disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={onDelete} className="w-full">
              Delete transaction
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
