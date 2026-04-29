/**
 * Offline & Sync Service
 * 
 * Handles local storage caching and synchronization when back online.
 * Provides offline-first experience for the app.
 */

import { getCachedFeed, cacheFeed } from "@/lib/cache";

export interface SyncQueueItem {
  id: string;
  type: "post" | "like" | "follow" | "server_join" | "server_leave";
  action: "create" | "update" | "delete";
  payload: any;
  timestamp: number;
  retries: number;
}

export interface OfflineState {
  isOnline: boolean;
  lastSyncTime: number | null;
  pendingSyncItems: number;
}

const SYNC_QUEUE_KEY = "hivelink_sync_queue";
const OFFLINE_STATE_KEY = "hivelink_offline_state";
const MAX_SYNC_RETRIES = 3;

/**
 * Check if the app is currently online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get current offline state
 */
export function getOfflineState(): OfflineState {
  const pendingItems = getSyncQueue();
  
  return {
    isOnline: isOnline(),
    lastSyncTime: getLastSyncTime(),
    pendingSyncItems: pendingItems.length,
  };
}

/**
 * Get the sync queue
 */
export function getSyncQueue(): SyncQueueItem[] {
  try {
    const stored = localStorage.getItem(SYNC_QUEUE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn("Failed to load sync queue:", error);
  }
  return [];
}

/**
 * Add an item to the sync queue
 */
export function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">): void {
  const queue = getSyncQueue();
  
  const newItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retries: 0,
  };
  
  queue.push(newItem);
  
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    updateOfflineState();
  } catch (error) {
    console.warn("Failed to add to sync queue:", error);
  }
}

/**
 * Remove an item from the sync queue
 */
export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue().filter(item => item.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  updateOfflineState();
}

/**
 * Process the sync queue
 */
export async function processSyncQueue(supabaseClient: any): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const queue = getSyncQueue();
  const results = { success: 0, failed: 0, errors: [] as string[] };
  
  for (const item of queue) {
    if (item.retries >= MAX_SYNC_RETRIES) {
      results.failed++;
      results.errors.push(`Item ${item.id} exceeded max retries`);
      continue;
    }
    
    try {
      await processSyncItem(supabaseClient, item);
      removeFromSyncQueue(item.id);
      results.success++;
    } catch (error: any) {
      // Increment retry count
      item.retries++;
      if (item.retries >= MAX_SYNC_RETRIES) {
        results.failed++;
        results.errors.push(`Item ${item.id} failed: ${error.message}`);
      }
    }
  }
  
  // Update queue with remaining items
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  updateOfflineState();
  
  return results;
}

/**
 * Process a single sync item
 */
async function processSyncItem(supabase: any, item: SyncQueueItem): Promise<void> {
  switch (item.type) {
    case "post":
      if (item.action === "create") {
        await supabase.from("posts").insert(item.payload);
      } else if (item.action === "delete") {
        await supabase.from("posts").delete().eq("id", item.payload.id);
      }
      break;
      
    case "like":
      if (item.action === "create") {
        await supabase.from("post_likes").insert(item.payload);
      } else if (item.action === "delete") {
        await supabase.from("post_likes").delete().eq("post_id", item.payload.post_id).eq("user_id", item.payload.user_id);
      }
      break;
      
    case "server_join":
      await supabase.from("server_members").insert(item.payload);
      break;
      
    case "server_leave":
      await supabase.from("server_members").delete().eq("server_id", item.payload.server_id).eq("user_id", item.payload.user_id);
      break;
      
    default:
      console.warn("Unknown sync item type:", item.type);
  }
}

/**
 * Get last sync time
 */
function getLastSyncTime(): number | null {
  try {
    const state = localStorage.getItem(OFFLINE_STATE_KEY);
    if (state) {
      return JSON.parse(state).lastSyncTime;
    }
  } catch (error) {
    console.warn("Failed to get last sync time:", error);
  }
  return null;
}

/**
 * Update offline state
 */
function updateOfflineState(): void {
  const state: OfflineState = {
    isOnline: isOnline(),
    lastSyncTime: getLastSyncTime(),
    pendingSyncItems: getSyncQueue().length,
  };
  localStorage.setItem(OFFLINE_STATE_KEY, JSON.stringify(state));
}

/**
 * Set up online/offline listeners
 */
export function setupOfflineListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  const handleOnline = () => {
    updateOfflineState();
    onOnline();
  };
  
  const handleOffline = () => {
    updateOfflineState();
    onOffline();
  };
  
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  
  // Initial state
  updateOfflineState();
  
  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}

/**
 * Cache posts for offline viewing
 */
export function cachePostsForOffline(posts: any[]): void {
  try {
    const offlinePosts = posts.map(post => ({
      ...post,
      _cachedAt: Date.now(),
    }));
    
    localStorage.setItem("hivelink_offline_posts", JSON.stringify(offlinePosts));
  } catch (error) {
    console.warn("Failed to cache posts:", error);
  }
}

/**
 * Get cached offline posts
 */
export function getOfflinePosts(): any[] {
  try {
    const stored = localStorage.getItem("hivelink_offline_posts");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn("Failed to get offline posts:", error);
  }
  return [];
}

/**
 * Clear old cached data
 */
export function clearOldCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
  const cutoff = Date.now() - maxAge;
  
  try {
    // Clear old posts
    const posts = getOfflinePosts();
    const recentPosts = posts.filter(p => p._cachedAt > cutoff);
    localStorage.setItem("hivelink_offline_posts", JSON.stringify(recentPosts));
    
    // Clear old sync queue items
    const queue = getSyncQueue();
    const recentQueue = queue.filter(item => item.timestamp > cutoff);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(recentQueue));
    
    updateOfflineState();
  } catch (error) {
    console.warn("Failed to clear old cache:", error);
  }
}

/**
 * Show offline indicator in UI
 */
export function useOfflineStatus(): {
  isOnline: boolean;
  pendingItems: number;
  lastSync: string | null;
} {
  const [state, setState] = useState<OfflineState>(getOfflineState());
  
  useEffect(() => {
    const cleanup = setupOfflineListeners(
      () => setState(getOfflineState()),
      () => setState(getOfflineState())
    );
    
    // Update periodically
    const interval = setInterval(() => {
      setState(getOfflineState());
    }, 5000);
    
    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, []);
  
  return {
    isOnline: state.isOnline,
    pendingItems: state.pendingSyncItems,
    lastSync: state.lastSyncTime 
      ? new Date(state.lastSyncTime).toLocaleString() 
      : null,
  };
}

// Need to import useState for the hook
import { useState, useEffect } from "react";