import { Message } from "./messages";

export type NodeKind =
  | "claude"
  | "pdf"
  | "youtube"
  | "article"
  | "image"
  | "text"
  | "flashcard"
  | "quiz"
  | "pdfdoc";

interface BaseNodeData {
  kind: NodeKind;
  label: string;
}

export interface ClaudeNodeData extends BaseNodeData {
  kind: "claude";
  conversationId: string;
  parentNodeId?: string;
  model: string;
  initialMessages?: Message[];
}

export interface PDFNodeData extends BaseNodeData {
  kind: "pdf";
  fileName: string;
  extractedText: string;
  pageCount: number;
}

export interface YouTubeNodeData extends BaseNodeData {
  kind: "youtube";
  url: string;
  transcript: string;
  title: string;
}

export interface ArticleNodeData extends BaseNodeData {
  kind: "article";
  url: string;
  content: string;
  title: string;
}

export interface ImageNodeData extends BaseNodeData {
  kind: "image";
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  fileName: string;
}

export interface TextNodeData extends BaseNodeData {
  kind: "text";
  content: string;
}

export interface FlashCard {
  front: string;
  back: string;
}

export interface FlashcardNodeData extends BaseNodeData {
  kind: "flashcard";
  cards: FlashCard[];
  sourceNodeId: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

export interface QuizNodeData extends BaseNodeData {
  kind: "quiz";
  questions: QuizQuestion[];
  sourceNodeId: string;
}

export interface PDFDocNodeData extends BaseNodeData {
  kind: "pdfdoc";
  markdown: string;
  title: string;
}

export type AnyNodeData =
  | ClaudeNodeData
  | PDFNodeData
  | YouTubeNodeData
  | ArticleNodeData
  | ImageNodeData
  | TextNodeData
  | FlashcardNodeData
  | QuizNodeData
  | PDFDocNodeData;
