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

async function callGemini(prompt: string): Promise<MindMapData> {
  const totalKeys = getKeyCount();
  if (totalKeys === 0) throw new Error('No Gemini API key configured.');

  let attemptsLeft = totalKeys;

  const attempt = async (): Promise<MindMapData> => {
    const apiKey = getNextApiKey();
    if (!apiKey) throw new Error('No valid API key.');

    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
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
      const isRateLimit = err?.message?.includes('429') || err?.message?.includes('quota') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && attemptsLeft > 1) {
        attemptsLeft--;
        rotateToNextKey();
        return attempt();
      }
      throw err;
    }
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
