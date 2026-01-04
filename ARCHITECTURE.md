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

**Key Changes:**

- ✅ Story generation: Supabase Edge Functions (users can close browser)
- ⚠️ Audio generation: Client-side (browser must stay open, TODO: migrate to Edge Functions)
- ⚠️ Image generation: Client-side (browser must stay open, lower priority)

### Service Architecture: Client vs Server

| Service              | Location             | Model                          | Can Close Browser? | Status           |
| -------------------- | -------------------- | ------------------------------ | ------------------ | ---------------- |
| **Story Generation** | Background Job Queue | `gemini-2.5-flash-lite`        | ✅ Yes             | ✅ Implemented   |
| **Audio Generation** | Client-side          | `gemini-2.5-flash-preview-tts` | ❌ No              | 🔴 High Priority |
| **Image Generation** | Client-side          | `pollinations.ai (zimage)`     | ❌ No              | 🟡 Low Priority  |

**Future Migration Roadmap:**

1. **Audio Generation** → Background Job Queue (High Impact)
   - Users currently must keep browser open during 30s+ queue processing
   - Rate limiting (30s intervals) managed client-side
   - Use same job-creator/job-worker pattern as story generation
   - Would complete the serverless architecture

2. **Image Generation** → Background Job Queue (Lower Impact)
   - Images load on-demand as user scrolls
   - Less disruptive if browser closes (reload on navigation)
   - No apparent rate limiting issues
   - Nice-to-have, but not critical

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

### 5. Background Job System

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
  - Cron-triggered worker (runs every 1 minute)
  - Claims pending jobs sequentially
  - Processes based on `job_type`:
    - `story_generation`: Calls Gemini API to generate stories
    - `audio_generation`: (Future) Calls Gemini TTS API
    - `image_generation`: (Future) Calls Pollinations AI
  - Updates job status and stores results
  - Handles errors with retry logic (up to 3 attempts)

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
User sees "Story queued!" toast
    ↓
[USER CAN CLOSE BROWSER HERE]
    ↓
Cron triggers job-worker (every 1 minute)
    ↓
Worker claims job (status: processing)
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

**Performance:**

- Polling every 3 seconds (can upgrade to Supabase Realtime for instant updates)
- Database indexes on `user_id`, `status`, `created_at`
- LocalStorage backup for fast initial load
- Keeps only last 20 completed/failed jobs in memory

---

### 6. AI Integration System

**Key Files:**

- **`src/services/api.js`** - Client-side API calls and validation
- **`supabase/functions/job-worker/index.ts`** - Server-side story generation (via background jobs)

**Note:** Story generation now uses the Background Job System (see Section 5). The flow is documented there with full job lifecycle.

**API Endpoints Used:**

1. **Text Generation:** `gemini-2.5-flash-lite` (via Edge Function)
   - Generates Japanese stories + translations + vocab + questions
   - Runs on Supabase Edge Functions (Deno runtime)
   - Voice: "Aoede"

2. **TTS Generation:** `gemini-2.5-flash-preview-tts` (client-side)
   - Converts Japanese text to natural-sounding speech
   - Returns WAV audio data
   - Rate limited to ~3 requests/minute
   - **TODO:** Migrate to Edge Function

3. **Image Generation:** `pollinations.ai` API (client-side)
   - Generates illustrations for story segments
   - Model: `zimage`
   - No apparent rate limiting
   - **Lower priority for migration**

**Error Handling:**

- Client-side validation for immediate feedback
- Server-side validation and error handling in Edge Function
- Graceful fallback to browser TTS
- User-friendly error messages via Toast notifications

---

### 7. User Interface Components

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
       ↓ (1 minute max wait)
┌─────────────┐
│ pg_cron      │ (Every 1 minute)
│ triggers     │
│ job-worker   │
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

