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
import { type ComponentProps } from "react";

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

type AccountIconProps = { icon: string | null | undefined } & ComponentProps<typeof Circle>;

export function AccountIcon({ icon, ...props }: AccountIconProps) {
  switch (icon) {
    case "landmark":
      return <Landmark {...props} />;
    case "wallet":
      return <Wallet {...props} />;
    case "credit-card":
      return <CreditCard {...props} />;
    case "chart-line":
      return <ChartLine {...props} />;
    case "trending-up":
      return <TrendingUp {...props} />;
    case "piggy-bank":
      return <PiggyBank {...props} />;
    case "coins":
      return <Coins {...props} />;
    case "hand-coins":
      return <HandCoins {...props} />;
    default:
      return <Circle {...props} />;
  }
}
