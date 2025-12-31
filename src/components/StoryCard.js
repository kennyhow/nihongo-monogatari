const StoryCard = (story) => {
  const diffColor = {
    'Beginner': 'bg-green-100 text-green-800',
    'Intermediate': 'bg-yellow-100 text-yellow-800',
    'Advanced': 'bg-red-100 text-red-800'
  };

  // Custom difficulty badge styles since we're using vanilla CSS
  const getBadgeStyle = (level) => {
    switch (level) {
      case 'Beginner': return 'background-color: #d1fae5; color: #065f46;';
      case 'Intermediate': return 'background-color: #fef3c7; color: #92400e;';
      case 'Advanced': return 'background-color: #fee2e2; color: #991b1b;';
      default: return 'background-color: #f3f4f6; color: #374151;';
    }
  };

  const isGenerated = String(story.id).startsWith('gen-');

  return `
    <article class="card story-card" style="position: relative;">
      <div class="story-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <span class="badge" style="padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; ${getBadgeStyle(story.level)}">
          ${story.level}
        </span>
        
        <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="read-time" style="color: var(--color-text-muted); font-size: 0.875rem;">
            ${story.readTime} min
            </span>
            ${isGenerated ? `
            <button class="delete-story-btn icon-btn" data-id="${story.id}" style="color: #ef4444; margin-left: 0.5rem;" title="Delete Story">
                🗑️
            </button>
            ` : ''}
        </div>
      </div>
      
      <h3 class="jp-title" style="margin-bottom: 0.5rem; font-size: 1.5rem;">${story.titleJP}</h3>
      <h4 class="en-title" style="margin-bottom: 1rem; font-size: 1rem; color: var(--color-text-muted); font-weight: 500;">${story.titleEN}</h4>
      
      <p class="excerpt" style="margin-bottom: 1.5rem; font-size: 0.875rem; color: var(--color-text-muted); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
        ${story.excerpt}
      </p>
      
      <a href="#/read?id=${story.id}" class="btn" style="width: 100%;">Read Story</a>
    </article>
  `;
};

export default StoryCard;
