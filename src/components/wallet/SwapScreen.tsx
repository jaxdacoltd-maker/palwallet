import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import {
  activeWallet,
  formatAmount,
  recordOnChainTx,
  tokenById,
  type TokenId,
  type WalletState,
} from "@/lib/wallet-store";
import type { PriceMap } from "@/lib/prices";
import { TokenIcon } from "./TokenIcon";
import { useFiat } from "@/lib/currency";
import { TokenPicker } from "./TokenPicker";
import {
  canSwapPair,
  executeSwap,
  getSwapQuote,
  swapExplorerUrl,
  type SwapQuote,
} from "@/lib/swap-onchain";
import {
  PRACTICE_USDTZ_PRICE,
  practiceRate,
  practiceSwapOut,
} from "@/lib/practice-swap";

const SLIPPAGE_BPS = 50;

interface SwapResult {
  sig: string;
  from: TokenId;
  to: TokenId;
  amountIn: number;
  amountOut: number;
  usd: number;
  explorer: string;
  practice?: boolean;
}

export function SwapScreen({
  state,
  prices,
  onDone,
}: {
  state: WalletState;
  prices: PriceMap;
  onDone: (sig: string) => void;
}) {
  const w = activeWallet(state);
  const { fmt } = useFiat();

  const [from, setFrom] = useState<TokenId>("usdt");
  const [to, setTo] = useState<TokenId>("sol");
  const [amount, setAmount] = useState("");
  const [picker, setPicker] = useState<null | "from" | "to">(null);
  const [pending, setPending] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SwapResult | null>(null);
  const reqId = useRef(0);

  const pFrom = prices[from]?.price ?? 0;
  const pTo = prices[to]?.price ?? 0;
  const amt = parseFloat(amount) || 0;
  const bal = w.balances[from] ?? 0;
  const routable = canSwapPair(from, to);

  // Wallet 2 / preset wallets continue to use the existing practice
  // calculation without changing the underlying swap behavior.
  const pRate = w.preset ? practiceRate(from, to) : null;
  const practice = !!w.preset;

  // Live route quote from the aggregator.
  useEffect(() => {
    setQuote(null);
    setError("");

    if (practice || !routable || amt <= 0 || from === to) return;

    const id = ++reqId.current;
    setQuoting(true);

    const t = setTimeout(() => {
      getSwapQuote(from, to, amt, SLIPPAGE_BPS)
        .then((q) => {
          if (reqId.current === id) {
            setQuote(q);
          }
        })
        .catch((e: unknown) => {
          if (reqId.current === id) {
            setError(
              e instanceof Error ? e.message : "No route found."
            );
          }
        })
        .finally(() => {
          if (reqId.current === id) {
            setQuoting(false);
          }
        });
    }, 400);

    return () => clearTimeout(t);
  }, [from, to, amt, routable, practice]);

  // Price-based estimate, used whenever there is no live route.
  const estimate =
    pFrom > 0 && pTo > 0 ? (amt * pFrom) / pTo : 0;

  // Existing practice output calculation.
  const specialOut = practice
    ? practiceSwapOut(from, to, amt)
    : 0;

  const practiceOut =
    specialOut > 0
      ? specialOut
      : estimate > 0
        ? estimate
        : amt;

  // Existing practice pricing behavior.
  const priceTo =
    practice && to === "usdtz_bep20"
      ? PRACTICE_USDTZ_PRICE
      : pTo;

  const out = practice
    ? practiceOut
    : quote?.outAmount ?? estimate;

  const estimated =
    !practice && !quote && estimate > 0;

  // Both practice and live swaps must not exceed the wallet balance.
  const valid = practice
    ? amt > 0 &&
      amt <= bal &&
      from !== to
    : amt > 0 &&
      amt <= bal &&
      from !== to &&
      routable &&
      !!quote;

  const doPracticeSwap = async () => {
    if (!valid || pending) return;

    setPending(true);
    setError("");

    await new Promise((r) => setTimeout(r, 2000));

    setResult({
      sig: "",
      from,
      to,
      amountIn: amt,
      amountOut: practiceOut,
      usd: amt * pFrom,
      explorer: "",
      practice: true,
    });

    setAmount("");
    setPending(false);
  };

  const doSwap = async () => {
    if (practice) return doPracticeSwap();

    if (!valid || pending || !quote) return;

    setPending(true);
    setError("");

    try {
      const sig = await executeSwap(w.mnemonic, quote);

      recordOnChainTx({
        signature: sig,
        type: "swap",
        token: from,
        amount: quote.inAmount,
        usdValue: quote.inAmount * pFrom,
        to: "Jupiter Aggregator",
        tokenOut: to,
        amountOut: quote.outAmount,
      });

      setAmount("");
      setQuote(null);

      setResult({
        sig,
        from,
        to,
        amountIn: quote.inAmount,
        amountOut: quote.outAmount,
        usd: quote.inAmount * pFrom,
        explorer: swapExplorerUrl(quote, sig),
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The swap failed."
      );
    } finally {
      setPending(false);
    }
  };

  const flip = () => {
    setFrom(to);
    setTo(from);
    setAmount("");
  };

  const label = useMemo(() => {
    if (from === to) return "Select different tokens";

    // Balance check applies to practice/preset wallets too.
    if (amt > bal) return "Insufficient balance";

    if (practice) return "Swap";

    if (!routable) {
      return "Estimate only — this pair can't be traded here";
    }

    if (quoting) return "Finding best route…";

    return "Swap";
  }, [
    from,
    to,
    routable,
    amt,
    bal,
    quoting,
    practice,
  ]);

  return (
    <div className="px-4 pb-6">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3 pt-1">
        <span className="text-lg font-semibold">Swap</span>
      </div>

      <div className="relative">
        <div className="rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Pay
            </span>

            <span className="text-muted-foreground">
              {formatAmount(bal, 6)}{" "}
              <button
                className="ml-1 font-medium text-brand"
                onClick={() => setAmount(String(bal))}
              >
                MAX
              </button>
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setPicker("from")}
              className="flex items-center gap-2"
            >
              <TokenIcon
                id={from}
                prices={prices}
                size={44}
              />

              <div className="text-left">
                <div className="text-lg font-semibold">
                  {tokenById(from).symbol}
                </div>

                <div className="text-xs text-muted-foreground">
                  {tokenById(from).chain}
                </div>
              </div>
            </button>

            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(
                  e.target.value.replace(
                    /[^0-9.]/g,
                    ""
                  )
                )
              }
              placeholder="Enter Amount"
              className="w-full min-w-0 flex-1 text-right text-2xl font-semibold outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="mt-1 text-right text-xs text-muted-foreground">
            ≈ {fmt(amt * pFrom)}
          </div>
        </div>

        <button
          onClick={flip}
          aria-label="Switch tokens"
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background bg-surface-2 p-3"
        >
          <ArrowDownUp size={18} />
        </button>

        <div className="mt-2 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Receive
            </span>

            <span className="text-muted-foreground">
              {formatAmount(
                w.balances[to] ?? 0,
                6
              )}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setPicker("to")}
              className="flex items-center gap-2"
            >
              <TokenIcon
                id={to}
                prices={prices}
                size={44}
              />

              <div className="text-left">
                <div className="text-lg font-semibold">
                  {tokenById(to).symbol}
                </div>

                <div className="text-xs text-muted-foreground">
                  {tokenById(to).chain}
                </div>
              </div>
            </button>

            <div className="flex-1 truncate text-right text-2xl font-semibold text-muted-foreground">
              {quoting
                ? "…"
                : out
                  ? formatAmount(out, 8)
                  : "0"}
            </div>
          </div>

          <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            {estimated && (
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium">
                Estimated
              </span>
            )}

            <span>
              ≈ {fmt(out * priceTo)}
            </span>
          </div>
        </div>
      </div>

      <button
        disabled={!valid || pending}
        onClick={doSwap}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-semibold text-primary-foreground disabled:bg-surface disabled:text-muted-foreground"
      >
        {pending ? (
          <>
            <Loader2
              size={18}
              className="animate-spin"
            />
            Swapping...
          </>
        ) : (
          label
        )}
      </button>

      {error && !estimated && (
        <p className="mt-3 text-center text-sm text-down">
          {error}
        </p>
      )}

      {estimated && amt > 0 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Showing the amount you would get at current
          market prices. This pair can't be traded inside
          the wallet yet.
        </p>
      )}

      <div className="mt-4 space-y-3 rounded-2xl bg-surface p-4 text-sm">
        <Row label="Rate">
          {practice
            ? amt > 0 && practiceOut > 0
              ? `1 ${tokenById(from).symbol} ≈ ${formatAmount(
                  practiceOut / amt,
                  6
                )} ${tokenById(to).symbol}`
              : pRate !== null
                ? `1 ${tokenById(from).symbol} = ${formatAmount(
                    pRate,
                    6
                  )} ${tokenById(to).symbol}`
                : pFrom > 0 && pTo > 0
                  ? `1 ${tokenById(from).symbol} ≈ ${formatAmount(
                      pFrom / pTo,
                      6
                    )} ${tokenById(to).symbol}`
                  : "—"
            : quote && quote.inAmount > 0
              ? `1 ${tokenById(from).symbol} ≈ ${formatAmount(
                  quote.outAmount /
                    quote.inAmount,
                  6
                )} ${tokenById(to).symbol}`
              : pFrom > 0 && pTo > 0
                ? `1 ${tokenById(from).symbol} ≈ ${formatAmount(
                    pFrom / pTo,
                    6
                  )} ${tokenById(to).symbol}`
                : "—"}
        </Row>

        <Row label="Route">
          {practice
            ? "BEP20 DEX"
            : quote
              ? quote.kind === "evm"
                ? `${quote.chainName} DEX`
                : "Jupiter (Solana)"
              : estimated
                ? "Market price estimate"
                : "—"}
        </Row>

        <Row label="Slippage">
          {practice
            ? "0.50%"
            : `${(SLIPPAGE_BPS / 100).toFixed(2)}%`}
        </Row>

        <Row label="Price impact">
          {!practice &&
          quote &&
          quote.kind === "solana"
            ? `${quote.priceImpactPct.toFixed(2)}%`
            : "—"}
        </Row>
      </div>

      {!practice && (
        <p className="mt-4 rounded-2xl border border-border p-4 text-xs leading-relaxed text-muted-foreground">
          Swaps are signed with this wallet's own key and
          broadcast on Solana or the token's own EVM
          network. They are final and cannot be reversed,
          and you need a little SOL for network fees.
        </p>
      )}

      <TokenPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onSelect={(id) =>
          picker === "from"
            ? setFrom(id)
            : setTo(id)
        }
        prices={prices}
        balances={w.balances}
      />

      {pending && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/90 px-8 text-center">
          <Loader2
            size={44}
            className="animate-spin text-brand"
          />

          <p className="mt-5 text-lg font-semibold">
            Processing
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Swapping{" "}
            {formatAmount(amt, 6)}{" "}
            {tokenById(from).symbol} on{" "}
            {tokenById(from).chain}
          </p>
        </div>
      )}

      {result && (
        <SwapSuccess
          result={result}
          prices={prices}
          onClose={() => setResult(null)}
          onView={() => {
            const sig = result.sig;
            setResult(null);
            onDone(sig);
          }}
        />
      )}
    </div>
  );
}

