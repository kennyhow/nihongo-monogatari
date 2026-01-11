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

**Service Architecture:**

| Service              | Location             | Model                          | Can Close Browser?     |
| -------------------- | -------------------- | ------------------------------ | ---------------------- |
| **Story Generation** | Background Job Queue | `gemini-2.5-flash-lite`        | ✅ Yes                 |
| **Audio Generation** | Background Job Queue | `gemini-2.5-flash-preview-tts` | ✅ Yes                 |
| **Image Generation** | Client-side          | `pollinations.ai (zimage)`     | ❌ No (lower priority) |

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
  titleJP: string,         // Japanese title
  titleEN: string,         // English translation
  level: string,           // 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'Beginner' | 'Intermediate' | 'Advanced'
  readTime: number,        // Estimated reading time in minutes
  excerpt: string,         // Short English summary
  content: Array<{         // Story segments
    jp: string,            // Plain Japanese text with proper kanji (no HTML/markup)
    readings: Array<{      // Furigana readings for kanji words
      text: string,        // The exact text from jp field (with kanji)
      reading: string      // Hiragana reading
    }>,
    en: string,            // English translation
    imagePrompt: string,   // Detailed visual description for AI image generation
    vocab: Array<{         // Optional vocabulary notes
      word: string,        // Japanese word/phrase (matches jp field)
      reading: string,     // Hiragana reading
      meaning: string      // English definition
    }>
  }>,
  questions: Array<{       // Optional comprehension questions
    question: string,      // Question text in English
    options: string[],     // Array of 4 answer options
    answer: number,        // Index of correct option (0-3)
    explanation: string    // Brief explanation of the answer
  }>,
  createdAt: timestamp
}
```

**Key Changes (January 2026):**

- **Furigana system overhaul:** Kanji readings now stored in structured `readings` array
- **Better kanji handling:** Readings ONLY include words with kanji (not hiragana/katakana-only words)
- **Complete word matching:** Each reading entry is a complete word, not partial fragments
- **Content segmentation:** Stories now split into segments with per-segment vocab and image prompts

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

### 3. Event Management System

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

### 4. Background Job System

**Entry Point:** `src/utils/jobQueue.js`

**Implemented:** January 4, 2026

A database-backed job queue system that allows long-running operations (story generation, audio generation, image generation) to run on the server. Users can close their browser and come back later to see completed work.

**Key Files:**

- **`src/utils/jobQueue.js`** (NEW - ~300 lines)
  - Client-side job queue manager with polling and localStorage backup
  - `createJob()`: Queue a new job for processing
  - `retryJob()`: Retry failed jobs
  - `cancelJob()`: Cancel pending jobs
  - `subscribe()`: Observer pattern for real-time UI updates
  - Polls database every 3 seconds for job status changes

- **`src/services/api.js`** (MODIFIED)
  - `createStoryGenerationJob()`: Queue a story generation job
  - `generateStory()`: Backward-compatible wrapper that polls until complete

- **`supabase/migrations/20240104_create_jobs_table.sql`** (NEW)
  - Database schema for job storage
  - Row Level Security (RLS) policies
  - Performance indexes

- **`supabase/functions/job-creator/index.ts`** (NEW)
  - Validates job parameters
  - Creates job records in database
  - Returns job ID immediately

- **`supabase/functions/job-worker/index.ts`** (NEW)
  - **Triggered immediately** when jobs are inserted (via database trigger)
  - Also supports manual invocation (via `trigger_all_pending_jobs()` SQL function)
  - Claims pending jobs sequentially
  - Processes based on `job_type`:
    - `story_generation`: Calls Gemini API to generate stories
    - `audio_generation`: Calls Gemini TTS API for audio
    - `image_generation`: (Future) Calls Pollinations AI
  - Updates job status and stores results
  - Handles errors with retry logic (up to 3 attempts)
  - Logs invocation source (trigger, manual, etc.) for debugging

- **`supabase/functions/job-status/index.ts`** (NEW)
  - Returns job status by ID
  - Used for status polling

- **`src/pages/Queue.js`** (MAJOR REFACTOR)
  - Unified UI for all job types
  - Filter by status (All, Pending, Processing, Completed, Failed)
  - Retry/cancel buttons
  - Real-time updates via jobQueue subscription

#### Job Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    JOB LIFECYCLE                            │
└─────────────────────────────────────────────────────────────┘

1. PENDING (⏳)
   - Job created, waiting to be processed
   - User can cancel
   - Stored in database with created_at timestamp

2. PROCESSING (🔄)
   - Worker has claimed the job
   - API calls in progress
   - started_at timestamp set
   - Cannot be cancelled (must finish or fail)

3. COMPLETED (✓)
   - Job finished successfully
   - Result stored in database
   - Auto-saved to appropriate storage (Library, Cache, etc.)
   - User gets toast notification
   - completed_at timestamp set

4. FAILED (✕)
   - Job encountered error
   - error_message and error_details stored
   - Can be retried (up to max_retries)
   - User sees error message and retry button

5. CANCELLED (🚫)
   - User cancelled pending job
   - No further processing
```

