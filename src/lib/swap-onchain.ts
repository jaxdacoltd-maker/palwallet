// Real on-chain swaps on Solana, routed through the Jupiter aggregator and
// signed locally with the wallet's own key.
import { mintDecimals, signAndSendBase64Tx } from "./chain-solana";
import { SOL_MINT } from "./send-onchain";
import { deriveAddresses } from "./keys";
import { tokenById, type TokenId } from "./wallet-store";
import { canSwapEvm, evmExplorerTx, executeEvmSwap, getEvmQuote, type EvmQuote } from "./swap-evm";

const JUP = "https://lite-api.jup.ag/swap/v1";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";

/** Mint address for a token, when it exists on Solana. */
export function solanaMint(id: TokenId): string | undefined {
  const meta = tokenById(id);
  if (id === "sol") return WSOL_MINT;
  if (meta.chain !== "Solana") return undefined;
  return SOL_MINT[id] ?? (meta.contract || undefined);
}

/** True when both sides of a swap can be routed on-chain. */
export function canSwapOnChain(id: TokenId) {
  return !!solanaMint(id);
}

export interface SolanaQuote {
  kind: "solana";
  raw: unknown;
  inAmount: number;
  outAmount: number;
  priceImpactPct: number;
  slippageBps: number;
}

export type SwapQuote = SolanaQuote | EvmQuote;

/** True when the whole pair can be traded on-chain from this wallet. */
export function canSwapPair(from: TokenId, to: TokenId) {
  if (from === to) return false;
  if (canSwapOnChain(from) && canSwapOnChain(to)) return true;
  return canSwapEvm(from, to);
}

interface JupQuote {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
}

const decimalsCache = new Map<string, number>();
async function decimalsOf(mint: string, fallback: number) {
  const hit = decimalsCache.get(mint);
  if (hit !== undefined) return hit;
  const d = mint === WSOL_MINT ? 9 : await mintDecimals(mint, fallback);
  decimalsCache.set(mint, d);
  return d;
}

/** Live route quote from Jupiter. Amounts are in whole tokens. */
export async function getSwapQuote(
  from: TokenId,
  to: TokenId,
  amount: number,
  slippageBps = 50,
): Promise<SwapQuote> {
  if (canSwapEvm(from, to) && !(solanaMint(from) && solanaMint(to))) {
    return getEvmQuote(from, to, amount, slippageBps);
  }
  const inMint = solanaMint(from);
  const outMint = solanaMint(to);
  if (!inMint || !outMint) throw new Error("Swaps are available for Solana tokens only.");
  const inDec = await decimalsOf(inMint, tokenById(from).decimals);
  const outDec = await decimalsOf(outMint, tokenById(to).decimals);
  const raw = BigInt(Math.round(amount * 10 ** inDec));
  const url = `${JUP}/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${raw}&slippageBps=${slippageBps}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No swap route available for this pair right now.");
  const q = (await res.json()) as JupQuote;
  return {
    kind: "solana" as const,
    raw: q,
    inAmount: Number(q.inAmount) / 10 ** inDec,
    outAmount: Number(q.outAmount) / 10 ** outDec,
    priceImpactPct: Number(q.priceImpactPct ?? 0) * 100,
    slippageBps: q.slippageBps ?? slippageBps,
  };
}

/** Build, sign and broadcast the swap. Returns the real transaction signature. */
export async function executeSwap(mnemonic: string | undefined, quote: SwapQuote): Promise<string> {
  if (quote.kind === "evm") return executeEvmSwap(mnemonic, quote);
  if (!mnemonic) throw new Error("This wallet has no backup phrase, so it cannot sign transactions.");
  const userPublicKey = deriveAddresses(mnemonic).solana;
  const res = await fetch(`${JUP}/swap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote.raw,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!res.ok) throw new Error("The swap could not be prepared. Please try again.");
  const { swapTransaction } = (await res.json()) as { swapTransaction: string };
  if (!swapTransaction) throw new Error("The swap could not be prepared. Please try again.");
  return signAndSendBase64Tx(mnemonic, swapTransaction);
}

export const solscanTx = (sig: string) => `https://solscan.io/tx/${sig}`;

/** Explorer link for a completed swap, on whichever chain it ran. */
export function swapExplorerUrl(quote: SwapQuote | null, hashOrSig: string) {
  if (quote && quote.kind === "evm") return evmExplorerTx(quote.chainName, hashOrSig);
  return solscanTx(hashOrSig);
}
