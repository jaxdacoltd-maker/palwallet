import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Sparkline } from "@/components/wallet/Sparkline";
import { usePrices } from "@/lib/prices";
import { TOKENS, explorerAddressUrl, explorerName } from "@/lib/wallet-store";
import { useFiat } from "@/lib/currency";

export const Route = createFileRoute("/prices")({
  head: () => ({
    meta: [
      { title: "Live Crypto Prices — BTC, ETH, SOL, USDT & More" },
      {
        name: "description",
        content:
          "Live cryptocurrency prices with 24h change, 7-day charts and block explorer links for Bitcoin, Ethereum, Solana, USDT, NEAR, Zcash and more.",
      },
      { property: "og:title", content: "Live Crypto Prices — BTC, ETH, SOL, USDT & More" },
      {
        property: "og:description",
        content: "Track live crypto prices, 24h moves and 7-day trends, with a block explorer link for every token.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricesPage,
});

function PricesPage() {
  const { prices, isLoading } = usePrices();
  const { fmt } = useFiat();

  const rows = TOKENS.map((t) => ({ token: t, p: prices[t.id] })).sort(
    (a, b) => (b.p?.price ?? 0) - (a.p?.price ?? 0),
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-background px-4 pb-16 pt-5 text-foreground">
      <header className="mb-5 flex items-center gap-3">
        <Link to="/" className="rounded-full p-2 hover:bg-surface-2" aria-label="Back to wallet">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Live crypto prices</h1>
          <p className="text-xs text-muted-foreground">
            Prices and 7-day trends update every 30 seconds from CoinGecko.
          </p>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Loading live prices…</p>}

      <ul className="space-y-2">
        {rows.map(({ token, p }) => {
          const up = (p?.change ?? 0) >= 0;
          const url = token.contract
            ? explorerAddressUrl(token.chain, token.contract)
            : explorerAddressUrl(token.chain, "");
          return (
            <li key={token.id} className="rounded-2xl bg-surface-1 p-3">
              <div className="flex items-center gap-3">
                {p?.image ? (
                  <img src={p.image} alt={`${token.name} logo`} className="h-9 w-9 rounded-full" loading="lazy" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {token.symbol} <span className="text-muted-foreground">({token.chain})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(p?.price ?? 0, 6)}{" "}
                    <span className={up ? "text-emerald-400" : "text-red-400"}>
                      {up ? "+" : ""}
                      {(p?.change ?? 0).toFixed(2)}%
                    </span>
                  </p>
                </div>
                <Sparkline data={p?.sparkline ?? []} up={up} />
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-brand"
                >
                  View {token.symbol} on {explorerName(token.chain)} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
