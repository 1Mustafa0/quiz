import { GoogleGenAI, Type } from "@google/genai";
import { getNextApiKey, rotateToNextKey, getKeyCount } from "./keyRotation";

const GEMINI_GENERATION_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS = Array.from(new Set([
  'llama-3.1-8b-instant',
  ...(process.env.GROQ_MODELS || '').split(',').map(model => model.trim()).filter(Boolean),
  process.env.GROQ_MODEL?.trim(),
  'llama-3.3-70b-versatile',
].filter((model): model is string => Boolean(model))));
const MAX_TEXT_CHARS = Number(process.env.QUIZ_MAX_TEXT_CHARS || 50000);
const MAX_QUESTIONS = Number(process.env.QUIZ_MAX_QUESTIONS || 30);
const MIN_AUTO_QUESTIONS = 3;
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 30000);
const GROQ_MAX_TOKENS = Number(process.env.GROQ_MAX_TOKENS || 9000);

const isQuotaError = (err: any) => {
  const message = `${err?.message || ''} ${err?.status || ''} ${err?.code || ''}`;
  return err?.status === 429 ||
    err?.code === 429 ||
    /429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(message);
};

const createQuotaError = () => {
  const error = new Error('جميع مفاتيح Gemini أو النماذج المتاحة وصلت لحد الاستخدام مؤقتًا. انتظر قليلًا ثم حاول مرة أخرى.');
  (error as any).statusCode = 429;
  return error;
};

export interface GeneratedQuestion {
  type: 'multiple-choice';
  id?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  bloom_level?: 'remember' | 'understand' | 'apply' | 'analyze';
  topic_tag?: string;
  question?: string;
  correct_option?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  questionText: string;
  options: string[];
  optionsMap?: Record<'A' | 'B' | 'C' | 'D', string>;
  correctAnswer: string;
  feedback: string;
}

export interface QuizGenerationParams {
  content?: string;
  image?: {
    data: string;
    mimeType: string;
  };
  numQuestions: number;
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  notes?: string;
}

export interface QuizGenerationResponse {
  title: string;
  description: string;
  questions: GeneratedQuestion[];
  provider?: 'groq' | 'gemini';
  status?: 'success';
  cleanedText?: string;
  attempts?: string[];
}

function clampQuestionCount(numQuestions: number): number {
  if (!Number.isFinite(numQuestions) || numQuestions <= 0) return 0;
  return Math.max(1, Math.min(MAX_QUESTIONS, Math.floor(numQuestions)));
}

export function recommendQuestionCount(characterLength: number): number {
  const length = Math.max(0, Math.floor(Number(characterLength) || 0));
  if (length < 1200) return 3;
  if (length < 2500) return 6;
  if (length < 5000) return 10;
  if (length < 9000) return 15;
  if (length < 15000) return 20;
  if (length < 25000) return 25;
  return MAX_QUESTIONS;
}

function estimateKnowledgePointCount(text: string): number {
  const cleanText = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!cleanText) return 0;

  const lines = cleanText
    .split('\n')
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean);

  const meaningfulLines = lines.filter(line => {
    const words = line.match(/[\p{L}\p{N}%+/<>=-]+/gu) || [];
    return words.length >= 3 && line.length >= 12;
  });

  const bulletOrNumberedLines = meaningfulLines.filter(line =>
    /^[-+*â€¢â—â—‹â–ªâ–«]\s+/.test(line) ||
    /^\d{1,3}\s*[\).:\-]\s+/.test(line) ||
    /^[A-D]\s*[\).:\-]\s+/i.test(line)
  ).length;

  const headingLines = meaningfulLines.filter((line, index) =>
    isLikelyLessonHeading(line, meaningfulLines[index + 1] || '')
  ).length;

  const factSentences = cleanText
    .split(/[.!?ØŸ]\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => {
      const words = sentence.match(/[\p{L}\p{N}%+/<>=-]+/gu) || [];
      return words.length >= 6 && sentence.length >= 25;
    }).length;

  const denseFacts = meaningfulLines.filter(line =>
    /(?:\d+\s*%|\d+\s*(?:ml|mg|kg|hr|hour|hours|day|days|week|weeks|cm|mm|l)\b|formula|classification|degree|rule|signs?|symptoms?|causes?|treatment|management|first aid|fluid|pain|infection|wound|burn|ØªØµÙ†ÙŠÙ|Ø¹Ù„Ø§Ø¬|Ø£Ø³Ø¨Ø§Ø¨|Ø£Ø¹Ø±Ø§Ø¶|Ø¯Ø±Ø¬Ø©|Ø¥Ø³Ø¹Ø§Ù)/i.test(line)
  ).length;

  const rawEstimate = Math.max(
    recommendQuestionCount(cleanText.length),
    headingLines + Math.ceil((bulletOrNumberedLines + denseFacts) * 0.75),
    Math.ceil(factSentences * 0.55)
  );

  return Math.max(MIN_AUTO_QUESTIONS, Math.min(MAX_QUESTIONS, rawEstimate));
}

