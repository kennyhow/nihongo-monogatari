# Contributing to Nihongo Monogatari

Welcome! This guide will help you understand how to work with this codebase effectively.

## For New Contributors

**Nihongo Monogatari** is a web application for learning Japanese through AI-generated stories with side-by-side translation and text-to-speech.

**Tech Stack:**

- **Framework**: Vanilla JavaScript + Vite (no frameworks)
- **Styling**: Custom CSS Design System
- **AI**: Google Gemini 2.5 Flash (text & TTS)
- **Backend**: Supabase (PostgreSQL + Edge Functions + Storage)
- **Architecture**: Serverless background job system

**First Steps:**

1. Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the system
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) for environment setup
3. Follow existing patterns - don't reinvent conventions
4. Test incrementally - run `npm run build` frequently

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run build
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

### Git Workflow

**Pre-commit hooks** run automatically:

- ESLint checks code quality
- Prettier formats your code
- Don't bypass these hooks!

**Commit Message Format:**

```
<type>: <short description>

<optional longer description>

<optional details about implementation>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types:**

- `feat:` New feature (user-visible)
- `fix:` Bug fix
- `refactor:` Code change without feature/fix
- `docs:` Documentation only
- `style:` Formatting, linting
- `test:` Adding/updating tests
- `chore:` Build process, dependencies

**Examples:**

```
feat: add dark mode toggle

- Added theme toggle in Header component
- Persist theme choice in localStorage
- Updated all components to respect data-theme attribute

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

```
fix: prevent duplicate audio generation jobs

- Added isAudioAvailable() to check database for existing jobs
- Updated Reader.js to skip job creation if job already exists
- Fixed race condition when reopening story page

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

## Working with Type Definitions

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
- `Job` - Background job object
- `JobType` - Job type: story_generation, audio_generation, image_generation
- `JobStatus` - Job status: pending, processing, completed, failed, cancelled

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

## Critical Architecture Patterns

### Component Lifecycle (`src/utils/componentBase.js`)

```javascript
// Always use cleanup functions to prevent memory leaks
import { useCleanup } from '../utils/componentBase.js';

const cleanup = useCleanup(element, () => {
  subscription.unsubscribe();
});

// Router automatically calls cleanups on navigation
```

### EventManager Pattern (`src/utils/eventManager.js`)

```javascript
import { createEventManager } from '../utils/componentBase.js';

const events = createEventManager();
events.on(button, 'click', handleClick);
events.delegate(container, 'click', '.dynamic-button', handleDynamicClick);

// Automatic cleanup via useCleanup
useCleanup(element, events.cleanup.bind(events));
```

⚠️ **IMPORTANT**: Never use `addEventListener` directly. Always use EventManager for automatic cleanup.

### Background Job System

- **Jobs table**: Database-backed queue (not in-memory)
- **Trigger-based**: On-insert trigger fires job-worker immediately (1-3 seconds)
- **Sequential processing**: One job at a time via database locking
- **Client polling**: 3-second intervals via jobQueue.js subscription

**Job Types:**

- `story_generation`: Generate story content via Gemini API
- `audio_generation`: Generate full-story audio via Gemini TTS
- `image_generation`: (Future) Generate images via Pollinations AI

## Adding New Features

### New Page

1. Create `src/pages/NewPage.js`:

```javascript
export default function renderMyPage(parentElement) {
  const events = createEventManager();

  // Your page logic here
  events.on(button, 'click', handleClick);

  // Return cleanup function
  return () => events.cleanup();
}
```

2. Add route in `src/utils/router.js`:

```javascript
{
  path: '/mypage',
  module: () => import('../pages/NewPage.js')
}
```

3. Add nav link in `src/components/Header.js`:

```html
<a href="#/mypage" class="nav-link">My Page</a>
```

### New Component

1. Use design system classes (no inline styles):

```javascript
const card = createElement(`
  <div class="card">
    <h2 class="card-title">Title</h2>
    <p class="card-body">Content</p>
  </div>
`);
```

2. Use EventManager for all event listeners
3. Use `useCleanup()` for subscriptions
4. Append styles via `document.head.appendChild()` if needed

### New Job Type

To add a new job type (e.g., "translation_job"):

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

### Storage Operations

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

## Working with Background Jobs

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
unsubscribe();
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

## Common Pitfalls (From Experience)

### 1. EventManager & Memory Leaks

**❌ Wrong:**

```javascript
document.addEventListener('click', handler); // Never cleaned up!
```

**✅ Right:**

```javascript
const events = createEventManager();
events.on(document, 'click', handler);
useCleanup(element, events.cleanup.bind(events));
```

### 2. Dataset Storage Limitation

**❌ Wrong:**

```javascript
element.dataset.object = myObject; // Becomes "[object Object]"
```

**✅ Right:**

```javascript
const storage = new Map();
storage.set(element.id, myObject);
useCleanup(element, () => storage.delete(element.id));
```

### 3. Conditional Element Rendering

**❌ Wrong:**

```javascript
const btn = container.querySelector('#maybe-exists');
events.on(btn, 'click', handler); // Crashes if btn is null!
```

**✅ Right:**

```javascript
const btn = container.querySelector('#maybe-exists');
if (btn) {
  events.on(btn, 'click', handler);
}
```

### 4. Unused Catch Variables

**❌ Wrong:**

```javascript
try { ... } catch (e) { /* e unused */ }
```

**✅ Right:**

```javascript
try { ... } catch { /* no parameter needed */ }
```

### 5. Switch Case Declarations

**❌ Wrong:**

```javascript
switch (x) {
  case 'foo':
    const y = 1; // SyntaxError in ESLint
    break;
}
```

**✅ Right:**

```javascript
switch (x) {
  case 'foo': {
    const y = 1;
    break;
  }
}
```

### 6. Inline Styles (Design System Violation)

**❌ Wrong:**

```javascript
element.style.transform = 'rotate(180deg)';
```

**✅ Right:**

```javascript
element.classList.add('theme-icon--animating');
// In CSS: .theme-icon--animating { transform: rotate(180deg); }
```

## Key Constants

```javascript
// Storage Keys (src/utils/storage.js)
STORAGE_KEYS = {
  STORIES: 'nihongo_stories', // Array of story objects
  PROGRESS: 'nihongo_progress', // Object: { storyId: completion% }
  SETTINGS: 'nihongo_settings', // View mode, font size, etc.
  THEME: 'nihongo_theme', // 'light' | 'dark'
  API_KEYS: 'nihongo_api_keys', // User's Gemini API key
};

