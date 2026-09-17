import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, CreditCard, Eye, EyeOff, History, Image as ImageIcon, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  TOKENS,
  activeWallet,
  addressHint,
  explorerAddressUrl,
  explorerName,

  formatAmount,
  formatFee,
  receiveAddress,
  recordOnChainTx,
  setChainAddress,
  setOnChainBalances,
  shortAddr,
  toggleHidden,
  tokenById,
  type TokenId,
  type WalletState,
} from "@/lib/wallet-store";

import type { PriceMap } from "@/lib/prices";
import { useFiat } from "@/lib/currency";
import { useOnChainBalances } from "@/lib/onchain";
import { canSendOnChain, sendRealToken } from "@/lib/send-onchain";
import { CurrencyPicker } from "./CurrencyPicker";
import { TokenIcon, Change } from "./TokenIcon";
import { Sparkline } from "./Sparkline";
import { ImportTokenSheet } from "./ImportTokenSheet";
import { Sheet } from "./Sheet";
import { TokenPicker } from "./TokenPicker";
import { NftTab } from "./NftTab";
import { toast } from "sonner";


export function WalletScreen({
  state,
  prices,
  onOpenHistory,
  onGoSwap,
}: {
  state: WalletState;
  prices: PriceMap;
  onOpenHistory: () => void;
  onGoSwap?: () => void;
}) {
  const w = activeWallet(state);
  const [tab, setTab] = useState<"coin" | "earn" | "nft">("coin");
  const [q, setQ] = useState("");
  const [send, setSend] = useState(false);
  const [receive, setReceive] = useState(false);
  const [detail, setDetail] = useState<TokenId | null>(null);
  const [preset, setPreset] = useState<TokenId | undefined>(undefined);
  const [curOpen, setCurOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const { fmt, currency } = useFiat();
  const chain = useOnChainBalances(w);

  useEffect(() => {
    if (chain.data) setOnChainBalances(w.id, chain.data.balances);
  }, [chain.data, w.id]);


  const total = useMemo(
    () => TOKENS.reduce((sum, t) => sum + (w.balances[t.id] ?? 0) * (prices[t.id]?.price ?? 0), 0),
    [w, prices],
  );
  const btcPrice = prices.btc?.price || 1;

  const list = TOKENS.filter(
    (t) => t.symbol.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase()),
  ).sort((a, b) => (w.balances[b.id] ?? 0) * (prices[b.id]?.price ?? 0) - (w.balances[a.id] ?? 0) * (prices[a.id]?.price ?? 0));

  const hide = state.hidden;
  const mask = (s: string) => (hide ? "****" : s);

  return (
    <div className="pb-4">
      <div className="flex border-b border-border">
        {(["coin", "earn", "nft"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 pb-3 pt-1 text-lg font-semibold capitalize ${
              tab === t ? "border-b-2 border-brand text-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "nft" ? "NFT" : t}
          </button>
        ))}
      </div>

      {tab === "earn" ? (
        <div className="px-4 py-20 text-center text-sm text-muted-foreground">No staking positions yet.</div>
      ) : tab === "nft" ? (
        <NftTab wallet={w} />
      ) : (
        <>
          <div className="px-4 pt-6 text-center">
            <button
              onClick={toggleHidden}
              className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              Balance {hide ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {w.preset ? (
              <>
                <div className="mt-1 text-[42px] font-semibold leading-tight">{mask(fmt(0))}</div>
                <div className="text-muted-foreground">{mask("0.000000 BTC")}</div>
              </>
            ) : (
              <>
                <div className="mt-1 text-[42px] font-semibold leading-tight">
                  {mask(fmt(total))}
                </div>
                <div className="text-muted-foreground">{mask(formatAmount(total / btcPrice, 6) + " BTC")}</div>
              </>
            )}
            <button
              onClick={() => chain.refetch()}
              className="mx-auto mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <RefreshCw size={13} className={chain.isFetching ? "animate-spin" : ""} />
              {chain.isFetching
                ? "Syncing balances from the blockchain…"
                : chain.data?.errors.length
                  ? `Live balances · ${chain.data.errors.length} network(s) unavailable`
                  : "Live on-chain balances · tap to refresh"}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-5 gap-1 px-3">
            <Action icon={<ArrowUp size={22} />} label="Send" onClick={() => setSend(true)} />
            <Action icon={<ArrowDown size={22} />} label="Receive" onClick={() => setReceive(true)} />
            <Action icon={<CreditCard size={22} />} label="Buy" onClick={() => onGoSwap?.()} />
            <Action icon={<History size={22} />} label="History" onClick={onOpenHistory} />
            <Action icon={<Plus size={22} />} label="Import" onClick={() => setImportOpen(true)} />
          </div>

          <div className="mt-5 flex items-center gap-2 px-4">
            <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
              <Search size={18} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="w-full text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={() => setCurOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2.5 text-sm"
            >
              <span>{currency.flag}</span> {currency.code}
            </button>

          </div>

          <div className="mt-3 space-y-2 px-4">
            {list.map((t) => {
              const bal = w.balances[t.id] ?? 0;
              const p = prices[t.id];
              return (
                <button
                  key={t.id}
                  onClick={() => setDetail(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl bg-surface px-3 py-3 text-left transition-colors active:bg-surface-2"
                >
                  <TokenIcon id={t.id} prices={prices} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium">
                      {t.symbol} <span className="text-muted-foreground">({t.chain})</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmt(p?.price ?? 0, 6)} <Change value={p?.change ?? 0} />
                    </div>
                  </div>
                  <Sparkline data={p?.sparkline ?? []} up={(p?.change ?? 0) >= 0} width={56} height={26} />
                  <div className="text-right">
                    <div className="text-[15px]">{mask(formatAmount(bal, t.decimals))}</div>
                    <div className="text-xs text-muted-foreground">
                      {mask(fmt(bal * (p?.price ?? 0)))}
                    </div>
                  </div>

                </button>
              );
            })}
            <button
              onClick={() => setImportOpen(true)}
              className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground"
            >
              + Import token
            </button>
          </div>
        </>
      )}

      <SendSheet
        key={"send-" + (preset ?? "")}
        open={send}
        onClose={() => setSend(false)}
        state={state}
        prices={prices}
        initialToken={preset}
      />
      <ReceiveSheet
        key={"recv-" + (preset ?? "")}
        open={receive}
        onClose={() => setReceive(false)}
        state={state}
        prices={prices}
        initialToken={preset}
      />
      <TokenDetailSheet
        id={detail}
        state={state}
        prices={prices}
        onClose={() => setDetail(null)}
        onSend={(id) => {
          setPreset(id);
          setDetail(null);
          setSend(true);
        }}
        onReceive={(id) => {
          setPreset(id);
          setDetail(null);
          setReceive(true);
        }}
      />
      <CurrencyPicker open={curOpen} onClose={() => setCurOpen(false)} />
      <ImportTokenSheet open={importOpen} onClose={() => setImportOpen(false)} />

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function FiatHint({ usd }: { usd: number }) {
  const { fmt } = useFiat();
  return <div className="text-xs text-muted-foreground">≈ {fmt(usd)}</div>;
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">{icon}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </button>
  );
}

function SendSheet({
  open,
  onClose,
  state,
  prices,
  initialToken,
}: {
  open: boolean;
  onClose: () => void;
  state: WalletState;
  prices: PriceMap;
  initialToken?: TokenId | undefined;
}) {
  const w = activeWallet(state);
  const others = state.wallets.filter((x) => x.id !== w.id);
  const [token, setToken] = useState<TokenId>(initialToken ?? "usdt");
  const [mode, setMode] = useState<"address" | "wallet">("address");
  const [toId, setTo] = useState<string>("");
  const to = others.some((o) => o.id === toId) ? toId : (others[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const bal = w.balances[token] ?? 0;
  const price = prices[token]?.price ?? 0;
  const amt = parseFloat(amount) || 0;
  const target = state.wallets.find((x) => x.id === to);
  const addr = address.trim();
  const addressOk = addr.length >= 20;
  const valid = amt > 0 && amt <= bal && (mode === "address" ? addressOk : !!target);
  const meta = tokenById(token);

  const pct = (p: number) => setAmount(String(Number((bal * p).toFixed(meta.decimals))));

  const onChain = canSendOnChain(token);

  const submit = async () => {
    if (!valid || busy) return;
    const destination = mode === "address" ? addr : (target?.chainAddresses?.[meta.chain] ?? target?.address ?? "");
    if (!destination) {
      toast.error(`That wallet has no ${meta.chain} address yet.`);
      return;
    }
    if (!onChain) {
      toast.error(`Sending ${meta.symbol} on ${meta.chain} is not supported yet.`);
      return;
    }
    setBusy(true);
    const pending = toast.loading(`Broadcasting ${amt} ${meta.symbol} on ${meta.chain}…`);
    try {
      const res = await sendRealToken(w.mnemonic, token, destination, amt);
      recordOnChainTx({
        signature: res.hash,
        type: "send",
        token,
        amount: amt,
        usdValue: amt * price,
        to: destination,
        ...(mode === "wallet" && target ? { toWalletId: target.id } : {}),
      });
      toast.success(`Sent ${amt} ${meta.symbol} · view on explorer`, {
        id: pending,
        action: { label: "Explorer", onClick: () => window.open(res.explorer, "_blank") },
      });
      setAmount("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transaction failed", { id: pending });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Send">
      <div className="space-y-3">
        <button
          onClick={() => setPicker(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-surface-2 p-3 text-left"
        >
          <TokenIcon id={token} prices={prices} />
          <div className="flex-1">
            <div className="font-medium">{meta.symbol}</div>
            <div className="text-xs text-muted-foreground">{meta.chain}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-muted-foreground">Balance</div>
            <div>{formatAmount(bal, 6)}</div>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["address", "Any address"],
              ["wallet", "My wallets"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`rounded-xl py-2.5 text-sm ${
                mode === k ? "bg-brand/20 font-medium ring-1 ring-brand" : "bg-surface-2 text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "address" ? (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Recipient address ({meta.chain})</span>
              <button
                className="text-brand"
                onClick={async () => {
                  try {
                    setAddress((await navigator.clipboard.readText()).trim());
                  } catch {
                    toast.error("Allow clipboard access to paste");
                  }
                }}
              >
                Paste
              </button>
            </div>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={addressHint(meta.chain)}
              className="w-full break-all bg-transparent py-1 font-mono text-xs outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground"
            />
            {addressOk && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <TokenIcon id={token} prices={prices} size={20} badge={false} />
                {meta.symbol} on {meta.chain} · {shortAddr(addr, 6)}
              </div>
            )}
          </div>
        ) : others.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-sm text-muted-foreground">
            Create a second wallet from the name menu at the top to send between your wallets.
          </p>
        ) : (
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="mb-2 text-xs text-muted-foreground">To wallet</div>
            <div className="space-y-2">
              {others.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setTo(o.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left ${
                    to === o.id ? "bg-brand/20 ring-1 ring-brand" : "bg-surface"
                  }`}
                >
                  <span className="text-sm font-medium">{o.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{shortAddr(o.address, 6)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-surface-2 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Amount</span>
            <span>
              Available {formatAmount(bal, 6)} {meta.symbol}
            </span>
          </div>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className="w-full py-1 text-3xl font-semibold outline-none placeholder:text-muted-foreground"
          />
          <FiatHint usd={amt * price} />
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {([0.2, 0.4, 0.6, 0.8, 1] as const).map((p) => (
              <button
                key={p}
                onClick={() => pct(p)}
                className="rounded-lg bg-surface py-1.5 text-xs text-muted-foreground"
              >
                {p * 100}%
              </button>
            ))}
            <button onClick={() => pct(1)} className="rounded-lg bg-surface py-1.5 text-xs text-brand">
              MAX
            </button>
          </div>
        </div>

        <div className="flex justify-between rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
          <span className="text-muted-foreground">Network fee</span>
          <span>{formatFee(token)}</span>
        </div>

        {mode === "address" && (
          <p className="px-1 text-xs text-muted-foreground">
            {onChain
              ? `Signed with this wallet's own key and broadcast on ${meta.chain}. Transfers are final.`
              : `${meta.chain} transfers are not broadcast yet — only Solana, Ethereum, BNB Chain, Polygon and Avalanche are live.`}
          </p>
        )}

        <button
          disabled={!valid || busy}
          onClick={submit}
          className="w-full rounded-xl bg-brand py-3.5 font-semibold text-primary-foreground disabled:bg-surface-2 disabled:text-muted-foreground"
        >
          {busy ? "Sending…" : amt > bal ? "Insufficient balance" : onChain && mode === "address" ? "Confirm & send" : "Send"}
        </button>
      </div>
      <TokenPicker
        open={picker}
        onClose={() => setPicker(false)}
        onSelect={setToken}
        prices={prices}
        balances={w.balances}
      />
    </Sheet>
  );
}

function ReceiveSheet({
  open,
  onClose,
  state,
  prices,
  initialToken,
}: {
  open: boolean;
  onClose: () => void;
  state: WalletState;
  prices: PriceMap;
  initialToken?: TokenId | undefined;
}) {
  const w = activeWallet(state);
  const [token, setToken] = useState<TokenId | null>(initialToken ?? null);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const list = TOKENS.filter((t) => t.symbol.toLowerCase().includes(q.toLowerCase()));
  const addr = token ? receiveAddress(state, token) : "";
  const { fmt } = useFiat();


  const copy = () => {
    navigator.clipboard.writeText(addr);
    toast.success("Address copied");
  };


  return (
    <Sheet
      open={open}
      onClose={() => {
        setToken(null);
        onClose();
      }}
      title="Receive"
      full
    >
      {token ? (
        <div className="flex flex-col items-center gap-4 pt-4">
          <TokenIcon id={token} prices={prices} size={56} />
          <div className="text-center">
            <div className="text-lg font-semibold">{tokenById(token).symbol}</div>
            <div className="text-sm text-muted-foreground">{tokenById(token).chain}</div>
          </div>
          {addr ? (
            <>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=12&data=${encodeURIComponent(addr)}`}
                alt={`${tokenById(token).chain} receiving address QR code`}
                className="h-56 w-56 rounded-xl bg-white p-2"
              />
              <div className="w-full break-all rounded-xl bg-surface-2 p-3 text-center font-mono text-sm">{addr}</div>
              <button onClick={copy} className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-medium">
                <Copy size={16} /> Copy Address
              </button>
              {explorerAddressUrl(tokenById(token).chain, addr) && (
                <a
                  href={explorerAddressUrl(tokenById(token).chain, addr)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand underline"
                >
                  View on {explorerName(tokenById(token).chain)}
                </a>
              )}
            </>

          ) : (
            <div className="w-full space-y-2 rounded-xl bg-surface-2 p-4">
              <div className="text-sm text-muted-foreground">
                Paste your own {tokenById(token).chain} receiving address to receive real {tokenById(token).symbol}.
              </div>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={addressHint(tokenById(token).chain)}
                className="w-full rounded-lg bg-surface px-3 py-2.5 font-mono text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => {
                  setChainAddress(tokenById(token).chain, draft);
                  setDraft("");
                  toast.success("Receiving address saved");
                }}
                className="w-full rounded-lg bg-brand py-2.5 font-medium"
              >
                Save address
              </button>
            </div>
          )}
          {addr && tokenById(token).chain !== "Solana" && (
            <button
              onClick={() => {
                setChainAddress(tokenById(token).chain, "");
                toast.success("Address cleared");
              }}
              className="text-xs text-muted-foreground underline"
            >
              Replace {tokenById(token).chain} address
            </button>
          )}
          <button onClick={() => setToken(null)} className="text-sm text-muted-foreground">
            Choose another token
          </button>
        </div>

      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
            <Search size={18} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            {list.map((t) => (
              <button
                key={t.id}
                onClick={() => setToken(t.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-surface-2 px-3 py-3 text-left"
              >
                <TokenIcon id={t.id} prices={prices} />
                <div className="flex-1">
                  <div className="text-[15px] font-medium">
                    {t.symbol} <span className="text-muted-foreground">({t.chain})</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(prices[t.id]?.price ?? 0, 6)}{" "}
                    <Change value={prices[t.id]?.change ?? 0} />
                  </div>
                </div>
                <div className="text-right text-sm">
                  {formatAmount(w.balances[t.id] ?? 0, 6)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}


function TokenDetailSheet({
  id,
  state,
  prices,
  onClose,
  onSend,
  onReceive,
}: {
  id: TokenId | null;
  state: WalletState;
  prices: PriceMap;
  onClose: () => void;
  onSend: (id: TokenId) => void;
  onReceive: (id: TokenId) => void;
}) {
  const w = activeWallet(state);
  const { fmt } = useFiat();
  if (!id) return null;
  const meta = tokenById(id);
  const p = prices[id];
  const bal = w.balances[id] ?? 0;

  return (
    <Sheet open onClose={onClose} title={`${meta.symbol} (${meta.chain})`}>
      <div className="flex flex-col items-center pt-2">
        <TokenIcon id={id} prices={prices} size={56} />
        <div className="mt-3 text-3xl font-semibold">{formatAmount(bal, meta.decimals)}</div>
        <div className="text-sm text-muted-foreground">
          {fmt(bal * (p?.price ?? 0))}
        </div>
      </div>


      {(p?.sparkline?.length ?? 0) > 1 && (
        <div className="mt-4 rounded-2xl bg-surface-2 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>7-day trend</span>
            <Change value={p?.change ?? 0} />
          </div>
          <Sparkline
            data={p?.sparkline ?? []}
            up={(p?.change ?? 0) >= 0}
            width={300}
            height={90}
            className="w-full"
          />
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => onSend(id)}
          className="rounded-xl bg-brand py-3 font-semibold text-primary-foreground"
        >
          Send
        </button>
        <button onClick={() => onReceive(id)} className="rounded-xl bg-surface-2 py-3 font-semibold">
          Receive
        </button>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl bg-surface-2 p-4 text-sm">
        <DetailRow label="Name">{meta.name}</DetailRow>
        <DetailRow label="Network">{meta.chain}</DetailRow>
        {meta.contract ? (
          <ContractRow contract={meta.contract} />
        ) : isNativeToken(id) ? (
          <DetailRow label="Contract">
            <span className="text-muted-foreground">Native coin — no contract</span>
          </DetailRow>
        ) : null}
        <DetailRow label="Price">
          {fmt(p?.price ?? 0, 6)} <Change value={p?.change ?? 0} />
        </DetailRow>
        <DetailRow label="Network fee">{formatFee(id)}</DetailRow>
        <DetailRow label="Address">
          <span className="font-mono text-xs">{shortAddr(w.address, 6)}</span>
        </DetailRow>
      </div>
    </Sheet>
  );
}

const NATIVE_TOKEN_IDS = new Set<string>([
  "sol", "btc", "eth", "bnb", "trx", "ton", "pol", "xrp", "doge", "ada", "avax", "sui", "zec", "near",
]);

function isNativeToken(id: TokenId) {
  return NATIVE_TOKEN_IDS.has(id);
}

function ContractRow({ contract }: { contract: string }) {
  const copy = () => {
    navigator.clipboard.writeText(contract);
    toast.success("Contract address copied");
  };
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="pt-0.5 text-muted-foreground">Contract</span>
      <button
        onClick={copy}
        className="flex max-w-[70%] items-center gap-1.5 text-right font-mono text-[11px] leading-snug break-all hover:opacity-80"
        title="Tap to copy contract address"
      >
        <span className="break-all">{contract}</span>
        <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
