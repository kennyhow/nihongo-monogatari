# TODO.md

## Quick Wins & Technical Debt

*Last Updated: January 2026*

---

## 🎯 Priority: HIGH

### 1. Type Safety & Documentation

#### ✅ 1.1 Create Shared Type Definitions (COMPLETED January 2, 2026)
**File:** `src/types.js` (CREATED)

**Why:** Story objects, settings, and other data structures are passed between many files. No single source of truth leads to inconsistencies.

**Action:**
```javascript
// src/types.js

/**
 * @typedef {Object} Story
 * @property {string} id - UUID v4
 * @property {string} title - Japanese title
 * @property {string} englishTitle - English translation
 * @property {'N1'|'N2'|'N3'|'N4'|'N5'} level - JLPT difficulty level
 * @property {string} topic - User-provided topic
 * @property {string} japaneseText - Full Japanese story with furigana ruby tags
 * @property {string} englishText - Full English translation
 * @property {VocabularyNote[]} vocabulary - Array of vocabulary notes
 * @property {ComprehensionQuestion[]} questions - Array of quiz questions
 * @property {string} imageUrl - AI-generated illustration URL
 * @property {number} createdAt - Unix timestamp
 * @property {boolean} audioGenerated - Whether TTS has been generated
 */

/**
 * @typedef {Object} VocabularyNote
 * @property {string} word - Japanese word (kanji/kana)
 * @property {string} reading - Hiragana reading
 * @property {string} meaning - English definition
 */

/**
 * @typedef {Object} ComprehensionQuestion
 * @property {string} question - Question text
 * @property {string[]} options - Multiple choice options
 * @property {number} answer - Index of correct option (0-3)
 */

/**
 * @typedef {Object} UserSettings
 * @property {'side-by-side'|'paragraph'} viewMode - Reading display mode
 * @property {'small'|'medium'|'large'} fontSize - Text size preference
 * @property {boolean} showFurigana - Show/hide furigana readings
 * @property {boolean} showImages - Show/hide story images
 * @property {boolean} autoPlay - Auto-play next sentence
 * @property {number} playbackSpeed - Speech rate (0.5-2.0)
 */

/**
 * @typedef {Object} UserProgress
 * @property {number} position - Current reading position (0-1)
 * @property {number} sentenceIndex - Current sentence index
 * @property {number} [lastRead] - Unix timestamp of last read
 */

export const STORY_LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'];
export const VIEW_MODES = ['side-by-side', 'paragraph'];
export const FONT_SIZES = ['small', 'medium', 'large'];
```

**Files to Update:**
- [x] `src/services/api.js` - Add JSDoc to `generateStory()` return type ✅
- [x] `src/utils/storage.js` - Add type hints to all functions ✅
- [ ] `src/components/Reader.js` - Add Story type usage (optional)
- [ ] `src/pages/Library.js` - Add Story type usage (optional)

**Completed:** January 2, 2026

**What Was Done:**
- Created `src/types.js` with all type definitions (VocabularyNote, StoryContent, ComprehensionQuestion, Story, UserSettings, StoryProgress, AllProgress, ApiKeys, AudioState, AudioQueueItem)
- Exported enum constants (STORY_LEVELS, FONT_SIZES, VIEW_MODES, STORY_LENGTHS)
- Added validation utilities (isValidStoryLevel, isValidStory, etc.)
- Annotated `src/services/api.js` with full JSDoc including input/output validation
- Annotated `src/utils/storage.js` with JSDoc for all 9+ exported functions
- Updated `src/utils/audio.js` with enhanced type annotations
- Updated `src/utils/audioQueue.js` with proper type documentation
- Build verified working (`npm run build` passed)

---

#### 1.2 Add JSDoc Comments to Critical Functions

**Why:** Complex functions in `storage.js` and `api.js` lack documentation. Future-you (or collaborators) will thank you.

**Priority Files:**

