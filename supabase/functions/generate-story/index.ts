import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0"

// Story level validation
const STORY_LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5', 'Beginner', 'Intermediate', 'Advanced'];
const STORY_LENGTHS = ['short', 'medium', 'long'];

function isValidStoryLevel(level) {
  return STORY_LEVELS.includes(level);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Parse request body
    const { topic, level, instructions = '', length = 'medium' } = await req.json();

    // Input validation
    if (!topic || typeof topic !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Topic must be a non-empty string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidStoryLevel(level)) {
      return new Response(
        JSON.stringify({ error: `Invalid level: ${level}. Must be one of: ${STORY_LEVELS.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!STORY_LENGTHS.includes(length)) {
      return new Response(
        JSON.stringify({ error: `Invalid length: ${length}. Must be one of: ${STORY_LENGTHS.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment
    const API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: GEMINI_API_KEY not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: "You are a professional Japanese language teacher specialized in creating curated stories for learners."
    });

    // Length mappings
    const lengthMap = {
      'short': '5-7 sentences',
      'medium': '10-12 sentences',
      'long': '18-22 sentences'
    };

    // Level-specific guidelines
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
CULTURAL CONTEXT: Deep cultural analysis, historical context, literary references, nuanced social commentary.`,
      'Beginner': `Same as N5 level.`,
      'Intermediate': `Same as N3 level.`,
      'Advanced': `Same as N1 level.`
    };

    // Example output for few-shot learning
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

    // Build the prompt
    const prompt = `
Task: Create a unique, engaging Japanese story about "${topic}" at JLPT ${level} level.

=== LEVEL GUIDELINES ===
${levelGuidelines[level] || levelGuidelines['N3']}

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

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean markdown code blocks if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Parse JSON response
    const storyData = JSON.parse(jsonStr);

    // Add ID
    storyData.id = `gen-${Date.now()}`;

    // Basic validation
    if (!storyData.titleJP || !storyData.titleEN || !Array.isArray(storyData.content)) {
      throw new Error('Generated story has invalid structure');
    }

    // Return success response
    return new Response(JSON.stringify(storyData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Generation error:', error);

    // Return error response
    return new Response(
      JSON.stringify({
        error: 'Failed to generate story',
        details: error.message
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
