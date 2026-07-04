import { loadHostedDefinition } from './evaluator-definitions';

export interface HostedDefinition {
  evaluators: any[];
  rules: any[];
}

export function buildHostedDefinitions(options: { enable: boolean }): HostedDefinition {
  const definition = loadHostedDefinition();
  return {
    evaluators: definition.evaluators.map(applyModelConfig),
    rules: definition.rules.map((rule) => ({ ...rule, enabled: options.enable })),
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

function applyModelConfig(evaluator: any): any {
  const copy = { ...evaluator };
  const modelConfigFromEnv = copy.modelConfigFromEnv;
  delete copy.modelConfigFromEnv;
  if (!modelConfigFromEnv) return copy;

  const provider = process.env[modelConfigFromEnv.provider];
  const model = process.env[modelConfigFromEnv.model];
  copy.modelConfig = provider && model ? { provider, model } : null;
  return copy;
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
