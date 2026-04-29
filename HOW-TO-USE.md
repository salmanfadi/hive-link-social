# How to Use Hive Link

Hive Link is a decentralized social networking platform built with TanStack Start, Supabase, and blockchain technology.

## Prerequisites

- Node.js 18+ 
- Bun (recommended) or npm/pnpm
- A Web3 wallet (MetaMask, Rabby, etc.)

## Installation

```bash
# Install dependencies
bun install

# Set up environment variables
# Create a .env file with your Supabase credentials
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key

# Start development server
bun run dev
```

## Features

### Wallet Connection
Click the wallet button in the navigation to connect your Web3 wallet. This enables:
- Authentication across the platform
- Signing transactions
- Identity verification

### Creating Posts
1. Navigate to the "New" page
2. Write your post content
3. Optionally add media via IPFS
4. Submit to publish

### User Profiles
Visit `/u.your-username` to view your profile. Others can visit your profile to see your posts and activity.

### Servers/Communities
Join servers (communities) by visiting `/s.server-slug`. Each server has its own moderation rules and member list.

## Navigation

- **Home** (`/`) - Feed of posts from followed users and servers
- **New** (`/new`) - Create a new post
- **Servers** (`/servers`) - Browse and join communities
- **Profile** (`/u.$username`) - View user profiles

## Troubleshooting

### Wallet Connection Issues
- Ensure your wallet extension is installed and unlocked
- Check that you're on a supported network
- Try refreshing the page

### Database Connection Errors
- Verify your Supabase credentials in `.env`
- Check that your Supabase project is active
- Ensure network connectivity

### Build Errors
- Clear the cache: `rm -rf .cache`
- Reinstall dependencies: `bun install`