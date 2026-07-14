"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Plus, ArrowLeftRight, Settings, CalendarClock, Zap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth-actions";

const items = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/planned", label: "Planned", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <aside className="surface-panel fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
        <span className="icon-chip icon-chip-accent size-8">
          <Zap className="size-4" strokeWidth={2.5} />
        </span>
        <span className="font-heading text-sm font-semibold tracking-tight">PFOS</span>
      </Link>

      <Link
        href="/add"
        className="mb-6 flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary),transparent_55%),0_10px_24px_-10px_var(--primary)] transition-transform hover:brightness-110 active:scale-[0.98]"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Add
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                  : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
              )}
            >
              <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
        >
          <LogOut className="size-4.5" strokeWidth={2} />
          Log out
        </button>
      </form>
    </aside>
  );
}
