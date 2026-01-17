
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateDailySchedule = async () => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: 'Generate a 24-hour radio schedule for a professional rock/electronic station. Return JSON array with startTime (HH:MM), title, and hostType.',
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            startTime: { type: Type.STRING },
            title: { type: Type.STRING },
            hostType: { type: Type.STRING },
          },
          required: ['startTime', 'title', 'hostType'],
        },
      },
    },
  });
  return JSON.parse(response.text || '[]');
};
