import { GoogleGenerativeAI } from '@google/generative-ai';
import { createWavHeader, base64ToBytes } from '../utils/audioHelpers.js';
import { getApiKeys } from '../utils/storage.js';

export const generateStory = async (topic, level, instructions = '') => {
    const keys = getApiKeys();
    const API_KEY = keys.google || import.meta.env.VITE_GOOGLE_API_KEY;

    if (!API_KEY) {
        throw new Error('Google API Key missing. Please set it in Settings.');
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

    const prompt = `
    Create a unique short story in Japanese for a ${level} level learner about "${topic}".
    ${instructions ? `\nAdditional Instructions: ${instructions}\n` : ''}
    
    Requirements:
    1. The story should be interesting and culturally relevant if possible.
    2. Provide side-by-side English translations.
    3. For each sentence/segment, provide 1-2 vocabulary notes for key terms.
    4. "readTime" should be an estimated integer in minutes.
    5. "level" must be exactly "${level}".
    6. "jp_furigana" field: Provide the Japanese text with HTML <ruby> tags for Kanji readings (e.g. <ruby>猫<rt>ねこ</rt></ruby>).
    7. Return ONLY valid JSON matching this structure:
    
    {
      "titleJP": "Japanese Title",
      "titleEN": "English Title",
      "level": "${level}",
      "readTime": 5,
      "excerpt": "Short English summary...",
      "content": [
        {
          "jp": "Japanese sentence...",
          "jp_furigana": "Japanese sentence with <ruby>...</ruby>",
          "en": "English translation...",
          "notes": [
            { "term": "nihongo", "meaning": "Japanese language" }
          ]
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

