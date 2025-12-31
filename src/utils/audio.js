
import { generateSpeech } from '../services/api.js';

let currentAudio = null;

// Audio Cache Name
const CACHE_NAME = 'nihongo-audio-v1';

export const playAudio = async (text, onEnd) => {
    cancelAudio(); // Stop any current audio

    try {
        // 1. Check Cache
        const cache = await caches.open(CACHE_NAME);
        const cacheKey = new Request(`https://tts-cache/${encodeURIComponent(text)}`);
        let response = await cache.match(cacheKey);

        let audioBlob;

        if (response) {
            console.log('Audio cache hit');
            audioBlob = await response.blob();
        } else {
            console.log('Audio cache miss - Fetching from API');
            // 2. Fetch from API
            audioBlob = await generateSpeech(text);
            if (audioBlob) {
                // 3. Save to Cache
                await cache.put(cacheKey, new Response(audioBlob));
            } else {
                // Fallback to browser TTS if API fails/returns null
                playBrowserAudio(text, onEnd);
                return;
            }
        }

        // 4. Play Audio Blob
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
