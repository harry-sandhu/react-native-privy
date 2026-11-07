import { NativeModules } from "react-native";
import { fromByteArray, toByteArray } from "base64-js";

const { NativeAES } = NativeModules;

export async function nativeEncrypt(
  data: Uint8Array,
  key: Uint8Array
) {
  const result = await NativeAES.encrypt(
    fromByteArray(data),
    fromByteArray(key)
  );

  return {
    ciphertext: toByteArray(result.ciphertext),
    iv: toByteArray(result.iv),
  };
}
export async function nativeDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
) {
  const result = await NativeAES.decrypt(
    fromByteArray(ciphertext),
    fromByteArray(key),
    fromByteArray(iv)
  );

  return toByteArray(result);
}