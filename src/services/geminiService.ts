import { GoogleGenAI, Type } from "@google/genai";
import { getNextApiKey, rotateToNextKey, getKeyCount } from "./keyRotation";

const GEMINI_GENERATION_MODELS = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];

const isQuotaError = (err: any) => {
  const message = `${err?.message || ''} ${err?.status || ''} ${err?.code || ''}`;
  return err?.status === 429 ||
    err?.code === 429 ||
    /429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(message);
};

const createQuotaError = () => {
  const error = new Error('جميع مفاتيح Gemini أو النماذج المتاحة وصلت لحد الاستخدام مؤقتا. انتظر قليلا ثم حاول مرة أخرى، أو أضف مفتاحا من مشروع Google آخر.');
  (error as any).statusCode = 429;
  return error;
};

export interface GeneratedQuestion {
  type: 'multiple-choice';
  questionText: string;
  options: string[];
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
}

export const generateQuizFromContent = async (params: QuizGenerationParams): Promise<QuizGenerationResponse> => {
  const totalKeys = getKeyCount();
  if (totalKeys === 0) {
    throw new Error("تنبيه: لا يوجد مفتاح Gemini API. للتشغيل المحلي أنشئ ملف .env.local داخل مجلد quiz وأضف GEMINI_API_KEY=your_key ثم أعد تشغيل السيرفر.");
  }

  const { content, image, numQuestions, language, difficulty, notes } = params;
  const isAuto = numQuestions === 0;

  if (!content && !image) {
    throw new Error("No content or image provided for quiz generation.");
  }

  if (content === '[object Object]' || (content && content.length < 20)) {
    throw new Error("المحتوى المستخرج غير صالح أو قصير جداً لتوليد اختبار.");
  }

  console.log("Generating quiz. Available keys:", totalKeys, "| Auto mode:", isAuto);

  const questionCountInstruction = isAuto
    ? `PHASE 2.5 — Optimal Count Decision:
  Before writing any question, count every distinct concept, fact, definition, process, or key detail in the content.
  Then decide the optimal number of questions that ensures full coverage without repetition.
  Rules for your decision:
  - Minimum: 3 questions.
  - Maximum: 30 questions.
  - Aim for complete, comprehensive coverage — every important point should be tested.
  - Avoid trivial or duplicate questions.
  Generate exactly as many questions as your analysis determines is optimal.`
    : `Generate a high-quality quiz with exactly ${numQuestions} questions.`;

  const notesInstruction = notes?.trim()
    ? `\nUSER INSTRUCTIONS (follow these carefully when generating questions):\n"${notes.trim()}"\n`
    : '';

  const prompt = `You are an educational AI engine and expert quiz generator.
  
  PHASE 1: Deep Content Analysis
  First, thoroughly analyze the provided content/image. Identify all key concepts, definitions, processes, and important details. Ensure you have a complete understanding of the material before proceeding.
  If the content came from OCR, silently correct obvious OCR noise, ignore image metadata, ignore repeated decorative text, and focus on the educational meaning.
  
  ${questionCountInstruction}
  
  PHASE 3: MCQ Generation
  STRICT RULE 1: You MUST generate ONLY Multiple Choice Questions (MCQ). No true/false, no short-answer.
  STRICT RULE 2: You MUST generate the quiz questions ONLY from the provided content below. Every question must be directly answerable from the text or image provided.
  STRICT RULE 3: DO NOT ask meta-questions about the input text itself (e.g., "What is the text about?", "What is the exact text provided?", "How many words are in the content?"). Instead, ask about the SUBJECT MATTER (e.g., "What are the symptoms of liver cirrhosis?").
  STRICT RULE 4: If the content is garbage, nonsensical, or just "[object Object]", do not generate a quiz. Instead, return an error in the JSON structure.
  STRICT RULE 5: Do not copy source sentences directly as question text. Rewrite questions so they test understanding, not memorization.
  STRICT RULE 6: Avoid trivial, repeated, overly obvious, or vocabulary-only questions unless the source is mainly definitions.
  ${notesInstruction}
  Also, provide a highly accurate and concise title (max 6 words) and a brief description (max 2 sentences) for this quiz. The title should capture the specific topic of the content (e.g., "Photosynthesis Basics" instead of "Science Quiz").
  
  IMPORTANT: The quiz, title, and description MUST be in the SAME language as the content/image provided. If the content is in Arabic, the title and description MUST be in Arabic.
  Difficulty level: ${difficulty}. If the source is noisy OCR, keep the questions at a practical medium exam level unless the selected difficulty is clearly different.
  
  ${content ? `--- START OF CONTENT ---\n${content}\n--- END OF CONTENT ---` : ''}
  
  Requirements:
  - ONLY Multiple Choice Questions (MCQ).
  - Each question must have exactly 4 unique and plausible options.
  - One option must be clearly correct.
  - Feedback: A helpful explanation for each answer based on the content.
  - Every question must test understanding, application, comparison, cause/effect, classification, or interpretation of the source material.
  - Avoid duplicated concepts unless the source repeatedly emphasizes them in different contexts.
  - Output: Valid JSON object with 'title', 'description', and 'questions' array.`;

  const contents: any[] = [{ parts: [{ text: prompt }] }];
  
  if (image) {
    contents[0].parts.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

  let keyAttemptsLeft = totalKeys;

  const executeGeneration = async (): Promise<QuizGenerationResponse> => {
    const apiKey = getNextApiKey();
    if (!apiKey) {
      throw new Error("تنبيه: لا يوجد مفتاح Gemini API صالح. تأكد من قيمة GEMINI_API_KEY في .env.local ثم أعد تشغيل السيرفر.");
    }

    console.log(`Using API key #${totalKeys - keyAttemptsLeft + 1}/${totalKeys} (prefix: ${apiKey.substring(0, 8)}...)`);
    const ai = new GoogleGenAI({ apiKey });
    let sawQuotaError = false;

    for (const model of GEMINI_GENERATION_MODELS) {
      try {
      const response = await ai.models.generateContent({
        model,
        contents: contents,
        config: {
          systemInstruction: "You are an educational AI engine. Convert provided content or OCR text into a high-quality exam quiz. You only use the provided context, never hallucinate, never copy source sentences directly as questions, avoid trivial or repeated questions, and output JSON only.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: "A suitable title for the quiz",
              },
              description: {
                type: Type.STRING,
                description: "A brief description of the quiz",
              },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      enum: ["multiple-choice"],
                      description: "The type of question (always multiple-choice)",
                    },
                    questionText: {
                      type: Type.STRING,
                      description: "The text of the question",
                    },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Exactly 4 options for the question",
                    },
                    correctAnswer: {
                      type: Type.STRING,
                      description: "The correct answer to the question",
                    },
                    feedback: {
                      type: Type.STRING,
                      description: "A brief feedback explanation for the correct answer",
                    },
                  },
                  required: ["type", "questionText", "options", "correctAnswer", "feedback"],
                },
              },
            },
            required: ["title", "description", "questions"],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      try {
        return JSON.parse(text.trim());
      } catch (e) {
        console.error("Failed to parse AI response:", text);
        throw new Error("Failed to parse generated quiz");
      }
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
      console.warn(`Key quota exceeded. Rotating to next key (${keyAttemptsLeft} remaining)...`);
      rotateToNextKey();
      return executeGeneration();
    }

    if (sawQuotaError) {
      throw createQuotaError();
    }

    throw new Error("Failed to generate quiz");
  };

  return executeGeneration();
};
