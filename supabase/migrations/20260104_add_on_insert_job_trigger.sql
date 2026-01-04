-- ============================================================================
-- On-Insert Job Trigger: Real-time Job Processing
-- ============================================================================
-- This migration sets up an automatic trigger that fires the job-worker
-- Edge Function immediately when a new job is inserted into the jobs table.
--
-- This replaces (or supplements) the cron-based polling mechanism.
--
-- Author: Nihongo Monogatari
-- Created: January 4, 2026
--
-- ⚠️ IMPORTANT: Before running this migration, you MUST replace YOUR_PROJECT_REF
-- with your actual Supabase Project ID (found in your Dashboard URL)
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable pg_net extension for HTTP requests from PostgreSQL
-- ============================================================================

-- The pg_net extension allows PostgreSQL to make asynchronous HTTP requests
-- This is required to trigger the Edge Function from within the database

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- STEP 2: Create trigger function to invoke job-worker Edge Function
-- ============================================================================

-- This function is called automatically whenever a new job is inserted
-- It makes an asynchronous HTTP POST request to the job-worker Edge Function

CREATE OR REPLACE FUNCTION trigger_job_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  worker_url TEXT;
  request_headers JSONB;
  request_body JSONB;
BEGIN
  -- ⚠️ REPLACE YOUR_PROJECT_REF WITH YOUR ACTUAL SUPABASE PROJECT ID BELOW
  -- Your Project ID is in your Dashboard URL: https://supabase.com/dashboard/project/YOUR_PROJECT_REF
  worker_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-worker';

  -- Build request headers
  -- Note: No auth required since worker has auth disabled for testing
  request_headers := jsonb_build_object(
    'Content-Type', 'application/json'
  );

  -- Build request body (empty - worker queries database for jobs)
  request_body := '{}'::jsonb;

  -- Make asynchronous HTTP POST request to job-worker
  -- timeout_milliseconds: Maximum time to wait for response (30 seconds)
  -- The request is ASYNC, meaning it fires and doesn't block the transaction
  PERFORM net.http_post(
    url := worker_url,
    headers := request_headers,
    body := request_body,
    timeout_milliseconds := 30000
  );

  -- Log the trigger invocation (visible in Supabase Dashboard)
  RAISE LOG 'Job worker triggered for job %: %', NEW.id, NEW.job_type;

  -- Return the new row (standard trigger behavior)
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    -- The job will remain pending and can be processed manually later
    RAISE LOG 'Failed to trigger job worker for job %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 3: Create the AFTER INSERT trigger
-- ============================================================================

-- This trigger fires immediately after a new job is inserted
-- It only triggers for jobs with status 'pending' (not for manual retries)

DROP TRIGGER IF EXISTS on_job_insert ON jobs;

CREATE TRIGGER on_job_insert
AFTER INSERT ON jobs
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION trigger_job_worker();

-- ============================================================================
-- STEP 4: Verify the setup (optional - for testing)
-- ============================================================================

-- To verify the trigger is working:
-- 1. Insert a test job (via job-creator Edge Function or directly)
-- 2. Check the job-worker logs in Supabase Dashboard
-- 3. You should see log entries showing the worker was triggered

-- Example test query (run in Supabase SQL Editor):
-- INSERT INTO jobs (job_type, parameters, status, user_id, story_id, estimated_completion_at)
-- VALUES ('story_generation',
--         '{"topic": "test", "level": "N5", "geminiApiKey": "test-key"}'::jsonb,
--         'pending',
--         (SELECT id FROM auth.users LIMIT 1),
--         null,
--         NOW() + INTERVAL '1 minute');

-- ============================================================================
-- STEP 5: Manual trigger function (for retrying failed jobs)
-- ============================================================================

-- This function can be called manually to process all pending jobs
-- Useful for recovery or when you want to force processing

CREATE OR REPLACE FUNCTION trigger_all_pending_jobs()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  worker_url TEXT;
  request_headers JSONB;
  request_body JSONB;
  pending_count INT;
BEGIN
  -- Count pending jobs
  SELECT COUNT(*) INTO pending_count
  FROM jobs
  WHERE status = 'pending';

  IF pending_count = 0 THEN
    RAISE NOTICE 'No pending jobs to process';
    RETURN 0;
  END IF;

  -- ⚠️ REPLACE YOUR_PROJECT_REF WITH YOUR ACTUAL SUPABASE PROJECT ID BELOW
  worker_url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-worker';

  -- Build request headers
  request_headers := jsonb_build_object(
    'Content-Type', 'application/json'
  );

  -- Build request body
  request_body := '{}'::jsonb;

  -- Make HTTP POST request to job-worker
  PERFORM net.http_post(
    url := worker_url,
    headers := request_headers,
    body := request_body,
    timeout_milliseconds := 30000
  );

  RAISE NOTICE 'Triggered job worker for % pending jobs', pending_count;
  RETURN pending_count;
END;
$$;

-- ============================================================================
-- SECURITY NOTES
-- ============================================================================

-- 1. The trigger function uses SECURITY DEFINER to execute with elevated privileges
--    This is necessary to make HTTP requests via pg_net
--
-- 2. The trigger is ASYNC - it doesn't block the insert transaction
--    This means the job-creator returns immediately even if the worker is slow
--
-- 3. The trigger includes error handling - if the HTTP request fails,
--    the job is still inserted and remains 'pending'
--    You can manually process it later by calling trigger_all_pending_jobs()
--
-- 4. No authentication required - the worker has auth disabled for testing
--    To enable auth, uncomment the Authorization header lines and set CRON_SECRET
--
-- 5. To view trigger logs:
--    Supabase Dashboard → Database → Logs → Search for "Job worker triggered"

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================

-- If you need to remove this trigger system:

-- 1. Drop the trigger:
-- DROP TRIGGER IF EXISTS on_job_insert ON jobs;

-- 2. Drop the functions:
-- DROP FUNCTION IF EXISTS trigger_job_worker();
-- DROP FUNCTION IF EXISTS trigger_all_pending_jobs();

-- 3. Remove pg_net extension (optional, if not used elsewhere):
-- DROP EXTENSION IF EXISTS pg_net;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- Problem: Jobs stuck in 'pending' status
-- Solution: Check if pg_net is enabled and trigger is created
-- SELECT * FROM pg_extension WHERE extname = 'pg_net';
-- SELECT * FROM pg_trigger WHERE tgname = 'on_job_insert';

-- Problem: "null value in column 'url' violates not-null constraint" error
-- Solution: You forgot to replace YOUR_PROJECT_REF with your actual Project ID
-- Recreate the trigger functions with the correct URL

-- Problem: Trigger fires but worker doesn't process
-- Solution: Check job-worker logs in Supabase Dashboard → Edge Functions → Logs

-- Problem: Multiple jobs inserted simultaneously cause issues
-- Solution: The worker already handles this with SELECT ... FOR UPDATE-style locking
-- via the UPDATE ... WHERE status = 'pending' pattern

-- Problem: Want to manually process stuck pending jobs
-- Solution: Call SELECT trigger_all_pending_jobs(); in SQL Editor

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
