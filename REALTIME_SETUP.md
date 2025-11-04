# Enabling Realtime in Supabase

For the real-time features to work (live chat, itinerary updates, polls), you must enable Realtime replication on specific tables in your Supabase dashboard.

## Steps to Enable Realtime

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Replication** in the sidebar
3. Find and enable replication for these tables:
   - `activities`
   - `messages`
   - `polls`
   - `poll_options`
   - `poll_votes`

## How to Enable

For each table:
1. Find the table in the Replication list
2. Toggle the switch to **enable** replication
3. The table will show a green indicator when enabled

## Verify Setup

After enabling replication:
1. Open two browser windows with your app
2. Login with the same account in both
3. Create a trip and open it in both windows
4. Add an activity in one window - it should appear instantly in the other
5. Send a chat message - it should appear in real-time in both windows
6. Create a poll and vote - votes should update live

## Troubleshooting

If real-time updates aren't working:
- Verify all 5 tables have replication enabled
- Check browser console for connection errors
- Ensure your Supabase project is not paused
- Try refreshing the page

## Note

Realtime is available on all Supabase plans including the free tier. There are no additional costs for the basic usage in this app.
