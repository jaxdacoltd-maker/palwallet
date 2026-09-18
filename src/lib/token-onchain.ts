// Detect token metadata directly from supported blockchains.
// Imports automatically fill network, name, symbol, decimals and logo when available.

import { createPublicClient, getAddress, http, type Chain } from "viem";
import { avalanche, base, bsc, mainnet, polygon } from "viem/chains";

export interface OnChainToken {
  chain: string;
  contract: string;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
}

interface EvmNet {
  chain: Chain;
  rpc: string;
  assets: string;
}

const EVM: Record<string, EvmNet> = {
  BEP20: {
    chain: bsc,
    rpc: "https://bsc-rpc.publicnode.com",
    assets: "smartchain",
  },
  ERC20: {
    chain: mainnet,
    rpc: "https://ethereum-rpc.publicnode.com",
    assets: "ethereum",
  },
  Polygon: {
    chain: polygon,
    rpc: "https://polygon-bor-rpc.publicnode.com",
    assets: "polygon",
  },
  Base: {
    chain: base,
    rpc: "https://base-rpc.publicnode.com",
    assets: "base",
  },
  "C-Chain": {
    chain: avalanche,
    rpc: "https://avalanche-c-chain-rpc.publicnode.com",
    assets: "avalanchec",
  },
};

export const EVM_CHAINS = Object.keys(EVM);

const ERC20_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

/**
 * Trust Wallet logo location.
 * If the token is listed there, this URL resolves to its logo.
 */
const trustLogo = (folder: string, address: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${folder}/assets/${address}/logo.png`;

/**
 * CoinGecko contract logo endpoint.
 * This is useful for tokens that are listed by CoinGecko.
 */
const coinGeckoLogo = (platform: string, address: string) =>
  `https://assets.coingecko.com/coins/images/1/large.png`;

/**
 * Check whether an image URL actually exists.
 */
async function imageExists(url: string): Promise<boolean> {
  if (!url) return false;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Pick the first working logo source.
 */
async function findEvmLogo(
  folder: string,
  address: string,
): Promise<string> {
  const trust = trustLogo(folder, address);

  if (await imageExists(trust)) {
    return trust;
  }

  return "";
}

export const isEvmAddress = (a: string) =>
  /^0x[0-9a-fA-F]{40}$/.test(a.trim());

export const isTronAddress = (a: string) =>
  /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a.trim());

export const isSolanaAddress = (a: string) =>
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim()) &&
  !isTronAddress(a);

/**
 * Read ERC-20/BEP-20 metadata directly from the blockchain.
 */
export async function detectEvmToken(
  chainLabel: string,
  address: string,
): Promise<OnChainToken | null> {
  const net = EVM[chainLabel];

  if (!net || !isEvmAddress(address)) {
    return null;
  }

  let contract: `0x${string}`;

  try {
    contract = getAddress(address.trim());
  } catch {
    return null;
  }

  const client = createPublicClient({
    chain: net.chain,
    transport: http(net.rpc),
  });

  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({
        address: contract,
        abi: ERC20_ABI,
        functionName: "name",
      }) as Promise<string>,

      client.readContract({
        address: contract,
        abi: ERC20_ABI,
        functionName: "symbol",
      }) as Promise<string>,

      client.readContract({
        address: contract,
        abi: ERC20_ABI,
        functionName: "decimals",
      }) as Promise<number>,
    ]);

    if (!symbol) {
      return null;
    }

    const logo = await findEvmLogo(net.assets, contract);

    return {
      chain: chainLabel,
      contract,
      symbol: String(symbol).toUpperCase(),
      name: String(name || symbol),
      decimals: Number(decimals),
      logo,
    };
  } catch {
    return null;
  }
}

/**
 * Try every supported EVM network.
 */
export async function detectEvmTokenAnyChain(
  address: string,
): Promise<OnChainToken[]> {
  if (!isEvmAddress(address)) {
    return [];
  }

  const found = await Promise.all(
    EVM_CHAINS.map((chain) => detectEvmToken(chain, address)),
  );

  return found.filter(
    (token): token is OnChainToken => !!token,
  );
}

/**
 * TRC-20 token metadata from TronGrid.
 */
export async function detectTronToken(
  address: string,
): Promise<OnChainToken | null> {
  if (!isTronAddress(address)) {
    return null;
  }

  try {
    const res = await fetch(
      "https://api.trongrid.io/v1/contracts/" +
        address.trim() +
        "/tokens",
    );

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as {
      data?: Array<{
        symbol?: string;
        name?: string;
        decimals?: number;
        icon_url?: string;
      }>;
    };

    const token = json.data?.[0];

    if (!token?.symbol) {
      return null;
    }

    return {
      chain: "TRC20",
      contract: address.trim(),
      symbol: token.symbol.toUpperCase(),
      name: token.name || token.symbol,
      decimals:
        typeof token.decimals === "number"
          ? token.decimals
          : 6,
      logo: token.icon_url ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Solana token metadata from Jupiter.
 */
export async function detectSolanaToken(
  address: string,
): Promise<OnChainToken | null> {
  const mint = address.trim();

  if (!isSolanaAddress(mint)) {
    return null;
  }

  try {
    const res = await fetch(
      `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(
        mint,
      )}`,
    );

    if (res.ok) {
      const list = (await res.json()) as Array<{
        id?: string;
        symbol?: string;
        name?: string;
        decimals?: number;
        icon?: string;
      }>;

      const token =
        list.find((item) => item.id === mint) ??
        list[0];

      if (token?.symbol) {
        return {
          chain: "Solana",
          contract: mint,
          symbol: token.symbol.toUpperCase(),
          name: token.name || token.symbol,
          decimals:
            typeof token.decimals === "number"
              ? token.decimals
              : 9,
          logo: token.icon ?? "",
        };
      }
    }
  } catch {
    // Fall through to RPC.
  }

  try {
    const { mintDecimals } = await import("./chain-solana");

    const decimals = await mintDecimals(mint, 9);

    return {
      chain: "Solana",
      contract: mint,
      symbol: mint.slice(0, 4).toUpperCase(),
      name: "Solana token",
      decimals,
      logo: "",
    };
  } catch {
    return null;
  }
}

/**
 * Detect a pasted token address on the appropriate network.
 */
export async function detectTokenOnChain(
  address: string,
  preferred?: string,
): Promise<OnChainToken[]> {
  const a = address.trim();

  if (isEvmAddress(a)) {
    const all = await detectEvmTokenAnyChain(a);

    if (preferred && EVM[preferred]) {
      const index = all.findIndex(
        (token) => token.chain === preferred,
      );

      if (index > 0) {
        all.unshift(all.splice(index, 1)[0]!);
      }
    }

    return all;
  }

  if (isTronAddress(a)) {
    const token = await detectTronToken(a);

    return token ? [token] : [];
  }

  if (isSolanaAddress(a)) {
    const token = await detectSolanaToken(a);

    return token ? [token] : [];
  }

  return [];
}