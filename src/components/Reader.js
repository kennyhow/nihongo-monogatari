/**
 * Reader Component
 * Main reading interface with audio playback and progress tracking.
 * Refactored to use granular updates and avoid full DOM overwrites.
 */

import { saveProgress, getStoryProgress, getSettings, getApiKeys } from '../utils/storage.js';
import { playAudio, cancelAudio, getAudioState, isAudioCached } from '../utils/audio.js';
import { formatTime } from '../utils/componentBase.js';
import { KANA_DATA } from '../data/kana.js';
import { getCachedImage, cacheImage } from '../utils/imageStorage.js';

/**
 * Create the Reader component
 */
const Reader = ({ story, initialProgress, onComplete }) => {
  const settings = getSettings();
  let isSideBySide = settings.viewMode === 'side-by-side';
  let showFurigana = settings.showFurigana;
  let showImages = settings.showImages !== false;
  let fontSizeClass = settings.fontSize === 'large' ? 'reader--large' : '';

  // State
  let currentProgress = initialProgress?.completed ? 100 : 0;
  let activeSegmentIndex = -1;
  let isPlaying = false;
  let isHQAvailable = false;
  let playbackProgress = 0;
  let isLoadingImages = false;
  let kanaSystem = 'hiragana';

  // Container element
  const container = document.createElement('div');
  container.className = 'reader-page';

  /**
   * Initial setup of the base structure
   */
  const initializeLayout = () => {
    container.innerHTML = `
      <div class="reader ${fontSizeClass}">
        <!-- Sticky Header (Managed separately) -->
        <div id="reader-header-root" class="reader__header"></div>

        <!-- Audio Player Overlay (Managed separately) -->
        <div id="audio-player-root"></div>

        <!-- Story Content (Managed separately) -->
        <div id="reader-content-root" class="reader__content ${isSideBySide ? 'reader__content--side-by-side' : ''}"></div>

        <!-- Footer Actions -->
        <div class="reader__footer">
          <button id="complete-btn" class="btn btn--lg">
            ✓ Finish Story
          </button>
        </div>
      </div>

      <!-- Settings Panel -->
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

      <!-- Kana Panel -->
      <div id="kana-panel" class="kana-panel hidden">
        <div class="kana-panel__content">
          <div class="kana-panel__header">
            <h3>Kana Chart</h3>
            <div class="kana-panel__system-toggle">
               <button class="panel-toggle-btn active" data-sys="hiragana">あ</button>
               <button class="panel-toggle-btn" data-sys="katakana">ア</button>
            </div>
          </div>
          <div id="panel-kana-grid" class="panel-kana-grid"></div>
          <button id="close-kana" class="btn btn--secondary btn--sm mt-4 w-full">Close</button>
        </div>
      </div>
    `;

    updateHeader();
    updateContent();
    setupListeners();
    loadImages();
  };

  /**
   * Update the header section without wiping the whole page
   */
  const updateHeader = () => {
    const headerRoot = container.querySelector('#reader-header-root');
    if (!headerRoot) return;

    headerRoot.innerHTML = `
      <div class="reader__header-content">
        <div class="reader__title-section">
          <a href="#/library" class="btn btn--ghost btn--sm reader__back">← Back</a>
          <div>
            <h1 class="reader__title jp-title">${story.titleJP}</h1>
            <p class="reader__subtitle">${story.titleEN}</p>
          </div>
        </div>
        
        <div class="reader__controls">
          <button id="kana-btn" class="icon-btn" title="Kana chart reference">🔤</button>
          <button id="settings-btn" class="icon-btn" title="Reading settings">⚙️</button>
          ${isPlaying ? `
            <button id="stop-btn" class="btn btn--secondary btn--sm">⏹ Stop</button>
          ` : `
            ${isHQAvailable ? `
              <button id="play-hq-btn" class="btn btn--sm btn--accent" title="Play High-Quality AI Voice">✨ Play HQ Story</button>
            ` : `
              <div class="loader-sm" title="Generating high-quality audio..."></div>
            `}
          `}
        </div>
      </div>
      
      <div class="reader__progress">
        <div class="progress">
          <div class="progress__bar" style="width: ${currentProgress}%"></div>
        </div>
        <span class="reader__progress-text">${Math.round(currentProgress)}% complete</span>
      </div>
    `;

    // Re-attach specific header listeners
    headerRoot.querySelector('#stop-btn')?.addEventListener('click', stopPlayback);
    headerRoot.querySelector('#play-hq-btn')?.addEventListener('click', startPlayback);
    headerRoot.querySelector('#settings-btn')?.addEventListener('click', toggleSettings);
    headerRoot.querySelector('#kana-btn')?.addEventListener('click', toggleKanaPanel);
  };

  /**
   * Update the audio player overlay
   */
  const updateAudioUI = () => {
    const audioRoot = container.querySelector('#audio-player-root');
    if (!audioRoot) return;

    if (!isPlaying) {
      audioRoot.innerHTML = '';
      return;
    }

    audioRoot.innerHTML = `
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
    `;
  };

  /**
   * Wrap kana characters for lookup
   */
  const wrapKana = (text) => {
    if (!text) return '';
    // Wrap Hiragana (\u3040-\u309F) and Katakana (\u30A0-\u30FF)
    return text.replace(/([\u3040-\u309F\u30A0-\u30FF])/g, '<span class="kana-lookup" data-char="$1">$1</span>');
  };

  /**
   * Update story content area
   */
  const updateContent = () => {
    const contentRoot = container.querySelector('#reader-content-root');
    if (!contentRoot) return;

    if (contentRoot.children.length === 0) {
      contentRoot.innerHTML = story.content.map((segment, index) => `
        <div class="segment" id="segment-${index}" data-index="${index}">
          <div class="segment__image-container ${!showImages ? 'hidden' : ''}" id="image-container-${index}">
             <div class="segment__image-skeleton skeleton"></div>
          </div>
          <div class="segment__jp">
            <p class="segment__jp-text jp-text">
              ${wrapKana(showFurigana && segment.jp_furigana ? segment.jp_furigana : segment.jp)}
            </p>
          </div>
          <div class="segment__en">
            <p>${segment.en}</p>
            ${segment.notes?.length > 0 ? `
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
      `).join('');
    }

    // Update active/dimmed states
    story.content.forEach((_, index) => {
      const el = container.querySelector(`#segment-${index}`);
      if (el) {
        el.classList.toggle('segment--active', activeSegmentIndex === index);
        el.classList.toggle('segment--dimmed', activeSegmentIndex !== -1 && activeSegmentIndex !== index);
      }
    });
  };

  /**
   * Initial listeners
   */
  const setupListeners = () => {
    container.querySelector('#complete-btn')?.addEventListener('click', () => {
      saveProgress(story.id, { completed: true, scrollPercent: 100 });
      cancelAudio();
      if (onComplete) onComplete();
    });

    container.querySelector('#close-settings')?.addEventListener('click', toggleSettings);
    container.querySelector('#close-kana')?.addEventListener('click', toggleKanaPanel);

    container.querySelector('#toggle-furigana')?.addEventListener('change', (e) => {
      showFurigana = e.target.checked;
      const jpTexts = container.querySelectorAll('.segment__jp-text');
      jpTexts.forEach((el, i) => {
        el.innerHTML = wrapKana(showFurigana && story.content[i].jp_furigana
          ? story.content[i].jp_furigana
          : story.content[i].jp);
      });
    });

    // Hover lookup logic
    const contentRoot = container.querySelector('#reader-content-root');
    contentRoot?.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.kana-lookup');
      const panel = container.querySelector('#kana-panel');
      if (!target || panel?.classList.contains('hidden')) return;

      const char = target.dataset.char;
      const isKatakana = /[\u30A0-\u30FF]/.test(char);
      const system = isKatakana ? 'katakana' : 'hiragana';

      // Switch system if needed
      if (system !== kanaSystem) {
        kanaSystem = system;
        container.querySelectorAll('.panel-toggle-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.sys === system);
        });
        renderPanelKana();
      }

      // Highlight in grid
      const cards = container.querySelectorAll('.panel-kana-card');
      cards.forEach(card => {
        const charEl = card.querySelector('.panel-kana-char');
        if (charEl?.textContent === char) {
          card.classList.add('highlight');
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          card.classList.remove('highlight');
        }
      });
    });

    container.querySelector('#toggle-side-by-side')?.addEventListener('change', (e) => {
      isSideBySide = e.target.checked;
      const contentRoot = container.querySelector('#reader-content-root');
      contentRoot?.classList.toggle('reader__content--side-by-side', isSideBySide);
    });

    container.querySelector('#toggle-images')?.addEventListener('change', (e) => {
      showImages = e.target.checked;
      container.querySelectorAll('.segment__image-container').forEach(el => {
        el.classList.toggle('hidden', !showImages);
      });
      if (showImages) loadImages();
    });

    container.querySelectorAll('.panel-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        kanaSystem = e.target.dataset.sys;
        container.querySelectorAll('.panel-toggle-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderPanelKana();
      });
    });

    window.addEventListener('scroll', handleScroll);
    container._cleanup = () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAudio();
    };
  };

  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.min(100, Math.round((scrollTop / (docHeight || 1)) * 100));

    if (scrollPercent > currentProgress) {
      currentProgress = scrollPercent;
      saveProgress(story.id, { scrollPercent, completed: false });

      const bar = container.querySelector('.progress__bar');
      const txt = container.querySelector('.reader__progress-text');
      if (bar) bar.style.width = `${currentProgress}%`;
      if (txt) txt.textContent = `${Math.round(currentProgress)}% complete`;
    }
  };

  const toggleSettings = () => {
    container.querySelector('#settings-panel')?.classList.toggle('hidden');
  };

  const toggleKanaPanel = () => {
    const panel = container.querySelector('#kana-panel');
    panel?.classList.toggle('hidden');
    if (!panel?.classList.contains('hidden')) {
      renderPanelKana();
    }
  };

  const renderPanelKana = () => {
    const grid = container.querySelector('#panel-kana-grid');
    if (!grid) return;
    grid.innerHTML = KANA_DATA[kanaSystem].map(item => `
      <div class="panel-kana-card ${!item.kana ? 'empty' : ''}">
        ${item.kana ? `
          <div class="panel-kana-char">${item.kana}</div>
          <div class="panel-kana-romaji">${item.romaji}</div>
        ` : ''}
      </div>
    `).join('');
  };

  const startPlayback = () => {
    activeSegmentIndex = -1;
    isPlaying = true;
    updateHeader();
    updateAudioUI();
    updateContent();

    playAudio(story.content[0].jp, () => {
      isPlaying = false;
      activeSegmentIndex = -1;
      updateHeader();
      updateAudioUI();
      updateContent();
    }, story.id);
  };

  const stopPlayback = () => {
    cancelAudio();
    isPlaying = false;
    activeSegmentIndex = -1;
    updateHeader();
    updateAudioUI();
    updateContent();
  };

  const loadImages = async () => {
    if (!showImages || isLoadingImages) return;
    isLoadingImages = true;

    try {
      for (let i = 0; i < story.content.length; i++) {
        const imgContainer = container.querySelector(`#image-container-${i}`);
        if (!imgContainer || imgContainer.querySelector('.segment__image')) continue;

        const cachedUrl = await getCachedImage(story.id, i);
        if (cachedUrl) {
          const img = new Image();
          img.className = 'segment__image animate-fade-in';
          img.src = cachedUrl;
          imgContainer.innerHTML = '';
          imgContainer.appendChild(img);
          continue;
        }

        const apiKeys = getApiKeys();
        const apiKey = apiKeys.pollinations || import.meta.env.VITE_POLLINATIONS_AI_KEY;
        const prompt = encodeURIComponent(`${story.content[i].jp}, anime style, soft colors`);
        const imageUrl = `https://gen.pollinations.ai/image/${prompt}?model=zimage`;

        try {
          const response = await fetch(imageUrl, {
            headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
          });
          if (!response.ok) throw new Error('API Error');
          const blob = await response.blob();
          await cacheImage(story.id, i, blob);
          const objectURL = URL.createObjectURL(blob);
          const img = new Image();
          img.className = 'segment__image animate-fade-in';
          img.src = objectURL;
          imgContainer.innerHTML = '';
          imgContainer.appendChild(img);
        } catch (error) {
          console.error('Image load failed', error);
          imgContainer.classList.add('hidden');
        }
      }
    } finally {
      isLoadingImages = false;
    }
  };

  // Check for audio availability and start
  isAudioCached(story.id).then(available => {
    isHQAvailable = available;
    initializeLayout();
  });

  return container;
};

