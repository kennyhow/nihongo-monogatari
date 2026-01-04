-- ============================================================================
-- Background Job System: Jobs Table
-- ============================================================================
-- This table stores background jobs for story, audio, and image generation.
-- Jobs are processed sequentially by the job-worker Edge Function.
--
-- Author: Nihongo Monogatari
-- Created: January 4, 2026
-- ============================================================================

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Job classification
  job_type TEXT NOT NULL CHECK (job_type IN ('story_generation', 'audio_generation', 'image_generation')),

  -- Job parameters (JSONB for flexibility across job types)
  -- Story generation: { topic, level, instructions, length, geminiApiKey }
  -- Audio generation: { storyId, text, voiceName, geminiApiKey }
  -- Image generation: { storyId, segmentIndex, prompt }
  parameters JSONB NOT NULL,

  -- Status tracking
  -- pending: Waiting to be processed
  -- processing: Currently being processed
  -- completed: Successfully finished
  -- failed: Errored (can be retried)
  -- cancelled: Cancelled by user
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),

  -- Job result (populated when completed)
  result JSONB,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timing information
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,

  -- User ownership (REQUIRED)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Optional: Link to related story (for easy lookup)
  story_id TEXT,

  -- Priority (lower number = higher priority, default 100)
  priority INTEGER DEFAULT 100,

  -- Processing metadata
  processing_attempts INTEGER DEFAULT 1,
  last_heartbeat_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES: Performance optimization for common queries
-- ============================================================================

-- Query: Get all pending/processing jobs for a user
CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status);

-- Query: Get next job to process (worker polling)
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);

-- Query: Filter jobs by type
CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(job_type, status);

-- Query: Priority queue for job processing
CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority, created_at) WHERE status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS): Users can only access their own jobs
-- ============================================================================

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs"
  ON jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own jobs
CREATE POLICY "Users can insert own jobs"
  ON jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs (e.g., cancel, retry)
CREATE POLICY "Users can update own jobs"
  ON jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own jobs
CREATE POLICY "Users can delete own jobs"
  ON jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTES FOR DEVELOPERS
-- ============================================================================

-- Service Role Key:
-- The job-worker Edge Function uses the SUPABASE_SERVICE_ROLE_KEY to bypass
-- RLS and update any job. This is necessary because the worker processes
-- jobs on behalf of users.

-- Job Status Flow:
-- pending → processing → completed
--                ↓
--             failed → (can reset to pending for retry)

-- Estimated Completion Time:
-- - story_generation: 1 minute
-- - audio_generation: 30 seconds
-- - image_generation: 15 seconds

-- Example Query: Get pending job count for a user
-- SELECT COUNT(*) FROM jobs WHERE user_id = auth.uid() AND status IN ('pending', 'processing');

-- Example Query: Get next job to process (for worker)
-- SELECT * FROM jobs WHERE status = 'pending' ORDER BY priority ASC, created_at ASC LIMIT 1;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
