# How to Migrate to Background Job System

This guide walks you through setting up the background job system for Nihongo Monogatari. This system allows users to close their browser during long-running operations (story generation, audio generation, etc.).

**Estimated time: 15-20 minutes**

---

## Prerequisites

- Supabase project already set up
- Supabase CLI installed (`npm install -g supabase`)
- User authentication working (email/password)

---

## Step 1: Database Setup

### 1.1 Create Jobs Table

Open **Supabase Dashboard** → **SQL Editor** and run:

```bash
# Or copy the contents of:
# supabase/migrations/20240104_create_jobs_table.sql
```

Or run via CLI:

```bash
cd "C:\Users\kenne\OneDrive\Desktop\Antigravity-Projects"
supabase db push
```

**What this does:**

- Creates `jobs` table for storing background jobs
- Sets up Row Level Security (RLS) so users can only see their own jobs
- Creates performance indexes
- ✅ **Verification**: In Supabase Dashboard → **Table Editor**, you should see a `jobs` table

---

## Step 2: Deploy Edge Functions

### 2.1 Deploy Job Creator

```bash
cd "C:\Users\kenne\OneDrive\Desktop\Antigravity-Projects"
supabase functions deploy job-creator
```

### 2.2 Deploy Job Worker

```bash
supabase functions deploy job-worker
```

### 2.3 Deploy Job Status

```bash
supabase functions deploy job-status
```

**What this does:**

- Deploys 3 Edge Functions to Supabase
- `job-creator`: Creates new job records
- `job-worker`: Processes jobs (triggered by cron)
- `job-status`: Returns job status for polling

**✅ Verification:**
In Supabase Dashboard → **Edge Functions**, you should see all 3 functions listed.

---

## Step 3: Set Environment Variables

In **Supabase Dashboard** → **Edge Functions** → **Settings**, add:

### Optional: Cron Secret (Recommended)

```
CRON_SECRET=your-random-secret-key-here
```

Generate a random secret:

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
-join ([Char[]]((48..57)+(65..90)+(97..122) | Get-Random -Count 32))
```

**Note:** The job-worker currently has auth disabled for testing (see line 52-54 of `job-worker/index.ts`). To enable in production, uncomment those lines.

**✅ Verification:**
In **Edge Functions** → **job-worker** → **Logs**, you should see "Server configuration error" if env vars are missing (this is expected until you set them).

---

## Step 4: Set Up Cron Job (Automatic Job Processing)

The job-worker needs to be triggered regularly to process queued jobs.

### Option A: Supabase Dashboard (Recommended)

1. Go to **Supabase Dashboard** → **Edge Functions** → **job-worker**
2. Click **Triggers** or **Schedules**
3. Create a new cron schedule:
   - **Schedule**: `*/30 * * * * *` (every 30 seconds)
   - **HTTP Method**: POST
   - **Headers**:
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     ```

### Option B: pg_cron (Alternative)

In **Supabase Dashboard** → **SQL Editor**:

```sql
SELECT cron.schedule(
  'job-worker-poll',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/job-worker',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

Replace:

- `YOUR_PROJECT` with your Supabase project ID
- `YOUR_CRON_SECRET` with your actual secret

**✅ Verification:**
After 1 minute, check **Supabase Dashboard** → **Edge Functions** → **job-worker** → **Logs**. You should see log entries like:

- `No jobs to process` (if no jobs queued)
- `Processing job xxx-xxx-xxx` (if jobs are queued)

---

## Step 5: Update Client Code (Already Done!)

The client-side files have already been created/updated:

- ✅ `src/utils/jobQueue.js` - Job queue manager (created)
- ✅ `src/types.js` - Job typedef added (updated)
- ⏳ `src/services/api.js` - Will be updated in Phase 2
- ⏳ `src/components/GeneratorModal.js` - Will be updated in Phase 2

**No action needed yet** - Phase 1 is complete!

---

## Step 6: Test the Setup

### 6.1 Create a Test Job

You can test using curl or Postman:

```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-creator \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "story_generation",
    "parameters": {
      "topic": "A test story",
      "level": "N5",
      "instructions": "",
      "length": "short",
      "geminiApiKey": "YOUR_GEMINI_API_KEY"
    }
  }'
