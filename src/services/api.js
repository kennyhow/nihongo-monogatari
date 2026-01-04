import { GoogleGenerativeAI } from '@google/generative-ai';
import { createWavHeader, base64ToBytes } from '../utils/audioHelpers.js';
import { getApiKeys } from '../utils/storage.js';
import { STORY_LEVELS, STORY_LENGTHS, isValidStoryLevel, isValidStory } from '../types.js';

/**
 * Create a background job for story generation
 *
 * Queues a story generation job that runs on the server.
 * The user can close their browser while the job processes.
 *
 * @param {string} topic - Story topic/theme (e.g., "A cat who loves sushi")
 * @param {'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'Beginner' | 'Intermediate' | 'Advanced'} level - JLPT difficulty level
 * @param {string} [instructions=''] - Optional style/vocabulary instructions
 * @param {'short' | 'medium' | 'long'} [length='medium'] - Target story length
 * @returns {Promise<string>} Job ID
 * @throws {Error} If parameters are invalid or API key is missing
 *
 * @example
 * const jobId = await createStoryGenerationJob('daily life', 'N4', 'make it funny', 'short');
 * console.log('Job queued:', jobId);
 */
export const createStoryGenerationJob = async (
  topic,
  level,
  instructions = '',
  length = 'medium'
) => {
  const { jobQueue } = await import('../utils/jobQueue.js');

  // Input validation (keep this on client side for fast feedback)
  if (!topic || typeof topic !== 'string') {
    throw new Error('Topic must be a non-empty string');
  }

  if (!isValidStoryLevel(level)) {
    throw new Error(`Invalid level: ${level}. Must be one of: ${STORY_LEVELS.join(', ')}`);
  }

  if (!STORY_LENGTHS.includes(length)) {
    throw new Error(`Invalid length: ${length}. Must be one of: ${STORY_LENGTHS.join(', ')}`);
  }

  // Get user's API key
  const keys = getApiKeys();
  const geminiApiKey = keys.google;

  if (!geminiApiKey) {
    throw new Error('Gemini API key not found. Please add your Google API key in Settings.');
  }

  // Create the job
  return await jobQueue.createJob('story_generation', {
    topic,
    level,
    instructions,
    length,
    geminiApiKey,
  });
};

/**
 * Create a background job for audio generation
 *
 * Queues an audio generation job that runs on the server.
 * The user can close their browser while the job processes.
 *
 * @param {string} storyId - Story ID to generate audio for
 * @param {string} text - Japanese text to convert to speech
 * @param {string} [voiceName='Aoede'] - Voice name for TTS
 * @returns {Promise<string>} Job ID
 * @throws {Error} If parameters are invalid or API key is missing
 *
 * @example
 * const jobId = await createAudioGenerationJob('story-123', 'こんにちは');
 * console.log('Audio job queued:', jobId);
 */
export const createAudioGenerationJob = async (storyId, text, voiceName = 'Aoede') => {
  const { jobQueue } = await import('../utils/jobQueue.js');
  const { getSession } = await import('../utils/supabase.js');

  // Input validation (keep this on client side for fast feedback)
  if (!storyId || typeof storyId !== 'string') {
    throw new Error('Story ID must be a non-empty string');
  }

  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }

  // Get user's API key
  const keys = getApiKeys();
  const geminiApiKey = keys.google;

  if (!geminiApiKey) {
    throw new Error('Gemini API key not found. Please add your Google API key in Settings.');
  }

  // Get user session for userId
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('User not authenticated');
  }

  // Create the job
  return await jobQueue.createJob('audio_generation', {
    userId: session.user.id,
    storyId,
    text,
    voiceName,
    geminiApiKey,
  });
};

