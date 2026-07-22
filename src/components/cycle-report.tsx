"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CycleReport as CycleReportData } from "@/lib/cycles-shared";
import { formatINR } from "@/lib/format";
import { Card } from "@/components/ui/card";

export function CycleReport({ report }: { report: CycleReportData }) {
  if (report.cycles.length === 0) return null;
  const latest = report.cycles[report.cycles.length - 1];

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">Statement cycles</h2>
      <Card className="gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Closing balance · last {report.cycles.length} cycles
          </p>
          <p className="font-mono text-2xl font-semibold tabular-nums text-rose-400">
            {formatINR(latest.closingOwed)}
          </p>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={report.cycles} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="cycleLabel"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(value: unknown) => [formatINR(Number(value)), "Closing balance"] as [string, string]}
              />
              <Bar dataKey="closingOwed" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="divide-y divide-border/60 p-0">
        {[...report.cycles].reverse().map((c) => (
          <div key={c.closeDate} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Cycle closed {c.cycleLabel}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.dueDate ? `Due ${fmtEventDate(c.dueDate)}` : "No due date"} · {formatINR(c.charges)} charged ·{" "}
                {formatINR(c.payments)} paid
              </p>
            </div>
            <span className="font-mono text-sm font-semibold tabular-nums text-rose-400">
              {formatINR(c.closingOwed)}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}

function fmtEventDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
}
