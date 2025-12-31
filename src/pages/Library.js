import StoryCard from '../components/StoryCard.js';
import { sampleStories } from '../data/stories.js';
import GeneratorModal from '../components/GeneratorModal.js';
import { getStoredStories, deleteStory } from '../utils/storage.js';

const Library = (parentElement) => {
  let currentFilter = 'All';

  const render = () => {
    const allStories = [...getStoredStories(), ...sampleStories];
    const filteredStories = currentFilter === 'All'
      ? allStories
      : allStories.filter(s => s.level === currentFilter);

    const html = `
      <div class="library-header" style="margin-bottom: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <h1 style="margin: 0;">Story Library</h1>
          <button id="create-btn" class="btn" style="display: flex; align-items: center; gap: 0.5rem;">
            <span>✨</span> Create New
          </button>
        </div>
        
        <div class="filters" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${['All', 'Beginner', 'Intermediate', 'Advanced'].map(filter => `
            <button class="filter-btn ${currentFilter === filter ? 'active' : ''}" 
              data-filter="${filter}"
              style="
                padding: 0.5rem 1rem; 
                border-radius: 9999px; 
                border: 1px solid var(--color-border);
                background: ${currentFilter === filter ? 'var(--color-primary)' : 'var(--color-surface)'};
                color: ${currentFilter === filter ? '#fff' : 'var(--color-text)'};
                cursor: pointer;
                font-size: 0.875rem;
                transition: all 0.2s;
              "
            >
              ${filter}
            </button>
          `).join('')}
        </div>
      </div>
      
      <div class="story-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem;">
        ${filteredStories.length > 0
        ? filteredStories.map(story => StoryCard(story)).join('')
        : '<p style="color: var(--color-text-muted); grid-column: 1/-1; text-align: center; padding: 2rem;">No stories found for this level yet.</p>'
      }
      </div>
    `;

    parentElement.innerHTML = html;

    // Attach event listeners
    parentElement.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentFilter = e.target.dataset.filter;
        render();
      });
    });

    // Create Button
    document.getElementById('create-btn').addEventListener('click', () => {
      const modal = GeneratorModal({
        onClose: () => { },
        onGenerate: (newStory) => {
          render();
        }
      });
      document.body.appendChild(modal);
    });

    // Delete Buttons
    parentElement.querySelectorAll('.delete-story-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Prevent navigation if inside a card link (though button is distinct, good validation)
        e.stopPropagation();
        const id = e.currentTarget.dataset.id;
        if (confirm('Are you sure you want to delete this story?')) {
          deleteStory(id);
          render();
        }
      });
    });
  };

  render();
};

export default Library;
