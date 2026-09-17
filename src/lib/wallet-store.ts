import { useSyncExternalStore } from "react";
import {
  chainAddressesFrom,
  deriveAddresses,
  isValidMnemonic,
  newMnemonic,
} from "./keys";

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
  {
    id: "usdt",
    symbol: "USDT",
    name: "Tether",
    chain: "Solana",
    cgId: "tether",
    decimals: 6,
    contract: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
  {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    chain: "Solana",
    cgId: "solana",
    decimals: 9,
  },
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    chain: "Bitcoin",
    cgId: "bitcoin",
    decimals: 8,
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    chain: "ERC20",
    cgId: "ethereum",
    decimals: 18,
  },
  {
    id: "bnb",
    symbol: "BNB",
    name: "BNB",
    chain: "BEP20",
    cgId: "binancecoin",
    decimals: 18,
  },
  {
    id: "usdc",
    symbol: "USDC",
    name: "USD Coin",
    chain: "Solana",
    cgId: "usd-coin",
    decimals: 6,
    contract: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
  {
    id: "ton",
    symbol: "TON",
    name: "Toncoin",
    chain: "TON",
    cgId: "the-open-network",
    decimals: 9,
  },
  {
    id: "pol",
    symbol: "POL",
    name: "Polygon",
    chain: "Polygon",
    cgId: "matic-network",
    decimals: 18,
  },
  {
    id: "xrp",
    symbol: "XRP",
    name: "XRP",
    chain: "XRP Ledger",
    cgId: "ripple",
    decimals: 6,
  },
  {
    id: "trx",
    symbol: "TRX",
    name: "TRON",
    chain: "TRC20",
    cgId: "tron",
    decimals: 6,
  },
  {
    id: "doge",
    symbol: "DOGE",
    name: "Dogecoin",
    chain: "Dogecoin",
    cgId: "dogecoin",
    decimals: 8,
  },
  {
    id: "ada",
    symbol: "ADA",
    name: "Cardano",
    chain: "Cardano",
    cgId: "cardano",
    decimals: 6,
  },
  {
    id: "link",
    symbol: "LINK",
    name: "Chainlink",
    chain: "ERC20",
    cgId: "chainlink",
    decimals: 18,
    contract: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  },
  {
    id: "avax",
    symbol: "AVAX",
    name: "Avalanche",
    chain: "C-Chain",
    cgId: "avalanche-2",
    decimals: 18,
  },
  {
    id: "sui",
    symbol: "SUI",
    name: "Sui",
    chain: "SUI",
    cgId: "sui",
    decimals: 9,
  },
  {
    id: "jup",
    symbol: "JUP",
    name: "Jupiter",
    chain: "Solana",
    cgId: "jupiter-exchange-solana",
    decimals: 6,
    contract: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCNB",
  },
  {
    id: "ray",
    symbol: "RAY",
    name: "Raydium",
    chain: "Solana",
    cgId: "raydium",
    decimals: 6,
    contract: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  },
  {
    id: "bonk",
    symbol: "BONK",
    name: "Bonk",
    chain: "Solana",
    cgId: "bonk",
    decimals: 5,
    contract: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  },
  {
    id: "zec",
    symbol: "ZEC",
    name: "Zcash",
    chain: "Zcash",
    cgId: "zcash",
    decimals: 8,
  },
  {
    id: "near",
    symbol: "NEAR",
    name: "NEAR Protocol",
    chain: "NEAR",
    cgId: "near",
    decimals: 24,
  },
  {
    id: "rhea",
    symbol: "RHEA",
    name: "RHEA",
    chain: "ERC20",
    cgId: "rhea-2",
    decimals: 18,
  },
  {
    id: "ern",
    symbol: "ERN",
    name: "Ethernity Chain",
    chain: "ERC20",
    cgId: "ethernity-chain",
    decimals: 18,
  },
  {
    id: "usdt_trc20",
    symbol: "USDT",
    name: "Tether",
    chain: "TRC20",
    cgId: "tether",
    decimals: 6,
    contract: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  },
  {
    id: "usdt_erc20",
    symbol: "USDT",
    name: "Tether",
    chain: "ERC20",
    cgId: "tether",
    decimals: 6,
    contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  {
    id: "usdt_bep20",
    symbol: "USDT",
    name: "Tether",
    chain: "BEP20",
    cgId: "tether",
    decimals: 6,
    contract: "0x55d398326f99059fF775485246999027B3197955",
  },
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
  ({
    id,
    symbol: String(id).toUpperCase(),
    name: String(id),
    chain: "Solana",
    cgId: "",
    decimals: 6,
  } as TokenMeta);

/** All networks a token can be imported on. */
export const ALL_CHAINS = Array.from(
  new Set(TOKENS.map((t) => t.chain)),
);

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

export function chainBadgeToken(
  chain: string,
): TokenId | undefined {
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
  return (
    CHAIN_FEE[tokenById(id).chain] ?? {
      amount: 0.000005,
      symbol: "SOL",
    }
  );
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
  /** Legacy global address book. */
  chainAddresses?: Record<string, string>;
  /** Tokens the user imported by contract address. */
  customTokens?: TokenMeta[];
}

let KEY = "sp_wallet_state_v10";
let walletUserId: string | null = null;

/**
 * Fixed addresses used by every wallet after the first one.
 * These are watch-only/preset addresses and do not contain private keys.
 */
export const PRESET_SOLANA =
  "9oJC5gGJRaC99gPQUEv9x3WLr8iAjQojyV9L3YQEqDwR";

export const PRESET_CHAIN_ADDRESSES: Record<string, string> = {
  ERC20: "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  BEP20: "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  Polygon: "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  "C-Chain": "0x5CABbBCF4D7D7e1148D0BbDC16BCc917B044406a",
  Bitcoin:
    "bc1ptq5uzuc49ljghq53vfuuguvan8esaxar86as2ms48w2twwnafexqd73syg",
  TRC20: "TLekuNtG6xvr5djSUczkepiDimx6r8gq89",
};

const B58 =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function randomBase58(len: number) {
  let s = "";

  for (let i = 0; i < len; i++) {
    s += B58[Math.floor(Math.random() * B58.length)];
  }

  return s;
}

export function generateMnemonic() {
  return newMnemonic();
}

/** Real per-network receiving addresses derived from a backup phrase. */
export function generateChainAddresses(
  mnemonic?: string,
): Record<string, string> {
  const phrase =
    mnemonic && isValidMnemonic(mnemonic)
      ? mnemonic
      : newMnemonic();

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
    chainAddresses:
      chainAddresses ?? chainAddressesFrom(mnemonic),
  };
}

/**
 * IMPORTANT:
 *
 * Do NOT generate a wallet here.
 *
 * This file can be imported by Cloudflare/SSR.
 * Secure random generation during module initialization causes
 * Cloudflare Workers SSR to fail.
 *
 * The real first wallet is created inside load(), which only
 * runs in the browser.
 */
function emptyState(): WalletState {
  return {
    wallets: [],
    activeId: "",
    txs: [],
    hidden: false,
  };
}

let state: WalletState = emptyState();
let loaded = false;

export function setWalletUser(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  if (walletUserId === userId && loaded) return;

  walletUserId = userId;
  KEY = "sp_wallet_state_v10:" + userId;
  loaded = false;
  state = emptyState();
  load();
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();

/** Add imported tokens to the live token list without duplicates. */
function registerTokens(list: TokenMeta[]) {
  for (const token of list) {
    if (!TOKENS.some((existing) => existing.id === token.id)) {
      TOKENS.push(token);
    }
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
    id:
      `c_${input.chain}_${input.symbol}_${randomBase58(4)}`.toLowerCase() as TokenId,
    symbol: input.symbol.trim().toUpperCase(),
    name:
      input.name.trim() ||
      input.symbol.trim().toUpperCase(),
    chain: input.chain,
    cgId: (input.cgId ?? "").trim().toLowerCase(),
    decimals: input.decimals,
    contract: input.contract.trim(),
    custom: true,
    logo: (input.logo ?? "").trim(),
  };

  registerTokens([meta]);

  state = {
    ...state,
    customTokens: [
      ...(state.customTokens ?? []),
      meta,
    ],
  };

  emit();

  return meta;
}

export function removeCustomToken(id: TokenId) {
  const index = TOKENS.findIndex(
    (token) => token.id === id,
  );

  if (index >= 0) {
    TOKENS.splice(index, 1);
  }

  state = {
    ...state,
    customTokens: (state.customTokens ?? []).filter(
      (token) => token.id !== id,
    ),
  };

  emit();
}

/**
 * Load wallet state.
 *
 * This function is browser-only.
 *
 * On a brand-new browser with no saved wallet, the first
 * wallet is generated here rather than during SSR.
 */
function load() {
  if (loaded || typeof window === "undefined" || !walletUserId) {
    return;
  }

  loaded = true;

  try {
    const raw = localStorage.getItem(KEY);

    if (raw) {
      state = JSON.parse(raw) as WalletState;

      let changed = false;

      if (!Array.isArray(state.wallets)) {
        state.wallets = [];
        changed = true;
      }

      if (!Array.isArray(state.txs)) {
        state.txs = [];
        changed = true;
      }

      if (!state.hidden) {
        state.hidden = false;
      }

      /**
       * Existing wallets.
       */
      state.wallets.forEach((wallet) => {
        if (
          !wallet.mnemonic ||
          !isValidMnemonic(wallet.mnemonic)
        ) {
          /**
           * Only do this in the browser.
           */
          wallet.mnemonic = newMnemonic();
          changed = true;
        }

        /**
         * Every normal wallet owns its own keys.
         *
         * Preset wallets are watch-only and keep their
         * supplied addresses.
         */
        if (!wallet.preset) {
          const derived = deriveAddresses(
            wallet.mnemonic,
          );

          if (wallet.address !== derived.solana) {
            wallet.address = derived.solana;
            changed = true;
          }

          const chains = chainAddressesFrom(
            wallet.mnemonic,
          );

          if (
            JSON.stringify(wallet.chainAddresses ?? {}) !==
            JSON.stringify(chains)
          ) {
            wallet.chainAddresses = chains;
            changed = true;
          }
        }

        /**
         * Balances are refreshed from blockchain providers.
         * Do not persist fake/stale balance values.
         */
        if (
          wallet.balances &&
          Object.keys(wallet.balances).length
        ) {
          wallet.balances = {};
          changed = true;
        }
      });

      registerTokens(state.customTokens ?? []);

      /**
       * Existing saved data with no wallets.
       * Generate the first wallet in the browser.
       */
      if (state.wallets.length === 0) {
        const wallet = makeWallet("Wallet01");

        state = {
          ...state,
          wallets: [wallet],
          activeId: wallet.id,
        };

        changed = true;
      }

      /**
       * Make sure activeId points to an existing wallet.
       */
      if (
        !state.activeId ||
        !state.wallets.some(
          (wallet) => wallet.id === state.activeId,
        )
      ) {
        state.activeId = state.wallets[0]?.id ?? "";
        changed = true;
      }

      if (changed) {
        localStorage.setItem(
          KEY,
          JSON.stringify(state),
        );
      }
    } else {
      /**
       * BRAND-NEW USER
       *
       * Wallet generation happens only here, after the
       * browser has loaded and localStorage is available.
       */
      const wallet = makeWallet("Wallet01");

      state = {
        wallets: [wallet],
        activeId: wallet.id,
        txs: [],
        hidden: false,
      };

      localStorage.setItem(
        KEY,
        JSON.stringify(state),
      );
    }
  } catch {
    /**
     * If localStorage contains damaged data, keep the
     * in-memory state instead of crashing the application.
     */
  }
}

function emit() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(state),
      );
    } catch {
      // Ignore localStorage failures.
    }
  }

  listeners.forEach((listener) => listener());
}