##### `src/utils/storage.js`
```javascript
/**
 * Retrieves all stories from LocalStorage
 * @returns {Story[]} Array of story objects
 */
export function getStories() { ... }

/**
 * Saves stories to LocalStorage and syncs to cloud
 * @param {Story[]} stories - Array of story objects to save
 * @returns {Promise<void>}
 */
export async function saveStories(stories) { ... }

/**
 * Retrieves reading progress for a specific story
 * @param {string} storyId - UUID of the story
 * @returns {UserProgress|null} Progress object or null if not found
 */
export function getProgress(storyId) { ... }
```

##### `src/services/api.js`
```javascript
/**
 * Generates a Japanese story using Gemini AI
 * @param {Object} options - Generation options
 * @param {'N1'|'N2'|'N3'|'N4'|'N5'} options.level - JLPT difficulty level
 * @param {string} options.topic - Story topic
 * @param {string} [options.instructions] - Additional instructions
 * @param {string} [options.length] - Story length preference
 * @returns {Promise<Story>} Generated story object
 * @throws {Error} If API call fails or returns invalid data
 */
export async function generateStory({ level, topic, instructions, length }) { ... }

/**
 * Generates text-to-speech audio for Japanese text
 * @param {string} text - Japanese text to convert
 * @returns {Promise<ArrayBuffer>} WAV audio data
 * @throws {Error} If API rate limit exceeded or call fails
 */
export async function generateSpeech(text) { ... }
```

**Files to Document:**
- [ ] `src/utils/storage.js` - All export functions
- [ ] `src/services/api.js` - All export functions
- [ ] `src/utils/audioQueue.js` - Queue management functions
- [ ] `src/utils/audio.js` - Playback functions
- [ ] `src/utils/router.js` - Router functions

**Estimated Time:** 2-3 hours

---

### 2. Error Handling Improvements

#### 2.1 Add Global Error Boundary

**Why:** Unhandled promise rejections or runtime errors currently show blank screens. Better to show a user-friendly error message.

**File:** `src/main.js`

**Action:**
```javascript
// Add after app initialization
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Show user-friendly error page or toast
  import('./components/Toast.js').then(({ default: Toast }) => {
    Toast.show('Something went wrong. Please refresh the page.', 'error');
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  import('./components/Toast.js').then(({ default: Toast }) => {
    Toast.show('A network error occurred. Please check your connection.', 'error');
  });
});
```

**Estimated Time:** 30 minutes

---

#### 2.2 Add API Error Recovery

**File:** `src/services/api.js`

**Current Issue:** Network failures throw errors that crash the app.

**Action:**
```javascript
// Add retry logic for transient failures
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        // Rate limited - wait and retry
        await new Promise(r => setTimeout(r, 30000));
        continue;
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Use in generateStory() and generateSpeech()
```

**Estimated Time:** 1 hour

---

### 2.3 Add Storage Error Handling

**File:** `src/utils/storage.js`

**Current Issue:** localStorage can throw (quota exceeded, private mode, etc.)

**Action:**
```javascript
export function saveStories(stories) {
  try {
    localStorage.nihongo_stories = JSON.stringify(stories);
  } catch (error) {
    console.error('Storage quota exceeded:', error);
    Toast.show('Storage full. Please delete some stories or clear cache.', 'error');
    // Fallback: Notify user, suggest export/delete
    throw error;
  }
}
```

**Estimated Time:** 30 minutes

---

## 🔶 Priority: MEDIUM

### 3. Developer Experience

#### 3.1 Add Debug Mode Toggle

**File:** `src/pages/Settings.js`

**Why:** Sometimes you need to see what's happening under the hood without editing code.

**Action:**
Add a "Developer Options" section:
```javascript
// In settings object
developer: {
  debugMode: false,        // Enable verbose logging
  showAPIKeys: false,      // Show masked API keys
  cacheStats: false        // Show cache size/usage
}
```

**Implementation:**
```javascript
// In src/utils/storage.js or new src/utils/debug.js
export const DEBUG = {
  log: (...args) => {
    if (getSettings()?.developer?.debugMode) {
      console.log('[DEBUG]', ...args);
    }
  },
  error: (...args) => {
    if (getSettings()?.developer?.debugMode) {
      console.error('[DEBUG]', ...args);
    }
  }
};

// Usage throughout codebase:
DEBUG.log('Story generated:', story);
DEBUG.log('Audio cache miss, falling back to TTS');
```

