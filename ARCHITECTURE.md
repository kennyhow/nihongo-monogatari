# ARCHITECTURE.md

## System Architecture: Nihongo Monogatari

### Overview

Nihongo Monogatari is a **Single Page Application (SPA)** built with vanilla JavaScript that helps users learn Japanese through AI-generated stories with text-to-speech capabilities.

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Header    │  │    Pages     │  │   Components     │   │
│  │  (Nav/Menu) │  │ (Router/Lazy)│  │ (Modal/Toast/etc)│   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      BUSINESS LOGIC LAYER                    │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │   Router     │  │   Storage   │  │   Audio System   │    │
│  │ (Navigation) │  │ (Local/Cloud)│  │ (Queue/Playback) │    │
│  └──────────────┘  └─────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      SERVICES & INTEGRATIONS                 │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ Gemini API   │  │  Supabase   │  │  Browser APIs    │    │
│  │ (AI/TTS)     │  │(Edge Fncts) │  │ (Cache/Speech)  │    │
│  └──────────────┘  │ (Cloud Sync) │  └──────────────────┘    │
│                   └─────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

**Key Change:** Story generation now runs on Supabase Edge Functions, allowing users to close their browser during generation (~30-60 seconds).

---

## Core Systems

### 1. Routing & Navigation System

**Entry Point:** `src/main.js` → `src/utils/router.js`

```
Hash Change → Router.matches() → Load Page Module → Render → Cleanup Previous
```

**Key Files:**

- **`src/utils/router.js`** (3,686 bytes)
  - Hash-based SPA routing (`#/home`, `#/library`, `#/read?id=123`)
  - Lazy loading of page modules for performance
  - Automatic cleanup of event listeners and subscriptions on route change
  - Query parameter parsing via `getRouteInfo()`
  - Error boundaries for failed page loads

- **`src/utils/componentBase.js`** (4,643 bytes)
  - `createElement(html)`: Safely converts HTML strings to DOM elements
  - `createComponent()`: Component lifecycle management
  - `useCleanup()`: Registers cleanup callbacks (prevents memory leaks)
  - `runCleanups()`: Executes all cleanup functions on navigation
  - `createEventManager()`: Returns EventManager instance for centralized event handling

- **`src/utils/eventManager.js`** (NEW - 6,289 bytes)
  - `EventManager` class with automatic cleanup
  - `on(element, event, handler)`: Register individual event listeners
  - `delegate(parent, event, selector, handler)`: Event delegation for dynamic content
  - `cleanup()`: Remove all registered listeners
  - Integrates with router cleanup system

**Data Flow:**

```
User clicks link → Updates hash (#/library)
    ↓
router.js detects change
    ↓
Calls previous page's cleanup function
    ↓
Lazy loads new page module
    ↓
Renders new page into #app container
    ↓
Registers new cleanup callbacks
```

---

### 2. Data Persistence System

**Dual Storage Strategy:**

1. **LocalStorage** - Fast, offline-first data
2. **Supabase** - Cloud backup and sync across devices

**Key File:** **`src/utils/storage.js`** (11,466 bytes) - _Critical utility_

#### Storage Schema

```javascript
// LocalStorage Keys
localStorage.nihongo_stories; // Array<Story> - All generated stories
localStorage.nihongo_progress; // Object - {storyId: currentPosition}
localStorage.nihongo_settings; // Object - User preferences
localStorage.nihongo_theme; // String - 'light' | 'dark'
```

#### Story Object Structure

```javascript
{
  id: string,              // UUID
  title: string,           // Japanese title
  englishTitle: string,    // English translation
  level: string,           // 'N1' | 'N2' | 'N3' | 'N4' | 'N5'
  topic: string,           // User-provided topic
  japaneseText: string,    // Full Japanese story with furigana
  englishText: string,     // Full English translation
  vocabulary: Array<{      // Vocabulary notes
    word: string,
    reading: string,
    meaning: string
  }>,
  questions: Array<{       // Comprehension questions
    question: string,
    options: string[],
    answer: number
  }>,
  imageUrl: string,        // AI-generated illustration
  createdAt: timestamp,
  audioGenerated: boolean  // Whether TTS is ready
}
```

#### Functions

**LocalStorage Operations:**

