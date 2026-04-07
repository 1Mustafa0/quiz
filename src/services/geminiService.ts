import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  // Try multiple sources for the API key
  // In Vite, process.env.GEMINI_API_KEY is replaced by the value in vite.config.ts
  const key = (process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY) || '';
  
  if (!key || key === 'MY_GEMINI_API_KEY' || key === 'undefined' || key === 'null') {
    console.error('GEMINI_API_KEY is missing or invalid. Current value:', key);
    return '';
  }
  return key;
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
}

export interface QuizGenerationResponse {
  title: string;
  description: string;
  questions: GeneratedQuestion[];
}

export const generateQuizFromContent = async (params: QuizGenerationParams): Promise<QuizGenerationResponse> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("تنبيه: مفتاح Gemini API غير متوفر. يرجى إضافته في لوحة Secrets في AI Studio.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const { content, image, numQuestions, language, difficulty } = params;

  if (!content && !image) {
    throw new Error("No content or image provided for quiz generation.");
  }

  if (content === '[object Object]' || (content && content.length < 20)) {
    throw new Error("المحتوى المستخرج غير صالح أو قصير جداً لتوليد اختبار.");
  }

  console.log("Generating quiz from content. Length:", content?.length || 0, "Image:", !!image);
  if (content) {
    console.log("Content preview:", content.substring(0, 200) + "...");
  }

  const prompt = `You are an expert quiz generator and content analyst. 
  
  PHASE 1: Deep Content Analysis
  First, thoroughly analyze the provided content/image. Identify all key concepts, definitions, processes, and important details. Ensure you have a complete understanding of the material before proceeding.
  
  PHASE 2: MCQ Generation
  STRICT RULE 1: You MUST generate ONLY Multiple Choice Questions (MCQ). No true/false, no short-answer.
  STRICT RULE 2: You MUST generate the quiz questions ONLY from the provided content below. Every question must be directly answerable from the text or image provided.
  STRICT RULE 3: DO NOT ask meta-questions about the input text itself (e.g., "What is the text about?", "What is the exact text provided?", "How many words are in the content?"). Instead, ask about the SUBJECT MATTER (e.g., "What are the symptoms of liver cirrhosis?").
  STRICT RULE 4: If the content is garbage, nonsensical, or just "[object Object]", do not generate a quiz. Instead, return an error in the JSON structure.
  
  Generate a high-quality quiz with exactly ${numQuestions} questions based on the ${content ? 'content' : ''}${content && image ? ' and ' : ''}${image ? 'image' : ''} provided.
  
  Also, provide a highly accurate and concise title (max 6 words) and a brief description (max 2 sentences) for this quiz. The title should capture the specific topic of the content (e.g., "Photosynthesis Basics" instead of "Science Quiz").
  
  IMPORTANT: The quiz, title, and description MUST be in the SAME language as the content/image provided. If the content is in Arabic, the title and description MUST be in Arabic.
  Difficulty level: ${difficulty}.
  
  ${content ? `--- START OF CONTENT ---\n${content}\n--- END OF CONTENT ---` : ''}
  
  Requirements:
  - ONLY Multiple Choice Questions (MCQ).
  - Each question must have exactly 4 unique and plausible options.
  - One option must be clearly correct.
  - Feedback: A helpful explanation for each answer based on the content.
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

  const maxRetries = 3;
  let retryCount = 0;

  const executeGeneration = async (): Promise<QuizGenerationResponse> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: "You are a strict MCQ quiz generator that performs deep content analysis first. You ONLY use the provided context to create questions. You never hallucinate or use outside knowledge. You only output Multiple Choice Questions.",
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
      if (error.message?.includes('429') || error.status === 429 || error.message?.includes('quota')) {
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000;
          console.log(`Quota exceeded. Retrying in ${delay}ms (Attempt ${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return executeGeneration();
        }
        throw new Error("لقد تجاوزت الحد المسموح به من الطلبات حالياً. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.");
      }
      throw error;
    }
  };

  return executeGeneration();
};
