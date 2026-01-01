/**
 * Audio Playback Utilities
 * Handles playing cached or fallback TTS audio
 */

const CACHE_NAME = 'nihongo-audio-v2';

// Track current playback state
let currentAudio = null;
let onFinishCallback = null;

/**
 * Get audio state
 * @returns {Object} Current audio state
 */
export const getAudioState = () => ({
    isPlaying: currentAudio && !currentAudio.paused,
    currentTime: currentAudio?.currentTime || 0,
    duration: currentAudio?.duration || 0
});

/**
 * Play audio for a given text
 * Tries cache first, falls back to browser TTS
 * @param {string} text - Japanese text to play
 * @param {Function} onFinish - Called when playback completes
 * @param {string} [storyId] - Optional story ID for cached audio lookup
 */
export const playAudio = async (text, onFinish, storyId = null) => {
    // Cancel any existing playback
    cancelAudio();

    onFinishCallback = onFinish;

    // Try to get cached audio for the story
    if (storyId) {
        try {
            const cache = await caches.open(CACHE_NAME);
            const cacheKey = `story-audio-${storyId}`;
            const cachedResponse = await cache.match(new Request(cacheKey));

            if (cachedResponse) {
                const blob = await cachedResponse.blob();
                const url = URL.createObjectURL(blob);

                currentAudio = new Audio(url);
                currentAudio.onended = () => {
                    URL.revokeObjectURL(url);
                    if (onFinishCallback) onFinishCallback();
                };
                currentAudio.onerror = () => {
                    URL.revokeObjectURL(url);
                    // Fallback to browser TTS
                    playBrowserTTS(text, onFinish);
                };

                await currentAudio.play();
                return;
            }
        } catch (e) {
            console.warn('Cache lookup failed:', e);
        }
    }

    // Try segment-specific cache (legacy)
    try {
        const cache = await caches.open(CACHE_NAME);
        const segmentKey = `segment-${hashText(text)}`;
        const cachedResponse = await cache.match(new Request(segmentKey));

        if (cachedResponse) {
            const blob = await cachedResponse.blob();
            const url = URL.createObjectURL(blob);

            currentAudio = new Audio(url);
            currentAudio.onended = () => {
                URL.revokeObjectURL(url);
                if (onFinishCallback) onFinishCallback();
            };

            await currentAudio.play();
            return;
        }
    } catch (e) {
        console.warn('Segment cache lookup failed:', e);
    }

    // Fallback to browser TTS
    playBrowserTTS(text, onFinish);
};

/**
 * Play text using browser's built-in TTS
 * @param {string} text - Text to speak
 * @param {Function} onFinish - Called when complete
 */
const playBrowserTTS = (text, onFinish) => {
    if (!('speechSynthesis' in window)) {
        console.warn('Browser TTS not supported');
        if (onFinish) onFinish();
        return;
    }

    // Cancel any existing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;

    // Try to find a Japanese voice
    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));
    if (japaneseVoice) {
        utterance.voice = japaneseVoice;
    }

    utterance.onend = () => {
        if (onFinish) onFinish();
    };

    utterance.onerror = (e) => {
        console.error('TTS error:', e);
        if (onFinish) onFinish();
    };

    window.speechSynthesis.speak(utterance);
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

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    onFinishCallback = null;
};

/**
 * Preload audio for next segment (legacy - kept for compatibility)
 * @param {string} text - Text to potentially preload
 */
export const preloadNextSegment = (text) => {
    // This is now a no-op since we cache whole stories
    // Kept for API compatibility
};

/**
 * Set playback speed
 * @param {number} rate - Playback rate (0.5 to 2.0)
 */
export const setPlaybackRate = (rate) => {
    if (currentAudio) {
        currentAudio.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    }
};

/**
 * Seek to position in audio
 * @param {number} time - Time in seconds
 */
export const seekTo = (time) => {
    if (currentAudio && !isNaN(time)) {
        currentAudio.currentTime = Math.max(0, Math.min(time, currentAudio.duration || 0));
    }
};

/**
 * Simple hash function for text
 * @param {string} text - Text to hash
 * @returns {string} Hash string
 */
const hashText = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
};
