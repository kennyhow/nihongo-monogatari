# AGENTS.md

## Project: Nihongo Monogatari (Japanese Immersive Reader)

### 🎯 Goal

A web application for learning Japanese through AI-generated stories with side-by-side translation and high-quality Text-to-Speech (TTS).

### 🛠️ Tech Stack

- **Framework**: Vanilla JavaScript + Vite (`npm run dev`)
- **Styling**: Vanilla CSS Design System (`src/styles/index.css`)
- **AI Model**: Google Gemini (`gemini-2.5-flash-lite` for text, `gemini-2.5-flash-preview-tts` for audio)
- **Data**: LocalStorage (Persistence) + Browser Cache API (Audio)

---

## 📂 Architecture Overview

### Design System (`src/styles/index.css`)

**~800 lines** of organized CSS with:

- CSS custom properties (tokens) for colors, spacing, typography, shadows
- Full dark mode support via `[data-theme="dark"]`
- Pre-built component classes (`.btn`, `.card`, `.badge`, `.modal`, `.toast`, etc.)
- Animation library: shimmer, fade-in, modal slide, toast notifications
- Responsive breakpoints (mobile-first)

> ⚠️ **IMPORTANT**: Do NOT use inline styles. All styling should use CSS classes from the design system.

### Component Lifecycle (`src/utils/componentBase.js`)

Provides lightweight component utilities:

- `createElement(html)` - Safe HTML to DOM conversion
- `createComponent({ render, onMount, onUnmount })` - Lifecycle management
- `useCleanup(element, fn)` - Register cleanup callbacks
- `runCleanups(element)` - Execute all cleanups (called by router on navigation)

> ⚠️ **IMPORTANT**: Always use cleanup functions for subscriptions, event listeners, and intervals to prevent memory leaks.

### Router (`src/utils/router.js`)

Enhanced hash-based router with:

- Lazy loading of page modules
- Automatic cleanup on route change
- Loading states and error handling
- `getRouteInfo()` for accessing query params

---

## 📁 File Reference

### Services

| File                  | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `src/services/api.js` | **CRITICAL**. Gemini API calls for story generation and TTS |

### Utilities

| File                         | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `src/utils/componentBase.js` | Component lifecycle hooks and helpers                |
| `src/utils/router.js`        | Hash-based SPA router with cleanup                   |
| `src/utils/storage.js`       | LocalStorage helpers for stories, settings, progress |
| `src/utils/audio.js`         | Audio playback with cache fallback to browser TTS    |
| `src/utils/audioQueue.js`    | **Whole-story TTS queue** (1 API call per story)     |

### Components

| File                               | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `src/components/Header.js`         | Sticky nav, theme toggle, mobile menu, queue badge |
| `src/components/StoryCard.js`      | Story preview card with level badges               |
| `src/components/GeneratorModal.js` | AI story creation form with visual level picker    |
| `src/components/Reader.js`         | Main reading interface with progress tracking      |
| `src/components/Toast.js`          | Notification system (success/error/warning)        |

### Pages

| File                    | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| `src/pages/Home.js`     | Hero, stats, continue reading, featured stories |
| `src/pages/Library.js`  | Search, filters, sort, grid/list view           |
| `src/pages/Read.js`     | Story loader with continue prompt               |
| `src/pages/Queue.js`    | TTS generation progress dashboard               |
| `src/pages/Settings.js` | User preferences, import/export, cache          |

---

## 🔑 Key Context for Agents

### 1. TTS Architecture (Updated Jan 2026)

- **Whole-story generation**: We now generate audio for entire stories in ONE API call, not per-sentence
- This reduces API calls from ~10+ per story to just 1
- Cached in Browser Cache API with key `story-audio-{storyId}`
- Fallback: Browser's built-in `speechSynthesis` API if cache miss

### 2. Rate Limits

- `gemini-2.5-flash-preview-tts` is extremely strict (~3 req/min)
- `audioQueue.js` processes one story every 30 seconds
- **DO NOT remove throttling** or users will hit 429 errors

### 3. Environment

- `VITE_GOOGLE_API_KEY` in `.env` is required for AI features
- API key is accessed via `import.meta.env.VITE_GOOGLE_API_KEY`

### 4. Persistence

