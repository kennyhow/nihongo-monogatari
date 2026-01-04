/**
 * Queue Page - Unified Job Queue
 * Shows all background jobs (story, audio, image generation)
 */

import { jobQueue } from '../utils/jobQueue.js';
import { createEventManager } from '../utils/componentBase.js';

const Queue = parentElement => {
  const events = createEventManager();
  let unsubscribe = null;
  let currentJobs = new Map();
  let currentFilter = 'all'; // all, pending, processing, completed, failed

  /**
   * Main render function
   */
  const render = () => {
    parentElement.innerHTML = `
      <div class="queue-page">
        <div id="queue-header-root"></div>
        <div id="queue-stats-root"></div>
        <div id="queue-filters-root"></div>
        <div id="queue-list-root"></div>

        <!-- Info Section -->
        <div class="queue-info card">
          <h3>ℹ️ Background Jobs</h3>
          <ul class="queue-info__list">
            <li>Jobs run on the server - you can close your browser!</li>
            <li>Jobs are processed sequentially (one at a time)</li>
            <li>Completed results are saved automatically</li>
            <li>Failed jobs can be retried manually</li>
          </ul>
        </div>
      </div>
    `;

    updateHeader();
    updateUI(currentJobs);
  };

  /**
   * Update the header
   */
  const updateHeader = () => {
    const root = parentElement.querySelector('#queue-header-root');
    if (!root) {
      return;
    }

    root.innerHTML = `
      <div class="queue-header">
        <div>
          <h1>Job Queue</h1>
          <p class="text-muted">Background processing tasks</p>
        </div>
      </div>
    `;
  };

  /**
   * Update all dynamic UI
   */
  const updateUI = jobs => {
    currentJobs = jobs;
    updateStats();
    updateFilters();
    updateJobList();
  };

  /**
   * Update statistics
   */
  const updateStats = () => {
    const root = parentElement.querySelector('#queue-stats-root');
    if (!root) {
      return;
    }

    const jobs = Array.from(currentJobs.values());
    const pending = jobs.filter(j => j.status === 'pending').length;
    const processing = jobs.filter(j => j.status === 'processing').length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    const total = jobs.length;

    const activeCount = pending + processing;

    root.innerHTML = `
      <div class="queue-stats">
        <div class="queue-stat">
          <div class="queue-stat__icon">📋</div>
          <div class="queue-stat__value">${total}</div>
          <div class="queue-stat__label">Total Jobs</div>
        </div>

        <div class="queue-stat queue-stat--processing">
          <div class="queue-stat__icon">${activeCount > 0 ? '🔄' : '💤'}</div>
          <div class="queue-stat__value">${activeCount > 0 ? 'Active' : 'Idle'}</div>
          <div class="queue-stat__label">Status</div>
        </div>

        <div class="queue-stat">
          <div class="queue-stat__icon">⏳</div>
          <div class="queue-stat__value">${pending}</div>
          <div class="queue-stat__label">Pending</div>
        </div>

        <div class="queue-stat queue-stat--success">
          <div class="queue-stat__icon">✓</div>
          <div class="queue-stat__value">${completed}</div>
          <div class="queue-stat__label">Completed</div>
        </div>

        ${
          failed > 0
            ? `
          <div class="queue-stat queue-stat--error">
            <div class="queue-stat__icon">⚠️</div>
            <div class="queue-stat__value">${failed}</div>
            <div class="queue-stat__label">Failed</div>
          </div>
        `
            : ''
        }
      </div>
    `;
  };

  /**
   * Update filters (show all, pending, completed, failed)
   */
  const updateFilters = () => {
    const root = parentElement.querySelector('#queue-filters-root');
    if (!root) {
      return;
    }

    const filters = ['all', 'pending', 'processing', 'completed', 'failed'];
    const isActive = filter => (currentFilter === filter ? '' : 'btn--ghost');

    root.innerHTML = `
      <div class="queue-filters">
        ${filters
          .map(
            filter => `
          <button class="btn btn--sm ${isActive(filter)}" data-filter="${filter}">
            ${filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        `
          )
          .join('')}
      </div>
    `;

    events.delegate(root, 'click', '[data-filter]', e => {
      currentFilter = e.target.dataset.filter;
      updateFilters();
      updateJobList();
    });
  };

  /**
   * Update job list
   */
  const updateJobList = () => {
    const root = parentElement.querySelector('#queue-list-root');
    if (!root) {
      return;
    }

    let jobs = Array.from(currentJobs.values());

    // Apply filter
    if (currentFilter !== 'all') {
      jobs = jobs.filter(j => j.status === currentFilter);
    }

    // Sort by created date (newest first)
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (jobs.length === 0) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📭</div>
          <h2 class="empty-state__title">No jobs</h2>
          <p class="empty-state__description">
            ${currentFilter === 'all' ? 'No jobs yet. Create a story to get started!' : `No ${currentFilter} jobs.`}
          </p>
        </div>
      `;
      return;
    }

    root.innerHTML = `
      <div class="queue-list">
        ${jobs.map(job => renderJobCard(job)).join('')}
      </div>
    `;

    // Attach event listeners for buttons
    events.delegate(root, 'click', '.retry-btn', e => {
      const jobId = e.target.dataset.jobId;
      jobQueue.retryJob(jobId);
    });

    events.delegate(root, 'click', '.cancel-btn', e => {
      const jobId = e.target.dataset.jobId;
      if (confirm('Cancel this job?')) {
        jobQueue.cancelJob(jobId);
      }
    });

    events.delegate(root, 'click', '.dismiss-btn', e => {
      const jobCard = e.target.closest('.queue-card');
      if (jobCard) {
        jobCard.remove();
      }
    });
  };

  /**
   * Render single job card
   */
  const renderJobCard = job => {
    const statusIcons = {
      pending: '⏳',
      processing: '🔄',
      completed: '✓',
      failed: '✕',
      cancelled: '🚫',
    };

    const typeNames = {
      story_generation: 'Story Generation',
      audio_generation: 'Audio Generation',
      image_generation: 'Image Generation',
    };

    const typeIcons = {
      story_generation: '📖',
      audio_generation: '🎵',
      image_generation: '🖼️',
    };

    const createdAt = new Date(job.created_at).toLocaleString();
    const timeEstimate = job.estimated_completion_at
      ? `Est: ${new Date(job.estimated_completion_at).toLocaleTimeString()}`
      : '';

    // Format duration if completed
    let duration = '';
    if (job.status === 'completed' && job.started_at && job.completed_at) {
      const start = new Date(job.started_at).getTime();
      const end = new Date(job.completed_at).getTime();
      const seconds = Math.round((end - start) / 1000);
      duration = `<span class="text-muted">Completed in ${seconds}s</span>`;
    }

    return `
      <div class="queue-card card" id="job-${job.id}">
        <div class="queue-card__header">
          <div class="queue-card__title-row">
            <h3 class="queue-card__title">
              ${typeIcons[job.job_type] || '📝'} ${typeNames[job.job_type] || job.job_type}
            </h3>
            <span class="queue-card__status queue-card__status--${job.status}">
              ${statusIcons[job.status]} ${job.status}
            </span>
          </div>
          <div class="queue-card__meta">
            <span class="text-muted">Created: ${createdAt}</span>
            ${timeEstimate ? `<span class="text-muted">${timeEstimate}</span>` : ''}
            ${duration ? duration : ''}
          </div>
        </div>

        ${
          job.error_message
            ? `
          <div class="queue-card__error">
            <strong>Error:</strong> ${job.error_message}
          </div>
        `
            : ''
        }

        ${
          job.status === 'failed'
            ? `
          <div class="queue-card__actions">
            <button class="btn btn--sm retry-btn" data-job-id="${job.id}">🔄 Retry</button>
            <button class="btn btn--sm btn--ghost btn--danger dismiss-btn" data-job-id="${job.id}">Dismiss</button>
          </div>
        `
            : ''
        }

        ${
          job.status === 'pending' || job.status === 'processing'
            ? `
          <div class="queue-card__actions">
            <button class="btn btn--sm btn--ghost btn--danger cancel-btn" data-job-id="${job.id}">Cancel</button>
          </div>
        `
            : ''
        }

        ${
          job.status === 'completed' && job.job_type === 'story_generation' && job.result
            ? `
          <div class="queue-card__actions">
            <a href="#/read?id=${job.result.id}" class="btn btn--sm">📖 Read Story</a>
          </div>
        `
            : ''
        }
      </div>
    `;
  };

  // Subscribe to job updates
  unsubscribe = jobQueue.subscribe(jobs => {
    updateUI(jobs);
  });

  render();

  return () => {
    events.cleanup();
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

export default Queue;
