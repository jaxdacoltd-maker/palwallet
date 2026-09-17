// Real TRON transaction building, signing and broadcasting via TronGrid.
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { tronAddressToHex, tronKey } from "./keys";

const API = "https://api.trongrid.io";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const bytesFromHex = (s: string) => Uint8Array.from(s.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

interface TronTx {
  txID: string;
  raw_data_hex: string;
  signature?: string[];
  Error?: string;
  result?: { result?: boolean; message?: string };
  transaction?: TronTx;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

function decodeMessage(m?: string) {
  if (!m) return undefined;
  try {
    return new TextDecoder().decode(bytesFromHex(m));
  } catch {
    return m;
  }
}

function sign(tx: TronTx, priv: Uint8Array) {
  const digest = sha256(bytesFromHex(tx.raw_data_hex));
  const rec = secp256k1.sign(digest, priv, { format: "recovered", prehash: false }) as Uint8Array;
  const sig = new Uint8Array(65);
  sig.set(rec.slice(1), 0);
  sig[64] = rec[0]!;
  return { ...tx, signature: [hex(sig)] };
}

async function broadcast(tx: TronTx): Promise<string> {
  const res = await post<{ result?: boolean; txid?: string; message?: string; code?: string }>(
    "/wallet/broadcasttransaction",
    tx,
  );
  if (!res.result) throw new Error(decodeMessage(res.message) ?? res.code ?? "TRON broadcast failed.");
  return res.txid ?? tx.txID;
}

/** Send TRX or a TRC-20 token from the wallet's own derived TRON key. Returns the txid. */
export async function sendTron(
  mnemonic: string,
  contract: string | undefined,
  to: string,
  amount: number,
  decimals: number,
): Promise<string> {
  const key = tronKey(mnemonic);
  const owner = hex(key.hex);
  const dest = hex(tronAddressToHex(to));

  if (!contract) {
    const tx = await post<TronTx>("/wallet/createtransaction", {
      owner_address: owner,
      to_address: dest,
      amount: Math.round(amount * 1e6),
    });
    if (tx.Error) throw new Error(decodeMessage(tx.Error) ?? "TRON transaction failed.");
    return broadcast(sign(tx, key.priv));
  }

  const raw = BigInt(Math.round(amount * 10 ** decimals)).toString(16).padStart(64, "0");
  const parameter = dest.slice(2).padStart(64, "0") + raw;
  const res = await post<{ transaction?: TronTx; result?: { result?: boolean; message?: string } }>(
    "/wallet/triggersmartcontract",
    {
      owner_address: owner,
      contract_address: hex(tronAddressToHex(contract)),
      function_selector: "transfer(address,uint256)",
      parameter,
      fee_limit: 60_000_000,
      call_value: 0,
    },
  );
  if (!res.transaction) throw new Error(decodeMessage(res.result?.message) ?? "TRON token transfer failed.");
  return broadcast(sign(res.transaction, key.priv));
}
