# Deployment Guide for Netlify

This guide walks you through deploying Wayfa to Netlify.

## Prerequisites

- A Supabase project with the database schema already set up
- A GitHub/GitLab/Bitbucket account
- A Netlify account

## Step 1: Prepare Your Repository

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

## Step 2: Enable Realtime in Supabase

**CRITICAL**: Before deploying, enable Realtime replication in Supabase:

1. Go to your Supabase dashboard
2. Navigate to Database → Replication
3. Enable replication for these tables:
   - `activities`
   - `messages`
   - `polls`
   - `poll_options`
   - `poll_votes`

See `REALTIME_SETUP.md` for detailed instructions.

## Step 3: Deploy to Netlify

### Option A: Deploy via Netlify UI (Recommended)

1. Go to [https://app.netlify.com](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Choose your Git provider and select your repository
4. Netlify will auto-detect Next.js settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Functions directory**: (leave empty)

5. Add environment variables (click "Add environment variables"):
   ```
   NEXT_PUBLIC_SUPABASE_URL = your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_supabase_anon_key
   ```

6. Click "Deploy site"

Your site will be built and deployed in 2-3 minutes.

### Option B: Deploy via Netlify CLI

1. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```

2. Login to Netlify:
   ```bash
   netlify login
   ```

3. Initialize the site:
   ```bash
   netlify init
   ```

4. Set environment variables:
   ```bash
   netlify env:set NEXT_PUBLIC_SUPABASE_URL "your_url"
   netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your_key"
   ```

5. Deploy:
   ```bash
   netlify deploy --prod
   ```

## Step 4: Verify Deployment

1. Visit your deployed site URL
2. Create an account and login
3. Create a test trip
4. Test all features:
   - Add days and activities
   - Send chat messages
   - Create polls and vote

## Step 5: Test Real-time Features

Open your site in two different browsers:
1. Login with the same account in both
2. Open the same trip in both browsers
3. Add an activity in one - should appear instantly in the other
4. Send a chat message - should appear in real-time
5. Vote in a poll - votes should update live

## Troubleshooting

### Build Fails

- Check that all environment variables are set correctly
- Verify the Supabase URL and key are correct
- Check build logs in Netlify dashboard

### Real-time Not Working

- Verify Realtime is enabled in Supabase (see Step 2)
- Check browser console for connection errors
- Ensure Supabase project is not paused

### Authentication Issues

- Verify environment variables are correctly set
- Check that the Supabase URL and anon key match your project
- Ensure RLS policies are applied (should be automatic via migration)

## Custom Domain

To add a custom domain:
1. Go to your site in Netlify dashboard
2. Click "Domain settings"
3. Click "Add custom domain"
4. Follow instructions to configure DNS

## Environment Variables

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

Find these in your Supabase dashboard under Settings → API.

## Continuous Deployment

Netlify automatically redeploys when you push to your main branch:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

The site will rebuild and deploy automatically.

## Production Checklist

- [ ] Realtime enabled for all required tables
- [ ] Environment variables set in Netlify
- [ ] Site builds successfully
- [ ] Can register and login
- [ ] Can create trips
- [ ] Real-time features work across multiple browsers
- [ ] Custom domain configured (optional)

## Support

For issues:
- Netlify: [https://docs.netlify.com](https://docs.netlify.com)
- Supabase: [https://supabase.com/docs](https://supabase.com/docs)
- Next.js: [https://nextjs.org/docs](https://nextjs.org/docs)
