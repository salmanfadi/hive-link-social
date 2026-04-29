/**
 * P2P Service - WebRTC Peer-to-Peer Layer
 * 
 * Handles peer discovery and direct data sharing.
 * Provides fallback when IPFS is unavailable.
 */

export interface Peer {
  id: string;
  address: string;
  lastSeen: number;
}

export interface P2PMessage {
  type: "request" | "response" | "offer" | "answer" | "ice-candidate";
  payload: any;
  from: string;
  to?: string;
}

const PEER_STORAGE_KEY = "hivelink_peers";
const MAX_PEERS = 50;

/**
 * Generate a unique peer ID
 */
export function generatePeerId(): string {
  return `peer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get known peers from local storage
 */
export function getKnownPeers(): Peer[] {
  try {
    const stored = localStorage.getItem(PEER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn("Failed to load peers:", error);
  }
  return [];
}

/**
 * Add a peer to known peers list
 */
export function addPeer(peer: Peer): void {
  try {
    const peers = getKnownPeers();
    
    // Check if peer already exists
    const existingIndex = peers.findIndex(p => p.id === peer.id);
    if (existingIndex >= 0) {
      peers[existingIndex] = { ...peer, lastSeen: Date.now() };
    } else {
      peers.push({ ...peer, lastSeen: Date.now() });
    }
    
    // Keep only recent peers
    const recentPeers = peers
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_PEERS);
    
    localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(recentPeers));
  } catch (error) {
    console.warn("Failed to add peer:", error);
  }
}

/**
 * Remove a peer from known peers
 */
export function removePeer(peerId: string): void {
  try {
    const peers = getKnownPeers().filter(p => p.id !== peerId);
    localStorage.setItem(PEER_STORAGE_KEY, JSON.stringify(peers));
  } catch (error) {
    console.warn("Failed to remove peer:", error);
  }
}

/**
 * Get peers active within the last hour
 */
export function getActivePeers(): Peer[] {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return getKnownPeers().filter(p => p.lastSeen > oneHourAgo);
}

/**
 * WebRTC Connection Manager
 * Note: Full WebRTC implementation requires signaling server
 * This is a simplified local-only version
 */

interface RTCConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
}

let rtcConnections: Map<string, RTCConnection> = new Map();

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

/**
 * Create a WebRTC peer connection
 */
export async function createPeerConnection(peerId: string): Promise<RTCDataChannel | null> {
  try {
    const connection = new RTCPeerConnection(RTC_CONFIG);
    
    const rtcConn: RTCConnection = {
      peerId,
      connection,
      dataChannel: null,
    };

    // Create data channel
    const dataChannel = connection.createDataChannel("hivelink-data");
    rtcConn.dataChannel = dataChannel;

    // Handle incoming data channels
    connection.ondatachannel = (event) => {
      rtcConn.dataChannel = event.channel;
      setupDataChannel(event.channel, peerId);
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        // In production, send candidate to signaling server
        console.log("ICE candidate:", event.candidate);
      }
    };

    rtcConnections.set(peerId, rtcConn);
    return dataChannel;
  } catch (error) {
    console.error("Failed to create peer connection:", error);
    return null;
  }
}

/**
 * Set up data channel handlers
 */
function setupDataChannel(channel: RTCDataChannel, peerId: string): void {
  channel.onopen = () => {
    console.log(`Data channel open with peer ${peerId}`);
  };

  channel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as P2PMessage;
      handleP2PMessage(message);
    } catch (error) {
      console.warn("Failed to parse P2P message:", error);
    }
  };

  channel.onclose = () => {
    console.log(`Data channel closed with peer ${peerId}`);
  };
}

/**
 * Handle incoming P2P messages
 */
function handleP2PMessage(message: P2PMessage): void {
  // Dispatch custom event for UI to handle
  window.dispatchEvent(new CustomEvent("hivelink-p2p-message", {
    detail: message,
  }));
}

/**
 * Send a message to a peer
 */
export async function sendToPeer(peerId: string, message: P2PMessage): Promise<boolean> {
  const rtcConn = rtcConnections.get(peerId);
  
  if (!rtcConn?.dataChannel || rtcConn.dataChannel.readyState !== "open") {
    console.warn(`Cannot send to peer ${peerId}: channel not open`);
    return false;
  }

  try {
    rtcConn.dataChannel.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("Failed to send P2P message:", error);
    return false;
  }
}

/**
 * Close a peer connection
 */
export function closePeerConnection(peerId: string): void {
  const rtcConn = rtcConnections.get(peerId);
  if (rtcConn) {
    rtcConn.dataChannel?.close();
    rtcConn.connection.close();
    rtcConnections.delete(peerId);
  }
}

/**
 * Close all peer connections
 */
export function closeAllConnections(): void {
  rtcConnections.forEach((_, peerId) => {
    closePeerConnection(peerId);
  });
}

/**
 * Request content from peers (fallback when IPFS fails)
 */
export async function requestFromPeers(
  contentHash: string,
  timeout: number = 5000
): Promise<Blob | null> {
  const activePeers = getActivePeers();
  
  if (activePeers.length === 0) {
    return null;
  }

  const message: P2PMessage = {
    type: "request",
    payload: { contentHash },
    from: generatePeerId(),
  };

  // Send to all active peers and wait for first response
  const promises = activePeers.map(peer => 
    sendToPeer(peer.id, message)
  );

  await Promise.all(promises);

  // In production, would wait for response with timeout
  // For now, return null as signaling server is needed
  return null;
}

/**
 * Check if P2P is available (has active peers)
 */
export function isP2PAvailable(): boolean {
  return getActivePeers().length > 0;
}