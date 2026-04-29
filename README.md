# Hive Link

A decentralized social networking platform built with modern web technologies.

## Tech Stack

- **Framework**: TanStack Start (React Router v7)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Shadcn UI + Tailwind CSS
- **Blockchain**: Wallet connection via Web3
- **Storage**: IPFS for decentralized content storage

## Features

- 🔗 Wallet-based authentication
- 📝 Create and share posts
- 👥 User profiles with customizable usernames
- 🏠 Servers/Communities for group discussions
- 🔄 P2P networking capabilities
- 📦 Offline support
- 🛡️ Federated moderation

## Getting Started

### Prerequisites

- Node.js 18+
- Bun (recommended) or npm/pnpm
- Web3 wallet (MetaMask, Rabby, etc.)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
# Copy .env.example to .env and fill in your values
cp .env.example .env

# Start development server
bun run dev
```

### Environment Variables

Create a `.env` file with:

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

```
src/
├── components/       # React components
│   ├── ui/          # Shadcn UI components
│   ├── Layout.tsx  # Main layout component
│   ├── PostCard.tsx # Post display component
│   └── WalletConnect.tsx # Wallet connection
├── routes/          # Page routes
│   ├── index.tsx   # Home/feed page
│   ├── new.tsx     # Create post page
│   ├── profile.tsx # User profile page
│   └── servers.tsx # Servers listing
├── services/        # Business logic
│   ├── blockchain.ts
│   ├── ipfs.ts
│   ├── offline.ts
│   └── p2p.ts
├── integrations/   # External services
│   └── supabase/   # Supabase client & types
└── lib/            # Utilities
    ├── auth-context.tsx
    ├── cache.ts
    └── utils.ts
```

## Available Scripts

- `bun run dev` - Start development server
- `bun run build` - Build for production
- `bun run lint` - Run ESLint
- `bun run typecheck` - TypeScript type checking

## License

MIT