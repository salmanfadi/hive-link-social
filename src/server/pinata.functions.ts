type ServerFunctionCall<T> = {
  data: T;
};

type PinFileResult = {
  ipfsHash: string;
  gatewayUrl: string;
  size: number;
};

type RetryPinResult = {
  ipfsHash: string;
};

const STATIC_DEPLOYMENT_MESSAGE =
  "IPFS pinning requires a server endpoint with PINATA_JWT. The static Vercel build can still publish posts, but media pinning is disabled.";

/**
 * Browser-safe placeholder for the old TanStack Start server function.
 * Keeping this module free of @tanstack/react-start prevents server-only
 * internals from being bundled into the static Vite app.
 */
export async function pinFileToIPFS(_: ServerFunctionCall<FormData>): Promise<PinFileResult> {
  throw new Error(STATIC_DEPLOYMENT_MESSAGE);
}

export async function retryPinToIPFS(
  _: ServerFunctionCall<{ postId: string; mediaUrl: string }>,
): Promise<RetryPinResult> {
  throw new Error(STATIC_DEPLOYMENT_MESSAGE);
}