- Stories: `localStorage.nihongo_stories` (array of story objects)
- Progress: `localStorage.nihongo_progress` (object keyed by storyId)
- Settings: `localStorage.nihongo_settings` (viewMode, fontSize, showFurigana)
- Theme: `localStorage.nihongo_theme` ('light' or 'dark')

### 5. Adding New Pages

1. Create `src/pages/NewPage.js` (function that receives `parentElement`)
2. Add route in `src/utils/router.js`
3. Return cleanup function if using subscriptions
4. Add nav link in `src/components/Header.js`

### 6. Adding New Components

1. Use CSS classes from design system, not inline styles
2. Append component-specific styles via `document.head.appendChild()`
3. Use `useCleanup()` for any subscriptions or listeners

---

## 💡 Lessons Learned & Common Pitfalls

### EventManager Migration (Jan 2026)

**✅ What Worked Well:**

- The codebase has **consistent component patterns**, making migration straightforward
- AGENTS.md and ARCHITECTURE.md provided excellent context for understanding the system
- Pre-commit hooks (eslint + prettier) caught issues early

**⚠️ Common Pitfalls to Avoid:**

1. **Dataset Only Stores Strings**
   - ❌ `element.dataset.object = myObject` → Converts to `"[object Object]"`
   - ✅ Use a separate `Map` or WeakMap for storing object references
   - Example: `toastEventManagers.set(id, events)` instead of `toast.dataset.events = events`

2. **Conditional Element Rendering**
   - Always check for null when attaching listeners to conditionally rendered elements
   - Use if-checks: `const btn = container.querySelector('#btn'); if (btn) events.on(btn, 'click', handler)`
   - Common in components with `if (session) { ... }` patterns (Settings.js)

3. **ESLint Case Declarations**
   - Wrap lexical declarations in switch cases with braces
   - ❌ `case 'foo': const x = 1;`
   - ✅ `case 'foo': { const x = 1; }`

4. **Unused Catch Variables**
   - Use catch without parameter if error isn't used
   - ❌ `} catch (e) { // e unused }`
   - ✅ `} catch { // no parameter needed }`

5. **Event Listener Cleanup**
   - Old `addEventListener` calls MUST be removed when migrating to EventManager
   - Don't leave duplicate code (both old + new patterns)

6. **Inline Style Violations**
   - Never use inline styles (violates design system principles)
   - Replace with CSS classes: `.theme-icon--animating` instead of `style.transform = ...`

**🎯 Development Best Practices:**

- **Test early**: Start with simple components (Toast.js) to validate the pattern
- **Build frequently**: Run `npm run build` to catch syntax errors before committing
- **Check git diff**: Review staged changes to avoid duplicate code
- **Null checks**: Always handle cases where `querySelector` returns null

---

## 🚀 Future Roadmap & QoL Suggestions

### 🎨 UI/UX Enhancements

- **PWA Support**: Convert the app into a Progressive Web App so it can be "installed" on mobile phones and support offline reading for cached stories.
- **Custom Art Styles**: Allow users to select a visual style for Pollinations images (e.g., "Studio Ghibli", "Ukiyo-e", "Cyberpunk", "Pixel Art") in Settings.
- **Immersive Mode**: A "Zen" reading mode that hides the header and progress bars for a distraction-free experience.
- **Micro-interactions**: Add haptic feedback (on mobile) when completing a story or clicking a vocabulary term.

### 📚 Learning Features

- **Flashcard System**: Allow users to "Star" vocabulary notes in stories and save them to a personal "Study List" with basic SRS/Flashcard functionality.
- **Comprehension Quizzes**: Ask Gemini to generate 3-5 multiple-choice questions at the end of each story to test understanding.
- **Interactive Dictionary**: Integrate a lightweight dictionary (like Jisho API) to allow looking up _any_ word in a story, not just the AI-provided notes.
- **Kanji Mastery Tracking**: Track which Kanji the user has encountered across different stories to calculate an "Estimated Vocabulary Size".

### ⚙️ QoL Improvements

- **Voice Selection**: Let users choose between different Gemini TTS voices (e.g., Male/Female, different personas).
- **Export to PDF/Anki**: Add buttons to export a story as a beautifully formatted PDF or generate an Anki-compatible `.csv` for vocabulary.
- **Story Categorization**: Add "Collections" or "Folders" to the Library to organize stories by topic (e.g., "Daily Life", "Travel", "Mythology").
- **Auto-Read Mode**: An "Audiobook" experience that automatically scrolls and advances as the TTS plays.
