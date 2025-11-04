# Wayfa Deployment Checklist

Use this checklist to ensure everything is set up correctly before and after deployment.

## Pre-Deployment Checklist

### Database Setup
- [x] Supabase project created
- [x] Database schema applied (via migration)
- [ ] **CRITICAL**: Realtime enabled for these tables:
  - [ ] `activities`
  - [ ] `messages`
  - [ ] `polls`
  - [ ] `poll_options`
  - [ ] `poll_votes`
- [x] RLS policies active on all tables
- [x] Database trigger for trip owner setup

### Local Development
- [x] `.env` file has Supabase credentials
- [x] Dependencies installed (`npm install`)
- [x] App runs locally (`npm run dev`)
- [x] Build succeeds (`npm run build`)
- [ ] Can register and login locally
- [ ] Can create trips locally
- [ ] Real-time features work locally

### Code Repository
- [ ] Code pushed to Git (GitHub/GitLab/Bitbucket)
- [ ] `.env` is in `.gitignore` (not committed)
- [ ] All documentation files included
- [ ] README.md updated if needed

## Deployment Checklist

### Netlify Setup
- [ ] Netlify account created
- [ ] Repository connected to Netlify
- [ ] Build settings verified:
  - Build command: `npm run build`
  - Publish directory: `.next`
- [ ] Environment variables added:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### First Deploy
- [ ] Site deployed successfully
- [ ] No build errors
- [ ] Site is accessible via Netlify URL

## Post-Deployment Verification

### Basic Functionality
- [ ] Home page loads
- [ ] Can access /login page
- [ ] Can access /register page
- [ ] Can register a new account
- [ ] Can login with credentials
- [ ] Redirects to dashboard after login
- [ ] Can logout

### Trip Management
- [ ] Can create a new trip
- [ ] Trip appears in dashboard
- [ ] Can click trip to open workspace
- [ ] Trip workspace loads correctly

### Itinerary Features
- [ ] Can add a day
- [ ] Can add activity to day
- [ ] Can edit activity details
- [ ] Can delete activity
- [ ] Multiple days display correctly

### Real-time Features (Test with 2 browsers)
- [ ] Open same trip in two browsers
- [ ] Add activity in Browser A → appears in Browser B
- [ ] Activity appears within 2 seconds
- [ ] No page refresh needed

### Chat Features
- [ ] Chat panel loads
- [ ] Can send message
- [ ] Message appears in chat
- [ ] Open in second browser:
  - [ ] Message appears in both browsers
  - [ ] Online count shows 2
- [ ] Messages persist after refresh

### Poll Features
- [ ] Can create poll
- [ ] Can add options (minimum 2)
- [ ] Poll appears after creation
- [ ] Can vote on poll
- [ ] Vote is recorded
- [ ] Open in second browser:
  - [ ] Poll appears
  - [ ] Can vote
  - [ ] Vote counts update in real-time in both browsers
  - [ ] Shows which option user voted for

### Security
- [ ] Cannot access /dashboard without login
- [ ] Cannot access /trip/[id] without login
- [ ] Redirected to /login when not authenticated
- [ ] Cannot see other users' trips
- [ ] Can only vote once per poll

### Performance
- [ ] Pages load in < 3 seconds
- [ ] No console errors
- [ ] No 404 errors for assets
- [ ] Real-time updates are instant
- [ ] Chat scrolls smoothly

## Troubleshooting Scenarios

### If Real-time Doesn't Work
1. [ ] Check Supabase Realtime is enabled
2. [ ] Check browser console for errors
3. [ ] Verify WebSocket connection in Network tab
4. [ ] Test in incognito/different browser

### If Authentication Fails
1. [ ] Verify environment variables in Netlify
2. [ ] Check Supabase URL is correct
3. [ ] Verify anon key is correct
4. [ ] Check browser console for errors

### If Build Fails
1. [ ] Check build logs in Netlify
2. [ ] Verify build works locally
3. [ ] Check all dependencies installed
4. [ ] Verify Node.js version compatibility

## Production Readiness

### Must Have
- [x] Database schema deployed
- [ ] RLS enabled and tested
- [ ] Real-time enabled
- [ ] Environment variables set
- [ ] Site deployed and accessible
- [ ] Basic features work

### Should Have
- [ ] Real-time tested with multiple users
- [ ] All features verified on production
- [ ] Custom domain configured (optional)
- [ ] Analytics added (optional)

### Nice to Have
- [ ] Monitoring set up
- [ ] Error tracking (e.g., Sentry)
- [ ] Performance metrics
- [ ] Backup strategy

## Final Sign-off

- [ ] All checklist items completed
- [ ] App tested thoroughly
- [ ] Documentation reviewed
- [ ] Ready for users

---

**Note**: The most common issue is forgetting to enable Realtime in Supabase. Double-check that all 5 tables have replication enabled!
