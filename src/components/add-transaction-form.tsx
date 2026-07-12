"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createTransaction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function AddTransactionForm({
  txnTypes,
  categories,
  accounts,
}: {
  txnTypes: TxnType[];
  categories: Category[];
  accounts: Account[];
}) {
  const usableTypes = txnTypes.filter((t) => t.kind !== "ADJUSTMENT");
  const [typeId, setTypeId] = useState(usableTypes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const kind = useMemo(() => usableTypes.find((t) => t.id === typeId)?.kind ?? "", [typeId, usableTypes]);
  const needsFrom = NEEDS_FROM.has(kind);
  const needsTo = NEEDS_TO.has(kind);
  const fromLabel = kind === "INCOME" ? "" : kind === "EXPENSE" ? "Account" : "From";
  const toLabel = kind === "INCOME" ? "To" : "To";

  function submit() {
    if (!amount || Number(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    const fd = new FormData();
    fd.set("typeId", typeId);
    fd.set("amount", amount);
    fd.set("date", date);
    if (needsFrom) fd.set("fromAccountId", fromAccountId);
    if (needsTo) fd.set("toAccountId", toAccountId);
    fd.set("categoryId", categoryId);
    fd.set("description", description);

    startTransition(async () => {
      try {
        await createTransaction(fd);
        toast.success("Saved");
        router.push("/");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Type segmented control */}
      <div className="flex flex-wrap gap-2">
        {usableTypes.map((t) => (
          <button
            key={t.id}
            onClick={() => setTypeId(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              typeId === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-muted-foreground">₹</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0"
          autoFocus
          className="w-full bg-transparent text-5xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
        />
      </div>

      <div className="space-y-4">
        {needsFrom && (
          <AccountSelect
            label={fromLabel}
            value={fromAccountId}
            onChange={setFromAccountId}
            accounts={accounts}
          />
        )}
        {needsTo && (
          <AccountSelect
            label={toLabel}
            value={toAccountId}
            onChange={setToAccountId}
            accounts={accounts}
          />
        )}

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
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Note</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Zomato"
            />
          </div>
        </div>
      </div>

      <Button onClick={submit} disabled={pending} size="lg" className="h-12 w-full text-base">
        {pending ? "Saving…" : "Save transaction"}
      </Button>
    </div>
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
