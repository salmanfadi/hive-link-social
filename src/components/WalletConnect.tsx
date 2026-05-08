import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

/** EIP-6963 announce event payload */
type EIP6963ProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EthereumProvider;
};

// Chains we consider "valid" — Mainnet + common testnets
const ALLOWED_CHAIN_IDS = new Set([
  "0x1",    // Ethereum Mainnet
  "0xaa36a7", // Sepolia testnet
  "0x89",   // Polygon Mainnet
  "0x13881", // Polygon Mumbai
]);

const CHAIN_NAMES: Record<string, string> = {
  "0x1": "Ethereum Mainnet",
  "0xaa36a7": "Sepolia Testnet",
  "0x89": "Polygon Mainnet",
  "0x13881": "Polygon Mumbai",
};

// ─── Provider resolution ─────────────────────────────────────────────────────

function resolveWindowEthereumProvider(): EthereumProvider | null {
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    // Prefer MetaMask in multi-provider arrays
    return eth.providers.find((p: any) => p?.isMetaMask) ?? eth.providers[0];
  }
  return eth;
}

// ─── Hook: collect EIP-6963 providers ────────────────────────────────────────

function useEIP6963Providers() {
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (!detail?.info?.uuid || seen.current.has(detail.info.uuid)) return;
      seen.current.add(detail.info.uuid);
      setProviders((prev) => [...prev, detail]);
    };
    window.addEventListener("eip6963:announceProvider", handler);
    // Trigger any already-injected wallets to re-announce
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handler);
  }, []);

  return providers;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WalletConnect() {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const eip6963Providers = useEIP6963Providers();

  /** Attempt chain validation and optional switch */
  async function validateChain(provider: EthereumProvider): Promise<boolean> {
    try {
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      if (ALLOWED_CHAIN_IDS.has(chainId)) return true;

      // Ask the wallet to switch to Ethereum Mainnet
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1" }],
        });
        return true;
      } catch (switchErr: any) {
        const msg = CHAIN_NAMES[chainId]
          ? `You're on ${CHAIN_NAMES[chainId]}. Please switch to Ethereum Mainnet in your wallet.`
          : `Unsupported network (chainId: ${chainId}). Please switch to Ethereum Mainnet.`;
        toast.error(msg);
        return false;
      }
    } catch {
      // If we can't check the chain, don't block connection
      return true;
    }
  }

  const connect = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // ── 1. Resolve provider ──────────────────────────────────────────────
      let provider: EthereumProvider | null = null;

      // Prefer EIP-6963 announced providers (modern standard)
      if (eip6963Providers.length > 0) {
        // If multiple wallets, prefer one named MetaMask; otherwise take the first
        const preferred =
          eip6963Providers.find((p) =>
            p.info.name.toLowerCase().includes("metamask")
          ) ?? eip6963Providers[0];
        provider = preferred.provider;
      }

      // Fallback: legacy window.ethereum injection
      if (!provider) {
        provider = resolveWindowEthereumProvider();
      }

      // Last chance: wait for async injection (some browsers are slow)
      if (!provider) {
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          window.addEventListener("ethereum#initialized", done, { once: true } as AddEventListenerOptions);
          window.addEventListener("eip6963:announceProvider", done, { once: true } as AddEventListenerOptions);
          setTimeout(done, 1500);
        });
        if (eip6963Providers.length > 0) {
          provider = eip6963Providers[0].provider;
        } else {
          provider = resolveWindowEthereumProvider();
        }
      }

      if (!provider) {
        toast.error("No Web3 wallet detected. Install MetaMask or another EIP-6963 compatible wallet and refresh.");
        return;
      }

      // ── 2. Request accounts ──────────────────────────────────────────────
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account selected in wallet");

      // ── 3. Validate chain ────────────────────────────────────────────────
      const chainOk = await validateChain(provider);
      if (!chainOk) return;

      // ── 4. Persist to profile ────────────────────────────────────────────
      const { error } = await supabase.from("profiles").update({ wallet_address: address }).eq("id", user.id);
      if (error) throw error;

      const walletSource =
        eip6963Providers.find((p) => p.provider === provider)?.info.name ?? "Wallet";
      toast.success(`${walletSource} linked to your identity`);
      refreshProfile();
    } catch (e: any) {
      if (e?.code === 4001) {
        toast.info("Wallet connection cancelled.");
      } else {
        toast.error(e.message ?? "Failed to connect wallet");
      }
    } finally {
      setBusy(false);
    }
  };

  const walletLabel = profile?.wallet_address
    ? `${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}`
    : eip6963Providers.length > 1
      ? `Connect Wallet (${eip6963Providers.length} detected)`
      : "Connect Wallet";

  return (
    <Button variant="outline" size="sm" onClick={connect} disabled={busy}>
      {eip6963Providers.length === 0 && !profile?.wallet_address ? (
        <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
      ) : (
        <Wallet className="h-4 w-4 mr-1" />
      )}
      {walletLabel}
    </Button>
  );
}
