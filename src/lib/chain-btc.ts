// Real Bitcoin (native segwit P2WPKH) transaction building, signing and broadcasting.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bech32 } from "@scure/base";
import { bitcoinKey } from "./keys";

const API = "https://mempool.space/api";
const DUST = 546;

interface Utxo {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const bytesFromHex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
const hash256 = (b: Uint8Array) => sha256(sha256(b));

function u32(n: number) {
  return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
}
function u64(n: number) {
  const out: number[] = [];
  let v = BigInt(Math.round(n));
  for (let i = 0; i < 8; i++) {
    out.push(Number(v & 0xffn));
    v >>= 8n;
  }
  return out;
}
function varint(n: number) {
  if (n < 0xfd) return [n];
  if (n <= 0xffff) return [0xfd, n & 255, (n >> 8) & 255];
  return [0xfe, ...u32(n)];
}

/** scriptPubKey for any supported bech32 / bech32m address. */
function scriptFor(address: string): number[] {
  let decoded: { prefix: string; words: number[] };
  try {
    decoded = bech32.decode(address as `${string}1${string}`);
  } catch {
    try {
      // taproot and other v1+ outputs use bech32m
      const b32m = bech32.decodeUnsafe(address as `${string}1${string}`);
      if (!b32m) throw new Error("bad");
      decoded = b32m;
    } catch {
      throw new Error("Only bech32 Bitcoin addresses (bc1…) are supported for sending.");
    }
  }
  if (decoded.prefix !== "bc") throw new Error("That is not a Bitcoin mainnet address.");
  const version = decoded.words[0]!;
  const program = bech32.fromWords(decoded.words.slice(1));
  return [version === 0 ? 0x00 : 0x50 + version, program.length, ...program];
}

function p2wpkhScript(h160: Uint8Array) {
  return [0x00, 0x14, ...h160];
}

async function feeRate(): Promise<number> {
  try {
    const r = await fetch(`${API}/v1/fees/recommended`);
    const j = (await r.json()) as { halfHourFee?: number };
    return Math.max(1, j.halfHourFee ?? 5);
  } catch {
    return 5;
  }
}

/** Send BTC from the wallet's own derived segwit key. Returns the txid. */
export async function sendBitcoin(mnemonic: string, to: string, amountBtc: number): Promise<string> {
  const key = bitcoinKey(mnemonic);
  const outScript = scriptFor(to);
  const changeScript = p2wpkhScript(key.h160);
  const sats = Math.round(amountBtc * 1e8);
  if (sats < DUST) throw new Error("That amount is below the Bitcoin dust limit.");

  const utxosRes = await fetch(`${API}/address/${key.address}/utxo`);
  if (!utxosRes.ok) throw new Error("Could not reach the Bitcoin network.");
  const utxos = ((await utxosRes.json()) as Utxo[])
    .filter((u) => u.status.confirmed)
    .sort((a, b) => b.value - a.value);
  if (!utxos.length) throw new Error("This Bitcoin address has no confirmed coins to spend.");

  const rate = await feeRate();
  const selected: Utxo[] = [];
  let total = 0;
  let fee = 0;
  let change = 0;
  for (const u of utxos) {
    selected.push(u);
    total += u.value;
    const vbytes = Math.ceil(10.5 + selected.length * 68 + 2 * 43);
    fee = vbytes * rate;
    change = total - sats - fee;
    if (change >= 0) break;
  }
  if (change < 0) throw new Error("Not enough Bitcoin to cover the amount plus network fee.");
  const outputs: { value: number; script: number[] }[] = [{ value: sats, script: outScript }];
  if (change >= DUST) outputs.push({ value: change, script: changeScript });

  // BIP-143 shared hashes
  const prevouts: number[] = [];
  const sequences: number[] = [];
  for (const u of selected) {
    prevouts.push(...bytesFromHex(u.txid).reverse(), ...u32(u.vout));
    sequences.push(...u32(0xfffffffd));
  }
  const outputBytes: number[] = [];
  for (const o of outputs) outputBytes.push(...u64(o.value), o.script.length, ...o.script);
  const hashPrevouts = hash256(new Uint8Array(prevouts));
  const hashSequence = hash256(new Uint8Array(sequences));
  const hashOutputs = hash256(new Uint8Array(outputBytes));

  const witnesses: number[][] = [];
  for (const u of selected) {
    const scriptCode = [0x19, 0x76, 0xa9, 0x14, ...key.h160, 0x88, 0xac];
    const preimage = new Uint8Array([
      ...u32(2),
      ...hashPrevouts,
      ...hashSequence,
      ...bytesFromHex(u.txid).reverse(),
      ...u32(u.vout),
      ...scriptCode,
      ...u64(u.value),
      ...u32(0xfffffffd),
      ...hashOutputs,
      ...u32(0),
      ...u32(1),
    ]);
    const sighash = hash256(preimage);
    const der = secp256k1.sign(sighash, key.priv, { format: "der", prehash: false }) as Uint8Array;
    const sig = [...der, 0x01];
    witnesses.push([2, sig.length, ...sig, key.pub.length, ...key.pub]);
  }

  const tx: number[] = [...u32(2), 0x00, 0x01, ...varint(selected.length)];
  for (const u of selected) tx.push(...bytesFromHex(u.txid).reverse(), ...u32(u.vout), 0x00, ...u32(0xfffffffd));
  tx.push(...varint(outputs.length), ...outputBytes);
  for (const w of witnesses) tx.push(...w);
  tx.push(...u32(0));

  const res = await fetch(`${API}/tx`, { method: "POST", body: hex(new Uint8Array(tx)) });
  const text = (await res.text()).trim();
  if (!res.ok) throw new Error(text || "Bitcoin broadcast failed.");
  return text;
}
