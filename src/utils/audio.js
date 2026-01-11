/**
 * Audio Playback Utilities
 * Handles playing cached or fallback TTS audio
 */

const CACHE_NAME = 'nihongo-audio-v2';

import { supabase, getSession } from './supabase.js';

/**
 * @typedef {import('../types.js').AudioState} AudioState
 */

// Track current playback state
let currentAudio = null;
let currentAudioUrl = null;
let onFinishCallback = null;

// Progress tracking subscribers
const progressCallbacks = new Set();

// Store timeupdate event listener for cleanup
let timeUpdateHandler = null;

/**
 * Setup progress tracking for an audio element
 * @param {HTMLAudioElement} audio - Audio element to track
 * @private
 */
const setupProgressTracking = audio => {
  timeUpdateHandler = () => {
    const currentTime = audio.currentTime;
    const duration = audio.duration;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    progressCallbacks.forEach(callback => {
      try {
        callback({ currentTime, duration, progress });
      } catch {
        // remove callback on error
        progressCallbacks.delete(callback);
      }
    });
  };
  audio.addEventListener('timeupdate', timeUpdateHandler);

  // Also update immediately when metadata is loaded (duration becomes available)
  audio.addEventListener('loadedmetadata', timeUpdateHandler, { once: true });
};

/**
 * Check if high-quality audio is cached for a story
 * @param {string} storyId - Story ID to check
 * @returns {Promise<boolean>} True if audio is cached
 */
export const isAudioCached = async storyId => {
  if (!storyId) {
    return false;
  }
  try {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = `/audio/story-${storyId}`;
    const legacyKey = `story-audio-${storyId}`;
    const match = (await cache.match(cacheKey)) || (await cache.match(legacyKey));
    return !!match;
  } catch {
    return false;
  }
};

/**
 * Check if audio is available (in browser cache OR Supabase Storage)
 * This prevents duplicate job creation
 * @param {string} storyId - Story ID to check
 * @returns {Promise<boolean>} True if audio is available or being generated
 */
export const isAudioAvailable = async storyId => {
  if (!storyId) {
    return false;
  }

  // First check browser cache (fast)
  const cached = await isAudioCached(storyId);
  if (cached) {
    return true;
  }

  // Then check if there's any audio generation job for this story
  // (pending, processing, or completed)
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    const { data, error } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('story_id', storyId)
      .eq('job_type', 'audio_generation')
      .in('status', ['pending', 'processing', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If there's any job (pending, processing, or completed), audio exists or is being generated
    return !!data && !error;
  } catch {
    return false;
  }
};

/**
 * Get current audio playback state
 * @returns {AudioState} Current audio state
 */
export const getAudioState = () => {
  return {
    isPlaying: currentAudio ? !currentAudio.paused : false,
    isPaused: currentAudio ? currentAudio.paused : true,
    currentTime: currentAudio?.currentTime ?? 0,
    duration: currentAudio?.duration ?? 0,
    progress:
      currentAudio && currentAudio.duration > 0
        ? (currentAudio.currentTime / currentAudio.duration) * 100
        : 0,
    playbackRate: currentAudio?.playbackRate ?? 1,
  };
};

/**
 * Play audio for a given text
 * Tries cache first, falls back to Supabase cloud storage
 * @param {string} text - Japanese text to play (currently unused, kept for compatibility)
 * @param {() => void} onFinish - Called when playback completes
 * @param {string} [storyId] - Optional story ID for cached audio lookup
 * @returns {Promise<void>}
 */
export const playAudio = async (text, onFinish, storyId = null) => {
  // Cancel any existing playback
  cancelAudio();

  onFinishCallback = onFinish;

  // Try to get cached audio for the story
  if (storyId) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = `/audio/story-${storyId}`;
      const legacyKey = `story-audio-${storyId}`;
      let cachedResponse = await cache.match(cacheKey);

      if (!cachedResponse) {
        cachedResponse = await cache.match(legacyKey);
      }

      if (cachedResponse) {
        const blob = await cachedResponse.blob();
        currentAudioUrl = URL.createObjectURL(blob);

        currentAudio = new Audio(currentAudioUrl);
        currentAudio.onended = () => {
          // URL will be revoked in cancelAudio or here if needed
          if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
            currentAudioUrl = null;
          }
          if (timeUpdateHandler) {
            currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
            timeUpdateHandler = null;
          }
          if (onFinishCallback) {
            onFinishCallback();
          }
        };
        currentAudio.onerror = () => {
          // URL will be revoked in cancelAudio or here if needed
          if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
            currentAudioUrl = null;
          }
          if (timeUpdateHandler) {
            currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
            timeUpdateHandler = null;
          }
          if (onFinishCallback) {
            onFinishCallback();
          }
        };

        // Add progress tracking
        setupProgressTracking(currentAudio);

        try {
          await currentAudio.play();
        } catch {
          // Auto-play failed (expected in some browsers)
          // Clean up resources on error
          if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
            currentAudioUrl = null;
          }
          if (timeUpdateHandler) {
            currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
            timeUpdateHandler = null;
          }
          if (onFinishCallback) {
            onFinishCallback();
          }
          return;
        }
        return;
      }

      // 2. Check Supabase Storage (from background job system)
      const session = await getSession();
      if (session) {
        // Use the existing audio-cache bucket with user-specific path
        const filePath = `${session.user.id}/${storyId}/full-story.wav`;
        const { data, error } = await supabase.storage.from('audio-cache').download(filePath);

        if (data && !error) {
          // Save to local cache for next time
          await cache.put(
            cacheKey,
            new Response(data, {
              headers: { 'Content-Type': 'audio/wav' },
            })
          );

          currentAudioUrl = URL.createObjectURL(data);
          currentAudio = new Audio(currentAudioUrl);
          currentAudio.onended = () => {
            if (currentAudioUrl) {
              URL.revokeObjectURL(currentAudioUrl);
              currentAudioUrl = null;
            }
            if (timeUpdateHandler) {
              currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
              timeUpdateHandler = null;
            }
            if (onFinishCallback) {
              onFinishCallback();
            }
          };
          currentAudio.onerror = () => {
            if (currentAudioUrl) {
              URL.revokeObjectURL(currentAudioUrl);
              currentAudioUrl = null;
            }
            if (timeUpdateHandler) {
              currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
              timeUpdateHandler = null;
            }
            if (onFinishCallback) {
              onFinishCallback();
            }
          };

          // Add progress tracking
          setupProgressTracking(currentAudio);

          try {
            await currentAudio.play();
          } catch {
            // Auto-play failed
            // Clean up resources on error
            if (currentAudioUrl) {
              URL.revokeObjectURL(currentAudioUrl);
              currentAudioUrl = null;
            }
            if (timeUpdateHandler) {
              currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
              timeUpdateHandler = null;
            }
            if (onFinishCallback) {
              onFinishCallback();
            }
            return;
          }
          return;
        }
      }
    } catch {
      // Ignore cache lookup failures
    }
  }

  // If no storyId or not in cache, we don't play anything
  if (onFinishCallback) {
    onFinishCallback();
  }
};