**Estimated Time:** 1-2 hours

---

#### 3.2 Add Performance Monitoring

**File:** `src/utils/performance.js` (NEW)

**Why:** Track slow operations (story generation, audio caching, etc.)

**Action:**
```javascript
export const perf = {
  start: (label) => {
    if (getSettings()?.developer?.debugMode) {
      console.time(label);
    }
  },
  end: (label) => {
    if (getSettings()?.developer?.debugMode) {
      console.timeEnd(label);
    }
  },
  mark: (label) => {
    if (getSettings()?.developer?.debugMode) {
      console.log(`⏱️ ${label}:`, performance.now());
    }
  }
};

// Usage:
perf.start('Story Generation');
const story = await generateStory(options);
perf.end('Story Generation');
```

**Estimated Time:** 30 minutes

---

### 4. Component Refactoring

#### 4.1 Split Reader.js Component

**Current State:** 24KB, handles display, audio, progress, vocabulary, images

**Suggested Split:**

```
src/components/Reader/
├── index.js              (Main controller, ~4KB)
├── StoryDisplay.js       (Render story content, ~6KB)
├── VocabularyPopup.js    (Vocabulary hover popup, ~4KB)
├── AudioControls.js      (Playback controls, ~4KB)
├── ProgressTracker.js    (Reading progress, ~3KB)
└── StoryImage.js         (Image display, ~3KB)
```

**Benefits:**
- Easier to test individual pieces
- Faster to understand code
- Reusable vocabulary popup for other features

**Estimated Time:** 3-4 hours

---

#### 4.2 Split Settings.js Component

**Current State:** 22KB, handles display, audio, data, import/export, Supabase

**Suggested Split:**

```
src/pages/Settings/
├── index.js                    (Main controller, ~3KB)
├── DisplaySettings.js          (Font, furigana, images, ~3KB)
├── AudioSettings.js            (Playback settings, ~2KB)
├── DataManagement.js           (Import/export, ~5KB)
├── CacheManagement.js          (Clear cache, wipe data, ~4KB)
└── SupabaseSettings.js         (Cloud sync, login/logout, ~5KB)
```

**Estimated Time:** 2-3 hours

---

### 5. CSS Organization

#### 5.1 Split index.css into Modules

**Current State:** 26,716 lines in one file

**Suggested Structure:**

```
src/styles/
├── base/
│   ├── reset.css          (CSS reset, ~100 lines)
│   ├── variables.css      (CSS custom properties, ~200 lines)
│   └── typography.css     (Font definitions, ~100 lines)
├── utilities/
│   ├── layout.css         (flex, grid, spacing, ~500 lines)
│   └── helpers.css        (text, colors, borders, ~300 lines)
├── components/
│   ├── buttons.css        (~400 lines)
│   ├── cards.css          (~300 lines)
│   ├── forms.css          (~500 lines)
│   ├── modals.css         (~400 lines)
│   ├── toasts.css         (~200 lines)
│   └── badges.css         (~150 lines)
├── themes/
│   ├── light.css          (Light theme overrides, ~100 lines)
│   └── dark.css           (Dark theme overrides, ~100 lines)
└── animations.css         (All keyframes, ~200 lines)
```

**Action:**
1. Create directory structure above
2. Copy relevant sections from `index.css` into each file
3. Update `index.css` to import all files:
```css
/* src/styles/index.css */
@import url('./base/reset.css');
@import url('./base/variables.css');
@import url('./base/typography.css');
@import url('./utilities/layout.css');
@import url('./utilities/helpers.css');
@import url('./components/buttons.css');
/* ... etc ... */
```

**Benefits:**
- Faster to find specific styles
- Easier to audit component CSS
- Better for team collaboration
- Smaller file builds (Vite can optimize)

**Estimated Time:** 2-3 hours

---

## 🔵 Priority: LOW

### 6. Testing

#### 6.1 Add Unit Tests for Critical Utilities

**Framework:** Vitest (already works with Vite)

**Setup:**
```bash
npm install -D vitest
```

**Files to Test:**

##### `src/utils/storage.test.js`
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { getStories, saveStories, getProgress, saveProgress } from './storage.js';

