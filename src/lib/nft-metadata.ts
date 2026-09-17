// Reads real Metaplex token metadata for Solana NFTs (on-chain PDA + off-chain JSON).
import { sha256 } from "@noble/hashes/sha2.js";
import { base58 } from "@scure/base";
import { ed25519 } from "@noble/curves/ed25519.js";
import { solanaRpc } from "./chain-solana";

const METADATA_PROGRAM = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export interface NftMetadata {
  mint: string;
  name: string;
  symbol: string;
  collection: string;
  image?: string;
  description?: string;
  traits: { label: string; value: string }[];
}

function onCurve(bytes: Uint8Array) {
  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
}

function metadataPda(mint: string): string {
  const pid = base58.decode(METADATA_PROGRAM);
  const seeds = [new TextEncoder().encode("metadata"), pid, base58.decode(mint)];
  const tail = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts: number[] = [];
    for (const s of seeds) parts.push(...s);
    parts.push(bump, ...pid, ...tail);
    const hash = sha256(new Uint8Array(parts));
    if (!onCurve(hash)) return base58.encode(hash);
  }
  throw new Error("Could not derive the metadata address.");
}

function fromBase64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function readString(bytes: Uint8Array, offset: number): [string, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const len = view.getUint32(offset, true);
  const raw = bytes.slice(offset + 4, offset + 4 + len);
  const text = new TextDecoder().decode(raw).replace(/\0+$/, "").trim();
  return [text, offset + 4 + len];
}

function ipfs(url: string) {
  return url.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${url.slice(7)}` : url;
}

/** Fetch on-chain name/symbol/uri and the linked JSON for one mint. */
export async function fetchNftMetadata(mint: string): Promise<NftMetadata | null> {
  try {
    const pda = metadataPda(mint);
    const info = await solanaRpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [
      pda,
      { encoding: "base64" },
    ]);
    if (!info?.value) return null;
    const bytes = fromBase64(info.value.data[0]);
    let offset = 1 + 32 + 32;
    const [name, o1] = readString(bytes, offset);
    offset = o1;
    const [symbol, o2] = readString(bytes, offset);
    offset = o2;
    const [uri] = readString(bytes, offset);

    const meta: NftMetadata = { mint, name: name || "Untitled", symbol, collection: symbol || "Solana NFT", traits: [] };

    if (uri) {
      try {
        const res = await fetch(ipfs(uri));
        const json = (await res.json()) as {
          name?: string;
          image?: string;
          description?: string;
          collection?: { name?: string } | string;
          attributes?: { trait_type?: string; value?: unknown }[];
        };
        if (json.name) meta.name = json.name;
        if (json.image) meta.image = ipfs(json.image);
        if (json.description) meta.description = json.description;
        const col = typeof json.collection === "string" ? json.collection : json.collection?.name;
        if (col) meta.collection = col;
        meta.traits = (json.attributes ?? [])
          .filter((a) => a?.trait_type != null && a.value != null)
          .map((a) => ({ label: String(a.trait_type), value: String(a.value) }));
      } catch {
        /* off-chain JSON unavailable — keep on-chain values */
      }
    }
    return meta;
  } catch {
    return null;
  }
}

export async function fetchNftMetadataMany(mints: string[]): Promise<Record<string, NftMetadata>> {
  const out: Record<string, NftMetadata> = {};
  const results = await Promise.all(mints.map((m) => fetchNftMetadata(m)));
  results.forEach((r) => {
    if (r) out[r.mint] = r;
  });
  return out;
}
