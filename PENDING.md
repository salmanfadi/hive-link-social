# PENDING — Decentra

## ✅ Implemented

### Core
- Email/password auth + forgot password / reset flow
- DID + public key per profile
- Posts: create, like, repost, **quote-post**, comment, delete (RLS-protected)
- Cryptographic post signing (Ed25519, verified in-browser)
- Media uploads → Supabase Storage **and** IPFS pinning via Pinata
- Communities (servers): create, join, leave, member counts, rule up/down votes
- Profiles: edit, avatar upload, identity export/import (JSON)
- MetaMask wallet linking
- Hashtags (`#tag` extraction + clickable trending pages)
- Direct encrypted messages over WebRTC

### Decentralized layer
- WebRTC P2P sync (Supabase Realtime presence as signaling)
- Public TURN fallback for strict NATs (openrelay.metered.ca)
- IPFS content addressing for every uploaded media file
- Local feed cache (offline fallback)

### Social
- Follow / unfollow + follower/following counts
- Realtime notifications (likes, comments, follows, reposts) with unread badge
- Search for people and communities
- Following feed tab

### Moderation
- **Community admin panel** — edit name/description/rules, ban/unban members
- Banned users blocked from rejoining or posting (DB-enforced via trigger)
- Admin can pull a post out of a community

### UX
- Dark / light theme toggle (system default respected, choice persisted)
- Mobile-responsive bottom navigation
- **PWA install + service worker** (manifest + app-shell cache for offline)
- Sticky headers with backdrop blur

## 🚧 Pending

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
- [ ] Migrate `media` storage bucket to private + signed URLs (linter warning)
- [ ] E2E test suite (Playwright) for auth + post + follow flows
- [ ] Rate limiting on posts / comments / follows
- [ ] Move IPFS pinning off Pinata onto a self-hosted IPFS node
- [ ] Self-hosted TURN servers (current public TURN is best-effort)
