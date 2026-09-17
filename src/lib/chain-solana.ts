// Minimal Solana transaction builder — signs and broadcasts without the heavy web3.js bundle.
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58 } from "@scure/base";
import { solanaSecretKey } from "./keys";

export const SOL_RPC = "https://solana-rpc.publicnode.com";

const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const ASSOC_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SOL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

function compactU16(n: number): number[] {
  const out: number[] = [];
  let v = n;
  for (;;) {
    if (v < 0x80) {
      out.push(v);
      return out;
    }
    out.push((v & 0x7f) | 0x80);
    v >>= 7;
  }
}

function u64le(v: bigint): number[] {
  const out: number[] = [];
  let x = v;
  for (let i = 0; i < 8; i++) {
    out.push(Number(x & 0xffn));
    x >>= 8n;
  }
  return out;
}

function onCurve(bytes: Uint8Array) {
  try {
    ed25519.Point.fromBytes(bytes);
    return true;
  } catch {
    return false;
  }
}

/** Associated token account address for (owner, mint). */
function associatedTokenAddress(owner: string, mint: string, tokenProgram: string) {
  const seeds = [base58.decode(owner), base58.decode(tokenProgram), base58.decode(mint)];
  const pid = base58.decode(ASSOC_PROGRAM);
  const tail = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const parts: number[] = [];
    for (const s of seeds) parts.push(...s);
    parts.push(bump, ...pid, ...tail);
    const hash = sha256(new Uint8Array(parts));
    if (!onCurve(hash)) return base58.encode(hash);
  }
  throw new Error("Could not derive the token account address.");
}

interface Instruction {
  program: string;
  accounts: string[];
  data: number[];
}

function buildMessage(
  payer: string,
  keys: { key: string; signer: boolean; writable: boolean }[],
  instructions: Instruction[],
  blockhash: string,
) {
  const ordered = [
    ...keys.filter((k) => k.signer && k.writable),
    ...keys.filter((k) => k.signer && !k.writable),
    ...keys.filter((k) => !k.signer && k.writable),
    ...keys.filter((k) => !k.signer && !k.writable),
  ];
  const index = (k: string) => ordered.findIndex((o) => o.key === k);
  const bytes: number[] = [
    ordered.filter((k) => k.signer).length,
    ordered.filter((k) => k.signer && !k.writable).length,
    ordered.filter((k) => !k.signer && !k.writable).length,
    ...compactU16(ordered.length),
  ];
  for (const k of ordered) bytes.push(...base58.decode(k.key));
  bytes.push(...base58.decode(blockhash));
  bytes.push(...compactU16(instructions.length));
  for (const ix of instructions) {
    bytes.push(index(ix.program));
    bytes.push(...compactU16(ix.accounts.length));
    for (const a of ix.accounts) bytes.push(index(a));
    bytes.push(...compactU16(ix.data.length));
    bytes.push(...ix.data);
  }
  void payer;
  return new Uint8Array(bytes);
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(b64: string) {
  const s = atob(b64);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function signAndSend(message: Uint8Array, secret: Uint8Array) {
  const sig = ed25519.sign(message, secret.slice(0, 32));
  const tx = new Uint8Array(1 + 64 + message.length);
  tx[0] = 1;
  tx.set(sig, 1);
  tx.set(message, 65);
  const signature = await rpc<string>("sendTransaction", [
    toBase64(tx),
    { encoding: "base64", skipPreflight: false, maxRetries: 3 },
  ]);
  await confirm(signature);
  return signature;
}

async function confirm(signature: string) {
  for (let i = 0; i < 30; i++) {
    const res = await rpc<{ value: ({ confirmationStatus?: string; err?: unknown } | null)[] }>(
      "getSignatureStatuses",
      [[signature], { searchTransactionHistory: true }],
    );
    const st = res.value[0];
    if (st?.err) throw new Error("The network rejected this transaction.");
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

export async function sendSolanaTx(
  mnemonic: string,
  mint: string | undefined,
  to: string,
  amount: number,
  fallbackDecimals: number,
): Promise<string> {
  const secret = solanaSecretKey(mnemonic);
  const from = base58.encode(secret.slice(32));
  try {
    base58.decode(to);
  } catch {
    throw new Error("That does not look like a Solana address.");
  }
  const { value } = await rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "finalized" }]);
  const blockhash = value.blockhash;

  if (!mint) {
    const lamports = BigInt(Math.round(amount * 1e9));
    const ix: Instruction = {
      program: SYSTEM_PROGRAM,
      accounts: [from, to],
      data: [2, 0, 0, 0, ...u64le(lamports)],
    };
    const msg = buildMessage(
      from,
      [
        { key: from, signer: true, writable: true },
        { key: to, signer: false, writable: true },
        { key: SYSTEM_PROGRAM, signer: false, writable: false },
      ],
      [ix],
      blockhash,
    );
    return signAndSend(msg, secret);
  }

  // SPL token: read the mint for its owning token program and decimals.
  const info = await rpc<{ value: { owner: string; data: [string, string] } | null }>("getAccountInfo", [
    mint,
    { encoding: "base64" },
  ]);
  const tokenProgram = info.value?.owner ?? TOKEN_PROGRAM;
  const decimals = info.value ? fromBase64(info.value.data[0])[44]! : fallbackDecimals;
  const source = associatedTokenAddress(from, mint, tokenProgram);
  const dest = associatedTokenAddress(to, mint, tokenProgram);
  const raw = BigInt(Math.round(amount * 10 ** decimals));

  const instructions: Instruction[] = [
    // create-idempotent: creates the recipient's token account only if missing
    { program: ASSOC_PROGRAM, accounts: [from, dest, to, mint, SYSTEM_PROGRAM, tokenProgram], data: [1] },
    // transferChecked
    { program: tokenProgram, accounts: [source, mint, dest, from], data: [12, ...u64le(raw), decimals] },
  ];
  const msg = buildMessage(
    from,
    [
      { key: from, signer: true, writable: true },
      { key: source, signer: false, writable: true },
      { key: dest, signer: false, writable: true },
      { key: mint, signer: false, writable: false },
      { key: to, signer: false, writable: false },
      { key: tokenProgram, signer: false, writable: false },
      { key: ASSOC_PROGRAM, signer: false, writable: false },
      { key: SYSTEM_PROGRAM, signer: false, writable: false },
    ],
    instructions,
    blockhash,
  );
  return signAndSend(msg, secret);
}

/** Shared helpers used by the swap flow. */
export async function solanaRpc<T>(method: string, params: unknown[]) {
  return rpc<T>(method, params);
}

export async function mintDecimals(mint: string, fallback = 6): Promise<number> {
  const info = await rpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [
    mint,
    { encoding: "base64" },
  ]);
  return info.value ? fromBase64(info.value.data[0])[44]! : fallback;
}

/** Sign a base64 transaction returned by an aggregator and broadcast it. */
export async function signAndSendBase64Tx(mnemonic: string, base64Tx: string): Promise<string> {
  const secret = solanaSecretKey(mnemonic);
  const tx = fromBase64(base64Tx);
  const sigCount = tx[0]!;
  const message = tx.slice(1 + 64 * sigCount);
  const sig = ed25519.sign(message, secret.slice(0, 32));
  tx.set(sig, 1);
  const signature = await rpc<string>("sendTransaction", [
    toBase64(tx),
    { encoding: "base64", skipPreflight: true, maxRetries: 3 },
  ]);
  await confirm(signature);
  return signature;
}
