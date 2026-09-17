// Real BIP-39 / BIP-32 key derivation so wallet addresses exist on real chains.
import { generateMnemonic as bip39Generate, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha512, sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { base58, bech32 } from "@scure/base";

export function newMnemonic(): string {
  return bip39Generate(wordlist, 128);
}

export function isValidMnemonic(m: string) {
  return validateMnemonic(m.trim(), wordlist);
}

function seedOf(mnemonic: string) {
  return mnemonicToSeedSync(mnemonic.trim());
}

/** SLIP-0010 ed25519 derivation (hardened only) used by Solana wallets. */
function ed25519Derive(seed: Uint8Array, path: number[]) {
  let I = hmac(sha512, new TextEncoder().encode("ed25519 seed"), seed);
  let key = I.slice(0, 32);
  let chain = I.slice(32);
  for (const idx of path) {
    const data = new Uint8Array(1 + 32 + 4);
    data.set([0], 0);
    data.set(key, 1);
    new DataView(data.buffer).setUint32(33, idx + 0x80000000, false);
    I = hmac(sha512, chain, data);
    key = I.slice(0, 32);
    chain = I.slice(32);
  }
  return key;
}

function base58check(payload: Uint8Array) {
  const sum = sha256(sha256(payload)).slice(0, 4);
  const full = new Uint8Array(payload.length + 4);
  full.set(payload);
  full.set(sum, payload.length);
  return base58.encode(full);
}

export interface DerivedAddresses {
  solana: string;
  evm: string;
  bitcoin: string;
  tron: string;
}

/** Derive real mainnet addresses for the standard BIP-44 account paths. */
export function deriveAddresses(mnemonic: string): DerivedAddresses {
  const seed = seedOf(mnemonic);

  // Solana: m/44'/501'/0'/0'
  const solPriv = ed25519Derive(seed, [44, 501, 0, 0]);
  const solana = base58.encode(ed25519.getPublicKey(solPriv));

  // EVM: m/44'/60'/0'/0/0
  const root = HDKey.fromMasterSeed(seed);
  const evmKey = root.derive("m/44'/60'/0'/0/0");
  const evmPub = secp256k1.getPublicKey(evmKey.privateKey!, false).slice(1);
  const evmBytes = keccak_256(evmPub).slice(-20);
  const evm = `0x${Array.from(evmBytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;

  // TRON: m/44'/195'/0'/0/0 — keccak address prefixed with 0x41, base58check.
  const tronKey = root.derive("m/44'/195'/0'/0/0");
  const tronBytes = keccak_256(secp256k1.getPublicKey(tronKey.privateKey!, false).slice(1)).slice(-20);
  const tronPayload = new Uint8Array(21);
  tronPayload[0] = 0x41;
  tronPayload.set(tronBytes, 1);
  const tron = base58check(tronPayload);

  // Bitcoin native segwit: m/84'/0'/0'/0/0
  const btcKey = root.derive("m/84'/0'/0'/0/0");
  const h160 = ripemd160(sha256(btcKey.publicKey!));
  const bitcoin = bech32.encode("bc", [0, ...bech32.toWords(h160)]);

  return { solana, evm, bitcoin, tron };
}

/** Solana signing key (64 bytes: private || public) for m/44'/501'/0'/0'. */
export function solanaSecretKey(mnemonic: string): Uint8Array {
  const priv = ed25519Derive(seedOf(mnemonic), [44, 501, 0, 0]);
  const pub = ed25519.getPublicKey(priv);
  const full = new Uint8Array(64);
  full.set(priv, 0);
  full.set(pub, 32);
  return full;
}

/** EVM signing key (0x-prefixed hex) for m/44'/60'/0'/0/0. */
export function evmPrivateKey(mnemonic: string): `0x${string}` {
  const key = HDKey.fromMasterSeed(seedOf(mnemonic)).derive("m/44'/60'/0'/0/0");
  return `0x${Array.from(key.privateKey!, (b) => b.toString(16).padStart(2, "0")).join("")}` as `0x${string}`;
}

/** Per-chain receiving address map used by the wallet store. */
export function chainAddressesFrom(mnemonic: string): Record<string, string> {
  const a = deriveAddresses(mnemonic);
  return {
    ERC20: a.evm,
    BEP20: a.evm,
    Polygon: a.evm,
    "C-Chain": a.evm,
    Bitcoin: a.bitcoin,
    TRC20: a.tron,
  };
}

/** Bitcoin native-segwit signing material for m/84'/0'/0'/0/0. */
export function bitcoinKey(mnemonic: string) {
  const key = HDKey.fromMasterSeed(seedOf(mnemonic)).derive("m/84'/0'/0'/0/0");
  const pub = key.publicKey!;
  const h160 = ripemd160(sha256(pub));
  return {
    priv: key.privateKey!,
    pub,
    h160,
    address: bech32.encode("bc", [0, ...bech32.toWords(h160)]),
  };
}

/** TRON signing key for m/44'/195'/0'/0/0. */
export function tronKey(mnemonic: string) {
  const key = HDKey.fromMasterSeed(seedOf(mnemonic)).derive("m/44'/195'/0'/0/0");
  const bytes = keccak_256(secp256k1.getPublicKey(key.privateKey!, false).slice(1)).slice(-20);
  const payload = new Uint8Array(21);
  payload[0] = 0x41;
  payload.set(bytes, 1);
  return { priv: key.privateKey!, hex: payload, address: base58check(payload) };
}

/** Decode a base58check TRON address to its 21-byte hex form. */
export function tronAddressToHex(address: string): Uint8Array {
  const full = base58.decode(address);
  const payload = full.slice(0, -4);
  if (payload.length !== 21 || payload[0] !== 0x41) throw new Error("That does not look like a TRON address.");
  return payload;
}
