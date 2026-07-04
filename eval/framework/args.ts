import type { ParsedArgs } from './types';

export function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    command: (argv[0] as ParsedArgs['command']) || 'help',
    scenarios: [],
    noFail: false,
    requireLlmJudge: false,
    skipLlmJudge: false,
    dryRun: false,
    enable: false,
    maxConcurrency: 1,
  };

  if (!['list', 'run', 'push', 'help', undefined].includes(args.command)) {
    throw new Error(`Unknown command: ${args.command}`);
  }

  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-s' || arg === '--scenario') {
      args.scenarios.push(requireValue(argv, ++i, arg));
    } else if (arg.startsWith('--scenario=')) {
      args.scenarios.push(arg.slice('--scenario='.length));
    } else if (arg === '--run-name') {
      args.runName = requireValue(argv, ++i, arg);
    } else if (arg.startsWith('--run-name=')) {
      args.runName = arg.slice('--run-name='.length);
    } else if (arg === '--backend-url') {
      args.backendUrl = requireValue(argv, ++i, arg);
    } else if (arg.startsWith('--backend-url=')) {
      args.backendUrl = arg.slice('--backend-url='.length);
    } else if (arg === '--max-concurrency') {
      args.maxConcurrency = parsePositiveInt(requireValue(argv, ++i, arg), arg);
    } else if (arg.startsWith('--max-concurrency=')) {
      args.maxConcurrency = parsePositiveInt(arg.slice('--max-concurrency='.length), '--max-concurrency');
    } else if (arg === '--no-fail') {
      args.noFail = true;
    } else if (arg === '--require-llm-judge') {
      args.requireLlmJudge = true;
    } else if (arg === '--skip-llm-judge') {
      args.skipLlmJudge = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--enable') {
      args.enable = true;
    } else if (arg === '-h' || arg === '--help') {
      args.command = 'help';
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (args.requireLlmJudge && args.skipLlmJudge) {
    throw new Error('Use either --require-llm-judge or --skip-llm-judge, not both.');
  }

  return args;
}

export function usage(): string {
  return [
    'Usage:',
    '  npm run eval -- list',
    '  npm run eval -- run [-s id[,id]] [--run-name name] [--no-fail] [--require-llm-judge]',
    '  npm run eval:push -- --dry-run',
    '  npm run eval:push -- --enable',
    '',
    'Environment:',
    '  EVAL_BACKEND_URL=http://localhost:8080/api',
    '  LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL',
    '  OPENAI_API_KEY for optional local LLM judge',
  ].join('\n');
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith('-')) throw new Error(`${option} requires a value`);
  return value;
}

function parsePositiveInt(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer`);
  }
  return parsed;
}
