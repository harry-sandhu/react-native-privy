import { gcm } from "@noble/ciphers/aes";

export async function decryptBytes(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
) {
  const cipher = gcm(key, iv);
  return cipher.decrypt(ciphertext);
}