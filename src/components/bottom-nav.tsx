"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Bot,
  CalendarClock,
  Home,
  MoreHorizontal,
  Plus,
  Settings,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/add", label: "Add", icon: Plus, primary: true },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "#more", label: "More", icon: MoreHorizontal, more: true },
];

const moreItems = [
  { href: "/automation", label: "Automation", icon: Bot },
  { href: "/planned", label: "Planned", icon: CalendarClock },
  { href: "/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      {open ? (
        <div className="surface-panel fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 rounded-xl border border-sidebar-border p-2 md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {moreItems.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    active ? "bg-sidebar-accent text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                  )}
                >
                  <Icon className="size-4.5" strokeWidth={active ? 2.5 : 2} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="surface-panel fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border md:hidden">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {items.map(({ href, label, icon: Icon, primary, more }) => {
            const active = more ? moreActive || open : href === "/" ? pathname === "/" : pathname.startsWith(href);
            if (primary) {
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  onClick={() => setOpen(false)}
                  className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary),transparent_50%),0_10px_26px_-6px_var(--primary)] transition-transform active:scale-95"
                >
                  <Icon className="size-7" strokeWidth={2.5} />
                </Link>
              );
            }
            if (more) {
              return (
                <button
                  key={href}
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpen((v) => !v)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                  {label}
                </button>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