#### Story Generation Flow (Updated)

```
User fills GeneratorModal (level, topic, instructions)
    ↓
submit → createStoryGenerationJob()
    ↓
Client-side validation (fast feedback)
    ↓
Call job-creator Edge Function (returns immediately!)
    ↓
Job record created in database (status: pending)
    ↓
🔥 DATABASE TRIGGER FIRES (pg_net makes HTTP request to job-worker)
    ↓
User sees "Story queued!" toast
    ↓
[USER CAN CLOSE BROWSER HERE]
    ↓
Job-worker claims job within 1-3 seconds (status: processing)
    ↓
Worker calls Gemini API: gemini-2.5-flash-lite
    ↓
Story generated, parsed, validated
    ↓
Job record updated with result (status: completed)
    ↓
Client polling detects completion
    ↓
Story auto-saved to Library
    ↓
User gets "Story ready!" toast
    ↓
User can read story immediately!
```

**Architecture Benefits:**

- ✅ **User can close browser** during generation (jobs run on server)
- ✅ **Sequential processing** (one job at a time, respects rate limits)
- ✅ **Manual retry** for failed jobs
- ✅ **LocalStorage backup** for offline capability
- ✅ **Real-time UI updates** (3-second polling)
- ✅ **Unified queue** for all job types
- ✅ **Extensible** - easy to add new job types

**Rate Limiting Strategy:**

Jobs process **sequentially** (one at a time):

- Prevents API rate limit issues
- No parallel execution
- 30-second delays between audio generation jobs (when implemented)

**Security:**

- User's own API key (bring-your-key model)
- Key passed in job parameters
- Not stored permanently in database (deleted with job)
- RLS ensures users can only see their own jobs
- **CRON_SECRET authentication** (January 2026):
  - Job-worker requires `Bearer ${CRON_SECRET}` authorization header
  - Database triggers use cron secret for secure invocation
  - Unauthorized requests return 401 error
  - Logs unauthorized access attempts for security monitoring

**Performance:**

- Polling every 3 seconds (can upgrade to Supabase Realtime for instant updates)
- Database indexes on `user_id`, `status`, `created_at`
- LocalStorage backup for fast initial load
- Keeps only last 20 completed/failed jobs in memory

---

### 5. AI Integration System

**Key Files:**

- **`src/services/api.js`** - Client-side API calls and validation
- **`supabase/functions/job-worker/index.ts`** - Server-side story generation (via background jobs)

**Note:** Story generation and audio generation now use the Background Job System (see Section 4). The flow is documented there with full job lifecycle.

**API Endpoints Used:**

1. **Text Generation:** `gemini-2.5-flash-lite` (via Edge Function)
   - Generates Japanese stories + translations + vocab + questions
   - Runs on Supabase Edge Functions (Deno runtime)

