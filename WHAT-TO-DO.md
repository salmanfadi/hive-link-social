# What To Do

## Development Tasks

### Priority 1 - Core Features
- [ ] Set up Supabase database with authentication
- [ ] Implement wallet connection functionality
- [ ] Create post creation and display system
- [ ] Add IPFS integration for content storage

### Priority 2 - User Features
- [ ] Build user profile pages (`/u.$username`)
- [ ] Implement server/community pages (`/s.$slug`)
- [ ] Add blockchain service integration
- [ ] Create P2P networking layer

### Priority 3 - Polish
- [ ] Add offline support capabilities
- [ ] Implement caching layer
- [ ] Add federated moderation features
- [ ] Style components with custom theme

## Getting Started

1. Install dependencies: `bun install`
2. Set up environment variables in `.env`
3. Run development server: `bun run dev`
4. Build for production: `bun run build`

## Code Standards

- Use TypeScript for all new code
- Follow existing component patterns in `src/components/ui/`
- Run linting before commits: `bun run lint`
- Test changes in development environment