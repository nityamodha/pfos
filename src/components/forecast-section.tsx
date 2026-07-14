"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, TrendingDown } from "lucide-react";
import type { Forecast, ForecastPoint } from "@/lib/forecast-shared";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";

export function ForecastSection({ forecast }: { forecast: Forecast }) {
  const [cardId, setCardId] = useState("");
  const [amountStr, setAmountStr] = useState("");

  const simCard = forecast.cards.find((c) => c.id === cardId) ?? null;
  const simAmount = Number(amountStr) || 0;
  const simActive = simCard != null && simAmount > 0 && simCard.settlesToTarget;

  // Apply the hypothetical card spend: subtract it from every point on/after its due date.
  const { points, lowPoint, endBalance } = useMemo(() => {
    let pts: ForecastPoint[] = forecast.points;
    if (simActive && simCard) {
      pts = forecast.points.map((p) =>
        p.date >= simCard.unbilledDueDate ? { ...p, balance: p.balance - simAmount } : p,
      );
    }
    let low = pts[0] ?? null;
    for (const p of pts) if (low && p.balance < low.balance) low = p;
    return { points: pts, lowPoint: low, endBalance: pts.length ? pts[pts.length - 1].balance : 0 };
  }, [forecast.points, simActive, simCard, simAmount]);

  if (!forecast.hasTarget) {
    return (
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Forecast</h2>
        <Card className="flex flex-col items-center gap-3 p-6 text-center">
          <CalendarClock className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Pick a primary account to project your cash flow. Open an account and turn on{" "}
            <span className="font-medium text-foreground">&ldquo;Primary account for forecast.&rdquo;</span>
          </p>
          <Link href="/accounts" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Choose account
          </Link>
        </Card>
      </section>
    );
  }

  const negative = (lowPoint?.balance ?? 0) < 0;
  const upcoming = forecast.events.slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">Forecast</h2>
        <Link href="/planned" className="text-sm font-medium text-primary">
          Manage plan
        </Link>
      </div>

      <Card className="gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {forecast.targetName} · next {forecast.days} days
            </p>
            <p className="font-mono text-2xl font-semibold tabular-nums">{formatINR(endBalance)}</p>
          </div>
          {lowPoint ? (
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <TrendingDown className="size-3.5" /> Lowest
              </p>
              <p className={cn("font-mono text-sm font-semibold tabular-nums", negative && "text-rose-400")}>
                {formatINR(lowPoint.balance)}
              </p>
              <p className="text-xs text-muted-foreground">{lowPoint.label}</p>
            </div>
          ) : null}
        </div>

        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="fill-forecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={negative ? "var(--destructive)" : "var(--chart-1)"} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={negative ? "var(--destructive)" : "var(--chart-1)"} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <Tooltip
                cursor={{ stroke: "var(--border)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(value: unknown) => [formatINR(Number(value)), "Balance"] as [string, string]}
              />
              <Area
                type="monotone"
                dataKey="balance"
                name="Balance"
                stroke={negative ? "var(--destructive)" : "var(--chart-1)"}
                strokeWidth={2}
                fill="url(#fill-forecast)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* What-if simulator */}
        {forecast.cards.length ? (
          <div className="space-y-2 rounded-xl bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">What if I spend…</p>
            <div className="flex gap-2">
              <Input
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                inputMode="decimal"
                placeholder="Amount"
                className="w-28"
              />
              <Select
                value={cardId}
                onValueChange={(v) => setCardId(v ?? "")}
                items={forecast.cards.map((c) => ({ label: c.name, value: c.id }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="on card…" />
                </SelectTrigger>
                <SelectContent>
                  {forecast.cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {simCard && simAmount > 0 ? (
              simCard.settlesToTarget ? (
                <p className="text-xs text-muted-foreground">
                  {formatINR(simAmount)} on {simCard.name} settles from {forecast.targetName} on{" "}
                  <span className="font-medium text-foreground">{simCard.unbilledDueLabel}</span>
                  {negative ? (
                    <span className="text-rose-400"> · dips you below ₹0</span>
                  ) : (
                    <span> · lowest becomes {formatINR(lowPoint?.balance ?? 0)}</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {simCard.name} isn&rsquo;t set to settle from {forecast.targetName}, so it won&rsquo;t affect this
                  forecast. Set its settlement account on the card.
                </p>
              )
            ) : null}
          </div>
        ) : null}
      </Card>

      {/* Upcoming events */}
      {upcoming.length ? (
        <Card className="divide-y divide-border/60 p-0">
          {upcoming.map((e) => {
            const inflow = e.amount >= 0;
            return (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{fmtEventDate(e.date)}</p>
                </div>
                <span
                  className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    inflow ? "text-emerald-400" : "text-rose-400",
                  )}
                >
                  {inflow ? "+" : "−"}
                  {formatINR(Math.abs(e.amount))}
                </span>
              </div>
            );
          })}
        </Card>
      ) : null}
    </section>
  );
}

function fmtEventDate(isoDate: string) {
  const d = new Date(isoDate + "T00:00:00");
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" }).format(d);
}
