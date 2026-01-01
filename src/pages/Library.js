/**
 * Library Page
 * Browse, filter, and create stories
 */

import StoryCard from '../components/StoryCard.js';
import { sampleStories } from '../data/stories.js';
import GeneratorModal from '../components/GeneratorModal.js';
import { getStoredStories, deleteStory } from '../utils/storage.js';
import { toast } from '../components/Toast.js';
import { debounce } from '../utils/componentBase.js';

const Library = (parentElement) => {
  // State
  let currentFilter = 'All';
  let sortBy = 'newest';
  let searchQuery = '';
  let viewMode = 'grid';

  /**
   * Get filtered and sorted stories
   */
  const getFilteredStories = () => {
    const allStories = [...getStoredStories(), ...sampleStories];

    let filtered = allStories;

    // Filter by level
    if (currentFilter !== 'All') {
      filtered = filtered.filter(s => s.level === currentFilter);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.titleJP?.toLowerCase().includes(query) ||
        s.titleEN?.toLowerCase().includes(query) ||
        s.excerpt?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (a.id > b.id) ? 1 : -1;
        case 'level-asc':
          const levels = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
          return (levels[a.level] || 0) - (levels[b.level] || 0);
        case 'level-desc':
          const levelsDesc = { 'Beginner': 1, 'Intermediate': 2, 'Advanced': 3 };
          return (levelsDesc[b.level] || 0) - (levelsDesc[a.level] || 0);
        case 'newest':
        default:
          return (a.id < b.id) ? 1 : -1;
      }
    });

    return filtered;
  };

  /**
   * Render the library
   */
  const render = () => {
    const stories = getFilteredStories();
    const filters = ['All', 'Beginner', 'Intermediate', 'Advanced'];

    const html = `
      <div class="library-page">
        <!-- Header -->
        <div class="library-header">
          <div class="library-header__top">
            <div>
              <h1>Story Library</h1>
              <p class="text-muted">${stories.length} stories available</p>
            </div>
            <button id="create-btn" class="btn">
              <span>✨</span> Create New
            </button>
          </div>
          
          <!-- Controls -->
          <div class="library-controls">
            <!-- Search -->
            <div class="search-box">
              <span class="search-box__icon">🔍</span>
              <input 
                type="text" 
                id="search-input"
                class="search-box__input" 
                placeholder="Search stories..."
                value="${searchQuery}"
              >
              ${searchQuery ? '<button id="clear-search" class="search-box__clear">✕</button>' : ''}
            </div>
            
            <!-- Filters -->
            <div class="filters">
              ${filters.map(filter => `
                <button 
                  class="filter-btn ${currentFilter === filter ? 'active' : ''}" 
                  data-filter="${filter}"
                >
                  ${filter}
                </button>
              `).join('')}
            </div>
            
            <!-- Sort & View -->
            <div class="library-options">
              <select id="sort-select" class="form-select" style="width: auto;">
                <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
                <option value="oldest" ${sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
                <option value="level-asc" ${sortBy === 'level-asc' ? 'selected' : ''}>Easiest First</option>
                <option value="level-desc" ${sortBy === 'level-desc' ? 'selected' : ''}>Hardest First</option>
              </select>
              
              <div class="view-toggle">
                <button class="icon-btn ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid view">
                  ▦
                </button>
                <button class="icon-btn ${viewMode === 'list' ? 'active' : ''}" data-view="list" title="List view">
                  ☰
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Story Grid/List -->
        ${stories.length > 0 ? `
          <div class="story-grid ${viewMode === 'list' ? 'story-grid--list' : ''}" id="story-container">
            ${stories.map(story => StoryCard(story)).join('')}
          </div>
        ` : `
          <div class="empty-state">
            <div class="empty-state__icon">📚</div>
            <h2 class="empty-state__title">No stories found</h2>
            <p class="empty-state__description">
              ${searchQuery
        ? `No stories match "${searchQuery}". Try a different search.`
        : currentFilter !== 'All'
          ? `No ${currentFilter.toLowerCase()} stories yet. Create one!`
          : 'Your library is empty. Create your first story!'}
            </p>
            <button id="empty-create-btn" class="btn">✨ Create Story</button>
          </div>
        `}
      </div>
    `;

    parentElement.innerHTML = html;
    setupListeners();
  };

  /**
   * Setup event listeners
   */
  const setupListeners = () => {
    parentElement.addEventListener('click', handleClick);

    // Search with debounce
    const searchInput = parentElement.querySelector('#search-input');
    searchInput?.addEventListener('input', debounce((e) => {
      searchQuery = e.target.value;
      render();
    }, 300));

    // Clear search
    parentElement.querySelector('#clear-search')?.addEventListener('click', () => {
      searchQuery = '';
      render();
    });

    // Sort
    parentElement.querySelector('#sort-select')?.addEventListener('change', (e) => {
      sortBy = e.target.value;
      render();
    });

    // View toggle
    parentElement.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        viewMode = btn.dataset.view;
        render();
      });
    });
  };

  /**
   * Handle delegated clicks
   */
  const handleClick = (e) => {
    // Delete button
    const deleteBtn = e.target.closest('.delete-story-btn');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();

      const id = deleteBtn.dataset.id;
      const storyCard = deleteBtn.closest('.story-card');
      const storyTitle = storyCard?.querySelector('.story-card__title')?.textContent || 'this story';

      // Show confirmation toast with undo
      const deletedStory = getStoredStories().find(s => s.id === id);
      deleteStory(id);

      // Animate out
      if (storyCard) {
        storyCard.style.transform = 'scale(0.9)';
        storyCard.style.opacity = '0';
        setTimeout(() => render(), 200);
      }

      toast.success(`"${storyTitle}" deleted`, {
        action: deletedStory ? () => {
          // Undo - re-add the story
          const stories = getStoredStories();
          stories.unshift(deletedStory);
          localStorage.setItem('nihongo_stories', JSON.stringify(stories));
          render();
          toast.info('Story restored');
        } : null,
        actionLabel: 'Undo',
        duration: 5000
      });

      return;
    }

    // Filter buttons
    const filterBtn = e.target.closest('.filter-btn');
    if (filterBtn) {
      currentFilter = filterBtn.dataset.filter;
      render();
      return;
    }

    // Create buttons
    if (e.target.closest('#create-btn') || e.target.closest('#empty-create-btn')) {
      openGeneratorModal();
      return;
    }
  };

  /**
   * Open the story generator modal
   */
  const openGeneratorModal = () => {
    const modal = GeneratorModal({
      onClose: () => { },
      onGenerate: (newStory) => {
        toast.success(`"${newStory.titleEN}" created!`);
        render();
      }
    });
    document.body.appendChild(modal);
  };

  render();

  // Cleanup
  return () => {
    parentElement.removeEventListener('click', handleClick);
  };
};

