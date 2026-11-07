import { decryptBytes } from "./decryption";
import { toByteArray, fromByteArray } from "base64-js";

const base64ToUint8 = (base64: string) => toByteArray(base64);
const aesKeyCache = new Map<string, Uint8Array>();

export async function decryptStoredFile(
  encryptedBytes: Uint8Array,
  encryptedKeyBase64: string,
  keyIvBase64: string,
  fileIvBase64: string,
  masterKey: Uint8Array
) {
  const encryptedKey = base64ToUint8(encryptedKeyBase64);
  const keyIv = base64ToUint8(keyIvBase64);

  let aesKey = aesKeyCache.get(encryptedKeyBase64);

if (!aesKey) {
  aesKey = await decryptBytes(
    encryptedKey,
    masterKey,
    keyIv
  );
  aesKeyCache.set(encryptedKeyBase64, aesKey);
}

  const fileIv = base64ToUint8(fileIvBase64);

  const decryptedBytes = await decryptBytes(
    encryptedBytes,
    aesKey,
    fileIv
  );

  return "data:image/jpeg;base64," + fromByteArray(decryptedBytes);
}