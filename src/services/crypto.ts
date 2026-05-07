/**
 * Cryptographic services for post signing and verification.
 * Uses Ed25519 via Web Crypto API.
 */

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await window.crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true,
    ["sign", "verify"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return bufToHex(exported);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return bufToHex(exported);
}

export async function importPrivateKey(hex: string): Promise<CryptoKey> {
  const buf = hexToBuf(hex);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "Ed25519" },
    true,
    ["sign"]
  );
}

export async function importPublicKey(hex: string): Promise<CryptoKey> {
  const buf = hexToBuf(hex);
  return await window.crypto.subtle.importKey(
    "raw",
    buf,
    { name: "Ed25519" },
    true,
    ["verify"]
  );
}

export async function signData(privateKey: CryptoKey, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(data);
  const signature = await window.crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    buf
  );
  return bufToHex(signature);
}

export async function verifyData(publicKey: CryptoKey, signature: string, data: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(data);
  const sigBuf = hexToBuf(signature);
  try {
    return await window.crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      sigBuf,
      buf
    );
  } catch {
    return false;
  }
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}
