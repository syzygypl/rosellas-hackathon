import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  DeterministicEvaluatorDefinition,
  HostedEvaluatorDefinition,
  LlmJudgeDefinition,
} from './types';

const EVALUATOR_DIR = resolve(process.cwd(), 'eval/evaluators');

export function loadDeterministicDefinition(): DeterministicEvaluatorDefinition {
  const definition = loadJson<DeterministicEvaluatorDefinition>('deterministic.json');
  requireString(definition.id, 'deterministic.json', 'id');
  requireNumber(definition.passThreshold, 'deterministic.json', 'passThreshold');
  requireNumber(definition.runPassThreshold, 'deterministic.json', 'runPassThreshold');
  requireString(definition.toolTrailPattern, 'deterministic.json', 'toolTrailPattern');
  if (!definition.weights || typeof definition.weights !== 'object') {
    throw new Error('deterministic.json: weights must be an object');
  }
  validateScores(definition.scores, 'deterministic.json');
  return definition;
}

export function loadLlmJudgeDefinition(): LlmJudgeDefinition {
  const definition = loadJson<LlmJudgeDefinition>('llm-judge.json');
  requireString(definition.id, 'llm-judge.json', 'id');
  requireString(definition.systemPrompt, 'llm-judge.json', 'systemPrompt');
  requireString(definition.fallbackModel, 'llm-judge.json', 'fallbackModel');
  requireStringArray(definition.modelEnvVars, 'llm-judge.json', 'modelEnvVars');
  if (!definition.rubric || typeof definition.rubric !== 'object') {
    throw new Error('llm-judge.json: rubric must be an object');
  }
  validateScores(definition.scores, 'llm-judge.json');
  requireString(definition.statusScoreName, 'llm-judge.json', 'statusScoreName');
  return definition;
}

export function loadHostedDefinition(): HostedEvaluatorDefinition {
  const definition = loadJson<HostedEvaluatorDefinition>('hosted-langfuse.json');
  requireString(definition.id, 'hosted-langfuse.json', 'id');
  if (!Array.isArray(definition.evaluators) || !definition.evaluators.length) {
    throw new Error('hosted-langfuse.json: evaluators must be a non-empty array');
  }
  if (!Array.isArray(definition.rules) || !definition.rules.length) {
    throw new Error('hosted-langfuse.json: rules must be a non-empty array');
  }
  return definition;
}

function loadJson<T>(filename: string): T {
  const path = resolve(EVALUATOR_DIR, filename);
  if (!existsSync(path)) throw new Error(`Evaluator definition not found: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function validateScores(scores: unknown, source: string): void {
  if (!Array.isArray(scores) || !scores.length) {
    throw new Error(`${source}: scores must be a non-empty array`);
  }
  for (const [index, score] of scores.entries()) {
    if (!score || typeof score !== 'object') throw new Error(`${source}: scores[${index}] must be an object`);
    requireString((score as any).name, source, `scores[${index}].name`);
    requireString((score as any).dataType, source, `scores[${index}].dataType`);
  }
}

function requireString(value: unknown, source: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${source}: ${field} must be a non-empty string`);
  }
}

function requireStringArray(value: unknown, source: string, field: string): void {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${source}: ${field} must be a non-empty string array`);
  }
}

function requireNumber(value: unknown, source: string, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${source}: ${field} must be a finite number`);
  }
}
