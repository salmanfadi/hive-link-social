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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<{ publicKey: CryptoKey; privateKey: CryptoKey } | null>(null);

  const loadKeys = async (u: User, p: Profile) => {
    const storageKey = `decentra_keys_${u.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const { priv } = JSON.parse(saved);
        const privateKey = await importPrivateKey(priv);
        const publicKey = await importPublicKey(p.public_key);
        setKeys({ publicKey, privateKey });
      } catch (e) {
        console.error("Key import failed", e);
      }
    } else {
      const pair = await generateKeyPair();
      const pub = await exportPublicKey(pair.publicKey);
      const priv = await exportPrivateKey(pair.privateKey);
      localStorage.setItem(storageKey, JSON.stringify({ pub, priv }));
      await supabase.from("profiles").update({ public_key: pub }).eq("id", u.id);
      setKeys(pair);
    }
  };

  const loadProfile = async (uid: string, u?: User) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    const p = data as Profile;
    setProfile(p ?? null);
    if (u && p) loadKeys(u, p);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadProfile(sess.user.id, sess.user).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        profile,
        loading,
        keys,
        refreshProfile: async () => { if (user) await loadProfile(user.id, user); },
        signOut: async () => { await supabase.auth.signOut(); localStorage.removeItem(`decentra_keys_${user?.id}`); },
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
