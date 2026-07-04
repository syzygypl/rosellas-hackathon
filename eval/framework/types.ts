import type { Evaluation } from '@langfuse/client';

export interface KeywordCriterion {
  id: string;
  description: string;
  keywords: string[];
}

export interface ForbiddenPattern {
  id: string;
  description: string;
  patterns: string[];
}

export interface EvalScenario {
  id: string;
  title: string;
  prompt: string;
  maxAnswerWords: number;
  requiredCriteria: KeywordCriterion[];
  positiveSignals: KeywordCriterion[];
  forbiddenPatterns: ForbiddenPattern[];
}

export interface ChatRequest {
  sessionId: string;
  messages: { role: 'user'; content: string }[];
}

export interface ChatSolution {
  title?: string;
  summary?: string;
  directions?: { principle?: string; idea?: string; why?: string }[];
  nextSteps?: string[];
  parameters?: { id: number; name: string }[];
  contradiction?: string | null;
  principles?: string;
  related?: string;
  trail?: string[];
  report?: string;
}

export interface ChatResult {
  answer: string;
  engine?: 'agent' | 'pipeline' | string;
  solution?: ChatSolution | null;
  warning?: string;
  suggestions?: string[];
}

export interface ObservationSummary {
  count: number;
  names: string[];
  toolTrail: string[];
  traceIds: string[];
  totalCost?: number;
  totalTokens?: number;
  error?: string;
}

export interface ScenarioOutput {
  scenarioId: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  chat: ChatResult;
  observations: ObservationSummary;
  latencyMs: number;
}

export interface DeterministicBreakdown {
  enginePresent: boolean;
  solutionPresent: boolean;
  toolTrailPresent: boolean;
  answerBrief: boolean;
  forbiddenAbsent: boolean;
  coverage: number;
  positiveSignalCoverage: number;
  matchedCriteria: string[];
  forbiddenMatches: string[];
  overall: number;
}

export type EvalScore = Evaluation;

export interface EvalScoreDefinition {
  name: string;
  dataType: 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL' | string;
  description?: string;
  field?: string;
}

export interface DeterministicEvaluatorDefinition {
  id: string;
  type: 'local_deterministic' | string;
  description?: string;
  passThreshold: number;
  runPassThreshold: number;
  toolTrailPattern: string;
  weights: {
    enginePresent: number;
    solutionPresent: number;
    toolTrailPresent: number;
    answerBrief: number;
    forbiddenAbsent: number;
    coverage: number;
    positiveSignalCoverage: number;
  };
  scores: EvalScoreDefinition[];
}

export interface LlmJudgeDefinition {
  id: string;
  type: 'local_llm_judge' | string;
  description?: string;
  modelEnvVars: string[];
  fallbackModel: string;
  systemPrompt: string;
  rubric: Record<string, string>;
  scores: EvalScoreDefinition[];
  statusScoreName: string;
}

export interface HostedEvaluatorDefinition {
  id: string;
  type: 'hosted_langfuse' | string;
  description?: string;
  evaluators: any[];
  rules: any[];
}

export interface ParsedArgs {
  command: 'list' | 'run' | 'push' | 'help';
  scenarios: string[];
  runName?: string;
  noFail: boolean;
  requireLlmJudge: boolean;
  skipLlmJudge: boolean;
  dryRun: boolean;
  enable: boolean;
  backendUrl?: string;
  maxConcurrency: number;
}
