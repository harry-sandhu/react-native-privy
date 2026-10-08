import { ed25519 } from "@noble/curves/ed25519.js";
import * as fsHash from "./hash";
import { toBytes } from "viem";

/**
 * Deterministic key generation from 64-byte seed.
 * We use first 32 bytes as private key.
 */
export async function keyGen(args: { seed: Uint8Array }) {
  const privateKey = args.seed.slice(0, 32);
  const publicKey = ed25519.getPublicKey(privateKey);

  return {
    publicKey: new Uint8Array(publicKey),
    privateKey: new Uint8Array(privateKey),
  };
}

/**
 * Sign hashed message
 */
export async function sign(args: {
  message: Uint8Array;
  privateKey: Uint8Array;
}) {
  const digest = toBytes(fsHash.digest(args.message));
  const signature = ed25519.sign(digest, args.privateKey);

  return new Uint8Array(signature);
}

/**
 * Verify signature
 */
export async function verify(args: {
  message: Uint8Array;
  signature: Uint8Array;
  publicKey: Uint8Array;
}) {
  const digest = toBytes(fsHash.digest(args.message));

  return ed25519.verify(
    args.signature,
    digest,
    args.publicKey
  );
}