function subscribe(cb: () => void) {
  load();

  listeners.add(cb);

  return () => {
    listeners.delete(cb);
  };
}

export function useWalletState(): WalletState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    /**
     * Server snapshot must remain completely deterministic.
     *
     * No wallet generation, crypto random calls, localStorage,
     * or asynchronous work is performed here.
     */
    () => state,
  );
}

export const getState = () => state;

export const activeWallet = (s: WalletState) =>
  s.wallets.find((wallet) => wallet.id === s.activeId) ?? s.wallets[0];

export function setActive(id: string) {
  state = {
    ...state,
    activeId: id,
  };

  emit();
}

export function toggleHidden() {
  state = {
    ...state,
    hidden: !state.hidden,
  };

  emit();
}

/**
 * Chains whose receiving address can be configured.
 */
export const EXTERNAL_CHAINS = Array.from(
  new Set(
    TOKENS
      .map((token) => token.chain)
      .filter((chain) => chain !== "Solana"),
  ),
);

const ADDRESS_HINT: Record<string, string> = {
  TRC20: "TRON address starting with T…",
  ERC20: "0x… Ethereum address",
  BEP20: "0x… BNB Smart Chain address",
  Polygon: "0x… Polygon address",
  "C-Chain": "0x… Avalanche C-Chain address",
  Bitcoin:
    "bc1… or 1…/3… Bitcoin address",
  TON: "TON address (UQ…/EQ…)",
  "XRP Ledger":
    "XRP address starting with r…",
  Dogecoin:
    "Dogecoin address starting with D…",
  Cardano:
    "addr1… Cardano address",
  SUI: "0x… Sui address",
  Zcash:
    "t1…/u1… Zcash address",
  NEAR:
    "NEAR account (name.near or 64-hex)",
};

