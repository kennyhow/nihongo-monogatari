/**
 * Type Definitions for Nihongo Monogatari
 * @module types
 */

// ============================================================================
// ENUM CONSTANTS (Runtime + Type)
// ============================================================================

/**
 * Valid JLPT difficulty levels
 * @typedef {'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'Beginner' | 'Intermediate' | 'Advanced'} StoryLevel
 */

/** @type {StoryLevel[]} */
export const STORY_LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5', 'Beginner', 'Intermediate', 'Advanced'];

/**
 * Valid font size options
 * @typedef {'medium' | 'large'} FontSize
 */

/** @type {FontSize[]} */
export const FONT_SIZES = ['medium', 'large'];

/**
 * Valid view mode options
 * @typedef {'side-by-side' | 'stacked'} ViewMode
 */

/** @type {ViewMode[]} */
export const VIEW_MODES = ['side-by-side', 'stacked'];

/**
 * Valid story length options
 * @typedef {'short' | 'medium' | 'long'} StoryLength
 */

/** @type {StoryLength[]} */
export const STORY_LENGTHS = ['short', 'medium', 'long'];

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Vocabulary note for a story segment
 * @typedef {Object} VocabularyNote
 * @property {string} term - Japanese word/phrase
 * @property {string} meaning - English definition
 */

/**
 * Single segment of story content
 * @typedef {Object} StoryContent
 * @property {string} jp - Plain Japanese text without ruby tags
 * @property {string} jp_furigana - Japanese text with <ruby> tags for furigana
 * @property {string} en - English translation
 * @property {VocabularyNote[]} [notes] - Optional array of vocabulary notes
 */

/**
 * Comprehension question for story
 * @typedef {Object} ComprehensionQuestion
 * @property {string} question - Question text in English
 * @property {string[]} options - Array of 4 answer options
 * @property {string} answer - Correct option text (not index)
 * @property {string} explanation - Brief explanation of the answer
 */

/**
 * Complete story object
 * @typedef {Object} Story
 * @property {string} id - Unique identifier (starts with "gen-" for AI-generated)
 * @property {string} titleJP - Japanese title
 * @property {string} titleEN - English title
 * @property {StoryLevel} level - JLPT level or difficulty descriptor
 * @property {number} readTime - Estimated reading time in minutes
 * @property {string} excerpt - Short English summary
 * @property {StoryContent[]} content - Array of story segments
 * @property {ComprehensionQuestion[]} [questions] - Optional comprehension questions
 */

/**
 * User settings/preferences
 * @typedef {Object} UserSettings
 * @property {FontSize} [fontSize='medium'] - Font size preference
 * @property {boolean} [showFurigana=true] - Whether to show furigana
 * @property {ViewMode} [viewMode='side-by-side'] - Layout mode
 * @property {boolean} [showImages=true] - Whether to show generated images
 */

/**
 * Progress tracking for a single story
 * @typedef {Object} StoryProgress
 * @property {boolean} completed - Whether story is marked as completed
 * @property {number} [scrollPercent=0] - Scroll position 0-100
 * @property {number} lastRead - Unix timestamp of last read
 */

/**
 * All progress data indexed by story ID
 * @typedef {Object.<string, StoryProgress>} AllProgress
 */

/**
 * API keys for external services
 * @typedef {Object} ApiKeys
 * @property {string} [google=''] - Google Generative AI API key
 * @property {string} [pollinations=''] - Pollinations AI API key
 */

/**
 * Audio playback state
 * @typedef {Object} AudioState
 * @property {boolean} isPlaying - Whether audio is currently playing
 * @property {number} currentTime - Current playback position in seconds
 * @property {number} duration - Total audio duration in seconds
 */

/**
 * Audio queue item
 * @typedef {Object} AudioQueueItem
 * @property {string} storyId - Story ID
 * @property {string} storyTitle - Story title for display
 * @property {string} text - Full Japanese text
 * @property {number} segmentCount - Number of segments in story
 * @property {'pending' | 'processing' | 'completed' | 'error'} status - Queue status
 * @property {number} addedAt - Unix timestamp when enqueued
 * @property {string} [error] - Error message if status is 'error'
 */

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate if a value is a valid story level
 * @param {*} value - Value to validate
 * @returns {value is StoryLevel}
 */
export const isValidStoryLevel = (value) => {
  return STORY_LEVELS.includes(value);
};

/**
 * Validate if a value is a valid font size
 * @param {*} value - Value to validate
 * @returns {value is FontSize}
 */
export const isValidFontSize = (value) => {
  return FONT_SIZES.includes(value);
};

/**
 * Validate if a value is a valid view mode
 * @param {*} value - Value to validate
 * @returns {value is ViewMode}
 */
export const isValidViewMode = (value) => {
  return VIEW_MODES.includes(value);
};

/**
 * Validate story object structure
 * @param {*} story - Story to validate
 * @returns {story is Story}
 */
export const isValidStory = (story) => {
  if (!story || typeof story !== 'object') return false;
  if (typeof story.id !== 'string') return false;
  if (typeof story.titleJP !== 'string') return false;
  if (typeof story.titleEN !== 'string') return false;
  if (!isValidStoryLevel(story.level)) return false;
  if (typeof story.readTime !== 'number') return false;
  if (!Array.isArray(story.content)) return false;
  return story.content.every(segment =>
    typeof segment?.jp === 'string' &&
    typeof segment?.jp_furigana === 'string' &&
    typeof segment?.en === 'string'
  );
};

/**
 * Validate API keys object
 * @param {*} keys - Keys to validate
 * @returns {keys is ApiKeys}
 */
export const isValidApiKeys = (keys) => {
  if (!keys || typeof keys !== 'object') return false;
  return typeof keys.google === 'string' && typeof keys.pollinations === 'string';
};
