import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function resolveMetaMaskProvider(): EthereumProvider | null {
  const eth = (window as any).ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    const mm = eth.providers.find((p: any) => p?.isMetaMask);
    return mm ?? null;
  }
  return eth.isMetaMask ? eth : null;
}

export function WalletConnect() {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!user) return;
    setBusy(true);
    try {
      let provider = resolveMetaMaskProvider();
      if (!provider) {
        // Some browsers inject provider asynchronously after first paint.
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          window.addEventListener("ethereum#initialized", done, { once: true } as AddEventListenerOptions);
          setTimeout(done, 1200);
        });
        provider = resolveMetaMaskProvider();
      }
      if (!provider) {
        toast.error("MetaMask not detected. Open/enable the MetaMask extension and refresh.");
        return;
      }

      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No account selected");
      const { error } = await supabase.from("profiles").update({ wallet_address: address }).eq("id", user.id);
      if (error) throw error;
      toast.success("Wallet linked to your identity");
      refreshProfile();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to connect wallet");
    } finally { setBusy(false); }
  };

  return (
    <Button variant="outline" size="sm" onClick={connect} disabled={busy}>
      <Wallet className="h-4 w-4 mr-1" />
      {profile?.wallet_address ? `${profile.wallet_address.slice(0, 6)}…${profile.wallet_address.slice(-4)}` : "Connect Wallet"}
    </Button>
  );
}
