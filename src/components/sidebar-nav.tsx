"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Plus, ArrowLeftRight, Settings, CalendarClock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <aside className="glass-panel fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/50 px-4 py-6 md:flex">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <span
          className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-cyan-400 text-white ring-1 ring-white/60"
          style={{
            boxShadow:
              "inset 0 1px 0 0 rgba(255,255,255,0.5), inset 0 -2px 3px 0 rgba(0,0,0,0.15), 0 6px 16px -4px var(--primary)",
          }}
        >
          <Sparkles className="size-4" strokeWidth={2.5} />
        </span>
        <span className="text-sm font-semibold tracking-tight">PFOS</span>
      </Link>

      <Link
        href="/add"
        className="mb-6 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/60 transition-transform hover:scale-[1.02] active:scale-[0.98]"
        style={{
          boxShadow:
            "inset 0 1px 0 0 rgba(255,255,255,0.5), inset 0 -2px 3px 0 rgba(0,0,0,0.15), 0 8px 20px -6px var(--primary)",
        }}
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
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6),0_2px_6px_-2px_rgba(60,40,130,0.25)] ring-1 ring-inset ring-white/50"
                  : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
              )}
            >
              <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