export function cleanQuizText(text: string): string {
  const normalizedLines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n')
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(line => line && !/^(header|footer|page\s*\d+|\d+\s*\/\s*\d+)$/i.test(line));

  const deduped: string[] = [];
  for (const line of normalizedLines) {
    if (deduped[deduped.length - 1] !== line) {
      deduped.push(line);
    }
  }

  return deduped
    .join('\n')
    .replace(/[^\p{L}\p{N}\s.,:;?!()[\]{}'"،؛؟\-–/٪%+*=<>]/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function stripListMarker(line: string): string {
  return line
    .replace(/^[-+*•●○▪▫]\s*/, '')
    .replace(/^\d+[\-.)]\s*/, '')
    .trim();
}

function isLikelyLessonHeading(line: string, nextLine = ''): boolean {
  const clean = stripListMarker(line);
  if (!clean || clean.length > 90) return false;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 10) return false;
  if (/[.;,]\s*$/.test(clean)) return false;

  const headingKeywords = /\b(definition|composition|cause|causes|feature|features|pathophysiology|signs?|symptoms?|types?|diagnosis|treatment|modalities|management|complications?|anatomy|classification|indications?|contraindications?|nursing|assessment|intervention|prevention|prognosis|hernia)\b/i;
  const arabicHeadingKeywords = /(تعريف|أسباب|اعراض|أعراض|علامات|انواع|أنواع|تشخيص|علاج|مضاعفات|تمريض|إدارة|مكونات|تركيب|فسيولوجيا|تصنيف)/;
  const nextLooksLikeDetail = /^[-+*•●○▪▫]|\d+[\-.)]\s|[a-z\u0600-\u06ff]/i.test(nextLine.trim());
  const titleCaseWords = words.filter(word => /^[A-Z][a-z]+/.test(word)).length;

  return headingKeywords.test(clean) ||
    arabicHeadingKeywords.test(clean) ||
    (words.length <= 6 && titleCaseWords >= Math.max(1, Math.floor(words.length / 2)) && nextLooksLikeDetail);
}

function structureLessonContent(text: string): string {
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean);

  if (lines.length === 0) return '';

  const sections: { heading: string; details: string[] }[] = [];
  let current: { heading: string; details: string[] } | null = null;

  const pushCurrent = () => {
    if (current && (current.heading || current.details.length > 0)) {
      sections.push(current);
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || '';
    const clean = stripListMarker(line);

    if (isLikelyLessonHeading(line, nextLine)) {
      pushCurrent();
      current = { heading: clean, details: [] };
      continue;
    }

    if (!current) {
      current = { heading: 'Main lesson overview', details: [] };
    }

    const detail = clean || line;
    if (detail && current.details[current.details.length - 1] !== detail) {
      current.details.push(detail);
    }
  }

  pushCurrent();

  return sections
    .filter(section => section.heading || section.details.length > 0)
    .map((section, index) => {
      const heading = section.heading || `Section ${index + 1}`;
      const details = section.details
        .slice(0, 24)
        .map(detail => `  - ${detail}`)
        .join('\n');
      return `## ${heading}${details ? `\n${details}` : ''}`;
    })
    .join('\n\n')
    .slice(0, MAX_TEXT_CHARS);
}

class QuizJsonParseError extends Error {
  statusCode = 502;
  code = 'AI_INVALID_JSON';

  constructor(message = 'The AI returned malformed quiz JSON. Please try again with clearer or shorter content.') {
    super(message);
    this.name = 'QuizJsonParseError';
  }
}

function stripJsonNoise(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

function tryParseJsonCandidate(candidate: string): any | null {
  const variants = [
    candidate,
    stripJsonNoise(candidate),
    stripJsonNoise(candidate).replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),
  ];

  for (const variant of variants) {
    if (!variant) continue;
    try {
      return JSON.parse(variant);
    } catch {
      // Try the next cleaned variant.
    }
  }

  return null;
}