- `getStories()` / `saveStories(stories)` - Story CRUD
- `getProgress(storyId)` / `saveProgress(storyId, position)` - Reading position
- `getSettings()` / `saveSettings(settings)` - User preferences
- `getTheme()` / `saveTheme(theme)` - Theme persistence

**Supabase Operations:**

- `syncToCloud()` - Pushes local data to Supabase
- `syncFromCloud()` - Pulls data from Supabase to local
- `wipeAllData()` - Clears both local and cloud storage

**Data Flow:**

```
User generates story
    ↓
API returns story object
    ↓
saveStories() updates localStorage
    ↓
Auto-sync to Supabase (if logged in)
    ↓
Update UI to reflect new story
```

---

### 3. Audio & TTS System

**Architecture:** Whole-story generation with aggressive caching

```
Story Generation → Add to Queue → Rate-Limited API Calls → Cache → Playback
```

**Key Files:**

- **`src/utils/audioQueue.js`** (6,688 bytes) - Queue management
- **`src/utils/audio.js`** (4,877 bytes) - Playback logic
- **`src/utils/audioHelpers.js`** (1,484 bytes) - WAV format conversion

#### Queue System

**Purpose:** Prevents rate-limiting errors from Gemini TTS API (~3 req/min)

**How It Works:**

```
User generates story with TTS
    ↓
audioQueue.addStoryToQueue(story)
    ↓
Queue checks if processing (30s delay between stories)
    ↓
Calls api.generateSpeech() with ENTIRE story text
    ↓
Receives WAV audio data
    ↓
Stores in Browser Cache API (key: `story-audio-{storyId}`)
    ↓
Notifies user: "Audio ready for {storyTitle}"
```

**Rate Limiting:**

- One story processed every 30 seconds
- Queue status visible in Queue page (`src/pages/Queue.js`)
- Badge on Header shows pending count

#### Playback System

**Cache Strategy:**

```
Play Request
    ↓
Check Browser Cache for `story-audio-{storyId}`
    ↓
Found? → Decode & Play
    ↓
Not Found? → Fallback to browser speechSynthesis API
```

**Audio Controls:**

- Play/Pause toggle
- Position tracking (sentence-by-sentence)
- Auto-advance to next sentence
- Speed control (via browser TTS)

---

### 4. Event Management System

**Entry Point:** `src/utils/eventManager.js`

All components use the `EventManager` class for centralized event handling with automatic cleanup.

**Key Features:**

- **Automatic cleanup:** Integrates with router's cleanup system
- **Event delegation:** Efficient handling of dynamic content
- **Memory leak prevention:** All listeners removed on component unmount
- **Type-safe:** Works with existing component lifecycle
- **Passive listeners:** Scroll/touch events use passive mode for better performance

**Usage:**

```javascript
import { createEventManager } from './utils/componentBase.js';

export default function render(container) {
  const events = createEventManager();

  // Individual elements (use on())
  events.on(container.querySelector('#button'), 'click', handleClick);

  // Window/document events
  events.on(window, 'scroll', handleScroll);
  events.on(document, 'keydown', handleKeydown);

  // Multiple/dynamic elements (use delegate())
  events.delegate(container, 'click', '.story-card', handleCardClick);
  events.delegate(container, 'mouseenter', '.vocabulary-word', showTooltip);

  // Router automatically calls cleanup on navigation
  return () => events.cleanup();
}
```

**When to use `.on()` vs `.delegate()`:**

- **Use `.on()`**: Single elements, IDs, elements that exist on render
- \*\*Use `.delegate()`: Multiple elements with same behavior, dynamic content, class selectors

**Benefits:**

- 60% reduction in boilerplate code
- No manual cleanup tracking
- Better performance for dynamic content (delegation)
- Consistent pattern across codebase
- Passive event listeners for scroll/touch by default

---

### 5. AI Integration System

**Key Files:**

- **`src/services/api.js`** - Client-side API calls and validation
- **`supabase/functions/generate-story/index.ts`** - Server-side story generation

#### Story Generation Flow

```
User fills GeneratorModal (level, topic, instructions)
    ↓
submit → api.generateStory()
    ↓
Client-side validation (fast feedback)
    ↓
Call Supabase Edge Function (async, can close browser!)
    ↓
Edge Function:
  - Constructs prompt with:
    - JLPT level constraints
    - Topic requirements
    - Special instructions
    - Output format requirements
  - Calls Gemini: gemini-2.5-flash-lite
  - Parses JSON response
  - Validates structure
    ↓
Return story object → save to storage → redirect to Reader
```