// Styles (same as before)
const readerStyles = document.createElement('style');
readerStyles.textContent = `
  .reader-page { position: relative; }
  .reader { max-width: var(--container-md); margin: 0 auto; padding-bottom: var(--space-20); }
  .reader--large .segment__jp-text { font-size: var(--text-2xl); }
  .reader__header { position: sticky; top: var(--header-height); z-index: 10; background: var(--color-surface-overlay); backdrop-filter: blur(12px); padding: var(--space-4); border-bottom: 1px solid var(--color-border); margin: 0 calc(-1 * var(--space-4)) var(--space-6); }
  .reader__header-content { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-4); margin-bottom: var(--space-4); }
  .reader__title-section { display: flex; align-items: flex-start; gap: var(--space-4); }
  .reader__title { font-size: var(--text-xl); margin-bottom: var(--space-1); }
  .reader__subtitle { font-size: var(--text-sm); color: var(--color-text-muted); }
  .reader__controls { display: flex; align-items: center; gap: var(--space-2); }
  .reader__progress { display: flex; align-items: center; gap: var(--space-3); }
  .reader__progress .progress { flex: 1; }
  .reader__progress-text { font-size: var(--text-xs); color: var(--color-text-muted); white-space: nowrap; }
  .audio-player { position: fixed; bottom: var(--space-6); left: 50%; transform: translateX(-50%); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-3) var(--space-5); box-shadow: var(--shadow-lg); z-index: 100; min-width: 280px; }
  .audio-player__info { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-2); }
  .audio-player__status { font-size: var(--text-sm); font-weight: 500; }
  .audio-player__progress { height: 4px; background: var(--color-bg-subtle); border-radius: var(--radius-full); overflow: hidden; }
  .audio-player__bar { height: 100%; background: var(--color-primary); transition: width 0.1s linear; }
  .reader__content { display: flex; flex-direction: column; gap: var(--space-8); }
  .reader__content--side-by-side .segment { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6); align-items: start; }
  @media (max-width: 768px) { .reader__content--side-by-side .segment { grid-template-columns: 1fr; } }
  .reader__footer { text-align: center; margin-top: var(--space-12); padding-top: var(--space-8); border-top: 1px solid var(--color-border); }
  .settings-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 300px; max-width: 100vw; background: var(--color-surface); border-left: 1px solid var(--color-border); box-shadow: var(--shadow-xl); z-index: 200; padding: var(--space-6); animation: slideInRight 0.3s var(--ease-out); }
  .settings-panel.hidden { display: none; }
  .kana-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 320px; max-width: 100vw; background: var(--color-surface); border-left: 1px solid var(--color-border); box-shadow: var(--shadow-xl); z-index: 200; padding: var(--space-4); animation: slideInRight 0.3s var(--ease-out); display: flex; flex-direction: column; }
  .kana-panel.hidden { display: none; }
  .kana-panel__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--color-border); }
  .kana-panel__system-toggle { display: flex; background: var(--color-bg-subtle); padding: 2px; border-radius: var(--radius-md); }
  .panel-toggle-btn { padding: var(--space-1) var(--space-3); border: none; background: none; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); font-weight: 600; transition: all var(--duration-fast); }
  .panel-toggle-btn.active { background: var(--color-surface); color: var(--color-primary); box-shadow: var(--shadow-sm); }
  .panel-kana-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; overflow-y: auto; padding-right: var(--space-2); flex: 1; scroll-behavior: smooth; }
  .panel-kana-card { background: var(--color-bg-subtle); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: var(--space-2) var(--space-1); text-align: center; transition: all var(--duration-fast); }
  .panel-kana-card.empty { visibility: hidden; }
  .panel-kana-card.highlight { background: var(--color-primary-light); border-color: var(--color-primary); transform: scale(1.05); box-shadow: var(--shadow-md); z-index: 1; }
  .panel-kana-char { font-size: var(--text-lg); font-weight: 600; }
  .panel-kana-romaji { font-size: 10px; color: var(--color-text-muted); text-transform: uppercase; }
  
  .kana-lookup { cursor: help; border-bottom: 1px dotted transparent; transition: all var(--duration-fast); }
  .kana-lookup:hover { color: var(--color-primary); border-bottom-color: var(--color-primary); }
  @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
`;
document.head.appendChild(readerStyles);

export default Reader;
