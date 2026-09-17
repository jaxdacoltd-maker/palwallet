import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ALL_CHAINS, addCustomToken } from "@/lib/wallet-store";
import { detectContractAnyChain, searchTokens, type TokenSearchResult } from "@/lib/token-lookup";
import { Sheet } from "./Sheet";

// Per-network defaults: each chain uses its own standard decimals and placeholder hints.
const CHAIN_DEFAULTS: Record<string, { decimals: number; symbol: string; name: string }> = {
  Solana: { decimals: 9, symbol: "SPL", name: "Solana token" },
  ERC20: { decimals: 18, symbol: "ETH", name: "ERC-20 token" },
  BEP20: { decimals: 18, symbol: "BNB", name: "BEP-20 token" },
  Polygon: { decimals: 18, symbol: "POL", name: "Polygon token" },
  "C-Chain": { decimals: 18, symbol: "AVAX", name: "Avalanche token" },
  Base: { decimals: 18, symbol: "ETH", name: "Base token" },
  TRC20: { decimals: 6, symbol: "TRX", name: "TRC-20 token" },
  Bitcoin: { decimals: 8, symbol: "BTC", name: "Bitcoin asset" },
  TON: { decimals: 9, symbol: "TON", name: "TON jetton" },
  "XRP Ledger": { decimals: 6, symbol: "XRP", name: "XRP Ledger token" },
  Dogecoin: { decimals: 8, symbol: "DOGE", name: "Dogecoin asset" },
  Cardano: { decimals: 6, symbol: "ADA", name: "Cardano native token" },
  SUI: { decimals: 9, symbol: "SUI", name: "Sui coin" },
  NEAR: { decimals: 24, symbol: "NEAR", name: "NEAR token" },
  Zcash: { decimals: 8, symbol: "ZEC", name: "Zcash asset" },
};

function defaultsFor(chain: string) {
  return CHAIN_DEFAULTS[chain] ?? { decimals: 18, symbol: "", name: "" };
}

