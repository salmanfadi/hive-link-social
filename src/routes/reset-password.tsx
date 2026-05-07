import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Sparkles, ShieldAlert, Lock, ArrowRight, Home } from "lucide-react";
import { toast } from "sonner";
import * as React from "react";

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
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated successfully!");
      navigate({ to: "/" });
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--primary)_0%,_transparent_40%),_radial-gradient(ellipse_at_bottom_left,_var(--primary)_0%,_transparent_40%)] bg-background p-4 overflow-hidden">
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px]" />
      
      <Card className="w-full max-w-md shadow-2xl border-primary/10 bg-card/80 backdrop-blur-xl relative z-10 animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-2 flex flex-col items-center pb-8">
          <Link to="/" className="flex items-center gap-2 group transition-transform hover:scale-105">
            <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
              <Sparkles className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Decentra</span>
          </Link>
          <CardTitle className="text-3xl font-extrabold text-center tracking-tight pt-4">Reset Password</CardTitle>
          <CardDescription className="text-center text-base">
            {ready 
              ? "Choose a secure new password for your account." 
              : "Invalid or expired session. Please request a new link."}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {ready ? (
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2 group">
                <Label htmlFor="np" className="text-sm font-medium ml-1">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="np" 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    minLength={6} 
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={busy} 
                className="w-full h-11 mt-4 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300"
              >
                {busy ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                    <span>Updating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <span>Update Password</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center gap-6 p-8 bg-destructive/5 rounded-2xl border border-destructive/20 backdrop-blur-sm">
              <div className="p-4 rounded-full bg-destructive/10">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <p className="text-sm font-medium text-center text-destructive leading-relaxed">
                Your recovery session has expired or is invalid. This can happen if the link was already used or is too old.
              </p>
              <Button asChild variant="outline" className="w-full h-11 border-destructive/20 hover:bg-destructive/5 hover:text-destructive">
                <Link to="/auth">Request new link</Link>
              </Button>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col border-t border-border/50 pt-6 pb-8">
          <Link to="/auth" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary font-medium transition-all group">
            <Home className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to login
          </Link>
        </CardFooter>
      </Card>
      
      {/* Decorative blobs */}
      <div className="absolute top-[10%] left-[5%] w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[5%] w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );
}