function extractBalancedJson(text: string, openChar: '{' | '['): string | null {
  const closeChar = openChar === '{' ? '}' : ']';
  const start = text.indexOf(openChar);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function extractQuestionsArrayCandidate(text: string): string | null {
  const match = /"questions"\s*:\s*\[/i.exec(text);
  if (!match) return null;
  const arrayStart = text.indexOf('[', match.index);
  if (arrayStart < 0) return null;
  return extractBalancedJson(text.slice(arrayStart), '[');
}

function extractJsonObject(text: string): any {
  const trimmed = (text || '').trim();
  if (!trimmed) throw new QuizJsonParseError('AI returned an empty quiz response.');

  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
    extractBalancedJson(trimmed, '{'),
    extractBalancedJson(trimmed, '['),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const questionsArray = extractQuestionsArrayCandidate(trimmed);
  if (questionsArray) {
    candidates.push(`{"questions":${questionsArray}}`);
  }

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed) return parsed;
  }

  throw new QuizJsonParseError();
}

function normalizeString(value: any): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeQuestionFingerprint(value: any): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateAndNormalizeQuiz(value: any, expectedCount: number): QuizGenerationResponse {
  if (!value || typeof value !== 'object') {
    throw new Error('Quiz JSON must be an object or an array');
  }

  const rawQuestions = Array.isArray(value) ? value : Array.isArray(value.questions) ? value.questions : [];
  const title = normalizeString(value.title) || 'AI Generated Quiz';
  const description = normalizeString(value.description) || 'Smart quiz generated from the uploaded content.';

  if (rawQuestions.length === 0) {
    throw new Error('No questions were generated');
  }

  const maxCount = expectedCount > 0 ? expectedCount : MAX_QUESTIONS;
  const seenQuestions = new Set<string>();
  const questions = rawQuestions.slice(0, maxCount).map((q: any, index: number): GeneratedQuestion => {
    const questionText = normalizeString(q?.question ?? q?.questionText);
    const feedback = normalizeString(q?.explanation ?? q?.feedback);
    const difficulty = normalizeString(q?.difficulty).toLowerCase() as GeneratedQuestion['difficulty'];
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty || '') ? difficulty : 'medium';
    const bloomLevel = normalizeString(q?.bloom_level ?? q?.bloomLevel).toLowerCase();
    const safeBloomLevel = ['remember', 'understand', 'apply', 'analyze'].includes(bloomLevel)
      ? bloomLevel as GeneratedQuestion['bloom_level']
      : safeDifficulty === 'easy'
        ? 'remember'
        : safeDifficulty === 'hard'
          ? 'apply'
          : 'analyze';
    const topicTag = normalizeString(q?.topic_tag ?? q?.topicTag ?? q?.topic);
    const optionLetters = ['A', 'B', 'C', 'D'] as const;
    const optionsMap = q?.options && !Array.isArray(q.options) && typeof q.options === 'object'
      ? {
          A: normalizeString(q.options.A ?? q.options.a),
          B: normalizeString(q.options.B ?? q.options.b),
          C: normalizeString(q.options.C ?? q.options.c),
          D: normalizeString(q.options.D ?? q.options.d),
        }
      : null;
    const options: string[] = optionsMap
      ? optionLetters.map(letter => optionsMap[letter]).filter(Boolean)
      : Array.isArray(q?.options)
        ? q.options.map(normalizeString).filter(Boolean)
        : [];
    const uniqueOptions: string[] = Array.from(new Set<string>(options));
    const correctOption = normalizeString(q?.correct_option ?? q?.correctOption).toUpperCase();
    const letterIndex = optionLetters.indexOf(correctOption as any);
    const answerFromLetter = optionLetters.includes(correctOption as any)
      ? optionsMap
        ? optionsMap[correctOption as keyof typeof optionsMap]
        : uniqueOptions[letterIndex]
      : '';
    const correctAnswer = normalizeString(answerFromLetter || q?.correctAnswer);

    if (q?.type && q.type !== 'multiple-choice') {
      throw new Error(`Question ${index + 1} is not multiple-choice`);
    }
    if (!questionText) {
      throw new Error(`Question ${index + 1} is missing text`);
    }
    if (uniqueOptions.length !== 4) {
      throw new Error(`Question ${index + 1} must have exactly 4 unique options`);
    }
    if (!['easy', 'medium', 'hard'].includes(safeDifficulty || '')) {
      throw new Error(`Question ${index + 1} has invalid difficulty`);
    }
    if (!topicTag) {
      throw new Error(`Question ${index + 1} is missing topic_tag`);
    }
    if (optionsMap && !optionLetters.includes(correctOption as any)) {
      throw new Error(`Question ${index + 1} correct_option must be A, B, C, or D`);
    }
    if (!uniqueOptions.includes(correctAnswer)) {
      throw new Error(`Question ${index + 1} correctAnswer must exactly match one option`);
    }
    if (!feedback) {
      throw new Error(`Question ${index + 1} is missing feedback`);
    }
    const fingerprint = normalizeQuestionFingerprint(questionText);
    if (seenQuestions.has(fingerprint)) {
      throw new Error(`Question ${index + 1} duplicates an earlier question`);
    }
    seenQuestions.add(fingerprint);

    return {
      type: 'multiple-choice',
      id: Number.isFinite(Number(q?.id)) ? Number(q.id) : index + 1,
      difficulty: safeDifficulty,
      bloom_level: safeBloomLevel,
      topic_tag: topicTag,
      question: questionText,
      optionsMap: optionsMap || {
        A: uniqueOptions[0],
        B: uniqueOptions[1],
        C: uniqueOptions[2],
        D: uniqueOptions[3],
      },
      correct_option: (correctOption || optionLetters[uniqueOptions.indexOf(correctAnswer)]) as GeneratedQuestion['correct_option'],
      explanation: feedback,
      questionText,
      options: uniqueOptions,
      correctAnswer,
      feedback,
    };
  });

  if (expectedCount > 0 && questions.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} questions, got ${questions.length}`);
  }
  if (expectedCount === 0 && questions.length < MIN_AUTO_QUESTIONS) {
    throw new Error(`Auto mode must generate at least ${MIN_AUTO_QUESTIONS} questions`);
  }

  return { title, description, questions };
}

function buildQuizPrompt(params: QuizGenerationParams, cleanedContent: string, structuredContent: string): string {
  const { numQuestions, difficulty, notes } = params;
  const safeCount = clampQuestionCount(numQuestions);
  const knowledgePointCount = estimateKnowledgePointCount(structuredContent || cleanedContent);
  const questionCountInstruction = safeCount === 0
    ? `If numQuestions is auto, generate exactly ${knowledgePointCount} questions based on the number of distinct knowledge points in the source. Only reduce the count if the source truly cannot support that many distinct, grounded questions. Minimum ${MIN_AUTO_QUESTIONS}, maximum ${MAX_QUESTIONS}.`
    : `Generate exactly ${safeCount} questions.`;
  const notesInstruction = notes?.trim()
    ? `\nUser instructions:\n${notes.trim().slice(0, 1000)}\n`
    : '';

  return `You are an expert educational quiz generator.

