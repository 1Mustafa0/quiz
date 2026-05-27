import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import mammothImport from 'mammoth';
import officeParserImport from 'officeparser';
import { parse as csvParse } from 'csv-parse/sync';
import { GoogleGenAI, Type } from '@google/genai';
import JSZip from 'jszip';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
const pdfParser = typeof pdf === 'function' ? pdf : pdf.default;
const mammoth = (mammothImport as any).default || mammothImport;
const officeParser = (officeParserImport as any).default || officeParserImport;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_QUIZ_TEXT_CHARS = Number(process.env.QUIZ_MAX_TEXT_CHARS || 12000);
const MAX_SERVERLESS_QUESTIONS = Number(process.env.QUIZ_MAX_QUESTIONS || 10);
const GROQ_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 30000);
const GROQ_MODELS = Array.from(new Set([
  'llama-3.1-8b-instant',
  ...(process.env.GROQ_MODELS || '').split(',').map(model => model.trim()).filter(Boolean),
  process.env.GROQ_MODEL?.trim(),
  'llama-3.3-70b-versatile',
].filter((model): model is string => Boolean(model))));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

const normalizeText = (value: unknown) => {
  const lowValueLinePatterns = [
    /^pptx$/i,
    /^powerpoint presentation$/i,
    /^slide$/i,
    /^heading$/i,
    /^text$/i,
    /^paragraph$/i,
    /^list$/i,
    /^unordered$/i,
    /^image$/i,
    /^justify$/i,
    /^center$/i,
    /^left$/i,
    /^right$/i,
    /^\d+pt$/i,
    /^#[0-9a-f]{6}$/i,
    /^times new roman$/i,
    /^calibri$/i,
    /^century gothic$/i,
    /^\+mj-[a-z]+$/i,
    /^image\d+\.(png|jpe?g|gif|webp)$/i,
    /^description:\s*https?:\/\//i,
    /^https?:\/\//i,
    /^page\s+\d+:?$/i,
    /^image\s+\d+:?$/i,
    /^slide\s+image\s+\d+:?/i,
    /^camscanner$/i,
    /^cam\s*3?\s*scanner$/i,
    /^\(?bc\s+on\s+scanner\)?$/i,
    /^scanned\s+with\s+camscanner$/i,
    /^scan(?:ned)?\s+by\s+camscanner$/i,
  ];
  const looksLikeOcrDebris = (line: string) => {
    const compact = line.replace(/\s+/g, '');
    if (!compact || !/[\p{L}]/u.test(line)) return true;
    if (compact.length < 2) return true;
    const letters = (compact.match(/\p{L}/gu) || []).length;
    const numbers = (compact.match(/\p{N}/gu) || []).length;
    const questionMarks = (compact.match(/\?/g) || []).length;
    const symbols = compact.length - letters - numbers;
    const usefulWords = line.match(/[\p{L}]{3,}/gu) || [];
    if (compact.length >= 8 && questionMarks / compact.length > 0.2) return true;
    if (compact.length >= 8 && usefulWords.length < 2 && symbols / compact.length > 0.15) return true;
    return compact.length >= 12 && letters / compact.length < 0.35 && symbols / compact.length > 0.25;
  };

  const lines = String(value || '')
    .replace(/\u0000/g, ' ')
    .replace(/[•●○▪▫]/g, '\n- ')
    .split(/\r?\n/)
    .map(line => line
      .replace(/[|~_=]{2,}/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim()
    )
    .filter(line => line && !lowValueLinePatterns.some(pattern => pattern.test(line)))
    .filter(line => !looksLikeOcrDebris(line));

  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = line.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return lines
    .filter(line => {
      const count = counts.get(line.toLowerCase()) || 0;
      return !(line.length <= 40 && count >= 5 && count / Math.max(lines.length, 1) > 0.25);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getGeminiKeys = () => {
  const invalid = new Set(['', 'MY_GEMINI_API_KEY', 'undefined', 'null']);
  const values = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEYS,
    ...Object.entries(process.env)
      .filter(([name]) => /^GEMINI_API_KEY_\d+$/.test(name))
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, value]) => value),
    ...Object.entries(process.env)
      .filter(([name]) => /^\d+$/.test(name))
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, value]) => value),
  ];

  return Array.from(new Set(
    values
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter((value) => !invalid.has(value))
  ));
};

