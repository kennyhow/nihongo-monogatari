/**
 * Reader Component
 * Main reading interface with audio playback and progress tracking.
 * Refactored to use granular updates and avoid full DOM overwrites.
 */

import { saveProgress, getSettings, saveSettings, getApiKeys } from '../utils/storage.js';
import {
  playAudio,
  cancelAudio,
  isAudioAvailable,
  togglePause,
  jumpForward,
  jumpBackward,
  seekTo,
  setPlaybackRate,
  subscribeToProgress,
} from '../utils/audio.js';
import { createEventManager } from '../utils/componentBase.js';
import { KANA_DATA } from '../data/kana.js';
import { getCachedImage, cacheImage } from '../utils/imageStorage.js';
import { createAudioGenerationJob } from '../services/api.js';
import { supabase } from '../utils/supabase.js';

/**
 * Logger utility for consistent debugging
 */
const logger = {
  debug: (...args) => {
    if (import.meta.env.DEV) {
      console.log('[Reader]', ...args);
    }
  },
  info: (...args) => console.info('[Reader]', ...args),
  warn: (...args) => console.warn('[Reader]', ...args),
  error: (...args) => console.error('[Reader]', ...args),
};

/**
 * Constants for audio playback
 */
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];
const DEFAULT_SPEED = 1.0;

/**
 * Helper Functions
 */

/**
 * Format time in seconds to M:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string (e.g., "2:34")
 */
