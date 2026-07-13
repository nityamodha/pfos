// Client-safe types for the cash-flow forecast (no server-only / Prisma imports).

export type ForecastEventKind = "salary" | "income" | "sip" | "emi" | "expense" | "bill";

export type ForecastEvent = {
  id: string;
  date: string; // ISO date (yyyy-mm-dd)
  label: string;
  amount: number; // signed: + inflow, − outflow
  kind: ForecastEventKind;
};

export type ForecastPoint = {
  date: string; // ISO date
  label: string; // short display label
  balance: number;
};

export type ForecastCard = {
  id: string;
  name: string;
  owed: number;
  settlesToTarget: boolean; // does this card settle from the forecast's target account?
  unbilledDueDate: string; // ISO date a purchase made today would be settled
  unbilledDueLabel: string; // e.g. "5 Aug"
};

export type Forecast = {
  hasTarget: boolean;
  targetId: string | null;
  targetName: string | null;
  startBalance: number;
  endBalance: number;
  lowPoint: { date: string; label: string; balance: number } | null;
  goesNegative: boolean;
  days: number;
  points: ForecastPoint[];
  events: ForecastEvent[];
  cards: ForecastCard[];
};
