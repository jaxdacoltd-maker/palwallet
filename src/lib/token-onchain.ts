// Detect any token directly from the blockchain, so imports work even for
// coins CoinGecko has never listed (new BSC/ETH/Base/Polygon/TRON/Solana tokens).
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
  /** Trust Wallet assets folder used for the token logo. */
  assets: string;
}

const EVM: Record<string, EvmNet> = {
  BEP20: { chain: bsc, rpc: "https://bsc-rpc.publicnode.com", assets: "smartchain" },
  ERC20: { chain: mainnet, rpc: "https://ethereum-rpc.publicnode.com", assets: "ethereum" },
  Polygon: { chain: polygon, rpc: "https://polygon-bor-rpc.publicnode.com", assets: "polygon" },
  Base: { chain: base, rpc: "https://base-rpc.publicnode.com", assets: "base" },
  "C-Chain": { chain: avalanche, rpc: "https://avalanche-c-chain-rpc.publicnode.com", assets: "avalanchec" },
};

export const EVM_CHAINS = Object.keys(EVM);

const ERC20_ABI = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
] as const;

const trustLogo = (folder: string, address: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${folder}/assets/${address}/logo.png`;

export const isEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a.trim());
export const isTronAddress = (a: string) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a.trim());
export const isSolanaAddress = (a: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a.trim()) && !isTronAddress(a);

/** Read an ERC-20/BEP-20 contract straight from the network. */
export async function detectEvmToken(chainLabel: string, address: string): Promise<OnChainToken | null> {
  const net = EVM[chainLabel];
  if (!net || !isEvmAddress(address)) return null;
  let contract: `0x${string}`;
  try {
    contract = getAddress(address.trim());
  } catch {
    return null;
  }
  const client = createPublicClient({ chain: net.chain, transport: http(net.rpc) });
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address: contract, abi: ERC20_ABI, functionName: "name" }) as Promise<string>,
      client.readContract({ address: contract, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
      client.readContract({ address: contract, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
    ]);
    if (!symbol) return null;
    return {
      chain: chainLabel,
      contract,
      symbol: String(symbol).toUpperCase(),
      name: String(name || symbol),
      decimals: Number(decimals),
      logo: trustLogo(net.assets, contract),
    };
  } catch {
    return null;
  }
}

/** Try every EVM network at once and return each one the contract exists on. */
export async function detectEvmTokenAnyChain(address: string): Promise<OnChainToken[]> {
  if (!isEvmAddress(address)) return [];
  const found = await Promise.all(EVM_CHAINS.map((c) => detectEvmToken(c, address)));
  return found.filter((f): f is OnChainToken => !!f);
}

/** TRC-20 contract details from TronGrid. */
export async function detectTronToken(address: string): Promise<OnChainToken | null> {
  if (!isTronAddress(address)) return null;
  try {
    const res = await fetch("https://api.trongrid.io/v1/contracts/" + address.trim() + "/tokens");
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ symbol?: string; name?: string; decimals?: number; icon_url?: string }>;
    };
    const t = json.data?.[0];
    if (!t?.symbol) return null;
    return {
      chain: "TRC20",
      contract: address.trim(),
      symbol: t.symbol.toUpperCase(),
      name: t.name || t.symbol,
      decimals: typeof t.decimals === "number" ? t.decimals : 6,
      logo: t.icon_url ?? "",
    };
  } catch {
    return null;
  }
}

/** Solana mint details from the Jupiter token service, falling back to the RPC. */
export async function detectSolanaToken(address: string): Promise<OnChainToken | null> {
  const mint = address.trim();
  if (!isSolanaAddress(mint)) return null;
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`);
    if (res.ok) {
      const list = (await res.json()) as Array<{
        id?: string;
        symbol?: string;
        name?: string;
        decimals?: number;
        icon?: string;
      }>;
      const t = list.find((x) => x.id === mint) ?? list[0];
      if (t?.symbol) {
        return {
          chain: "Solana",
          contract: mint,
          symbol: t.symbol.toUpperCase(),
          name: t.name || t.symbol,
          decimals: typeof t.decimals === "number" ? t.decimals : 9,
          logo: t.icon ?? "",
        };
      }
    }
  } catch {
    /* fall through to the RPC */
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

/** Detect a pasted address on whatever network it belongs to. */
export async function detectTokenOnChain(address: string, preferred?: string): Promise<OnChainToken[]> {
  const a = address.trim();
  if (isEvmAddress(a)) {
    const all = await detectEvmTokenAnyChain(a);
    if (preferred && EVM[preferred]) {
      const idx = all.findIndex((t) => t.chain === preferred);
      if (idx > 0) all.unshift(all.splice(idx, 1)[0]!);
    }
    return all;
  }
  if (isTronAddress(a)) {
    const t = await detectTronToken(a);
    return t ? [t] : [];
  }
  if (isSolanaAddress(a)) {
    const t = await detectSolanaToken(a);
    return t ? [t] : [];
  }
  return [];
}