2. **TTS Generation:** `gemini-2.5-flash-preview-tts` (via Edge Function)
   - Converts Japanese text to natural-sounding speech
   - Returns WAV audio data stored in Supabase Storage
   - Rate limiting managed server-side (30s delays)

3. **Image Generation:** `pollinations.ai` API (client-side)
   - Generates illustrations for story segments
   - Model: `zimage`
   - No apparent rate limiting
   - Lower priority for server-side migration

**Error Handling:**

- Client-side validation for immediate feedback
- Server-side validation and error handling in Edge Function
- Graceful fallback to browser TTS
- User-friendly error messages via Toast notifications

---

### 6. User Interface Components

#### Component Hierarchy

```
Header (Persistent)
├── Logo/Brand
├── Navigation Links (Home, Library, Queue, Settings, Kana Chart)
├── Theme Toggle (Light/Dark mode switch)
├── Queue Badge (Background job count)
└── Mobile Menu (Hamburger for mobile)

Pages (Route-Dependent)
├── Home
│   ├── Hero Section (App introduction)
│   ├── Stats Dashboard (Stories read, generated, available)
│   ├── Continue Reading (Resume progress)
│   └── Featured Stories (Story cards)
├── Library
│   ├── Search Bar (Real-time filtering)
│   ├── Filters (Level, Sort, View toggle)
│   ├── Generator Modal (Story creation)
│   └── Story Grid/List (Card display)
├── Read
│   ├── Story Loader (Continue/restart prompts)
│   └── Reader Component (Full reading interface)
│       ├── Audio Player (Sticky playback controls)
│       ├── Story Content (Segments with translations)
│       ├── Kana Tooltips (Pronunciation guide)
│       ├── Settings Panel (Reading preferences)
│       └── Comprehension Questions
├── Queue
│   ├── Queue List (All background jobs)
│   ├── Filter Tabs (All, Pending, Processing, Completed, Failed)
│   ├── Progress Indicators (Status badges)
│   └── Action Buttons (Retry, Cancel, Dismiss)
├── Settings
│   ├── Authentication (Sign in/out, cloud sync)
│   ├── Display Options (Theme, view mode)
│   ├── Reading Preferences (Furigana, images, font size)
│   ├── Data Management (Import/export, cache)
│   └── API Configuration (Gemini, Pollinations keys)
└── KanaChart
    ├── System Toggle (Hiragana/Katakana)
    ├── Grid Display (Interactive character tables)
    └── Pronunciation Guide (Romaji readings)

Shared Components (Reused across pages)
├── StoryCard (Library, Home - Story preview with progress)
├── Reader (Read page - Main reading interface)
├── GeneratorModal (Library, Header - Story creation form)
├── Toast (All pages - Notification system)
├── ProgressBar (All pages - Loading states)
└── Header (All pages - Navigation)

Component Infrastructure
├── componentBase.js (Lifecycle management)
│   ├── createComponent() (Mount/unmount)
│   ├── createElement() (HTML to DOM)
│   ├── createState() (Reactive state)
│   └── useCleanup() (Memory management)
└── eventManager.js (Event handling)
    ├── on() (Individual listeners)
    ├── delegate() (Event delegation)
    └── cleanup() (Automatic removal)
```

#### Key Components

**`src/components/Reader.js`** (~24,373 bytes) - _Largest component_

**Responsibilities:**

