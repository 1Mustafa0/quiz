import { GoogleGenAI } from "@google/genai";
import { getNextApiKey, rotateToNextKey, getKeyCount } from './keyRotation';

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

export interface MindMapChild {
  label: string;
  children: MindMapChild[];
}

export interface MindMapBranch {
  label: string;
  children: MindMapChild[];
}

export interface MindMapData {
  topic: string;
  branches: MindMapBranch[];
}

async function callGemini(prompt: string): Promise<MindMapData> {
  const totalKeys = getKeyCount();
  if (totalKeys === 0) {
    throw new Error('لا يوجد مفتاح Gemini API. أنشئ ملف .env.local داخل مجلد quiz وأضف GEMINI_API_KEY=your_key ثم أعد تشغيل السيرفر.');
  }

  let keyAttemptsLeft = totalKeys;

  const attempt = async (): Promise<MindMapData> => {
    const apiKey = getNextApiKey();
    if (!apiKey) throw new Error('لا يوجد مفتاح Gemini API صالح.');

    const ai = new GoogleGenAI({ apiKey });
    let sawQuotaError = false;

    for (const model of GEMINI_GENERATION_MODELS) {
      try {
      const response = await ai.models.generateContent({
          model,
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Invalid AI response — no JSON found.');

      const data = JSON.parse(jsonMatch[0]) as MindMapData;
      if (!data.topic || !Array.isArray(data.branches)) throw new Error('Invalid mind map structure.');
      return data;
      } catch (err: any) {
        if (isQuotaError(err)) {
          sawQuotaError = true;
          console.warn(`[MindMap] ${model} quota reached. Trying another model/key...`);
          continue;
        }
        throw err;
      }
    }

    if (sawQuotaError && keyAttemptsLeft > 1) {
      keyAttemptsLeft--;
      rotateToNextKey();
      return attempt();
    }

    if (sawQuotaError) {
      throw createQuotaError();
    }

    throw new Error('Failed to generate mind map.');
  };

  return attempt();
}

export async function generateMindMap(topic: string): Promise<MindMapData> {
  const prompt = `You are an expert mind map generator. Create a comprehensive, deeply detailed mind map for the topic: "${topic}"

Detect the language of the topic and respond entirely in the SAME language.

Return ONLY a valid JSON object — no markdown, no code blocks, no explanation:
{
  "topic": "Main Topic Name",
  "branches": [
    {
      "label": "Branch Name",
      "children": [
        {
          "label": "Sub-branch",
          "children": [
            { "label": "Detail", "children": [] }
          ]
        }
      ]
    }
  ]
}

REQUIREMENTS:
- 6 to 8 main branches covering ALL major aspects
- Each branch must have 3 to 5 children
- Each child should have 2 to 4 grandchildren for important details
- Labels must be concise: 2 to 5 words max
- Cover ALL important concepts — definitions, types, examples, applications, history, advantages, disadvantages, etc.
- Return ONLY the raw JSON object, nothing else`;

  return callGemini(prompt);
}

export async function generateMindMapFromContent(content: string, filename?: string): Promise<MindMapData> {
  const trimmed = content.slice(0, 9000);
  const prompt = `You are an expert mind map generator. Analyze the following document content and create a comprehensive mind map that captures its key topics, concepts, and structure.

${filename ? `Document name: "${filename}"` : ''}

Document content:
---
${trimmed}
---

Detect the language of the content and respond entirely in the SAME language.

Return ONLY a valid JSON object — no markdown, no code blocks, no explanation:
{
  "topic": "Main Document Topic",
  "branches": [
    {
      "label": "Main Theme",
      "children": [
        {
          "label": "Sub-concept",
          "children": [
            { "label": "Key Detail", "children": [] }
          ]
        }
      ]
    }
  ]
}

REQUIREMENTS:
- Infer the main topic from the document content
- Create 5 to 8 main branches representing the document's key sections or themes
- Each branch must have 3 to 5 children derived from the actual content
- Each child should have 2 to 3 grandchildren with specific details from the text
- Labels must be concise: 2 to 6 words max
- Stay faithful to the actual content — do not invent information
- Return ONLY the raw JSON object, nothing else`;

  return callGemini(prompt);
}
