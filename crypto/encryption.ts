import { nativeEncrypt } from "./nativeAES";

export async function encryptBytes(
  data: Uint8Array,
  key: Uint8Array
) {
  const { ciphertext, iv } = await nativeEncrypt(data, key);

  return { iv, ciphertext };
}