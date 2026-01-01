import { GoogleGenerativeAI } from '@google/generative-ai';
import { createWavHeader, base64ToBytes } from '../utils/audioHelpers.js';
import { getApiKeys } from '../utils/storage.js';

export const generateStory = async (topic, level, instructions = '', length = 'medium') => {
    const keys = getApiKeys();
    const API_KEY = keys.google || import.meta.env.VITE_GOOGLE_API_KEY;

    if (!API_KEY) {
        throw new Error('Google API Key missing. Please set it in Settings.');
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        systemInstruction: "You are a professional Japanese language teacher specialized in creating curated stories for learners."
    });

    const lengthMap = {
        'short': '5-7 sentences',
        'medium': '10-12 sentences',
        'long': '18-22 sentences'
    };

    const levelGuidelines = {
        'N5': 'Use only basic grammar (desu/masu). Limit kanji to ~100 most common. Focus on daily life topics.',
        'N4': 'Use elementary grammar (te-form, nai-form, tail-forms). Basic conjunctions. Daily routines and simple opinions.',
        'N3': 'Natural, slightly more complex sentences. Broad topics like culture, news, and history. Use common intermediate grammar.',
        'N2': 'Advanced vocabulary and natural expressions. Abstract topics. Complex sentence structures.',
        'N1': 'Highly advanced/academic vocabulary. Nuanced expressions. Complex socio-cultural topics.'
    };

    const prompt = `
    Task: Create a unique Japanese story about "${topic}" at JLPT ${level} level.
    
    Parameters:
    - Level Guide: ${levelGuidelines[level] || 'Match the specified level.'}
    - Target Length: ${lengthMap[length] || '10 sentences'}
    ${instructions ? `- Specific Instructions: ${instructions}` : ''}
    
    Requirements:
    1. Content: Engaging, culturally relevant, and educational.
    2. Translations: Provide side-by-side English translations for every sentence.
    3. Furigana: EVERY KANJI in "jp_furigana" MUST use <ruby> tags (e.g., <ruby>日本語<rt>にほんご</rt></ruby>).
    4. Vocabulary: Include 2-3 key notes per segment.
    5. Comprehension: Include 3 multiple-choice questions about the story.
    
    Output Format (STRICT JSON ONLY):
    {
      "titleJP": "...",
      "titleEN": "...",
      "level": "${level}",
      "readTime": 5,
      "excerpt": "A short English summary.",
      "content": [
        {
          "jp": "Plain Japanese sentence",
          "jp_furigana": "Japanese sentence with <ruby> tags",
          "en": "English translation",
          "notes": [{ "term": "...", "meaning": "..." }]
        }
      ],
      "questions": [
        {
          "question": "Question text in English",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "answer": "Correct Option Text",
          "explanation": "Brief explanation in English why this is correct."
        }
      ]
    }
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const storyData = JSON.parse(jsonStr);

        // Add ID
        storyData.id = `gen-${Date.now()}`;

        return storyData;
    } catch (error) {
        console.error("Generartion Error:", error);
        throw error;
    }
};

export const generateSpeech = async (text) => {
    const keys = getApiKeys();
    const API_KEY = keys.google || import.meta.env.VITE_GOOGLE_API_KEY;

    if (!API_KEY) return null;

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash-preview-tts",
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }
                }
            }
        });

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: text }] }]
        });

        const response = await result.response;
        const candidates = response.candidates;

        if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
            for (const part of candidates[0].content.parts) {
                // Check for inline data with audio mime type
                if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio')) {
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

        console.warn("Gemini genAI response did not contain audio data.", response);
        return null;

    } catch (error) {
        console.error('Gemini TTS Error', error);
        throw error;
    }
};

