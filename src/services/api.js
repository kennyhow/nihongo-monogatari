import { GoogleGenerativeAI } from '@google/generative-ai';
import { createWavHeader, base64ToBytes } from '../utils/audioHelpers.js';
import { getApiKeys } from '../utils/storage.js';
import { STORY_LEVELS, STORY_LENGTHS, isValidStoryLevel, isValidStory } from '../types.js';

/**
 * Generate a Japanese story using Google Generative AI
 *
 * Creates an AI-generated story about a specified topic at the given JLPT level.
 * The story includes Japanese text, furigana annotations, English translations,
 * vocabulary notes, and comprehension questions.
 *
 * @param {string} topic - Story topic/theme (e.g., "A cat who loves sushi")
 * @param {'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'Beginner' | 'Intermediate' | 'Advanced'} level - JLPT difficulty level or descriptor
 * @param {string} [instructions=''] - Optional style/vocabulary instructions
 * @param {'short' | 'medium' | 'long'} [length='medium'] - Target story length
 * @returns {Promise<{id: string, titleJP: string, titleEN: string, level: string, readTime: number, excerpt: string, content: Array, questions: Array}>} Generated story object with ID added
 * @throws {Error} If API key is missing, parameters are invalid, or generation fails
 *
 * @example
 * const story = await generateStory('daily life', 'N4', 'make it funny', 'short');
 * console.log(story.titleJP); // "日常の生活"
 */
