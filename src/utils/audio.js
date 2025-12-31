
import { generateSpeech } from '../services/api.js';

let currentAudio = null;

// Audio Cache Name
const CACHE_NAME = 'nihongo-audio-v1';

export const playAudio = async (text, onEnd) => {
    cancelAudio(); // Stop any current audio

    try {
        const audioBlob = await getAudioBlob(text);

        if (!audioBlob) {
            // Fallback to browser TTS if API fails/returns null
            playBrowserAudio(text, onEnd);
            return;
        }

        // Play Audio Blob
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            currentAudio = null;
            URL.revokeObjectURL(audioUrl); // Cleanup
            if (onEnd) onEnd();
        };

        audio.onerror = (e) => {
            console.error('Audio playback error', e);
            currentAudio = null;
        };

        currentAudio = audio;
        audio.play();

    } catch (err) {
        console.error('TTS Error, falling back to browser', err);
        playBrowserAudio(text, onEnd);
    }
};

// Helper: Get Cached Audio Blob ONLY.
// We strictly rely on the background queue to populate the cache.
// If it's not in cache, we return null so playAudio falls back to browser.
const getAudioBlob = async (text) => {
    try {
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = new Request(`https://tts-cache/${encodeURIComponent(text)}`);
        let response = await cache.match(cacheKey);

        if (response) {
            return await response.blob();
        }

        // Cache Miss: Do NOT call API. Return null.
        console.log('Audio cache miss - Falling back to browser TTS');
        return null;

    } catch (e) {
        console.error("Cache/Fetch error", e);
    }
    return null;
};

// New: Preload only the first few segments to save quota
export const preloadStoryAudio = async (story) => {
    console.log(`Starting lazy audio preload for: ${story.titleEN}`);
    // Limit is very strict (approx 3/min), so only load the first segment.
    // The user will likely spend >20s reading/listening to the first one.
    if (story.content.length > 0) {
        await getAudioBlob(story.content[0].jp);
    }
    // Optional: Try 2nd one after a delay if we want to risk it
    // setTimeout(() => { if (story.content.length > 1) getAudioBlob(story.content[1].jp); }, 20000);
};

export const preloadNextSegment = async (text) => {
    // Just a wrapper to fetch in background
    getAudioBlob(text);
};

export const cancelAudio = () => {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
};

export const isSpeaking = () => {
    return !!currentAudio || window.speechSynthesis.speaking;
};

// --- Fallback Browser implementation ---

let synth = window.speechSynthesis;
let japaneseVoice = null;

const loadVoices = () => {
    const voices = synth.getVoices();
    japaneseVoice = voices.find(voice => voice.lang.includes('ja')) || voices.find(voice => voice.lang.includes('JP'));
};

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
loadVoices();

const playBrowserAudio = (text, onEnd) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (japaneseVoice) utterance.voice = japaneseVoice;
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;

    utterance.onend = onEnd;
    synth.speak(utterance);
};
