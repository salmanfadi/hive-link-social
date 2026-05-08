import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function parseJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function ensurePinataJwt(jwt: string | undefined): string {
  if (!jwt) throw new Error("PINATA_JWT not configured");
  const exp = parseJwtExp(jwt);
  if (!exp) throw new Error("PINATA_JWT is invalid (missing exp claim)");
  if (Date.now() >= exp * 1000) throw new Error("PINATA_JWT is expired");
  return jwt;
}

/**
 * Upload a file to IPFS via Pinata. Server-only — uses PINATA_JWT secret.
 * Accepts a multipart FormData with field `file`.
 */
export const pinFileToIPFS = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("Expected FormData");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Missing file");
    return { file };
  })
  .handler(async ({ data }) => {
    const jwt = ensurePinataJwt(process.env.PINATA_JWT);

    const fd = new FormData();
    fd.append("file", data.file, data.file.name);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Pinata upload failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { IpfsHash: string; PinSize: number };
    return {
      ipfsHash: json.IpfsHash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${json.IpfsHash}`,
      size: json.PinSize,
    };
  });

/**
 * Retry IPFS pinning for a post that previously failed.
 * Re-fetches the media from Supabase Storage URL and re-pins it to Pinata,
 * then updates `ipfs_pinned = true` and clears `ipfs_failed_reason` on the post row.
 */
export const retryPinToIPFS = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (typeof data !== "object" || data === null) throw new Error("Expected object");
    const { postId, mediaUrl } = data as Record<string, unknown>;
    if (typeof postId !== "string") throw new Error("postId required");
    if (typeof mediaUrl !== "string") throw new Error("mediaUrl required");
    return { postId, mediaUrl };
  })
  .handler(async ({ data }) => {
    const jwt = ensurePinataJwt(process.env.PINATA_JWT);
    const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase env not configured on server");

    // Fetch the media blob from Supabase CDN
    const mediaRes = await fetch(data.mediaUrl);
    if (!mediaRes.ok) throw new Error(`Failed to fetch media (${mediaRes.status})`);
    const blob = await mediaRes.blob();
    const filename = data.mediaUrl.split("/").pop() ?? "file";

    // Pin to IPFS
    const fd = new FormData();
    fd.append("file", blob, filename);
    const pinRes = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: fd,
    });
    if (!pinRes.ok) {
      const text = await pinRes.text();
      throw new Error(`Pinata retry failed (${pinRes.status}): ${text}`);
    }
    const pinJson = (await pinRes.json()) as { IpfsHash: string };

    // Update the post row — server-side with service role to bypass RLS
    const sb = createClient(supabaseUrl, supabaseKey);
    const { error } = await sb
      .from("posts")
      .update({ ipfs_hash: pinJson.IpfsHash, ipfs_pinned: true, ipfs_failed_reason: null })
      .eq("id", data.postId);
    if (error) throw new Error(`DB update failed: ${error.message}`);

    return { ipfsHash: pinJson.IpfsHash };
  });