describe('Storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should save and retrieve stories', () => {
    const stories = [{ id: '123', title: 'Test' }];
    saveStories(stories);
    expect(getStories()).toEqual(stories);
  });

  it('should return empty array if no stories', () => {
    expect(getStories()).toEqual([]);
  });

  // ... more tests
});
```

##### `src/utils/audioQueue.test.js`
```javascript
import { describe, it, expect, vi } from 'vitest';
import { audioQueue } from './audioQueue.js';

describe('Audio Queue', () => {
  it('should add story to queue', () => {
    const story = { id: '123', japaneseText: 'テスト' };
    audioQueue.addStoryToQueue(story);
    expect(audioQueue.getQueue()).toHaveLength(1);
  });

  // ... more tests
});
```

**Action:**
- [ ] Install Vitest
- [ ] Add test script to `package.json`: `"test": "vitest"`
- [ ] Write tests for `storage.js`
- [ ] Write tests for `audioQueue.js`
- [ ] Write tests for `audioHelpers.js`

**Estimated Time:** 4-6 hours

---

### 7. Documentation

#### 7.1 Create README.md

**File:** `README.md` (NEW)

**Content:**
```markdown
# Nihongo Monogatari 🇯🇵

A Japanese immersive reader powered by AI-generated stories and text-to-speech.

## Features

- 🎚️ AI-generated stories at 5 JLPT levels (N1-N5)
- 🔊 High-quality text-to-speech with rate-limited queue system
- 📚 Side-by-side translations with furigana support
- 📖 Progress tracking and cloud sync via Supabase
- 🎨 Dark/light theme with customizable display options

## Getting Started

### Prerequisites

- Node.js 18+
- Google Gemini API key
- (Optional) Supabase project for cloud sync

### Installation

\`\`\`bash
npm install
\`\`\`

### Configuration

Create \`.env\` file:
\`\`\`bash
VITE_GOOGLE_API_KEY=your_key_here
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:5173

### Build

\`\`\`bash
npm run build
\`\`\`

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system architecture.

## Contributing

See [AGENTS.md](AGENTS.md) for AI agent context and development guidelines.

## License

MIT
```

**Estimated Time:** 30 minutes

---

#### 7.2 Add Code Comments

**Priority Files:**
- [ ] `src/utils/router.js` - Explain hash routing logic
- [ ] `src/utils/audioQueue.js` - Document rate limiting strategy
- [ ] `src/components/Reader.js` - Explain progress tracking algorithm

**Estimated Time:** 1-2 hours

---

## 📋 Summary Checklist

### Quick Wins (Do This First)
- [ ] Create `src/types.js` with JSDoc type definitions
- [ ] Add JSDoc to `storage.js` functions
- [ ] Add JSDoc to `api.js` functions
- [ ] Add global error handlers in `main.js`

### Medium Priority
- [ ] Add debug mode toggle to Settings
- [ ] Split `Reader.js` into smaller components
- [ ] Split `Settings.js` into smaller components
- [ ] Split `index.css` into modular files

### Low Priority (Nice to Have)
- [ ] Set up Vitest and write unit tests
- [ ] Create comprehensive `README.md`
- [ ] Add inline code comments

---

## 💡 Pro Tips

1. **Don't do everything at once** - Pick one high-priority item, finish it, then move to the next
2. **Test as you go** - After each change, run `npm run dev` and make sure nothing broke
3. **Commit frequently** - Small, focused commits are easier to revert if something goes wrong
4. **Use branches** - Create a feature branch for refactoring: `git checkout -b refactor/types`
5. **Update docs** - Keep ARCHITECTURE.md and AGENTS.md in sync as you make changes

---

## 🚀 Recommended Order

1. **Start with:** `src/types.js` - Foundation for everything else
2. **Then:** JSDoc comments - Improves code immediately
3. **Then:** Error handling - Makes app more robust
4. **Then:** Debug mode - Helps with future debugging
5. **Then:** Component splitting - When you need to add features
6. **Then:** CSS splitting - If CSS file becomes unmanageable
7. **Then:** Testing - When you have time to invest in quality

---

*Last Updated: January 2026*
*Questions? See ARCHITECTURE.md for system details*
