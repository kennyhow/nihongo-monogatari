/**
 * Reader Component
 * Main reading interface with audio playback and progress tracking
 */

import { saveProgress, getStoryProgress, getSettings } from '../utils/storage.js';
import { playAudio, cancelAudio, getAudioState, isAudioCached } from '../utils/audio.js';
import { formatTime } from '../utils/componentBase.js';

/**
 * Create the Reader component
 * @param {Object} options
 * @param {Object} options.story - Story data
 * @param {Object} options.initialProgress - Previous reading progress
 * @param {Function} options.onComplete - Called when story is finished
 * @returns {HTMLElement} Reader container element
 */
const Reader = ({ story, initialProgress, onComplete }) => {
  const settings = getSettings();
  const isSideBySide = settings.viewMode === 'side-by-side';
  const showFurigana = settings.showFurigana;
  const showImages = settings.showImages !== false; // Default to true
  const fontSize = settings.fontSize === 'large' ? 'reader--large' : '';

  // State
  let currentProgress = initialProgress?.completed ? 100 : 0;
  let activeSegmentIndex = -1;
  let isPlaying = false;
  let isHQAvailable = false;
  let playbackProgress = 0;

  // Container element
  const container = document.createElement('div');
  container.className = 'reader-page';

  /**
   * Render the reader
   */
  const render = () => {
    container.innerHTML = `
      <div class="reader ${fontSize}">
        <!-- Sticky Header -->
        <div class="reader__header">
          <div class="reader__header-content">
            <div class="reader__title-section">
              <a href="#/library" class="btn btn--ghost btn--sm reader__back">
                ← Back
              </a>
              <div>
                <h1 class="reader__title jp-title">${story.titleJP}</h1>
                <p class="reader__subtitle">${story.titleEN}</p>
              </div>
            </div>
            
            <div class="reader__controls">
              <button id="settings-btn" class="icon-btn" title="Reading settings">⚙️</button>
              ${isPlaying ? `
                <button id="stop-btn" class="btn btn--secondary btn--sm">
                  ⏹ Stop
                </button>
              ` : `
                ${isHQAvailable ? `
                  <button id="play-hq-btn" class="btn btn--sm btn--accent" title="Play High-Quality AI Voice">
                    ✨ Play HQ Story
                  </button>
                ` : `
                  <div class="loader-sm" title="Generating high-quality audio..."></div>
                `}
              `}
            </div>
          </div>
          
          <!-- Reading Progress -->
          <div class="reader__progress">
            <div class="progress">
              <div class="progress__bar" style="width: ${currentProgress}%"></div>
            </div>
            <span class="reader__progress-text">${Math.round(currentProgress)}% complete</span>
          </div>
        </div>

        <!-- Audio Player (when playing) -->
        ${isPlaying ? `
          <div class="audio-player">
            <div class="audio-player__info">
              <span class="audio-player__status">
                ${activeSegmentIndex === -1 ? '✨ Playing High-Quality AI Voice' : `🔊 Playing segment ${activeSegmentIndex + 1}/${story.content.length}`}
              </span>
            </div>
            <div class="audio-player__progress">
              <div class="audio-player__bar" style="width: ${playbackProgress}%"></div>
            </div>
          </div>
        ` : ''}

        <!-- Story Content -->
        <div class="reader__content ${isSideBySide ? 'reader__content--side-by-side' : ''}">
          ${story.content.map((segment, index) => `
            <div 
              class="segment ${activeSegmentIndex === index ? 'segment--active' : ''} ${activeSegmentIndex !== -1 && activeSegmentIndex !== index ? 'segment--dimmed' : ''}"
              id="segment-${index}"
              data-index="${index}"
            >
              <!-- Image Container -->
              <div class="segment__image-container ${!showImages ? 'hidden' : ''}" id="image-container-${index}">
                 <div class="segment__image-skeleton skeleton"></div>
              </div>

              <div class="segment__jp">
                <p class="segment__jp-text jp-text">
                  ${showFurigana && segment.jp_furigana ? segment.jp_furigana : segment.jp}
                </p>
              </div>
              
              <div class="segment__en">
                <p>${segment.en}</p>
                
                ${segment.notes && segment.notes.length > 0 ? `
                  <div class="segment__notes">
                    ${segment.notes.map(note => `
                      <div class="segment__note">
                        <span class="segment__note-term">${note.term}:</span>
                        <span class="segment__note-meaning">${note.meaning}</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Footer Actions -->
        <div class="reader__footer">
          <button id="complete-btn" class="btn btn--lg">
            ✓ Finish Story
          </button>
        </div>
      </div>

      <!-- Settings Panel (hidden by default) -->
      <div id="settings-panel" class="settings-panel hidden">
        <div class="settings-panel__content">
          <h3>Reading Settings</h3>
          
          <label class="form-check">
            <input type="checkbox" id="toggle-furigana" ${showFurigana ? 'checked' : ''}>
            Show Furigana
          </label>
          
          <label class="form-check">
            <input type="checkbox" id="toggle-side-by-side" ${isSideBySide ? 'checked' : ''}>
            Side-by-Side View
          </label>
          
          <label class="form-check">
            <input type="checkbox" id="toggle-images" ${showImages ? 'checked' : ''}>
            Show Images
          </label>
          
          <button id="close-settings" class="btn btn--secondary btn--sm mt-4">Close</button>
        </div>
      </div>
    `;

    setupListeners();
  };

  /**
   * Setup event listeners
   */
  const setupListeners = () => {
    // Stop button
    container.querySelector('#stop-btn')?.addEventListener('click', stopPlayback);

    // Play HQ button
    container.querySelector('#play-hq-btn')?.addEventListener('click', () => {
      activeSegmentIndex = -1; // Playing whole story, not specific segment
      isPlaying = true;
      render();
      playAudio(story.content[0].jp, () => {
        isPlaying = false;
        render();
      }, story.id);
    });

    // Complete button
    container.querySelector('#complete-btn')?.addEventListener('click', () => {
      saveProgress(story.id, { completed: true, scrollPercent: 100 });
      cancelAudio();
      if (onComplete) onComplete();
    });

    // Settings panel
    container.querySelector('#settings-btn')?.addEventListener('click', () => {
      container.querySelector('#settings-panel')?.classList.toggle('hidden');
    });

    container.querySelector('#close-settings')?.addEventListener('click', () => {
      container.querySelector('#settings-panel')?.classList.add('hidden');
    });

    // Settings toggles (these would normally trigger a re-render with new settings)
    container.querySelector('#toggle-furigana')?.addEventListener('change', (e) => {
      // Save and re-render would happen here
      // For now just visual toggle
      const jpTexts = container.querySelectorAll('.segment__jp-text');
      jpTexts.forEach((el, i) => {
        el.innerHTML = e.target.checked && story.content[i].jp_furigana
          ? story.content[i].jp_furigana
          : story.content[i].jp;
      });
    });

    // Toggle images
    container.querySelector('#toggle-images')?.addEventListener('change', (e) => {
      const isVisible = e.target.checked;
      const containers = container.querySelectorAll('.segment__image-container');
      containers.forEach(el => {
        if (isVisible) el.classList.remove('hidden');
        else el.classList.add('hidden');
      });
    });

    // Track scroll progress
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercent = Math.min(100, Math.round((scrollTop / docHeight) * 100));

      if (scrollPercent > currentProgress) {
        currentProgress = scrollPercent;
        saveProgress(story.id, { scrollPercent, completed: false });

        // Update progress bar
        const progressBar = container.querySelector('.progress__bar');
        const progressText = container.querySelector('.reader__progress-text');
        if (progressBar) progressBar.style.width = `${currentProgress}%`;
        if (progressText) progressText.textContent = `${Math.round(currentProgress)}% complete`;
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Store cleanup
    container._cleanup = () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAudio();
    };
  };

  /**
   * Stop playback
   */
  const stopPlayback = () => {
    cancelAudio();
    activeSegmentIndex = -1;
    isPlaying = false;
    render();
  };

  // Initial check for HQ audio
  isAudioCached(story.id).then(available => {
    isHQAvailable = available;
    render();
  });

  /**
   * Load images sequentially
   */
  const loadImages = async () => {
    if (!showImages) return;

    for (let i = 0; i < story.content.length; i++) {
      const segment = story.content[i];
      const containerId = `image-container-${i}`;
      const imgContainer = container.querySelector(`#${containerId}`);

      if (!imgContainer) continue;

      // Use the Japanese text as the prompt for Pollinations
      // We add "anime style, high quality, soft colors" to keep it consistent
      const apiKey = import.meta.env.VITE_POLLINATIONS_AI_KEY;
      const prompt = encodeURIComponent(`${segment.jp}, anime style, soft colors`);
      const imageUrl = `https://gen.pollinations.ai/image/${prompt}?model=zimage`;

      try {
        const response = await fetch(imageUrl, {
          headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
        });

        if (!response.ok) {
          throw new Error(`Pollinations API error: ${response.status}`);
        }

        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);

        const img = new Image();
        img.className = 'segment__image animate-fade-in';
        img.alt = segment.en;
        img.src = objectURL;

        imgContainer.innerHTML = '';
        imgContainer.appendChild(img);
      } catch (error) {
        console.error(`Failed to load image for segment ${i}:`, error);
        imgContainer.classList.add('hidden');
      }
    }
  };

  // Start loading images after a small delay to prioritize text
  setTimeout(loadImages, 500);

  // Return container with cleanup
  return container;
};