Understanding rules:
- Carefully understand the content before generating questions.
- First build an internal lesson map from the source: main lesson title, major headings, subheadings/branches, then explanations under each branch.
- Identify every distinct knowledge point that can be tested: definitions, causes, classifications, degrees, percentages, formulas, treatment steps, first-aid steps, risks, complications, signs/symptoms, contraindications, and nursing actions.
- In automatic mode, the question count is based on these knowledge points, not on a fixed default or only on text length.
- Cover as many distinct knowledge points as possible, ideally one question per important knowledge point until the requested count is reached.
- Treat slide titles and short topic lines as headings, and the lines after them as explanations or examples for that heading.
- Use the lesson map to decide coverage: generate questions across the main headings and their branches, not from random isolated OCR lines.
- Extract only meaningful and important information.
- Ignore noise, repeated lines, broken formatting, or OCR errors.
- Do not add information that is not explicitly present in the text.
- If a section is unclear, skip it instead of guessing.
- If the source contains numbered questions, numbered learning points, checklist items, or repeated "Q/A" style entries, preserve their coverage and do not silently omit later items.
- When the requested count is smaller than the number of clear source questions/items, prioritize one generated question per source question/item until the requested count is reached.

Bloom's Taxonomy rules:
- easy = remember/understand: recall facts or explain directly stated ideas from the source.
- medium = analyze: comparison/cause-and-effect questions that require connecting ideas from the source.
- hard = apply/analyze: case-study questions where the learner applies source ideas to a realistic scenario.
- For hard questions, the scenario may be realistic, but every condition, action, consequence, metric, rule, theory, and correct answer must be inferable from the provided text only.
- Do not introduce external facts, domain knowledge, names, numbers, formulas, frameworks, laws, symptoms, diagnoses, dates, or theories that are absent from the source.
- If the source does not support an application/case-study question, downgrade it to an analysis question instead of inventing missing context.
- Unless the user asks for a single difficulty, distribute questions across easy, medium, and hard. If a difficulty is requested, keep most questions at that level but still include useful variety when possible.
- Set bloom_level to one of: remember, understand, apply, analyze.