/**
 * Generate a Japanese story using Supabase Edge Function
 *
 * Creates an AI-generated story about a specified topic at the given JLPT level.
 * The story includes Japanese text, furigana annotations, English translations,
 * vocabulary notes, and comprehension questions.
 *
 * NOTE: For backward compatibility, this now creates a job and polls until complete.
 * For new code, use createStoryGenerationJob() instead to avoid blocking.
 *
 * @param {string} topic - Story topic/theme (e.g., "A cat who loves sushi")
 * @param {'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'Beginner' | 'Intermediate' | 'Advanced'} level - JLPT difficulty level or descriptor
 * @param {string} [instructions=''] - Optional style/vocabulary instructions
 * @param {'short' | 'medium' | 'long'} [length='medium'] - Target story length
 * @returns {Promise<{id: string, titleJP: string, titleEN: string, level: string, readTime: number, excerpt: string, content: Array, questions: Array}>} Generated story object with ID added
 * @throws {Error} If Supabase is not configured, parameters are invalid, or generation fails
 *
 * @example
 * const story = await generateStory('daily life', 'N4', 'make it funny', 'short');
 * console.log(story.titleJP); // "日常の生活"
 */
export const generateStory = async (topic, level, instructions = '', length = 'medium') => {
  // For backward compatibility: Create job and poll until complete
  const jobId = await createStoryGenerationJob(topic, level, instructions, length);

  // Poll for completion (with timeout)
  const { jobQueue } = await import('../utils/jobQueue.js');
  const maxAttempts = 60; // 2 minutes max (60 * 2 seconds)
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

    const job = jobQueue.getJob(jobId);

    if (job?.status === 'completed') {
      // Job completed successfully
      if (!job.result || !isValidStory(job.result)) {
        throw new Error('Generated story has invalid structure');
      }
      return job.result;
    }

    if (job?.status === 'failed') {
      // Job failed
      throw new Error(job.error_message || 'Story generation failed');
    }

    attempts++;
  }

  throw new Error('Story generation timed out. Please check the Queue page for status.');
};

/**
 * Generate text-to-speech audio using Google Generative AI
 *
 * Converts Japanese text to natural-sounding speech audio in WAV format.
 * Uses the gemini-2.5-flash-preview-tts model with the "Aoede" voice.
 *
 * @param {string} text - Japanese text to convert to speech
 * @returns {Promise<Blob|null>} WAV audio blob or null if generation fails
 * @throws {Error} If API key is missing
 *
 * @example
 * const audio = await generateSpeech('こんにちは');
 * if (audio) {
 *   const audioUrl = URL.createObjectURL(audio);
 *   new Audio(audioUrl).play();
 * }
 */
export const generateSpeech = async text => {
  const keys = getApiKeys();
  const API_KEY = keys.google || import.meta.env.VITE_GOOGLE_API_KEY;

  if (!API_KEY) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-tts',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: text }] }],
    });

    const response = await result.response;
    const candidates = response.candidates;

    if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
        // Check for inline data with audio mime type
        if (
          part.inlineData &&
          part.inlineData.mimeType &&
          part.inlineData.mimeType.startsWith('audio')
        ) {
          const mimeType = part.inlineData.mimeType;
          const bytes = base64ToBytes(part.inlineData.data);

          // Parse Sample Rate
          let sampleRate = 24000;
          const rateMatch = mimeType.match(/rate=(\d+)/);
          if (rateMatch) {
            sampleRate = parseInt(rateMatch[1], 10);
          }

          // Wrap PCM in WAV
          const header = createWavHeader(bytes.length, sampleRate);
          // Use a combined Uint8Array for Blob to avoid issues
          const headerBytes = new Uint8Array(header);
          const wavBytes = new Uint8Array(header.byteLength + bytes.length);
          wavBytes.set(headerBytes);
          wavBytes.set(bytes, header.byteLength);

          return new Blob([wavBytes], { type: 'audio/wav' });
        }
      }
    }

    console.warn('Gemini genAI response did not contain audio data.', response);
    return null;
  } catch (error) {
    console.error('Gemini TTS Error', error);
    throw error;
  }
};
