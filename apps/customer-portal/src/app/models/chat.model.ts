import { TrizParameter } from './solve.model';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

/** Structured payload for the solutions side panel. */
export interface ChatSolution {
  title: string;
  parameters: TrizParameter[];
  contradiction: string | null;
  principles: string;
  related: string;
  trail: string[];
  /** Full agent report (markdown) when the chat answer is a compressed summary. */
  report?: string;
}

export interface ChatResult {
  answer: string;
  engine: 'agent' | 'pipeline';
  solution: ChatSolution | null;
  warning?: string;
}
