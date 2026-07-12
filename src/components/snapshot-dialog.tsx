"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { saveSnapshot } from "@/lib/actions";
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

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export function SnapshotDialog({
  account,
}: {
  account: {
    id: string;
    name: string;
    isInvestment: boolean;
    displayBalance: number;
    invested: number | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocal());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    formData.set("accountId", account.id);
    formData.set("date", date);
    startTransition(async () => {
      try {
        await saveSnapshot(formData);
        toast.success(account.isInvestment ? "Value updated" : "Balance reconciled");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <RefreshCw className="size-4" />
        {account.isInvestment ? "Update value" : "Reconcile"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {account.isInvestment ? "Update value" : "Reconcile balance"} · {account.name}
          </DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          {account.isInvestment ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="investedValue">Invested value</Label>
                <Input
                  id="investedValue"
                  name="investedValue"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  defaultValue={account.invested ?? ""}
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
                  autoFocus
                  defaultValue={account.displayBalance}
                  placeholder="0"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="actualBalance">Actual balance</Label>
              <Input
                id="actualBalance"
                name="actualBalance"
                type="number"
                inputMode="decimal"
                step="0.01"
                autoFocus
                defaultValue={account.displayBalance}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                We&apos;ll post an adjustment so your balance matches this exactly.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="snap-date">As of</Label>
            <Input
              id="snap-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