const isQuotaError = (error: any) => {
  const message = `${error?.message || ''} ${error?.status || ''} ${error?.code || ''}`;
  return error?.status === 429 ||
    error?.code === 429 ||
    /429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(message);
};

const createQuotaError = () => {
  const error = new Error('خدمة الذكاء الاصطناعي وصلت لحد الاستخدام مؤقتًا. انتظر دقيقة ثم حاول مرة أخرى، أو أضف مفتاح Groq/Gemini آخر في إعدادات Vercel.');
  (error as any).statusCode = 429;
  (error as any).code = 'AI_QUOTA_EXHAUSTED';
  return error;
};

class QuizJsonParseError extends Error {
  statusCode = 502;
  code = 'AI_INVALID_JSON';

  constructor(message = 'The AI returned malformed quiz JSON. Please try again with clearer or shorter content.') {
    super(message);
    this.name = 'QuizJsonParseError';
  }
}

const stripJsonNoise = (value: string) =>
  value
    .replace(/^\uFEFF/, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

const tryParseJsonCandidate = (candidate: string) => {
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
      // Try next cleaned variant.
    }
  }

  return null;
};

const extractBalancedJson = (text: string, openChar: '{' | '[') => {
  const closeChar = openChar === '{' ? '}' : ']';
  const start = text.indexOf(openChar);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
};

const extractQuestionsArrayCandidate = (text: string) => {
  const match = /"questions"\s*:\s*\[/i.exec(text);
  if (!match) return null;
  const arrayStart = text.indexOf('[', match.index);
  if (arrayStart < 0) return null;
  return extractBalancedJson(text.slice(arrayStart), '[');
};

const extractJsonObject = (text: string) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new QuizJsonParseError('AI returned an empty quiz response.');

  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
    extractBalancedJson(trimmed, '{'),
    extractBalancedJson(trimmed, '['),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const questionsArray = extractQuestionsArrayCandidate(trimmed);
  if (questionsArray) candidates.push(`{"questions":${questionsArray}}`);

  for (const candidate of candidates) {
    const parsed = tryParseJsonCandidate(candidate);
    if (parsed) return parsed;
  }

  throw new QuizJsonParseError();
};

const cleanQuizText = (text: string) =>
  normalizeText(text)
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_QUIZ_TEXT_CHARS);

const stripListMarker = (line: string) =>
  line
    .replace(/^[-+*•●○▪▫]\s*/, '')
    .replace(/^\d+[\-.)]\s*/, '')
    .trim();

const isLikelyLessonHeading = (line: string, nextLine = '') => {
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
};

const structureLessonContent = (text: string) => {
  const maxChars = MAX_QUIZ_TEXT_CHARS;
  const lines = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean);

  const sections: { heading: string; details: string[] }[] = [];
  let current: { heading: string; details: string[] } | null = null;
  const pushCurrent = () => {
    if (current && (current.heading || current.details.length > 0)) sections.push(current);
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

    if (!current) current = { heading: 'Main lesson overview', details: [] };
    const detail = clean || line;
    if (detail && current.details[current.details.length - 1] !== detail) current.details.push(detail);
  }

  pushCurrent();

  return sections
    .filter(section => section.heading || section.details.length > 0)
    .map((section, index) => {
      const heading = section.heading || `Section ${index + 1}`;
      const details = section.details.slice(0, 24).map(detail => `  - ${detail}`).join('\n');
      return `## ${heading}${details ? `\n${details}` : ''}`;
    })
    .join('\n\n')
    .slice(0, maxChars);
};