Arabic quality rules:
- If the source is Arabic or mostly Arabic, write natural Arabic suitable for Egyptian/Arab students.
- Keep Arabic text RTL-friendly; do not mix English except for unavoidable terms, file terms, or option keys A-D.
- Avoid literal machine translation, broken Arabic grammar, and awkward phrasing.
- Use clear student-friendly explanations, not academic filler.

Quiz generation rules:
- Generate multiple-choice questions only.
- Each question must have exactly 4 options.
- Only ONE correct answer per question.
- Options must be an object with keys A, B, C, D.
- correct_option MUST be exactly one of A, B, C, or D.
- Wrong options must be high-quality distractors: plausible, realistic, and related to the same topic, but contradicted by or unsupported by the source.
- The explanation must justify the correct answer, then briefly explain why each wrong option is wrong or unsupported by the source.
- The explanation must reference the relevant idea from the source text without inventing citations.
- Questions must cover different important parts of the content.
- Avoid repeated, near-duplicate, or trivial questions.
- Use the same language as the input text. Preferred language setting from the user: ${params.language || 'same as source'}.
- Requested difficulty level: ${difficulty}.
- ${questionCountInstruction}
${notesInstruction}
Return ONLY valid JSON with this exact schema:
{
  "title": "Quiz title based on content",
  "description": "Short description of the quiz based on content",
  "questions": [
    {
      "id": 1,
      "difficulty": "easy",
      "bloom_level": "remember",
      "topic_tag": "Main topic",
      "question": "Question text here",
      "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
      "correct_option": "A",
      "explanation": "Detailed explanation strictly based on the provided source text, including why the correct option is right and why the other options are wrong"
    }
  ]
}

