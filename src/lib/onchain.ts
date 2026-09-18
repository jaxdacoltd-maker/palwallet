// Reads real mainnet balances for wallet receiving addresses.
import { useQuery } from "@tanstack/react-query";
import { TOKENS, type TokenId, type Wallet } from "./wallet-store";

const SOL_RPC = "https://solana-rpc.publicnode.com";

const EVM_RPC: Record<string, string> = {
  ERC20: "https://ethereum-rpc.publicnode.com",
  BEP20: "https://bsc-rpc.publicnode.com",
  Polygon: "https://polygon-bor-rpc.publicnode.com",
  "C-Chain": "https://avalanche-c-chain-rpc.publicnode.com",
};

const EVM_NATIVE: Record<string, TokenId> = {
  ERC20: "eth",
  BEP20: "bnb",
  Polygon: "pol",
  "C-Chain": "avax",
};

/** Well-known Solana tokens. */
const SOL_MINTS: Record<string, TokenId> = {
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: "usdt",
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "usdc",
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: "jup",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "ray",
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: "bonk",
};

/** Well-known EVM tokens. */
const EVM_TOKENS: Record<
  string,
  { contract: string; id: TokenId; decimals: number }[]
> = {
  ERC20: [
    {
      contract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      id: "usdt_erc20",
      decimals: 6,
    },
    {
      contract: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
      id: "link",
      decimals: 18,
    },
  ],

  BEP20: [
    {
      contract: "0x55d398326f99059fF775485246999027B3197955",
      id: "usdt_bep20",
      decimals: 18,
    },
  ],

  Polygon: [
    {
      contract: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      id: "usdt_erc20",
      decimals: 6,
    },
  ],

  "C-Chain": [],
};

const TRON_USDT =
  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

async function rpc(
  url: string,
  method: string,
  params: unknown[],
) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  if (!res.ok) {
    throw new Error(`${method} failed`);
  }

  const json = (await res.json()) as {
    result?: unknown;
    error?: {
      message: string;
    };
  };

  if (json.error) {
    throw new Error(json.error.message);
  }

  return json.result;
}

function add(
  map: Partial<Record<TokenId, number>>,
  id: TokenId,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  map[id] = (map[id] ?? 0) + amount;
}

/* -------------------------------------------------------------------------- */
/* SOLANA                                                                     */
/* -------------------------------------------------------------------------- */

