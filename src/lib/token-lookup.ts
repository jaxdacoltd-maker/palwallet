/** Look up a token contract to auto-fill name, symbol, decimals and logo. */
import { detectTokenOnChain, type OnChainToken } from "./token-onchain";

export interface TokenLookupResult {
  cgId: string;
  symbol: string;
  name: string;
  decimals?: number | undefined;
  logo: string;
}

/** Chain label used in the app -> CoinGecko asset platform id. */
const PLATFORMS: Record<string, string> = {
  Solana: "solana",
  ERC20: "ethereum",
  BEP20: "binance-smart-chain",
  Polygon: "polygon-pos",
  "C-Chain": "avalanche",
  Base: "base",
  TRC20: "tron",
  TON: "the-open-network",
  SUI: "sui",
  NEAR: "near-protocol",
  Cardano: "cardano",
};

export function platformFor(chain: string) {
  return PLATFORMS[chain];
}

/** Reverse map: CoinGecko platform id -> app chain label. */
const CHAIN_BY_PLATFORM: Record<string, string> = Object.fromEntries(
  Object.entries(PLATFORMS).map(([chain, p]) => [p, chain]),
);

export interface TokenSearchResult extends TokenLookupResult {
  chain: string;
  contract: string;
}

/** Detect a pasted contract address on every supported network at once.
 *  Reads the contract directly from the blockchain, so brand-new tokens work,
 *  and enriches the result with CoinGecko data when the token is listed. */
export async function detectContractAnyChain(
  contract: string,
  signal?: AbortSignal,
  preferredChain?: string,
): Promise<TokenSearchResult[]> {
  const address = contract.trim();
  if (address.length < 20) return [];

  const chains = Object.keys(PLATFORMS);
  const [listed, onchain] = await Promise.all([
    Promise.all(
      chains.map(async (chain) => {
        try {
          const r = await lookupContract(chain, address, signal);
          return r ? ({ ...r, chain, contract: address } as TokenSearchResult) : null;
        } catch {
          return null;
        }
      }),
    ),
    detectTokenOnChain(address, preferredChain).catch(() => [] as OnChainToken[]),
  ]);

  const byChain = new Map<string, TokenSearchResult>();
  for (const t of onchain) {
    byChain.set(t.chain, {
      cgId: "",
      chain: t.chain,
      contract: t.contract,
      symbol: t.symbol,
      name: t.name,
      logo: t.logo,
      decimals: t.decimals,
    });
  }
  for (const r of listed) {
    if (!r) continue;
    const prev = byChain.get(r.chain);
    byChain.set(r.chain, {
      ...r,
      decimals: r.decimals ?? prev?.decimals,
      logo: r.logo || prev?.logo || "",
      symbol: r.symbol || prev?.symbol || "",
      name: r.name || prev?.name || "",
    });
  }

  const out = [...byChain.values()];
  if (preferredChain) {
    const i = out.findIndex((t) => t.chain === preferredChain);
    if (i > 0) out.unshift(out.splice(i, 1)[0]!);
  }
  return out;
}

/** Search tokens by name or symbol and resolve their contract + network. */
export async function searchTokens(
  query: string,
  signal?: AbortSignal,
): Promise<TokenSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  if (/^(0x[0-9a-fA-F]{40}|[A-Za-z0-9]{26,60})$/.test(q)) {
    const byContract = await detectContractAnyChain(q, signal);
    if (byContract.length) return byContract;
  }

  const res = await fetch(
    `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
    signal ? { signal } : {},
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    coins?: Array<{ id: string; symbol?: string; name?: string; large?: string; thumb?: string }>;
  };
  const coins = (data.coins ?? []).slice(0, 8);

  const detailed = await Promise.all(
    coins.map(async (c) => {
      try {
        const r = await fetch(
          `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(c.id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
          signal ? { signal } : {},
        );
        if (!r.ok) return null;
        const d = (await r.json()) as {
          id: string;
          symbol?: string;
          name?: string;
          image?: { large?: string; small?: string; thumb?: string };
          platforms?: Record<string, string>;
          detail_platforms?: Record<string, { decimal_place?: number | null }>;
        };
        const entry = Object.entries(d.platforms ?? {}).find(
          ([p, addr]) => CHAIN_BY_PLATFORM[p] && !!addr,
        );
        if (!entry) return null;
        const [platform, addr] = entry;
        const dec = d.detail_platforms?.[platform]?.decimal_place;
        const result: TokenSearchResult = {
          cgId: d.id,
          chain: CHAIN_BY_PLATFORM[platform] as string,
          contract: addr,
          symbol: (d.symbol ?? c.symbol ?? "").toUpperCase(),
          name: d.name ?? c.name ?? "",
          logo: d.image?.large ?? d.image?.small ?? c.large ?? c.thumb ?? "",
          ...(typeof dec === "number" ? { decimals: dec } : {}),
        };
        return result;
      } catch {
        return null;
      }
    }),
  );
  return detailed.filter((d): d is TokenSearchResult => !!d);
}

export async function lookupContract(
  chain: string,
  contract: string,
  signal?: AbortSignal,
): Promise<TokenLookupResult | null> {
  const platform = platformFor(chain);
  const address = contract.trim();
  if (!platform || address.length < 20) return null;

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${platform}/contract/${encodeURIComponent(address)}`,
    signal ? { signal } : {},
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: string;
    symbol?: string;
    name?: string;
    image?: { large?: string; small?: string; thumb?: string };
    detail_platforms?: Record<string, { decimal_place?: number | null }>;
  };
  if (!data?.id) return null;

  const detail = data.detail_platforms?.[platform];
  return {
    cgId: data.id,
    symbol: (data.symbol ?? "").toUpperCase(),
    name: data.name ?? "",
    decimals: typeof detail?.decimal_place === "number" ? detail.decimal_place : undefined,
    logo: data.image?.large ?? data.image?.small ?? data.image?.thumb ?? "",
  };
}
