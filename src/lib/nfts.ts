import { useEffect, useState, useSyncExternalStore } from "react";
import { fetchNftMetadataMany, type NftMetadata } from "./nft-metadata";


export interface NftItem {
  id: string;
  name: string;
  collection: string;
  chain: string;
  image?: string | undefined;
  mint?: string | undefined;
  traits?: { label: string; value: string }[];
}

export const ERN_COLLECTION = "ERN Accessories";

const DEFAULT_NFTS: NftItem[] = [];

const KEY = "sp_nfts_v2";

let items: NftItem[] = DEFAULT_NFTS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as NftItem[];
      const extra = saved.filter((n) => !DEFAULT_NFTS.some((d) => d.id === n.id));
      items = [...DEFAULT_NFTS, ...extra];
    } else {
      localStorage.setItem(KEY, JSON.stringify(items));
    }
  } catch {
    /* ignore */
  }
}

function emit() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

export function useNfts(): NftItem[] {
  return useSyncExternalStore(
    (cb) => {
      load();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      load();
      return items;
    },
    () => items,
  );
}

export function addNft(input: { name: string; collection?: string; chain: string; mint?: string; image?: string }) {
  const item: NftItem = {
    id: `nft_${Date.now().toString(36)}`,
    name: input.name.trim() || "Untitled",
    collection: (input.collection ?? "").trim() || "Imported",
    chain: input.chain,
    mint: input.mint?.trim(),
    image: input.image?.trim() || undefined,
  };
  items = [...items, item];
  emit();
  return item;
}

export function removeNft(id: string) {
  items = items.filter((n) => n.id !== id);
  emit();
}

const SOL_RPC = "https://solana-rpc.publicnode.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

async function ownedNftMints(address: string, programId: string): Promise<string[]> {
  const res = await fetch(SOL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenAccountsByOwner",
      params: [address, { programId }, { encoding: "jsonParsed" }],
    }),
  });
  const j = await res.json();
  return (j?.result?.value ?? [])
    .map((a: any) => a?.account?.data?.parsed?.info)
    .filter((i: any) => i?.tokenAmount?.decimals === 0 && Number(i?.tokenAmount?.amount) === 1)
    .map((i: any) => i.mint as string);
}

/** Real NFT mints (supply-1, 0-decimal token accounts) held by a Solana address. */
export function useSolanaNfts(address: string) {
  const [mints, setMints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([ownedNftMints(address, TOKEN_PROGRAM), ownedNftMints(address, TOKEN_2022)])
      .then(([a, b]) => {
        if (!cancelled) setMints([...new Set([...a, ...b])]);
      })
      .catch(() => {
        if (!cancelled) setMints([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { mints, loading };
}

/** Real collection art, names and traits for the given mints. */
export function useNftMetadata(mints: string[]) {
  const [meta, setMeta] = useState<Record<string, NftMetadata>>({});
  const [loading, setLoading] = useState(false);
  const key = mints.join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) {
      setMeta({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchNftMetadataMany(list)
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { meta, loading };
}

