# WhatsApp Outreach CRM

## Overview
Single-operator WhatsApp CRM — Import contacts → Send campaigns → Track replies → Convert to Projects.

## Monorepo Structure

```
apps/web        → Next.js frontend + API routes (deploy: Vercel)
apps/worker     → Persistent Node.js WhatsApp worker (deploy: Railway)
packages/db     → Prisma schema + generated client
packages/shared → Zod schemas, TypeScript types, constants
packages/whatsapp → WhatsApp provider abstraction
```

## Getting Started

### Prerequisites
- Node.js >= 18
- pnpm >= 10

### Setup

```bash
# Install all dependencies
pnpm install

# Set up environment variables
cp .env.example apps/web/.env.local
cp .env.example apps/worker/.env

# Edit the .env files with your credentials

# Push the database schema
pnpm db:push

# Start development
pnpm dev
```

### Environment Variables

See `.env.example` for all required variables.

## Build Order

See `implementation_plan.md` in the project root for the detailed milestone plan.
