import { AudioDocument, DocumentMetadata } from "./library";
import {
  SourceMaterial,
  VoiceProfile,
  ConversationStyle,
} from "./conversation";
import { Document } from "./library";

// Podcast is a specialized type of conversation document
export interface PodcastDocument extends AudioDocument {
  subType: "podcast";
  content: AudioDocument["content"] & {
    speakers: PodcastSpeaker[];
    transcript: string;
    chapters?: PodcastChapter[];
  };
  metadata: DocumentMetadata & {
    duration: number;
    podcastMetadata: PodcastMetadata;
  };
}

export interface PodcastSpeaker {
  id: string;
  name: string;
  voiceProfile: VoiceProfile;
  role: "host" | "guest" | "narrator";
  speakerNumber: 1 | 2 | 3;
}

export interface PodcastChapter {
  title: string;
  startTime: number; // seconds
  endTime: number; // seconds
  speakers: string[]; // speaker IDs
  topics: string[];
}

export interface PodcastMetadata {
  generationId: string;
  sourceLibraryIds: string[]; // references to source documents in library
  conversationStyle: ConversationStyle;
  totalSpeakers: 1 | 2 | 3;
  generatedAt: Date;
  promptHash: string; // for caching and deduplication
  ttsModel: string;
  audioFormat: "wav" | "mp3" | "flac";
  qualitySettings: TTSQualitySettings;
}

export interface TTSQualitySettings {
  sampleRate: number;
  bitRate?: number;
  channels: 1 | 2;
  compression?: "none" | "low" | "medium" | "high";
}

// Conversation/Podcast generation configuration
export interface ConversationGenerationConfig {
  id: string;
  name: string;
  description?: string;
  speakers: PodcastSpeaker[];
  sourceMaterials: SourceMaterial[];
  conversationStyle: ConversationStyle;
  promptTemplate: ConversationPromptTemplate;
  outputSettings: ConversationOutputSettings;
  createdAt: Date;
  updatedAt: Date;
}

// Legacy alias for backward compatibility
export type PodcastGenerationConfig = ConversationGenerationConfig;

export interface ConversationPromptTemplate {
  type: "conversation" | "interview" | "debate" | "storytelling";
  structure: PromptStructure;
  customInstructions?: string;
  speakerInstructions: SpeakerInstruction[];
}

export interface ConversationOutputSettings {
  maxDuration?: number; // seconds
  targetLength: "short" | "medium" | "long"; // 5-10min, 15-30min, 45-60min
  audioSettings: TTSQualitySettings;
  includeChapters: boolean;
  generateTranscript: boolean;
  autoSaveToLibrary: boolean;
  libraryTags?: string[];
}

// Legacy alias
export type PodcastPromptTemplate = ConversationPromptTemplate;

export interface PromptStructure {
  introduction: boolean;
  mainContent: boolean;
  conclusion: boolean;
  transitions: boolean;
  chapters?: string[]; // predefined chapter topics
}

export interface SpeakerInstruction {
  speakerId: string;
  personality: string;
  expertise: string[];
  speakingStyle: string;
  restrictions?: string[];
}

export interface PodcastOutputSettings {
  maxDuration?: number; // seconds
  targetLength: "short" | "medium" | "long"; // 5-10min, 15-30min, 45-60min
  audioSettings: TTSQualitySettings;
  includeChapters: boolean;
  generateTranscript: boolean;
  autoSaveToLibrary: boolean;
  libraryTags?: string[];
}

export interface GeneratedPodcastPrompt {
  id: string;
  configId: string;
  prompt: string;
  speakers: PodcastSpeaker[];
  estimatedDuration: number;
  createdAt: Date;
  hash: string; // for caching
}

export interface PodcastGenerationRequest {
  config: PodcastGenerationConfig;
  sourceMaterialContent?: string; // processed content from source materials
  regenerate?: boolean; // force regeneration even if cached version exists
}

export interface PodcastGenerationResult {
  podcastDocument: PodcastDocument;
  audioBuffer: string; // base64 encoded
  generationMetadata: {
    processingTime: number;
    tokensUsed?: number;
    model: string;
    version: string;
  };
  errors?: string[];
  warnings?: string[];
}

export type PodcastLibraryEntry = {
  podcast: PodcastDocument;
  relatedDocuments: Document[]; // source materials used
  generationConfig: PodcastGenerationConfig;
  versions: PodcastVersion[];
};

export interface PodcastVersion {
  versionId: string;
  createdAt: Date;
  changes: string;
  audioBuffer: string;
  metadata: PodcastMetadata;
}

export interface PodcastSearchFilters {
  speakers?: string[];
  conversationStyles?: ConversationStyle["type"][];
  durationRange?: { min: number; max: number };
  sourceTypes?: SourceMaterial["type"][];
  generatedAfter?: Date;
  generatedBefore?: Date;
}

export interface PodcastAnalytics {
  podcastId: string;
  playCount: number;
  averageListenTime: number;
  completionRate: number;
  skipPoints: number[]; // timestamps where users commonly skip
  popularChapters: string[];
  userRatings?: number[];
}
