# PENDING — Decentra

Tracking what's done vs. what's still on the roadmap for the decentralized
social app.

## ✅ Implemented

### Core
- Email/password auth (Supabase) with onAuthStateChange + profile auto-creation trigger
- Forgot password + `/reset-password` page
- DID + public key generated per profile
- Posts: create, like, comment, delete (RLS-protected)
- Media uploads to Supabase Storage **and** real IPFS pinning via Pinata
- Communities (servers): create, join, leave, member counts, rule up/down votes
- User profiles: edit, avatar upload, identity export/import (JSON)
- MetaMask wallet linking (`wallet_address` on profile)
- **Following feed** — separate `/following` tab showing only posts from users you follow
- **Hashtags** — extracted `#tags` from captions, clickable to trending tag pages
- **Cryptographic post signing** — posts are signed with client-side Ed25519 keys and verified in-browser
- **Direct messages** — encrypted 1:1 chat over direct WebRTC channels

### Decentralized layer
- **WebRTC P2P sync** — peers discover each other via Supabase Realtime presence,
  establish RTCDataChannels, and relay new posts directly between browsers
- **IPFS content addressing** via Pinata for every uploaded media file
- Local feed cache (offline fallback)

### Social
- **Follow / unfollow** users (with follower & following counts)
- **Notifications** (likes, comments, follows) with realtime updates and
  unread badge in nav
- **Search** for people and communities

## 🚧 Pending

### High priority
- [ ] **Federated server discovery** — opt-in directory + cross-instance
      following (ActivityPub-style)
- [ ] **TURN servers** for P2P connectivity behind strict NATs (currently
      only STUN, fails on some networks)

### Medium priority
- [ ] **Repost / quote-post**
- [ ] **Push notifications** (web push) for offline notification delivery
- [ ] **Server moderation tools** — admin panel for removing posts,
      banning members, editing rules
- [ ] **Federated server discovery** — opt-in directory + cross-instance
      following (ActivityPub-style)
- [ ] **TURN servers** for P2P connectivity behind strict NATs (currently
      only STUN, fails on some networks)

### Nice to have
- [ ] **On-chain identity anchoring** — write the DID hash to an EVM
      contract so the user owns their identity off-platform
- [ ] **NFT avatars** — verify wallet-owned NFTs and display them as avatars
- [ ] **Token-gated communities** — require holding a token to join a server
- [ ] **End-to-end encrypted media** uploaded through IPFS
- [ ] **Multi-language support / i18n**
- [ ] **Dark mode toggle** (system theme is respected; explicit toggle is missing)
- [ ] **Accessibility audit** (keyboard nav, focus traps in dialogs, ARIA labels)
- [ ] **PWA install + service worker** for full offline mode
- [ ] **Analytics + admin dashboard**

### Infra / DX
- [ ] Migrate `media` storage bucket to private + signed URLs (currently
      public; security linter warning)
- [ ] Tighten the `media` bucket SELECT policy so the bucket can't be listed
- [ ] E2E test suite (Playwright) for the auth + post + follow flows
- [ ] Rate limiting on posts / comments / follows
- [ ] Move IPFS pinning off Pinata onto a self-hosted IPFS node