- Renders story content with side-by-side translation
- Displays vocabulary notes on hover/click
- Progress tracking (auto-saves reading position)
- Audio Player integration (Phase 1 Refactor)
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
  viewMode: String         // 'side-by-side' | 'stacked'
  showFurigana: Boolean    // Show furigana reading aid
  showEnglish: Boolean     // Show English translation
  showImages: Boolean      // Show AI-generated images
  fontSize: String         // 'medium' | 'large'
}
```

**Phase 1 Audio Player Controls (January 2026):**

New comprehensive audio player with the following features:

- **Sticky positioning** - Player stays visible while scrolling through story
- **Visual progress bar** - Clickable/draggable with gradient fill and handle
- **Playback speed control** - Toggle between 1x and 1.25x speeds
- **Time display** - Current time and total duration (MM:SS format)
- **Play/Pause button** - Large, accessible button with icon
- **Seek functionality** - Click anywhere on progress bar to jump to position
- **Keyboard shortcuts** - Space to play/pause, arrow keys for seek
- **Sticky positioning** - Player stays visible while scrolling through story
- **Visual progress bar** - Clickable/draggable with gradient fill and handle
- **Playback speed control** - Toggle between 1x and 1.25x speeds
- **Time display** - Current time and total duration (MM:SS format)
- **Play/Pause button** - Large, accessible button with icon
- **Seek functionality** - Click anywhere on progress bar to jump to position
- **Keyboard shortcuts** - Space to play/pause, arrow keys for seek
- **Smooth animations** - slideDown animation on mount, smooth progress updates
- **Progress tracking** - Real-time progress updates via subscription system
- **Responsive design** - Works on mobile and desktop
- **Accessibility** - ARIA labels, focus-visible states, semantic HTML

**Implementation Details:**

- `src/components/AudioPlayer.js`: Dedicated audio player component (+290 lines)
- `src/components/Reader.js`: Audio player integration via component composition
- `src/utils/audio.js`: Audio playback utilities with progress tracking (+154 lines)
- `src/styles/components/audioplayer.css`: Dedicated audio player styles (198 lines)
- `src/styles/animations.css`: Animation keyframes for UI transitions (41 lines)

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

**`src/components/AudioPlayer.js`** (9,626 bytes)

**Responsibilities:**

- Dedicated sticky audio player bar
- Playback state management (play/pause/resume)
- Progress tracking and scrubbing
- Playback speed control
- Independent rendering (decoupled from Reader text updates)

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

### 7. Utilities and Services Layer

**Entry Points:** `src/utils/` and `src/services/`

The utilities layer provides core infrastructure services used throughout the application.

#### Core Infrastructure Utilities

**`src/utils/componentBase.js`** (4,643 bytes)

- `createElement(html)`: Converts HTML strings to DOM elements
- `createComponent()`: Component lifecycle management
- `createEventManager()`: Returns EventManager instance
- `createState(initial)`: Reactive state management with subscriptions
- `useCleanup(callback)`: Registers cleanup callbacks (prevents memory leaks)
- `debounce(fn, delay)`: Performance optimization for frequent events

**`src/utils/eventManager.js`** (6,289 bytes)

- `EventManager` class with automatic cleanup on route changes
- `on(element, event, handler)`: Individual event listeners
- `delegate(parent, event, selector, handler)`: Event delegation for dynamic content
- `cleanup()`: Remove all registered listeners
- Supports passive event listeners for scroll/touch optimization

**`src/utils/router.js`** (3,686 bytes)

- Hash-based SPA routing (`#/home`, `#/library`, `#/read?id=123`)
- Lazy loading of page modules for performance
- Automatic cleanup of event listeners and subscriptions
- Query parameter parsing via `getRouteInfo()`
- Error boundaries for failed page loads

#### Data Management Utilities

**`src/utils/storage.js`** (11,466 bytes) - _Critical utility_

- Manages localStorage with cloud sync via Supabase
- Handles: themes, settings, API keys, stories, progress tracking
- Provides bidirectional sync (local ↔ cloud)
- Includes data cleanup and full sync capabilities
- Functions: `getStories()`, `saveStories()`, `syncToCloud()`, `syncFromCloud()`

**`src/utils/imageStorage.js`**

- Two-tier caching: browser Cache API + Supabase Storage
- Segment-based image storage for stories
- Automatic cache management and cleanup

**`src/utils/jobQueue.js`** (~300 lines)

