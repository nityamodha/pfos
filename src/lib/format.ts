// Client-safe formatting helpers (no server/Prisma imports).

/** Indian formatting: ₹1,23,456 (or ₹1.2L compact). */
export function formatINR(amount: number, opts?: { compact?: boolean; sign?: boolean }): string {
  const sign = amount < 0 ? "-" : opts?.sign && amount > 0 ? "+" : "";
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: opts?.compact ? 1 : 0,
    notation: opts?.compact ? "compact" : "standard",
    compactDisplay: "short",
  }).format(abs);
  return `${sign}₹${formatted}`;
}
