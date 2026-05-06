import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — Decentra" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery link puts the session in URL hash; supabase-js consumes it on load.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated. Signing you in…"); navigate({ to: "/" }); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundImage: "var(--gradient-subtle)" }}>
      <Card className="w-full max-w-md p-8 shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center">Set new password</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {ready ? "Choose a new password to access your account." : "Open this page from the recovery email."}
        </p>
        {ready && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full" style={{ backgroundImage: "var(--gradient-primary)" }}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