const recommendQuestionCount = (characterLength: number) => {
  const length = Math.max(0, Math.floor(Number(characterLength) || 0));
  if (length < 1200) return 3;
  if (length < 3000) return 5;
  if (length < 6500) return Math.min(7, MAX_SERVERLESS_QUESTIONS);
  return Math.min(8, MAX_SERVERLESS_QUESTIONS);
};

const normalizeQuiz = (value: any, expectedCount: number) => {
  const title = normalizeText(value?.title) || 'AI Generated Quiz';
  const description = normalizeText(value?.description) || 'Smart quiz generated from the uploaded content.';
  const rawQuestions = Array.isArray(value) ? value : Array.isArray(value?.questions) ? value.questions : [];
  if (rawQuestions.length === 0) {
    throw new Error('AI returned incomplete quiz JSON');
  }

  const maxCount = expectedCount > 0 ? expectedCount : 30;
  const comparable = (item: string) => normalizeText(item).toLowerCase().replace(/^[a-d][\).:\-\s]+/i, '').replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  const overlapScore = (left: string, right: string) => {
    const rightTokens = new Set(comparable(right).split(' ').filter(token => token.length > 3));
    return comparable(left).split(' ').filter(token => token.length > 3 && rightTokens.has(token)).length;
  };
  const questions = rawQuestions.slice(0, maxCount).map((q: any, index: number) => {
    const letters = ['A', 'B', 'C', 'D'] as const;
    const rawOptionsObject = q?.options && !Array.isArray(q.options) && typeof q.options === 'object' ? q.options : null;
    const readOption = (letter: typeof letters[number]) => {
      if (!rawOptionsObject) return '';
      const direct = rawOptionsObject[letter] ?? rawOptionsObject[letter.toLowerCase()];
      if (direct) return normalizeText(direct);
      const entry = Object.entries(rawOptionsObject).find(([key]) => {
        const cleanKey = normalizeText(key).toUpperCase();
        return cleanKey === letter || cleanKey.startsWith(letter) || cleanKey.includes(`OPTION ${letter}`);
      });
      return entry ? normalizeText(entry[1]) : '';
    };
    const optionValuesFromObject = rawOptionsObject
      ? Object.values(rawOptionsObject).map(normalizeText).filter(Boolean)
      : [];
    const optionsMap = rawOptionsObject
      ? {
          A: readOption('A') || optionValuesFromObject[0] || '',
          B: readOption('B') || optionValuesFromObject[1] || '',
          C: readOption('C') || optionValuesFromObject[2] || '',
          D: readOption('D') || optionValuesFromObject[3] || '',
        }
      : null;
    const rawOptions: string[] = optionsMap
      ? letters.map((letter) => optionsMap[letter])
      : Array.isArray(q?.options) ? q.options.map(normalizeText) : [];
    const options: string[] = Array.from(new Set(rawOptions.filter(Boolean))).slice(0, 4);
    const questionText = normalizeText(q?.question ?? q?.questionText);
    const rawCorrectOptionText = normalizeText(q?.correct_option ?? q?.correctOption ?? q?.correct_answer ?? q?.correctAnswer ?? q?.answer);
    const correctOptionValue = rawCorrectOptionText.toUpperCase();
    const strictLetterMatch = correctOptionValue.match(/^(?:OPTION\s*)?([ABCD])(?:\b|[\).:\-])/i);
    const correctOption = (strictLetterMatch?.[1] || (/^[ABCD]$/.test(correctOptionValue) ? correctOptionValue : '')) as string;
    const letterIndex = letters.indexOf(correctOption as any);
    const answerFromLetter = normalizeText(
      letters.includes(correctOption as any)
        ? optionsMap
          ? optionsMap[correctOption as keyof typeof optionsMap]
          : options[letterIndex]
        : ''
    );
    const feedback = normalizeText(q?.explanation ?? q?.feedback) || `The answer is based on the lesson section: ${normalizeText(q?.topic_tag ?? q?.topicTag ?? q?.topic) || 'the provided content'}.`;
    const answerFromText = options.find(option => comparable(option) === comparable(rawCorrectOptionText)) || '';
    const inferredAnswer = options
      .map(option => ({ option, score: overlapScore(option, feedback) }))
      .sort((a, b) => b.score - a.score)[0];
    const correctAnswer = normalizeText(answerFromLetter || q?.correctAnswer || q?.correct_answer || q?.answer || answerFromText || (inferredAnswer?.score > 0 ? inferredAnswer.option : ''));
    const difficulty = normalizeText(q?.difficulty).toLowerCase();
    const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
    const topicTag = normalizeText(q?.topic_tag ?? q?.topicTag ?? q?.topic);
    const exactCorrectAnswer = options.find(option => option === correctAnswer) ||
      options.find(option => comparable(option) === comparable(correctAnswer)) ||
      correctAnswer;
    const safeCorrectOption = letters.includes(correctOption as any)
      ? correctOption
      : letters[options.indexOf(exactCorrectAnswer)];
    const answerMatchesOption = options.some(option => comparable(option) === comparable(exactCorrectAnswer));
    if (!questionText || options.length !== 4 || !answerMatchesOption || !feedback) {
      throw new Error(`Question ${index + 1} is invalid: question=${Boolean(questionText)}, options=${options.length}, answerMatches=${answerMatchesOption}, correctOption=${correctOption || 'none'}, answer=${String(exactCorrectAnswer || '').slice(0, 80)}`);
    }
    return {
      type: 'multiple-choice' as const,
      id: Number.isFinite(Number(q?.id)) ? Number(q.id) : index + 1,
      difficulty: safeDifficulty,
      topic_tag: topicTag || 'General',
      question: questionText,
      optionsMap: optionsMap || { A: options[0], B: options[1], C: options[2], D: options[3] },
      correct_option: safeCorrectOption,
      explanation: feedback,
      questionText,
      options,
      correctAnswer: exactCorrectAnswer,
      feedback,
    };
  });

  if (expectedCount > 0 && questions.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} questions, got ${questions.length}`);
  }

  return { title, description, questions };
};

const callGroqModel = async (prompt: string, model: string) => {
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
        max_tokens: 2600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Generate strict educational quiz JSON only. Use only the provided content.',
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
    const error = new Error(data?.error?.message || `Groq request failed with ${response.status}`);
    (error as any).statusCode = response.status;
    throw error;
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from Groq');
  return text;
};

const generateWithGroq = async (prompt: string, expectedCount: number) => {
  let lastError: unknown;

  for (const model of GROQ_MODELS) {
    try {
      const text = await callGroqModel(prompt, model);
      return normalizeQuiz(extractJsonObject(text), expectedCount);
    } catch (error: any) {
      lastError = error;
      const message = error?.message || '';
      if (/decommissioned|model_not_found|does not exist|not supported|invalid model/i.test(message)) {
        console.warn(`[api/generate-quiz] Groq model ${model} unavailable. Trying next model...`);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to generate quiz with Groq');
};

const generateWithGemini = async (prompt: string, expectedCount: number, image?: any) => {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  let sawQuotaError = false;
  let lastError: unknown;

  for (const apiKey of keys) {
    const ai = new GoogleGenAI({ apiKey });
    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      try {
        const parts: any[] = [{ text: prompt }];
        if (image?.data && image?.mimeType) {
          parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts }],
          config: {
            systemInstruction: 'Generate grounded educational quiz JSON only. Use only the provided content. For hard scenarios, never add external facts, metrics, theories, or assumptions.',
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
                    required: ['id', 'difficulty', 'topic_tag', 'question', 'options', 'correct_option', 'explanation'],
                  },
                },
              },
              required: ['title', 'description', 'questions'],
            },
          },
        });

        const quiz = normalizeQuiz(extractJsonObject(response.text || ''), expectedCount);
        return quiz;
      } catch (error: any) {
        lastError = error;
        if (isQuotaError(error)) {
          sawQuotaError = true;
          continue;
        }
      }
    }
  }

  if (sawQuotaError) throw createQuotaError();
  throw lastError instanceof Error ? lastError : new Error('Failed to generate quiz with Gemini');
};

const generateQuizFromContent = async (params: any) => {
  const expectedCount = Number.isFinite(Number(params.numQuestions)) && Number(params.numQuestions) > 0
    ? Math.max(1, Math.min(MAX_SERVERLESS_QUESTIONS, Math.floor(Number(params.numQuestions))))
    : 0;
  const cleanedContent = cleanQuizText(params.content || '');
  if (!params.image && cleanedContent.length < 20) {
    throw new Error('Extracted content is too short to generate a quiz.');
  }
  const structuredContent = structureLessonContent(cleanedContent);

  const requestedCount = expectedCount > 0 ? expectedCount : recommendQuestionCount(cleanedContent.length);
  const prompt = `Generate exactly ${requestedCount} multiple-choice questions from the lesson content.