const formatTime = seconds => {
  if (!seconds || isNaN(seconds)) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Find the closest speed index for boundary handling
 * @param {number} targetSpeed - The target speed
 * @param {number[]} speeds - Array of available speeds
 * @returns {number} Index of closest speed
 */
const findClosestSpeedIndex = (targetSpeed, speeds) => {
  return speeds.reduce((prevIndex, curr, currIndex, array) => {
    return Math.abs(curr - targetSpeed) < Math.abs(array[prevIndex] - targetSpeed)
      ? currIndex
      : prevIndex;
  }, 0);
};

/**
 * Create the Reader component
 */
const Reader = ({ story, initialProgress, onComplete }) => {
  // Event manager for all reader events
  const events = createEventManager();

  const settings = getSettings();
  let isSideBySide = settings.viewMode === 'side-by-side';
  let showFurigana = settings.showFurigana;
  let showEnglish = settings.showEnglish !== false;
  let showImages = settings.showImages !== false;
  let fontSizeClass = settings.fontSize === 'large' ? 'reader--large' : '';

  // State
  let currentProgress = initialProgress?.completed ? 100 : 0;
  let activeSegmentIndex = -1;
  let isPlaying = false;
  let isPaused = false;
  let audioProgress = { currentTime: 0, duration: 0, progress: 0 };
  let playbackSpeed = 1.0;
  let isAudioLoading = false;
  let unsubscribeProgress = null;
  let isHQAvailable = false;
  let isLoadingImages = false;

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

        <!-- Comprehension Check (New) -->
        <div id="comprehension-root" class="reader__comprehension"></div>

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
          <div class="settings-panel__header">
            <h3>Reading Settings</h3>
            <button id="close-settings" class="icon-btn">✕</button>
          </div>

          <!-- Display Section -->
          <div class="settings-section">
            <h4 class="settings-section__title">Display</h4>
            <label class="form-check">
              <input type="checkbox" id="toggle-furigana" ${showFurigana ? 'checked' : ''}>
              <div>
                <span class="form-check__label">Show Furigana</span>
                <span class="form-check__hint">Reading aid above kanji</span>
              </div>
            </label>
            <label class="form-check">
              <input type="checkbox" id="toggle-english" ${showEnglish ? 'checked' : ''}>
              <div>
                <span class="form-check__label">Show English Translation</span>
                <span class="form-check__hint">English text below Japanese</span>
              </div>
            </label>
            <label class="form-check">
              <input type="checkbox" id="toggle-images" ${showImages ? 'checked' : ''}>
              <div>
                <span class="form-check__label">Show Images</span>
                <span class="form-check__hint">AI-generated illustrations</span>
              </div>
            </label>
          </div>

          <!-- Layout Section -->
          <div class="settings-section">
            <h4 class="settings-section__title">Layout</h4>
            <label class="form-check">
              <input type="checkbox" id="toggle-side-by-side" ${isSideBySide ? 'checked' : ''}>
              <div>
                <span class="form-check__label">Side-by-Side View</span>
                <span class="form-check__hint">Japanese and English together</span>
              </div>
            </label>
          </div>

          <!-- Font Size Section -->
          <div class="settings-section">
            <h4 class="settings-section__title">Text Size</h4>
            <div class="font-size-controls">
              <button class="font-size-btn ${!fontSizeClass ? 'active' : ''}" data-size="medium">
                <span class="font-size-preview">A</span>
                Medium
              </button>
              <button class="font-size-btn ${fontSizeClass === 'reader--large' ? 'active' : ''}" data-size="large">
                <span class="font-size-preview large">A</span>
                Large
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Kana Pronunciation Tooltip -->
      <div id="kana-tooltip" class="kana-tooltip hidden">
        <span id="kana-tooltip-char" class="kana-tooltip-char"></span>
        <span id="kana-tooltip-romaji" class="kana-tooltip-romaji"></span>
      </div>
    `;

    updateHeader();
    updateContent();
    updateComprehension();
    setupListeners();
    setupKeyboardShortcuts();
    loadImages();
  };

  /**
   * Update the header section without wiping the whole page
   */
  const updateHeader = () => {
    const headerRoot = container.querySelector('#reader-header-root');
    if (!headerRoot) {
      return;
    }

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
          <button id="settings-btn" class="icon-btn" title="Reading settings">⚙️</button>
          ${
            isPlaying
              ? `
            <button id="stop-btn" class="btn btn--secondary btn--sm">⏹ Stop</button>
          `
              : `
            ${
              isHQAvailable
                ? `
              <button id="play-hq-btn" class="btn btn--sm btn--accent" title="Play High-Quality AI Voice">✨ Play HQ Story</button>
            `
                : `
              <div class="loader-sm" title="Generating high-quality audio..."></div>
            `
            }
          `
          }
        </div>
      </div>

      <div class="reader__progress">
        <div class="progress">
          <div class="progress__bar" style="width: ${currentProgress}%"></div>
        </div>
        <span class="reader__progress-text">${Math.round(currentProgress)}% complete</span>
      </div>
    `;

    // Re-attach specific header listeners with EventManager
    // Only attach if elements exist (they're conditionally rendered)
    const stopBtn = headerRoot.querySelector('#stop-btn');
    const playHqBtn = headerRoot.querySelector('#play-hq-btn');
    const settingsBtn = headerRoot.querySelector('#settings-btn');

    if (stopBtn) {
      events.on(stopBtn, 'click', stopPlayback);
    }
    if (playHqBtn) {
      events.on(playHqBtn, 'click', startPlayback);
    }
    if (settingsBtn) {
      events.on(settingsBtn, 'click', toggleSettings);
    }
  };

  /**
   * Update the audio player overlay
   */
  const updateAudioUI = () => {
    const audioRoot = container.querySelector('#audio-player-root');
    if (!audioRoot) {
      return;
    }

    if (!isPlaying) {
      audioRoot.innerHTML = '';
      return;
    }

    // Show loading state if duration is NaN or audio is loading
    if (isAudioLoading || isNaN(audioProgress.duration)) {
      audioRoot.innerHTML = `
        <div class="audio-player">
          <div class="audio-player__status">⏳ Loading audio...</div>
        </div>
      `;
      return;
    }

    audioRoot.innerHTML = `
      <div class="audio-player">
        <!-- Status row: status text + speed control -->
        <div class="audio-player__status-row">
          <span class="audio-player__status">
            ${
              isNaN(audioProgress.duration)
                ? '⏳ Loading...'
                : `${isPaused ? '⏸ Paused' : '▶ Playing'} - ${formatTime(audioProgress.currentTime)} / ${formatTime(audioProgress.duration)}`
            }
          </span>
          <select id="speed-control" class="audio-player__speed" title="Playback speed">
            ${PLAYBACK_SPEEDS.map(speed => `<option value="${speed}" ${playbackSpeed === speed ? 'selected' : ''}>${speed}x</option>`).join('')}
          </select>
        </div>

        <!-- Progress bar with scrubbing -->
        <div class="audio-player__progress-container">
          <div class="audio-player__progress-bar" id="progress-bar">
            <div class="audio-player__progress-fill" style="width: ${audioProgress.progress}%"></div>
            <div class="audio-player__progress-handle" style="left: ${audioProgress.progress}%"></div>
          </div>
        </div>

        <!-- Control buttons -->
        <div class="audio-player__controls">
          <button id="jump-back-btn" class="audio-player__btn" title="Rewind 5s (Shift+←)">⏪ -5s</button>
          <button id="play-pause-btn" class="audio-player__btn audio-player__btn--primary" title="Play/Pause (Space)">
            ${isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button id="jump-forward-btn" class="audio-player__btn" title="Forward 5s (Shift+→)">⏩ +5s</button>
        </div>
      </div>
    `;

    // Setup control listeners after rendering
    setupAudioControlListeners();
  };

  /**
   * Update only the progress-related DOM elements (performance optimization)
   * Avoids full DOM rebuild on every timeupdate event
   * @param {Object} progress - Progress object with currentTime, duration, progress
   */
  const updateAudioProgress = progress => {
    const audioRoot = container.querySelector('#audio-player-root');
    if (!audioRoot || !isPlaying) {
      return;
    }

    // Update only progress-related elements (don't rebuild entire DOM)
    const statusEl = audioRoot.querySelector('.audio-player__status');
    const progressFill = audioRoot.querySelector('.audio-player__progress-fill');
    const progressHandle = audioRoot.querySelector('.audio-player__progress-handle');

    if (statusEl) {
      statusEl.textContent = `${isPaused ? '⏸ Paused' : '▶ Playing'} - ${formatTime(progress.currentTime)} / ${formatTime(progress.duration)}`;
    }
    if (progressFill) {
      progressFill.style.width = `${progress.progress}%`;
    }
    if (progressHandle) {
      progressHandle.style.left = `${progress.progress}%`;
    }
  };

  /**
   * Setup audio control event listeners
   */
  const setupAudioControlListeners = () => {
    // Play/Pause button
    const playPauseBtn = container.querySelector('#play-pause-btn');
    if (playPauseBtn) {
      events.on(playPauseBtn, 'click', async () => {
        const wasPaused = isPaused;
        isPaused = await togglePause();

        // Only update if state actually changed
        if (wasPaused !== isPaused) {
          updateHeader();
          updateAudioUI();
        }
      });
    }

    // Jump buttons
    const jumpBackBtn = container.querySelector('#jump-back-btn');
    const jumpForwardBtn = container.querySelector('#jump-forward-btn');

    if (jumpBackBtn) {
      events.on(jumpBackBtn, 'click', () => {
        jumpBackward(5);
      });
    }

    if (jumpForwardBtn) {
      events.on(jumpForwardBtn, 'click', () => {
        jumpForward(5);
      });
    }

    // Speed control
    const speedControl = container.querySelector('#speed-control');
    if (speedControl) {
      events.on(speedControl, 'change', e => {
        const newSpeed = parseFloat(e.target.value);
        playbackSpeed = newSpeed;
        setPlaybackRate(newSpeed);

        // Save to settings
        const currentSettings = getSettings();
        currentSettings.playbackSpeed = newSpeed;
        saveSettings(currentSettings);

        logger.debug('Playback speed changed to:', newSpeed);
      });
    }

    // Progress bar scrubbing with touch support
    const progressBar = container.querySelector('#progress-bar');
    if (progressBar) {
      const handleScrub = clientX => {
        const rect = progressBar.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));

        if (audioProgress.duration > 0 && !isNaN(audioProgress.duration)) {
          const newTime = percentage * audioProgress.duration;
          seekTo(newTime);
        } else {
          // Show brief "loading" feedback when audio isn't ready
          progressBar.style.cursor = 'wait';
          setTimeout(() => {
            progressBar.style.cursor = 'pointer';
          }, 500);
        }
      };

      events.on(progressBar, 'click', e => handleScrub(e.clientX));
      events.on(
        progressBar,
        'touchstart',
        e => {
          e.preventDefault(); // Prevent scroll while scrubbing
          handleScrub(e.touches[0].clientX);
        },
        { passive: false }
      );
    }
  };

  /**
   * Setup keyboard shortcuts for audio control
   */
  const setupKeyboardShortcuts = () => {
    events.on(document, 'keydown', e => {
      // Only handle if we're on the read page and audio is playing
      if (!container || !isPlaying) {
        return;
      }

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          const wasPaused = isPaused;
          isPaused = togglePause();
          if (wasPaused !== isPaused) {
            updateHeader();
            updateAudioUI();
          }
          break;
        }

        case 'ShiftLeft':
        case 'ShiftRight':
          // These are modifiers, handle combinations below
          return;

        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault();
            jumpBackward(5);
          }
          break;

        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault();
            jumpForward(5);
          }
          break;

        case 'BracketLeft': {
          e.preventDefault();
          let currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
          if (currentIndex === -1) {
            currentIndex = findClosestSpeedIndex(playbackSpeed, PLAYBACK_SPEEDS);
          }
          const newIndex = Math.max(0, currentIndex - 1);
          const newSpeed = PLAYBACK_SPEEDS[newIndex];
          playbackSpeed = newSpeed;
          setPlaybackRate(newSpeed);

          // Save to settings
          const currentSettings = getSettings();
          currentSettings.playbackSpeed = newSpeed;
          saveSettings(currentSettings);

          // Update speed dropdown
          const speedControl = container.querySelector('#speed-control');
          if (speedControl) {
            speedControl.value = newSpeed;
          }
          logger.debug('Speed decreased to:', newSpeed);
          break;
        }

        case 'BracketRight': {
          e.preventDefault();
          let currentIndex2 = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
          if (currentIndex2 === -1) {
            currentIndex2 = findClosestSpeedIndex(playbackSpeed, PLAYBACK_SPEEDS);
          }
          const newIndex2 = Math.min(PLAYBACK_SPEEDS.length - 1, currentIndex2 + 1);
          const newSpeed2 = PLAYBACK_SPEEDS[newIndex2];
          playbackSpeed = newSpeed2;
          setPlaybackRate(newSpeed2);

          // Save to settings
          const currentSettings2 = getSettings();
          currentSettings2.playbackSpeed = newSpeed2;
          saveSettings(currentSettings2);

          // Update speed dropdown
          const speedControl2 = container.querySelector('#speed-control');
          if (speedControl2) {
            speedControl2.value = newSpeed2;
          }
          logger.debug('Speed increased to:', newSpeed2);
          break;
        }

        case 'Escape': {
          // Check if modal is open before stopping playback
          const modal = document.querySelector('.generator-modal');
          if (!modal || modal.classList.contains('hidden')) {
            e.preventDefault();
            stopPlayback();
          }
          break;
        }
      }
    });
  };

  /**
   * Wrap kana characters for lookup
   */
  const wrapKana = text => {
    if (!text) {
      return '';
    }
    // Wrap Hiragana (\u3040-\u309F) and Katakana (\u30A0-\u30FF)
    return text.replace(
      /([\u3040-\u309F\u30A0-\u30FF])/g,
      '<span class="kana-lookup" data-char="$1">$1</span>'
    );
  };

  /**
   * Add furigana to Japanese text using readings array
   * Converts plain text with kanji into ruby-tagged HTML
   */
  const addFurigana = (text, readings = []) => {
    if (!text) {
      return '';
    }

    // If no readings provided, return plain text
    if (!readings || readings.length === 0) {
      return text;
    }

    // Create a map for quick lookup
    const readingMap = new Map();
    for (const r of readings) {
      if (r.text && r.reading) {
        readingMap.set(r.text, r.reading);
      }
    }

    // Sort readings by text length (longest first) to handle overlapping matches
    const sortedReadings = Array.from(readingMap.entries()).sort(
      (a, b) => b[0].length - a[0].length
    );

    // Build result with replacements
    let result = text;
    const replaced = new Set(); // Track which positions we've already replaced

    for (const [word, reading] of sortedReadings) {
      // Find all occurrences of this word in the remaining text
      let searchStart = 0;
      while (true) {
        const index = result.indexOf(word, searchStart);
        if (index === -1) {
          break;
        }

        // Check if this position overlaps with an already replaced section
        const overlaps = Array.from(replaced).some(
          ([start, end]) => index < end && index + word.length > start
        );

        if (!overlaps) {
          // Replace with ruby tag
          const before = result.substring(0, index);
          const after = result.substring(index + word.length);
          result = `${before}<ruby>${word}<rt>${reading}</rt></ruby>${after}`;

          // Mark this section as replaced
          replaced.add([index, index + word.length]);

          // Adjust search start due to added ruby tags
          searchStart = index + word.length + `<ruby>${word}<rt>${reading}</rt></ruby>`.length;
        } else {
          // Move past this occurrence
          searchStart = index + word.length;
        }
      }
    }

    return result;
  };

  /**
   * Find kana data by character
   */
  const findKanaData = char => {
    if (!char || typeof char !== 'string') {
      return null;
    }
    const isKatakana = /[\u30A0-\u30FF]/.test(char);
    const system = isKatakana ? 'katakanaflat' : 'hiraganaflat';
    const kanaArray = KANA_DATA?.[system];
    if (!kanaArray || !Array.isArray(kanaArray)) {
      return null;
    }
    return kanaArray.find(item => item && item.kana === char);
  };

  /**
   * Show/update kana tooltip
   */
  const showKanaTooltip = (char, x, y, isMobile = false) => {
    const tooltip = container.querySelector('#kana-tooltip');
    if (!tooltip) {
      return;
    }

    const kanaData = findKanaData(char);
    if (!kanaData || !kanaData.romaji) {
      return;
    }

    // Update content
    const charEl = tooltip.querySelector('#kana-tooltip-char');
    const romajiEl = tooltip.querySelector('#kana-tooltip-romaji');
    if (charEl) {
      charEl.textContent = char;
    }
    if (romajiEl) {
      romajiEl.textContent = kanaData.romaji;
    }

    // Position tooltip
    tooltip.classList.remove('hidden');
    tooltip.classList.toggle('kana-tooltip--mobile', isMobile);

    if (isMobile) {
      // Mobile: fixed at bottom center
      tooltip.style.left = '';
      tooltip.style.top = '';
    } else {
      // Desktop: position near cursor with offset
      const offsetX = 12;
      const offsetY = 12;

      // Get tooltip dimensions for edge detection
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let posX = x + offsetX;
      let posY = y + offsetY;

      // Prevent right edge overflow
      if (posX + tooltipRect.width > viewportWidth - 8) {
        posX = x - tooltipRect.width - offsetX;
      }

      // Prevent bottom edge overflow
      if (posY + tooltipRect.height > viewportHeight - 8) {
        posY = y - tooltipRect.height - offsetY;
      }

      tooltip.style.left = `${posX}px`;
      tooltip.style.top = `${posY}px`;
    }
  };

  /**
   * Hide kana tooltip
   */
  const hideKanaTooltip = () => {
    const tooltip = container.querySelector('#kana-tooltip');
    if (!tooltip) {
      return;
    }

    tooltip.classList.add('hidden');
    tooltip.style.left = '';
    tooltip.style.top = '';
  };

  /**
   * Update story content area
   */
  const updateContent = () => {
    const contentRoot = container.querySelector('#reader-content-root');
    if (!contentRoot) {
      return;
    }

    if (contentRoot.children.length === 0) {
      contentRoot.innerHTML = story.content
        .map((segment, index) => {
          // Generate furigana text if enabled
          const furiganaText = showFurigana
            ? addFurigana(segment.jp, segment.readings)
            : segment.jp;

          return `
        <div class="segment" id="segment-${index}" data-index="${index}">
          <div class="segment__image-container ${!showImages ? 'hidden' : ''}" id="image-container-${index}">
             <div class="segment__image-skeleton skeleton"></div>
          </div>
          <div class="segment__jp">
            <p class="segment__jp-text jp-text">
              ${wrapKana(furiganaText)}
            </p>
          </div>
          <div class="segment__en ${!showEnglish ? 'hidden' : ''}">
            <p>${segment.en}</p>
            ${
              segment.vocab?.length > 0
                ? `
              <div class="segment__notes">
                ${segment.vocab
                  .map(
                    v => `
                  <div class="segment__note">
                    <span class="segment__note-term">${v.word}:</span>
                    <span class="segment__note-meaning">${v.meaning}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>
        </div>
      `;
        })
        .join('');
    }

    // Update active/dimmed states
    story.content.forEach((_, index) => {
      const el = container.querySelector(`#segment-${index}`);
      if (el) {
        el.classList.toggle('segment--active', activeSegmentIndex === index);
        el.classList.toggle(
          'segment--dimmed',
          activeSegmentIndex !== -1 && activeSegmentIndex !== index
        );
      }
    });
  };

  /**
   * Update comprehension questions section
   */
  const updateComprehension = () => {
    const compRoot = container.querySelector('#comprehension-root');
    if (!compRoot || !story.questions || story.questions.length === 0) {
      return;
    }

    compRoot.innerHTML = `
      <div class="comprehension">
        <h2 class="comprehension__title">📝 Comprehension Check</h2>
        <div class="comprehension__list">
          ${story.questions
            .map(
              (q, i) => `
            <div class="question-card" id="question-${i}">
              <p class="question-card__text"><strong>Q${i + 1}:</strong> ${q.question}</p>
              <div class="question-card__options">
                ${q.options.map(opt => `<div class="question-card__option">${opt}</div>`).join('')}
              </div>
              <div class="question-card__reveal">
                <button class="reveal-btn btn btn--sm btn--secondary" data-id="${i}">Reveal Answer</button>
                <div class="question-card__answer hidden" id="answer-${i}">
                  <p class="answer-text"><strong>Answer:</strong> ${q.answer}</p>
                  <p class="explanation-text">${q.explanation}</p>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;

    // Use delegation for reveal buttons
    events.delegate(compRoot, 'click', '.reveal-btn', function () {
      const id = this.dataset.id;
      const answerEl = compRoot.querySelector(`#answer-${id}`);
      answerEl?.classList.toggle('hidden');
      this.textContent = answerEl?.classList.contains('hidden') ? 'Reveal Answer' : 'Hide Answer';
    });
  };

  /**
   * Initial listeners
   */
  const setupListeners = () => {
    const completeBtn = container.querySelector('#complete-btn');
    if (completeBtn) {
      events.on(completeBtn, 'click', () => {
        saveProgress(story.id, { completed: true, scrollPercent: 100 });
        cancelAudio();
        if (onComplete) {
          onComplete();
        }
      });
    }

    const closeSettingsBtn = container.querySelector('#close-settings');
    if (closeSettingsBtn) {
      events.on(closeSettingsBtn, 'click', toggleSettings);
    }

    const toggleFuriganaEl = container.querySelector('#toggle-furigana');
    if (toggleFuriganaEl) {
      events.on(toggleFuriganaEl, 'change', e => {
        showFurigana = e.target.checked;
        const jpTexts = container.querySelectorAll('.segment__jp-text');
        jpTexts.forEach((el, i) => {
          const segment = story.content[i];
          const furiganaText = showFurigana
            ? addFurigana(segment.jp, segment.readings)
            : segment.jp;
          el.innerHTML = wrapKana(furiganaText);
        });
      });
    }

    const toggleEnglishEl = container.querySelector('#toggle-english');
    if (toggleEnglishEl) {
      events.on(toggleEnglishEl, 'change', e => {
        showEnglish = e.target.checked;
        container.querySelectorAll('.segment__en').forEach(el => {
          el.classList.toggle('hidden', !showEnglish);
        });
      });
    }

    // Hover lookup logic (desktop) - use delegation for kana-lookup
    const contentRoot = container.querySelector('#reader-content-root');
    events.on(contentRoot, 'mouseover', e => {
      const target = e.target.closest('.kana-lookup');
      if (!target) {
        return;
      }

      const char = target.dataset.char;
      if (!char) {
        return;
      }
      showKanaTooltip(char, e.clientX, e.clientY, false);
    });

    // Update tooltip position on mouse move
    events.on(contentRoot, 'mousemove', e => {
      const target = e.target.closest('.kana-lookup');
      if (!target) {
        hideKanaTooltip();
        return;
      }

      const char = target.dataset.char;
      if (!char) {
        return;
      }
      showKanaTooltip(char, e.clientX, e.clientY, false);
    });

    // Hide tooltip on mouse out
    events.on(contentRoot, 'mouseout', e => {
      const target = e.target.closest('.kana-lookup');
      if (target) {
        hideKanaTooltip();
      }
    });

    // Mobile tap logic
    events.on(
      contentRoot,
      'touchstart',
      e => {
        const target = e.target.closest('.kana-lookup');
        const tooltip = container.querySelector('#kana-tooltip');
        const isTooltipVisible = !tooltip?.classList.contains('hidden');

        if (target) {
          // Tapping on a kana character
          e.preventDefault(); // Prevent text selection and other default behaviors
          const char = target.dataset.char;
          if (!char) {
            return;
          }
          const touch = e.touches[0];

          // Toggle tooltip visibility
          if (isTooltipVisible) {
            hideKanaTooltip();
          } else {
            showKanaTooltip(char, touch.clientX, touch.clientY, true);
          }
        } else if (isTooltipVisible) {
          // Tapping elsewhere while tooltip is visible - hide it
          hideKanaTooltip();
        }
      },
      { passive: false }
    );

    const toggleSideBySideEl = container.querySelector('#toggle-side-by-side');
    if (toggleSideBySideEl) {
      events.on(toggleSideBySideEl, 'change', e => {
        isSideBySide = e.target.checked;
        const contentRoot = container.querySelector('#reader-content-root');
        contentRoot?.classList.toggle('reader__content--side-by-side', isSideBySide);
      });
    }

    const toggleImagesEl = container.querySelector('#toggle-images');
    if (toggleImagesEl) {
      events.on(toggleImagesEl, 'change', e => {
        showImages = e.target.checked;
        container.querySelectorAll('.segment__image-container').forEach(el => {
          el.classList.toggle('hidden', !showImages);
        });
        if (showImages) {
          loadImages();
        }
      });
    }

    // Use delegation for font size buttons
    events.delegate(container, 'click', '.font-size-btn', function () {
      const size = this.dataset.size;
      fontSizeClass = size === 'large' ? 'reader--large' : '';

      // Update UI
      container.querySelector('.reader').classList.toggle('reader--large', size === 'large');
      container.querySelectorAll('.font-size-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.size === size);
      });

      // Save to storage
      const settings = getSettings();
      settings.fontSize = size;
      saveSettings(settings);
    });

    // Window scroll listener
    events.on(window, 'scroll', handleScroll);

    // Cleanup function
    container._cleanup = () => {
      events.cleanup();
      cancelAudio();
      if (typeof unsubscribeProgress === 'function') {
        unsubscribeProgress();
        unsubscribeProgress = null;
      }
    };

    // Note: isPlaying vs isPaused
    //       isPlaying = whether audio is actively being played
    //       isPaused = whether playback is paused (button state)
    //       They can briefly differ during state transitions
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
      if (bar) {
        bar.style.width = `${currentProgress}%`;
      }
      if (txt) {
        txt.textContent = `${Math.round(currentProgress)}% complete`;
      }
    }
  };

  const toggleSettings = () => {
    container.querySelector('#settings-panel')?.classList.toggle('hidden');
  };

  const startPlayback = () => {
    // Clean up any existing subscription first to prevent memory leaks
    if (unsubscribeProgress) {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }

    activeSegmentIndex = -1;
    isPlaying = true;
    isPaused = false;
    isAudioLoading = true;
    playbackSpeed = settings.playbackSpeed || DEFAULT_SPEED;

    updateHeader();
    updateAudioUI();
    updateContent();

    // Subscribe to progress updates with NaN validation
    unsubscribeProgress = subscribeToProgress(progress => {
      audioProgress = progress;

      // Clear loading state when we get valid duration
      if (!isNaN(progress.duration)) {
        isAudioLoading = false;
      }

      // Only update if we have valid progress data to avoid NaN issues
      if (!isNaN(progress.duration) && !isNaN(progress.currentTime)) {
        updateAudioProgress(progress);
      }
    });

    playAudio(
      story.content[0].jp,
      () => {
        isPlaying = false;
        isPaused = false;
        isAudioLoading = false;
        activeSegmentIndex = -1;
        updateHeader();
        updateAudioUI();
        updateContent();
      },
      story.id
    );
  };

  const stopPlayback = () => {
    cancelAudio();
    isPlaying = false;
    isPaused = false;
    isAudioLoading = false;
    activeSegmentIndex = -1;

    // Unsubscribe from progress updates
    if (unsubscribeProgress) {
      unsubscribeProgress();
      unsubscribeProgress = null;
    }

    // Reset progress state
    audioProgress = { currentTime: 0, duration: 0, progress: 0 };

    updateHeader();
    updateAudioUI();
    updateContent();
  };

  const loadImages = async () => {
    if (!showImages || isLoadingImages) {
      return;
    }
    isLoadingImages = true;

    try {
      const loadPromises = story.content.map(async (_, i) => {
        const imgContainer = container.querySelector(`#image-container-${i}`);
        if (!imgContainer || imgContainer.querySelector('.segment__image')) {
          return;
        }

        try {
          const cachedUrl = await getCachedImage(story.id, i);
          if (cachedUrl) {
            renderImageInto(imgContainer, cachedUrl);
            return;
          }

          const apiKeys = getApiKeys();
          const apiKey = apiKeys.pollinations || import.meta.env.VITE_POLLINATIONS_AI_KEY;
          // Use dedicated imagePrompt if available, otherwise fall back to raw text
          const imagePrompt =
            story.content[i].imagePrompt || `${story.content[i].jp}, anime style, soft colors`;
          const prompt = encodeURIComponent(imagePrompt);
          const imageUrl = `https://gen.pollinations.ai/image/${prompt}?model=zimage`;

          const response = await fetch(imageUrl, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          });
          if (!response.ok) {
            throw new Error('API Error');
          }
          const blob = await response.blob();

          await cacheImage(story.id, i, blob);
          renderImageInto(imgContainer, URL.createObjectURL(blob));
        } catch (error) {
          console.error(`Segment ${i} image failed:`, error);
          imgContainer.classList.add('hidden');
        }
      });

      await Promise.all(loadPromises);
    } finally {
      isLoadingImages = false;
    }
  };

  const renderImageInto = (target, url) => {
    const img = new Image();
    img.className = 'segment__image animate-fade-in';
    img.src = url;
    target.innerHTML = '';
    target.appendChild(img);
  };

  // Check for audio availability and trigger generation if needed
  isAudioAvailable(story.id).then(async available => {
    if (available) {
      // Check if there's a completed job (audio is ready)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: completedJob } = await supabase
          .from('jobs')
          .select('id, status, result')
          .eq('user_id', user.id)
          .eq('story_id', story.id)
          .eq('job_type', 'audio_generation')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (completedJob) {
          // Audio is ready, cache it if needed and show button
          if (completedJob.result?.audioPath) {
            downloadAndCacheAudio(story.id, completedJob.result.audioPath).catch(err =>
              console.warn('Failed to cache audio, but it should still play:', err)
            );
          }
          isHQAvailable = true;
          initializeLayout();
          return;
        }
      }

      // There's a pending/processing job, subscribe to updates
      logger.debug('Audio job already in progress, waiting for completion...');

      const { jobQueue } = await import('../utils/jobQueue.js');
      const unsubscribe = jobQueue.subscribe(jobs => {
        const audioJob = Array.from(jobs.values()).find(
          job => job.parameters?.storyId === story.id && job.job_type === 'audio_generation'
        );

        if (audioJob?.status === 'completed' && audioJob.result?.audioPath) {
          logger.debug(
            'Audio generation complete! Downloading and caching...',
            audioJob.result.audioPath
          );

          downloadAndCacheAudio(story.id, audioJob.result.audioPath)
            .then(() => {
              logger.debug('Audio downloaded and cached successfully');
              unsubscribe();
              isHQAvailable = true;
              updateHeader();
            })
            .catch(error => {
              logger.error('Failed to download audio:', error);
              isHQAvailable = true;
              updateHeader();
            });
        } else if (audioJob?.status === 'failed') {
          // Job failed, unsubscribe and let user try again later
          logger.error('Audio generation job failed:', audioJob.error_message);
          unsubscribe();
        }
      });

      // Show loading state while waiting
      isHQAvailable = false;
      initializeLayout();
    } else {
      // No audio job exists, create one
      logger.debug('Audio not available, triggering generation job...');

      try {
        const fullText = story.content.map(segment => segment.jp).join('\n');
        await createAudioGenerationJob(story.id, fullText);

        // Subscribe to job queue updates
        const { jobQueue } = await import('../utils/jobQueue.js');
        const unsubscribe = jobQueue.subscribe(jobs => {
          const audioJob = Array.from(jobs.values()).find(
            job => job.parameters?.storyId === story.id && job.job_type === 'audio_generation'
          );

          if (audioJob?.status === 'completed' && audioJob.result?.audioPath) {
            logger.debug(
              'Audio generation complete! Downloading and caching...',
              audioJob.result.audioPath
            );

            downloadAndCacheAudio(story.id, audioJob.result.audioPath)
              .then(() => {
                logger.debug('Audio downloaded and cached successfully');
                unsubscribe();
                isHQAvailable = true;
                updateHeader();
              })
              .catch(error => {
                logger.error('Failed to download audio:', error);
                isHQAvailable = true;
                updateHeader();
              });
          } else if (audioJob?.status === 'failed') {
            logger.error('Audio generation job failed:', audioJob.error_message);
            unsubscribe();
          }
        });

        // Show loading state
        isHQAvailable = false;
        initializeLayout();
      } catch (error) {
        logger.error('Failed to trigger audio generation:', error);
        isHQAvailable = false;
        initializeLayout();
      }
    }
  });

  return container;
};

// Reader styles are now in external CSS: src/styles/components/readers.css

/**
 * Download audio from Supabase Storage and cache it in browser cache
 * @param {string} storyId - Story ID
 * @param {string} audioPath - Path in Supabase Storage (e.g., userId/storyId/full-story.wav)
 * @returns {Promise<void>}
 */
const downloadAndCacheAudio = async (storyId, audioPath) => {
  try {
    const cacheName = 'nihongo-audio-v2';
    const cache = await caches.open(cacheName);
    const cacheKey = `/audio/story-${storyId}`;

    // Check if already cached
    const existing = await cache.match(cacheKey);
    if (existing) {
      logger.debug('Audio already cached, skipping download');
      return;
    }

    // Download from Supabase Storage
    const { data, error } = await supabase.storage.from('audio-cache').download(audioPath);

    if (error || !data) {
      throw new Error(error?.message || 'Failed to download audio');
    }

    // Cache in browser
    await cache.put(
      cacheKey,
      new Response(data, {
        headers: { 'Content-Type': 'audio/wav' },
      })
    );

    logger.debug(`Audio cached for story ${storyId}`);
  } catch (error) {
    logger.error('Failed to download and cache audio:', error);
    throw error;
  }
};

export default Reader;
