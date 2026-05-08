/**
 * Integration test: Feed flow — create post → load feed → quoted post → comments
 *
 * Run with:  npx tsx src/__tests__/feed-flow.test.ts
 *
 * Uses the real Supabase project via VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
 * from the .env file. Requires an existing test user (set TEST_EMAIL / TEST_PASSWORD).
 *
 * The test:
 *   1. Signs in with the test account
 *   2. Creates a text post
 *   3. Creates a quote-post referencing the first post
 *   4. Adds a comment to the first post
 *   5. Loads the global feed and verifies all three items are present
 *   6. Cleans up (deletes the test posts and comment)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Load .env manually (tsx doesn't auto-load dotenv) ────────────────────
function loadDotenv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    console.warn("[test] .env not found — relying on shell environment variables");
  }
}
loadDotenv();

// ─── Helpers ──────────────────────────────────────────────────────────────
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}
function assertExists<T>(val: T | null | undefined, message: string): T {
  assert(val !== null && val !== undefined, message);
  return val as T;
}

// ─── Config ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const TEST_EMAIL   = process.env.TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
  process.exit(1);
}
if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error("ERROR: TEST_EMAIL and TEST_PASSWORD must be set (test Supabase user)");
  process.exit(1);
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function run() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Sign in
  console.log(`[1] Signing in as ${TEST_EMAIL}…`);
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  assert(!authError, `Sign-in failed: ${authError?.message}`);
  const userId = assertExists(authData.user?.id, "User ID missing after sign-in");
  console.log(`    ✓ Signed in (uid: ${userId.slice(0, 8)}…)`);

  let postId: string | null = null;
  let quotePostId: string | null = null;
  let commentId: string | null = null;

  try {
    // 2. Create a text post
    console.log("[2] Creating test post…");
    const caption = `[feed-flow-test] post ${Date.now()}`;
    const { data: post, error: postErr } = await sb.from("posts")
      .insert({ user_id: userId, caption, created_at: new Date().toISOString() })
      .select("id, caption, user_id")
      .single();
    assert(!postErr, `Post insert failed: ${postErr?.message}`);
    postId = assertExists(post?.id, "Post ID missing");
    assert(post.caption === caption, "Post caption mismatch");
    console.log(`    ✓ Post created (${postId!.slice(0, 8)}…)`);

    // 3. Create a quote-post
    console.log("[3] Creating quote-post…");
    const { data: quotePost, error: quoteErr } = await sb.from("posts")
      .insert({
        user_id: userId,
        caption: `[feed-flow-test] quote ${Date.now()}`,
        quoted_post_id: postId,
        created_at: new Date().toISOString(),
      })
      .select("id, quoted_post_id")
      .single();
    assert(!quoteErr, `Quote-post insert failed: ${quoteErr?.message}`);
    quotePostId = assertExists(quotePost?.id, "Quote-post ID missing");
    assert(quotePost.quoted_post_id === postId, "quoted_post_id mismatch");
    console.log(`    ✓ Quote-post created (${quotePostId!.slice(0, 8)}…), references post ✓`);

    // 4. Add a comment to the original post
    console.log("[4] Adding comment…");
    const { data: comment, error: commentErr } = await sb.from("comments")
      .insert({ post_id: postId, user_id: userId, content: "Integration test comment" })
      .select("id, content, post_id")
      .single();
    assert(!commentErr, `Comment insert failed: ${commentErr?.message}`);
    commentId = assertExists(comment?.id, "Comment ID missing");
    assert(comment.post_id === postId, "Comment post_id mismatch");
    console.log(`    ✓ Comment created (${commentId!.slice(0, 8)}…)`);

    // 5. Load the global feed and verify items
    console.log("[5] Loading global feed…");
    const { data: feed, error: feedErr } = await sb.from("posts")
      .select("id, caption, quoted_post_id, profiles!posts_user_id_fkey(username)")
      .order("created_at", { ascending: false })
      .limit(50);
    assert(!feedErr, `Feed load failed: ${feedErr?.message}`);
    assertExists(feed, "Feed data missing");

    const feedIds = feed.map((p: any) => p.id);
    assert(feedIds.includes(postId), "Original post not found in feed");
    assert(feedIds.includes(quotePostId), "Quote-post not found in feed");
    console.log(`    ✓ Both posts found in feed (${feed.length} total posts loaded)`);

    // Verify quoted_post_id relationship in feed data
    const quoteFeedEntry = feed.find((p: any) => p.id === quotePostId);
    assert(quoteFeedEntry?.quoted_post_id === postId, "Feed: quoted_post_id relationship not present");
    console.log("    ✓ quoted_post_id relationship intact in feed data");

    // Verify comments load
    console.log("[6] Loading comments for original post…");
    const { data: comments, error: commentsErr } = await sb.from("comments")
      .select("id, content, profiles!comments_user_id_fkey(username)")
      .eq("post_id", postId);
    assert(!commentsErr, `Comments load failed: ${commentsErr?.message}`);
    assertExists(comments, "Comments data missing");
    const testComment = comments.find((c: any) => c.id === commentId);
    assertExists(testComment, "Test comment not found in comments list");
    assert((testComment as any).content === "Integration test comment", "Comment content mismatch");
    console.log(`    ✓ Comment loaded correctly with FK join (${comments.length} comment(s))`);

    console.log("\n✅ All feed-flow integration tests passed!\n");
  } finally {
    // 7. Cleanup
    console.log("[cleanup] Removing test data…");
    if (commentId) await sb.from("comments").delete().eq("id", commentId);
    if (quotePostId) await sb.from("posts").delete().eq("id", quotePostId);
    if (postId) await sb.from("posts").delete().eq("id", postId);
    await sb.auth.signOut();
    console.log("    ✓ Cleanup complete");
  }
}

run().catch((e) => {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
});
