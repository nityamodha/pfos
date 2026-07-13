import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getMasterData } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { logout } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { accountTypes, categories, txnTypes } = await getMasterData();

  return (
    <div className="space-y-6">
      <h1 className="pt-4 text-2xl font-semibold tracking-tight">Settings</h1>

      <Card className="p-0">
        <Link
          href="/planned"
          className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <div>
            <p className="text-sm font-medium">Planned money</p>
            <p className="text-xs text-muted-foreground">Salary, SIPs and EMIs for the forecast</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </Card>

      <Section title="Account types" hint="Editable master data">
        {accountTypes.map((t) => (
          <Row key={t.id} label={t.name}>
            <Badge variant={t.nature === "LIABILITY" ? "destructive" : "secondary"}>
              {t.nature.toLowerCase()}
            </Badge>
          </Row>
        ))}
      </Section>

      <Section title="Transaction types">
        {txnTypes.map((t) => (
          <Row key={t.id} label={t.name}>
            <span className="text-xs text-muted-foreground">{t.kind.toLowerCase()}</span>
          </Row>
        ))}
      </Section>

      <Section title="Categories">
        {categories.map((c) => (
          <Row key={c.id} label={c.name}>
            {c.kind ? (
              <span className="text-xs text-muted-foreground">{c.kind.toLowerCase()}</span>
            ) : null}
          </Row>
        ))}
      </Section>

      <p className="px-1 text-xs text-muted-foreground">
        Editing master data in-app is coming next. These values are seeded and fully configurable in
        the database today.
      </p>

      <form action={logout}>
        <button type="submit" className={buttonVariants({ variant: "outline", className: "w-full" })}>
          Log out
        </button>
      </form>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground/70">{hint}</span> : null}
      </div>
      <Card className="divide-y divide-border/60 p-0">{children}</Card>
    </section>
  );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
