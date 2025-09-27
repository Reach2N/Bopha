import { AudioDocument, DocumentMetadata } from "./library";
import {
  VoiceProfile,
  ConversationStyle,
  SourceMaterial,
} from "./conversation";

// Audio Overview Document - generated audio content from source materials
export interface AudioOverviewDocument extends AudioDocument {
  subType: "overview";
  content: AudioDocument["content"] & {
    speakers: Speaker[];
    transcript: string;
    audioFormat: "wav";
  };
  metadata: DocumentMetadata & {
    duration: number;
    audioOverviewMetadata: AudioOverviewMetadata;
  };
}

// Speaker in the audio overview
export interface Speaker {
  id: string;
  name: string; // e.g., "Speaker 1", "Host", "Narrator"
  voice: VoiceProfile;
  role: "host" | "guest" | "narrator" | "other";
}

// Metadata for audio overview generation tracking
export interface AudioOverviewMetadata {
  generationId: string;
  sourceDocumentIds: string[]; // references to library documents used
  conversationStyle: ConversationStyle;
  mode: "single" | "multi"; // single speaker or multi-speaker
  totalSpeakers: 1 | 2 | 3;
  generatedAt: Date;
  promptHash: string; // for deduplication
}

// Configuration for generating audio overview
export interface AudioOverviewConfig {
  id: string;
  name: string;
  description?: string;
  mode: "single" | "multi";
  speakers: Speaker[];
  sourceMaterials: SourceMaterial;
  conversationStyle: ConversationStyle;
  customPrompt?: string;
}

// Request to generate audio overview
export interface GenerateAudioOverviewRequest {
  config: AudioOverviewConfig;
}

// Result of audio overview generation
export interface AudioOverviewResult {
  document: AudioOverviewDocument;
  audioBuffer: string; // base64 encoded WAV
  processingTime: number; // milliseconds
}

// Prompt generation for the AI
export interface GeneratedPrompt {
  id: string;
  configId: string;
  content: string;
  speakers: Speaker[];
  createdAt: Date;
}
