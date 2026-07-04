export interface HostedDefinition {
  evaluators: any[];
  rules: any[];
}

export function buildHostedDefinitions(options: { enable: boolean }): HostedDefinition {
  const modelConfig =
    process.env.LANGFUSE_EVAL_PROVIDER && process.env.LANGFUSE_EVAL_MODEL
      ? { provider: process.env.LANGFUSE_EVAL_PROVIDER, model: process.env.LANGFUSE_EVAL_MODEL }
      : null;

  const observationFilter = [
    { type: 'string', column: 'name', operator: '=', value: 'eval.scenario' },
    { type: 'arrayOptions', column: 'tags', operator: 'any of', value: ['rosellas-eval'] },
  ];

  return {
    evaluators: [
      {
        type: 'llm_as_judge',
        name: 'rosellas.solution_quality',
        prompt: [
          'Evaluate the Rosellas TRIZ response.',
          '',
          'Scenario input:',
          '{{input}}',
          '',
          'Agent output:',
          '{{output}}',
          '',
          'Score 0 to 1 for: problem fit, TRIZ grounding, feasibility and safety, and compact usefulness.',
        ].join('\n'),
        outputDefinition: {
          dataType: 'NUMERIC',
          reasoning: { description: 'Briefly explain the score.' },
          score: { description: 'Overall solution quality from 0 to 1.' },
        },
        modelConfig,
      },
      {
        type: 'code',
        name: 'rosellas.chat_contract',
        sourceCodeLanguage: 'TYPESCRIPT',
        sourceCode: [
          'function evaluate(ctx: EvaluationContext): EvaluationResult {',
          '  const output = ctx.observation.output || {};',
          '  const hasAnswer = typeof output.chat?.answer === "string" || typeof output.answer === "string";',
          '  const hasSolution = Boolean(output.chat?.solution || output.solution);',
          '  const engine = output.chat?.engine || output.engine;',
          '  return {',
          '    scores: [',
          '      { name: "chat_contract_has_answer", value: hasAnswer, dataType: "BOOLEAN" },',
          '      { name: "chat_contract_has_solution", value: hasSolution, dataType: "BOOLEAN" },',
          '      { name: "chat_contract_has_engine", value: Boolean(engine), dataType: "BOOLEAN" }',
          '    ]',
          '  };',
          '}',
        ].join('\n'),
      },
    ],
    rules: [
      {
        name: 'rosellas.solution_quality.eval_scenario',
        evaluator: { name: 'rosellas.solution_quality', scope: 'project', type: 'llm_as_judge' },
        target: 'observation',
        enabled: options.enable,
        sampling: 1,
        filter: observationFilter,
        mapping: [
          { variable: 'input', source: 'input' },
          { variable: 'output', source: 'output' },
        ],
      },
      {
        name: 'rosellas.chat_contract.eval_scenario',
        evaluator: { name: 'rosellas.chat_contract', scope: 'project', type: 'code' },
        target: 'observation',
        enabled: options.enable,
        sampling: 1,
        filter: observationFilter,
      },
    ],
  };
}

export async function pushHostedDefinitions(options: { dryRun: boolean; enable: boolean }): Promise<void> {
  const definitions = buildHostedDefinitions({ enable: options.enable });

  if (options.dryRun) {
    console.log(JSON.stringify(definitions, null, 2));
    return;
  }

  for (const evaluator of definitions.evaluators) {
    const created = await langfusePublicApi('/unstable/evaluators', 'POST', evaluator);
    console.log(`created evaluator ${created.name} v${created.version}`);
  }
  for (const rule of definitions.rules) {
    const existing = await findExistingRule(rule.name);
    const created = existing
      ? await langfusePublicApi(`/unstable/evaluation-rules/${existing.id}`, 'PUT', rule)
      : await langfusePublicApi('/unstable/evaluation-rules', 'POST', rule);
    console.log(`${existing ? 'updated' : 'created'} rule ${created.name} (${created.enabled ? 'enabled' : 'inactive'})`);
  }
}

async function findExistingRule(name: string): Promise<{ id: string; name: string } | undefined> {
  const rules = await langfusePublicApi('/unstable/evaluation-rules?limit=100', 'GET');
  return Array.isArray(rules.data) ? rules.data.find((rule: any) => rule.name === name) : undefined;
}

async function langfusePublicApi(path: string, method: string, body?: unknown): Promise<any> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    throw new Error('LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are required unless --dry-run is used.');
  }

  const baseUrl = (process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/api/public${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Langfuse ${method} ${path} failed with ${response.status}: ${text.slice(0, 800)}`);
  }

  return response.json();
}
