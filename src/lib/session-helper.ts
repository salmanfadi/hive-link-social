// Session Recovery Helper
// This helps ensure Supabase has restored the session from localStorage
// before we try to access it

import { supabase } from "@/integrations/supabase/client";

/**
 * Waits for Supabase auth to be ready and session to be restored from localStorage
 * This is crucial because after a page load, the SDK needs time to read localStorage
 */
export async function waitForSessionReady(timeoutMs = 3000): Promise<boolean> {
  console.log("[SessionHelper] Waiting for Supabase auth to be ready...");
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    let resolved = false;

    // Set up a listener for auth state changes
    // This fires when the SDK loads a session from localStorage
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      const elapsed = Date.now() - startTime;
      console.log(`[SessionHelper] Auth event: ${event} (${elapsed}ms)`);
      
      if (session && !resolved) {
        console.log("[SessionHelper] ✓ Session restored from auth state change");
        resolved = true;
        subscription.data.subscription.unsubscribe();
        resolve(true);
      }
    });

    // Also try immediate check
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session && !resolved) {
        console.log("[SessionHelper] ✓ Session found immediately");
        resolved = true;
        subscription.data.subscription.unsubscribe();
        resolve(true);
      }
    });

    // Timeout after specified milliseconds
    setTimeout(() => {
      if (!resolved) {
        console.warn(`[SessionHelper] ⚠ Timeout after ${timeoutMs}ms`);
        subscription.data.subscription.unsubscribe();
        resolve(false);
      }
    }, timeoutMs);
  });
}

/**
 * Get session with retries
 */
export async function getSessionWithRetry(maxRetries = 5): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log(`[SessionHelper] ✓ Session found on attempt ${i + 1}`);
      return session;
    }
    
    if (i < maxRetries - 1) {
      const delay = 100 * (i + 1); // 100ms, 200ms, 300ms, etc
      console.log(`[SessionHelper] Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.log(`[SessionHelper] ✗ No session found after ${maxRetries} attempts`);
  return null;
}
