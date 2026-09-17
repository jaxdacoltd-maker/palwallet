import { useMemo, useState } from "react";
import { ExternalLink, Image as ImageIcon, Loader2, Send, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addNft, removeNft, useNftMetadata, useNfts, useSolanaNfts } from "@/lib/nfts";
import {
  cancelListing,
  createListing,
  markDelivered,
  markPaid,
  useListings,
  type Listing,
} from "@/lib/marketplace";
import { shortAddr, type Wallet } from "@/lib/wallet-store";
import { sendSolanaTx } from "@/lib/chain-solana";
import { useSession } from "@/lib/use-session";
import { Sheet } from "./Sheet";

const solscanTx = (s: string) => `https://solscan.io/tx/${s}`;
const solscanToken = (m: string) => `https://solscan.io/token/${m}`;

interface Card {
  key: string;
  id?: string;
  name: string;
  collection: string;
  chain: string;
  image?: string | undefined;
  mint?: string | undefined;
  traits: { label: string; value: string }[];
  description?: string | undefined;
  onChain: boolean;
}

export function NftTab({ wallet }: { wallet: Wallet }) {
  const address = wallet.address;
  const [view, setView] = useState<"mine" | "market">("mine");
  const nfts = useNfts();
  const { mints, loading } = useSolanaNfts(address);
  const { meta, loading: metaLoading } = useNftMetadata(mints);
  const { listings, refresh } = useListings();
  const { user } = useSession();

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Card | null>(null);
  const [sendFor, setSendFor] = useState<Card | null>(null);
  const [listFor, setListFor] = useState<{ mint: string; name: string; image?: string | undefined } | null>(null);
  const [form, setForm] = useState({ name: "", collection: "", chain: "Solana", mint: "", image: "" });

  const listedMints = useMemo(
    () => new Set(listings.filter((l) => l.status !== "sold" && l.status !== "cancelled").map((l) => l.mint)),
    [listings],
  );

  const cards: Card[] = useMemo(() => {
    const manual: Card[] = nfts.map((n) => ({
      key: n.id,
      id: n.id,
      name: n.name,
      collection: n.collection,
      chain: n.chain,
      image: n.image,
      mint: n.mint,
      traits: n.traits ?? [],
      onChain: false,
    }));
    const chain: Card[] = mints
      .filter((m) => !nfts.some((n) => n.mint === m))
      .map((m) => {
        const md = meta[m];
        return {
          key: m,
          name: md?.name ?? `NFT ${shortAddr(m, 4)}`,
          collection: md?.collection ?? "Solana NFT",
          chain: "Solana",
          image: md?.image,
          mint: m,
          traits: md?.traits ?? [],
          description: md?.description,
          onChain: true,
        };
      });
    return [...chain, ...manual];
  }, [nfts, mints, meta]);

  return (
    <div className="px-4 pb-6 pt-4">
      <div className="mb-4 inline-flex rounded-xl bg-surface p-1">
        {(
          [
            ["mine", "My NFTs"],
            ["market", "Marketplace"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${view === k ? "bg-brand text-primary-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "mine" ? (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {loading || metaLoading ? "Loading your collectibles…" : `${cards.length} collectibles`}
            </div>
            <button onClick={() => setOpen(true)} className="rounded-lg bg-surface px-3 py-1.5 text-sm">
              + Add NFT
            </button>
          </div>

          {cards.length === 0 && !loading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No collectibles in this wallet yet. Anything you receive on Solana shows up here automatically.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {cards.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setSel(c)}
                  className="overflow-hidden rounded-xl bg-surface text-left transition-colors active:bg-surface-2"
                >
                  {c.image ? (
                    <img src={c.image} alt={c.name} loading="lazy" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-surface-2">
                      <ImageIcon size={28} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.collection} · {c.chain}
                    </div>
                    {c.mint && listedMints.has(c.mint) && <div className="mt-1 text-xs text-brand">Listed</div>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {myListingsOf(listings, user?.id).length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-sm font-medium">My listings</div>
              <div className="space-y-2">
                {myListingsOf(listings, user?.id).map((l) => (
                  <SellerRow key={l.id} listing={l} wallet={wallet} onDone={refresh} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <MarketList
          listings={listings.filter((l) => l.status === "active" && (!user || l.user_id !== user.id))}
          wallet={wallet}
          onDone={refresh}
          signedIn={!!user}
        />
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Add NFT">
        <div className="space-y-3">
          {(
            [
              ["name", "Name"],
              ["collection", "Collection"],
              ["mint", "Contract / mint address"],
              ["image", "Image URL"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="block">
              <span className="text-xs text-muted-foreground">{label}</span>
              <input
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="mt-1 w-full rounded-xl bg-surface px-3 py-2.5 text-sm outline-none"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-xs text-muted-foreground">Network</span>
            <select
              value={form.chain}
              onChange={(e) => setForm({ ...form, chain: e.target.value })}
              className="mt-1 w-full rounded-xl bg-surface px-3 py-2.5 text-sm outline-none"
            >
              {["Solana", "ERC20", "BEP20", "Polygon", "TRC20"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              if (!form.name.trim()) {
                toast.error("Give the NFT a name");
                return;
              }
              addNft(form);
              setForm({ name: "", collection: "", chain: "Solana", mint: "", image: "" });
              setOpen(false);
              toast.success("NFT added");
            }}
            className="w-full rounded-xl bg-brand py-3 font-medium text-primary-foreground"
          >
            Add NFT
          </button>
        </div>
      </Sheet>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && (
          <div className="space-y-3">
            {sel.image ? (
              <img src={sel.image} alt={sel.name} loading="lazy" className="w-full rounded-xl object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-surface-2">
                <ImageIcon size={40} className="text-muted-foreground" />
              </div>
            )}
            {sel.description && <p className="text-sm text-muted-foreground">{sel.description}</p>}
            <div className="rounded-xl bg-surface p-3 text-sm">
              <Row label="Collection" value={sel.collection} />
              <Row label="Network" value={sel.chain} />
              {sel.mint && <Row label="Mint" value={shortAddr(sel.mint, 6)} />}
              {sel.traits.map((t) => (
                <Row key={t.label} label={t.label} value={t.value} />
              ))}
            </div>

            {sel.mint && sel.chain === "Solana" && (
              <a
                href={solscanToken(sel.mint)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-surface py-3 text-sm text-brand"
              >
                View on Solscan <ExternalLink size={14} />
              </a>
            )}

            {sel.onChain && sel.mint && (
              <button
                onClick={() => {
                  setSendFor(sel);
                  setSel(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-medium text-primary-foreground"
              >
                <Send size={16} /> Send NFT
              </button>
            )}

            {sel.mint && sel.chain === "Solana" && !listedMints.has(sel.mint) && (
              <button
                onClick={() => {
                  setListFor({ mint: sel.mint!, name: sel.name, image: sel.image });
                  setSel(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 font-medium"
              >
                <Tag size={16} /> List for sale
              </button>
            )}

            {sel.id && (
              <button
                onClick={() => {
                  removeNft(sel.id!);
                  setSel(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface py-3 text-sm text-down"
              >
                <Trash2 size={16} /> Remove
              </button>
            )}
          </div>
        )}
      </Sheet>

      <SendNftSheet card={sendFor} wallet={wallet} onClose={() => setSendFor(null)} />

      <ListSheet
        target={listFor}
        address={address}
        onClose={() => setListFor(null)}
        onListed={() => {
          setListFor(null);
          void refresh();
        }}
      />
    </div>
  );
}

function myListingsOf(listings: Listing[], userId: string | undefined) {
  return userId ? listings.filter((l) => l.user_id === userId) : [];
}

function SendNftSheet({ card, wallet, onClose }: { card: Card | null; wallet: Wallet; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!card?.mint) return;
    if (!wallet.mnemonic) {
      toast.error("This wallet cannot sign transactions.");
      return;
    }
    if (to.trim().length < 32) {
      toast.error("Paste the receiving Solana address.");
      return;
    }
    setBusy(true);
    const pending = toast.loading("Transferring the collectible on Solana…");
    try {
      const sig = await sendSolanaTx(wallet.mnemonic, card.mint, to.trim(), 1, 0);
      toast.success("NFT sent", {
        id: pending,
        action: { label: "Explorer", onClick: () => window.open(solscanTx(sig), "_blank") },
      });
      setTo("");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed", { id: pending });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!card} onClose={onClose} title="Send NFT">
      <div className="space-y-3">
        <div className="rounded-xl bg-surface p-3 text-sm">
          <Row label="Collectible" value={card?.name ?? ""} />
          <Row label="Mint" value={card?.mint ? shortAddr(card.mint, 6) : ""} />
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Recipient Solana address</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Paste address"
            className="mt-1 w-full rounded-xl bg-surface px-3 py-2.5 text-sm outline-none"
          />
        </label>
        <button
          disabled={busy}
          onClick={send}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-medium text-primary-foreground disabled:bg-surface disabled:text-muted-foreground"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
        </button>
      </div>
    </Sheet>
  );
}


function ListSheet({
  target,
  address,
  onClose,
  onListed,
}: {
  target: { mint: string; name: string; image?: string | undefined } | null;
  address: string;
  onClose: () => void;
  onListed: () => void;
}) {
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const p = parseFloat(price);
    if (!target || !(p > 0)) return;
    setBusy(true);
    try {
      await createListing({
        sellerAddress: address,
        mint: target.mint,
        chain: "Solana",
        name: target.name,
        image: target.image,
        priceSol: p,
      });
      toast.success("Listed on the marketplace");
      setPrice("");
      onListed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list this NFT");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={!!target} onClose={onClose} title="List for sale">
      <div className="space-y-3">
        <div className="rounded-xl bg-surface p-3 text-sm">
          <Row label="Collectible" value={target?.name ?? ""} />
          <Row label="Mint" value={target ? shortAddr(target.mint, 6) : ""} />
          <Row label="Payout address" value={shortAddr(address, 6)} />
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Price in SOL</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0.5"
            className="mt-1 w-full rounded-xl bg-surface px-3 py-2.5 text-sm outline-none"
          />
        </label>
        <button
          disabled={busy || !(parseFloat(price) > 0)}
          onClick={submit}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-medium text-primary-foreground disabled:bg-surface disabled:text-muted-foreground"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />} List NFT
        </button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Buyers pay you in SOL directly on Solana. Once a payment is confirmed, you release the collectible from this
          screen and it is transferred on-chain to the buyer.
        </p>
      </div>
    </Sheet>
  );
}

function MarketList({
  listings,
  wallet,
  onDone,
  signedIn,
}: {
  listings: Listing[];
  wallet: Wallet;
  onDone: () => void;
  signedIn: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const buy = async (l: Listing) => {
    if (!signedIn) {
      toast.error("Sign in to buy a collectible.");
      return;
    }
    if (!wallet.mnemonic) {
      toast.error("This wallet cannot sign transactions.");
      return;
    }
    setBusy(l.id);
    const pending = toast.loading(`Paying ${l.price_sol} SOL to the seller…`);
    try {
      const sig = await sendSolanaTx(wallet.mnemonic, undefined, l.seller_address, l.price_sol, 9);
      await markPaid(l.id, wallet.address, sig);
      toast.success("Payment confirmed — the seller can now release the NFT", {
        id: pending,
        action: { label: "Explorer", onClick: () => window.open(solscanTx(sig), "_blank") },
      });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed", { id: pending });
    } finally {
      setBusy(null);
    }
  };

  if (listings.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">No collectibles are listed right now.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {listings.map((l) => (
        <div key={l.id} className="overflow-hidden rounded-xl bg-surface">
          {l.image ? (
            <img src={l.image} alt={l.name} loading="lazy" className="aspect-square w-full object-cover" />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-surface-2">
              <ImageIcon size={28} className="text-muted-foreground" />
            </div>
          )}
          <div className="p-2.5">
            <div className="truncate text-sm font-medium">{l.name}</div>
            <div className="truncate text-xs text-muted-foreground">Seller {shortAddr(l.seller_address, 4)}</div>
            <div className="mt-1 text-sm font-semibold">{l.price_sol} SOL</div>
            <button
              disabled={busy === l.id}
              onClick={() => buy(l)}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-brand py-1.5 text-xs font-medium text-primary-foreground disabled:bg-surface-2 disabled:text-muted-foreground"
            >
              {busy === l.id ? <Loader2 size={12} className="animate-spin" /> : null} Buy
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SellerRow({ listing, wallet, onDone }: { listing: Listing; wallet: Wallet; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const release = async () => {
    if (!wallet.mnemonic || !listing.buyer_address) return;
    setBusy(true);
    const pending = toast.loading("Transferring the collectible on Solana…");
    try {
      const sig = await sendSolanaTx(wallet.mnemonic, listing.mint, listing.buyer_address, 1, 0);
      await markDelivered(listing.id, sig);
      toast.success("Collectible delivered", {
        id: pending,
        action: { label: "Explorer", onClick: () => window.open(solscanTx(sig), "_blank") },
      });
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transfer failed", { id: pending });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl bg-surface p-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{listing.name}</div>
          <div className="text-xs text-muted-foreground">
            {listing.price_sol} SOL · {listing.status}
          </div>
        </div>
        {listing.status === "active" && (
          <button
            onClick={async () => {
              await cancelListing(listing.id);
              onDone();
            }}
            className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground"
          >
            Cancel
          </button>
        )}
        {listing.status === "paid" && (
          <button
            disabled={busy}
            onClick={release}
            className="flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : null} Release NFT
          </button>
        )}
        {listing.status === "sold" && listing.transfer_signature && (
          <a
            href={solscanTx(listing.transfer_signature)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-brand"
          >
            Sold <ExternalLink size={12} />
          </a>
        )}
      </div>
      {listing.payment_signature && (
        <a
          href={solscanTx(listing.payment_signature)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-brand"
        >
          Payment on Solscan <ExternalLink size={12} />
        </a>
      )}
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
