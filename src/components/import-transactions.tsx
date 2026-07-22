"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { importTransactions, type ImportRow, type ImportResult } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Account = { id: string; name: string; typeName: string };
type Category = { id: string; name: string };
type DateFormat = "DMY" | "MDY" | "YMD";
type AmountMode = "single" | "debitCredit";

const NONE = "__none__";
const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: "DMY", label: "DD/MM/YYYY" },
  { value: "MDY", label: "MM/DD/YYYY" },
  { value: "YMD", label: "YYYY-MM-DD" },
];

const DATE_HINTS = ["date", "transaction date", "txn date", "value date"];
const DESC_HINTS = ["description", "narration", "details", "particulars", "memo", "note"];
const AMOUNT_HINTS = ["amount", "value"];
const DEBIT_HINTS = ["debit", "withdrawal", "dr"];
const CREDIT_HINTS = ["credit", "deposit", "cr"];

function guessColumn(headers: string[], hints: string[]): string {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h === hint);
    if (idx !== -1) return headers[idx];
  }
  for (const hint of hints) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx !== -1) return headers[idx];
  }
  return NONE;
}

function parseDate(raw: string, format: DateFormat): string | null {
  const s = raw.trim();
  if (!s) return null;
  const parts = s.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length === 3) {
    let y: number, m: number, d: number;
    if (format === "YMD") [y, m, d] = parts.map(Number);
    else if (format === "MDY") [m, d, y] = parts.map(Number);
    else [d, m, y] = parts.map(Number);
    if (y < 100) y += 2000;
    if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
}