- Client-side job queue manager with polling
- `createJob()`: Queue a new job for processing
- `retryJob()`: Retry failed jobs
- `cancelJob()`: Cancel pending jobs
- `subscribe()`: Observer pattern for real-time UI updates
- Polls database every 3 seconds for job status changes

#### Audio System

**`src/utils/audio.js`**

- Comprehensive audio playback system
- Manages cached and cloud-based TTS audio
- Handles progress tracking, playback controls, state management
- Integrates with both browser Cache API and Supabase Storage
- Functions: `playAudio()`, `togglePause()`, `setPlaybackRate()`, `seekTo()`

**`src/utils/audioHelpers.js`**

- WAV header creation for PCM audio data
- Base64 to binary conversion for audio processing
- Low-level audio format handling

**`src/utils/audioQueue.js`** - _DEPRECATED_

- Legacy TTS queue system
- Replaced by background job system
- Kept for backward compatibility

#### Services

**`src/services/api.js`**

- Story generation via Google Gemini AI
- Text-to-speech audio generation
- Background job creation and management
- API key validation and error handling
- Backward compatibility with synchronous generation

**`src/utils/supabase.js`**

- Centralized authentication (signIn, signUp, signOut)
- Environment-based configuration
- Graceful fallback when credentials are missing

#### Architectural Patterns

**Singleton Pattern:** Most utilities export single instances (`jobQueue`, `router`)

**Observer Pattern:** Subscribers for state updates (jobs, progress, events)

**Factory Pattern:** Component creation functions (`createComponent()`, `createElement()`)

**Strategy Pattern:** Dual caching strategies (local + cloud)

---

### 8. Design System

**Architecture (v3.0 - January 2026):**

The design system has been fully refactored with all inline CSS removed and a new `pages/` directory for page-specific styles.

```
src/styles/
├── base/ (3 files)
│   ├── variables.css      # Design tokens (colors, spacing, typography)
│   ├── typography.css     # Font definitions and text styles
│   └── reset.css          # CSS reset and base element styles
├── components/ (13 files)
│   ├── audioplayer.css    # Audio player controls (Phase 1)
│   ├── badges.css         # Badge components
│   ├── buttons.css        # Button system
│   ├── cards.css          # Card components
│   ├── emptystates.css    # Empty state components
│   ├── filters.css        # Filter controls
│   ├── forms.css          # Form elements
│   ├── headers.css        # Header components
│   ├── modals.css         # Modal dialogs + Generator Modal styles
│   ├── progress.css       # Progress indicators
│   ├── queue.css          # Job queue UI
│   ├── readers.css        # Reader components (518 lines)
│   ├── skeleton.css       # Loading skeletons
│   └── toasts.css         # Notifications
├── pages/ (4 files)        # NEW - Page-specific styles
│   ├── home.css           # Home page (196 lines)
│   ├── kanachart.css      # Kana Chart page (252 lines)
│   ├── library.css        # Library page (177 lines)
│   └── settings.css       # Settings page (314 lines)
├── themes/ (1 file)
│   └── dark.css           # Dark mode overrides
├── utilities/ (2 files)
│   ├── helpers.css        # Utility helpers
│   └── layout.css         # Layout utilities
├── animations.css         # Global animations (157 lines)
└── index.css              # Main entry point (41 lines)
```

**Total CSS:** 3,408 lines across 26 files

**Key Changes (January 2026):**

- ✅ **All inline CSS removed** from JavaScript files (~1,270 lines extracted)
- ✅ **New `pages/` directory** for page-specific styles
- ✅ **No `createElement('style')` patterns** remain in codebase
- ✅ **BEM naming conventions** consistently applied
- ✅ **CSS custom properties** used throughout (design tokens)
- ✅ **Proper import order** in index.css following ITCSS methodology
- ✅ **Complete button system** with all variants (primary, accent, secondary, ghost, danger, critical)
- ✅ **All component classes defined** (reveal-btn, toggle-btn, filter-btn, etc.)
- ✅ **Progress bar styles consolidated** in progress.css with modifiers for thin/centered variants

