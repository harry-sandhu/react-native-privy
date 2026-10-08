import { encodePacked, keccak256, type Hex, isHex } from "viem";
import { scrypt } from "@noble/hashes/scrypt.js";

/**
 * Keccak hash helper
 */
export function hash(value: Hex | Uint8Array | string): Hex {
  if (typeof value === "string" && !isHex(value)) {
    return keccak256(encodePacked(["string"], [value]));
  }
  return keccak256(value);
}

/**
 * Strong memory-hard PIN derivation using scrypt
 */
export async function argon(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  return scrypt(
    new TextEncoder().encode(password),
    salt,
    {
      N: 2 ** 15,   // CPU/memory cost (32768)
      r: 8,
      p: 1,
      dkLen: 32,
    }
  );
}