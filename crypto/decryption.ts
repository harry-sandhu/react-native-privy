import { nativeDecrypt } from "./nativeAES";

export async function decryptBytes(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
) {
  return await nativeDecrypt(ciphertext, key, iv);
}