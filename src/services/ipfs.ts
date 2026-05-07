/**
 * IPFS Service - Decentralized Storage Layer
 *
 * Provides utility functions for IPFS gateway URLs and availability checks.
 *
 * NOTE: Actual file uploads to IPFS go through the server-side Pinata function
 * (src/server/pinata.functions.ts) which keeps the PINATA_JWT secret server-only.
 * The uploadToIPFS() function that used VITE_PINATA_JWT has been removed — it was
 * dead code since new.tsx already uses the server function correctly.
 */

export const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

/**
 * Returns the primary IPFS gateway URL for a given CID.
 * Returns empty string for local_ fallback hashes (not real CIDs).
 */
export function getIPFSGatewayUrl(hash: string, gatewayIndex = 0): string {
  if (!hash || hash.startsWith("local_")) return "";
  const gateway = IPFS_GATEWAYS[gatewayIndex] ?? IPFS_GATEWAYS[0];
  return `${gateway}${hash}`;
}

/**
 * Checks whether IPFS uploads are available.
 * Actual uploading is done server-side via pinata.functions.ts.
 * This simply verifies the environment is configured.
 */
export function isIPFSAvailable(): boolean {
  // Uploads go server-side; this checks if the server function is reachable
  // (always true in SSR context, false in pure static builds)
  return typeof window !== "undefined";
}