**Import Order (index.css):**

```css
/* Base Layer */
@import './base/variables.css';
@import './base/reset.css';
@import './base/typography.css';

/* Utilities */
@import './utilities/layout.css';
@import './utilities/helpers.css';

/* Components (alphabetical) */
@import './components/audioplayer.css';
@import './components/badges.css';
@import './components/buttons.css';
@import './components/cards.css';
@import './components/emptystates.css';
@import './components/filters.css';
@import './components/forms.css';
@import './components/headers.css';
@import './components/modals.css';
@import './components/progress.css';
@import './components/queue.css';
@import './components/readers.css';
@import './components/skeleton.css';
@import './components/toasts.css';

/* Pages (alphabetical) */
@import './pages/home.css';
@import './pages/kanachart.css';
@import './pages/library.css';
@import './pages/settings.css';

/* Themes */
@import './themes/dark.css';

/* Animations */
@import './animations.css';
```

**CSS Architecture Layers:**

```css
/* 1. CSS Custom Properties (Design Tokens) */
:root {
  --color-primary: hsl(340, 65%, 47%);
  --color-secondary: hsl(245, 58%, 51%);
  --color-accent: hsl(38, 92%, 50%);
  --spacing-md: ...;
  --font-size-base: ...;
}

/* 2. Reset & Base Styles */
* { box-sizing: border-box; }
body { font-family: 'Inter', 'Noto Sans JP', sans-serif; }

/* 3. Utility Classes */
.container { max-width: 1200px; margin: 0 auto; }
.flex { display: flex; }
.grid { display: grid; }

/* 4. Component Classes */
.btn { ... }
.card { ... }
.modal { ... }
.audio-player { ... }  /* NEW - Phase 1 */

/* 5. Animations */
@keyframes slideDown { ... }  /* NEW */
@keyframes slideUp { ... }
@keyframes fadeIn { ... }

/* 6. Dark Mode Overrides */
[data-theme="dark"] {
  --color-bg: #1a1a1a;
  ...
}

/* 7. Responsive Breakpoints */
@media (max-width: 768px) { ... }
```

**Key Principles:**

1. **Modular organization** - Each component/page has its own CSS file
2. **Design tokens** - Centralized CSS custom properties for theming
3. **No inline styles** - All CSS in external files (no JavaScript CSS injection)
4. **Component-based** - Reusable `.btn`, `.card`, `.badge`, `.audio-player`
5. **Page-specific styles** - Dedicated `pages/` directory for page-level CSS
6. **BEM naming** - Consistent Block-Element-Modifier naming convention
7. **Dark mode native** - `[data-theme="dark"]` attribute with smooth transitions
8. **Mobile-first** - Responsive breakpoints
9. **Animation library** - Pre-built transitions and keyframes
10. **Accessibility** - Focus-visible styles, semantic HTML

---

## Data Flow Diagrams

### Story Generation Flow (Background Job System)

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
│ createStory │
│GenerationJob│
└──────┬──────┘
       ↓
┌─────────────┐
│ job-creator │ (Edge Function)
│ Returns Job │ (IMMEDIATE!)
│    ID       │
└──────┬──────┘
       ↓
┌─────────────┐       ┌──────────────┐
│ Database    │──────→│   Jobs Table  │
│ (pending)   │       │   status:pending
└─────────────┘       └──────────────┘
       ↓
┌──────────────────────────────────────┐
│ [USER CAN CLOSE BROWSER HERE!]      │
│ Job runs on server in background    │
└──────────────────────────────────────┘
       ↓ (1-3 seconds!)
┌─────────────┐
│ ON-INSERT   │ (Immediate trigger)
│ TRIGGER     │ (via pg_net)
│ fires       │
│ job-worker  │
└──────┬──────┘
       ↓
┌─────────────┐       ┌──────────────┐
│ job-worker  │──────→│ Claims Job   │
│ (processing) │       │ Updates status│
└──────┬──────┘       └──────────────┘
       ↓
