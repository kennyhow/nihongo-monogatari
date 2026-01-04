# Deployment Guide

This guide covers environment setup, configuration, and deployment for Nihongo Monogatari.

## Prerequisites

- Node.js 18+ and npm
- A Supabase account (free tier works)
- Google Gemini API key (for AI generation)
- Git

## Initial Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd Antigravity-Projects
npm install
```

### 2. Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Choose organization and region
4. Set database password (save it securely!)
5. Wait for project to be provisioned (~2 minutes)

### 3. Get Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon/public key** (should start with `sb_publishable_`)

⚠️ **Important:** Make sure you're using the new `publishable`/`secret` API keys, not the old JWT-based keys.

## Environment Configuration

### Client-Side Environment Variables

Create a `.env` file in the project root:

```bash
# Required
VITE_SUPABASE_PUBLISHABLE_KEY=your_sb_publishable_key_here
VITE_SUPABASE_URL=https://your-project.supabase.co

# Optional (if using client-side TTS directly)
VITE_GOOGLE_API_KEY=your_gemini_api_key_here
```

**Format Notes:**

- No spaces around `=`
- No quotes around values
- Restart dev server after changing `.env`

### Server-Side Environment Variables (Supabase Edge Functions)

Set these in Supabase Dashboard:

1. Go to **Edge Functions** → **Settings**
2. Add these environment variables:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Getting your Service Role Key:**

1. Go to **Project Settings** → **API**
2. Copy the **service_role** key (not the anon key)
3. Add this to Edge Functions environment

⚠️ **Security:** Never expose the service role key in client-side code!

## Database Setup

### 1. Enable Required Extensions

In Supabase SQL Editor:

```sql
-- Enable pg_net for HTTP triggers (required for job processing)
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 2. Run Database Migrations

```bash
# If using Supabase CLI
supabase db push

# Or manually copy SQL from migration files:
# - supabase/migrations/20240104_create_jobs_table.sql
# - supabase/migrations/20260104_add_on_insert_job_trigger.sql
```

**Run these in SQL Editor in order:**

1. **Create jobs table** (`20240104_create_jobs_table.sql`)
   - Creates background job queue
   - Sets up Row Level Security (RLS)
   - Creates performance indexes

2. **Add on-insert trigger** (`20260104_add_on_insert_job_trigger.sql`)
   - Enables immediate job processing
   - Sets up pg_net HTTP requests
   - Creates trigger function

### 3. Verify Setup

Run this query in SQL Editor to verify:

```sql
-- Check pg_net is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Check jobs table exists
SELECT * FROM information_schema.tables
WHERE table_name = 'jobs';

-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_job_insert';
```

## Edge Functions Deployment

### Deploy Functions

```bash
# Using Supabase CLI
supabase functions deploy job-creator
supabase functions deploy job-worker
supabase functions deploy job-status

# Or use the Dashboard:
# Edge Functions → your function → Deploy
```

### Function Descriptions

**job-creator** - Creates new background jobs

- Validates job parameters
- Creates job records in database
- Returns job ID immediately

**job-worker** - Processes background jobs

- Triggered automatically when jobs are inserted
- Claims pending jobs sequentially
- Calls appropriate APIs (Gemini, Pollinations)
- Updates job status and stores results

**job-status** - Returns job status

- Used by client for status polling
- Returns job details by ID

### Test Edge Functions

After deployment, test in your browser console:

```javascript
// Test job-creator
const response = await fetch('https://your-project.supabase.co/functions/v1/job-creator', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: 'your_sb_publishable_key',
  },
  body: JSON.stringify({
    job_type: 'story_generation',
    parameters: {
      topic: 'A cat who loves sushi',
      level: 'N4',
      instructions: 'Make it funny',
      length: 'short',
      geminiApiKey: 'your_gemini_api_key',
    },
  }),
});

const data = await response.json();
console.log('Job created:', data);
```

## Critical Configuration

### ⚠️ "Verify JWT with legacy secret" Setting

**This is the #1 cause of 401 errors with Supabase Edge Functions!**

If you're getting 401 "Invalid JWT" errors:

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Find **"Verify JWT with legacy secret"** toggle
3. Turn it **OFF** ❌ (if using new `sb_publishable_...` keys)
4. Save/Apply changes

**Why:** When using the new `publishable`/`secret` API keys, your project uses asymmetric JWT signing (JWKS). But if this setting is ON, Supabase tries to validate JWTs using the old JWT secret, causing 401 errors.

### Storage Buckets

Create private storage buckets for caching:

```sql
-- Create audio cache bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-cache', 'audio-cache', false);

-- Create image cache bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('image-cache', 'image-cache', false);

-- Set up RLS policies (users can only access their own cached files)
CREATE POLICY "Users can upload audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio-cache');

CREATE POLICY "Users can download audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio-cache');

-- Repeat for image-cache bucket
```

## Local Development

### Start Dev Server

```bash
npm run dev
```

Opens at http://localhost:5173

### Test Background Jobs

1. Generate a story (should create background job)
2. Check the Queue page to see job status
3. Wait 1-3 seconds for job to process
4. Story should appear in Library when complete

### Debug Edge Functions