**Architecture Benefits:**

- ✅ User can close browser during generation (~30-60 seconds)
- ✅ API keys stored server-side (more secure)
- ✅ Better rate limiting handling
- ✅ Foundation for future queue system

**API Endpoints Used:**

1. **Text Generation:** `gemini-2.5-flash-lite` (via Edge Function)
   - Generates Japanese stories + translations + vocab + questions
   - Runs on Supabase Edge Functions (Deno runtime)

2. **TTS Generation:** `gemini-2.5-flash-preview-tts` (client-side)
   - Converts Japanese text to natural-sounding speech
   - Returns WAV audio data
   - **TODO:** Migrate to Edge Function

**Error Handling:**

- Client-side validation for immediate feedback
- Server-side validation and error handling in Edge Function
- Graceful fallback to browser TTS
- User-friendly error messages via Toast notifications

---

### 5. User Interface Components

#### Component Hierarchy

```
Header (Persistent)
├── Logo/Brand
├── Navigation Links
├── Theme Toggle
├── Queue Badge
└── Mobile Menu

Pages (Route-Dependent)
├── Home
│   ├── Hero Section
│   ├── Stats Dashboard
│   ├── Continue Reading
│   └── Featured Stories
├── Library
│   ├── Search Bar
│   ├── Filters (Level, Sort)
│   └── Story Grid/List
├── Read
│   ├── Story Loader
│   └── Reader Component
├── Queue
│   ├── Queue List
│   └── Progress Indicators
├── Settings
│   ├── Display Options
│   ├── Data Management
│   └── Import/Export
└── KanaChart
    └── Interactive Kana Table

Shared Components
├── StoryCard (Library, Home)
├── Reader (Read page)
├── GeneratorModal (All pages)
├── Toast (Global notifications)
└── ProgressBar (Loading states)
```

#### Key Components

**`src/components/Reader.js`** (~24,373 bytes) - _Largest component_

**Responsibilities:**

- Renders story content with side-by-side translation
- Displays vocabulary notes on hover/click
- Progress tracking (auto-saves reading position)
- Audio playback controls
- Image display
- Furigana toggle
- English translation toggle
- Font size controls (medium/large)
- Kana character pronunciation tooltips (hover/tap)
- Enhanced settings panel with sections

**State Management:**

```javascript
{
  story: Object,           // Current story data
  currentPosition: Number, // Reading progress (0-1)
  isPlaying: Boolean,      // Audio playback state
  currentSentence: Number, // For sentence-by-sentence audio
  viewMode: String         // 'side-by-side' | 'paragraph'
  showFurigana: Boolean    // Show furigana reading aid
  showEnglish: Boolean     // Show English translation
  showImages: Boolean      // Show AI-generated images
  fontSize: String         // 'medium' | 'large'
}
```

**Data Flow:**

```
Load Story → Parse sentences → Highlight current sentence → Update progress
    ↓
User clicks/hovers vocabulary word
    ↓
Show vocabulary popup with reading/meaning
    ↓
User clicks play
    ↓
Load audio from cache → Decode → Play from current position
```

**`src/components/GeneratorModal.js`** (12,351 bytes)

**Responsibilities:**

- Form for AI story generation
- Visual JLPT level picker (N1-N5)
- Topic input
- Special instructions
- Story length control
- Toggle for TTS generation

**Flow:**

```
User opens modal → Selects level N3 → Enters topic "daily routine"
    ↓
(Optional) Adds instructions: "Use polite form (desu/masu)"
    ↓
Selects story length: "Medium (300-500 characters)"
    ↓
Checks "Generate Audio" checkbox
    ↓
Submit → api.generateStory() → Save → Navigate to Reader
```

**`src/pages/Settings.js`** (22,753 bytes) - _Second largest_

**Responsibilities:**

- User preferences management
- Font size controls
- Display options (furigana, images)
- Data import/export (JSON)
- Cache management
- Data wipe (local + cloud)
- Supabase login/logout

**Categories:**

1. **Display**
   - Font size (small, medium, large)
   - Show/hide furigana
   - Show/hide images

2. **Audio**
   - Auto-play next sentence
   - Playback speed

