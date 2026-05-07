import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in - Decentra" },
      { name: "description", content: "Sign in or create your Decentra account." },
    ],
  }),
});

type AuthMode = "login" | "signup";

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isSignup = mode === "signup";

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: "/" });
    }
  }, [authLoading, navigate, user]);

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value);
    setMessage(null);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
    setMessage(null);
  };

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
    setMessage(null);
  };

  const switchMode = () => {
    setMode((current) => (current === "login" ? "signup" : "login"));
    setMessage(null);
    setShowPassword(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const cleanEmail = email.trim();
    const cleanUsername = username.trim();

    if (!cleanEmail || !password || (isSignup && !cleanUsername)) {
      setMessage("Please fill in every required field.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              username: cleanUsername,
              display_name: cleanUsername,
            },
          },
        });

        if (error) throw error;
        toast.success("Account created. Welcome to Decentra.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to continue with Google.";
      setMessage(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMessage("Enter your email address first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage(error.message);
      toast.error(error.message);
    } else {
      toast.success("Check your inbox for the reset link.");
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-xl border bg-card shadow-xl lg:grid-cols-[1fr_420px]">
          <section className="hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
            <Link to="/" className="flex w-fit items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-foreground/15">
                <Sparkles className="h-6 w-6" />
              </span>
              <span className="text-2xl font-bold">Decentra</span>
            </Link>

            <div className="max-w-lg space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
                Social without the lock-in
              </p>
              <h1 className="text-5xl font-bold leading-tight">
                Sign in, publish, and stay connected on your terms.
              </h1>
              <p className="text-lg leading-8 text-primary-foreground/75">
                Use Google for a quicker start, or keep using email and password when you want a
                separate login.
              </p>
            </div>
          </section>

          <Card className="border-0 shadow-none">
            <CardHeader className="space-y-3 px-6 pt-8 sm:px-8">
              <Link to="/" className="flex w-fit items-center gap-2 lg:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <span className="text-xl font-bold">Decentra</span>
              </Link>
              <div className="space-y-1">
                <CardTitle className="text-3xl font-bold tracking-tight">
                  {isSignup ? "Create account" : "Welcome back"}
                </CardTitle>
                <CardDescription className="text-base">
                  {isSignup
                    ? "Choose a username and sign up."
                    : "Continue with Google or sign in with email."}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 px-6 sm:px-8">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 bg-background"
                disabled={isSubmitting}
                onClick={handleGoogleSignIn}
              >
                <GoogleIcon />
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">or use email</span>
                </div>
              </div>

              {message && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="username"
                        name="username"
                        className="h-11 pl-10"
                        placeholder="decentra_user"
                        value={username}
                        onChange={handleUsernameChange}
                        required={isSignup}
                        minLength={2}
                        autoComplete="username"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      className="h-11 pl-10"
                      placeholder="name@example.com"
                      value={email}
                      onChange={handleEmailChange}
                      required
                      autoComplete="email"
                      inputMode="email"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignup && (
                      <button
                        type="button"
                        className="text-sm font-medium text-primary hover:underline"
                        onClick={handlePasswordReset}
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className="h-11 pl-10 pr-11"
                      placeholder="Enter your password"
                      value={password}
                      onChange={handlePasswordChange}
                      required
                      minLength={6}
                      autoComplete={isSignup ? "new-password" : "current-password"}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full gap-2 font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
                  {!isSubmitting && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="px-6 pb-8 pt-2 sm:px-8">
              <p className="w-full text-center text-sm text-muted-foreground">
                {isSignup ? "Already have an account?" : "New to Decentra?"}{" "}
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline"
                  onClick={switchMode}
                >
                  {isSignup ? "Sign in" : "Create account"}
                </button>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
