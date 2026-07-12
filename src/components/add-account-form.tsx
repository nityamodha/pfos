"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createAccount } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AccountType = {
  id: string;
  name: string;
  nature: string;
  isInvestment: boolean;
  hasStatementCycle: boolean;
};

export function AddAccountForm({ accountTypes }: { accountTypes: AccountType[] }) {
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState<string>(accountTypes[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const selected = accountTypes.find((t) => t.id === typeId);
  const isLiability = selected?.nature === "LIABILITY";
  const isInvestment = selected?.isInvestment ?? false;
  const hasStatementCycle = selected?.hasStatementCycle ?? false;
  const typeItems = accountTypes.map((t) => ({ label: t.name, value: t.id }));

  function onSubmit(formData: FormData) {
    formData.set("accountTypeId", typeId);
    startTransition(async () => {
      try {
        await createAccount(formData);
        toast.success("Account added");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Add
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="ICICI Savings" autoFocus required />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={typeId} onValueChange={(v) => setTypeId(v ?? "")} items={typeItems}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {accountTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">Institution (optional)</Label>
            <Input id="institution" name="institution" placeholder="ICICI Bank" />
          </div>

          {isInvestment ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="investedValue">Invested value</Label>
                <Input
                  id="investedValue"
                  name="investedValue"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentValue">Current value</Label>
                <Input
                  id="currentValue"
                  name="currentValue"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="openingBalance">
                {isLiability ? "Current outstanding" : "Current balance"}
              </Label>
              <Input
                id="openingBalance"
                name="openingBalance"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0"
                defaultValue="0"
              />
            </div>
          )}
          {isInvestment ? (
            <p className="text-xs text-muted-foreground">
              Current value counts toward your net worth. Invested value is stored so we can show
              your gain/loss.
            </p>
          ) : null}

          {hasStatementCycle ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="statementDayOfMonth">Statement day</Label>
                <Input
                  id="statementDayOfMonth"
                  name="statementDayOfMonth"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="e.g. 25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDayOfMonth">Due day</Label>
                <Input
                  id="dueDayOfMonth"
                  name="dueDayOfMonth"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="e.g. 15"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Adding…" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