export function ImportTransactions({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const [accountId, setAccountId] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");

  const [dateCol, setDateCol] = useState(NONE);
  const [dateFormat, setDateFormat] = useState<DateFormat>("DMY");
  const [descCol, setDescCol] = useState(NONE);
  const [categoryCol, setCategoryCol] = useState(NONE);
  const [amountMode, setAmountMode] = useState<AmountMode>("single");
  const [amountCol, setAmountCol] = useState(NONE);
  const [debitCol, setDebitCol] = useState(NONE);
  const [creditCol, setCreditCol] = useState(NONE);

  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onFile(file: File) {
    setFileName(file.name);
    setResult(null);
    file.text().then((text) => {
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const fields = parsed.meta.fields ?? [];
      setHeaders(fields);
      setRows(parsed.data);
      setDateCol(guessColumn(fields, DATE_HINTS));
      setDescCol(guessColumn(fields, DESC_HINTS));
      setCategoryCol(guessColumn(fields, ["category"]));
      const amountGuess = guessColumn(fields, AMOUNT_HINTS);
      if (amountGuess !== NONE) {
        setAmountMode("single");
        setAmountCol(amountGuess);
      } else {
        const debitGuess = guessColumn(fields, DEBIT_HINTS);
        const creditGuess = guessColumn(fields, CREDIT_HINTS);
        if (debitGuess !== NONE || creditGuess !== NONE) {
          setAmountMode("debitCredit");
          setDebitCol(debitGuess);
          setCreditCol(creditGuess);
        }
      }
    });
  }

  const categoryByName = useMemo(
    () => new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id])),
    [categories],
  );

  function rowToAmount(row: Record<string, string>): number | null {
    if (amountMode === "single") {
      if (amountCol === NONE) return null;
      const n = Number(String(row[amountCol] ?? "").replace(/[,₹\s]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    const debit = Number(String(row[debitCol] ?? "0").replace(/[,₹\s]/g, "")) || 0;
    const credit = Number(String(row[creditCol] ?? "0").replace(/[,₹\s]/g, "")) || 0;
    if (!debit && !credit) return null;
    return credit - debit;
  }

  const preview = rows.slice(0, 10);
  const ready =
    accountId &&
    rows.length > 0 &&
    dateCol !== NONE &&
    (amountMode === "single" ? amountCol !== NONE : debitCol !== NONE || creditCol !== NONE);

  function submit() {
    const importRows: ImportRow[] = [];
    for (const row of rows) {
      const date = dateCol !== NONE ? parseDate(row[dateCol] ?? "", dateFormat) : null;
      const amount = rowToAmount(row);
      if (!date || amount == null) continue;
      const description = descCol !== NONE ? (row[descCol] ?? "").trim() || null : null;
      const categoryRaw = categoryCol !== NONE ? (row[categoryCol] ?? "").trim().toLowerCase() : "";
      const categoryId = categoryRaw ? (categoryByName.get(categoryRaw) ?? null) : null;
      importRows.push({ date, description, amount, categoryId });
    }
    startTransition(async () => {
      try {
        const res = await importTransactions({ accountId, rows: importRows });
        setResult(res);
        if (res.imported > 0) toast.success(`Imported ${res.imported} transaction${res.imported === 1 ? "" : "s"}`);
        if (res.skipped > 0) toast.error(`Skipped ${res.skipped} row${res.skipped === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Account</Label>
        <Select
          value={accountId}
          onValueChange={(v) => setAccountId(v ?? "")}
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

      <div className="space-y-2">
        <Label htmlFor="csv-file">CSV file</Label>
        <label
          htmlFor="csv-file"
          className="surface-panel flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <UploadCloud className="size-6" />
          {fileName || "Click to choose a CSV file"}
        </label>
        <Input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
      </div>

      {headers.length > 0 ? (
        <>
          <Card className="space-y-4 p-4">
            <p className="text-sm font-medium">Map columns</p>
            <div className="grid grid-cols-2 gap-3">
              <ColumnSelect label="Date column" value={dateCol} onChange={setDateCol} headers={headers} />
              <div className="space-y-2">
                <Label>Date format</Label>
                <Select value={dateFormat} onValueChange={(v) => setDateFormat((v as DateFormat) ?? "DMY")} items={DATE_FORMATS}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ColumnSelect label="Description column" value={descCol} onChange={setDescCol} headers={headers} optional />
              <ColumnSelect label="Category column" value={categoryCol} onChange={setCategoryCol} headers={headers} optional />
            </div>

            <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium w-fit">
              {(["single", "debitCredit"] as AmountMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setAmountMode(m)}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    amountMode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {m === "single" ? "Single amount column" : "Separate debit/credit"}
                </button>
              ))}
            </div>

            {amountMode === "single" ? (
              <ColumnSelect label="Amount column (negative = expense)" value={amountCol} onChange={setAmountCol} headers={headers} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <ColumnSelect label="Debit column" value={debitCol} onChange={setDebitCol} headers={headers} optional />
                <ColumnSelect label="Credit column" value={creditCol} onChange={setCreditCol} headers={headers} optional />
              </div>
            )}
          </Card>

          <Card className="space-y-2 p-4">
            <p className="text-sm font-medium">Preview (first {preview.length} rows)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 pr-3">Date</th>
                    <th className="py-1 pr-3">Description</th>
                    <th className="py-1 pr-3">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => {
                    const amount = rowToAmount(row);
                    return (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1.5 pr-3 font-mono tabular-nums">
                          {dateCol !== NONE ? (parseDate(row[dateCol] ?? "", dateFormat) ?? "invalid") : "—"}
                        </td>
                        <td className="py-1.5 pr-3 truncate">{descCol !== NONE ? row[descCol] : "—"}</td>
                        <td
                          className={cn(
                            "py-1.5 pr-3 font-mono tabular-nums",
                            amount == null ? "text-muted-foreground" : amount < 0 ? "text-rose-400" : "text-emerald-400",
                          )}
                        >
                          {amount == null ? "invalid" : amount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {result ? (
        <Card className="space-y-2 p-4 text-sm">
          <p className="font-medium">
            Imported {result.imported} · Skipped {result.skipped}
          </p>
          {result.errors.length > 0 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {result.errors.slice(0, 8).map((e, i) => (
                <li key={i}>
                  Row {e.row + 1}: {e.reason}
                </li>
              ))}
              {result.errors.length > 8 ? <li>…and {result.errors.length - 8} more</li> : null}
            </ul>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => router.push("/transactions")}>
            Back to Activity
          </Button>
        </Card>
      ) : (
        <Button onClick={submit} disabled={!ready || pending} size="lg" className="h-12 w-full text-base">
          {pending ? "Importing…" : `Import ${rows.length ? `${rows.length} rows` : ""}`}
        </Button>
      )}
    </div>
  );
}

function ColumnSelect({
  label,
  value,
  onChange,
  headers,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  headers: string[];
  optional?: boolean;
}) {
  const items = [...(optional ? [{ label: "None", value: NONE }] : []), ...headers.map((h) => ({ label: h, value: h }))];
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? NONE)} items={items}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
