import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Job Creator Edge Function
 *
 * Creates background job records for async processing.
 * Validates job parameters and returns job ID immediately.
 *
 * Job Types:
 * - story_generation: Generate Japanese stories with Gemini API
 * - audio_generation: Generate TTS audio with Gemini API
 * - image_generation: Generate images with Pollinations AI
 */

// Validation schemas for different job types
const JOB_VALIDATORS = {
  story_generation: (data: any) => {
    if (!data.topic || typeof data.topic !== 'string') {
      throw new Error('Topic is required and must be a string');
    }
    if (!data.level || typeof data.level !== 'string') {
      throw new Error('Level is required and must be a string');
    }
    const validLevels = ['N1', 'N2', 'N3', 'N4', 'N5', 'Beginner', 'Intermediate', 'Advanced'];
    if (!validLevels.includes(data.level)) {
      throw new Error(`Invalid level. Must be one of: ${validLevels.join(', ')}`);
    }
    if (!data.geminiApiKey || typeof data.geminiApiKey !== 'string') {
      throw new Error('Gemini API key is required');
    }
    return true;
  },

  audio_generation: (data: any) => {
    if (!data.userId || typeof data.userId !== 'string') {
      throw new Error('userId is required and must be a string');
    }
    if (!data.storyId || typeof data.storyId !== 'string') {
      throw new Error('storyId is required and must be a string');
    }
    if (!data.text || typeof data.text !== 'string') {
      throw new Error('text is required and must be a string');
    }
    if (!data.geminiApiKey || typeof data.geminiApiKey !== 'string') {
      throw new Error('Gemini API key is required');
    }
    return true;
  },

  image_generation: (data: any) => {
    if (!data.storyId || typeof data.storyId !== 'string') {
      throw new Error('storyId is required and must be a string');
    }
    if (data.segmentIndex === undefined || data.segmentIndex === null) {
      throw new Error('segmentIndex is required');
    }
    if (typeof data.segmentIndex !== 'number') {
      throw new Error('segmentIndex must be a number');
    }
    return true;
  },
};

// Estimated completion time for each job type (in minutes)
const ESTIMATED_MINUTES: Record<string, number> = {
  story_generation: 1,
  audio_generation: 0.5,
  image_generation: 0.25,
};

serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Parse request body
    const { job_type, parameters, priority = 100 } = await req.json();

    // Validate job_type
    if (!job_type || typeof job_type !== 'string') {
      throw new Error('job_type is required');
    }

    if (!JOB_VALIDATORS[job_type]) {
      throw new Error(
        `Invalid job type: ${job_type}. Must be one of: ${Object.keys(JOB_VALIDATORS).join(', ')}`
      );
    }

    // Validate parameters based on job type
    JOB_VALIDATORS[job_type](parameters);

    // Create Supabase client with service role (for inserting jobs)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Supabase credentials not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      throw new Error('Unauthorized: Invalid or expired token');
    }

    // Calculate estimated completion time
    const estimatedMinutes = ESTIMATED_MINUTES[job_type] || 1;
    const estimated_completion_at = new Date(
      Date.now() + estimatedMinutes * 60 * 1000
    ).toISOString();

    // Insert job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        job_type,
        parameters,
        status: 'pending',
        priority,
        user_id: user.id,
        story_id: parameters.storyId || null,
        estimated_completion_at,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to create job: ${error.message}`);
    }

    console.log(`Job created: ${job.id} (${job_type}) for user ${user.id}`);

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        status: job.status,
        estimated_completion_at: job.estimated_completion_at,
        message: 'Job queued successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('Job creation error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to create job',
      }),
      {
        status: error.message?.includes('Unauthorized') ? 401 : 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
