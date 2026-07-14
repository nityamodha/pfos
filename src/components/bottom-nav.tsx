"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Plus, ArrowLeftRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/add", label: "Add", icon: Plus, primary: true },
  { href: "/transactions", label: "Activity", icon: ArrowLeftRight },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="surface-panel fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border md:hidden">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary),transparent_50%),0_10px_26px_-6px_var(--primary)] transition-transform active:scale-95"
              >
                <Icon className="size-7" strokeWidth={2.5} />
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
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
  );
}