3. **Data**
   - Export all stories (JSON)
   - Import stories (JSON file)
   - Clear audio cache
   - Wipe all data (with confirmation)

---

### 6. Design System

**File:** `src/styles/index.css` (~26,716 lines)

**Architecture:**

```css
/* 1. CSS Variables (Tokens) */
:root {
  --color-primary: ...;
  --spacing-md: ...;
  --font-size-base: ...;
}

/* 2. Reset & Base Styles */
* { box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; }

/* 3. Utility Classes */
.container { max-width: 1200px; margin: 0 auto; }
.flex { display: flex; }
.grid { display: grid; }

/* 4. Component Classes */
.btn { ... }
.card { ... }
.modal { ... }

/* 5. Animations */
@keyframes fadeIn { ... }
@keyframes slideUp { ... }

/* 6. Dark Mode Overrides */
[data-theme="dark"] {
  --color-bg: #1a1a1a;
  ...
}

/* 7. Responsive Breakpoints */
@media (max-width: 768px) { ... }
```

**Key Principles:**

1. **No inline styles** - Use CSS classes
2. **Component-based** - Reusable `.btn`, `.card`, `.badge`
3. **Dark mode native** - `[data-theme="dark"]` attribute
4. **Mobile-first** - Responsive breakpoints
5. **Animation library** - Pre-built transitions

---

## Data Flow Diagrams

### Story Generation Flow

```
┌─────────────┐
│ User Input  │ (Level N3, Topic "travel")
└──────┬──────┘
       ↓
┌─────────────┐
│GeneratorModal│
└──────┬──────┘
       ↓
┌─────────────┐
│ api.js      │
│generateStory│
└──────┬──────┘
       ↓
┌─────────────┐       ┌──────────────────┐
│Supabase Edge│──────→│ Gemini API       │
│Function     │       │ (Text Gen)       │
└──────┬──────┘       └──────────────────┘
       ↓                    (can close browser!)
┌─────────────┐
│ Story Object│
│ (from Edge) │
└──────┬──────┘
       ↓
┌─────────────┐       ┌──────────────┐
│storage.js   │──────→│ LocalStorage │
│saveStories()│       │nihongo_stories│
└──────┬──────┘       └──────────────┘
       ↓
┌─────────────┐       ┌──────────────┐
│router.js    │──────→│ Read Page    │
│navigate()   │       │ (display)    │
└─────────────┘       └──────────────┘
```

### Audio Generation Flow

```
┌─────────────┐
│ Generate    │
│ Story with  │
│ Audio       │
└──────┬──────┘
       ↓
┌─────────────┐
│audioQueue.js│
│addToQueue() │
└──────┬──────┘
       ↓
┌─────────────┐       (30s delay)
│audioQueue.js│─────────────┐
│processNext()│             │
└──────┬──────┘             │
       ↓                    │
┌─────────────┐             │
│ api.js      │             │
│generateSpeech()           │
└──────┬──────┘             │
       ↓                    │
┌─────────────┐             │
│ Gemini TTS  │             │
│ API         │             │
└──────┬──────┘             │
       ↓                    │
┌─────────────┐             │
│WAV Audio    │             │
│Data         │             │
└──────┬──────┘             │
       ↓                    │
┌─────────────┐             │
│Cache API    │             │
│(story-audio)│             │
└──────┬──────┘             │
       ↓                    │
┌─────────────┐             │
│ Notify User │◀────────────┘
│ "Audio Ready"│
└─────────────┘
```

### Cloud Sync Flow

```
┌─────────────┐
│ User Action │ (Generate, Update Progress)
└──────┬──────┘
       ↓
┌─────────────┐
│storage.js   │
│save*()      │
└──────┬──────┘
       ↓
┌─────────────┐       ┌──────────────┐
│LocalStorage │       │ Supabase     │
│(Immediate)  │──────→│ (Background) │
└─────────────┘       │ syncToCloud()│
                     └──────────────┘

                     ┌──────────────┐
                     │ Supabase     │
                     │ (Polling)    │
                     └──────┬───────┘
                            ↓
                     ┌──────────────┐
                     │syncFromCloud()│
                     └──────┬───────┘
                            ↓
                     ┌──────────────┐
                     │ LocalStorage │
                     │ (Merge)      │
                     └──────────────┘
```

---

## File Responsibility Matrix