┌─────────────┐       ┌──────────────────┐
│ Gemini API  │──────→│ Story Generated │
└─────────────┘       └──────────────────┘
       ↓
┌─────────────┐
│ Job Result  │
│ Saved to DB │
└──────┬──────┘
       ↓
┌─────────────┐       ┌──────────────┐
│ Client      │──────→│ LocalStorage │
│ Polling     │       │   Library    │
│ (detects    │       │ (auto-save)  │
│ completion) │       └──────────────┘
└──────┬──────┘
       ↓
┌─────────────┐
│ Toast:       │
│ "Story ready!"│
└─────────────┘
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

### Image Generation Flow

```
┌─────────────┐
│ Display     │
│ Story in    │
│ Reader      │
└──────┬──────┘
       ↓
┌─────────────┐
│ Reader.js   │
│ Detects     │
│ Missing     │
│ Images      │
└──────┬──────┘
       ↓
┌─────────────┐
│ Fetch from  │
│Pollinations │
│ AI          │
└──────┬──────┘
       ↓
┌─────────────┐
│ Image Blob  │
│ Response    │
└──────┬──────┘
       ↓
┌─────────────┐
│Cache API    │
│(/images/...)│
└──────┬──────┘
       ↓
┌─────────────┐
│ Display     │
│ with fade-in│
│ animation   │
└─────────────┘
```

**Notes:**

- Images generated per story segment based on `imagePrompt`
- Generated on-demand as user scrolls through story
- Less disruptive if browser closes (images reload on navigation)
- No rate limiting observed

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

### Cache Strategy

**Hybrid Caching System:**

```
┌─────────────────────────────────────────────────────────────┐
│                    CACHE CHECK SEQUENCE                     │
└─────────────────────────────────────────────────────────────┘

For Audio:
1. Check Browser Cache API (key: `story-audio-{storyId}`)
   ↓ Not found
2. Check Supabase Storage (`audio-cache` bucket)
   ↓ Not found
3. Generate new audio (client-side API call)
   ↓ Store in both Browser Cache + Supabase Storage

For Images:
1. Check Browser Cache API (key: `/images/{storyId}/segment-{index}`)
   ↓ Not found
2. Check Supabase Storage (`image-cache` bucket)
   ↓ Not found
3. Generate new image (Pollinations AI)
   ↓ Store in both Browser Cache + Supabase Storage
```

**Cache Details:**

| Cache Type        | Purpose                         | Location       | Scope                 |
| ----------------- | ------------------------------- | -------------- | --------------------- |
| Browser Cache API | Fast access, offline capability | Client browser | Per-device            |
| Supabase Storage  | Cloud backup, cross-device sync | Remote buckets | Shared across devices |

**Cache Keys:**

```javascript
// Audio
`story-audio-${storyId}` // Browser Cache
`audio-cache/${storyId}.wav` // Supabase Storage
// Images
`/images/${storyId}/segment-${index}` // Browser Cache
`image-cache/${storyId}_${index}.png`; // Supabase Storage
```

**Benefits:**

- **Performance**: Browser cache provides instant access
- **Reliability**: Supabase provides backup if browser cache cleared
- **Cross-device**: Users can access cached assets on different devices
- **Offline-capable**: Browser cache works without internet

---

## File Responsibility Matrix

