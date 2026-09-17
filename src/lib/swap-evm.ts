// Real on-chain swaps on EVM networks (BNB Chain, Ethereum, Polygon, Avalanche)
// routed through the network's main Uniswap-V2 style router and signed locally
// with the wallet's own derived key.
import {
  createPublicClient,
  createWalletClient,
  http,
  type Chain,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalanche, bsc, mainnet, polygon } from "viem/chains";
import { evmPrivateKey } from "./keys";
import { tokenById, type TokenId } from "./wallet-store";

interface EvmSwapNet {
  chain: Chain;
  rpc: string;
  explorer: string;
  router: `0x${string}`;
  wrapped: `0x${string}`;
  stable?: `0x${string}`;
  native: TokenId;
  tokens: Partial<Record<TokenId, `0x${string}`>>;
}

export const EVM_SWAP: Record<string, EvmSwapNet> = {
  BEP20: {
    chain: bsc,
    rpc: "https://bsc-rpc.publicnode.com",
    explorer: "https://bscscan.com/tx/",
    router: "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2
    wrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    stable: "0x55d398326f99059fF775485246999027B3197955", // USDT
    native: "bnb",
    tokens: { usdt_bep20: "0x55d398326f99059fF775485246999027B3197955" },
  },
  ERC20: {
    chain: mainnet,
    rpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io/tx/",
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2
    wrapped: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    stable: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    native: "eth",
    tokens: {
      usdt_erc20: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      link: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    },
  },
  Polygon: {
    chain: polygon,
    rpc: "https://polygon-bor-rpc.publicnode.com",
    explorer: "https://polygonscan.com/tx/",
    router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap V2
    wrapped: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    stable: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
    native: "pol",
    tokens: { usdt_erc20: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  },
  "C-Chain": {
    chain: avalanche,
    rpc: "https://avalanche-c-chain-rpc.publicnode.com",
    explorer: "https://snowtrace.io/tx/",
    router: "0x60aE616a2155Ee3d9A68541Ba4544862310933d4", // Trader Joe V1
    wrapped: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
    stable: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // USDt
    native: "avax",
    tokens: {},
  },
};

const ERC20_ABI = [
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

const ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "uint256" }, { type: "address[]" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "swapExactETHForTokens",
    type: "function",
    stateMutability: "payable",
    inputs: [{ type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }],
    outputs: [{ type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForETH",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ type: "uint256" }, { type: "uint256" }, { type: "address[]" }, { type: "address" }, { type: "uint256" }],
    outputs: [{ type: "uint256[]" }],
  },
] as const;

/** The EVM network a token trades on, when we can route it. */
export function evmSwapNet(id: TokenId): EvmSwapNet | undefined {
  return EVM_SWAP[tokenById(id).chain];
}

/** Contract address used for routing (wrapped native for the gas coin). */
function routeAddress(id: TokenId, net: EvmSwapNet): `0x${string}` | undefined {
  if (id === net.native) return net.wrapped;
  const known = net.tokens[id];
  if (known) return known;
  const c = tokenById(id).contract;
  return c && c.startsWith("0x") ? (c as `0x${string}`) : undefined;
}

/** True when both tokens sit on the same EVM network we can route on. */
export function canSwapEvm(from: TokenId, to: TokenId) {
  const a = evmSwapNet(from);
  const b = evmSwapNet(to);
  if (!a || !b || a.router !== b.router) return false;
  return !!routeAddress(from, a) && !!routeAddress(to, b);
}

export interface EvmQuote {
  kind: "evm";
  chainName: string;
  from: TokenId;
  to: TokenId;
  path: `0x${string}`[];
  amountInRaw: bigint;
  amountOutRaw: bigint;
  inAmount: number;
  outAmount: number;
  inDecimals: number;
  outDecimals: number;
  slippageBps: number;
}

const decCache = new Map<string, number>();
async function decimalsOf(pub: PublicClient, address: `0x${string}`, fallback: number) {
  const hit = decCache.get(address);
  if (hit !== undefined) return hit;
  try {
    const d = Number(
      await pub.readContract({ address, abi: ERC20_ABI, functionName: "decimals" }),
    );
    decCache.set(address, d);
    return d;
  } catch {
    return fallback;
  }
}

function toRaw(amount: number, decimals: number) {
  const [i, f = ""] = String(amount).split(".");
  return BigInt((i || "0") + (f + "0".repeat(decimals)).slice(0, decimals));
}

function client(net: EvmSwapNet) {
  return createPublicClient({ chain: net.chain, transport: http(net.rpc) }) as PublicClient;
}

/** Live router quote. Amounts are whole tokens. */
export async function getEvmQuote(
  from: TokenId,
  to: TokenId,
  amount: number,
  slippageBps: number,
): Promise<EvmQuote> {
  const net = evmSwapNet(from);
  if (!net || !canSwapEvm(from, to)) throw new Error("This pair can't be routed on this network.");
  const inAddr = routeAddress(from, net)!;
  const outAddr = routeAddress(to, net)!;
  const pub = client(net);
  const inDecimals = from === net.native ? 18 : await decimalsOf(pub, inAddr, tokenById(from).decimals);
  const outDecimals = to === net.native ? 18 : await decimalsOf(pub, outAddr, tokenById(to).decimals);
  const amountInRaw = toRaw(amount, inDecimals);
  if (amountInRaw <= 0n) throw new Error("Enter an amount to swap.");

  const candidates: `0x${string}`[][] = [[inAddr, outAddr]];
  if (inAddr !== net.wrapped && outAddr !== net.wrapped) candidates.push([inAddr, net.wrapped, outAddr]);
  if (net.stable && inAddr !== net.stable && outAddr !== net.stable)
    candidates.push([inAddr, net.stable, outAddr]);

  let best: { path: `0x${string}`[]; out: bigint } | undefined;
  for (const path of candidates) {
    try {
      const amounts = (await pub.readContract({
        address: net.router,
        abi: ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [amountInRaw, path],
      })) as bigint[];
      const out = amounts[amounts.length - 1]!;
      if (out > 0n && (!best || out > best.out)) best = { path, out };
    } catch {
      /* no pool on this path */
    }
  }
  if (!best) throw new Error("No liquidity pool was found for this pair.");

  return {
    kind: "evm",
    chainName: tokenById(from).chain,
    from,
    to,
    path: best.path,
    amountInRaw,
    amountOutRaw: best.out,
    inAmount: amount,
    outAmount: Number(best.out) / 10 ** outDecimals,
    inDecimals,
    outDecimals,
    slippageBps,
  };
}

/** Approve, swap and broadcast. Returns the real transaction hash. */
export async function executeEvmSwap(mnemonic: string | undefined, q: EvmQuote): Promise<string> {
  if (!mnemonic) throw new Error("This wallet has no backup phrase, so it cannot sign transactions.");
  const net = EVM_SWAP[q.chainName]!;
  const account = privateKeyToAccount(evmPrivateKey(mnemonic));
  const transport = http(net.rpc);
  const wallet = createWalletClient({ account, chain: net.chain, transport });
  const pub = client(net);

  const minOut = (q.amountOutRaw * BigInt(10000 - q.slippageBps)) / 10000n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
  const fromNative = q.from === net.native;
  const toNative = q.to === net.native;

  if (!fromNative) {
    const token = q.path[0]!;
    const allowance = (await pub.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, net.router],
    })) as bigint;
    if (allowance < q.amountInRaw) {
      const approveHash = await wallet.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [net.router, q.amountInRaw],
        chain: net.chain,
        account,
      });
      await pub.waitForTransactionReceipt({ hash: approveHash });
    }
  }

  let hash: `0x${string}`;
  if (fromNative) {
    hash = await wallet.writeContract({
      address: net.router,
      abi: ROUTER_ABI,
      functionName: "swapExactETHForTokens",
      args: [minOut, q.path, account.address, deadline],
      value: q.amountInRaw,
      chain: net.chain,
      account,
    });
  } else if (toNative) {
    hash = await wallet.writeContract({
      address: net.router,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForETH",
      args: [q.amountInRaw, minOut, q.path, account.address, deadline],
      chain: net.chain,
      account,
    });
  } else {
    hash = await wallet.writeContract({
      address: net.router,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [q.amountInRaw, minOut, q.path, account.address, deadline],
      chain: net.chain,
      account,
    });
  }
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

export function evmExplorerTx(chainName: string, hash: string) {
  return (EVM_SWAP[chainName]?.explorer ?? "https://bscscan.com/tx/") + hash;
}
