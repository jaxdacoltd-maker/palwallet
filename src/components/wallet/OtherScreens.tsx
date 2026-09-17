import { ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Star } from "lucide-react";
import { TOKENS } from "@/lib/wallet-store";
import type { PriceMap } from "@/lib/prices";
import type { MarketRow } from "@/lib/prices";
import { TokenIcon, Change } from "./TokenIcon";
import { useFiat } from "@/lib/currency";

export function MarketScreen({ prices, rows }: { prices: PriceMap; rows: MarketRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"cap" | "gain" | "loss">("cap");
  const { fmt } = useFiat();


  let list = TOKENS.map((t) => ({ t, row: rows.find((r) => r.id === t.cgId) })).filter(
    ({ t }) => t.symbol.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase()),
  );
  list = list.sort((a, b) => {
    if (sort === "cap") return (b.row?.market_cap ?? 0) - (a.row?.market_cap ?? 0);
    const d = (prices[b.t.id]?.change ?? 0) - (prices[a.t.id]?.change ?? 0);
    return sort === "gain" ? d : -d;
  });

  return (
    <div className="px-4 pb-6">
      <h1 className="py-3 text-2xl font-semibold">Market</h1>
      <Link to="/prices" className="mb-3 inline-block text-sm text-brand">
        Open live prices page →
      </Link>
      <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search coins"
          className="w-full text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-3 flex gap-2">
        {(
          [
            ["cap", "Market Cap"],
            ["gain", "Top Gainers"],
            ["loss", "Top Losers"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-3 py-1.5 text-xs ${sort === k ? "bg-brand" : "bg-surface text-muted-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mt-3 divide-y divide-border rounded-2xl bg-surface">
        {list.map(({ t, row }) => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-3">
            <TokenIcon id={t.id} prices={prices} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{t.symbol}</div>
              <div className="text-xs text-muted-foreground">
                Vol ${((row?.total_volume ?? 0) / 1e6).toFixed(1)}M
              </div>
            </div>
            <div className="text-right">
              <div className="text-[15px]">
                {fmt(prices[t.id]?.price ?? 0, 6)}
              </div>

              <div className="text-xs">
                <Change value={prices[t.id]?.change ?? 0} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TradeScreen({ prices }: { prices: PriceMap }) {
  const [tab, setTab] = useState<"trade" | "pred">("trade");
  const perps = ["btc", "eth", "sol", "bnb", "xrp", "avax", "sui", "doge"] as const;
  const { fmt } = useFiat();


  return (
    <div className="px-4 pb-6">
      <div className="mb-4 flex border-b border-border">
        {(
          [
            ["trade", "Trade"],
            ["pred", "Predictions"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 pb-3 pt-1 text-lg font-semibold ${
              tab === k ? "border-b-2 border-brand text-foreground" : "text-muted-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "trade" ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Perpetuals</h2>
            <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm">Hyperliquid</div>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded-full bg-surface-2 px-3 py-1 text-sm">Volume</span>
              <Star size={18} className="text-muted-foreground" />
            </div>
            <div className="divide-y divide-border">
              {perps.map((id) => (
                <div key={id} className="flex items-center gap-3 py-3">
                  <TokenIcon id={id} prices={prices} size={32} />
                  <div className="flex-1 text-[15px]">
                    {id.toUpperCase()}-USDC{" "}
                    <span className="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted-foreground">20x</span>
                  </div>
                  <div className="text-right">
                    <div>{fmt(prices[id]?.price ?? 0, 4)}</div>
                    <div className="text-xs">
                      <Change value={prices[id]?.change ?? 0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl bg-surface p-4">
            <div className="text-sm text-muted-foreground">Total Value</div>
            <div className="text-3xl font-semibold">$0</div>
            <div className="mt-3 flex gap-8 text-sm">
              <div>
                <div className="text-muted-foreground">Unrealized PnL</div>
                <div>$0</div>
              </div>
              <div>
                <div className="text-muted-foreground">Balance</div>
                <div>$0</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-4 text-sm text-muted-foreground">
            No open prediction positions.
          </div>
        </div>
      )}
    </div>
  );
}

export function ExploreScreen() {
  const items = [
    { name: "Jupiter", desc: "Solana swap aggregator" },
    { name: "Raydium", desc: "AMM & liquidity pools" },
    { name: "Magic Eden", desc: "NFT marketplace" },
    { name: "Marinade", desc: "Liquid staking" },
    { name: "Drift", desc: "Perpetual futures" },
    { name: "Tensor", desc: "NFT trading terminal" },
  ];
  return (
    <div className="px-4 pb-6">
      <h1 className="py-3 text-2xl font-semibold">Explore</h1>
      <Link
        to="/escrow"
        className="mb-3 flex items-center justify-between rounded-2xl bg-surface p-4"
      >
        <span>
          <span className="block font-medium">Escrow trade</span>
          <span className="block text-xs text-muted-foreground">Protected peer-to-peer order</span>
        </span>
        <ShieldCheck size={20} className="text-brand" />
      </Link>
      <div className="grid grid-cols-2 gap-3">
        {items.map((i) => (
          <div key={i.name} className="rounded-2xl bg-surface p-4">
            <div className="mb-2 h-10 w-10 rounded-xl bg-brand/25" />
            <div className="font-medium">{i.name}</div>
            <div className="text-xs text-muted-foreground">{i.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
