import { GoogleGenAI } from '@google/genai'
import dotenv from 'dotenv'

dotenv.config()

export async function generateInsight(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    },
    contents: userPrompt,
  })
  return response.text ?? ''
}
