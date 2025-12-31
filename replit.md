# Digital Citizen

## Overview

Digital Citizen is an AI-powered civic super-app designed for Nigerian citizens. It provides a unified platform combining AI-powered legal defense, proximity-aware services, AI-matched jobs, community forums, and marketplace features. The application supports both regular users and vendors with a credit-based system for accessing various features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state, React Context for auth state
- **Styling**: Tailwind CSS v4 with shadcn/ui component library (new-york style)
- **Build Tool**: Vite with custom plugins for Replit integration
- **Animations**: Framer Motion for page transitions and UI animations

The frontend follows a page-based architecture with:
- Public pages (Home, Login)
- Protected app pages wrapped in AppLayout (Dashboard, Civic, Marketplace, Jobs, Forum, Events, etc.)
- Reusable UI components from shadcn/ui stored in `client/src/components/ui/`

### Backend Architecture

- **Runtime**: Node.js with Express
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful endpoints under `/api/*`
- **Session Management**: Express sessions with PostgreSQL store (connect-pg-simple)

The server follows a modular structure:
- `server/index.ts`: Express app setup and middleware
- `server/routes.ts`: API route definitions
- `server/storage.ts`: Data access layer interface
- `server/static.ts`: Static file serving for production
- `server/vite.ts`: Vite dev server integration

### Database Layer

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit with `drizzle-kit push` command

Key database tables:
- `users`: Basic authentication data
- `userProfiles`: Extended user info including KYC status, vendor mode, city/state
- `plans`: Subscription plans for users and vendors
- `subscriptions`: User plan subscriptions with Stripe integration
- `credits`: Credit balances for feature usage
- `coupons`: Discount codes for subscriptions
- `wallets`: User wallet balances for payments
- `walletTransactions`: Transaction ledger for wallet operations
- `bookings`: Service bookings between users and vendors
- `bookingMilestones`: Staged payment milestones for bookings
- `escrowAccounts`: Escrow accounts holding funds for bookings
- `escrowEvents`: Audit log for escrow transactions
- `contracts`: Electronic contracts for bookings
- `disputes`: Dispute records with admin resolution
- `bookingMessages`: Chat messages between booking participants
- Cloaked routes and traffic alerts for privacy features

### Booking & Escrow System

The platform includes a comprehensive booking system for vendor services:
- **Bookings**: Users book vendor services with optional milestones
- **Escrow**: Funds held securely until milestone completion
- **Milestones**: Staged payments released as work progresses
- **Contracts**: Electronic contracts with dual signatures
- **Chat**: Real-time messaging between booking participants
- **Disputes**: Admin arbitration with resolution options (user_favor, vendor_favor, split)

### Wallet System

Users have wallets for platform payments:
- Top-up via mock payment (ready for real payment provider integration)
- Escrow funding from wallet balance
- Automatic fund release/refund on dispute resolution

### City-Based Personalization

Content is personalized based on user's city:
- Jobs and Events filtered by user's city first
- 15 major Nigerian cities supported
- Automatic state derivation from city selection

### Notification System

Multi-channel notification system for user engagement:
- **In-app notifications**: Bell icon with unread count, notification center page
- **Email notifications**: SMTP settings manageable by admin
- **Push notifications**: Web push subscription support
- **Templates**: Admin-managed templates with variable substitution ({{userName}}, etc.)

Tables: `notifications`, `notificationTemplates`, `smtpSettings`, `pushSubscriptions`

### User Activity Tracking

Track user engagement with jobs and events:
- **Saved Jobs**: Users can save jobs for later (savedJobs table)
- **Applied Jobs**: Track job applications with status (appliedJobs table)
- **AI Generated Jobs**: Personalized job suggestions (generatedJobs table)
- **Saved Events**: Users can save events of interest (savedEvents table)

Jobs page has tabs: All Jobs, Applied, Saved, AI Generated
Events page has tabs: All Events, Registered, Saved

### AI Suggestions

AI-powered personalized suggestions popup:
- Shows on dashboard after 3 seconds (once per session)
- Analyzes user's city, saved jobs, events, and bookings
- Uses Gemini API to generate 2-3 actionable suggestions
- Dismissed suggestions stored in localStorage

### Authentication

- **Client-side**: Firebase Authentication (Google Firebase)
- **User State**: React Context (`AuthContext`) with Firebase `onAuthStateChanged`
- **Profile Sync**: User profiles fetched from backend after Firebase auth

### AI Integration

- **Provider**: Google Gemini API (gemini-1.5-flash model)
- **Client-side**: Direct API calls from `client/src/lib/gemini.ts`
- **Use Cases**: Legal defense AI, civic guidance, job matching

## External Dependencies

### Third-Party Services

- **Firebase**: Authentication and Firestore (config in `client/src/lib/firebase.ts`)
- **Google Gemini**: AI/LLM capabilities for civic features
- **Stripe**: Payment processing for subscriptions (referenced in schema and build allowlist)

### Database

- **PostgreSQL**: Primary database via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Key NPM Packages

- `@tanstack/react-query`: Server state management
- `drizzle-orm` / `drizzle-zod`: Database ORM with Zod validation
- `express` / `express-session`: HTTP server and session handling
- `passport` / `passport-local`: Authentication middleware
- `wouter`: Client-side routing
- `framer-motion`: Animations
- Full Radix UI primitive set via shadcn/ui

### Build & Development

- `vite`: Frontend build and dev server
- `esbuild`: Server bundling for production
- `tsx`: TypeScript execution for development
- Custom Replit plugins for development experience