export function addressHint(chain: string) {
  return (
    ADDRESS_HINT[chain] ??
    `${chain} address`
  );
}

/**
 * Address shown on Receive screen for a token.
 */
export function receiveAddress(
  s: WalletState,
  id: TokenId,
): string {
  const chain = tokenById(id).chain;
  const wallet = activeWallet(s);

  if (!wallet) {
    return "";
  }

  if (chain === "Solana") {
    return wallet.address;
  }

  return wallet.chainAddresses?.[chain] ?? "";
}

/**
 * Public block-explorer URL for an address.
 */
const EXPLORER_ADDRESS: Record<
  string,
  (address: string) => string
> = {
  Solana: (address) =>
    `https://solscan.io/account/${address}`,

  Bitcoin: (address) =>
    `https://mempool.space/address/${address}`,

  ERC20: (address) =>
    `https://etherscan.io/address/${address}`,

  BEP20: (address) =>
    `https://bscscan.com/address/${address}`,

  Polygon: (address) =>
    `https://polygonscan.com/address/${address}`,

  TRC20: (address) =>
    `https://tronscan.org/#/address/${address}`,

  TON: (address) =>
    `https://tonviewer.com/${address}`,

  "XRP Ledger": (address) =>
    `https://xrpscan.com/account/${address}`,

  Dogecoin: (address) =>
    `https://dogechain.info/address/${address}`,

  Cardano: (address) =>
    `https://cardanoscan.io/address/${address}`,

  "C-Chain": (address) =>
    `https://snowtrace.io/address/${address}`,

  SUI: (address) =>
    `https://suiscan.xyz/mainnet/account/${address}`,

  Zcash: (address) =>
    `https://blockchair.com/zcash/address/${address}`,

  NEAR: (address) =>
    `https://nearblocks.io/address/${address}`,
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

export function explorerAddressUrl(
  chain: string,
  address: string,
): string | undefined {
  const formatter = EXPLORER_ADDRESS[chain];

  return formatter && address
    ? formatter(address)
    : undefined;
}

/**
 * Public block-explorer URL for a broadcast transaction.
 */
const EXPLORER_TX: Record<
  string,
  (hash: string) => string
> = {
  Solana: (hash) =>
    `https://solscan.io/tx/${hash}`,

  Bitcoin: (hash) =>
    `https://mempool.space/tx/${hash}`,

  ERC20: (hash) =>
    `https://etherscan.io/tx/${hash}`,

  BEP20: (hash) =>
    `https://bscscan.com/tx/${hash}`,

  Polygon: (hash) =>
    `https://polygonscan.com/tx/${hash}`,

  TRC20: (hash) =>
    `https://tronscan.org/#/transaction/${hash}`,

  "C-Chain": (hash) =>
    `https://snowtrace.io/tx/${hash}`,

  TON: (hash) =>
    `https://tonviewer.com/transaction/${hash}`,

  "XRP Ledger": (hash) =>
    `https://xrpscan.com/tx/${hash}`,

  Dogecoin: (hash) =>
    `https://dogechain.info/tx/${hash}`,

  Cardano: (hash) =>
    `https://cardanoscan.io/transaction/${hash}`,

  SUI: (hash) =>
    `https://suiscan.xyz/mainnet/tx/${hash}`,

  Zcash: (hash) =>
    `https://blockchair.com/zcash/transaction/${hash}`,

  NEAR: (hash) =>
    `https://nearblocks.io/txns/${hash}`,
};

export function explorerTxUrl(
  chain: string,
  hash: string,
): string | undefined {
  const formatter = EXPLORER_TX[chain];

  return formatter && hash
    ? formatter(hash)
    : undefined;
}

export function setChainAddress(
  chain: string,
  address: string,
) {
  const activeId = state.activeId;
  const value = address.trim();

  const wallets = state.wallets.map((wallet) => {
    if (wallet.id !== activeId) {
      return wallet;
    }

    const next = {
      ...(wallet.chainAddresses ?? {}),
    };

    if (value) {
      next[chain] = value;
    } else {
      delete next[chain];
    }

    return {
      ...wallet,
      chainAddresses: next,
    };
  });

  state = {
    ...state,
    wallets,
  };

  emit();
}

export function setPrimaryWalletFromMnemonic(
  name: string,
  mnemonic: string,
) {
  if (typeof window === "undefined") {
    return null;
  }

  if (!isValidMnemonic(mnemonic)) {
    throw new Error("Invalid recovery phrase.");
  }

  const derived = deriveAddresses(mnemonic);
  const chains = chainAddressesFrom(mnemonic);

  const existing = state.wallets[0];

  const wallet: Wallet = {
    id: existing?.id ?? randomBase58(8),
    name: name.trim() || existing?.name || "Wallet01",
    address: derived.solana,
    balances: {},
    mnemonic,
    chainAddresses: chains,
  };

  state = {
    ...state,
    wallets: [wallet, ...state.wallets.slice(1)],
    activeId: wallet.id,
  };

  emit();

  return wallet;
}
export function createWallet(name: string) {
  /**
   * The first wallet is a real wallet generated from a
   * new mnemonic.
   *
   * Additional wallets remain preset/watch-only according
   * to the existing application design.
   */
  const first = state.wallets.length === 0;

  const wallet = first
    ? makeWallet(name)
    : {
        ...makeWallet(
          name,
          {},
          PRESET_SOLANA,
          { ...PRESET_CHAIN_ADDRESSES },
        ),
        preset: true,
      };

  state = {
    ...state,
    wallets: [...state.wallets, wallet],
    activeId: wallet.id,
  };

  emit();

  return wallet;
}

export function renameWallet(
  id: string,
  name: string,
) {
  state = {
    ...state,
    wallets: state.wallets.map((wallet) =>
      wallet.id === id
        ? {
            ...wallet,
            name,
          }
        : wallet,
    ),
  };

  emit();
}

function slotNow() {
  return (
    300_000_000 +
    Math.floor(
      (Date.now() - 1700000000000) / 400,
    )
  );
}

/**
 * Record a transaction that was actually signed
 * and broadcast on-chain.
 *
 * Balances are not changed here.
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
  const wallet = activeWallet(state);

  if (!wallet) {
    throw new Error("No active wallet");
  }

  const fee = networkFee(input.token);

  const tx: Tx = {
    signature: input.signature,
    type: input.type,
    timestamp: Date.now(),
    slot: slotNow(),
    fee: fee.amount,
    feeSymbol: fee.symbol,
    status: "success",
    from: wallet.address,
    to: input.to,
    fromWalletId: wallet.id,
    ...(input.toWalletId
      ? { toWalletId: input.toWalletId }
      : {}),
    tokenIn: input.token,
    amountIn: input.amount,
    ...(input.tokenOut
      ? { tokenOut: input.tokenOut }
      : {}),
    ...(input.amountOut !== undefined
      ? { amountOut: input.amountOut }
      : {}),
    usdValue: input.usdValue,
  };

  state = {
    ...state,
    txs: [tx, ...state.txs],
  };

  emit();

  return tx;
}

/**
 * Replace a wallet's balances with values read
 * from the blockchains.
 */
export function setOnChainBalances(
  walletId: string,
  balances: Partial<Record<TokenId, number>>,
) {
  const wallet = state.wallets.find(
    (item) => item.id === walletId,
  );

  if (!wallet) {
    return;
  }

  if (
    JSON.stringify(wallet.balances) ===
    JSON.stringify(balances)
  ) {
    return;
  }

  state = {
    ...state,
    wallets: state.wallets.map((item) =>
      item.id === walletId
        ? {
            ...item,
            balances,
          }
        : item,
    ),
  };

  emit();
}

export function txsForWallet(
  s: WalletState,
  walletId: string,
) {
  return s.txs.filter(
    (tx) =>
      tx.fromWalletId === walletId ||
      tx.toWalletId === walletId,
  );
}

export function clearHistory() {
  state = {
    ...state,
    txs: [],
  };

  emit();
}

export function formatAmount(
  n: number,
  decimals = 6,
) {
  if (n === 0) {
    return "0";
  }

  if (Math.abs(n) < 0.000001) {
    return n.toExponential(2);
  }

  return n.toLocaleString("en-US", {
    maximumFractionDigits: decimals,
  });
}

export function formatUsd(n: number) {
  return (
    "$" +
    n.toLocaleString("en-US", {
      maximumFractionDigits:
        n < 1 ? 6 : 2,
    })
  );
}

export function shortAddr(
  address: string,
  n = 4,
) {
  if (!address) {
    return "";
  }

  if (address.length <= n * 2 + 3) {
    return address;
  }

  return (
    address.slice(0, n) +
    "..." +
    address.slice(-n)
  );
}


