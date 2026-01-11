import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';

/**
 * Job Worker Edge Function
 *
 * Processes background jobs sequentially.
 * Triggered by cron job or manual webhook.
 *
 * Security: Requires CRON_SECRET for authorization
 */

// Rate limiting delays between job types (in milliseconds)
const RATE_LIMIT_DELAYS = {
  story_generation: 0,
  audio_generation: 30000,
  image_generation: 5000,
};

/**
 * Build story generation prompt (copied from generate-story function)
 */
function buildStoryPrompt(
  topic: string,
  level: string,
  instructions: string,
  length: string
): string {
  const lengthMap = {
    short: '5-7 sentences',
    medium: '10-12 sentences',
    long: '18-22 sentences',
  };

  const levelGuidelines = {
    N5: `GRAMMAR: Use only polite form (desu/masu), present tense, simple sentences (subject-object-verb). Use wa/ga particles correctly.
VOCABULARY: Restrict to JLPT N5 vocabulary list (~800 words). Use standard Kanji for vocabulary appropriate for this level. Do not convert common words to Hiragana.
SENTENCE STRUCTURE: Keep sentences under 15 characters. Use simple conjunctions (soshite, demo).
TOPICS: Daily life, family, food, school, hobbies. Concrete, familiar situations.
CULTURAL CONTEXT: Include basic cultural elements like bowing, seasons, traditional foods.`,
    N4: `GRAMMAR: Use te-form, nai-form, dictionary form for short sentences. Basic conjunctions (kara, node, keredomo). Simple conditional (tara).
VOCABULARY: Restrict to JLPT N4 vocabulary (~1,500 words). Use standard Kanji.
SENTENCE STRUCTURE: Mix simple and compound sentences. 15-25 characters per sentence.
TOPICS: Daily routines, past experiences, future plans, simple opinions, weather, travel.
CULTURAL CONTEXT: Include customs, festivals, seasonal activities, social etiquette.`,
    N3: `GRAMMAR: Use intermediate patterns (naru, suru, hazu da, tokoro da). Quotations (to iu). Passive and causative forms.
VOCABULARY: Use JLPT N3 vocabulary (~3,700 words). Balance kanji usage with appropriate furigana.
SENTENCE STRUCTURE: Complex-compound sentences with multiple clauses. 20-35 characters per sentence.
TOPICS: Culture, society, history, news summaries, work life, relationships, personal experiences.
CULTURAL CONTEXT: Include cultural concepts like omotenashi, wa, honne/tatemae, seasonal references.`,
    N2: `GRAMMAR: Use advanced structures (mono da, wake ga nai, bakari ni). Formal register (keigo). Abstract expressions.
VOCABULARY: Use JLPT N2 vocabulary (~6,000 words). Include idiomatic expressions and collocations.
SENTENCE STRUCTURE: Sophisticated sentence patterns with embedding. 25-40 characters per sentence.
TOPICS: Abstract concepts, social issues, business, literature, emotions, nuanced opinions.
CULTURAL CONTEXT: Weave in cultural values, historical references, literary allusions, social dynamics.`,
    N1: `GRAMMAR: Use highly advanced patterns (ya inaya, zaru o enai, kerenai). Literary and academic register.
VOCABULARY: Use JLPT N1 vocabulary (~10,000 words). Include four-character compounds (yojijukugo).
SENTENCE STRUCTURE: Academic or literary style with complex embedding. 30-50 characters per sentence.
TOPICS: Philosophy, economics, politics, academic subjects, complex social commentary.
CULTURAL CONTEXT: Deep cultural analysis, historical context, literary references, nuanced social commentary.`,
    Beginner: `Same as N5 level.`,
    Intermediate: `Same as N3 level.`,
    Advanced: `Same as N1 level.`,
  };

  const exampleOutput = `Example output for topic "A cat who loves sushi" at N4 level:

{
  "titleJP": "すし好きの猫",
  "titleEN": "The Sushi-Loving Cat",
  "level": "N4",
  "readTime": 3,
  "excerpt": "A curious cat discovers a sushi restaurant and develops an unexpected friendship with the chef.",
  "content": [
    {
      "jp": "ある日、白い猫が寿司屋の前を歩きました。",
      "readings": [
        {"text": "白", "reading": "しろ"},
        {"text": "猫", "reading": "ねこ"},
        {"text": "寿司屋", "reading": "すしや"},
        {"text": "前", "reading": "まえ"},
        {"text": "歩", "reading": "ある"}
      ],
      "en": "One day, a white cat walked in front of a sushi restaurant.",
      "imagePrompt": "A small white cat with curious eyes sitting in front of a traditional Japanese sushi restaurant with a noren curtain, warm afternoon sunlight, anime illustration style, soft pastel colors",
      "vocab": [
        {"word": "ある日", "reading": "あるち", "meaning": "One day (story starter)"},
        {"word": "寿司屋", "reading": "すしや", "meaning": "Sushi restaurant"}
      ]
    }
  ],
  "questions": [
    {
      "question": "What did the cat discover?",
      "options": ["A cat food store", "A sushi restaurant", "A fish market", "A park"],
      "answer": 1,
      "explanation": "The story says the cat walked in front of a sushi restaurant (寿司屋)."
    }
  ]
}`;

  const prompt = `
Task: Create a unique, engaging Japanese story about "${topic}" at JLPT ${level} level.

=== LEVEL GUIDELINES ===
${levelGuidelines[level] || levelGuidelines['N3']}

=== STORY PARAMETERS ===
- Target Length: ${lengthMap[length]}
${instructions ? `- Special Instructions: ${instructions}` : ''}

=== KANJI USAGE ===
- Write the 'jp' text using standard mixed Kanji/Kana.
- DO NOT write words entirely in Hiragana if they usually use Kanji (e.g., write "時計", not "とけい").
- We have a furigana system, so Kanji is preferred even for beginners.

=== QUALITY REQUIREMENTS ===

STORY STRUCTURE:
- Create a clear narrative arc: introduction (establish context), rising action, climax/resolution
- Each segment should advance the story meaningfully
- Build cultural authenticity through specific details and natural dialogue

TRANSLATIONS:
- Provide accurate, natural English translations that capture the nuance and tone
- Maintain consistency in translation style throughout

FURIGANA/READINGS:
- The "readings" array provides furigana ONLY for words containing KANJI
- DO NOT include readings for hiragana-only or katakana-only words (they don't need furigana)
- DO NOT break apart words - each entry must be a complete word as it appears in the text
- Format: {"text": "寿司屋", "reading": "すしや"} - the text must match exactly what appears in "jp"
- EVERY word in "jp" that contains kanji MUST have a corresponding entry in "readings"
- This allows the client to generate <ruby> tags automatically without manual HTML encoding

Examples:
✅ INCLUDE: {"text": "学生", "reading": "がくせい"} (complete word with kanji)
✅ INCLUDE: {"text": "行", "reading": "い"} (complete word with kanji)
✅ INCLUDE: {"text": "寿司屋", "reading": "すしや"} (complete word with kanji)
❌ DO NOT INCLUDE: "けん" from "けんさん" (part of a larger word - add the full word or nothing)
❌ DO NOT INCLUDE: "コンビニ" (pure katakana - no furigana needed)
❌ DO NOT INCLUDE: "おいしい" (pure hiragana - no furigana needed)

VOCABULARY NOTES (vocab array):
- Select 2-3 words per segment that match the target JLPT level
- Prioritize words that help comprehension or are culturally significant
- Include words with kanji, but also important kana words (e.g., "ある日", "おいしい")
- Each entry must have: word (matching "jp"), reading, and meaning
- The "word" field should exactly match how it appears in the story text

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
      "jp": "Japanese text with proper kanji (no HTML tags, no markup)",
      "readings": [
        {"text": "日本語", "reading": "にほんご"},
        {"text": "単語", "reading": "たんご"}
      ],
      "en": "English translation",
      "imagePrompt": "Detailed visual description for AI image generation",
      "vocab": [
        {"word": "日本語", "reading": "にほんご", "meaning": "English definition"}
      ]
    }
  ],
  "questions": [
    {
      "question": "Question in English",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": <index 0-3>,
      "explanation": "Brief explanation why this is correct"
    }
  ]
}

=== SELF-VERIFICATION CHECKLIST ===
Before returning your response, verify:
[ ] All kanji words in "jp" have corresponding entries in "readings" array
[ ] "readings" array does NOT include hiragana-only or katakana-only words
[ ] Each "readings" entry has "text" that exactly matches the text in "jp"
[ ] Each content segment has jp, readings, en, imagePrompt, and vocab fields
[ ] Vocabulary matches the JLPT ${level} level
[ ] Story has ${lengthMap[length]} as specified
[ ] Image prompts are detailed and consistent in style
[ ] All 3 questions can be answered from the story text
[ ] Questions "answer" field uses numeric index (0-3), not text
[ ] JSON is valid and properly formatted

=== REFERENCE EXAMPLE ===
${exampleOutput}

Now generate the story about "${topic}" following all guidelines above.
`;

  return prompt;
}

