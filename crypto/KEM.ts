import { x25519 } from "@noble/curves/ed25519.js";

export async function keyGen(args: { seed: Uint8Array }) {
  const { seed } = args; // ✅ FIXED

  const privateKey = seed.slice(0, 32);
  const publicKey = x25519.getPublicKey(privateKey);

  return {
    publicKey: new Uint8Array(publicKey),
    privateKey: new Uint8Array(privateKey),
  };
}

export async function encapsulate(args: { publicKeyOther: Uint8Array }) {
  const ephemeralPrivate = crypto.getRandomValues(new Uint8Array(32));
  const ephemeralPublic = x25519.getPublicKey(ephemeralPrivate);

  const sharedSecret = x25519.getSharedSecret(
    ephemeralPrivate,
    args.publicKeyOther
  );

  return {
    ciphertext: new Uint8Array(ephemeralPublic),
    sharedSecret: new Uint8Array(sharedSecret),
  };
}

export async function decapsulate(args: {
  ciphertext: Uint8Array;
  privateKeySelf: Uint8Array;
}) {
  const sharedSecret = x25519.getSharedSecret(
    args.privateKeySelf,
    args.ciphertext
  );

  return { sharedSecret: new Uint8Array(sharedSecret) };
}