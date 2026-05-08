import { createServerFn } from "@tanstack/react-start";

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
