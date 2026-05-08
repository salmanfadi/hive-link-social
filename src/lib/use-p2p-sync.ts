/**
 * WebRTC P2P Sync — uses Supabase Realtime as signaling channel.
 *
 * Each authenticated user joins a "decentra-p2p" presence channel and
 * advertises their userId. Peers establish RTCPeerConnections via
 * offer/answer/ICE messages broadcast over the channel. Once connected,
 * new posts are pushed directly through RTCDataChannel — bypassing the
 * server for live propagation.
 *
 * Safety limits:
 *   MAX_ACTIVE_PEERS = 5   — refuse new connections beyond this cap
 *   ICE_TIMEOUT_MS = 10000 — destroy stale connections that never connect
 *   Backoff reconnect      — exponential delay (1s→2s→4s…30s) on ICE failure
 *
 * Metrics exposed (Item 4):
 *   activeChannels    — number of open RTCDataChannels
 *   reconnectAttempts — total backoff reconnects attempted this session
 *   lastEvent         — human-readable string describing the most recent P2P event
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type SignalMsg =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export type P2PEvent =
  | { type: "new-post"; post: Record<string, unknown> }
  | { type: "dm"; to: string; from: string; text: string; id: string; timestamp: number };

const MAX_ACTIVE_PEERS = 5;
const ICE_TIMEOUT_MS = 10_000;

/** Exponential backoff config for failed ICE reconnects */
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Public TURN fallback for strict NATs (best-effort, not for high-volume use)
    {
      urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443"],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

export function useP2PSync(
  userId: string | null,
  onMessage: (e: P2PEvent, fromPeer: string) => void,
) {
  const [peerCount, setPeerCount] = useState(0);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

  // ── Lifecycle metrics (Item 4) ─────────────────────────────────────────────
  const [activeChannels, setActiveChannels] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastEvent, setLastEvent] = useState<string | null>(null);

  // ── Session log ring-buffer (last 100 events) ────────────────────────────
  const SESSION_LOG_MAX = 100;
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  /** Mutable ref so closure captures are always current without re-render churn */
  const sessionLogRef = useRef<string[]>([]);

  const peersRef = useRef<Map<string, { pc: RTCPeerConnection; dc?: RTCDataChannel }>>( new Map());
  const iceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Tracks backoff attempt count per peer for exponential delay */
  const reconnectAttemptsRef = useRef<Map<string, number>>(new Map());
  /** backoff timers per peer so we can cancel on cleanup */
  const backoffTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sendRef = useRef<(e: P2PEvent) => void>(() => {});
  const sendDirectRef = useRef<(peerId: string, e: P2PEvent) => boolean>(() => false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Keeps a stable ref to userId for use in closures
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("decentra-p2p", {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });

    // ── Helper: emit a human-readable last event ──────────────────────────
    const emitEvent = (msg: string) => {
      const entry = `${new Date().toLocaleTimeString()} — ${msg}`;
      setLastEvent(entry);
      // Ring-buffer append
      sessionLogRef.current = [...sessionLogRef.current, entry].slice(-SESSION_LOG_MAX);
      setSessionLog([...sessionLogRef.current]);
    };

    // ── Helper: count open data channels ─────────────────────────────────
    const updateChannelCount = () => {
      let open = 0;
      peersRef.current.forEach(({ dc }) => { if (dc?.readyState === "open") open++; });
      setActiveChannels(open);
    };

    const updatePeerState = () => {
      setPeerCount(peersRef.current.size);
      setConnectedPeers(Array.from(peersRef.current.keys()));
      updateChannelCount();
    };

    const clearIceTimer = (peerId: string) => {
      const t = iceTimersRef.current.get(peerId);
      if (t !== undefined) { clearTimeout(t); iceTimersRef.current.delete(peerId); }
    };

    const clearBackoffTimer = (peerId: string) => {
      const t = backoffTimersRef.current.get(peerId);
      if (t !== undefined) { clearTimeout(t); backoffTimersRef.current.delete(peerId); }
    };

    const removePeer = (peerId: string) => {
      clearIceTimer(peerId);
      clearBackoffTimer(peerId);
      peersRef.current.delete(peerId);
      updatePeerState();
    };

    const wireDataChannel = (peerId: string, dc: RTCDataChannel) => {
      const entry = peersRef.current.get(peerId);
      if (entry) entry.dc = dc;
      dc.onopen = () => {
        clearIceTimer(peerId);
        // Reset backoff counter on successful connection
        reconnectAttemptsRef.current.delete(peerId);
        emitEvent(`Connected to peer ${peerId.slice(0, 8)}`);
        updatePeerState();
      };
      dc.onclose = () => {
        emitEvent(`Channel closed with peer ${peerId.slice(0, 8)}`);
        removePeer(peerId);
        updateChannelCount();
      };
      dc.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as P2PEvent;
          onMessageRef.current(data, peerId);
        } catch {/* ignore malformed messages */}
      };
    };

    // ── Item 5: Backoff reconnect ─────────────────────────────────────────
    const scheduleReconnect = (peerId: string, initiator: boolean) => {
      clearBackoffTimer(peerId);
      const attempt = (reconnectAttemptsRef.current.get(peerId) ?? 0) + 1;
      reconnectAttemptsRef.current.set(peerId, attempt);
      const delay = backoffDelay(attempt - 1);

      console.debug(`[P2P] Scheduling reconnect to ${peerId.slice(0, 8)} in ${delay}ms (attempt ${attempt})`);
      emitEvent(`Reconnecting to ${peerId.slice(0, 8)} in ${Math.round(delay / 1000)}s (attempt ${attempt})`);
      setReconnectAttempts((c) => c + 1);

      const t = setTimeout(() => {
        backoffTimersRef.current.delete(peerId);
        if (!peersRef.current.has(peerId) && userIdRef.current) {
          createPeer(peerId, initiator);
        }
      }, delay);
      backoffTimersRef.current.set(peerId, t);
    };

    const createPeer = (peerId: string, initiator: boolean) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!.pc;
      if (peersRef.current.size >= MAX_ACTIVE_PEERS) {
        console.debug(`[P2P] Peer cap reached (${MAX_ACTIVE_PEERS}), ignoring peer ${peerId.slice(0, 8)}`);
        return null as unknown as RTCPeerConnection;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, { pc });
      updatePeerState();

      // ICE timeout
      const timer = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          console.warn(`[P2P] ICE timeout for peer ${peerId.slice(0, 8)}, destroying`);
          emitEvent(`ICE timeout — ${peerId.slice(0, 8)}`);
          pc.close();
          removePeer(peerId);
          // Schedule backoff reconnect after ICE timeout
          scheduleReconnect(peerId, initiator);
        }
      }, ICE_TIMEOUT_MS);
      iceTimersRef.current.set(peerId, timer);

      pc.onicecandidate = (ev) => {
        if (ev.candidate && userIdRef.current) {
          channel.send({
            type: "broadcast", event: "signal",
            payload: { kind: "ice", from: userIdRef.current, to: peerId, candidate: ev.candidate.toJSON() } satisfies SignalMsg,
          });
        }
      };
      pc.ondatachannel = (ev) => wireDataChannel(peerId, ev.channel);
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed") {
          console.warn(`[P2P] Connection failed to peer ${peerId.slice(0, 8)}, will backoff-reconnect`);
          emitEvent(`Connection failed — ${peerId.slice(0, 8)}`);
          pc.close();
          removePeer(peerId);
          // Only reconnect if we were the initiator (avoid both sides triggering)
          if (initiator) scheduleReconnect(peerId, true);
        } else if (["closed", "disconnected"].includes(state)) {
          removePeer(peerId);
        }
      };

      if (initiator) {
        const dc = pc.createDataChannel("posts");
        wireDataChannel(peerId, dc);
        pc.createOffer().then((offer) => pc.setLocalDescription(offer).then(() => {
          if (!userIdRef.current) return;
          channel.send({
            type: "broadcast", event: "signal",
            payload: { kind: "offer", from: userIdRef.current, to: peerId, sdp: offer } satisfies SignalMsg,
          });
          emitEvent(`Sent offer to ${peerId.slice(0, 8)}`);
        }));
      }
      return pc;
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((id) => id !== userId);
        others.forEach((peerId) => {
          if (userId < peerId && !peersRef.current.has(peerId)) {
            createPeer(peerId, true);
          }
        });
      })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
        if (!userId || msg.to !== userId) return;

        if (!peersRef.current.has(msg.from) && peersRef.current.size >= MAX_ACTIVE_PEERS) {
          console.debug(`[P2P] Peer cap reached, ignoring incoming signal from ${msg.from.slice(0, 8)}`);
          return;
        }

        const pc = createPeer(msg.from, false);
        if (!pc) return;

        if (msg.kind === "offer") {
          await pc.setRemoteDescription(msg.sdp);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast", event: "signal",
            payload: { kind: "answer", from: userId, to: msg.from, sdp: answer } satisfies SignalMsg,
          });
          emitEvent(`Answered offer from ${msg.from.slice(0, 8)}`);
        } else if (msg.kind === "answer") {
          if (pc.signalingState !== "stable") await pc.setRemoteDescription(msg.sdp);
        } else if (msg.kind === "ice") {
          try { await pc.addIceCandidate(msg.candidate); } catch {/* ignore */}
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId, online_at: Date.now() });
          emitEvent("Joined P2P signaling channel");
        }
      });

    sendRef.current = (e: P2PEvent) => {
      const json = JSON.stringify(e);
      peersRef.current.forEach(({ dc }) => {
        if (dc?.readyState === "open") dc.send(json);
      });
    };

    sendDirectRef.current = (peerId: string, e: P2PEvent) => {
      const entry = peersRef.current.get(peerId);
      if (entry?.dc?.readyState === "open") {
        entry.dc.send(JSON.stringify(e));
        return true;
      }
      return false;
    };

    return () => {
      iceTimersRef.current.forEach((t) => clearTimeout(t));
      iceTimersRef.current.clear();
      backoffTimersRef.current.forEach((t) => clearTimeout(t));
      backoffTimersRef.current.clear();
      peersRef.current.forEach(({ pc }) => pc.close());
      peersRef.current.clear();
      setPeerCount(0);
      setConnectedPeers([]);
      setActiveChannels(0);
      supabase.removeChannel(channel);
      sendRef.current = () => {};
    };
  }, [userId]);

  return {
    peerCount,
    broadcast: (e: P2PEvent) => sendRef.current(e),
    sendDirect: (peerId: string, e: P2PEvent) => sendDirectRef.current(peerId, e),
    connectedPeers,
    // Lifecycle metrics (Item 4)
    activeChannels,
    reconnectAttempts,
    lastEvent,
    // Session log (last 100 events)
    sessionLog,
  };
}
