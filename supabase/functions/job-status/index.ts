import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Job Status Edge Function
 *
 * Returns the status of a job by ID.
 * Used by client-side polling mechanism.
 *
 * Query Parameters:
 * - job_id: UUID of the job to check
 *
 * Returns: Job object with all fields
 */

serve(async req => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('job_id');

    if (!jobId) {
      throw new Error('job_id parameter is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error: Supabase credentials not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (for RLS)
    const authHeader = req.headers.get('Authorization');
    let userId = null;

    if (authHeader) {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

      if (!authError && user) {
        userId = user.id;
      }
    }

    // Fetch job with RLS (user can only see their own jobs)
    const query = supabase.from('jobs').select('*').eq('id', jobId);

    // If we have a user ID, enforce RLS
    if (userId) {
      query.eq('user_id', userId);
    }

    const { data: job, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Job not found');
      }
      throw error;
    }

    console.log(`Job status checked: ${job.id} - ${job.status}`);

    return new Response(JSON.stringify(job), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Status check error:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to check job status',
      }),
      {
        status: error.message?.includes('not found') ? 404 : 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
