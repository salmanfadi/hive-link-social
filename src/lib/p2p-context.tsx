import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useP2PSync, type P2PEvent } from "@/lib/use-p2p-sync";

export type DM = { from: string; text: string; timestamp: number };

type Ctx = {
  peerCount: number;
  connectedPeers: string[];
  broadcastNewPost: (post: Record<string, unknown>) => void;
  /** Subscribe to inbound posts from peers. Returns unsubscribe. */
  onInboundPost: (handler: (post: Record<string, unknown>, fromPeer: string) => void) => () => void;
  dms: Record<string, DM[]>;
  sendDM: (toPeerId: string, text: string) => boolean;
};

const P2PCtx = createContext<Ctx | null>(null);

export function P2PProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [handlers] = useState<Set<(p: Record<string, unknown>, from: string) => void>>(() => new Set());
  const [dms, setDms] = useState<Record<string, DM[]>>({});

  const { peerCount, broadcast, sendDirect, connectedPeers } = useP2PSync(user?.id ?? null, (e: P2PEvent, fromPeer) => {
    if (e.type === "new-post") handlers.forEach((h) => h(e.post, fromPeer));
    if (e.type === "dm") {
      setDms(prev => ({
        ...prev,
        [fromPeer]: [...(prev[fromPeer] || []), { from: e.from, text: e.text, timestamp: e.timestamp }]
      }));
    }
  });

  return (
    <P2PCtx.Provider
      value={{
        peerCount,
        connectedPeers,
        broadcastNewPost: (post) => broadcast({ type: "new-post", post }),
        onInboundPost: (handler) => {
          handlers.add(handler);
          return () => { handlers.delete(handler); };
        },
        dms,
        sendDM: (toPeerId, text) => {
          if (!user) return false;
          const msg = { type: "dm", to: toPeerId, from: user.id, text, id: Math.random().toString(), timestamp: Date.now() };
          if (sendDirect(toPeerId, msg as any)) {
            setDms(prev => ({
              ...prev,
              [toPeerId]: [...(prev[toPeerId] || []), { from: user.id, text, timestamp: msg.timestamp }]
            }));
            return true;
          }
          return false;
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
