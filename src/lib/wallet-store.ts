import { useSyncExternalStore } from "react";
import { chainAddressesFrom, deriveAddresses, isValidMnemonic, newMnemonic } from "./keys";

export type TokenId =
  | "usdt"
  | "sol"
  | "btc"
  | "eth"
  | "bnb"
  | "usdc"
  | "ton"
  | "pol"
  | "xrp"
  | "trx"
  | "doge"
  | "ada"
  | "link"
  | "avax"
  | "sui"
  | "jup"
  | "ray"
  | "bonk"
  | "zec"
  | "near"
  | "rhea"
  | "ern"
  | "usdt_trc20"
  | "usdt_erc20"
  | "usdt_bep20"
  | "usdtz_bep20";


export interface TokenMeta {
  id: TokenId;
  symbol: string;
  name: string;
  chain: string;
  cgId: string;
  decimals: number;
  /** Contract address for imported tokens. */
  contract?: string;
  /** True when the user imported this token. */
  custom?: boolean;
  /** Logo URL detected when importing a token. */
  logo?: string;
}

export const TOKENS: TokenMeta[] = [
  { id: "usdt", symbol: "USDT", name: "Tether", chain: "Solana", cgId: "tether", decimals: 6, contract: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { id: "sol", symbol: "SOL", name: "Solana", chain: "Solana", cgId: "solana", decimals: 6 },
  { id: "btc", symbol: "BTC", name: "Bitcoin", chain: "Bitcoin", cgId: "bitcoin", decimals: 8 },
  { id: "eth", symbol: "ETH", name: "Ethereum", chain: "ERC20", cgId: "ethereum", decimals: 6 },
  { id: "bnb", symbol: "BNB", name: "BNB", chain: "BEP20", cgId: "binancecoin", decimals: 6 },
  { id: "usdc", symbol: "USDC", name: "USD Coin", chain: "Solana", cgId: "usd-coin", decimals: 2, contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { id: "ton", symbol: "TON", name: "Toncoin", chain: "TON", cgId: "the-open-network", decimals: 4 },
  { id: "pol", symbol: "POL", name: "Polygon", chain: "Polygon", cgId: "matic-network", decimals: 4 },
  { id: "xrp", symbol: "XRP", name: "XRP", chain: "XRP Ledger", cgId: "ripple", decimals: 4 },
  { id: "trx", symbol: "TRX", name: "TRON", chain: "TRC20", cgId: "tron", decimals: 4 },
  { id: "doge", symbol: "DOGE", name: "Dogecoin", chain: "Dogecoin", cgId: "dogecoin", decimals: 4 },
  { id: "ada", symbol: "ADA", name: "Cardano", chain: "Cardano", cgId: "cardano", decimals: 4 },
  { id: "link", symbol: "LINK", name: "Chainlink", chain: "ERC20", cgId: "chainlink", decimals: 4, contract: "0x514910771AF9Ca656af840dff83E8264EcF986CA" },
  { id: "avax", symbol: "AVAX", name: "Avalanche", chain: "C-Chain", cgId: "avalanche-2", decimals: 4 },
  { id: "sui", symbol: "SUI", name: "Sui", chain: "SUI", cgId: "sui", decimals: 4 },
  { id: "jup", symbol: "JUP", name: "Jupiter", chain: "Solana", cgId: "jupiter-exchange-solana", decimals: 4, contract: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCNB" },
  { id: "ray", symbol: "RAY", name: "Raydium", chain: "Solana", cgId: "raydium", decimals: 4, contract: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
  { id: "bonk", symbol: "BONK", name: "Bonk", chain: "Solana", cgId: "bonk", decimals: 0, contract: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { id: "zec", symbol: "ZEC", name: "Zcash", chain: "Zcash", cgId: "zcash", decimals: 7 },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", chain: "NEAR", cgId: "near", decimals: 12 },
  { id: "rhea", symbol: "RHEA", name: "RHEA", chain: "ERC20", cgId: "rhea-2", decimals: 12 },
  { id: "ern", symbol: "ERN", name: "Ethernity Chain", chain: "ERC20", cgId: "ethernity-chain", decimals: 6 },
  { id: "usdt_trc20", symbol: "USDT", name: "Tether", chain: "TRC20", cgId: "tether", decimals: 6, contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
  { id: "usdt_erc20", symbol: "USDT", name: "Tether", chain: "ERC20", cgId: "tether", decimals: 6, contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
  { id: "usdt_bep20", symbol: "USDT", name: "Tether", chain: "BEP20", cgId: "tether", decimals: 6, contract: "0x55d398326f99059fF775485246999027B3197955" },
  {
    id: "usdtz_bep20",
    symbol: "USDT.z",
    name: "Tether USD Bridged ZED20",
    chain: "BEP20",
    cgId: "",
    decimals: 18,
    contract: "0x4BE35Ec329343d7d9F548d42B0F8c17FFfe07db4",
  },

];

export const tokenById = (id: TokenId): TokenMeta =>
  TOKENS.find((t) => t.id === id) ??
  ({ id, symbol: String(id).toUpperCase(), name: String(id), chain: "Solana", cgId: "", decimals: 6 } as TokenMeta);

/** All networks a token can be imported on. */
export const ALL_CHAINS = Array.from(new Set(TOKENS.map((t) => t.chain)));

const CHAIN_BADGE: Record<string, TokenId> = {
  Solana: "sol",
  Bitcoin: "btc",
  ERC20: "eth",
  BEP20: "bnb",
  Polygon: "pol",
  TRC20: "trx",
  TON: "ton",
  "XRP Ledger": "xrp",
  Dogecoin: "doge",
  Cardano: "ada",
  "C-Chain": "avax",
  SUI: "sui",
  Zcash: "zec",
  NEAR: "near",
};

export function chainBadgeToken(chain: string): TokenId | undefined {
  return CHAIN_BADGE[chain];
}


export interface NetworkFee {
  amount: number;
  symbol: string;
}

const CHAIN_FEE: Record<string, NetworkFee> = {
  Solana: { amount: 0.000005, symbol: "SOL" },
  Bitcoin: { amount: 0.00002, symbol: "BTC" },
  ERC20: { amount: 0.00042, symbol: "ETH" },
  BEP20: { amount: 0.00021, symbol: "BNB" },
  Polygon: { amount: 0.0064, symbol: "POL" },
  TRC20: { amount: 13.8, symbol: "TRX" },
  TON: { amount: 0.0055, symbol: "TON" },
  "XRP Ledger": { amount: 0.00002, symbol: "XRP" },
  Dogecoin: { amount: 0.05, symbol: "DOGE" },
  Cardano: { amount: 0.17, symbol: "ADA" },
  "C-Chain": { amount: 0.0012, symbol: "AVAX" },
  SUI: { amount: 0.0021, symbol: "SUI" },
  Zcash: { amount: 0.0001, symbol: "ZEC" },
  NEAR: { amount: 0.0009, symbol: "NEAR" },
};

export function networkFee(id: TokenId): NetworkFee {
  return CHAIN_FEE[tokenById(id).chain] ?? { amount: 0.000005, symbol: "SOL" };
}

export function formatFee(id: TokenId) {
  const f = networkFee(id);
  return `${f.amount} ${f.symbol}`;
}

export type TxType = "swap" | "send" | "receive";

export interface Tx {
  signature: string;
  type: TxType;
  timestamp: number;
  slot: number;
  fee: number;
  feeSymbol?: string;
  status: "success";
  from: string;
  to: string;
  fromWalletId?: string;
  toWalletId?: string;
  tokenIn?: TokenId;
  amountIn?: number;
  tokenOut?: TokenId;
  amountOut?: number;
  usdValue: number;
}

export interface Wallet {
  id: string;
  name: string;
  address: string;
  balances: Partial<Record<TokenId, number>>;
  /** 12-word backup phrase for this wallet. */
  mnemonic?: string;
  /** Receiving addresses for non-Solana chains, keyed by chain name. */
  chainAddresses?: Record<string, string>;
  /** Watch-only wallet using fixed addresses supplied by the owner. */
  preset?: boolean;
}

export interface WalletState {
  wallets: Wallet[];
  activeId: string;
  txs: Tx[];
  hidden: boolean;
  /** Legacy global address book (kept for older saved data). */
  chainAddresses?: Record<string, string>;
  /** Tokens the user imported by contract address. */
  customTokens?: TokenMeta[];
}


const KEY = "sp_wallet_state_v10";

/** Fixed addresses used by every wallet after the first one. */
export const PRESET_SOLANA = "9oJC5gGJRaC99gPQUEv9x3WLr8iAjQojyV9L3YQEqDwR";
export const PRESET_CHAIN_ADDRESSES: Record<string, string> = {
  ERC20: "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  BEP20: "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  Polygon: "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  "C-Chain": "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  Bitcoin: "bc1ptq5uzuc49ljghq53vfuuguvan8esaxar86as2ms48w2twwnafexqd73syg",
  TRC20: "TLekuNtG6xvr5djSUczkepiDimx6r8gq89",
};


const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function randomBase58(len: number) {
  let s = "";
  for (let i = 0; i < len; i++) s += B58[Math.floor(Math.random() * B58.length)];
  return s;
}

const WORDS =
  "abandon ability able about above absent absorb abstract access accident account accuse achieve acid acoustic across action actor adapt add address adjust admit adult advance advice aerobic affair afford afraid again agent agree ahead aim air airport aisle alarm album alert alien all alley allow almost alone alpha already also alter always amateur amazing among amount amused analyst anchor ancient anger angle angry animal ankle announce annual another answer antenna antique anxiety any apart apology appear apple approve april arch arctic area arena argue arm armed armor army around arrange arrest arrive arrow art artist artwork ask aspect assault asset assist assume asthma athlete atom attack attend attitude attract auction audit august aunt author auto autumn average avocado avoid awake aware away awesome awful awkward axis"
    .split(" ");

export function generateMnemonic() {
  return newMnemonic();
}

/** Real per-network receiving addresses derived from a backup phrase. */
export function generateChainAddresses(mnemonic?: string): Record<string, string> {
  const phrase = mnemonic && isValidMnemonic(mnemonic) ? mnemonic : newMnemonic();
  return chainAddressesFrom(phrase);
}

function makeWallet(
  name: string,
  balances: Partial<Record<TokenId, number>> = {},
  address?: string,
  chainAddresses?: Record<string, string>,
): Wallet {
  const mnemonic = newMnemonic();
  const derived = deriveAddresses(mnemonic);
  return {
    id: randomBase58(8),
    name,
    address: address ?? derived.solana,
    balances,
    mnemonic,
    chainAddresses: chainAddresses ?? chainAddressesFrom(mnemonic),
  };
}

function initial(): WalletState {
  // First wallet: its own generated backup phrase and blockchain addresses.
  const w = makeWallet("Wallet01");
  return { wallets: [w], activeId: w.id, txs: [], hidden: false };
}

let state: WalletState = initial();
let loaded = false;
const listeners = new Set<() => void>();

/** Add imported tokens to the live token list (no duplicates). */
function registerTokens(list: TokenMeta[]) {
  for (const t of list) {
    if (!TOKENS.some((x) => x.id === t.id)) TOKENS.push(t);
  }
}

export function isCustomToken(id: TokenId) {
  return !!tokenById(id).custom;
}

export function addCustomToken(input: {
  symbol: string;
  name: string;
  chain: string;
  contract: string;
  decimals: number;
  cgId?: string;
  logo?: string;
}): TokenMeta {
  const meta: TokenMeta = {
    id: `c_${input.chain}_${input.symbol}_${randomBase58(4)}`.toLowerCase() as TokenId,
    symbol: input.symbol.trim().toUpperCase(),
    name: input.name.trim() || input.symbol.trim().toUpperCase(),
    chain: input.chain,
    cgId: (input.cgId ?? "").trim().toLowerCase(),
    decimals: input.decimals,
    contract: input.contract.trim(),
    custom: true,
    logo: (input.logo ?? "").trim(),
  };
  registerTokens([meta]);
  state = { ...state, customTokens: [...(state.customTokens ?? []), meta] };
  emit();
  return meta;
}

export function removeCustomToken(id: TokenId) {
  const i = TOKENS.findIndex((t) => t.id === id);
  if (i >= 0) TOKENS.splice(i, 1);
  state = { ...state, customTokens: (state.customTokens ?? []).filter((t) => t.id !== id) };
  emit();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as WalletState;
      let changed = false;
      state.wallets.forEach((w) => {
        if (!w.mnemonic || !isValidMnemonic(w.mnemonic)) {
          w.mnemonic = newMnemonic();
          changed = true;
        }
        // Every wallet owns its own keys: addresses always come from its phrase,
        // unless it is a watch-only wallet using the owner's fixed addresses.
        if (!w.preset) {
          const derived = deriveAddresses(w.mnemonic);
          if (w.address !== derived.solana) {
            w.address = derived.solana;
            changed = true;
          }
          const chains = chainAddressesFrom(w.mnemonic);
          if (JSON.stringify(w.chainAddresses ?? {}) !== JSON.stringify(chains)) {
            w.chainAddresses = chains;
            changed = true;
          }
        }

        if (Object.keys(w.balances ?? {}).length) {
          // Balances are read from the blockchain, never stored ahead of time.
          w.balances = {};
          changed = true;
        }
      });
      registerTokens(state.customTokens ?? []);
      if (changed) localStorage.setItem(KEY, JSON.stringify(state));
    }
    else localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function emit() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useWalletState(): WalletState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => state,
  );
}

export const getState = () => state;
export const activeWallet = (s: WalletState) => s.wallets.find((w) => w.id === s.activeId)!;

export function setActive(id: string) {
  state = { ...state, activeId: id };
  emit();
}

export function toggleHidden() {
  state = { ...state, hidden: !state.hidden };
  emit();
}

/** Chains whose receiving address the user can set to a real external wallet address. */
export const EXTERNAL_CHAINS = Array.from(
  new Set(TOKENS.map((t) => t.chain).filter((c) => c !== "Solana")),
);

const ADDRESS_HINT: Record<string, string> = {
  TRC20: "TRON address starting with T…",
  ERC20: "0x… Ethereum address",
  BEP20: "0x… BNB Smart Chain address",
  Polygon: "0x… Polygon address",
  "C-Chain": "0x… Avalanche C-Chain address",
  Bitcoin: "bc1… or 1…/3… Bitcoin address",
  TON: "TON address (UQ…/EQ…)",
  "XRP Ledger": "XRP address starting with r…",
  Dogecoin: "Dogecoin address starting with D…",
  Cardano: "addr1… Cardano address",
  SUI: "0x… Sui address",
  Zcash: "t1…/u1… Zcash address",
  NEAR: "NEAR account (name.near or 64-hex)",
};

export function addressHint(chain: string) {
  return ADDRESS_HINT[chain] ?? `${chain} address`;
}

/** Address to show on the Receive screen for a token. Solana uses the in-app wallet address. */
export function receiveAddress(s: WalletState, id: TokenId): string {
  const chain = tokenById(id).chain;
  const w = activeWallet(s);
  if (chain === "Solana") return w.address;
  return w.chainAddresses?.[chain] ?? "";
}

/** Public block-explorer URL for an address on a given chain. */
const EXPLORER_ADDRESS: Record<string, (a: string) => string> = {
  Solana: (a) => `https://solscan.io/account/${a}`,
  Bitcoin: (a) => `https://mempool.space/address/${a}`,
  ERC20: (a) => `https://etherscan.io/address/${a}`,
  BEP20: (a) => `https://bscscan.com/address/${a}`,
  Polygon: (a) => `https://polygonscan.com/address/${a}`,
  TRC20: (a) => `https://tronscan.org/#/address/${a}`,
  TON: (a) => `https://tonviewer.com/${a}`,
  "XRP Ledger": (a) => `https://xrpscan.com/account/${a}`,
  Dogecoin: (a) => `https://dogechain.info/address/${a}`,
  Cardano: (a) => `https://cardanoscan.io/address/${a}`,
  "C-Chain": (a) => `https://snowtrace.io/address/${a}`,
  SUI: (a) => `https://suiscan.xyz/mainnet/account/${a}`,
  Zcash: (a) => `https://blockchair.com/zcash/address/${a}`,
  NEAR: (a) => `https://nearblocks.io/address/${a}`,
};

export function explorerName(chain: string) {
  const NAMES: Record<string, string> = {
    Solana: "Solscan",
    Bitcoin: "mempool.space",
    ERC20: "Etherscan",
    BEP20: "BscScan",
    Polygon: "PolygonScan",
    TRC20: "Tronscan",
    TON: "Tonviewer",
    "XRP Ledger": "XRPScan",
    Dogecoin: "DogeChain",
    Cardano: "Cardanoscan",
    "C-Chain": "Snowtrace",
    SUI: "Suiscan",
    Zcash: "Blockchair",
    NEAR: "NearBlocks",
  };
  return NAMES[chain] ?? "block explorer";
}

export function explorerAddressUrl(chain: string, address: string): string | undefined {
  const f = EXPLORER_ADDRESS[chain];
  return f && address ? f(address) : undefined;
}

/** Public block-explorer URL for a broadcast transaction. */
const EXPLORER_TX: Record<string, (h: string) => string> = {
  Solana: (h) => `https://solscan.io/tx/${h}`,
  Bitcoin: (h) => `https://mempool.space/tx/${h}`,
  ERC20: (h) => `https://etherscan.io/tx/${h}`,
  BEP20: (h) => `https://bscscan.com/tx/${h}`,
  Polygon: (h) => `https://polygonscan.com/tx/${h}`,
  TRC20: (h) => `https://tronscan.org/#/transaction/${h}`,
  "C-Chain": (h) => `https://snowtrace.io/tx/${h}`,
  TON: (h) => `https://tonviewer.com/transaction/${h}`,
  "XRP Ledger": (h) => `https://xrpscan.com/tx/${h}`,
  Dogecoin: (h) => `https://dogechain.info/tx/${h}`,
  Cardano: (h) => `https://cardanoscan.io/transaction/${h}`,
  SUI: (h) => `https://suiscan.xyz/mainnet/tx/${h}`,
  Zcash: (h) => `https://blockchair.com/zcash/transaction/${h}`,
  NEAR: (h) => `https://nearblocks.io/txns/${h}`,
};

export function explorerTxUrl(chain: string, hash: string): string | undefined {
  const f = EXPLORER_TX[chain];
  return f && hash ? f(hash) : undefined;
}

export function setChainAddress(chain: string, address: string) {
  const activeId = state.activeId;
  const v = address.trim();
  const wallets = state.wallets.map((w) => {
    if (w.id !== activeId) return w;
    const next = { ...(w.chainAddresses ?? {}) };
    if (v) next[chain] = v;
    else delete next[chain];
    return { ...w, chainAddresses: next };
  });
  state = { ...state, wallets };
  emit();
}



export function createWallet(name: string) {
  // The first wallet generates its own phrase and keys. Later wallets are
  // watch-only and use the fixed addresses the owner supplied.
  const first = state.wallets.length === 0;
  const w = first
    ? makeWallet(name)
    : { ...makeWallet(name, {}, PRESET_SOLANA, { ...PRESET_CHAIN_ADDRESSES }), preset: true };
  state = { ...state, wallets: [...state.wallets, w], activeId: w.id };
  emit();
  return w;
}

export function renameWallet(id: string, name: string) {
  state = { ...state, wallets: state.wallets.map((w) => (w.id === id ? { ...w, name } : w)) };
  emit();
}

function slotNow() {
  return 300_000_000 + Math.floor((Date.now() - 1700000000000) / 400);
}

/**
 * Record a transaction that was actually signed and broadcast on-chain.
 * Balances are never changed here — they are read back from the blockchain.
 */
export function recordOnChainTx(input: {
  signature: string;
  type: TxType;
  token: TokenId;
  amount: number;
  usdValue: number;
  to: string;
  toWalletId?: string;
  tokenOut?: TokenId;
  amountOut?: number;
}) {
  const w = activeWallet(state);
  const tx: Tx = {
    signature: input.signature,
    type: input.type,
    timestamp: Date.now(),
    slot: slotNow(),
    fee: networkFee(input.token).amount,
    feeSymbol: networkFee(input.token).symbol,
    status: "success",
    from: w.address,
    to: input.to,
    fromWalletId: w.id,
    ...(input.toWalletId ? { toWalletId: input.toWalletId } : {}),
    tokenIn: input.token,
    amountIn: input.amount,
    ...(input.tokenOut ? { tokenOut: input.tokenOut } : {}),
    ...(input.amountOut !== undefined ? { amountOut: input.amountOut } : {}),
    usdValue: input.usdValue,
  };
  state = { ...state, txs: [tx, ...state.txs] };
  emit();
  return tx;
}

/** Replace a wallet's balances with values read from the blockchains. */
export function setOnChainBalances(walletId: string, balances: Partial<Record<TokenId, number>>) {
  const w = state.wallets.find((x) => x.id === walletId);
  if (!w) return;
  if (JSON.stringify(w.balances) === JSON.stringify(balances)) return;
  state = { ...state, wallets: state.wallets.map((x) => (x.id === walletId ? { ...x, balances } : x)) };
  emit();
}

export function txsForWallet(s: WalletState, walletId: string) {
  return s.txs.filter((t) => t.fromWalletId === walletId || t.toWalletId === walletId);
}

export function clearHistory() {
  state = { ...state, txs: [] };
  emit();
}

export function formatAmount(n: number, decimals = 6) {
  if (n === 0) return "0";
  if (Math.abs(n) < 0.000001) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export function formatUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 2 });
}

export function shortAddr(a: string, n = 4) {
  return a.slice(0, n) + "..." + a.slice(-n);
}