async function solanaBalances(
  address: string,
  out: Partial<Record<TokenId, number>>,
) {
  const lamports = (await rpc(
    SOL_RPC,
    "getBalance",
    [address],
  )) as {
    value: number;
  };

  add(
    out,
    "sol",
    (lamports?.value ?? 0) / 1e9,
  );

  const accounts = (await rpc(
    SOL_RPC,
    "getTokenAccountsByOwner",
    [
      address,
      {
        programId:
          "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      },
      {
        encoding: "jsonParsed",
      },
    ],
  )) as {
    value: {
      account: {
        data: {
          parsed: {
            info: {
              mint: string;
              tokenAmount: {
                uiAmount: number | null;
              };
            };
          };
        };
      };
    }[];
  };

  const customByContract = new Map(
    TOKENS
      .filter(
        (t) =>
          t.custom &&
          t.contract &&
          t.chain === "Solana",
      )
      .map((t) => [
        t.contract!,
        t.id,
      ]),
  );

  for (const account of accounts?.value ?? []) {
    const info =
      account.account.data.parsed.info;

    const id =
      SOL_MINTS[info.mint] ??
      customByContract.get(info.mint);

    if (id) {
      add(
        out,
        id,
        info.tokenAmount.uiAmount ?? 0,
      );
    }
  }
}

/* -------------------------------------------------------------------------- */
/* EVM / ERC20 / BEP20 / POLYGON / AVALANCHE                                 */
/* -------------------------------------------------------------------------- */

async function evmBalances(
  chain: string,
  address: string,
  out: Partial<Record<TokenId, number>>,
) {
  const url = EVM_RPC[chain];

  if (!url) {
    return;
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return;
  }

  /* Native coin */
  const nativeRaw = (await rpc(
    url,
    "eth_getBalance",
    [address, "latest"],
  )) as string;

  const nativeValue =
    Number(
      BigInt(nativeRaw ?? "0x0"),
    ) / 1e18;

  add(
    out,
    EVM_NATIVE[chain]!,
    nativeValue,
  );

  /*
   * Start with built-in tokens.
   */
  const configured = [
    ...(EVM_TOKENS[chain] ?? []),
    ...TOKENS
      .filter(
        (t) =>
          t.contract &&
          t.chain === chain,
      )
      .map((t) => ({
        contract: t.contract!,
        id: t.id,
        decimals: t.decimals,
      })),
  ];

  /*
   * Remove duplicate contract/id combinations.
   */
  const watched = new Map<
    string,
    {
      contract: string;
      id: TokenId;
      decimals: number;
    }
  >();

  for (const token of configured) {
    watched.set(
      `${token.contract.toLowerCase()}:${token.id}`,
      token,
    );
  }

  /*
   * ERC20 balanceOf(address)
   *
   * 0x70a08231
   */
  const cleanAddress =
    address
      .replace(/^0x/i, "")
      .toLowerCase();

  const data =
    `0x70a08231${cleanAddress.padStart(64, "0")}`;

  /*
   * Read every configured token on this network.
   */
  for (const token of watched.values()) {
    try {
      const raw = (await rpc(
        url,
        "eth_call",
        [
          {
            to: token.contract,
            data,
          },
          "latest",
        ],
      )) as string;

      if (
        !raw ||
        raw === "0x"
      ) {
        continue;
      }

      const rawValue = BigInt(raw);

      const amount =
        Number(rawValue) /
        10 ** token.decimals;

      add(
        out,
        token.id,
        amount,
      );
    } catch {
      /*
       * Some token contracts may reject eth_call.
       * Do not stop the rest of the wallet balances.
       */
    }
  }
}

/* -------------------------------------------------------------------------- */
/* BITCOIN                                                                    */
/* -------------------------------------------------------------------------- */

async function bitcoinBalance(
  address: string,
  out: Partial<Record<TokenId, number>>,
) {
  const res = await fetch(
    `https://mempool.space/api/address/${encodeURIComponent(address)}`,
  );

  if (!res.ok) {
    return;
  }

  const j = (await res.json()) as {
    chain_stats: {
      funded_txo_sum: number;
      spent_txo_sum: number;
    };
    mempool_stats: {
      funded_txo_sum: number;
      spent_txo_sum: number;
    };
  };

  const sats =
    j.chain_stats.funded_txo_sum -
    j.chain_stats.spent_txo_sum +
    j.mempool_stats.funded_txo_sum -
    j.mempool_stats.spent_txo_sum;

  add(
    out,
    "btc",
    sats / 1e8,
  );
}

/* -------------------------------------------------------------------------- */
/* TRON                                                                       */
/* -------------------------------------------------------------------------- */

async function tronBalances(
  address: string,
  out: Partial<Record<TokenId, number>>,
) {
  const res = await fetch(
    `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`,
  );

  if (!res.ok) {
    return;
  }

  const j = (await res.json()) as {
    data?: {
      balance?: number;
      trc20?: Record<string, string>[];
    }[];
  };

  const account = j.data?.[0];

  if (!account) {
    return;
  }

  add(
    out,
    "trx",
    (account.balance ?? 0) / 1e6,
  );

  for (const entry of account.trc20 ?? []) {
    for (const [
      contract,
      raw,
    ] of Object.entries(entry)) {
      if (
        contract.toLowerCase() ===
        TRON_USDT.toLowerCase()
      ) {
        add(
          out,
          "usdt_trc20",
          Number(raw) / 1e6,
        );
      }

      const custom =
        TOKENS.find(
          (t) =>
            t.custom &&
            t.chain === "TRC20" &&
            t.contract?.toLowerCase() ===
              contract.toLowerCase(),
        );

      if (custom) {
        add(
          out,
          custom.id,
          Number(raw) /
            10 ** custom.decimals,
        );
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* MAIN BALANCE LOADER                                                        */
/* -------------------------------------------------------------------------- */

export interface OnChainResult {
  balances: Partial<Record<TokenId, number>>;
  errors: string[];
}

export async function fetchOnChainBalances(
  wallet: Wallet,
): Promise<OnChainResult> {
  const out: Partial<Record<TokenId, number>> = {};
  const errors: string[] = {};

  const addrs =
    wallet.chainAddresses ?? {};

  const jobs: Promise<void>[] = [];

  /*
   * Wallet 1 / real wallet:
   * use its actual derived Solana address.
   */
  if (
    wallet.address &&
    !wallet.preset
  ) {
    jobs.push(
      solanaBalances(
        wallet.address,
        out,
      ).catch(() => {
        errors.push("Solana");
      }),
    );
  }

  /*
   * EVM networks:
   *
   * Ethereum
   * BSC
   * Polygon
   * Avalanche C-Chain
   */
  for (const chain of Object.keys(
    EVM_RPC,
  )) {
    const address =
      addrs[chain];

    if (!address) {
      continue;
    }

    jobs.push(
      evmBalances(
        chain,
        address,
        out,
      ).catch(() => {
        errors.push(chain);
      }),
    );
  }

  /*
   * Bitcoin
   */
  if (addrs.Bitcoin) {
    jobs.push(
      bitcoinBalance(
        addrs.Bitcoin,
        out,
      ).catch(() => {
        errors.push("Bitcoin");
      }),
    );
  }

  /*
   * TRON
   */
  if (addrs.TRC20) {
    jobs.push(
      tronBalances(
        addrs.TRC20,
        out,
      ).catch(() => {
        errors.push("TRC20");
      }),
    );
  }

  await Promise.all(jobs);

  return {
    balances: out,
    errors,
  };
}

/* -------------------------------------------------------------------------- */
/* REACT QUERY                                                                */
/* -------------------------------------------------------------------------- */

export function useOnChainBalances(
  wallet: Wallet | undefined,
) {
  return useQuery({
    queryKey: [
      "onchain",
      wallet?.id,
      wallet?.address,
      wallet?.chainAddresses,
      TOKENS.length,
    ],
    enabled: !!wallet,
    queryFn: () =>
      fetchOnChainBalances(wallet!),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}