In Supabase Dashboard:

1. Go to **Edge Functions** → **Logs**
2. Select function (job-creator, job-worker, or job-status)
3. View real-time logs and errors

## Production Build

### Build for Production

```bash
npm run build
```

Creates optimized files in `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

Tests the production build locally.

### Deploy to Hosting

#### Option 1: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

#### Option 3: Supabase Hosting

```bash
# Using Supabase CLI
supabase db push
supabase functions deploy
```

## Environment-Specific Configuration

### Development (.env.development)

```bash
VITE_SUPABASE_PUBLISHABLE_KEY=dev_key
VITE_SUPABASE_URL=https://dev-project.supabase.co
```

### Production (.env.production)

```bash
VITE_SUPABASE_PUBLISHABLE_KEY=prod_key
VITE_SUPABASE_URL=https://prod-project.supabase.co
```

## Troubleshooting

### 401 Unauthorized with Edge Functions

**Symptoms:** API calls return 401 errors

**Solutions:**

1. Verify environment variables: `echo $VITE_SUPABASE_PUBLISHABLE_KEY` (should start with `sb_publishable_`)
2. Check `.env` file has correct format (no spaces around `=`)
3. Restart dev server after changing `.env`
4. Check Network tab: `apikey` header should start with `sb_publishable_`
5. **Most likely:** Turn OFF "Verify JWT with legacy secret" in Supabase Dashboard

### Edge Function Not Responding

**Symptoms:** Functions timeout or return errors

**Solutions:**

1. Check function is deployed: Dashboard → Edge Functions → your function
2. Check function logs in Dashboard → Edge Functions → Logs
3. Verify CORS headers include `apikey`
4. Make sure you're calling correct function URL
5. Check environment variables are set in Edge Functions settings

### Jobs Stuck in "pending" Status

**Symptoms:** Jobs never process, stay in pending state

**Solutions:**

1. Check if `pg_net` extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```
2. Check if trigger exists:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_job_insert';
   ```
3. Manually trigger worker:
   ```sql
   SELECT trigger_all_pending_jobs();
   ```
4. Check job-worker logs in Dashboard
5. Verify GEMINI_API_KEY is set in Edge Functions environment

### Environment Variables Not Working

**Symptoms:** `import.meta.env.VITE_*` returns undefined

**Solutions:**

1. Ensure variables start with `VITE_` prefix
2. Restart dev server after changing `.env`
3. Check `.env` file is in project root
4. Verify no spaces around `=` in `.env`
5. Don't commit `.env` to git (should be in `.gitignore`)

### Migration Errors

**Symptoms:** Database schema errors, missing tables

**Solutions:**

1. Run migrations in order (oldest first)
2. Check SQL Editor for specific error messages
3. Verify `pg_net` extension is enabled before running trigger migration
4. Drop and recreate tables if needed (WARNING: deletes data)

### Audio/Image Caching Issues

**Symptoms:** Audio or images don't cache properly

**Solutions:**

1. Check storage buckets exist (`audio-cache`, `image-cache`)
2. Verify RLS policies allow authenticated users
3. Check browser Cache API for stored items
4. Clear cache and regenerate audio/images

## Monitoring and Logs

### Supabase Dashboard

**Edge Functions Logs:**

- Real-time function invocations
- Error messages and stack traces
- Response times and status codes

**Database Logs:**

- SQL query performance
- Connection errors
- Deadlocks and locks

**Storage Logs:**

- Upload/download activity
- Bucket access patterns
- Bandwidth usage

### Client-Side Monitoring

Check browser console for:

- Job status updates
- API errors
- Cache hits/misses

## Security Checklist

- [ ] Turn OFF "Verify JWT with legacy secret"
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Use service role key only in Edge Functions
- [ ] Never commit `.env` files to git
- [ ] Use private storage buckets for sensitive data
- [ ] Validate all user inputs
- [ ] Implement rate limiting on API endpoints
- [ ] Regularly update dependencies

## Backup and Recovery

### Database Backup

Supabase automatically backs up your database:

- Daily backups (pro plan)
- Point-in-time recovery (pro plan)
- Manual export via SQL Editor

### Storage Backup

Export important storage buckets:

```bash
# Using Supabase CLI
supabase storage download --bucket-id audio-cache
```

## Performance Optimization

### Database Indexes

Already created in migrations:

- `idx_jobs_user_status` - Fast user job queries
- `idx_jobs_status_created` - Job status filtering
- `idx_jobs_type_status` - Job type queries
- `idx_jobs_priority` - Priority queue processing

### Edge Functions

- Functions are serverless (auto-scale)
- Cold starts take ~500ms
- Keep functions lightweight for faster cold starts
- Use connection pooling for database queries

### Client-Side

- Lazy loading of pages
- Browser cache for audio/images
- Debounced search inputs
- Minimal DOM manipulation

## Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [Gemini API Docs](https://ai.google.dev/docs)
- [Vite Docs](https://vitejs.dev/)
- [Architectural Overview](ARCHITECTURE.md)
- [Contributing Guide](CONTRIBUTING.md)

---

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

For development guidelines and patterns, see [CONTRIBUTING.md](CONTRIBUTING.md).
