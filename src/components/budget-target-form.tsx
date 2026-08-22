"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSavingsTarget } from "@/lib/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function BudgetTargetForm({ initialTarget }: { initialTarget: number }) {
  const [value, setValue] = useState(String(initialTarget));
  const [pending, startTransition] = useTransition();

  function save() {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    startTransition(async () => {
      await updateSavingsTarget(amount);
      toast.success("Savings target updated");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step={100}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-32 font-mono tabular-nums"
      />
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
