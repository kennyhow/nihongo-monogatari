/**
 * AudioPlayer Component
 * Dedicated component for the sticky audio player bar.
 * Handles its own state, events, and UI updates.
 */

import {
  togglePause,
  seekTo,
  setPlaybackRate,
  subscribeToProgress,
  getAudioState,
  jumpForward,
  jumpBackward,
} from '../utils/audio.js';
import { createEventManager } from '../utils/componentBase.js';
import { getSettings, saveSettings } from '../utils/storage.js';

/**
 * Constants
 */
const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5];
const DEFAULT_SPEED = 1.0;

/**
 * Helper: Format time in seconds to M:SS
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
 * Create the AudioPlayer component
 * @param {HTMLElement} container - The container element to mount into
 * @param {Object} options - Optional callbacks
 */
const AudioPlayer = container => {
  if (!container) {
    return null;
  }

  const events = createEventManager();
  const settings = getSettings();

  // Internal State
  let playbackSpeed = settings.playbackSpeed || DEFAULT_SPEED;
  let audioProgress = { currentTime: 0, duration: 0, progress: 0 };
  let unsubscribeProgress = null;

  // Get initial state from global audio
  const initialState = getAudioState();
  let isPlaying = initialState.isPlaying;
  let isPaused = initialState.isPaused;

  /**
   * Initialize the component
   */
  const init = () => {
    // Subscribe to progress immediately
    unsubscribeProgress = subscribeToProgress(progress => {
      audioProgress = progress;

      // Update our local state trackers based on global audio state
      const state = getAudioState();
      isPlaying = state.isPlaying;
      isPaused = state.isPaused;

      render(); // Re-render on every tick (virtual DOM diffing would be better, but this is vanilla JS)
    });

    render();
  };

  /**
   * Render the player UI
   */
  const render = () => {
    // Check if we should show anything
    const state = getAudioState();
    // We show if:
    // 1. It is playing (global or local)
    // 2. It is paused (global or local)
    // 3. We have active progress (duration > 0) AND we started playback recently
    const active = isPlaying || isPaused || state.isPlaying || state.isPaused;

    if (!active) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    // Determine readiness (do we have duration?)
    const isReady = !isNaN(audioProgress.duration) && audioProgress.duration > 0;
    const progressPercent = audioProgress.progress || 0;

    // Status text
    let statusText = '';
    if (!isReady) {
      statusText = '⏳ Loading...';
    } else {
      statusText = `${isPaused ? '⏸ Paused' : '▶ Playing'} - ${formatTime(audioProgress.currentTime)} / ${formatTime(audioProgress.duration)}`;
    }

    // Check if DOM already exists to avoid trashing it (Fixes flashing)
    const existingPlayer = container.querySelector('.audio-player');

    if (existingPlayer) {
      // INCREMENTAL UPDATE

      // Update status text
      const statusEl = container.querySelector('.audio-player__status');
      if (statusEl && statusEl.textContent !== statusText) {
        statusEl.textContent = statusText;
      }

      // Update play/pause button text
      const playBtn = container.querySelector('#play-pause-btn');
      if (playBtn) {
        const btnText = isPaused ? '▶ Resume' : '⏸ Pause';
        // Only touch DOM if text changed
        if (playBtn.innerText !== btnText) {
          playBtn.innerText = btnText;
        }
      }

      // Update progress bar
      const progressFill = container.querySelector('.audio-player__progress-fill');
      if (progressFill) {
        progressFill.style.width = `${progressPercent}%`;
      }
      const progressHandle = container.querySelector('.audio-player__progress-handle');
      if (progressHandle) {
        progressHandle.style.left = `${progressPercent}%`;
      }

      // Update loading state styles (opacity/disabled)
      const progressBar = container.querySelector('#progress-bar');
      if (progressBar) {
        if (!isReady && !progressBar.classList.contains('disabled')) {
          progressBar.classList.add('disabled');
          progressBar.style.opacity = '0.5';
          progressBar.style.pointerEvents = 'none';
        } else if (isReady && progressBar.classList.contains('disabled')) {
          progressBar.classList.remove('disabled');
          progressBar.style.opacity = '';
          progressBar.style.pointerEvents = '';
        }
      }

      const buttons = container.querySelectorAll('.audio-player__btn:not(#play-pause-btn)');
      buttons.forEach(btn => {
        if (!isReady && !btn.hasAttribute('disabled')) {
          btn.setAttribute('disabled', 'true');
        } else if (isReady && btn.hasAttribute('disabled')) {
          btn.removeAttribute('disabled');
        }
      });
    } else {
      // INITIAL RENDER
      container.innerHTML = `
        <div class="audio-player">
          <!-- Status row: status text + speed control -->
          <div class="audio-player__status-row">
            <span class="audio-player__status">
              ${statusText}
            </span>
            <select id="speed-control" class="audio-player__speed" title="Playback speed">
              ${PLAYBACK_SPEEDS.map(speed => `<option value="${speed}" ${playbackSpeed === speed ? 'selected' : ''}>${speed}x</option>`).join('')}
            </select>
          </div>
  
          <!-- Progress bar with scrubbing -->
          <div class="audio-player__progress-container">
            <div class="audio-player__progress-bar ${!isReady ? 'disabled' : ''}" id="progress-bar" style="${!isReady ? 'opacity: 0.5; pointer-events: none;' : ''}">
              <div class="audio-player__progress-fill" style="width: ${progressPercent}%"></div>
              <div class="audio-player__progress-handle" style="left: ${progressPercent}%"></div>
            </div>
          </div>
  
          <!-- Control buttons -->
          <div class="audio-player__controls">
            <button id="jump-back-btn" class="audio-player__btn" title="Rewind 5s (Shift+←)" ${!isReady ? 'disabled' : ''}>⏪ -5s</button>
            <button id="play-pause-btn" class="audio-player__btn audio-player__btn--primary" title="Play/Pause (Space)">
              ${isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button id="jump-forward-btn" class="audio-player__btn" title="Forward 5s (Shift+→)" ${!isReady ? 'disabled' : ''}>⏩ +5s</button>
          </div>
        </div>
      `;

      // Only attach listeners on full render
      setupListeners();
    }
  };

  /**
   * Attach event listeners
   * (Called after every render, efficient enough for this scale)
   */
  const setupListeners = () => {
    // Play/Pause
    const playPauseBtn = container.querySelector('#play-pause-btn');
    if (playPauseBtn) {
      events.on(playPauseBtn, 'click', async () => {
        isPaused = await togglePause();
        render(); // Force update
      });
    }

    // Speed Control
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
      });
    }

    // Jumps
    const jumpBackBtn = container.querySelector('#jump-back-btn');
    if (jumpBackBtn) {
      events.on(jumpBackBtn, 'click', () => jumpBackward(5));
    }
    const jumpForwardBtn = container.querySelector('#jump-forward-btn');
    if (jumpForwardBtn) {
      events.on(jumpForwardBtn, 'click', () => jumpForward(5));
    }

    // Scrubbing
    const progressBar = container.querySelector('#progress-bar');
    if (progressBar) {
      const handleScrub = clientX => {
        const rect = progressBar.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));

        if (audioProgress.duration > 0 && !isNaN(audioProgress.duration)) {
          const newTime = percentage * audioProgress.duration;
          seekTo(newTime);
        }
      };

      events.on(progressBar, 'click', e => handleScrub(e.clientX));
      events.on(
        progressBar,
        'touchstart',
        e => {
          e.preventDefault();
          handleScrub(e.touches[0].clientX);
        },
        { passive: false }
      );
    }
  };

  /**
   * Cleanup
   */
  const cleanup = () => {
    events.cleanup();
    if (unsubscribeProgress) {
      unsubscribeProgress();
    }
    container.innerHTML = '';
  };

  /**
   * Helpers
   */
  const findClosestSpeedIndex = (targetSpeed, speeds) => {
    return speeds.reduce((prevIndex, curr, currIndex, array) => {
      return Math.abs(curr - targetSpeed) < Math.abs(array[prevIndex] - targetSpeed)
        ? currIndex
        : prevIndex;
    }, 0);
  };

  /**
   * Setup keyboard shortcuts
   */
  const setupKeyboardShortcuts = () => {
    events.on(document, 'keydown', async e => {
      // Check if player is active (playing or paused)
      const state = getAudioState();
      const active = isPlaying || isPaused || state.isPlaying || state.isPaused;

      if (!active || container.classList.contains('hidden')) {
        return;
      }

      switch (e.code) {
        case 'Space': {
          e.preventDefault();
          isPaused = await togglePause();
          render();
          break;
        }

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

          const currentSettings = getSettings();
          currentSettings.playbackSpeed = newSpeed;
          saveSettings(currentSettings);

          render();
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

          const currentSettings2 = getSettings();
          currentSettings2.playbackSpeed = newSpeed2;
          saveSettings(currentSettings2);

          render();
          break;
        }
      }
    });
  };

  // Start initialization
  init();
  setupKeyboardShortcuts();

  // Return public API
  return {
    cleanup,
    // Method to force a refresh if needed from parent
    refresh: render,
  };
};

export default AudioPlayer;