// Add reader-specific styles
const readerStyles = document.createElement('style');
readerStyles.textContent = `
  .reader-page {
    position: relative;
  }

  .reader {
    max-width: var(--container-md);
    margin: 0 auto;
    padding-bottom: var(--space-20);
  }
  
  .reader--large .segment__jp-text {
    font-size: var(--text-2xl);
  }

  .reader__header {
    position: sticky;
    top: var(--header-height);
    z-index: 10;
    background: var(--color-surface-overlay);
    backdrop-filter: blur(12px);
    padding: var(--space-4) 0;
    margin: 0 calc(-1 * var(--space-4));
    padding-left: var(--space-4);
    padding-right: var(--space-4);
    border-bottom: 1px solid var(--color-border);
    margin-bottom: var(--space-6);
  }
  
  .reader__header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  
  .reader__title-section {
    display: flex;
    align-items: flex-start;
    gap: var(--space-4);
  }
  
  .reader__back {
    flex-shrink: 0;
  }
  
  .reader__title {
    font-size: var(--text-xl);
    margin-bottom: var(--space-1);
  }
  
  .reader__subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  
  .reader__controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .reader__progress {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  
  .reader__progress .progress {
    flex: 1;
  }
  
  .reader__progress-text {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /* Audio Player */
  .audio-player {
    position: fixed;
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--space-3) var(--space-5);
    box-shadow: var(--shadow-lg);
    z-index: 100;
    min-width: 280px;
  }
  
  .audio-player__info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-2);
  }
  
  .audio-player__status {
    font-size: var(--text-sm);
    font-weight: 500;
  }
  
  .audio-player__progress {
    height: 4px;
    background: var(--color-bg-subtle);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  
  .audio-player__bar {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.1s linear;
  }

  /* Content Layout */
  .reader__content {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
  }
  
  .reader__content--side-by-side .segment {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
    align-items: start;
  }
  
  @media (max-width: 768px) {
    .reader__content--side-by-side .segment {
      grid-template-columns: 1fr;
    }
  }

  /* Footer */
  .reader__footer {
    text-align: center;
    margin-top: var(--space-12);
    padding-top: var(--space-8);
    border-top: 1px solid var(--color-border);
  }

  /* Settings Panel */
  .settings-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 300px;
    max-width: 100vw;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    box-shadow: var(--shadow-xl);
    z-index: 200;
    padding: var(--space-6);
    animation: slideInRight 0.3s var(--ease-out);
  }
  
  .settings-panel.hidden {
    display: none;
  }
  
  .settings-panel__content h3 {
    margin-bottom: var(--space-6);
  }
  
  .settings-panel .form-check {
    margin-bottom: var(--space-4);
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(readerStyles);

export default Reader;
