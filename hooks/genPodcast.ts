import { GoogleGenAI } from "@google/genai";
import useApiKeyStore from "@/store/api";
import { useCallback } from "react";

export default function useGenPodcast() {
  const { apiKey } = useApiKeyStore();
  // Generate Initial podcast with summarization and outline with prompt and define each speaker for particular roles
  const genPodcast = useCallback(
    async (prompt: string) => {
      if (!apiKey) {
        throw new Error("API key is not set");
      }
      const ai = new GoogleGenAI({ apiKey: apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
      });
      console.log(response);
      return response;
    },
    [apiKey]
  );

  return { genPodcast };
}
