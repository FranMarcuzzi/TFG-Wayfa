# Wayfa Architecture

This document explains the app structure and how components work together.

## Project Structure

```
wayfa/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Root redirect to dashboard
│   ├── login/page.tsx            # Login page
│   ├── register/page.tsx         # Registration page
│   ├── dashboard/page.tsx        # Main dashboard (trip list)
│   ├── trip/[id]/page.tsx        # Trip workspace
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── AuthGuard.tsx             # Auth protection wrapper
│   ├── NavBar.tsx                # Top navigation
│   ├── TripList.tsx              # Dashboard trip cards
│   ├── CreateTripModal.tsx       # New trip form
│   ├── Itinerary.tsx             # Days & activities view
│   ├── Chat.tsx                  # Real-time chat
│   ├── Polls.tsx                 # Real-time polls
│   └── ui/                       # shadcn/ui primitives
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Supabase client instance
│   │   └── types.ts              # Database TypeScript types
│   ├── auth.ts                   # Auth helper functions
│   └── utils.ts                  # Utility functions
├── middleware.ts                 # Route protection middleware
├── netlify.toml                  # Netlify config
└── supabase/migrations/          # Database migrations

```

## Data Flow

### Authentication Flow

1. User visits protected route
2. Middleware checks for auth token
3. If not authenticated → redirect to /login
4. User logs in via Supabase Auth
5. Session stored in browser
6. AuthGuard component verifies session
7. User accesses protected pages

### Trip Creation Flow

1. User clicks "Create Trip" on dashboard
2. CreateTripModal opens
3. User fills form and submits
4. Data inserted to `trips` table
5. Database trigger adds user as organizer in `trip_members`
6. User redirected to `/trip/[id]`

### Real-time Itinerary Flow

1. Component subscribes to `activities` table changes
2. User adds activity in browser A
3. Activity inserted to database
4. Supabase broadcasts change via websocket
5. Browser B receives update
6. Component refetches data and updates UI
7. Activity appears instantly in both browsers

### Real-time Chat Flow

1. Component creates Supabase channel for trip
2. Channel tracks presence (online users)
3. User sends message in browser A
4. Message inserted to `messages` table
5. Postgres trigger broadcasts insert event
6. Browser B receives event via channel
7. Message appends to chat (optimistic)
8. Online count updates via presence

### Real-time Polls Flow

1. User creates poll with options
2. Poll and options inserted to database
3. Other users see poll via subscription
4. User votes → upsert to `poll_votes`
5. Vote counts update instantly for all users
6. Visual feedback shows user's vote

## Key Technologies

### Next.js App Router
- Server and client components
- File-based routing
- Middleware for auth protection
- API routes not needed (direct Supabase)

### Supabase
- **Auth**: Email/password authentication
- **Postgres**: Relational database with RLS
- **Realtime**: WebSocket subscriptions
- **Client**: JavaScript client library

### TailwindCSS
- Utility-first styling
- Responsive design
- Custom color scheme (neutral grays)
- shadcn/ui component system

## Security

### Row Level Security (RLS)

All tables have RLS enabled with policies:

- Users can only see trips they're members of
- Trip members can add/edit content
- Users can only vote once per poll
- Automatic ownership checks

### Authentication

- Passwords hashed by Supabase
- JWT tokens for session management
- Auto-refresh tokens
- Secure cookie storage

## Real-time Architecture

### Subscriptions

Each real-time feature uses Supabase subscriptions:

```typescript
supabase
  .channel('channel-name')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'table_name',
    filter: 'trip_id=eq.xxx'
  }, (payload) => {
    // Handle update
  })
  .subscribe()
```

### Presence

Chat uses Supabase Presence for online tracking:

```typescript
channel.track({
  user_id: userId,
  online_at: timestamp
})
```

Presence state synced across all connected clients.

## Database Schema

### Core Relationships

```
trips (1) ←→ (many) trip_members
trips (1) ←→ (many) days
days (1) ←→ (many) activities
trips (1) ←→ (many) messages
trips (1) ←→ (many) polls
polls (1) ←→ (many) poll_options
polls (1) ←→ (many) poll_votes (constraint: one per user)
```

### Triggers

- `on_trip_created`: Auto-adds owner as organizer

## Component Architecture

### Container/Presenter Pattern

Components follow a simple pattern:

1. **Data Fetching**: Load from Supabase
2. **Real-time Setup**: Subscribe to changes
3. **State Management**: React useState
4. **UI Rendering**: Tailwind + shadcn/ui
5. **Cleanup**: Unsubscribe on unmount

### No Global State

- No Redux/Zustand needed
- Data fetched per-component
- Real-time keeps data in sync
- Simple and maintainable

## Deployment

### Build Process

1. TypeScript compilation
2. Next.js build (pages + assets)
3. Generate static pages where possible
4. Server-side routes for dynamic [id]

### Netlify Integration

- Automatic builds on git push
- Environment variables via UI
- Edge functions not needed
- CDN distribution

## Performance

### Optimization Strategies

- Static generation where possible
- Lazy loading for heavy components
- Debounced real-time updates
- Optimistic UI updates
- Indexed database queries

### Real-time Throttling

Supabase Realtime configured with:
- Max 10 events per second
- Automatic reconnection
- Presence throttling

## Future Enhancements

Possible additions while keeping simplicity:

- Image uploads for trips
- Location autocomplete
- Calendar integration
- Email invitations
- Mobile app (React Native)
- Offline support (local-first)

## Customization Guide

To replace UI with your own styles:

1. Keep component structure (props/state)
2. Replace JSX with your HTML
3. Swap Tailwind classes with your CSS
4. Keep data fetching logic
5. Maintain real-time subscriptions

Components are intentionally simple for easy customization.
