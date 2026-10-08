import * as Keychain from "react-native-keychain";
import { fromByteArray, toByteArray } from "base64-js";

const SERVICE = "vault.masterkey";

export async function storeMasterKey(masterKey: Uint8Array) {
  const encoded = fromByteArray(masterKey);

  await Keychain.setGenericPassword("vault", encoded, {
    service: SERVICE,
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
  });
}

export async function loadMasterKey(): Promise<Uint8Array | null> {
  const res = await Keychain.getGenericPassword({
    service: SERVICE,
  });

  if (!res) return null;

  return toByteArray(res.password);
}

export async function clearMasterKey() {
  await Keychain.resetGenericPassword({
    service: SERVICE,
  });
}