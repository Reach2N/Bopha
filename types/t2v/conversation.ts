// Core conversation/audio overview configuration types

// Predefined Gemini voice profiles (enumerated from Gemini docs)
export type VoiceProfile =
  | "Zephyr" // Bright
  | "Puck" // Upbeat
  | "Charon" // Informative
  | "Kore" // Firm
  | "Fenrir" // Excitable
  | "Leda" // Youthful
  | "Orus" // Firm
  | "Aoede" // Breezy
  | "Callirrhoe" // Easy-going
  | "Autonoe" // Bright
  | "Enceladus" // Breathy
  | "Iapetus" // Clear
  | "Umbriel" // Easy-going
  | "Algieba" // Smooth
  | "Despina" // Smooth
  | "Erinome" // Clear
  | "Algenib" // Gravelly
  | "Rasalgethi" // Informative
  | "Laomedeia" // Upbeat
  | "Achernar" // Soft
  | "Alnilam" // Firm
  | "Schedar" // Even
  | "Gacrux" // Mature
  | "Pulcherrima" // Forward
  | "Achird" // Friendly
  | "Zubenelgenubi" // Casual
  | "Vindemiatrix" // Gentle
  | "Sadachbia" // Lively
  | "Sadaltager" // Knowledgeable
  | "Sulafat"; // Warm

// Conversation style configuration
export interface ConversationStyle {
  type: "educational" | "debate" | "casual" | "storytelling" | "interview";
  tone: "engaging" | "serious" | "funny" | "professional";
  length: "short" | "medium" | "long"; // 5-10min, 15-30min, 45-60min
}

// Source material types that can be used for audio overview generation
export type SourceMaterial =
  | {
      type: "library"; // references documents from the library system
      documentIds: string[];
    }
  | {
      type: "text"; // direct text input
      content: string;
    };