export const generateStory = async (topic, level, instructions = '', length = 'medium') => {
    // Input validation
    if (!topic || typeof topic !== 'string') {
        throw new Error('Topic must be a non-empty string');
    }

    if (!isValidStoryLevel(level)) {
        throw new Error(`Invalid level: ${level}. Must be one of: ${STORY_LEVELS.join(', ')}`);
    }

    if (!STORY_LENGTHS.includes(length)) {
        throw new Error(`Invalid length: ${length}. Must be one of: ${STORY_LENGTHS.join(', ')}`);
    }

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
        'N5': `GRAMMAR: Use only polite form (desu/masu), present tense, simple sentences (subject-object-verb). Use wa/ga particles correctly.
VOCABULARY: Restrict to JLPT N5 vocabulary list (~800 words). Use hiragana for words where kanji is uncommon.
SENTENCE STRUCTURE: Keep sentences under 15 characters. Use simple conjunctions (soshite, demo).
TOPICS: Daily life, family, food, school, hobbies. Concrete, familiar situations.
CULTURAL CONTEXT: Include basic cultural elements like bowing, seasons, traditional foods.`,
        'N4': `GRAMMAR: Use te-form, nai-form, dictionary form for short sentences. Basic conjunctions (kara, node, keredomo). Simple conditional (tara).
VOCABULARY: Restrict to JLPT N4 vocabulary (~1,500 words). Introduce common kanji with furigana.
SENTENCE STRUCTURE: Mix simple and compound sentences. 15-25 characters per sentence.
TOPICS: Daily routines, past experiences, future plans, simple opinions, weather, travel.
CULTURAL CONTEXT: Include customs, festivals, seasonal activities, social etiquette.`,
        'N3': `GRAMMAR: Use intermediate patterns (naru, suru, hazu da, tokoro da). Quotations (to iu). Passive and causative forms.
VOCABULARY: Use JLPT N3 vocabulary (~3,700 words). Balance kanji usage with appropriate furigana.
SENTENCE STRUCTURE: Complex-compound sentences with multiple clauses. 20-35 characters per sentence.
TOPICS: Culture, society, history, news summaries, work life, relationships, personal experiences.
CULTURAL CONTEXT: Include cultural concepts like omotenashi, wa, honne/tatemae, seasonal references.`,
        'N2': `GRAMMAR: Use advanced structures (mono da, wake ga nai, bakari ni). Formal register (keigo). Abstract expressions.
VOCABULARY: Use JLPT N2 vocabulary (~6,000 words). Include idiomatic expressions and collocations.
SENTENCE STRUCTURE: Sophisticated sentence patterns with embedding. 25-40 characters per sentence.
TOPICS: Abstract concepts, social issues, business, literature, emotions, nuanced opinions.
CULTURAL CONTEXT: Weave in cultural values, historical references, literary allusions, social dynamics.`,
        'N1': `GRAMMAR: Use highly advanced patterns (ya inaya, zaru o enai, kerenai). Literary and academic register.
VOCABULARY: Use JLPT N1 vocabulary (~10,000 words). Include four-character compounds (yojijukugo).
SENTENCE STRUCTURE: Academic or literary style with complex embedding. 30-50 characters per sentence.
TOPICS: Philosophy, economics, politics, academic subjects, complex social commentary.
CULTURAL CONTEXT: Deep cultural analysis, historical context, literary references, nuanced social commentary.`
    };

    // Few-shot example to guide model output
    const exampleOutput = `Example output for topic "A cat who loves sushi" at N4 level:

{
  "titleJP": "すし好きのねこ",
  "titleEN": "The Sushi-Loving Cat",
  "level": "N4",
  "readTime": 3,
  "excerpt": "A curious cat discovers a sushi restaurant and develops an unexpected friendship with the chef.",
  "content": [
    {
      "jp": "ある日、白いねこがすし屋の前を歩きました。",
      "jp_furigana": "<ruby>某日<rt>あるち</rt></ruby>、<ruby>白<rt>しろ</rt></ruby>いねこが<ruby>寿司<rt>すし</rt></ruby><ruby>屋<rt>や</rt></ruby>の<ruby>前<rt>まえ</rt></ruby>を<ruby>歩<rt>ある</rt></ruby>きました。",
      "en": "One day, a white cat walked in front of a sushi restaurant.",
      "imagePrompt": "A small white cat with curious eyes sitting in front of a traditional Japanese sushi restaurant with a noren curtain, warm afternoon sunlight, anime illustration style, soft pastel colors",
      "notes": [
        { "term": "ある日", "meaning": "One day (story starter)" },
        { "term": "寿司屋", "meaning": "Sushi restaurant" }
      ]
    }
  ],
  "questions": [
    {
      "question": "What did the cat discover?",
      "options": ["A cat food store", "A sushi restaurant", "A fish market", "A park"],
      "answer": "A sushi restaurant",
      "explanation": "The story says the cat walked in front of a sushi restaurant (すし屋)."
    }
  ]
}`;


    const prompt = `
Task: Create a unique, engaging Japanese story about "${topic}" at JLPT ${level} level.

=== LEVEL GUIDELINES ===
${levelGuidelines[level]}

=== STORY PARAMETERS ===
- Target Length: ${lengthMap[length]}
${instructions ? `- Special Instructions: ${instructions}` : ''}

=== QUALITY REQUIREMENTS ===

STORY STRUCTURE:
- Create a clear narrative arc: introduction (establish context), rising action, climax/resolution
- Each segment should advance the story meaningfully
- Build cultural authenticity through specific details and natural dialogue

TRANSLATIONS:
- Provide accurate, natural English translations that capture the nuance and tone
- Maintain consistency in translation style throughout

FURIGANA ANNOTATION:
- EVERY kanji in "jp_furigana" must use <ruby> tags: <ruby>漢字<rt>かんじ</rt></ruby>
- Include furigana for ALL kanji, even common ones
- Verify all ruby tags are properly closed

VOCABULARY NOTES:
- Select 2-3 words per segment that match the target JLPT level
- Prioritize words that help comprehension or are culturally significant
- Provide clear, concise English definitions

IMAGE PROMPTS:
- For each segment, write a detailed visual description in English
- Focus on: main subject(s), action/pose, setting/background, lighting/mood, art style
- Keep descriptions anime/manga illustration style with soft colors
- Ensure consistency in character appearance across segments
- Format: "A [subject] [doing action] in [setting], [lighting/mood], [art style details]"

COMPREHENSION QUESTIONS:
- Create 3 multiple-choice questions that test understanding
- Question distribution: 1 factual recall, 1 inference/understanding, 1 vocabulary-in-context
- Provide 4 distinct options where only one is clearly correct
- Include brief explanations that reinforce learning

=== OUTPUT FORMAT ===
Return STRICT JSON ONLY (no markdown, no explanation outside JSON):

{
  "titleJP": "Japanese title",
  "titleEN": "English title translation",
  "level": "${level}",
  "readTime": <estimated minutes>,
  "excerpt": "2-3 sentence English summary of the story",
  "content": [
    {
      "jp": "Plain Japanese text",
      "jp_furigana": "Japanese with <ruby> tags for ALL kanji",
      "en": "English translation",
      "imagePrompt": "Detailed visual description for AI image generation",
      "notes": [
        {"term": "Japanese word", "meaning": "English definition"}
      ]
    }
  ],
  "questions": [
    {
      "question": "Question in English",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Exact text of correct option",
      "explanation": "Brief explanation why this is correct"
    }
  ]
}

=== SELF-VERIFICATION CHECKLIST ===
Before returning your response, verify:
[ ] All kanji have <ruby> tags in jp_furigana
[ ] Each content segment has jp, jp_furigana, en, imagePrompt, and notes fields
[ ] Vocabulary matches the JLPT ${level} level
[ ] Story has ${lengthMap[length]} as specified
[ ] Image prompts are detailed and consistent in style
[ ] All 3 questions can be answered from the story text
[ ] JSON is valid and properly formatted

=== REFERENCE EXAMPLE ===
${exampleOutput}

Now generate the story about "${topic}" following all guidelines above.
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

        // Output validation
        if (!isValidStory(storyData)) {
            throw new Error('Generated story has invalid structure');
        }

        return storyData;
    } catch (error) {
        console.error("Generartion Error:", error);
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

