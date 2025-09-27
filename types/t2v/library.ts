// Import audio overview types
import { AudioOverviewDocument } from "./audioOverview";

// Library Management Types
export interface Library {
  id: string;
  name: string;
  description: string;
  tags: string[];
  documents: Document[];
  createdAt: Date;
  updatedAt: Date;
  metadata: LibraryMetadata;
}
// Core Document Types
export type DocumentType =
  | "link"
  | "text"
  | "pdf"
  | "audio"
  | "video"
  | "image"
  | "code"
  | "markdown";

export interface BaseDocument {
  id: string;
  name: string;
  summary: string;
  citation: string;
  type: DocumentType;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  metadata: DocumentMetadata;
  content: DocumentContent;
}

export interface DocumentMetadata {
  size?: number;
  duration?: number; // for audio/video
  dimensions?: { width: number; height: number }; // for images/videos
  language?: string;
  author?: string;
  source?: string;
  version?: string;
  checksum?: string; // for integrity verification
  lastAccessed?: Date;
  accessCount?: number;
}

export interface DocumentContent {
  type: DocumentType;
  data: string; // Base64 encoded or URL
  originalUrl?: string; // for links
  textContent?: string; // extracted text for search
  thumbnail?: string; // Base64 encoded thumbnail
  transcript?: string; // for audio/video
  codeLanguage?: string; // for code documents
  mimeType?: string;
}

// Specific Document Types
export interface LinkDocument extends BaseDocument {
  type: "link";
  content: {
    type: "link";
    data: string; // URL
    originalUrl: string;
    textContent?: string;
    thumbnail?: string;
  };
}

export interface TextDocument extends BaseDocument {
  type: "text";
  content: {
    type: "text";
    data: string; // Base64 encoded text
    textContent: string;
  };
}

export interface PDFDocument extends BaseDocument {
  type: "pdf";
  content: {
    type: "pdf";
    data: string; // Base64 encoded PDF
    textContent?: string; // extracted text
    thumbnail?: string;
  };
}

export interface AudioDocument extends BaseDocument {
  type: "audio";
  subType: "podcast" | "overview";
  content: {
    type: "audio";
    data: string; // Base64 encoded audio
    transcript?: string;
    thumbnail?: string;
  };
  metadata: DocumentMetadata & {
    duration: number;
  };
}

export interface VideoDocument extends BaseDocument {
  type: "video";
  content: {
    type: "video";
    data: string; // Base64 encoded video
    transcript?: string;
    thumbnail: string;
  };
  metadata: DocumentMetadata & {
    duration: number;
    dimensions: { width: number; height: number };
  };
}

export interface ImageDocument extends BaseDocument {
  type: "image";
  content: {
    type: "image";
    data: string; // Base64 encoded image
    thumbnail: string;
  };
  metadata: DocumentMetadata & {
    dimensions: { width: number; height: number };
  };
}

export interface CodeDocument extends BaseDocument {
  type: "code";
  content: {
    type: "code";
    data: string; // Base64 encoded code
    textContent: string;
    codeLanguage: string;
  };
}

export interface MarkdownDocument extends BaseDocument {
  type: "markdown";
  content: {
    type: "markdown";
    data: string; // Base64 encoded markdown
    textContent: string;
  };
}

// Union type for all document types
export type Document =
  | LinkDocument
  | TextDocument
  | PDFDocument
  | AudioDocument
  | VideoDocument
  | ImageDocument
  | CodeDocument
  | MarkdownDocument
  | AudioOverviewDocument;

export interface LibraryMetadata {
  totalDocuments: number;
  totalSize: number; // in bytes
  podcast: number;
  lastAccessed?: Date;
  createdAt?: Date;
  categories: string[];
  languages: string[];
  lastIndexed?: Date;
}

export interface StorageSettings {
  maxFileSize: number; // in bytes
  allowedTypes: DocumentType[];
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
}

// Search and Filter Types
export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  pagination?: PaginationOptions;
  sort?: SortOptions;
}

export interface SearchFilters {
  types?: DocumentType[];
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  authors?: string[];
  languages?: string[];
  sizeRange?: { min: number; max: number };
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

export interface SortOptions {
  field: "name" | "createdAt" | "updatedAt" | "size" | "relevance";
  direction: "asc" | "desc";
}

export interface SearchResult {
  documents: Document[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  facets?: SearchFacets;
}

export interface SearchFacets {
  types: { [key in DocumentType]: number };
  tags: { [key: string]: number };
  authors: { [key: string]: number };
  languages: { [key: string]: number };
}

export interface LibraryUsage {
  libraryId: string;
  totalAccesses: number;
  lastAccessed: Date;
  mostAccessedDocuments: string[];
  searchHistory: SearchQuery[];
}

// Export utility types
export type DocumentTypeMap = {
  link: LinkDocument;
  text: TextDocument;
  pdf: PDFDocument;
  audio: AudioDocument;
  video: VideoDocument;
  image: ImageDocument;
  code: CodeDocument;
  markdown: MarkdownDocument;
};

export type DocumentContentMap = {
  link: LinkDocument["content"];
  text: TextDocument["content"];
  pdf: PDFDocument["content"];
  audio: AudioDocument["content"];
  video: VideoDocument["content"];
  image: ImageDocument["content"];
  code: CodeDocument["content"];
  markdown: MarkdownDocument["content"];
};
