/**
 * Queue Page
 * Monitor and manage audio generation queue
 */

import { audioQueue } from '../utils/audioQueue.js';
import { toast } from '../components/Toast.js';

const Queue = (parentElement) => {
    let unsubscribe = null;

    /**
     * Render the queue page
     */
    const render = (queue) => {
        // Group by story
        const grouped = {};
        queue.forEach(item => {
            const title = item.storyTitle || 'Unknown Story';
            if (!grouped[title]) grouped[title] = [];
            grouped[title].push(item);
        });

        // Calculate stats
        const total = queue.length;
        const pending = queue.filter(i => i.status === 'pending').length;
        const processing = queue.find(i => i.status === 'processing');
        const completed = queue.filter(i => i.status === 'completed').length;
        const errors = queue.filter(i => i.status === 'error').length;

        // Estimated time (roughly 25 seconds per segment for TTS)
        const remainingItems = pending + (processing ? 1 : 0);
        const estMinutes = Math.ceil((remainingItems * 25) / 60);

        const html = `
      <div class="queue-page">
        <div class="queue-header">
          <div>
            <h1>Audio Processing Queue</h1>
            <p class="text-muted">High-quality TTS generation runs in the background</p>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="queue-stats">
          <div class="queue-stat">
            <div class="queue-stat__icon">📋</div>
            <div class="queue-stat__value">${total}</div>
            <div class="queue-stat__label">Total Items</div>
          </div>
          
          <div class="queue-stat queue-stat--processing">
            <div class="queue-stat__icon">${processing ? '🔄' : '💤'}</div>
            <div class="queue-stat__value">${processing ? 'Active' : 'Idle'}</div>
            <div class="queue-stat__label">Status</div>
          </div>
          
          <div class="queue-stat">
            <div class="queue-stat__icon">⏱️</div>
            <div class="queue-stat__value">~${estMinutes || 0} min</div>
            <div class="queue-stat__label">Est. Time</div>
          </div>
          
          <div class="queue-stat queue-stat--success">
            <div class="queue-stat__icon">✓</div>
            <div class="queue-stat__value">${completed}</div>
            <div class="queue-stat__label">Completed</div>
          </div>
        </div>

        ${total === 0 ? `
          <!-- Empty State -->
          <div class="empty-state">
            <div class="empty-state__icon">🎧</div>
            <h2 class="empty-state__title">Queue is empty</h2>
            <p class="empty-state__description">
              Create a story to start generating high-quality audio. 
              Audio will be generated automatically in the background.
            </p>
            <a href="#/library" class="btn">📚 Go to Library</a>
          </div>
        ` : `
          <!-- Queue Progress -->
          <div class="queue-progress-section">
            <div class="flex justify-between items-center mb-4">
              <h2>Processing Progress</h2>
              <button id="clear-queue-btn" class="btn btn--ghost btn--sm" style="color: var(--color-error);">
                🗑️ Clear All
              </button>
            </div>
            
            <div class="progress" style="height: 12px; margin-bottom: var(--space-2);">
              <div class="progress__bar" style="width: ${total > 0 ? (completed / total) * 100 : 0}%;"></div>
            </div>
            <p class="text-muted text-center">${completed} of ${total} segments completed</p>
          </div>

          <!-- Queue Items by Story -->
          <div class="queue-list">
            ${Object.keys(grouped).map(title => {
            const items = grouped[title];
            const storyCompleted = items.filter(i => i.status === 'completed').length;
            const storyTotal = items.length;
            const storyProgress = (storyCompleted / storyTotal) * 100;

            return `
                <div class="queue-card card">
                  <div class="queue-card__header">
                    <h3 class="queue-card__title">${title}</h3>
                    <span class="queue-card__count">${storyCompleted}/${storyTotal}</span>
                  </div>
                  
                  <div class="progress mb-4" style="height: 6px;">
                    <div class="progress__bar" style="width: ${storyProgress}%;"></div>
                  </div>
                  
                  <div class="queue-card__items">
                    ${items.map((item, idx) => `
                      <div class="queue-item queue-item--${item.status}">
                        <span class="queue-item__index">${idx + 1}</span>
                        <span class="queue-item__text">${item.text.substring(0, 40)}${item.text.length > 40 ? '...' : ''}</span>
                        <span class="queue-item__status">
                          ${item.status === 'processing' ? '<span class="animate-spin">⏳</span>' : ''}
                          ${item.status === 'completed' ? '✓' : ''}
                          ${item.status === 'error' ? '✕' : ''}
                          ${item.status === 'pending' ? '○' : ''}
                        </span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
        }).join('')}
          </div>
        `}

        <!-- Info Section -->
        <div class="queue-info card">
          <h3>ℹ️ How Audio Generation Works</h3>
          <ul class="queue-info__list">
            <li>Audio is generated using Google's Gemini TTS API</li>
            <li>Rate limited to ~2-3 requests per minute to avoid quota issues</li>
            <li>Generated audio is cached locally for instant playback</li>
            <li>You can continue browsing while audio generates in the background</li>
          </ul>
        </div>
      </div>
    `;

        parentElement.innerHTML = html;
        setupListeners();
    };

    /**
     * Setup event listeners
     */
    const setupListeners = () => {
        parentElement.querySelector('#clear-queue-btn')?.addEventListener('click', () => {
            if (confirm('Clear all pending audio generations? Completed items will remain cached.')) {
                audioQueue.clearQueue();
                toast.info('Queue cleared');
                render([]);
            }
        });
    };

    // Subscribe to queue updates
    unsubscribe = audioQueue.subscribe((queue) => {
        render(queue);
    });

    // Initial render
    render(audioQueue.getQueue());

    // Return cleanup
    return () => {
        if (unsubscribe) unsubscribe();
    };
};

