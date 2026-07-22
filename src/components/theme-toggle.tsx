"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex rounded-full bg-muted p-0.5 text-xs font-medium">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          // Theme is only known client-side, so this class can legitimately differ
          // between the server-rendered guess and the hydrated client value.
          suppressHydrationWarning
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            theme === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
