#!/usr/bin/env node

/**
 * Session Diagnostic - Run this in browser console to debug session issues
 */

async function diagnoseSession() {
  console.log("\n====== SESSION DIAGNOSTIC ======\n");

  // 1. Check localStorage
  console.log("📦 LOCALSTORAGE CHECK:");
  const authKeys = Object.keys(localStorage).filter(k => k.includes('sb-') || k.includes('auth') || k.includes('supabase'));
  if (authKeys.length === 0) {
    console.log("  ⚠️  No Supabase session keys found in localStorage");
  } else {
    authKeys.forEach(key => {
      const value = localStorage.getItem(key);
      const preview = value?.substring(0, 100) + (value?.length > 100 ? '...' : '');
      console.log(`  ✓ ${key}`);
      console.log(`    Value: ${preview}`);
    });
  }

  // 2. Check if Supabase is loaded
  console.log("\n🔧 SUPABASE SDK CHECK:");
  if (!window.supabase) {
    console.log("  ✗ window.supabase NOT found - SDK not loaded");
    return;
  }
  console.log("  ✓ window.supabase is available");

  // 3. Try to get current session
  console.log("\n👤 CURRENT SESSION:");
  try {
    const { data, error } = await window.supabase.auth.getSession();
    if (error) {
      console.log("  ✗ Error getting session:", error.message);
    } else if (data?.session) {
      console.log("  ✓ Session found!");
      console.log("    User:", data.session.user.email);
      console.log("    Expires at:", new Date(data.session.expires_at * 1000));
      console.log("    Access token preview:", data.session.access_token.substring(0, 30) + "...");
    } else {
      console.log("  ✗ No session found");
    }
  } catch (err) {
    console.log("  ✗ Exception:", err.message);
  }

  // 4. Check user
  console.log("\n👤 CURRENT USER:");
  try {
    const { data: { user }, error } = await window.supabase.auth.getUser();
    if (error) {
      console.log("  ✗ Error:", error.message);
    } else if (user) {
      console.log("  ✓ User found:", user.email);
    } else {
      console.log("  ✗ No user found");
    }
  } catch (err) {
    console.log("  ✗ Exception:", err.message);
  }

  // 5. Watch auth state changes
  console.log("\n👁️  WATCHING AUTH STATE CHANGES (next 5 seconds):");
  const subscription = window.supabase.auth.onAuthStateChange((event, session) => {
    console.log(`  → Auth event: "${event}"`);
    if (session) {
      console.log(`    Session: ${session.user.email}`);
    } else {
      console.log(`    Session: null`);
    }
  });

  // Cleanup after 5 seconds
  setTimeout(() => {
    subscription.data.subscription.unsubscribe();
    console.log("\n✅ Diagnostic complete!\n");
  }, 5000);
}

// Run the diagnostic
diagnoseSession();
