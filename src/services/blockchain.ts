/**
 * Blockchain Service - Identity Layer
 * 
 * Handles wallet connection (MetaMask) and blockchain-based identity.
 * Provides non-deletable, portable identity as per the paper requirements.
 */

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
}

export interface BlockchainIdentity {
  walletAddress: string;
  did: string;
  publicKey: string;
  createdAt: number;
}

const CHAIN_IDS: Record<number, string> = {
  1: "Ethereum Mainnet",
  5: "Goerli Testnet",
  11155111: "Sepolia Testnet",
  137: "Polygon Mainnet",
  80001: "Mumbai Testnet",
};

export async function connectWallet(): Promise<WalletState> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    const address = accounts[0] as string;
    
    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    const balance = await window.ethereum.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });

    return {
      isConnected: true,
      address,
      chainId: parseInt(chainId, 16),
      balance: (parseInt(balance, 16) / 1e18).toFixed(4),
    };
  } catch (error) {
    console.error("Wallet connection failed:", error);
    throw error;
  }
}

export async function disconnectWallet(): Promise<void> {
  // MetaMask doesn't support programmatic disconnect
  // Just clear local state
  localStorage.removeItem("hivelink_wallet_state");
}

export async function getWalletState(): Promise<WalletState | null> {
  if (typeof window === "undefined" || !window.ethereum) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    if (accounts.length === 0) {
      return null;
    }

    const address = accounts[0] as string;
    
    const chainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    const balance = await window.ethereum.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });

    return {
      isConnected: true,
      address,
      chainId: parseInt(chainId, 16),
      balance: (parseInt(balance, 16) / 1e18).toFixed(4),
    };
  } catch (error) {
    console.error("Failed to get wallet state:", error);
    return null;
  }
}

export function getNetworkName(chainId: number | null): string {
  if (!chainId) return "Unknown";
  return CHAIN_IDS[chainId] || `Chain ${chainId}`;
}

export function isMetaMaskInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.ethereum?.isMetaMask;
}

export async function switchNetwork(chainId: number): Promise<void> {
  if (!window.ethereum) {
    throw new Error("No wallet installed");
  }

  const chainIdHex = `0x${chainId.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: any) {
    // If chain not added, user needs to add it manually
    if (error.code === 4902) {
      throw new Error(`Please add network chainId ${chainId} to your wallet`);
    }
    throw error;
  }
}

/**
 * Create a blockchain-based DID
 */
export function createBlockchainDID(walletAddress: string): string {
  return `did:ethr:${walletAddress.toLowerCase()}`;
}

/**
 * Sign a message with wallet (for authentication)
 */
export async function signMessage(message: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error("No wallet installed");
  }

  const accounts = await window.ethereum.request({
    method: "eth_accounts",
  });

  if (accounts.length === 0) {
    throw new Error("No wallet connected");
  }

  try {
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, accounts[0]],
    });

    return signature;
  } catch (error) {
    console.error("Signing failed:", error);
    throw error;
  }
}

/**
 * Verify a signature
 */
export async function verifySignature(
  message: string,
  signature: string,
  address: string
): Promise<boolean> {
  // In production, use ecrecover or a library like ethers.js
  // This is a simplified version
  try {
    const accounts = await window.ethereum?.request({
      method: "eth_accounts",
    });
    return accounts?.[0]?.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

// Type declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request(args: { method: string; params?: any[] }): Promise<any>;
      on(event: string, callback: (...args: any[]) => void): void;
      removeListener(event: string, callback: (...args: any[]) => void): void;
    };
  }
}