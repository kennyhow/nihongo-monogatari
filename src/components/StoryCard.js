/**
 * StoryCard Component
 * Displays a story preview with level badge, title, excerpt, and actions
 */

import { getStoryProgress } from '../utils/storage.js';

/**
 * Get badge class for difficulty level
 */
const getBadgeClass = level => {
  switch (level) {
    case 'Beginner':
      return 'badge--beginner';
    case 'Intermediate':
      return 'badge--intermediate';
    case 'Advanced':
      return 'badge--advanced';
    default:
      return '';
  }
};

/**
 * Render a story card
 * @param {Object} story - Story data object
 * @returns {string} HTML string
 */
const StoryCard = story => {
  const isGenerated = String(story.id).startsWith('gen-');
  const progress = getStoryProgress(story.id);
  const isInProgress = progress && !progress.completed;
  const isCompleted = progress?.completed;

  return `
    <article class="card card--interactive story-card" data-story-id="${story.id}">
      <div class="story-card__header">
        <div class="flex gap-2 items-center">
          <span class="badge ${getBadgeClass(story.level)}">${story.level}</span>
          ${isGenerated ? '<span class="badge badge--ai">✨ AI</span>' : ''}
          ${isCompleted ? '<span class="badge badge--success">✓ Read</span>' : ''}
        </div>
        
        <div class="story-card__meta">
          <span>📖 ${story.readTime} min</span>
          ${
            isGenerated
              ? `
            <button 
              class="icon-btn delete-story-btn" 
              data-id="${story.id}" 
              aria-label="Delete story"
              title="Delete story"
            >
              🗑️
            </button>
          `
              : ''
          }
        </div>
      </div>

      <h3 class="story-card__title jp-title">${story.titleJP}</h3>
      <h4 class="story-card__subtitle">${story.titleEN}</h4>
      
      <p class="story-card__excerpt">${story.excerpt}</p>
      
      ${
        isInProgress
          ? `
        <div class="progress progress--thin mb-4">
          <div class="progress__bar" style="width: ${progress.scrollPercent || 0}%;"></div>
        </div>
      `
          : ''
      }
      
      <a href="#/read?id=${story.id}" class="btn w-full">
        ${isInProgress ? 'Continue Reading' : isCompleted ? 'Read Again' : 'Read Story'}
      </a>
    </article>
  `;
};

// Styles now in external CSS: src/styles/components/cards.css

export default StoryCard;
