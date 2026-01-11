/**
 * Library Page
 * Browse, filter, and create stories
 * Refactored for modularity and granular updates.
 */

import '../styles/pages/library.css';
import StoryCard from '../components/StoryCard.js';
import { sampleStories } from '../data/stories.js';
import GeneratorModal from '../components/GeneratorModal.js';
import { getStoredStories, deleteStory } from '../utils/storage.js';
import { toast } from '../components/Toast.js';
import { debounce, createEventManager } from '../utils/componentBase.js';

const Library = parentElement => {
  // Event manager for all library events
  const events = createEventManager();

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
      filtered = filtered.filter(
        s =>
          s.titleJP?.toLowerCase().includes(query) ||
          s.titleEN?.toLowerCase().includes(query) ||
          s.excerpt?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return a.id > b.id ? 1 : -1;
        case 'level-asc': {
          const levels = { Beginner: 1, Intermediate: 2, Advanced: 3 };
          return (levels[a.level] || 0) - (levels[b.level] || 0);
        }
        case 'level-desc': {
          const levelsDesc = { Beginner: 1, Intermediate: 2, Advanced: 3 };
          return (levelsDesc[b.level] || 0) - (levelsDesc[a.level] || 0);
        }
        case 'newest':
        default:
          return a.id < b.id ? 1 : -1;
      }
    });

    return filtered;
  };

  /**
   * Main render function that sets up the scaffold
   */
  const render = () => {
    parentElement.innerHTML = `
      <div class="library-page">
        <div id="library-header-root"></div>
        <div id="library-controls-root"></div>
        <div id="library-content-root"></div>
      </div>
    `;

    updateHeader();
    updateControls();
    updateGrid();
  };

  /**
   * Updates just the header (title and Create button)
   */
  const updateHeader = () => {
    const headerRoot = parentElement.querySelector('#library-header-root');
    if (!headerRoot) {
      return;
    }

    const stories = getFilteredStories();
    headerRoot.innerHTML = `
      <div class="library-header">
        <div class="library-header__top">
          <div>
            <h1>Story Library</h1>
            <p class="text-muted" id="story-count-text">${stories.length} stories available</p>
          </div>
          <button id="create-btn" class="btn">
            <span>✨</span> Create New
          </button>
        </div>
      </div>
    `;

    events.on(headerRoot.querySelector('#create-btn'), 'click', openGeneratorModal);
  };

  /**
   * Updates just the controls (search and filters)
   */
  const updateControls = () => {
    const controlsRoot = parentElement.querySelector('#library-controls-root');
    if (!controlsRoot) {
      return;
    }

    const filters = ['All', 'Beginner', 'Intermediate', 'Advanced'];

    controlsRoot.innerHTML = `
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
          <button id="clear-search" class="search-box__clear ${searchQuery ? '' : 'hidden'}">✕</button>
        </div>
        
        <!-- Filters -->
        <div class="filters">
          ${filters
            .map(
              filter => `
            <button 
              class="filter-btn ${currentFilter === filter ? 'active' : ''}" 
              data-filter="${filter}"
            >
              ${filter}
            </button>
          `
            )
            .join('')}
        </div>
        
        <!-- Sort & View -->
        <div class="library-options">
          <select id="sort-select" class="form-select form-select--auto">
            <option value="newest" ${sortBy === 'newest' ? 'selected' : ''}>Newest First</option>
            <option value="oldest" ${sortBy === 'oldest' ? 'selected' : ''}>Oldest First</option>
            <option value="level-asc" ${sortBy === 'level-asc' ? 'selected' : ''}>Easiest First</option>
            <option value="level-desc" ${sortBy === 'level-desc' ? 'selected' : ''}>Hardest First</option>
          </select>

          <div class="view-toggle">
            <button class="icon-btn ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Grid view">▦</button>
            <button class="icon-btn ${viewMode === 'list' ? 'active' : ''}" data-view="list" title="List view">☰</button>
          </div>
        </div>
      </div>
    `;

    // Reattach control listeners with EventManager
    const searchInput = controlsRoot.querySelector('#search-input');
    events.on(
      searchInput,
      'input',
      debounce(e => {
        searchQuery = e.target.value;
        controlsRoot.querySelector('#clear-search')?.classList.toggle('hidden', !searchQuery);
        updateGrid();
      }, 300)
    );

    events.on(controlsRoot.querySelector('#clear-search'), 'click', () => {
      searchQuery = '';
      if (searchInput) {
        searchInput.value = '';
      }
      controlsRoot.querySelector('#clear-search')?.classList.add('hidden');
      updateGrid();
    });

    events.on(controlsRoot.querySelector('#sort-select'), 'change', e => {
      sortBy = e.target.value;
      updateGrid();
    });

    // Use delegation for view toggle buttons
    events.delegate(controlsRoot, 'click', '[data-view]', function () {
      viewMode = this.dataset.view;
      controlsRoot.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      updateGrid();
    });

    // Use delegation for filter buttons
    events.delegate(controlsRoot, 'click', '.filter-btn', function () {
      currentFilter = this.dataset.filter;
      controlsRoot.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      updateGrid();
    });
  };

  /**
   * Updates just the story grid/list
   */
  const updateGrid = () => {
    const contentRoot = parentElement.querySelector('#library-content-root');
    if (!contentRoot) {
      return;
    }

    const stories = getFilteredStories();

    // Update count in header if it exists
    const countText = parentElement.querySelector('#story-count-text');
    if (countText) {
      countText.textContent = `${stories.length} stories available`;
    }

    if (stories.length > 0) {
      contentRoot.innerHTML = `
        <div class="story-grid ${viewMode === 'list' ? 'story-grid--list' : ''}" id="story-container">
          ${stories.map(story => StoryCard(story)).join('')}
        </div>
      `;
      // Setup delegation for delete buttons (works for all current AND future story cards)
      setupGridListeners(contentRoot);
    } else {
      contentRoot.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📚</div>
          <h2 class="empty-state__title">No stories found</h2>
          <p class="empty-state__description">
            ${searchQuery ? `No stories match "${searchQuery}".` : 'Your library is empty.'}
          </p>
          <button id="empty-create-btn" class="btn">✨ Create Story</button>
        </div>
      `;
      events.on(contentRoot.querySelector('#empty-create-btn'), 'click', openGeneratorModal);
    }
  };

  /**
   * Grid item listeners using delegation for delete buttons
   */
  const setupGridListeners = root => {
    events.delegate(root, 'click', '.delete-story-btn', function (e) {
      e.preventDefault();
      e.stopPropagation();

      const id = this.dataset.id;
      const storyCard = this.closest('.story-card');
      const storyTitle =
        storyCard?.querySelector('.story-card__title')?.textContent || 'this story';

      const deletedStory = getStoredStories().find(s => s.id === id);
      deleteStory(id);

      if (storyCard) {
        storyCard.classList.add('story-card--deleting');
        setTimeout(() => updateGrid(), 200);
      }

      toast.success(`"${storyTitle}" deleted`, {
        action: deletedStory
          ? () => {
              const stories = getStoredStories();
              stories.unshift(deletedStory);
              localStorage.setItem('nihongo_stories', JSON.stringify(stories));
              updateGrid();
              toast.info('Story restored');
            }
          : null,
        actionLabel: 'Undo',
        duration: 5000,
      });
    });
  };

  /**
   * Open the story generator modal
   */
  const openGeneratorModal = () => {
    const modal = GeneratorModal({
      onClose: () => {},
      onGenerate: newStory => {
        toast.success(`"${newStory.titleEN}" created!`);
        updateGrid();
      },
    });
    document.body.appendChild(modal);
  };

  render();

  // Cleanup
  return () => {
    events.cleanup();
  };
};

// Styles now in external CSS: src/styles/pages/library.css

export default Library;
