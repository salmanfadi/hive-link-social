# PENDING — Decentra

## ✅ Implemented

### Core
- Email/password auth + forgot password / reset flow
- DID + public key per profile
- Posts: create, like, **repost**, comment, delete (RLS-protected)
- Cryptographic post signing (Ed25519 via Web Crypto, verified in-browser)
- Media uploads → Supabase Storage **and** IPFS pinning via Pinata
- Communities (servers): create, join, leave, member counts, rule up/down votes
- Profiles: edit, avatar upload, identity export/import (JSON)
- MetaMask wallet linking
- Hashtags (`#tag` extraction + clickable trending pages)
- Direct encrypted messages over WebRTC

### Decentralized layer
- WebRTC P2P sync (Supabase Realtime presence as signaling)
- **Public TURN fallback** for strict NATs (openrelay.metered.ca)
- IPFS content addressing for every uploaded media file
- Local feed cache (offline fallback)

### Social
- Follow / unfollow + follower/following counts
- Realtime notifications (likes, comments, follows, **reposts**) with unread badge
- Search for people and communities
- **Following feed** tab

### UX
- **Dark / light theme toggle** (system default respected, choice persisted)
- Mobile-responsive bottom navigation
- Sticky headers with backdrop blur

## 🚧 Pending

### High priority
- [ ] **Server moderation tools** — admin panel for removing posts, banning members, editing rules
- [ ] **Quote-post** (repost with added commentary)
- [ ] **Push notifications** (web push) for offline notification delivery
- [ ] **Federated server discovery** — opt-in cross-instance directory (ActivityPub-style)

### Nice to have
- [ ] **On-chain identity anchoring** — write DID hash to an EVM contract
- [ ] **NFT avatars** — verify wallet-owned NFTs and display them
- [ ] **Token-gated communities** — require holding a token to join
- [ ] **End-to-end encrypted media** uploaded through IPFS
- [ ] **Multi-language / i18n**
- [ ] **Accessibility audit** (keyboard nav, focus traps in dialogs, ARIA labels)
- [ ] **PWA install + service worker** for full offline mode
- [ ] **Analytics + admin dashboard**

### Infra / DX
- [ ] Migrate `media` storage bucket to private + signed URLs (currently public; linter warning is the only remaining one)
- [ ] E2E test suite (Playwright) for auth + post + follow flows
- [ ] Rate limiting on posts / comments / follows
- [ ] Move IPFS pinning off Pinata onto a self-hosted IPFS node
- [ ] Self-hosted TURN servers (current public TURN is best-effort, low capacity)
