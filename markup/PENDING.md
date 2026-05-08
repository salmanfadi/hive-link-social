# PENDING — Decentra

## ✅ Implemented

### Core
- Email/password auth + forgot password / reset flow
- DID + public key per profile (Ed25519, Web Crypto API)
- Posts: create, like, repost, quote-post, comment, delete (RLS-protected)
- Cryptographic post signing (Ed25519, verified in-browser per post)
- Media uploads → Supabase Storage **and** IPFS pinning via Pinata (server-side JWT, no secret exposure)
- Communities (servers): create, join, leave, member counts, rule up/down votes
- Profiles: edit, avatar upload, identity export/import (JSON)
- MetaMask wallet linking (optional, post-signup)
- Hashtags (`#tag` extraction + clickable trending pages)
- Direct messages over WebRTC data channels

### Decentralized layer
- WebRTC P2P sync (Supabase Realtime presence as signaling channel)
- Public TURN fallback for strict NATs (openrelay.metered.ca)
- IPFS content addressing (CID stored per post, served via Pinata gateway)
- Local feed cache (offline fallback via `lib/cache.ts`)

### Social
- Follow / unfollow + follower/following counts
- Realtime notifications (likes, comments, follows, reposts) with unread badge
- Search for people and communities
- Following feed tab (separate from Global feed)
- Quote post (reference another post in a new post)

### Moderation
- Community admin panel — edit name/description/rules, ban/unban members
- Banned users blocked from rejoining or posting (DB-enforced via trigger)
- Admin can remove a post from their community

### UX
- Dark / light theme toggle (system default respected, choice persisted)
- Mobile-responsive bottom navigation
- PWA install + service worker (manifest + app-shell cache for offline)
- Sticky headers with backdrop blur

---

## 🔥 Architecture Stabilization (In Progress)

These are the bugs found in the current codebase that must be fixed before adding any new features.

### Phase 1 — P2P Layer (Priority: CRITICAL — fixes login freeze)
- [x] **`use-p2p-sync.ts`** — Add `MAX_ACTIVE_PEERS = 5` cap + 10-second ICE timeout per peer connection
- [x] **`p2p-context.tsx`** — Add 5-second delayed initialization after mount (P2P must not start during auth/first render)
- [x] **`__root.tsx`** — Mount `<P2PProvider>` once under `<AuthProvider>` to prevent per-route remount storms
- [x] **`Layout.tsx` + `p2p-context.tsx`** — `Layout` now consumes P2P context only; provider value memoized to reduce cascade rerenders

### Phase 2 — Crypto/Identity Layer (Priority: HIGH — post signing is broken for new users)
- [x] **`auth-context.tsx` `loadKeys()`** — Fixed: `importPublicKey()` now gracefully handles the DB placeholder key; generates a real Ed25519 pair on first login and pushes real public key to DB

### Phase 3 — Storage / IPFS Layer (Priority: MEDIUM — media fallback doesn't work)
- [x] **`PostCard.tsx`** — Implemented full fallback chain: Supabase CDN → IPFS gateway (with "via IPFS" badge) → static error state
- [x] **`services/ipfs.ts`** — Removed dead `uploadToIPFS()` with `VITE_PINATA_JWT` client-side reference; simplified to gateway URL utilities only

### Phase 4 — Documentation
- [x] **`PENDING.md`** — Updated

---

## 🚨 Immediate Pending (New)

### Security
- [ ] **Rotate Pinata JWT immediately** (token was shared in chat). Treat current JWT as compromised.
- [ ] Store Pinata JWT only in server env vars (never client, never committed files, never chat logs).
- [x] Add a startup health check for missing/invalid/expired Pinata token in `pinata.functions.ts`.

### Supabase query stability
- [x] Replaced ambiguous embeds (`profiles!inner(...)`) with explicit FK joins:
  - `profiles!posts_user_id_fkey(...)`
  - `profiles!comments_user_id_fkey(...)`
  - `profiles!server_members_user_id_fkey(...)`
- [x] Add a tiny shared query helper/constants for post/profile selects so FK names are not duplicated across routes.
- [ ] Add integration test for "create post + load feed + quoted post + comments" to catch relationship regressions.

### Wallet / MetaMask
- [x] Wallet connect now resolves MetaMask from `window.ethereum.providers` and waits for delayed injection (`ethereum#initialized`).
- [ ] Add support for EIP-6963 provider discovery events for multi-wallet browsers.
- [ ] Add chain/network validation in wallet connect flow (e.g., require specific chain IDs and show switch UI).

### P2P reliability
- [ ] Add channel lifecycle metrics (active channels, peer count, reconnect attempts) to detect subscription storms early.
- [ ] Persist a lightweight peer session log (last 100 events) for freeze debugging.
- [ ] Backoff reconnect strategy for failed ICE connections to avoid repeated storms on unstable networks.
- [ ] Move TURN credentials to env-backed self-hosted TURN before production.

### Upload pipeline (Supabase + IPFS)
- [ ] Track and store upload statuses per post (`supabase_uploaded`, `ipfs_pinned`, `ipfs_failed_reason`).
- [ ] Add retry queue for failed Pinata pin operations instead of generating synthetic fallback hashes.
- [ ] Surface partial-success UI: "Posted to Supabase; IPFS pin pending/retrying".

---

## 🚧 Feature Backlog

### Nice to have
- [ ] **Push notifications** (Web Push API + VAPID) for offline notification delivery
- [ ] **Federated server discovery** — opt-in cross-instance directory (ActivityPub-style)
- [ ] **On-chain identity anchoring** — write DID hash to an EVM contract
- [ ] **NFT avatars** — verify wallet-owned NFTs and display them
- [ ] **Token-gated communities** — require holding a token to join
- [ ] **End-to-end encrypted media** uploaded through IPFS
- [ ] **Multi-language / i18n**
- [ ] **Accessibility audit** (keyboard nav, focus traps in dialogs, ARIA labels)
- [ ] **Analytics + admin dashboard**

### Infra / DX
- [ ] Migrate `media` storage bucket to private + signed URLs (linter warning in Supabase advisors)
- [ ] E2E test suite (Playwright) for auth + post + follow flows
- [ ] Rate limiting on posts / comments / follows (Supabase Edge Function or DB trigger)
- [ ] Move IPFS pinning off Pinata onto a self-hosted IPFS node
- [ ] Self-hosted TURN servers (current public TURN is best-effort, not for production)
- [ ] P2P `use-p2p-sync.ts` — replace public openrelay TURN credentials with self-hosted TURN

---

## Architecture Decision Log

| Decision | Rationale |
|----------|-----------|
| Email/password as primary auth | Easy onboarding, account recovery. MetaMask is optional linking only. |
| Supabase Storage as primary media CDN | Fast, low-latency, reliable. IPFS is the decentralized backup, not primary. |
| IPFS via Pinata (server-side JWT) | JWT never exposed to client; server function (`pinata.functions.ts`) handles upload. |
| Ed25519 via Web Crypto API | Native browser support, no dependency. Keys generated client-side only. |
| P2P over Supabase Realtime signaling | No dedicated signaling server needed. Presence channel acts as peer discovery. |
| P2P initialized 5s after app load | Auth and first render must be unblocked. P2P is an enhancement, not a dependency. |
| MAX_ACTIVE_PEERS = 5 | Prevents ICE negotiation storm on busy presence channels. |
