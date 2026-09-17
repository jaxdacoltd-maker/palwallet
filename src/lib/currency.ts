import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
}

/** Fiat currencies the wallet can display values in. */
export const CURRENCIES: Currency[] = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", flag: "🇳🇬" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz", flag: "🇦🇴" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "₵", flag: "🇬🇭" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", flag: "🇰🇪" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£", flag: "🇪🇬" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "DH", flag: "🇲🇦" },
  { code: "XOF", name: "West African CFA", symbol: "CFA", flag: "🌍" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "AED", name: "UAE Dirham", symbol: "AED", flag: "🇦🇪" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
];

export const currencyByCode = (code: string) =>
  CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]!;

const KEY = "sp_currency";
let current = "USD";
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  const saved = localStorage.getItem(KEY);
  if (saved && CURRENCIES.some((c) => c.code === saved)) current = saved;
}

export function setCurrency(code: string) {
  current = code;
  if (typeof window !== "undefined") localStorage.setItem(KEY, code);
  listeners.forEach((l) => l());
}

export function useCurrencyCode() {
  return useSyncExternalStore(
    (cb) => {
      load();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return current;
    },
    () => "USD",
  );
}

export type FxRates = Record<string, number>;

async function fetchRates(): Promise<FxRates> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error("Failed to load exchange rates");
  const json = (await res.json()) as { rates?: FxRates };
  return json.rates ?? { USD: 1 };
}

export function useFxRates() {
  return useQuery({
    queryKey: ["fx-rates"],
    queryFn: fetchRates,
    staleTime: 60 * 60_000,
    refetchInterval: 60 * 60_000,
  });
}

/** Format a USD amount in the user's selected currency. */
export function formatFiat(usd: number, code: string, rates: FxRates | undefined, maxFrac?: number) {
  const rate = rates?.[code] ?? (code === "USD" ? 1 : undefined);
  const c = currencyByCode(code);
  if (rate === undefined) return `${currencyByCode("USD").symbol}${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const value = usd * rate;
  const digits = maxFrac ?? (Math.abs(value) >= 1 ? 2 : 6);
  return `${c.symbol}${value.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

/** Convenience hook returning a ready-to-use formatter. */
export function useFiat() {
  const code = useCurrencyCode();
  const { data: rates } = useFxRates();
  const fmt = (usd: number, maxFrac?: number) => formatFiat(usd, code, rates, maxFrac);
  return { code, rates, fmt, currency: currencyByCode(code) };
}
