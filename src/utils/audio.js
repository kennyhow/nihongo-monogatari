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
let onFinishCallback = null;

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
  } catch (e) {
    console.warn('Failed to check for audio job:', e);
    return false;
  }
};

/**
 * Get current audio playback state
 * @returns {AudioState} Current audio state
 */
export const getAudioState = () => ({
  isPlaying: currentAudio && !currentAudio.paused,
  currentTime: currentAudio?.currentTime || 0,
  duration: currentAudio?.duration || 0,
});

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
        const url = URL.createObjectURL(blob);

        currentAudio = new Audio(url);
        currentAudio.onended = () => {
          URL.revokeObjectURL(url);
          if (onFinishCallback) {
            onFinishCallback();
          }
        };
        currentAudio.onerror = () => {
          URL.revokeObjectURL(url);
          if (onFinishCallback) {
            onFinishCallback();
          }
        };

        await currentAudio.play();
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

          const url = URL.createObjectURL(data);
          currentAudio = new Audio(url);
          currentAudio.onended = () => {
            URL.revokeObjectURL(url);
            if (onFinishCallback) {
              onFinishCallback();
            }
          };
          await currentAudio.play();
          return;
        }
      }
    } catch (e) {
      console.warn('Cache lookup failed:', e);
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
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }

  onFinishCallback = null;
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
    currentAudio.currentTime = Math.max(0, Math.min(time, currentAudio.duration || 0));
  }
};
