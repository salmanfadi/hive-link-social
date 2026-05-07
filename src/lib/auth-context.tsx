import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { generateKeyPair, exportPublicKey, exportPrivateKey, importPrivateKey, importPublicKey, signData } from "@/services/crypto";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  did: string;
  public_key: string;
  wallet_address: string | null;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  keys: { publicKey: CryptoKey; privateKey: CryptoKey } | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  sign: (data: string) => Promise<string | null>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

/**
 * Synchronously checks if a Supabase session token exists in localStorage.
 * Used to determine initial `loading` state — if there's no stored session,
 * we start with loading=false so unauthenticated users are redirected instantly
 * without showing any loading screen.
 */
function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Object.keys(localStorage).some(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Only start loading=true if there's a stored session to validate.
  // This ensures unauthenticated users see the login page immediately.
  // Always start loading=false to match SSR (server has no localStorage).
  // The useEffect restores session asynchronously without blocking initial render.
  const [loading, setLoading] = useState(false);
  const [keys, setKeys] = useState<{ publicKey: CryptoKey; privateKey: CryptoKey } | null>(null);

  const loadKeys = async (u: User, p: Profile) => {
    const storageKey = `decentra_keys_${u.id}`;
    const saved = localStorage.getItem(storageKey);
    try {
      /**
       * The DB trigger (handle_new_user) writes a random-bytes placeholder as
       * public_key on signup. Those bytes are NOT a valid Ed25519 point, so
       * importPublicKey() will throw. We catch that case and treat it the same
       * as "no keys yet" — generating a real pair and pushing the real public
       * key back to the DB. This runs once per new user (or any existing user
       * whose key was never properly set), silently and non-blocking.
       */
      let validPublicKey: CryptoKey | null = null;
      if (p.public_key) {
        try {
          validPublicKey = await importPublicKey(p.public_key);
        } catch {
          // Placeholder or corrupted key — will regenerate below
          console.info("[Auth] DB public_key invalid (placeholder), regenerating key pair");
        }
      }

      if (saved && validPublicKey) {
        // Normal login path: local private key + validated DB public key
        const { priv } = JSON.parse(saved);
        const privateKey = await importPrivateKey(priv);
        setKeys({ publicKey: validPublicKey, privateKey });
      } else {
        // New user, or DB had a placeholder key — generate a real Ed25519 pair
        const pair = await generateKeyPair();
        const pub = await exportPublicKey(pair.publicKey);
        const priv = await exportPrivateKey(pair.privateKey);
        localStorage.setItem(storageKey, JSON.stringify({ pub, priv }));
        // Push the real public key to the DB (overwrites the placeholder)
        await supabase.from("profiles").update({ public_key: pub }).eq("id", u.id);
        setKeys(pair);
      }
    } catch (e) {
      console.error("[Auth] Key operation failed:", e);
    }
  };

  const loadProfile = async (u: User) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle();
      if (data) setProfile(data as Profile);
    } catch (e) {
      console.error("[Auth] Profile load failed:", e);
    }
  };

  useEffect(() => {
    let settled = false;
    const failsafe = setTimeout(() => {
      if (!settled) {
        console.warn("[Auth] Failsafe triggered after 3s");
        setLoading(false);
        settled = true;
      }
    }, 3000);

    const done = () => {
      if (!settled) {
        setLoading(false);
        settled = true;
        clearTimeout(failsafe);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (!sess) {
        setProfile(null);
        setKeys(null);
        done();
      } else {
        loadProfile(sess.user).finally(done);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess) {
        loadProfile(sess.user).finally(done);
      } else {
        done();
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(failsafe);
    };
  }, []);

  /**
   * Stage 3: Background Key Generation
   * CPU intensive crypto operations run only after auth is settled.
   */
  useEffect(() => {
    if (user && profile && !keys) {
      loadKeys(user, profile).catch(e => console.error("[Auth] Background key load failed:", e));
    }
  }, [user?.id, profile?.id]);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        loading,
        keys,
        refreshProfile: async () => { if (user) await loadProfile(user); },
        signOut: async () => {
          await supabase.auth.signOut();
          localStorage.removeItem(`decentra_keys_${user?.id}`);
        },
        sign: async (data: string) => {
          if (!keys?.privateKey) return null;
          return await signData(keys.privateKey, data);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