--- START OF CONTENT ---
${structuredContent || cleanedContent}
--- END OF CONTENT ---`;
}

async function callGroqModel(prompt: string, model: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: GROQ_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You generate strict educational quiz JSON only. Use only the provided content.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Groq request timed out after ${GROQ_TIMEOUT_MS}ms`);
      (timeoutError as any).statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Groq request failed with ${response.status}`);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from Groq');
  return text;
}

async function generateWithGroq(prompt: string, expectedCount: number): Promise<QuizGenerationResponse> {
  let lastError: unknown;

  for (const model of GROQ_MODELS) {
    try {
      const text = await callGroqModel(prompt, model);
      return validateAndNormalizeQuiz(extractJsonObject(text), expectedCount);
    } catch (error: any) {
      lastError = error;
      const message = error?.message || '';
      if (/decommissioned|model_not_found|does not exist|not supported|invalid model/i.test(message)) {
        console.warn(`[Quiz] Groq model ${model} unavailable. Trying next model...`);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to generate quiz with Groq');
}

async function generateWithGemini(prompt: string, expectedCount: number, image?: QuizGenerationParams['image']): Promise<QuizGenerationResponse> {
  const totalKeys = getKeyCount();
  if (totalKeys === 0) {
    throw new Error('لا يوجد مفتاح Gemini API صالح. تأكد من GEMINI_API_KEY ثم أعد تشغيل السيرفر.');
  }

  let keyAttemptsLeft = totalKeys;

  const executeGeneration = async (): Promise<QuizGenerationResponse> => {
    const apiKey = getNextApiKey();
    if (!apiKey) {
      throw new Error('لا يوجد مفتاح Gemini API صالح. تأكد من GEMINI_API_KEY ثم أعد تشغيل السيرفر.');
    }

    const ai = new GoogleGenAI({ apiKey });
    let sawQuotaError = false;

    for (const model of GEMINI_GENERATION_MODELS) {
      try {
        const parts: any[] = [{ text: prompt }];
        if (image) {
          parts.push({
            inlineData: {
              data: image.data,
              mimeType: image.mimeType,
            },
          });
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts }],
          config: {
            systemInstruction: 'You are an educational AI engine. Convert provided content or OCR text into a high-quality exam quiz. Use only the provided context and output JSON only. Even for hard case-study questions, never introduce external facts, metrics, theories, names, dates, or assumptions that are not grounded in the provided content.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.NUMBER },
                      difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
                      bloom_level: { type: Type.STRING, enum: ['remember', 'understand', 'apply', 'analyze'] },
                      topic_tag: { type: Type.STRING },
                      question: { type: Type.STRING },
                      options: {
                        type: Type.OBJECT,
                        properties: {
                          A: { type: Type.STRING },
                          B: { type: Type.STRING },
                          C: { type: Type.STRING },
                          D: { type: Type.STRING },
                        },
                        required: ['A', 'B', 'C', 'D'],
                      },
                      correct_option: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
                      explanation: { type: Type.STRING },
                    },
                    required: ['id', 'difficulty', 'bloom_level', 'topic_tag', 'question', 'options', 'correct_option', 'explanation'],
                  },
                },
              },
              required: ['title', 'description', 'questions'],
            },
          },
        });

        const text = response.text;
        if (!text) throw new Error('No response from Gemini');
        return validateAndNormalizeQuiz(extractJsonObject(text), expectedCount);
      } catch (error: any) {
        if (isQuotaError(error)) {
          sawQuotaError = true;
          console.warn(`[Quiz] ${model} quota reached. Trying another model/key...`);
          continue;
        }
        throw error;
      }
    }

    if (sawQuotaError && keyAttemptsLeft > 1) {
      keyAttemptsLeft--;
      rotateToNextKey();
      return executeGeneration();
    }

    if (sawQuotaError) throw createQuotaError();
    throw new Error('Failed to generate quiz with Gemini');
  };

  return executeGeneration();
}

export const generateQuizFromContent = async (params: QuizGenerationParams): Promise<QuizGenerationResponse> => {
  const { content, image, numQuestions, difficulty, language, notes } = params;
  const expectedCount = clampQuestionCount(numQuestions);

  if (!content && !image) {
    throw new Error('No content or image provided for quiz generation.');
  }

  const cleanedContent = cleanQuizText(content || '');
  if (!image && (cleanedContent === '[object Object]' || cleanedContent.length < 20)) {
    throw new Error('المحتوى المستخرج غير صالح أو قصير جدًا لتوليد اختبار.');
  }

  const structuredContent = structureLessonContent(cleanedContent);
  const requestedCount = expectedCount > 0
    ? expectedCount
    : image && !cleanedContent
      ? 5
      : estimateKnowledgePointCount(structuredContent || cleanedContent);
  const prompt = buildQuizPrompt({
    content: cleanedContent,
    image,
    numQuestions: requestedCount,
    language,
    difficulty,
    notes,
  }, cleanedContent, structuredContent);

  const attempts: string[] = [];

  if (!image) {
    try {
      const quiz = await generateWithGroq(prompt, requestedCount);
      return { ...quiz, provider: 'groq', status: 'success', cleanedText: structuredContent || cleanedContent, attempts: ['groq_success'] };
    } catch (err: any) {
      attempts.push(`groq_failed: ${err?.message || err}`);
      console.warn('[Quiz] Groq failed. Retrying once...', err?.message || err);
    }

    try {
      const quiz = await generateWithGroq(prompt, requestedCount);
      return { ...quiz, provider: 'groq', status: 'success', cleanedText: structuredContent || cleanedContent, attempts: [...attempts, 'groq_retry_success'] };
    } catch (err: any) {
      attempts.push(`groq_retry_failed: ${err?.message || err}`);
      console.warn('[Quiz] Groq retry failed. Falling back to Gemini...', err?.message || err);
    }
  } else {
    attempts.push('groq_skipped_for_image_input');
  }

  try {
    const quiz = await generateWithGemini(prompt, requestedCount, image);
    return { ...quiz, provider: 'gemini', status: 'success', cleanedText: structuredContent || cleanedContent, attempts: [...attempts, 'gemini_success'] };
  } catch (err: any) {
    attempts.push(`gemini_failed: ${err?.message || err}`);
    const isJsonError = err?.code === 'AI_INVALID_JSON' || /json|schema|invalid/i.test(err?.message || '');
    const error = new Error('تعذر إنشاء الكويز بعد أكثر من محاولة. جرّب نصًا أوضح أو أقصر ثم حاول مرة أخرى.');
    if (isJsonError) {
      error.message = 'The AI returned malformed quiz JSON. Please try again with clearer or shorter content.';
    }
    (error as any).statusCode = err?.statusCode || (isJsonError ? 502 : undefined);
    (error as any).code = err?.code || (isJsonError ? 'AI_INVALID_JSON' : undefined);
    (error as any).attempts = attempts;
    throw error;
  }
};