| File                                                   | Primary Role                          | Dependencies                       | Used By                              |
| ------------------------------------------------------ | ------------------------------------- | ---------------------------------- | ------------------------------------ |
| **src/main.js**                                        | App entry point                       | router.js, Header                  | Browser                              |
| **src/types.js**                                       | Type definitions (JSDoc)              | None                               | api.js, storage.js, jobQueue.js      |
| **src/utils/router.js**                                | Hash routing, lazy loading            | componentBase.js                   | All pages                            |
| **src/utils/componentBase.js**                         | Component lifecycle                   | eventManager.js                    | router.js, all components            |
| **src/utils/eventManager.js**                          | Event management, cleanup             | None                               | All components                       |
| **src/utils/storage.js**                               | Data persistence, Supabase sync       | supabase.js                        | All components                       |
| **src/utils/supabase.js**                              | Supabase client config                | @supabase/supabase-js              | storage.js, jobQueue.js              |
| **src/utils/jobQueue.js**                              | Background job queue manager          | supabase.js                        | Header.js, Queue.js, api.js          |
| **src/utils/audio.js**                                 | Audio playback                        | audioHelpers.js, storage.js        | Reader.js                            |
| **src/utils/audioQueue.js**                            | TTS generation queue (legacy)         | api.js, storage.js                 | GeneratorModal.js (being phased out) |
| **src/utils/audioHelpers.js**                          | WAV format utilities                  | None                               | audio.js                             |
| **src/utils/imageStorage.js**                          | Image caching                         | storage.js                         | Reader.js                            |
| **src/services/api.js**                                | Client-side API calls                 | @supabase/supabase-js, jobQueue.js | GeneratorModal.js                    |
| **supabase/functions/job-creator/**                    | Job creation endpoint                 | @supabase/supabase-js              | api.js (via jobQueue)                |
| **supabase/functions/job-worker/**                     | Job processing worker                 | @google/generative-ai              | pg_cron (every 1 minute)             |
| **supabase/functions/job-status/**                     | Job status endpoint                   | @supabase/supabase-js              | jobQueue.js (polling)                |
| **src/components/Header.js**                           | Navigation, theme toggle, queue badge | router.js, storage.js, jobQueue.js | All pages                            |
| **src/components/Reader.js**                           | Story display, playback               | audio.js, storage.js               | Read page                            |
| **src/components/GeneratorModal.js**                   | Story creation form                   | api.js, storage.js                 | Header (global)                      |
| **src/components/StoryCard.js**                        | Story preview card                    | storage.js                         | Home, Library                        |
| **src/components/Toast.js**                            | Notifications                         | eventManager.js                    | All components                       |
| **src/components/ProgressBar.js**                      | Loading indicator                     | None                               | All components                       |
| **src/pages/Home.js**                                  | Landing page                          | StoryCard, storage.js              | router.js                            |
| **src/pages/Library.js**                               | Story browser                         | StoryCard, storage.js              | router.js                            |
| **src/pages/Read.js**                                  | Story loader                          | Reader, storage.js                 | router.js                            |
| **src/pages/Queue.js**                                 | Unified job queue UI                  | jobQueue.js                        | router.js                            |
| **src/pages/Settings.js**                              | User preferences                      | storage.js                         | router.js                            |
| **src/pages/KanaChart.js**                             | Kana reference                        | data/kana.js                       | router.js                            |
| **src/data/kana.js**                                   | Kana character data                   | None                               | KanaChart.js                         |
| **src/styles/index.css**                               | Design system                         | None                               | All components                       |
| **index.html**                                         | HTML entry point                      | Google Fonts                       | main.js                              |
| **supabase/migrations/20240104_create_jobs_table.sql** | Jobs table schema                     | -                                  | Database setup                       |

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
 * @typedef {import('../types.js').Job} Job
 * @typedef {import('../types.js').JobType} JobType
 * @typedef {import('../types.js').JobStatus} JobStatus
 */
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
- `Job` - Background job object (NEW)
- `JobType` - Job type: story_generation, audio_generation, image_generation (NEW)
- `JobStatus` - Job status: pending, processing, completed, failed, cancelled (NEW)

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

### Adding a New Job Type

**To add a new job type (e.g., "translation_job"):**

1. **Update database constraint:**

```sql
-- In Supabase SQL Editor
ALTER TABLE jobs
DROP CONSTRAINT jobs_job_type_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_job_type_check
CHECK (job_type IN ('story_generation', 'audio_generation', 'image_generation', 'translation_job'));
```

2. **Add validator in job-creator** (`supabase/functions/job-creator/index.ts`):

```typescript
const JOB_VALIDATORS = {
  // ... existing
  translation_job: data => {
    if (!data.text || !data.targetLanguage) {
      throw new Error('text and targetLanguage are required');
    }
    return true;
  },
};
```

