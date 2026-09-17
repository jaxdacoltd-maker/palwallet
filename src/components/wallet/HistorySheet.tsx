import { FileText, Repeat, Trash2 } from "lucide-react";
import {
  activeWallet,
  clearHistory,
  formatAmount,
  shortAddr,
  tokenById,
  txsForWallet,
  explorerTxUrl,
  type Tx,
  type WalletState,
} from "@/lib/wallet-store";
import type { PriceMap } from "@/lib/prices";
import { Sheet } from "./Sheet";
import { TokenIcon } from "./TokenIcon";

export function txLabel(tx: Tx, walletId: string) {
  if (tx.type === "swap") return "Swap";
  return tx.fromWalletId === walletId ? "Send" : "Receive";
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeOf(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

function MiniToken({ id, prices }: { id: NonNullable<Tx["tokenIn"]>; prices: PriceMap }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center overflow-hidden rounded-full align-[-2px]">
      <TokenIcon id={id} prices={prices} size={16} />
    </span>
  );
}

export function HistorySheet({
  open,
  onClose,
  state,
  prices,
}: {
  open: boolean;
  onClose: () => void;
  state: WalletState;
  prices: PriceMap;
}) {
  const w = activeWallet(state);
  const txs = txsForWallet(state, w.id);

  const groups: [string, Tx[]][] = [];
  for (const tx of txs) {
    const k = dayKey(tx.timestamp);
    const g = groups.find(([key]) => key === k);
    if (g) g[1].push(tx);
    else groups.push([k, [tx]]);
  }

  return (
    <Sheet open={open} onClose={onClose} title="History" full>
      {txs.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <>
          <div className="mb-3 flex justify-end">
            <button
              onClick={() => clearHistory()}
              className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
          <div className="space-y-5">
            {groups.map(([day, list]) => (
              <div key={day}>
                <div className="mb-2 text-sm text-muted-foreground">{day}</div>
                <div className="divide-y divide-border rounded-xl">
                  {list.map((tx) => {
                    const isSwap = tx.type === "swap";
                    const incoming = tx.toWalletId === w.id && tx.fromWalletId !== w.id;
                    return (
                      <a
                        key={tx.signature}
                        href={explorerTxUrl(tokenById(tx.tokenIn ?? "sol").chain, tx.signature) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-1 py-3.5"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                          {isSwap ? <Repeat size={18} /> : <FileText size={18} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{isSwap ? "Swap" : "Transfer"}</div>
                          {isSwap ? (
                            <>
                              <div className="truncate text-xs text-muted-foreground">
                                {formatAmount(tx.amountIn ?? 0, 4)}{" "}
                                <span className="text-brand">{tokenById(tx.tokenIn!).symbol}</span>
                                {" → "}
                                {formatAmount(tx.amountOut ?? 0, 4)}{" "}
                                <span className="text-brand">{tokenById(tx.tokenOut!).symbol}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">Jupiter · Solana</div>
                            </>
                          ) : (
                            <>
                              <div className="text-xs text-muted-foreground">
                                To {incoming ? shortAddr(tx.to) : shortAddr(tx.to)}
                              </div>
                              <div className="text-xs text-muted-foreground">From {shortAddr(tx.from)}</div>
                            </>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {isSwap ? (
                            <>
                              <div className="text-sm font-medium text-up">
                                + {formatAmount(tx.amountOut ?? 0, 6)} <MiniToken id={tx.tokenOut!} prices={prices} />{" "}
                                {tokenById(tx.tokenOut!).symbol}
                              </div>
                              <div className="mt-1 inline-block rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                ${formatAmount(tx.usdValue, 2)}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm font-medium">
                              {formatAmount(tx.amountIn ?? 0, 6)} <MiniToken id={tx.tokenIn!} prices={prices} />{" "}
                              {tokenById(tx.tokenIn!).symbol}
                            </div>
                          )}
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{timeOf(tx.timestamp)}</div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