// Add queue-specific styles
const queueStyles = document.createElement('style');
queueStyles.textContent = `
  .queue-page {
    max-width: var(--container-md);
    margin: 0 auto;
    padding-bottom: var(--space-16);
  }
  
  .queue-header {
    margin-bottom: var(--space-8);
  }

  /* Stats Grid */
  .queue-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4);
    margin-bottom: var(--space-8);
  }
  
  @media (max-width: 640px) {
    .queue-stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  .queue-stat {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    text-align: center;
  }
  
  .queue-stat__icon {
    font-size: 1.5rem;
    margin-bottom: var(--space-2);
  }
  
  .queue-stat__value {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-text);
  }
  
  .queue-stat__label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
  }
  
  .queue-stat--processing .queue-stat__icon {
    animation: spin 2s linear infinite;
  }
  
  .queue-stat--success .queue-stat__value {
    color: var(--color-success);
  }

  /* Progress Section */
  .queue-progress-section {
    margin-bottom: var(--space-8);
    padding: var(--space-6);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
  }

  /* Queue Cards */
  .queue-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: var(--space-8);
  }
  
  .queue-card {
    padding: var(--space-5);
  }
  
  .queue-card:hover {
    transform: none;
  }
  
  .queue-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  
  .queue-card__title {
    font-size: var(--text-base);
    font-weight: 600;
  }
  
  .queue-card__count {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  
  .queue-card__items {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 200px;
    overflow-y: auto;
  }

  /* Queue Items */
  .queue-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
  }
  
  .queue-item__index {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 600;
  }
  
  .queue-item__text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
  }
  
  .queue-item__status {
    font-size: var(--text-base);
  }
  
  .queue-item--completed {
    opacity: 0.6;
  }
  
  .queue-item--completed .queue-item__status {
    color: var(--color-success);
  }
  
  .queue-item--error .queue-item__status {
    color: var(--color-error);
  }
  
  .queue-item--processing {
    background: var(--color-primary-light);
  }

  /* Info Card */
  .queue-info {
    background: var(--color-bg-subtle);
    border: none;
  }
  
  .queue-info:hover {
    transform: none;
    box-shadow: var(--shadow-sm);
  }
  
  .queue-info h3 {
    margin-bottom: var(--space-4);
  }
  
  .queue-info__list {
    list-style: none;
    padding: 0;
  }
  
  .queue-info__list li {
    position: relative;
    padding-left: var(--space-6);
    margin-bottom: var(--space-2);
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }
  
  .queue-info__list li::before {
    content: "•";
    position: absolute;
    left: var(--space-2);
    color: var(--color-primary);
  }
`;
document.head.appendChild(queueStyles);

export default Queue;
