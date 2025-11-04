# Getting Started with Wayfa

Quick start guide to get Wayfa up and running locally and deployed to Netlify.

## What You Have

A fully functional collaborative trip planning app with:
- ✅ User authentication (email/password)
- ✅ Trip creation and management
- ✅ Real-time itinerary (days & activities)
- ✅ Real-time chat with online presence
- ✅ Real-time polls with voting
- ✅ Clean, modular codebase
- ✅ Netlify-ready deployment

## Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- Git installed

## 5-Minute Local Setup

### Step 1: Verify Database

The database schema has already been created via Supabase MCP. Verify:

```bash
# Check that your .env has Supabase credentials
cat .env
```

You should see:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

### Step 2: Enable Realtime

**IMPORTANT**: Go to your Supabase dashboard:

1. Navigate to Database → Replication
2. Enable replication for these 5 tables:
   - `activities`
   - `messages`
   - `polls`
   - `poll_options`
   - `poll_votes`

This is **required** for real-time features to work.

### Step 3: Install & Run

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Step 4: Test the App

1. Click "Sign up" and create an account
2. Create a new trip with title, destination, and dates
3. Add a day to your trip
4. Add activities to that day
5. Try the chat (open in two browsers to see real-time)
6. Create a poll and vote

## Deploy to Netlify (10 Minutes)

### Step 1: Push to Git

```bash
git init
git add .
git commit -m "Initial Wayfa setup"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main
```

### Step 2: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Select your Git provider and repository
4. Netlify auto-detects Next.js settings

### Step 3: Add Environment Variables

In Netlify deployment settings, add:

```
NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key
```

### Step 4: Deploy

Click "Deploy site" and wait 2-3 minutes.

Your app is now live! 🎉

## Verify Everything Works

### Test Checklist

- [ ] Can register a new account
- [ ] Can login with credentials
- [ ] Can create a trip
- [ ] Can add days to trip
- [ ] Can add activities to days
- [ ] Real-time: Open trip in 2 browsers, add activity in one, appears in other
- [ ] Chat: Messages appear instantly
- [ ] Chat: Online count updates
- [ ] Polls: Can create poll with options
- [ ] Polls: Can vote and see live results

### Test Real-time Features

1. Open your deployed site in Chrome
2. Open same site in Firefox (or incognito)
3. Login with same account in both
4. Open same trip in both browsers
5. Add activity in Chrome → should appear instantly in Firefox
6. Send chat message → should appear in both
7. Create poll and vote → votes update live

## Common Issues

### Real-time Not Working

**Solution**: Enable Realtime in Supabase
1. Go to Database → Replication
2. Enable the 5 required tables
3. Refresh your app

### Can't Login

**Solution**: Check environment variables
1. Verify .env has correct Supabase URL and key
2. Check Netlify environment variables match
3. Make sure database migration was applied

### Build Fails

**Solution**: Check dependencies
```bash
npm install
npm run build
```

If successful locally, issue is likely environment variables in Netlify.

## File Structure

```
├── app/                    # Pages
│   ├── login/             # Auth pages
│   ├── register/
│   ├── dashboard/         # Trip list
│   └── trip/[id]/         # Trip workspace
├── components/            # UI components
│   ├── Chat.tsx
│   ├── Itinerary.tsx
│   ├── Polls.tsx
│   └── ui/               # Primitives
├── lib/                  # Utilities
│   ├── supabase/
│   └── auth.ts
└── middleware.ts         # Route protection
```

## Key Features Explained

### Authentication
- Email/password via Supabase Auth
- Protected routes with middleware
- Auto-redirect to dashboard after login

### Dashboard
- Lists all your trips
- Create new trip with modal
- Click trip to open workspace

### Trip Workspace
- Left: Itinerary with days and activities
- Right: Chat and Polls in tabs
- Everything updates in real-time

### Real-time
- Uses Supabase Realtime
- WebSocket connections
- Optimistic UI updates
- Presence tracking for chat

## Customization

To modify the UI:

1. Components are in `/components`
2. Styles use Tailwind CSS
3. Keep data fetching logic
4. Replace JSX/CSS as needed
5. Real-time subscriptions should stay

## Documentation

- `README.md` - Overview and setup
- `ARCHITECTURE.md` - Technical details
- `DEPLOYMENT.md` - Netlify guide
- `REALTIME_SETUP.md` - Enable Realtime
- This file - Quick start

## Next Steps

1. Customize the design
2. Add your branding
3. Invite users to test
4. Set up custom domain
5. Add analytics (optional)

## Need Help?

Check these resources:
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- Netlify Docs: https://docs.netlify.com
- TailwindCSS: https://tailwindcss.com/docs

## Success Metrics

Your app is working correctly if:
- ✅ Users can sign up and login
- ✅ Trips can be created and viewed
- ✅ Activities appear in real-time across browsers
- ✅ Chat messages sync instantly
- ✅ Poll votes update live
- ✅ Online presence count is accurate

Congratulations! You have a production-ready collaborative trip planner. 🚀