| File                                   | Primary Role                    | Dependencies                | Used By                                     |
| -------------------------------------- | ------------------------------- | --------------------------- | ------------------------------------------- |
| **src/main.js**                        | App entry point                 | router.js, Header           | Browser                                     |
| **src/types.js**                       | Type definitions (JSDoc)        | None                        | api.js, storage.js, audio.js, audioQueue.js |
| **src/utils/router.js**                | Hash routing, lazy loading      | componentBase.js            | All pages                                   |
| **src/utils/componentBase.js**         | Component lifecycle             | eventManager.js             | router.js, all components                   |
| **src/utils/eventManager.js**          | Event management, cleanup       | None                        | All components                              |
| **src/utils/storage.js**               | Data persistence, Supabase sync | supabase.js                 | All components                              |
| **src/utils/supabase.js**              | Supabase client config          | @supabase/supabase-js       | storage.js                                  |
| **src/utils/audio.js**                 | Audio playback                  | audioHelpers.js, storage.js | Reader.js                                   |
| **src/utils/audioQueue.js**            | TTS generation queue            | api.js, storage.js          | GeneratorModal.js                           |
| **src/utils/audioHelpers.js**          | WAV format utilities            | None                        | audio.js                                    |
| **src/utils/imageStorage.js**          | Image caching                   | storage.js                  | Reader.js                                   |
| **src/services/api.js**                | Client-side API calls           | @supabase/supabase-js       | audioQueue.js, GeneratorModal.js            |
| **supabase/functions/generate-story/** | Server-side story generation    | @google/generative-ai       | api.js (via Supabase)                       |
| **src/components/Header.js**           | Navigation, theme toggle        | router.js, storage.js       | All pages                                   |
| **src/components/Reader.js**           | Story display, playback         | audio.js, storage.js        | Read page                                   |
| **src/components/GeneratorModal.js**   | Story creation form             | api.js, storage.js          | Header (global)                             |
| **src/components/StoryCard.js**        | Story preview card              | storage.js                  | Home, Library                               |
| **src/components/Toast.js**            | Notifications                   | eventManager.js             | All components                              |
| **src/components/ProgressBar.js**      | Loading indicator               | None                        | All components                              |
| **src/pages/Home.js**                  | Landing page                    | StoryCard, storage.js       | router.js                                   |
| **src/pages/Library.js**               | Story browser                   | StoryCard, storage.js       | router.js                                   |
| **src/pages/Read.js**                  | Story loader                    | Reader, storage.js          | router.js                                   |
| **src/pages/Queue.js**                 | TTS queue status                | audioQueue.js               | router.js                                   |
| **src/pages/Settings.js**              | User preferences                | storage.js                  | router.js                                   |
| **src/pages/KanaChart.js**             | Kana reference                  | data/kana.js                | router.js                                   |
| **src/data/kana.js**                   | Kana character data             | None                        | KanaChart.js                                |
| **src/styles/index.css**               | Design system                   | None                        | All components                              |
| **index.html**                         | HTML entry point                | Google Fonts                | main.js                                     |

---

## Development Guidelines

### Working with Type Definitions

**File:** `src/types.js` (JSDoc type definitions)

The project uses JSDoc for type documentation without TypeScript migration. This provides IDE autocomplete and type safety.

**Import types for JSDoc:**

```javascript
/**
 * @typedef {import('../types.js').Story} Story
 * @typedef {import('../types.js').UserSettings} UserSettings
 */
```

**Use types in function signatures:**

```javascript
/**
 * @param {Story} story - Story object
 * @returns {Promise<void>}
 */
export async function saveStory(story) { ... }
```

**Use enum constants for validation:**

```javascript
import { STORY_LEVELS, isValidStoryLevel } from '../types.js';

