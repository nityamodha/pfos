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
    <nav className="glass-panel fixed inset-x-0 bottom-0 z-50 border-t border-white/50 md:hidden">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {items.map(({ href, label, icon: Icon, primary }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="-mt-6 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 via-fuchsia-400 to-cyan-400 text-white ring-1 ring-white/60 transition-transform active:scale-95"
                style={{
                  boxShadow:
                    "inset 0 1px 0 0 rgba(255,255,255,0.5), inset 0 -2px 3px 0 rgba(0,0,0,0.15), 0 8px 20px -4px var(--primary)",
                }}
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
                active ? "text-foreground" : "text-muted-foreground",
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
