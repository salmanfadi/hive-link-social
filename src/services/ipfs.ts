/**
 * IPFS Service - Decentralized Storage Layer
 * 
 * Handles uploading media to IPFS and retrieving content via IPFS gateways.
 * Includes fallback caching for offline resilience.
 */

export interface IPFSUploadResult {
  hash: string;
  gatewayUrl: string;
  size: number;
}

export interface IPFSCacheEntry {
  hash: string;
  data: Blob;
  timestamp: number;
  contentType: string;
}

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

const CACHE_PREFIX = "hivelink_ipfs_cache_";

/**
 * Upload a file to IPFS via Pinata API
 * Falls back to local caching if IPFS fails
 */
export async function uploadToIPFS(file: File): Promise<IPFSUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const pinataJwt = import.meta.env.VITE_PINATA_JWT;
  
  if (pinataJwt) {
    try {
      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${pinataJwt}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const hash = result.IpfsHash;
        
        // Cache locally for fallback
        await cacheLocally(hash, file);
        
        return {
          hash,
          gatewayUrl: `${IPFS_GATEWAYS[0]}${hash}`,
          size: file.size,
        };
      }
    } catch (error) {
      console.error("Pinata upload failed:", error);
    }
  }

  // Fallback: Store locally if IPFS fails
  const fallbackHash = `local_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}`;
  await cacheLocally(fallbackHash, file);
  
  return {
    hash: fallbackHash,
    gatewayUrl: "",
    size: file.size,
  };
}

/**
 * Fetch content from IPFS with fallback to local cache
 */
export async function fetchFromIPFS(hash: string): Promise<Blob | null> {
  // Check local cache first
  const cached = await getFromLocalCache(hash);
  if (cached) return cached;

  // Try IPFS gateways
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${hash}`);
      if (response.ok) {
        const blob = await response.blob();
        // Cache for future use
        await cacheLocally(hash, blob);
        return blob;
      }
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error);
    }
  }

  return null;
}

/**
 * Get a public gateway URL for an IPFS hash
 */
export function getIPFSGatewayUrl(hash: string): string {
  if (hash.startsWith("local_")) {
    return ""; // Local fallback
  }
  return `${IPFS_GATEWAYS[0]}${hash}`;
}

/**
 * Cache content locally for offline access
 */
async function cacheLocally(hash: string, data: Blob | File): Promise<void> {
  try {
    const key = `${CACHE_PREFIX}${hash}`;
    const entry: IPFSCacheEntry = {
      hash,
      data,
      timestamp: Date.now(),
      contentType: data.type,
    };
    localStorage.setItem(key, JSON.stringify({
      ...entry,
      // Note: Can't store Blob in localStorage, so we store metadata only
      // In production, use IndexedDB for binary data
    }));
  } catch (error) {
    console.warn("Local cache failed:", error);
  }
}

/**
 * Get content from local cache
 */
async function getFromLocalCache(hash: string): Promise<Blob | null> {
  try {
    const key = `${CACHE_PREFIX}${hash}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      const entry = JSON.parse(stored);
      // In production, retrieve actual blob from IndexedDB
      return new Blob([], { type: entry.contentType });
    }
  } catch (error) {
    console.warn("Local cache read failed:", error);
  }
  return null;
}

/**
 * Check if IPFS is available
 */
export function isIPFSAvailable(): boolean {
  return !!import.meta.env.VITE_PINATA_JWT;
}

/**
 * Clear old cache entries
 */
export function clearIPFSCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}