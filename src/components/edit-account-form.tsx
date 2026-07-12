"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updateAccount, archiveAccount } from "@/lib/actions";
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
  hasStatementCycle: boolean;
};

type AccountData = {
  id: string;
  name: string;
  institution: string | null;
  typeId: string;
  statementDayOfMonth: number | null;
  dueDayOfMonth: number | null;
};

export function EditAccountForm({
  account,
  accountTypes,
}: {
  account: AccountData;
  accountTypes: AccountType[];
}) {
  const [open, setOpen] = useState(false);
  const [typeId, setTypeId] = useState(account.typeId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const hasStatementCycle = accountTypes.find((t) => t.id === typeId)?.hasStatementCycle ?? false;
  const typeItems = accountTypes.map((t) => ({ label: t.name, value: t.id }));

  function onSubmit(formData: FormData) {
    formData.set("id", account.id);
    formData.set("accountTypeId", typeId);
    startTransition(async () => {
      try {
        await updateAccount(formData);
        toast.success("Account updated");
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function onArchive() {
    if (!confirm(`Archive ${account.name}? It will be hidden from your accounts and net worth.`)) return;
    const fd = new FormData();
    fd.set("id", account.id);
    startTransition(async () => {
      try {
        await archiveAccount(fd);
        toast.success("Account archived");
        router.push("/accounts");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="size-4" /> Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit account</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" name="name" defaultValue={account.name} required />
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
            <Label htmlFor="edit-institution">Institution (optional)</Label>
            <Input
              id="edit-institution"
              name="institution"
              defaultValue={account.institution ?? ""}
            />
          </div>

          {hasStatementCycle ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-statement">Statement day</Label>
                <Input
                  id="edit-statement"
                  name="statementDayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={account.statementDayOfMonth ?? ""}
                  placeholder="e.g. 25"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-due">Due day</Label>
                <Input
                  id="edit-due"
                  name="dueDayOfMonth"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={account.dueDayOfMonth ?? ""}
                  placeholder="e.g. 15"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={onArchive}
              className="w-full"
            >
              Archive account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