/**
 * Process story generation job
 */
async function processStoryGeneration(parameters: any): Promise<any> {
  const { topic, level, instructions = '', length = 'medium', geminiApiKey } = parameters;

  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction:
      'You are a professional Japanese language teacher specialized in creating curated stories for learners.',
  });

  const prompt = buildStoryPrompt(topic, level, instructions, length);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Clean markdown code blocks if present
  const jsonStr = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  // Parse JSON response
  const storyData = JSON.parse(jsonStr);

  // Add ID
  storyData.id = `gen-${Date.now()}`;

  // Basic validation
  if (!storyData.titleJP || !storyData.titleEN || !Array.isArray(storyData.content)) {
    throw new Error('Generated story has invalid structure');
  }

  // Validate each content segment has required fields
  for (const segment of storyData.content) {
    if (!segment.jp || !segment.en || !Array.isArray(segment.readings)) {
      throw new Error('Each content segment must have jp, en, and readings fields');
    }
  }

  return storyData;
}

/**
 * Process audio generation job
 * Generates TTS audio using Gemini API and stores in Supabase Storage
 */
async function processAudioGeneration(parameters: any, jobId: string): Promise<any> {
  const { storyId, text, voiceName = 'Aoede', geminiApiKey } = parameters;

  console.log(`[Job ${jobId}] Generating audio for story ${storyId}`);

  // Initialize Generative AI with TTS model
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-tts',
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
    });

    const response = await result.response;
    const candidates = response.candidates;

    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
      throw new Error('No audio data in response');
    }

    let audioData: Uint8Array | null = null;
    let sampleRate = 24000;

    // Extract audio from response
    for (const part of candidates[0].content.parts) {
      if (
        part.inlineData &&
        part.inlineData.mimeType &&
        part.inlineData.mimeType.startsWith('audio')
      ) {
        const mimeType = part.inlineData.mimeType;
        const base64Data = part.inlineData.data;

        // Parse sample rate from mime type
        const rateMatch = mimeType.match(/rate=(\d+)/);
        if (rateMatch) {
          sampleRate = parseInt(rateMatch[1], 10);
        }

        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        const pcmBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          pcmBytes[i] = binaryString.charCodeAt(i);
        }

        // Create WAV header
        const wavHeader = createWavHeader(pcmBytes.length, sampleRate);
        const headerBytes = new Uint8Array(wavHeader);
        const wavBytes = new Uint8Array(headerBytes.length + pcmBytes.length);

        wavBytes.set(headerBytes, 0);
        wavBytes.set(pcmBytes, headerBytes.length);

        audioData = wavBytes;
        break;
      }
    }

    if (!audioData) {
      throw new Error('Failed to extract audio data from response');
    }

    console.log(`[Job ${jobId}] Generated ${audioData.length} bytes of audio (${sampleRate}Hz)`);

    // Get Supabase client for storage upload
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from parameters (passed from client when creating job)
    const userId = parameters.userId;

    if (!userId) {
      throw new Error('userId is required for audio upload');
    }

    // Upload to Supabase Storage (private bucket)
    // Using existing audio-cache bucket with user-specific path
    const fileName = `${userId}/${storyId}/full-story.wav`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-cache')
      .upload(fileName, audioData, {
        contentType: 'audio/wav',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    console.log(`[Job ${jobId}] Audio uploaded: ${fileName}`);

    // Return result (file path, not public URL - client will use authenticated download)
    return {
      audioPath: fileName, // Just the path, client will use authenticated Supabase client
      format: 'wav',
      size: audioData.length,
      sampleRate: sampleRate,
      duration: null, // Could calculate if needed
    };
  } catch (error: any) {
    console.error(`[Job ${jobId}] Audio generation failed:`, error);
    throw error;
  }
}

