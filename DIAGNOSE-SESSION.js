// Diagnostic: Session Storage Debug
// Run this in browser console to diagnose session issues

function diagnoseSessionStorage() {
  console.log("=== Session Storage Diagnostic ===\n");
  
  // Check localStorage for session tokens
  console.log("📦 localStorage keys:");
  Object.keys(localStorage).forEach(key => {
    if (key.includes('sb-') || key.includes('auth') || key.includes('supabase')) {
      const value = localStorage.getItem(key);
      const preview = value?.substring(0, 50) + '...';
      console.log(`  ${key}: ${preview}`);
    }
  });
  
  // Check if Supabase client exists
  console.log("\n🔧 Supabase SDK:");
  if (window.supabase) {
    console.log("  ✓ window.supabase exists");
  } else {
    console.log("  ✗ window.supabase NOT found");
  }
  
  // Check auth state
  if (window.supabase?.auth) {
    window.supabase.auth.getSession().then(({ data, error }) => {
      console.log("\n👤 Auth State:");
      if (error) {
        console.log("  ✗ Error:", error.message);
      }
      if (data?.session) {
        console.log("  ✓ Session found");
        console.log("    User:", data.session.user.email);
        console.log("    Access Token:", data.session.access_token.substring(0, 20) + "...");
      } else {
        console.log("  ✗ No session");
      }
    });
  }
}

// Run it
diagnoseSessionStorage();
