import { useQuery } from "@tanstack/react-query";
import { TOKENS, type TokenId } from "./wallet-store";

export interface MarketRow {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d?: { price: number[] };
}

function marketIds() {
  return Array.from(new Set(TOKENS.map((t) => t.cgId).filter(Boolean))).join(",");
}

async function fetchMarkets(): Promise<MarketRow[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${marketIds()}&order=market_cap_desc&sparkline=true&price_change_percentage=24h`,
  );
  if (!res.ok) throw new Error("Failed to load market data");
  return (await res.json()) as MarketRow[];
}

export function useMarkets() {
  return useQuery({
    queryKey: ["markets", TOKENS.length],
    queryFn: fetchMarkets,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export type PriceMap = Record<
  TokenId,
  { price: number; change: number; image: string; sparkline: number[] }
>;

export function toPriceMap(rows: MarketRow[] | undefined): PriceMap {
  const map = {} as PriceMap;
  for (const t of TOKENS) {
    const row = rows?.find((r) => r.id === t.cgId);
    map[t.id] = {
      price: row?.current_price ?? 0,
      change: row?.price_change_percentage_24h ?? 0,
      image: row?.image || t.logo || "",
      sparkline: row?.sparkline_in_7d?.price ?? [],
    };
  }
  return map;
}

export function usePrices() {
  const q = useMarkets();
  return { prices: toPriceMap(q.data), rows: q.data ?? [], isLoading: q.isLoading, error: q.error };
}
