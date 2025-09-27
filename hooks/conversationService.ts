import { GoogleGenAI } from "@google/genai";
import useApiKeyStore from "@/store/api";
export default async function conversationService(
  prompt: string,
  voice: string
) {
  const { apiKey } = useApiKeyStore();

  if (!apiKey) {
    throw new Error("API key is not set");
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: "Joe",
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Kore" },
              },
            },
            {
              speaker: "Jane",
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Puck" },
              },
            },
          ],
        },
      },
    },
  });

  const audioBuffer =
    response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data; // base64 encoded audio buffer
  return audioBuffer;
}
