import { TrizParameter } from './solve.model';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** true when this assistant turn delivered a solution card — resets the intake gate. */
  solved?: boolean;
}

export interface ChatRequest {
  sessionId?: string;
  messages: ChatMessage[];
}

/** One humanized solution direction on the side-panel card. */
export interface SolutionDirection {
  principle: string;
  idea: string;
  example?: string;
}

/** Structured payload for the solutions side panel. */
export interface ChatSolution {
  title: string;
  /** Method that produced the winning directions: "TRIZ", "SCAMPER" or "TRIZ + SCAMPER". */
  method?: string;
  /** One sentence explaining why that method fit the problem best (agent path only). */
  methodRationale?: string;
  /** 1-2 plain sentences about the problem, in the conversation language (agent path only). */
  summary?: string;
  /** Humanized solution directions written by the LLM (agent path only). */
  directions?: SolutionDirection[];
  /** Suggested next steps for the user (agent path only). */
  nextSteps?: string[];
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
  /** Optional quick-reply options rendered as buttons under the assistant question. */
  suggestions?: string[];
}