Use only the content. Cover different lesson headings. Same language as the content.
Each question must have 4 options A-D, one correct_option, and a short explanation.
correct_option is REQUIRED and must be exactly one letter: A, B, C, or D. Do not use "answer" instead of correct_option.
Requested difficulty focus: ${params.difficulty || 'medium'}.
${params.notes ? `User notes: ${String(params.notes).slice(0, 700)}` : ''}

Return JSON only in this shape:
{"title":"...","description":"...","questions":[{"id":1,"difficulty":"easy","topic_tag":"...","question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_option":"A","explanation":"..."}]}

LESSON CONTENT:
${(structuredContent || cleanedContent || '[Image attached]').slice(0, MAX_QUIZ_TEXT_CHARS)}`;

  const attempts: string[] = [];

  if (!params.image) {
    try {
      const quiz = await generateWithGroq(prompt, expectedCount);
      return { ...quiz, provider: 'groq', status: 'success', cleanedText: structuredContent || cleanedContent, attempts: ['groq_success'] };
    } catch (error: any) {
      attempts.push(`groq_failed: ${error?.message || error}`);
      console.warn('[api/generate-quiz] Groq failed, falling back to Gemini:', error?.message || error);
    }
  }

  try {
    const quiz = await generateWithGemini(prompt, expectedCount, params.image);
    return { ...quiz, provider: 'gemini', status: 'success', cleanedText: structuredContent || cleanedContent, attempts: [...attempts, 'gemini_success'] };
  } catch (error: any) {
    attempts.push(`gemini_failed: ${error?.message || error}`);
    if (isQuotaError(error) || error?.code === 'AI_QUOTA_EXHAUSTED') {
      const quotaError = createQuotaError();
      (quotaError as any).attempts = attempts;
      throw quotaError;
    }
    (error as any).attempts = attempts;
    throw error;
  }
};

const collectTextFields = (value: any): string[] => {
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectTextFields);
  if (typeof value === 'object') {
    return Object.values(value).flatMap(collectTextFields);
  }
  return [];
};

const decodeXmlText = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));

const extractPptxTextFromZip = async (buffer: Buffer) => {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter(file => !file.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(file.name))
    .sort((a, b) => {
      const left = Number(a.name.match(/slide(\d+)\.xml/i)?.[1] || 0);
      const right = Number(b.name.match(/slide(\d+)\.xml/i)?.[1] || 0);
      return left - right;
    });

  const slides: string[] = [];
  for (const [index, file] of slideFiles.entries()) {
    const xml = await file.async('text');
    const values = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([^<]*)/g))
      .map(match => decodeXmlText(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const unique: string[] = [];
    for (const value of values) {
      if (unique[unique.length - 1] !== value) unique.push(value);
    }

    if (unique.length > 0) {
      slides.push(`Slide ${index + 1}\n${unique.join('\n')}`);
    }
  }

  return slides.join('\n\n').trim();
};

const extractOfficeText = (extracted: any) => {
  if (typeof extracted === 'string') return extracted;
  if (extracted?.text && typeof extracted.text === 'string') return extracted.text;
  return collectTextFields(extracted).join('\n');
};

const parseOffice = async (buffer: Buffer, lowerName: string) => {
  if (lowerName.endsWith('.pptx')) {
    const pptxText = await extractPptxTextFromZip(buffer);
    if (pptxText.trim()) return { text: pptxText, method: 'pptx-zip-text' };
  }

  if (lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer });
    if (result.value?.trim()) return { text: result.value, method: 'mammoth-docx' };
  }

  const extracted = await officeParser.parseOffice(buffer);
  return { text: extractOfficeText(extracted), method: 'office-parser' };
};

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Serverless API is running',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEYS),
    hasGroqKey: Boolean(process.env.GROQ_API_KEY),
  });
});

app.post('/api/generate-quiz', express.json({ limit: '12mb' }), async (req: any, res: any) => {
  try {
    const { content, image, numQuestions, language, difficulty, notes } = req.body || {};
    if (!content && !image) {
      return res.status(400).json({ error: 'content or image required' });
    }

    const quiz = await generateQuizFromContent({
      content,
      image,
      numQuestions,
      language,
      difficulty,
      notes,
    });
    res.json(quiz);
  } catch (error: any) {
    console.error('[api/generate-quiz]', error);
    const status = Number(error?.statusCode) || (/json|schema|invalid/i.test(error?.message || '') ? 502 : 500);
    res.status(status).json({
      error: error?.message || 'Failed to generate quiz',
      code: error?.code || (status === 502 ? 'AI_RESPONSE_INVALID' : 'QUIZ_GENERATION_FAILED'),
      details: error?.attempts || (status === 502 ? 'The model response could not be converted into the required quiz JSON schema.' : undefined),
    });
  }
});

app.post('/api/generate-mindmap', express.json({ limit: '12mb' }), async (req: any, res: any) => {
  res.status(501).json({ error: 'Mind map generation is not available in the serverless API yet.' });
});

app.post('/api/parse-file', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded', details: 'لم يتم رفع أي ملف.' });
    }

    const { buffer, mimetype, originalname } = req.file;
    const lowerName = String(originalname || '').toLowerCase();
    let text = '';
    let method = 'plain-text';
    let usedOcr = false;

    if (mimetype === 'application/pdf' || lowerName.endsWith('.pdf')) {
      method = 'pdf-parser';
      const data = await pdfParser(buffer);
      text = data?.text || '';
    } else if (
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.pptx') ||
      lowerName.endsWith('.ppt') ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      /wordprocessingml|msword|presentation|powerpoint|spreadsheet|excel/i.test(mimetype)
    ) {
      const parsed = await parseOffice(buffer, lowerName);
      text = parsed.text;
      method = parsed.method;
    } else if (mimetype === 'text/csv' || lowerName.endsWith('.csv')) {
      method = 'csv-parser';
      const records = csvParse(buffer.toString('utf8'), { skip_empty_lines: true });
      text = records.map((row: unknown[]) => row.join(' | ')).join('\n');
    } else if (mimetype.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(lowerName)) {
      usedOcr = true;
      return res.status(422).json({
        error: 'Image OCR is handled by direct AI vision fallback.',
        details: 'سيتم تحليل الصورة مباشرة بالذكاء الاصطناعي.',
      });
    } else {
      text = buffer.toString('utf8');
    }

    text = normalizeText(text);
    if (text.length < 10) {
      return res.status(400).json({
        error: 'Could not extract meaningful text from this file.',
        details: 'تعذر استخراج نص واضح من الملف. جرّب ملفًا نصيًا أو نسخة أوضح.',
      });
    }

    res.json({
      text: text.slice(0, 100000),
      extraction: {
        method,
        usedOcr,
        length: text.length,
        returnedLength: Math.min(text.length, 100000),
        originalName: originalname,
        mimeType: mimetype,
      },
    });
  } catch (error: any) {
    console.error('[api/parse-file]', error);
    res.status(500).json({
      error: 'Failed to parse file',
      details: error?.message || 'حدث خطأ أثناء معالجة الملف. حاول مرة أخرى لاحقًا.',
    });
  }
});

app.post('/api/track-visit', express.json({ limit: '1mb' }), (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

export default function handler(req: any, res: any) {
  return app(req, res);
}
