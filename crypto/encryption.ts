import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/hashes/utils.js";
import { nativeEncryptFile } from "./nativeAES";

export async function encryptBytes(
  data: Uint8Array,
  key: Uint8Array
) {
  const iv = randomBytes(12);

  const cipher = gcm(key, iv);
  const ciphertext = cipher.encrypt(data);

  return { iv, ciphertext };
}

export async function encryptFile(
  path: string,
  key: Uint8Array
) {
  const { ciphertext, iv } = await nativeEncryptFile(path, key);

  return { iv, ciphertext };
}