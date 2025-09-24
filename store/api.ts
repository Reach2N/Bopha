import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface ApiKeyState {
  apiKey: string | null;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set) => ({
      apiKey: null,
      setApiKey: (key: string) => set({ apiKey: key }),
      clearApiKey: () => set({ apiKey: null }),
    }),
    {
      name: "api-key-storage", // key in localStorage
      storage: createJSONStorage(() => localStorage), // ✅ correct way
    }
  )
);

export default useApiKeyStore;