// JLPT Levels
LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'];

// View Modes
VIEW_MODES = ['side-by-side', 'paragraph'];

// Job Types
JOB_TYPES = ['story_generation', 'audio_generation', 'image_generation'];

// Job Statuses
JOB_STATUS = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
```

## Environment Variables

**Client-side (Vite):**

```bash
VITE_SUPABASE_PUBLISHABLE_KEY=...    # Supabase anon key
VITE_SUPABASE_URL=...                # Supabase endpoint
```

**Server-side (Supabase Edge Functions):**

```bash
GEMINI_API_KEY=...                   # User-provided (bring-your-key)
CRON_SECRET=...                      # For job-worker authentication
```

⚠️ **IMPORTANT**: No hardcoded API keys. Users provide their own Gemini API key via Settings.

## Performance Guidelines

1. **Lazy Loading:** Pages loaded on-demand via router.js
2. **Audio Caching:** Browser Cache API for TTS data
3. **Image Caching:** Cache API for story images
4. **Debouncing:** Search inputs in Library page
5. **Throttling:** TTS generation queue (30s intervals)
6. **LocalStorage:** Fast synchronous data access
7. **Minimal DOM Manipulation:** Batch updates where possible

## Security Best Practices

1. **API Keys:** Stored in `.env` (not in git)
2. **Supabase RLS:** Row-level security enabled
3. **XSS Prevention:** `createElement()` sanitizes HTML
4. **Input Validation:** Story generator validates user input
5. **No Inline Scripts:** All JS in separate modules

## Troubleshooting

For common issues and solutions, see [DEPLOYMENT.md](DEPLOYMENT.md).

**Key Issues:**

- 401 errors with Edge Functions → Check "Verify JWT with legacy secret" setting
- Jobs stuck in "pending" → Check pg_net extension and database triggers
- Environment variables not working → Restart dev server after changing `.env`

## File Reference

### Services

| File                  | Purpose                                      | Notes                     |
| --------------------- | -------------------------------------------- | ------------------------- |
| `src/services/api.js` | API wrappers for Supabase and Edge Functions | Uses bring-your-key model |

### Utilities

| File                         | Purpose                            | Notes                               |
| ---------------------------- | ---------------------------------- | ----------------------------------- |
| `src/utils/componentBase.js` | Component lifecycle & EventManager | **ALWAYS use for event listeners**  |
| `src/utils/router.js`        | Hash-based SPA router with cleanup | Auto-runs cleanups on navigation    |
| `src/utils/storage.js`       | LocalStorage wrappers              | Stories, settings, progress         |
| `src/utils/audio.js`         | Audio playback with caching        | Checks browser cache, then Supabase |
| `src/utils/jobQueue.js`      | Job queue subscription manager     | Real-time UI updates for job status |
| `src/utils/supabase.js`      | Supabase client config             | Singleton instance                  |

### Components

| File                               | Purpose                        | Notes                          |
| ---------------------------------- | ------------------------------ | ------------------------------ |
| `src/components/Header.js`         | Nav, theme toggle, queue badge | -                              |
| `src/components/StoryCard.js`      | Story preview card             | -                              |
| `src/components/GeneratorModal.js` | Story creation form            | -                              |
| `src/components/Reader.js`         | Main reading interface         | Auto-triggers audio generation |
| `src/components/Toast.js`          | Notification system            | -                              |
| `src/components/ProgressBar.js`    | Loading indicator              | -                              |

### Pages

| File                     | Purpose                           | Notes             |
| ------------------------ | --------------------------------- | ----------------- |
| `src/pages/Home.js`      | Hero, stats, continue reading     | -                 |
| `src/pages/Library.js`   | Search, filters, grid/list        | -                 |
| `src/pages/Read.js`      | Story loader with continue prompt | -                 |
| `src/pages/Queue.js`     | Job queue dashboard               | Real-time updates |
| `src/pages/Settings.js`  | User preferences                  | -                 |
| `src/pages/KanaChart.js` | Kana reference                    | -                 |

---

For detailed architecture information, see [ARCHITECTURE.md](ARCHITECTURE.md).

For deployment and environment setup, see [DEPLOYMENT.md](DEPLOYMENT.md).
