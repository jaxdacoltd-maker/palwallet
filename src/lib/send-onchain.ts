// Real on-chain transfers signed locally with the wallet's own derived keys.
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseUnits, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalanche, bsc, mainnet, polygon } from "viem/chains";
import { evmPrivateKey } from "./keys";
import { sendSolanaTx } from "./chain-solana";
import { sendBitcoin } from "./chain-btc";
import { sendTron } from "./chain-tron";
import { tokenById, type TokenId } from "./wallet-store";

/** TRC-20 contracts we know by default. */
const TRON_CONTRACT: Partial<Record<TokenId, string>> = {
  usdt_trc20: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
};

/** Mint address for the SPL tokens we support. */
export const SOL_MINT: Partial<Record<TokenId, string>> = {
  usdt: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  jup: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  ray: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  bonk: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
};

interface EvmNet {
  chain: Chain;
  rpc: string;
  explorer: string;
  native: TokenId;
  tokens: Partial<Record<TokenId, `0x${string}`>>;
}

const EVM: Record<string, EvmNet> = {
  ERC20: {
    chain: mainnet,
    rpc: "https://ethereum-rpc.publicnode.com",
    explorer: "https://etherscan.io/tx/",
    native: "eth",
    tokens: {
      usdt_erc20: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      link: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    },
  },
  BEP20: {
    chain: bsc,
    rpc: "https://bsc-rpc.publicnode.com",
    explorer: "https://bscscan.com/tx/",
    native: "bnb",
    tokens: { usdt_bep20: "0x55d398326f99059fF775485246999027B3197955" },
  },
  Polygon: {
    chain: polygon,
    rpc: "https://polygon-bor-rpc.publicnode.com",
    explorer: "https://polygonscan.com/tx/",
    native: "pol",
    tokens: { usdt_erc20: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
  },
  "C-Chain": {
    chain: avalanche,
    rpc: "https://avalanche-c-chain-rpc.publicnode.com",
    explorer: "https://snowtrace.io/tx/",
    native: "avax",
    tokens: {},
  },
};

const ERC20_ABI = [
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export interface SendResult {
  hash: string;
  explorer: string;
}

/** Networks we can sign and broadcast on today. */
export function canSendOnChain(token: TokenId) {
  const meta = tokenById(token);
  if (meta.chain === "Solana") return !!(SOL_MINT[token] || meta.contract || token === "sol");
  if (meta.chain === "Bitcoin") return token === "btc";
  if (meta.chain === "TRC20") return token === "trx" || !!TRON_CONTRACT[token] || !!meta.contract;
  const net = EVM[meta.chain];
  if (!net) return false;
  return token === net.native || !!net.tokens[token] || !!meta.contract;
}

async function sendSolana(mnemonic: string, token: TokenId, to: string, amount: number): Promise<SendResult> {
  const mint = token === "sol" ? undefined : (SOL_MINT[token] ?? tokenById(token).contract);
  if (token !== "sol" && !mint) throw new Error("This token has no known mint address on Solana.");
  const sig = await sendSolanaTx(mnemonic, mint, to, amount, tokenById(token).decimals);
  return { hash: sig, explorer: `https://solscan.io/tx/${sig}` };
}

async function sendBtc(mnemonic: string, to: string, amount: number): Promise<SendResult> {
  const txid = await sendBitcoin(mnemonic, to, amount);
  return { hash: txid, explorer: `https://mempool.space/tx/${txid}` };
}

async function sendTrx(mnemonic: string, token: TokenId, to: string, amount: number): Promise<SendResult> {
  const meta = tokenById(token);
  const contract = token === "trx" ? undefined : (TRON_CONTRACT[token] ?? meta.contract);
  if (token !== "trx" && !contract) throw new Error("This token has no known contract on TRON.");
  const txid = await sendTron(mnemonic, contract, to, amount, meta.decimals);
  return { hash: txid, explorer: `https://tronscan.org/#/transaction/${txid}` };
}

async function sendEvm(
  mnemonic: string,
  chainName: string,
  token: TokenId,
  to: string,
  amount: number,
): Promise<SendResult> {
  const net = EVM[chainName]!;
  const account = privateKeyToAccount(evmPrivateKey(mnemonic));
  const transport = http(net.rpc);
  const wallet = createWalletClient({ account, chain: net.chain, transport });
  const pub = createPublicClient({ chain: net.chain, transport });
  const recipient = to as `0x${string}`;

  let hash: `0x${string}`;
  if (token === net.native) {
    hash = await wallet.sendTransaction({ to: recipient, value: parseUnits(String(amount), 18) });
  } else {
    const contract = (net.tokens[token] ?? tokenById(token).contract) as `0x${string}` | undefined;
    if (!contract) throw new Error("This token has no known contract on " + chainName + ".");
    const decimals = (await pub.readContract({ address: contract, abi: ERC20_ABI, functionName: "decimals" })) as number;
    hash = await wallet.sendTransaction({
      to: contract,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [recipient, parseUnits(String(amount), decimals)],
      }),
    });
  }
  await pub.waitForTransactionReceipt({ hash });
  return { hash, explorer: net.explorer + hash };
}

/** Sign and broadcast a real transfer from the wallet's own keys. */
export async function sendRealToken(
  mnemonic: string | undefined,
  token: TokenId,
  to: string,
  amount: number,
): Promise<SendResult> {
  if (!mnemonic) throw new Error("This wallet has no backup phrase, so it cannot sign transactions.");
  const chain = tokenById(token).chain;
  if (chain === "Solana") return sendSolana(mnemonic, token, to, amount);
  if (chain === "Bitcoin") return sendBtc(mnemonic, to, amount);
  if (chain === "TRC20") return sendTrx(mnemonic, token, to, amount);
  if (EVM[chain]) return sendEvm(mnemonic, chain, token, to, amount);
  throw new Error(`Sending on ${chain} is not supported yet.`);
}