/**
 * Cancel current audio playback
 */
export const cancelAudio = () => {
  if (currentAudio) {
    // Remove timeupdate event listener if it exists
    if (timeUpdateHandler) {
      currentAudio.removeEventListener('timeupdate', timeUpdateHandler);
      currentAudio.removeEventListener('loadedmetadata', timeUpdateHandler);
      timeUpdateHandler = null;
    }

    currentAudio.pause();
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.src = '';
    currentAudio = null;
  }

  // Revoke object URL to prevent memory leaks
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }

  onFinishCallback = null;

  // Note: progress callbacks are managed by subscribeToProgress()
  // Subscribers decide when to unsubscribe via the returned unsubscribe function
};

/**
 * Preload audio for next segment (legacy - kept for compatibility)
 * @param {string} text - Text to potentially preload
 */
export const preloadNextSegment = _text => {
  // This is now a no-op since we cache whole stories
  // Kept for API compatibility
};

/**
 * Set playback speed
 * @param {number} rate - Playback rate (0.5 to 2.0)
 */
export const setPlaybackRate = rate => {
  if (currentAudio) {
    currentAudio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
  }
};

/**
 * Seek to position in audio
 * @param {number} time - Time in seconds
 */
export const seekTo = time => {
  if (currentAudio && !isNaN(time)) {
    const duration = currentAudio.duration || 0;
    if (!isNaN(duration) && duration > 0) {
      currentAudio.currentTime = Math.max(0, Math.min(time, duration));
    }
  }
};

/**
 * Toggle pause/play state
 * @returns {Promise<boolean>} New state (true = playing, false = paused)
 */
export const togglePause = async () => {
  if (!currentAudio) {
    return false;
  }

  if (currentAudio.paused) {
    await currentAudio.play();
    return true; // Playing
  } else {
    currentAudio.pause();
    return false; // Paused
  }
};

/**
 * Check if audio is currently paused
 * @returns {boolean} True if audio is paused or not playing
 */
export const isPaused = () => {
  return currentAudio?.paused ?? true;
};

/**
 * Jump forward in audio
 * @param {number} seconds - Seconds to jump forward
 */
export const jumpForward = seconds => {
  if (currentAudio) {
    currentAudio.currentTime = Math.min(
      currentAudio.duration || 0,
      currentAudio.currentTime + (seconds || 5)
    );
  }
};

/**
 * Jump backward in audio
 * @param {number} seconds - Seconds to jump backward
 */
export const jumpBackward = seconds => {
  if (currentAudio) {
    currentAudio.currentTime = Math.max(0, currentAudio.currentTime - (seconds || 5));
  }
};

/**
 * Subscribe to audio progress updates
 * @param {(progress: {currentTime: number, duration: number, progress: number}) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export const subscribeToProgress = callback => {
  if (typeof callback === 'function') {
    progressCallbacks.add(callback);
  }

  // Return unsubscribe function
  return () => {
    progressCallbacks.delete(callback);
  };
};