export function ImportTokenSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [chain, setChain] = useState<string>(ALL_CHAINS[0] ?? "Solana");
  const [contract, setContract] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState(String(defaultsFor(ALL_CHAINS[0] ?? "Solana").decimals));
  const [cgId, setCgId] = useState("");
  const [logo, setLogo] = useState("");
  const [status, setStatus] = useState<"idle" | "looking" | "found" | "missing">("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Search any token by name, symbol or contract across Solana, BSC, Ethereum, TRON and more.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchTokens(q, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResults(found);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) {
          setSearching(false);
          setSearched(true);
        }
      }
    }, 450);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const applyResult = (r: TokenSearchResult) => {
    setChain(r.chain);
    setContract(r.contract);
    setSymbol(r.symbol);
    setName(r.name);
    setCgId(r.cgId);
    setLogo(r.logo);
    setDecimals(String(r.decimals ?? defaultsFor(r.chain).decimals));
    setStatus("found");
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  const pickChain = (c: string) => {
    setChain(c);
    // Each network uses its own standard decimals.
    setDecimals(String(defaultsFor(c).decimals));
  };

  const reset = () => {
    setContract("");
    setSymbol("");
    setName("");
    setCgId("");
    setLogo("");
    setStatus("idle");
  };

  // Auto-detect a pasted contract on any network, straight from the blockchain.
  useEffect(() => {
    const address = contract.trim();
    if (address.length < 20) {
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    setStatus("looking");
    const t = setTimeout(async () => {
      try {
        const found = await detectContractAnyChain(address, ctrl.signal, chain);
        if (ctrl.signal.aborted) return;
        const best = found[0];
        if (!best) {
          setStatus("missing");
          return;
        }
        setChain(best.chain);
        setSymbol(best.symbol);
        setName(best.name);
        setCgId(best.cgId);
        setLogo(best.logo);
        setDecimals(String(best.decimals ?? defaultsFor(best.chain).decimals));
        setStatus("found");
      } catch {
        if (!ctrl.signal.aborted) setStatus("missing");
      }
    }, 400);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
    // Re-runs on paste; the chain is only a hint for which network to prefer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract]);

  const hint = defaultsFor(chain);
  const valid = contract.trim().length >= 20 && symbol.trim().length >= 1 && status !== "looking";

  const submit = () => {
    if (!valid) return;
    const t = addCustomToken({
      chain,
      contract,
      symbol,
      name: name.trim() || hint.name || symbol.trim(),
      decimals: Math.min(30, Math.max(0, parseInt(decimals) || defaultsFor(chain).decimals)),
      cgId,
      logo,
    });
    toast.success(`${t.symbol} added on ${t.chain}`);
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Import token" full>
      <div className="space-y-3">
        <Field
          label="Search token"
          value={query}
          onChange={setQuery}
          placeholder="Name, symbol or contract (BSC, ETH, TRC20, SOL…)"
        />
        {searching && <p className="text-xs text-muted-foreground">Searching all networks…</p>}
        {!searching && searched && results.length === 0 && (
          <p className="text-xs text-muted-foreground">No token found. Fill in the details below manually.</p>
        )}
        {results.length > 0 && (
          <div className="space-y-1.5 rounded-xl bg-surface-2 p-1.5">
            {results.map((r) => (
              <button
                key={`${r.chain}-${r.contract}`}
                onClick={() => applyResult(r)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-background"
              >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-background">
                  {r.logo ? (
                    <img src={r.logo} alt={`${r.symbol} logo`} width={32} height={32} loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {r.symbol.slice(0, 3)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name || r.symbol}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.symbol} · {r.chain}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="mb-2 text-xs text-muted-foreground">Network</div>
          <div className="flex flex-wrap gap-2">
            {ALL_CHAINS.map((c) => (
              <button
                key={c}
                onClick={() => pickChain(c)}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  chain === c ? "bg-brand text-primary-foreground" : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Field label="Contract address" value={contract} onChange={setContract} placeholder="Paste token contract" mono />

        {status === "looking" && (
          <p className="text-xs text-muted-foreground">Looking up this contract…</p>
        )}
        {status === "missing" && (
          <p className="text-xs text-muted-foreground">
            No match found for this contract. You can still fill in the details below manually.
          </p>
        )}
        {status === "found" && (
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <div className="h-9 w-9 overflow-hidden rounded-full bg-background">
              {logo ? (
                <img src={logo} alt={`${symbol} logo`} width={36} height={36} loading="lazy" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                  {symbol.slice(0, 3)}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{name || symbol}</div>
              <div className="text-xs text-muted-foreground">
                {symbol} · {chain} · {decimals} decimals
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Symbol" value={symbol} onChange={setSymbol} placeholder={hint.symbol || "USDX"} />
          <Field label="Decimals" value={decimals} onChange={setDecimals} placeholder={String(hint.decimals)} />
        </div>
        <Field label="Name (optional)" value={name} onChange={setName} placeholder={hint.name || "Token name"} />
        <p className="text-xs text-muted-foreground">
          {chain} standard: {hint.decimals} decimals. Change it only if this token uses a different value.
        </p>
        <Field
          label="Price ID (optional)"
          value={cgId}
          onChange={setCgId}
          placeholder="CoinGecko id, e.g. tether"
        />
        <p className="text-xs text-muted-foreground">
          Adding a price ID lets the app show a live price and logo for this token. Without it the token is listed
          with no price.
        </p>

        <button
          disabled={!valid}
          onClick={submit}
          className="w-full rounded-xl bg-brand py-3.5 font-semibold text-primary-foreground disabled:bg-surface-2 disabled:text-muted-foreground"
        >
          {status === "looking" ? "Detecting token…" : "Import token"}
        </button>
      </div>
    </Sheet>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block rounded-xl bg-surface-2 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? ""}
        className={`w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
    </label>
  );
}