/**
 * Create WAV header for PCM audio data
 */
function createWavHeader(pcmDataLength: number, sampleRate = 24000): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // "RIFF" chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmDataLength, true); // File size
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmDataLength, true);

  return buffer;
}

/**
 * Process image generation job (placeholder for future implementation)
 */
async function processImageGeneration(parameters: any): Promise<any> {
  // TODO: Implement image generation
  throw new Error('Image generation not yet implemented');
}

// Job processors for each type
// Pass both parameters and job ID to processors (needed for audio generation)
const JOB_PROCESSORS: Record<string, (params: any, jobId: string) => Promise<any>> = {
  story_generation: (params, _jobId) => processStoryGeneration(params),
  audio_generation: processAudioGeneration,
  image_generation: processImageGeneration,
};

serve(async req => {
  // Verify this is a cron job, trigger, or authorized request
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');

  // Detect invocation source for better logging
  const invocationSource = req.headers.get('x-invocation-source') || 'unknown';
  const userAgent = req.headers.get('user-agent') || '';

  let source = 'unknown';
  if (userAgent.includes('pg_net')) {
    source = 'database-trigger';
  } else if (invocationSource === 'cron') {
    source = 'cron';
  } else if (invocationSource === 'manual') {
    source = 'manual';
  }

  console.log(`[Job Worker] Invoked from source: ${source}`);

  // Verify authorization (database trigger uses cron secret)
  // Database triggers and authorized callers must provide Bearer token
  if (!cronSecret) {
    return new Response('Server configuration error: CRON_SECRET not set', {
      status: 500,
    });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error(`[Job Worker] Unauthorized access attempt from ${source}`);
    return new Response('Unauthorized', { status: 401 });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response('Server configuration error: Supabase credentials not set', {
      status: 500,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Claim next pending job (with locking via update)
    const { data: job, error } = await supabase
      .from('jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .select()
      .single();

    if (error || !job) {
      console.log(`No jobs to process (source: ${source})`);
      return new Response(JSON.stringify({ message: 'No jobs to process', source }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing job ${job.id} of type ${job.job_type}`);

    // Check if we have a processor for this job type
    const processor = JOB_PROCESSORS[job.job_type];
    if (!processor) {
      throw new Error(`No processor found for job type: ${job.job_type}`);
    }

    // Process the job
    const startTime = Date.now();
    let result;

    try {
      result = await processor(job.parameters, job.id);

      // Mark as completed
      await supabase
        .from('jobs')
        .update({
          status: 'completed',
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      console.log(`Job ${job.id} completed in ${Date.now() - startTime}ms`);

      // Apply rate limiting delay if needed
      const delay = RATE_LIMIT_DELAYS[job.job_type] || 0;
      if (delay > 0) {
        console.log(`Rate limiting: waiting ${delay}ms before next job`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      console.error(`Job ${job.id} failed:`, error);

      // Check if should retry
      const shouldRetry = job.retry_count < job.max_retries;

      await supabase
        .from('jobs')
        .update({
          status: shouldRetry ? 'pending' : 'failed',
          error_message: error.message,
          error_details: { stack: error.stack, name: error.name },
          retry_count: job.retry_count + 1,
        })
        .eq('id', job.id);

      console.log(`Job ${job.id} ${shouldRetry ? 'will be retried' : 'permanently failed'}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: 'Job processed',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
