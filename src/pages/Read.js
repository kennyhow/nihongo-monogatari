/**
 * Read Page
 * Wrapper page that loads story data and renders the Reader component
 */

import Reader from '../components/Reader.js';
import { sampleStories } from '../data/stories.js';
import { getStoredStories, getStoryProgress } from '../utils/storage.js';
import { toast } from '../components/Toast.js';
import { navigate, getRouteInfo } from '../utils/router.js';
import { createEventManager } from '../utils/componentBase.js';

const Read = parentElement => {
  // Event manager
  const events = createEventManager();

  // Get story ID from URL
  const { query } = getRouteInfo();
  const storyId = query.get('id');

  if (!storyId) {
    parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">❓</div>
        <h2 class="empty-state__title">No Story Selected</h2>
        <p class="empty-state__description">Please select a story from the library to read.</p>
        <a href="#/library" class="btn">📚 Go to Library</a>
      </div>
    `;
    return;
  }

  // Find story
  const allStories = [...getStoredStories(), ...sampleStories];
  const story = allStories.find(s => s.id === storyId);

  if (!story) {
    parentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🔍</div>
        <h2 class="empty-state__title">Story Not Found</h2>
        <p class="empty-state__description">The story you're looking for doesn't exist or may have been deleted.</p>
        <a href="#/library" class="btn">📚 Go to Library</a>
      </div>
    `;
    return;
  }

  // Get reading progress
  const progress = getStoryProgress(storyId);

  // Show continue prompt if has progress
  if (progress && progress.scrollPercent > 10 && !progress.completed) {
    parentElement.innerHTML = `
      <div class="continue-prompt">
        <div class="continue-prompt__card card">
          <h2>📖 Continue Reading?</h2>
          <p class="text-muted mb-4">You were ${progress.scrollPercent}% through this story.</p>
          <div class="flex gap-4 justify-center">
            <button id="continue-btn" class="btn">Continue</button>
            <button id="restart-btn" class="btn btn--secondary">Start Over</button>
          </div>
        </div>
      </div>
    `;

    events.on(parentElement.querySelector('#continue-btn'), 'click', () => {
      renderReader(story, progress);
    });

    events.on(parentElement.querySelector('#restart-btn'), 'click', () => {
      renderReader(story, null);
    });

    return () => events.cleanup();
  }

  // Render reader directly
  renderReader(story, progress);

  function renderReader(storyData, initialProgress) {
    parentElement.innerHTML = '';

    const reader = Reader({
      story: storyData,
      initialProgress,
      onComplete: () => {
        toast.success('🎉 Story completed!');
        navigate('/library');
      },
    });

    parentElement.appendChild(reader);

    // Return cleanup
    return () => {
      if (reader._cleanup) {
        reader._cleanup();
      }
    };
  }
};

// Styles now in external CSS: src/styles/components/readers.css

export default Read;
