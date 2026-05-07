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
  const peersRef = useRef<Map<string, { pc: RTCPeerConnection; dc?: RTCDataChannel }>>(new Map());
  const iceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const sendRef = useRef<(e: P2PEvent) => void>(() => {});
  const sendDirectRef = useRef<(peerId: string, e: P2PEvent) => boolean>(() => false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("decentra-p2p", {
      config: { presence: { key: userId }, broadcast: { self: false } },
    });

    const updateCount = () => setPeerCount(peersRef.current.size);

    const clearIceTimer = (peerId: string) => {
      const t = iceTimersRef.current.get(peerId);
      if (t !== undefined) {
        clearTimeout(t);
        iceTimersRef.current.delete(peerId);
      }
    };

    const removePeer = (peerId: string) => {
      clearIceTimer(peerId);
      peersRef.current.delete(peerId);
      updateCount();
    };

    const wireDataChannel = (peerId: string, dc: RTCDataChannel) => {
      const entry = peersRef.current.get(peerId);
      if (entry) entry.dc = dc;
      dc.onopen = () => {
        // Connection fully established — cancel the ICE timeout
        clearIceTimer(peerId);
        updateCount();
      };
      dc.onclose = () => removePeer(peerId);
      dc.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as P2PEvent;
          onMessageRef.current(data, peerId);
        } catch {/* ignore malformed messages */}
      };
    };

    const createPeer = (peerId: string, initiator: boolean) => {
      // Deduplication guard — never create two connections to the same peer
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!.pc;

      // Hard cap — refuse connections beyond MAX_ACTIVE_PEERS
      if (peersRef.current.size >= MAX_ACTIVE_PEERS) {
        console.debug(`[P2P] Peer cap reached (${MAX_ACTIVE_PEERS}), ignoring peer ${peerId.slice(0, 8)}`);
        return null as unknown as RTCPeerConnection;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, { pc });

      // ICE timeout — destroy the connection if it doesn't reach "connected" in time
      const timer = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          console.warn(`[P2P] ICE timeout for peer ${peerId.slice(0, 8)}, destroying`);
          pc.close();
          removePeer(peerId);
        }
      }, ICE_TIMEOUT_MS);
      iceTimersRef.current.set(peerId, timer);

      pc.onicecandidate = (ev) => {
        if (ev.candidate && userId) {
          channel.send({
            type: "broadcast", event: "signal",
            payload: { kind: "ice", from: userId, to: peerId, candidate: ev.candidate.toJSON() } satisfies SignalMsg,
          });
        }
      };
      pc.ondatachannel = (ev) => wireDataChannel(peerId, ev.channel);
      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          removePeer(peerId);
        }
      };

      if (initiator) {
        const dc = pc.createDataChannel("posts");
        wireDataChannel(peerId, dc);
        pc.createOffer().then((offer) => pc.setLocalDescription(offer).then(() => {
          if (!userId) return;
          channel.send({
            type: "broadcast", event: "signal",
            payload: { kind: "offer", from: userId, to: peerId, sdp: offer } satisfies SignalMsg,
          });
        }));
      }
      return pc;
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((id) => id !== userId);
        // Initiate only to peers with greater id (deterministic, avoids duplicate offers)
        // Also respects MAX_ACTIVE_PEERS cap inside createPeer
        others.forEach((peerId) => {
          if (userId && userId < peerId && !peersRef.current.has(peerId)) {
            createPeer(peerId, true);
          }
        });
      })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
        if (!userId || msg.to !== userId) return;

        // Respect cap for incoming connections too
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
        } else if (msg.kind === "answer") {
          if (pc.signalingState !== "stable") await pc.setRemoteDescription(msg.sdp);
        } else if (msg.kind === "ice") {
          try { await pc.addIceCandidate(msg.candidate); } catch {/* ignore */}
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ userId, online_at: Date.now() });
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
      // Clear all ICE timers before closing connections
      iceTimersRef.current.forEach((t) => clearTimeout(t));
      iceTimersRef.current.clear();
      peersRef.current.forEach(({ pc }) => pc.close());
      peersRef.current.clear();
      supabase.removeChannel(channel);
      sendRef.current = () => {};
    };
  }, [userId]);

  return {
    peerCount,
    broadcast: (e: P2PEvent) => sendRef.current(e),
    sendDirect: (peerId: string, e: P2PEvent) => sendDirectRef.current(peerId, e),
    connectedPeers: Array.from(peersRef.current.keys()),
  };
}
