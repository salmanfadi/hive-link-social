import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
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
  // Lifecycle metrics (Item 4)
  activeChannels: number;
  reconnectAttempts: number;
  lastEvent: string | null;
  // Session log ring-buffer
  sessionLog: string[];
};

/**
 * Safe fallback context returned when useP2P() is called outside a Provider.
 * P2P is an optional enhancement — no-op stubs keep the rest of the app working.
 */
const nullCtx: Ctx = {
  peerCount: 0,
  connectedPeers: [],
  broadcastNewPost: () => {},
  onInboundPost: () => () => {},
  dms: {},
  sendDM: () => false,
  activeChannels: 0,
  reconnectAttempts: 0,
  lastEvent: null,
  sessionLog: [],
};

const P2PCtx = createContext<Ctx | null>(null);

export function P2PProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [handlers] = useState<Set<(p: Record<string, unknown>, from: string) => void>>(() => new Set());
  const [dms, setDms] = useState<Record<string, DM[]>>({});

  /**
   * Delayed initialization — P2P starts 5 seconds after mount.
   * This gives auth and first paint uncontested time before any
   * WebRTC ICE negotiation or Supabase Presence traffic begins.
   */
  const [p2pReady, setP2pReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setP2pReady(true), 5000);
    return () => clearTimeout(t);
  }, []);

  // Only activate the sync hook when both user is present AND the delay has elapsed
  const activeUserId = p2pReady && user ? user.id : null;

  const { peerCount, broadcast, sendDirect, connectedPeers, activeChannels, reconnectAttempts, lastEvent, sessionLog } = useP2PSync(
    activeUserId,
    (e: P2PEvent, fromPeer) => {
      if (e.type === "new-post") handlers.forEach((h) => h(e.post, fromPeer));
      if (e.type === "dm") {
        setDms(prev => ({
          ...prev,
          [fromPeer]: [...(prev[fromPeer] || []), { from: e.from, text: e.text, timestamp: e.timestamp }]
        }));
      }
    }
  );

  const broadcastNewPost = useCallback((post: Record<string, unknown>) => {
    broadcast({ type: "new-post", post });
  }, [broadcast]);

  const onInboundPost = useCallback((handler: (post: Record<string, unknown>, fromPeer: string) => void) => {
    handlers.add(handler);
    return () => { handlers.delete(handler); };
  }, [handlers]);

  const sendDM = useCallback((toPeerId: string, text: string) => {
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
  }, [sendDirect, user]);

  const value = useMemo<Ctx>(() => ({
    peerCount,
    connectedPeers,
    broadcastNewPost,
    onInboundPost,
    dms,
    sendDM,
    activeChannels,
    reconnectAttempts,
    lastEvent,
    sessionLog,
  }), [peerCount, connectedPeers, broadcastNewPost, onInboundPost, dms, sendDM, activeChannels, reconnectAttempts, lastEvent, sessionLog]);

  return <P2PCtx.Provider value={value}>{children}</P2PCtx.Provider>;
}

/**
 * Returns the P2P context. When called outside a P2PProvider (e.g. on the
 * auth page, or before the provider mounts), returns a safe no-op context
 * instead of throwing. P2P is always an optional enhancement.
 */
export function useP2P(): Ctx {
  return useContext(P2PCtx) ?? nullCtx;
}