// Add library-specific styles
const libraryStyles = document.createElement('style');
libraryStyles.textContent = `
  .library-page {
    padding-bottom: var(--space-16);
  }
  
  .library-header {
    margin-bottom: var(--space-8);
  }
  
  .library-header__top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    flex-wrap: wrap;
  }
  
  .library-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  @media (min-width: 768px) {
    .library-controls {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
    }
  }
  
  /* Search Box */
  .search-box {
    position: relative;
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }
  
  .search-box__icon {
    position: absolute;
    left: var(--space-4);
    top: 50%;
    transform: translateY(-50%);
    opacity: 0.5;
  }
  
  .search-box__input {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    padding-left: var(--space-10);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    transition: all var(--duration-fast);
  }
  
  .search-box__input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }
  
  .search-box__clear {
    position: absolute;
    right: var(--space-3);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity var(--duration-fast);
  }
  
  .search-box__clear:hover {
    opacity: 1;
  }
  
  /* Library Options */
  .library-options {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-left: auto;
  }
  
  .view-toggle {
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-bg-subtle);
    border-radius: var(--radius-md);
  }
  
  .view-toggle .icon-btn {
    width: 32px;
    height: 32px;
    font-size: var(--text-sm);
  }
  
  .view-toggle .icon-btn.active {
    background: var(--color-surface);
    box-shadow: var(--shadow-sm);
  }
  
  /* List View */
  .story-grid--list {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .story-grid--list .story-card {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto 1fr auto;
    gap: var(--space-2) var(--space-4);
    padding: var(--space-4);
  }
  
  .story-grid--list .story-card__header {
    grid-column: 1 / -1;
  }
  
  .story-grid--list .story-card .btn {
    width: auto;
  }
`;
document.head.appendChild(libraryStyles);

export default Library;
