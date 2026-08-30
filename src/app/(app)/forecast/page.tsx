import Link from "next/link";
import { ChevronLeft, CalendarClock } from "lucide-react";
import { getFullTimeline } from "@/lib/full-timeline";
import { FullTimelineChart } from "@/components/full-timeline-chart";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const timeline = await getFullTimeline();

  return (
    <div className="space-y-4 pt-2">
      <Link
        href="/"
        className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ChevronLeft className="size-4" /> Home
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
        <p className="text-sm text-muted-foreground">
          Full history through the next 3 months — scroll to see further back or further ahead.
        </p>
      </div>

      {!timeline.hasTarget ? (
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
      ) : (
        <>
          <FullTimelineChart
            title={`${timeline.targetName} · cash flow`}
            points={timeline.cashFlow}
            todayDate={timeline.todayDate!}
            accent="var(--chart-1)"
          />
          <FullTimelineChart
            title="Net worth"
            points={timeline.netWorth}
            todayDate={timeline.todayDate!}
            accent="var(--chart-3)"
          />
        </>
      )}
    </div>
  );
}
