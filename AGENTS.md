# AGENTS.md

## Project: Nihongo Monogatari (Japanese Immersive Reader)

### 🎯 Goal
A web application for learning Japanese through AI-generated stories with side-by-side translation and high-quality Text-to-Speech (TTS).

### 🛠️ Tech Stack
- **Framework**: Vanilla JavaScript + Vite (`npm run dev`)
- **Styling**: Vanilla CSS (`src/styles/index.css`)
- **AI Model**: Google Gemini (`gemini-2.5-flash-lite` for text, `gemini-2.5-flash-preview-tts` for audio)
- **Data**: LocalStorage (Persistence) + Browser Cache API (Audio)

### 📂 Architecture
- `src/services/api.js`: **CRITICAL**. Handles Gemini API calls.
  - `generateStory`: JSON output mode. **Updated**: Requests `jp_furigana` (HTML ruby tags) and accepts custom instructions.
  - `generateSpeech`: TTS implementation. **Note**: Returns raw PCM wrapped in WAV.
- `src/utils/audioQueue.js`: **NEW**. Background processor for TTS to handle strict API rate limits (~3 req/min).
  - Enqueues segments from `GeneratorModal`.
  - Processes one segment every 25 seconds.
  - Saves to `caches` storage.
- `src/utils/audio.js`: Helper for playback.
  - `playAudio`: Checks Cache first. If HIT -> Plays Blob. If MISS -> Fallback to Browser TTS (does NOT fetch API directly to reserve quota).
- `src/pages/Queue.js`: Dashboard to monitor audio generation status.
- `src/components/Reader.js`: The main reading interface. Renders `jp_furigana` if available.

### 🔑 Key Context for Agents
1. **TTS Headers**: The Gemini TTS endpoint returns raw PCM audio (`wav` codec in expected MIME type). See `createWavHeader` in `api.js`.
2. **Rate Limits**: `gemini-2.5-flash-preview-tts` is extremely strict. We use `AudioQueueManager` (`src/utils/audioQueue.js`) to strictly throttle requests. **Do not remove this throttling** or users will hit 429s immediately.
3. **Environment**: `VITE_GOOGLE_API_KEY` in `.env` is required for AI features.
4. **Persistence**: Generated stories are saved to `localStorage`. If modifying the data structure, ensure backward compatibility or handle migration in `storage.js`.
