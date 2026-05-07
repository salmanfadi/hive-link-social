/**
 * WebRTC P2P Sync — uses Supabase Realtime as signaling channel.
 *
 * Each authenticated user joins a "decentra-p2p" presence channel and
 * advertises their userId. Peers establish RTCPeerConnections via
 * offer/answer/ICE messages broadcast over the channel. Once connected,
 * new posts are pushed directly through RTCDataChannel — bypassing the
 * server for live propagation.
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

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useP2PSync(
  userId: string | null,
  onMessage: (e: P2PEvent, fromPeer: string) => void,
) {
  const [peerCount, setPeerCount] = useState(0);
  const peersRef = useRef<Map<string, { pc: RTCPeerConnection; dc?: RTCDataChannel }>>(new Map());
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

    const wireDataChannel = (peerId: string, dc: RTCDataChannel) => {
      const entry = peersRef.current.get(peerId);
      if (entry) entry.dc = dc;
      dc.onopen = updateCount;
      dc.onclose = () => {
        peersRef.current.delete(peerId);
        updateCount();
      };
      dc.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as P2PEvent;
          onMessageRef.current(data, peerId);
        } catch {/* ignore */}
      };
    };

    const createPeer = (peerId: string, initiator: boolean) => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!.pc;
      const pc = new RTCPeerConnection(RTC_CONFIG);
      peersRef.current.set(peerId, { pc });

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
          peersRef.current.delete(peerId);
          updateCount();
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
        // initiate connection to peers with greater id (deterministic, avoids duplicate offers)
        others.forEach((peerId) => {
          if (userId && userId < peerId && !peersRef.current.has(peerId)) {
            createPeer(peerId, true);
          }
        });
      })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
        if (!userId || msg.to !== userId) return;
        const pc = createPeer(msg.from, false);
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
