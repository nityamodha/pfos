import { Prisma } from "@/generated/prisma/client";
import type { AccountNature } from "@/generated/prisma/client";

export { formatINR } from "@/lib/format";

export type DecimalLike = Prisma.Decimal | number | string;

export function toDecimal(v: DecimalLike): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

export function toNumber(v: DecimalLike | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return new Prisma.Decimal(v).toNumber();
}

/**
 * Convert a stored net-worth-frame signed balance into the number we show the
 * user for an account: assets positive when funded, liabilities positive when owed.
 */
export function displayBalance(signed: DecimalLike, nature: AccountNature): number {
  const n = toNumber(signed);
  return nature === "LIABILITY" ? -n : n;
}

