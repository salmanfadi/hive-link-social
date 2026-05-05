import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function WalletConnect() {
  const { user, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!user) return;
    if (!window.ethereum) {
      toast.error("MetaMask not detected. Install it to connect a wallet.");
      return;
    }
    setBusy(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
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
