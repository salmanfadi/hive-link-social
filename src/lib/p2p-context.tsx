import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useP2PSync, type P2PPostEvent } from "@/lib/use-p2p-sync";

type Ctx = {
  peerCount: number;
  broadcastNewPost: (post: Record<string, unknown>) => void;
  /** Subscribe to inbound posts from peers. Returns unsubscribe. */
  onInboundPost: (handler: (post: Record<string, unknown>, fromPeer: string) => void) => () => void;
};

const P2PCtx = createContext<Ctx | null>(null);

export function P2PProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [handlers] = useState<Set<(p: Record<string, unknown>, from: string) => void>>(() => new Set());

  const { peerCount, broadcast } = useP2PSync(user?.id ?? null, (e: P2PPostEvent, fromPeer) => {
    if (e.type === "new-post") handlers.forEach((h) => h(e.post, fromPeer));
  });

  return (
    <P2PCtx.Provider
      value={{
        peerCount,
        broadcastNewPost: (post) => broadcast({ type: "new-post", post }),
        onInboundPost: (handler) => {
          handlers.add(handler);
          return () => { handlers.delete(handler); };
        },
      }}
    >
      {children}
    </P2PCtx.Provider>
  );
}

export function useP2P() {
  const c = useContext(P2PCtx);
  if (!c) throw new Error("useP2P must be used within P2PProvider");
  return c;
}
