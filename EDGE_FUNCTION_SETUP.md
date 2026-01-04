# Edge Function Setup Guide

This guide walks you through deploying the Supabase Edge Function for background story generation. This allows you to close your browser while stories are being generated!

## Prerequisites

- A Supabase project (already set up)
- Supabase CLI installed
- Your Google Gemini API key

## Step 1: Install Supabase CLI

If you haven't already:

```bash
npm install -g supabase
```

Verify installation:

```bash
supabase --version
```

## Step 2: Link to Your Supabase Project

Get your project reference ID from the Supabase dashboard:

1. Go to https://app.supabase.com
2. Select your project
3. Go to Settings → General
4. Copy the Project Reference (looks like: `abcdefghijklmnopqrst`)

Link your local project:

```bash
supabase link --project-ref YOUR_PROJECT_ID
```

You'll be prompted to log in and authenticate.

## Step 3: Set Environment Variables

You need to set your Gemini API key in the Edge Function environment.

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click on **Settings** (gear icon)
4. Scroll to **Environment Variables**
5. Add a new variable:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** Your actual Google Gemini API key
6. Click **Save**

### Option B: Via CLI

```bash
supabase secrets set GEMINI_API_KEY=your_actual_api_key_here
```

## Step 4: Deploy the Edge Function

Deploy the function:

```bash
supabase functions deploy generate-story
```

You should see output like:

```
Deployed generate-story:
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-story
```

## Step 5: Test the Function

You can test the function directly:

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-story \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "A cat who loves sushi",
    "level": "N4",
    "instructions": "",
    "length": "short"
  }'
```

Replace `YOUR_ANON_KEY` with your Supabase anon/public key (found in Project Settings → API).

## Step 6: Verify Frontend Configuration

Make sure your `.env` file has your Supabase credentials:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

## Step 7: Test in Your App

1. Start your development server:

   ```bash
   npm run dev
   ```

2. Open your web app
3. Try generating a story
4. You should see the story being generated!

## How It Works Now

**Before:**

- You click "Generate"
- Your browser calls Gemini directly
- You must keep browser open
- Takes ~30-60 seconds

**Now:**

- You click "Generate"
- Your browser calls Supabase Edge Function
- Edge Function calls Gemini
- You **CAN** close your browser! (for up to ~2 minutes)
- Come back and your story is ready!

## Troubleshooting

### Error: "Supabase is not configured"

- Make sure your `.env` file has `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Restart your dev server after changing `.env`

### Error: "Server configuration error: GEMINI_API_KEY not set"

- Make sure you set the environment variable in Supabase dashboard
- Redeploy the function after setting the variable: `supabase functions deploy generate-story`

### Error: "Network error" or "Failed to fetch"

- Check your internet connection
- Verify your Supabase project URL is correct
- Check that the Edge Function is deployed

### Story generation is slow

- This is normal! Gemini API can take 30-60 seconds
- The benefit is you can close your browser while it works
- You'll still need to wait ~1 minute for the story to complete

### Rate limit errors

- Gemini has rate limits (~60 requests per minute for free tier)
- Wait a minute before trying again
- Consider upgrading to a paid Gemini API tier for higher limits

## Updating the Function

If you make changes to the function code, redeploy:

```bash
supabase functions deploy generate-story
```

## Viewing Function Logs

To see what's happening in your function:

```bash
supabase functions logs generate-story --tail
```

Or view logs in the Supabase dashboard under Edge Functions → Logs.

## Next Steps (Optional)

If you want to queue up multiple stories at once, you'd need to implement a full queue system with:

- Database table for jobs
- Queue worker function
- Real-time status updates

But for now, this simple setup lets you generate stories in the background!

## Security Notes

- The Edge Function runs server-side, so your API key is never exposed to browsers
- The function includes CORS headers to allow requests from your domain
- Consider adding authentication checks if you want to restrict access to logged-in users