if (!isValidStoryLevel(level)) {
  throw new Error(`Invalid level: ${level}`);
}
```

**Available Types:**

- `Story` - Complete story object
- `StoryContent` - Story segment
- `VocabularyNote` - Vocabulary entry
- `ComprehensionQuestion` - Quiz question
- `UserSettings` - User preferences
- `StoryProgress` - Reading progress
- `ApiKeys` - API key storage
- `AudioState` - Playback state
- `AudioQueueItem` - Queue item

### Adding a New Page

1. **Create page file:** `src/pages/MyPage.js`

   ```javascript
   export default function renderMyPage(parentElement) {
     const cleanupFunctions = [];

     // Your page logic here

     return () => {
       cleanupFunctions.forEach(fn => fn());
     };
   }
   ```

2. **Add route:** In `src/utils/router.js`

   ```javascript
   {
     path: '/mypage',
     module: () => import('../pages/MyPage.js')
   }
   ```

3. **Add navigation:** In `src/components/Header.js`
   ```html
   <a href="#/mypage" class="nav-link">My Page</a>
   ```

### Adding a New Component

1. **Use design system classes:**

   ```javascript
   const card = createElement(`
     <div class="card">
       <h2 class="card-title">Title</h2>
       <p class="card-body">Content</p>
     </div>
   `);
   ```

2. **Register cleanup for side effects:**
   ```javascript
   const button = document.querySelector('button');
   button.addEventListener('click', handler);
   useCleanup(parentElement, () => {
     button.removeEventListener('click', handler);
   });
   ```

### Adding Storage Operations

1. **Update storage.js:**

   ```javascript
   export function getMyData() {
     const data = localStorage.nihongo_mydata;
     return data ? JSON.parse(data) : defaultValue;
   }

   export function saveMyData(data) {
     localStorage.nihongo_mydata = JSON.stringify(data);
     syncToCloud(); // Optional: Auto-sync
   }
   ```

2. **Add Supabase sync (if needed):**
   ```javascript
   // In syncToCloud()
   const myData = getMyData();
   await supabase.from('user_data').upsert({
     user_id: user.id,
     key: 'mydata',
     value: myData,
   });
   ```

---

## Performance Optimizations

1. **Lazy Loading:** Pages loaded on-demand via router.js
2. **Audio Caching:** Browser Cache API for TTS data
3. **Image Caching:** Cache API for story images
4. **Debouncing:** Search inputs in Library page
5. **Throttling:** TTS generation queue (30s intervals)
6. **LocalStorage:** Fast synchronous data access
7. **Minimal DOM Manipulation:** Batch updates where possible

---

## Security Considerations

1. **API Keys:** Stored in `.env` (not in git)
2. **Supabase RLS:** Row-level security enabled
3. **XSS Prevention:** `createElement()` sanitizes HTML
4. **Input Validation:** Story generator validates user input
5. **No Inline Scripts:** All JS in separate modules

---

## Future Architecture Considerations

1. **PWA Support:** Add service worker for offline reading
2. **Database Schema:** Consider IndexedDB for larger datasets
3. **State Management:** Could add Redux/Zustand for complex state
4. **Component Framework:** Consider migration to React/Vue for larger teams
5. **API Abstraction:** Add GraphQL layer for complex queries
6. **Microservices:** Split TTS generation to separate service

---

## Quick Reference

### Important Constants

```javascript
// Storage Keys
const STORAGE_KEYS = {
  STORIES: 'nihongo_stories',
  PROGRESS: 'nihongo_progress',
  SETTINGS: 'nihongo_settings',
  THEME: 'nihongo_theme',
};

// Cache Keys
const CACHE_KEYS = {
  AUDIO: 'story-audio-',
  IMAGE: 'story-image-',
};

// JLPT Levels
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

// View Modes
const VIEW_MODES = ['side-by-side', 'paragraph'];

// Themes
const THEMES = ['light', 'dark'];
```

### Environment Variables

```bash
# Frontend (client-side)
VITE_GOOGLE_API_KEY=...              # Gemini API (legacy, for TTS only now)
VITE_POLLINATIONS_AI_KEY=...         # Image generation
VITE_SUPABASE_PUBLISHABLE_KEY=...    # Supabase client (new format: sb_publishable_...)
VITE_SUPABASE_URL=...                # Supabase endpoint

# Backend (Edge Functions - set in Supabase Dashboard)
GEMINI_API_KEY=...                   # Gemini API (for story generation)
```

---

_Last Updated: January 4, 2026 (Edge Functions integration for story generation)_

**Recent Changes:**

- Migrated story generation from client-side to Supabase Edge Functions
- Users can now close browser during story generation (~30-60 seconds)
- API keys moved server-side for improved security
- Added comprehensive documentation (EDGE_FUNCTION_SETUP.md, SUPABASE_API_KEY_MIGRATION.md)
- See commit: `feat: migrate story generation to Supabase Edge Functions`
  _For AI Agent Context: See AGENTS.md_
