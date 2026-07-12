import {
  Landmark,
  Wallet,
  CreditCard,
  ChartLine,
  TrendingUp,
  PiggyBank,
  Coins,
  HandCoins,
  Circle,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  landmark: Landmark,
  wallet: Wallet,
  "credit-card": CreditCard,
  "chart-line": ChartLine,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  coins: Coins,
  "hand-coins": HandCoins,
  circle: Circle,
};

export function accountIcon(name: string | null | undefined): LucideIcon {
  return (name && map[name]) || Circle;
}
