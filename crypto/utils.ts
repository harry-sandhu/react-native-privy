import {
  toBytes,
  toHex,
  type Address,
  type Hex,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
} from "viem";

import { argon, hash } from "./hash";
import * as KEM from "./KEM";
import * as signatures from "./signature";

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

export type Wallet = WalletClient<Transport, Chain, Account>;

export function randomBytes(n = 32) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function hkdfExtractExpand(
  source: Uint8Array,
  salt: Uint8Array | null,
  info: Uint8Array | null,
  length: number
): Promise<Uint8Array> {
  return hkdf(
    sha256,
    source,
    salt ?? new Uint8Array(),
    info ?? new Uint8Array(),
    length
  );
}

export function generateRegisterChallenge(
  userAddress: Address,
  salt: Hex,
  info: string
) {
  return `filosign:${userAddress}:${salt}:${info}`;
}

export async function walletKeyGen(
  wallet: Wallet,
  args: {
    pin: string;
    salts?: {
      challenge: Hex;
      seed: Hex;
      pin: Hex;
    };
  }
) {
  const { pin, salts } = args;

  // Generate or reuse salts
  const saltPin = salts?.pin ? toBytes(salts.pin) : randomBytes(16);
  const saltSeed = salts?.seed ? toBytes(salts.seed) : randomBytes(16);
  const saltChallenge = salts?.challenge
    ? toBytes(salts.challenge)
    : randomBytes(16);

  // 🔐 REAL ARGON2 (async)
  const pinArgoned = await argon(pin, saltPin); // 32 bytes

  // Build challenge message
  const registerChallenge = generateRegisterChallenge(
    wallet.account.address,
    toHex(saltChallenge),
    toHex(pinArgoned) // ✅ use hex, NOT toString()
  );

  const signature = await wallet.signMessage({
    message: registerChallenge,
  });

  // Derive master seed using HKDF
  const seed = await hkdfExtractExpand(
    saltSeed,
    toBytes(signature),
    pinArgoned, // ✅ pass raw bytes, not string
    64
  );

  const kemKeypair = await KEM.keyGen({ seed });
  const sigKeypair = await signatures.keyGen({ seed });

  return {
    seed,
    saltPin: toHex(saltPin),
    saltSeed: toHex(saltSeed),
    saltChallenge: toHex(saltChallenge),
    kemKeypair,
    sigKeypair,
  };
}