```

**To get your JWT token:**

1. Open your browser DevTools (F12)
2. Go to **Console** tab
3. Type: `localStorage.getItem('sb-YOUR_PROJECT-auth-token')`
4. Copy the token (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

**Expected Response:**

```json
{
  "success": true,
  "job_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "pending",
  "estimated_completion_at": "2026-01-04T12:35:00.000Z",
  "message": "Job queued successfully"
}
```

### 6.2 Check Job Status

```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/job-status?job_id=JOB_ID_FROM_ABOVE" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN"
```

**Expected Response:**

```json
{
  "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "job_type": "story_generation",
  "status": "pending",  // or "processing" or "completed"
  ...
}
```

### 6.3 Verify Database

In **Supabase Dashboard** → **Table Editor** → **jobs**:

- You should see your job record
- Status should change from `pending` → `processing` → `completed` within ~1 minute

**✅ Success!** If all tests pass, your background job system is ready!

---

## Step 7: What's Next?

Now that Phase 1 is complete, you can proceed to:

### Phase 2: Story Generation Migration

- Update `src/services/api.js` to use job queue
- Update `src/components/GeneratorModal.js` to queue jobs
- Update `src/pages/Queue.js` to show unified jobs
- Update `src/components/Header.js` to use jobQueue badge

**Result**: Users can generate stories and close their browser!

### Phase 3: Audio Generation (Future)

- Migrate audio generation from client-side to server-side
- Update job-worker to process audio jobs
- Remove legacy `src/utils/audioQueue.js`

**Result**: No more "keep browser open" for TTS!

### Phase 4: Image Generation (Optional)

- Migrate image generation to background jobs
- Fully serverless experience

---

## Troubleshooting

### Problem: Job stuck in "pending" status

**Solution:**

1. Check cron job is running:
   ```sql
   SELECT * FROM cron.job_run_details WHERE jobid = (
     SELECT jobid FROM cron.job WHERE jobname = 'job-worker-poll'
   ) ORDER BY start_time DESC LIMIT 5;
   ```
2. Check job-worker logs in Supabase Dashboard
3. Manually trigger worker:
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-worker \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Problem: "Unauthorized" error

**Solution:**

- Check JWT token is valid (not expired)
- Verify RLS policies are set correctly
- Check user is logged in

### Problem: Job fails immediately

**Solution:**

1. Check job-worker logs for error details
2. Verify Gemini API key is valid
3. Check parameters are correct:
   - `topic`: Must be non-empty string
   - `level`: Must be one of: N1, N2, N3, N4, N5, Beginner, Intermediate, Advanced
   - `geminiApiKey`: Required

### Problem: Jobs not appearing in Queue page

**Solution:**

1. Check browser console for errors
2. Verify `jobQueue.js` is loaded
3. Check user is authenticated:
   ```javascript
   // In browser console
   import('./src/utils/supabase.js')
     .then(m => m.getSession())
     .then(session => console.log('Session:', session));
   ```

### Problem: Too many database queries (performance)

**Solution:**

- Reduce polling frequency in `jobQueue.js` (line 127: change `3000` to `5000` for 5 seconds)
- Add Supabase Realtime subscription (future enhancement)
- Add database caching layer

---

## Rollback Plan

If you need to rollback to the old system:

### 1. Revert API Changes

```bash
git checkout HEAD~1 src/services/api.js
git checkout HEAD~1 src/components/GeneratorModal.js
```

### 2. Stop Cron Job

```sql
-- In Supabase SQL Editor
SELECT cron.unschedule('job-worker-poll');
```

### 3. Undeploy Edge Functions (Optional)

```bash
supabase functions delete job-creator
supabase functions delete job-worker
supabase functions delete job-status
```

### 4. Drop Jobs Table (Optional)

```sql
DROP TABLE IF EXISTS jobs CASCADE;
```

**Note**: Existing stories are not affected - they remain in localStorage.

---

## Support

If you encounter issues:

1. **Check logs**: Supabase Dashboard → Edge Functions → Logs
2. **Check database**: Supabase Dashboard → Table Editor → jobs
3. **Check browser console**: F12 → Console tab
4. **Review code**: Compare with plan in `.claude/plans/expressive-snuggling-snowglobe.md`

---

**Last Updated:** January 4, 2026
**Phase:** 1 (Foundation) - Complete! ✅