function SwapSuccess({
  result,
  prices,
  onClose,
  onView,
}: {
  result: SwapResult;
  prices: PriceMap;
  onClose: () => void;
  onView: () => void;
}) {
  const { fmt: fmtSuccess } = useFiat();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background px-6 pb-8 pt-16">
      <div className="flex flex-1 flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-up/15">
          <CheckCircle2
            size={38}
            className="text-up"
          />
        </span>

        <h2 className="mt-4 text-xl font-semibold">
          {result.practice
            ? "Swap Complete"
            : "Swap Successful"}
        </h2>

        {!result.practice && (
          <p className="mt-1 text-sm text-muted-foreground">
            ≈ {fmtSuccess(result.usd)}
          </p>
        )}

        <div className="mt-8 w-full space-y-2">
          <SuccessRow
            prices={prices}
            id={result.from}
            label="Paid"
            amount={`-${formatAmount(
              result.amountIn,
              6
            )} ${tokenById(result.from).symbol}`}
          />

          <SuccessRow
            prices={prices}
            id={result.to}
            label="Received"
            amount={`+${formatAmount(
              result.amountOut,
              6
            )} ${tokenById(result.to).symbol}`}
            positive
          />
        </div>

        <div className="mt-6 w-full space-y-3 rounded-2xl bg-surface p-4 text-sm">
          <Row label="Status">
            {result.practice ? (
              <span className="text-muted-foreground">
                Complete
              </span>
            ) : (
              <span className="text-up">
                Confirmed
              </span>
            )}
          </Row>

          <Row label="Route">
            {result.practice
              ? "BEP20 DEX"
              : "Jupiter (Solana)"}
          </Row>

          <Row label="Time">
            {new Date().toLocaleString()}
          </Row>
        </div>
      </div>

      {!result.practice && (
        <a
          href={result.explorer}
          target="_blank"
          rel="noreferrer"
          onClick={onView}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3.5 font-semibold"
        >
          View on Solscan
          <ExternalLink size={16} />
        </a>
      )}

      <button
        onClick={onClose}
        className="mt-3 w-full rounded-xl bg-brand py-3.5 font-semibold text-primary-foreground"
      >
        Done
      </button>
    </div>
  );
}

function SuccessRow({
  id,
  label,
  amount,
  prices,
  positive,
}: {
  id: TokenId;
  label: string;
  amount: string;
  prices: PriceMap;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5">
      <TokenIcon
        id={id}
        prices={prices}
        size={40}
      />

      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {tokenById(id).symbol}
        </div>

        <div className="text-xs text-muted-foreground">
          {label} · {tokenById(id).chain}
        </div>
      </div>

      <div
        className={`text-sm font-medium ${
          positive ? "text-up" : ""
        }`}
      >
        {amount}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">
        {label}
      </span>

      <span>{children}</span>
    </div>
  );
}