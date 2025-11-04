# Wayfa - Collaborative Trip Planning App

A minimal but functional web app for collaborative group-trip planning, designed to be deployed on Netlify.

## Features

- **Authentication**: Email/password auth via Supabase
- **Dashboard**: View and create trips
- **Trip Workspace**:
  - Real-time itinerary with days and activities
  - Real-time chat with presence (online count)
  - Real-time polls with voting

## Tech Stack

- Next.js 13 (App Router) + TypeScript
- TailwindCSS
- Supabase (Auth + Postgres + Realtime)
- shadcn/ui components

## Setup

### 1. Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. The database migration has already been applied through the Supabase MCP tools
3. Enable Realtime for the following tables in the Supabase dashboard:
   - Go to Database → Replication
   - Enable replication for: `activities`, `messages`, `polls`, `poll_options`, `poll_votes`

### 2. Environment Variables

The `.env` file should already contain your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Locally

```bash
npm run dev
```

Visit `http://localhost:3000`

## Netlify Deployment

### Option 1: Deploy via Netlify UI

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [Netlify](https://netlify.com) and click "Add new site"
3. Connect your repository
4. Netlify will auto-detect Next.js settings
5. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Click "Deploy site"

### Option 2: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Set environment variables
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your_url"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your_key"

# Deploy
netlify deploy --prod
```

## Database Schema

The app uses the following tables:

- **trips**: Trip metadata (title, destination, dates)
- **trip_members**: Join table for users and trips with roles
- **days**: Days within a trip
- **activities**: Activities within days
- **messages**: Chat messages per trip
- **polls**: Polls for group decisions
- **poll_options**: Options for each poll
- **poll_votes**: User votes (one per poll per user)

## Usage Flow

1. **Register/Login** → `/login` or `/register`
2. **Dashboard** → `/dashboard` (view all trips, create new trip)
3. **Trip Workspace** → `/trip/[id]`
   - Left side: Itinerary (add days and activities)
   - Right side: Chat and Polls tabs

## Real-time Features

- **Itinerary**: Activities update instantly when anyone adds/edits/deletes
- **Chat**: Messages appear in real-time with presence indicator
- **Polls**: Vote counts update live as users vote

## Modular Design

The codebase is structured for easy customization:

- `/components`: Reusable UI components
- `/lib`: Supabase client and auth utilities
- `/app`: Next.js pages and routes

You can easily replace the UI components with your own HTML/CSS while keeping the functionality intact.

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access trips they are members of
- Authentication required for all trip operations
- Automatic owner assignment as organizer

## Optional: Seed Data

To create demo data for testing, run these SQL commands in Supabase SQL Editor:

```sql
-- Get your user ID first
SELECT id FROM auth.users LIMIT 1;

-- Replace 'your-user-id' below with the actual ID

-- Create a demo trip
INSERT INTO trips (owner_id, title, destination, start_date, end_date)
VALUES ('your-user-id', 'Summer in Paris', 'Paris, France', '2024-07-01', '2024-07-10')
RETURNING id;

-- Use the returned trip ID below (replace 'trip-id')

-- Create days
INSERT INTO days (trip_id, day_index, date) VALUES
('trip-id', 1, '2024-07-01'),
('trip-id', 2, '2024-07-02')
RETURNING id;

-- Use the returned day IDs below

-- Create activities
INSERT INTO activities (day_id, title, starts_at, ends_at, location) VALUES
('day-1-id', 'Visit Eiffel Tower', '10:00', '12:00', 'Eiffel Tower'),
('day-1-id', 'Lunch at Cafe', '12:30', '14:00', 'Le Café de Paris');

-- Create a poll
INSERT INTO polls (trip_id, question, created_by) VALUES
('trip-id', 'Where should we have dinner?', 'your-user-id')
RETURNING id;

-- Create poll options (use poll ID from above)
INSERT INTO poll_options (poll_id, label) VALUES
('poll-id', 'Italian Restaurant'),
('poll-id', 'French Bistro'),
('poll-id', 'Japanese Cuisine');
```

## License

MIT
