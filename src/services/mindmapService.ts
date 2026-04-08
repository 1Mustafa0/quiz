import { GoogleGenAI } from "@google/genai";
import { getNextApiKey, rotateToNextKey, getKeyCount } from './keyRotation';

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

export async function generateMindMap(topic: string): Promise<MindMapData> {
  const totalKeys = getKeyCount();
  if (totalKeys === 0) {
    throw new Error('لا يوجد مفتاح Gemini API. يرجى إضافة GEMINI_API_KEY في الإعدادات.');
  }

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

  let attemptsLeft = totalKeys;

  const attemptGeneration = async (): Promise<MindMapData> => {
    const apiKey = getNextApiKey();
    if (!apiKey) throw new Error('لا يوجد مفتاح API صالح.');

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('استجابة غير صالحة من الذكاء الاصطناعي.');

      const data = JSON.parse(jsonMatch[0]) as MindMapData;
      if (!data.topic || !Array.isArray(data.branches)) {
        throw new Error('هيكل الخريطة غير صحيح.');
      }
      return data;
    } catch (err: any) {
      const isRateLimit = err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && attemptsLeft > 1) {
        attemptsLeft--;
        rotateToNextKey();
        return attemptGeneration();
      }
      throw err;
    }
  };

  return attemptGeneration();
}
