import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EvalScenario } from './types';

const SCENARIO_DIR = resolve(process.cwd(), 'eval/scenarios');

export function loadScenarios(dir = SCENARIO_DIR): EvalScenario[] {
  if (!existsSync(dir)) {
    throw new Error(`Scenario directory not found: ${dir}`);
  }

  const scenarios = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => validateScenario(JSON.parse(readFileSync(join(dir, name), 'utf8')), name));

  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) {
      throw new Error(`Duplicate scenario id: ${scenario.id}`);
    }
    ids.add(scenario.id);
  }

  return scenarios;
}

export function selectScenarios(all: EvalScenario[], selectors: string[]): EvalScenario[] {
  if (!selectors.length) return all;

  const requested = selectors.flatMap((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const byId = new Map(all.map((scenario) => [scenario.id, scenario]));
  const missing = requested.filter((id) => !byId.has(id));

  if (missing.length) {
    throw new Error(
      `Unknown scenario id(s): ${missing.join(', ')}. Available: ${all.map((scenario) => scenario.id).join(', ')}`,
    );
  }

  return requested.map((id) => byId.get(id)!);
}

function validateScenario(value: unknown, source: string): EvalScenario {
  if (!isRecord(value)) throw new Error(`${source}: scenario must be an object`);

  const scenario = value as EvalScenario;
  requireString(scenario.id, source, 'id');
  requireString(scenario.title, source, 'title');
  requireString(scenario.prompt, source, 'prompt');
  requireNumber(scenario.maxAnswerWords, source, 'maxAnswerWords');
  validateCriteria(scenario.requiredCriteria, source, 'requiredCriteria');
  validateCriteria(scenario.positiveSignals, source, 'positiveSignals');
  validateForbidden(scenario.forbiddenPatterns, source);

  return scenario;
}

function validateCriteria(value: unknown, source: string, field: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${source}: ${field} must be a non-empty array`);
  }
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) throw new Error(`${source}: ${field}[${index}] must be an object`);
    requireString(item.id, source, `${field}[${index}].id`);
    requireString(item.description, source, `${field}[${index}].description`);
    requireStringArray(item.keywords, source, `${field}[${index}].keywords`);
  }
}

function validateForbidden(value: unknown, source: string): void {
  if (!Array.isArray(value)) throw new Error(`${source}: forbiddenPatterns must be an array`);
  for (const [index, item] of value.entries()) {
    if (!isRecord(item)) throw new Error(`${source}: forbiddenPatterns[${index}] must be an object`);
    requireString(item.id, source, `forbiddenPatterns[${index}].id`);
    requireString(item.description, source, `forbiddenPatterns[${index}].description`);
    requireStringArray(item.patterns, source, `forbiddenPatterns[${index}].patterns`);
  }
}

function requireString(value: unknown, source: string, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${source}: ${field} must be a non-empty string`);
  }
}

function requireNumber(value: unknown, source: string, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${source}: ${field} must be a positive number`);
  }
}

function requireStringArray(value: unknown, source: string, field: string): void {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${source}: ${field} must be a non-empty string array`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
