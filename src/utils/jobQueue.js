/**
 * Job Queue Manager - Background Job System
 *
 * Manages server-side background jobs with local state sync.
 * Replaces client-side audioQueue with database-backed system.
 *
 * Features:
 * - Polls database every 3 seconds for job updates
 * - Subscribes to job changes (observer pattern)
 * - localStorage backup for offline capability
 * - Automatic toast notifications on completion
 * - Create, retry, and cancel jobs
 *
 * @typedef {import('../types.js').Job} Job
 * @typedef {'story_generation' | 'audio_generation' | 'image_generation'} JobType
 */

import { supabase, getSession } from './supabase.js';
import { toast } from '../components/Toast.js';

class JobQueueManager {
  constructor() {
    /** @type {Map<string, Job>} */
    this.jobs = new Map();

    /** @type {Set<(jobs: Map<string, Job>) => void>} */
    this.subscribers = new Set();

    this.pollInterval = null;
    this.isPolling = false;
    this.storageKey = 'nihongo_jobs';

    // Load jobs from localStorage for offline capability
    this.loadJobs();

    // Start polling for authenticated users
    this.initPolling();
  }

  /**
   * Load jobs from localStorage (backup)
   * @private
   */
  loadJobs() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const jobs = JSON.parse(saved);
        jobs.forEach(job => this.jobs.set(job.id, job));
        console.log(`Loaded ${jobs.length} jobs from localStorage`);
      }
    } catch (e) {
      console.warn('Failed to load jobs from localStorage:', e);
    }
  }

  /**
   * Save jobs to localStorage (backup)
   * @private
   */
  saveJobs() {
    try {
      const jobsArray = Array.from(this.jobs.values());
      localStorage.setItem(this.storageKey, JSON.stringify(jobsArray));
    } catch (e) {
      console.warn('Failed to save jobs to localStorage:', e);
    }
  }

  /**
   * Start polling for job updates
   * @private
   */
  async initPolling() {
    const session = await getSession();
    if (!session) {
      console.log('No session found, skipping job queue initialization');
      return;
    }

    if (this.isPolling) {
      console.log('Job queue already polling');
      return;
    }

    this.isPolling = true;
    console.log('Starting job queue polling');

    // Fetch initial state
    await this.syncJobs();

    // Poll every 3 seconds
    this.pollInterval = setInterval(() => {
      this.syncJobs();
    }, 3000);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('Stopped job queue polling');
  }

  /**
   * Sync jobs with database
   * @private
   */
  async syncJobs() {
    try {
      const session = await getSession();
      if (!session) {
        console.log('No session, skipping sync');
        return;
      }

      // Fetch pending/processing jobs
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('*')
        .in('status', ['pending', 'processing', 'completed', 'failed'])
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Job sync error:', error);
        return;
      }

      if (!jobs) {
        return;
      }

      // Update local cache
      let hasChanges = false;
      jobs.forEach(job => {
        const existing = this.jobs.get(job.id);
        if (!existing || existing.status !== job.status) {
          this.jobs.set(job.id, job);
          hasChanges = true;

          // Notify on status change
          if (existing && job.status === 'completed' && existing.status !== 'completed') {
            this.handleJobCompletion(job);
          } else if (existing && job.status === 'failed' && existing.status !== 'failed') {
            this.handleJobFailure(job);
          }
        }
      });

      // Clean up old completed/failed jobs (keep last 20)
      const completedJobs = Array.from(this.jobs.values())
        .filter(j => j.status === 'completed' || j.status === 'failed')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (completedJobs.length > 20) {
        const toRemove = completedJobs.slice(20);
        toRemove.forEach(job => this.jobs.delete(job.id));
        hasChanges = true;
      }

      if (hasChanges) {
        this.saveJobs();
        this.notify();
      }
    } catch (error) {
      console.error('Job sync error:', error);
    }
  }

  /**
   * Create a new job
   * @param {JobType} jobType
   * @param {Object} parameters
   * @param {number} priority
   * @returns {Promise<string>} Job ID
   */
  async createJob(jobType, parameters, priority = 100) {
    try {
      const { data, error } = await supabase.functions.invoke('job-creator', {
        body: { job_type: jobType, parameters, priority },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create job');
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to create job');
      }

      console.log(`Job created: ${data.job_id} (${jobType})`);

      // Immediately sync to get the job
      await this.syncJobs();

      return data.job_id;
    } catch (error) {
      console.error('Failed to create job:', error);
      throw error;
    }
  }

  /**
   * Retry a failed job
   * @param {string} jobId
   */
  async retryJob(jobId) {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'pending',
          error_message: null,
          error_details: null,
          retry_count: 0,
          started_at: null,
          completed_at: null,
        })
        .eq('id', jobId)
        .eq('user_id', (await getSession()).user.id);

      if (error) {
        throw error;
      }

      toast.info('Retrying job...');
      await this.syncJobs();
    } catch (error) {
      console.error('Failed to retry job:', error);
      toast.error('Failed to retry job');
    }
  }

  /**
   * Cancel a job
   * @param {string} jobId
   */
  async cancelJob(jobId) {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'cancelled' })
        .eq('id', jobId)
        .eq('user_id', (await getSession()).user.id)
        .in('status', ['pending', 'processing']);

      if (error) {
        throw error;
      }

      this.jobs.delete(jobId);
      this.saveJobs();
      this.notify();
      toast.info('Job cancelled');
    } catch (error) {
      console.error('Failed to cancel job:', error);
      toast.error('Failed to cancel job');
    }
  }

  /**
   * Handle job completion
   * @private
   * @param {Job} job
   */
  handleJobCompletion(job) {
    const jobTypeNames = {
      story_generation: 'Story',
      audio_generation: 'Audio',
      image_generation: 'Image',
    };

    const typeName = jobTypeNames[job.job_type] || 'Job';
    toast.success(`${typeName} ready!`);

    // Store result in appropriate place
    if (job.job_type === 'story_generation' && job.result) {
      // Import dynamically to avoid circular dependency
      import('./storage.js')
        .then(({ addStory }) => {
          addStory(job.result);
          console.log('Story saved to library:', job.result.id);
        })
        .catch(err => {
          console.error('Failed to save story:', err);
        });
    }
  }

  /**
   * Handle job failure
   * @private
   * @param {Job} job
   */
  handleJobFailure(job) {
    toast.error(`Job failed: ${job.error_message || 'Unknown error'}`);
  }

  /**
   * Subscribe to job updates
   * @param {(jobs: Map<string, Job>) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(new Map(this.jobs));

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   * @private
   */
  notify() {
    this.subscribers.forEach(fn => {
      try {
        fn(new Map(this.jobs));
      } catch (e) {
        console.error('Subscriber error:', e);
      }
    });
  }

  /**
   * Get all jobs
   * @returns {Map<string, Job>}
   */
  getJobs() {
    return new Map(this.jobs);
  }

  /**
   * Get pending/processing job count
   * @returns {number}
   */
  getPendingCount() {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' || job.status === 'processing') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get job by ID
   * @param {string} jobId
   * @returns {Job | undefined}
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Cleanup on logout
   */
  cleanup() {
    this.stopPolling();
    this.jobs.clear();
    this.subscribers.clear();
    console.log('Job queue cleaned up');
  }
}

// Export singleton instance
export const jobQueue = new JobQueueManager();