3. **Add processor in job-worker** (`supabase/functions/job-worker/index.ts`):

```typescript
const JOB_PROCESSORS = {
  // ... existing
  translation_job: async parameters => {
    const { text, targetLanguage, geminiApiKey } = parameters;

    // Call translation API
    // Return result

    return { translatedText: '...' };
  },
};
```

4. **Create client-side helper** (`src/services/api.js`):

```javascript
/**
 * Create a background job for translation
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} Job ID
 */
export const createTranslationJob = async (text, targetLanguage) => {
  const { jobQueue } = await import('../utils/jobQueue.js');
  const keys = getApiKeys();

  return await jobQueue.createJob('translation_job', {
    text,
    targetLanguage,
    geminiApiKey: keys.translation,
  });
};
```

5. **Update types** (`src/types.js`):

```javascript
/**
 * Valid job types
 * @typedef {'story_generation' | 'audio_generation' | 'image_generation' | 'translation_job'} JobType
 */
```

### Working with Background Jobs

**Create a job from client code:**

```javascript
import { createStoryGenerationJob } from './services/api.js';

// Queue a story generation job
const jobId = await createStoryGenerationJob(
  'A cat who loves sushi',
  'N4',
  'Make it funny',
  'short'
);

console.log('Job queued:', jobId);
```

**Monitor job status:**

```javascript
import { jobQueue } from './utils/jobQueue.js';

// Subscribe to job updates
const unsubscribe = jobQueue.subscribe(jobs => {
  const pendingJobs = Array.from(jobs.values()).filter(
    j => j.status === 'pending' || j.status === 'processing'
  );

  console.log('Pending jobs:', pendingJobs.length);

  pendingJobs.forEach(job => {
    console.log(`Job ${job.id}: ${job.status}`);
    if (job.status === 'completed') {
      console.log('Result:', job.result);
    }
  });
});

// Later: unsubscribe()
// unsubscribe();
```

**Retry a failed job:**

```javascript
import { jobQueue } from './utils/jobQueue.js';

await jobQueue.retryJob(jobId);
```

**Cancel a pending job:**

```javascript
import { jobQueue } from './utils/jobQueue.js';

await jobQueue.cancelJob(jobId);
```

**Job lifecycle:**

1. **pending** → Job created, waiting in queue
2. **processing** → Worker is processing the job
3. **completed** → Job finished successfully, result stored
4. **failed** → Job encountered error (can retry)
5. **cancelled** → Job was cancelled by user

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

_Last Updated: January 4, 2026 (Implemented Background Job System)_

**Recent Changes:**

- **January 4, 2026 (Background Job System)**:
  - ✅ **Implemented database-backed job queue system**
  - ✅ **Story generation now runs in background** - users can close browser!
  - ✅ **Created 3 new Edge Functions**: job-creator, job-worker, job-status
  - ✅ **Added jobs table** to database with RLS policies
  - ✅ **Refactored Queue page** for unified job management
  - ✅ **Added job polling** (3-second intervals) for real-time UI updates
  - ✅ **Implemented job lifecycle**: pending → processing → completed/failed
  - ✅ **Manual retry** for failed jobs
  - ✅ **Sequential job processing** - respects API rate limits
  - ✅ **Added comprehensive documentation**: HOW_TO_MIGRATE.md, updated ARCHITECTURE.md
  - See sections:
    - Section 5: Background Job System
    - Section 6: AI Integration (updated)
    - Data Flow Diagrams (updated)

- **Earlier (January 4, 2026)**:
  - Added image generation flow diagram and documentation
  - Added comprehensive cache strategy section (browser + Supabase)
  - Added service architecture table (client vs server)
  - Documented migration roadmap for audio/image generation
  - Migrated story generation from client-side to Supabase Edge Functions
  - Users can now close browser during story generation (~30-60 seconds)
  - API keys moved to user-provided model (bring-your-key)
  - Added comprehensive documentation (EDGE_FUNCTION_SETUP.md, SUPABASE_API_KEY_MIGRATE.md)
  - See commit: `feat: migrate story generation to Supabase Edge Functions`

_For AI Agent Context: See AGENTS.md_
