import { GoogleGenerativeAI } from '@google/generative-ai';
import { createWavHeader, base64ToBytes } from '../utils/audioHelpers.js';
import { getApiKeys } from '../utils/storage.js';
import { supabase } from '../utils/supabase.js';
import { STORY_LEVELS, STORY_LENGTHS, isValidStoryLevel, isValidStory } from '../types.js';

/**
 * Generate a Japanese story using Supabase Edge Function
 *
 * Creates an AI-generated story about a specified topic at the given JLPT level.
 * The story includes Japanese text, furigana annotations, English translations,
 * vocabulary notes, and comprehension questions.
 *
 * NOTE: This now calls a Supabase Edge Function instead of making direct API calls.
 * This allows the generation to continue even if you close your browser!
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

  // Check if Supabase is configured
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  try {
    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('generate-story', {
      body: { topic, level, instructions, length },
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error(error.message || 'Failed to generate story');
    }

    // Validate the response
    if (!data || !isValidStory(data)) {
      throw new Error('Generated story has invalid structure');
    }

    return data;
  } catch (error) {
    // Provide helpful error messages for common issues
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      throw new Error(
        'Network error: Unable to reach the story generation service. Please check your internet connection.'
      );
    }

    console.error('Story generation error:', error);
    throw error;
  }
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
