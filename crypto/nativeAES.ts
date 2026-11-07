import { NativeModules } from "react-native";

const { NativeAES } = NativeModules;

export async function nativeEncryptFile(
  path: string,
  key: Uint8Array
) {
  const result = await NativeAES.encryptFile(
    path,
    Array.from(key)
  );

  return {
    ciphertext: new Uint8Array(result.ciphertext),
    iv: new Uint8Array(result.iv),
  };
}

export async function nativeDecrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
) {
  const result = await NativeAES.decryptBytes(
    Array.from(ciphertext),
    Array.from(key),
    Array.from(iv)
  );

  return new Uint8Array(result);
}