| File                                                           | Primary Role                          | Dependencies                        | Used By                         |
| -------------------------------------------------------------- | ------------------------------------- | ----------------------------------- | ------------------------------- |
| **src/main.js**                                                | App entry point                       | router.js, Header                   | Browser                         |
| **src/types.js**                                               | Type definitions (JSDoc)              | None                                | api.js, storage.js, jobQueue.js |
| **src/utils/router.js**                                        | Hash routing, lazy loading            | componentBase.js                    | All pages                       |
| **src/utils/componentBase.js**                                 | Component lifecycle                   | eventManager.js                     | router.js, all components       |
| **src/utils/eventManager.js**                                  | Event management, cleanup             | None                                | All components                  |
| **src/utils/storage.js**                                       | Data persistence, Supabase sync       | supabase.js                         | All components                  |
| **src/utils/supabase.js**                                      | Supabase client config                | @supabase/supabase-js               | storage.js, jobQueue.js         |
| **src/utils/jobQueue.js**                                      | Background job queue manager          | supabase.js                         | Header.js, Queue.js, api.js     |
| **src/utils/audio.js**                                         | Audio playback                        | audioHelpers.js, storage.js         | Reader.js                       |
| **src/utils/audioQueue.js**                                    | **DEPRECATED** - TTS queue (legacy)   | Do not use - replaced by job system | -                               |
| **src/utils/audioHelpers.js**                                  | WAV format utilities                  | None                                | audio.js                        |
| **src/utils/imageStorage.js**                                  | Image caching                         | storage.js                          | Reader.js                       |
| **src/services/api.js**                                        | Client-side API calls                 | @supabase/supabase-js, jobQueue.js  | GeneratorModal.js               |
| **supabase/functions/job-creator/**                            | Job creation endpoint                 | @supabase/supabase-js               | api.js (via jobQueue)           |
| **supabase/functions/job-worker/**                             | Job processing worker                 | @google/generative-ai               | Database trigger (on-insert)    |
| **supabase/functions/job-status/**                             | Job status endpoint                   | @supabase/supabase-js               | jobQueue.js (polling)           |
| **src/components/Header.js**                                   | Navigation, theme toggle, queue badge | router.js, storage.js, jobQueue.js  | All pages                       |
| **src/components/Reader.js**                                   | Story display, playback               | audio.js, storage.js                | Read page                       |
| **src/components/GeneratorModal.js**                           | Story creation form                   | api.js, storage.js                  | Header (global)                 |
| **src/components/StoryCard.js**                                | Story preview card                    | storage.js                          | Home, Library                   |
| **src/components/Toast.js**                                    | Notifications                         | eventManager.js                     | All components                  |
| **src/components/ProgressBar.js**                              | Loading indicator                     | None                                | All components                  |
| **src/pages/Home.js**                                          | Landing page                          | StoryCard, storage.js               | router.js                       |
| **src/pages/Library.js**                                       | Story browser                         | StoryCard, storage.js               | router.js                       |
| **src/pages/Read.js**                                          | Story loader                          | Reader, storage.js                  | router.js                       |
| **src/pages/Queue.js**                                         | Unified job queue UI                  | jobQueue.js                         | router.js                       |
| **src/pages/Settings.js**                                      | User preferences                      | storage.js                          | router.js                       |
| **src/pages/KanaChart.js**                                     | Kana reference                        | data/kana.js                        | router.js                       |
| **src/data/kana.js**                                           | Kana character data                   | None                                | KanaChart.js                    |
| **src/styles/index.css**                                       | Design system entry point             | None                                | All components                  |
| **src/styles/base/variables.css**                              | Design tokens                         | None                                | All CSS files                   |
| **src/styles/components/**                                     | Component CSS (13 files)              | variables.css                       | Respective components           |
| **src/styles/pages/**                                          | Page-specific CSS (4 files)           | variables.css                       | Respective pages                |
| **index.html**                                                 | HTML entry point                      | Google Fonts                        | main.js                         |
| **supabase/migrations/20240104_create_jobs_table.sql**         | Jobs table schema                     | -                                   | Database setup                  |
| **supabase/migrations/20260104_add_on_insert_job_trigger.sql** | On-insert trigger setup               | pg_net extension                    | Real-time job processing        |

_Last Updated: January 11, 2026_

For development guidelines, contributing patterns, and troubleshooting, see [CONTRIBUTING.md](CONTRIBUTING.md).

For deployment setup and environment configuration, see [DEPLOYMENT.md](DEPLOYMENT.md).
