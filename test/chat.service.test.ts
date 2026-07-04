import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService } from '../src/chat.service';

function makeService(agentOverrides: Record<string, unknown>) {
  const agent = {
    isConfigured: () => true,
    configurationError: () => 'missing key',
    intake: async () => ({ complete: true, question: '' }),
    chat: async () => ({ answer: '', toolCalls: [] }),
    summarize: async () => '',
    ...agentOverrides,
  };
  const solver = {
    solve: async () => {
      throw new Error('solver should not be called in agent tests');
    },
  };
  const triz = {
    parseParameters: (text: string) =>
      text.includes('[7]')
        ? [{ id: 7, name: 'Volume of moving object', description: 'flow volume' }]
        : [],
  };

  return {
    service: new ChatService(agent as any, solver as any, triz as any),
    agent,
  };
}

test('agent intake asks a first clarification before solving', async () => {
  let solveCalls = 0;
  const { service } = makeService({
    intake: async () => ({
      complete: false,
      question: 'Czy dobrze rozumiem: chcesz zwiększyć przepustowość bez pogorszenia jakości zrzutu?',
    }),
    chat: async () => {
      solveCalls += 1;
      return { answer: 'should not solve yet', toolCalls: [] };
    },
  });

  const result = await service.chat({
    messages: [
      {
        role: 'user',
        content:
          'Cities produce enormous volumes of wastewater daily, and fast-growing cities struggle to treat it safely.',
      },
    ],
  });

  assert.equal(result.engine, 'agent');
  assert.equal(result.solution, null);
  assert.match(result.answer, /Czy dobrze rozumiem/);
  assert.equal(solveCalls, 0);
});

test('tool-backed agent answers are always summarized and full report goes to the side panel', async () => {
  let summarizeCalls = 0;
  const fullReport = [
    'I understand the contradiction as wastewater plants need more throughput but risk harmful discharge.',
    'TRIZ contradiction',
    'Improve [7], preserve [31].',
    'Solution ideas: segmentation, taking out, new dimension, composites.',
  ].join('\n\n');
  const shortSummary =
    'Większa przepustowość nie może pogorszyć jakości zrzutu.\n- **Segmentation** — moduły dzielnicowe.\n- **Taking Out** — odseparuj trudne ścieki.\nPełny raport jest w panelu. Co rozwijamy?';

  const { service } = makeService({
    chat: async () => ({
      answer: fullReport,
      toolCalls: [
        {
          tool: 'search_parameter',
          args: { query: 'wastewater volume' },
          output: '• [7] Volume of moving object — flow volume',
        },
        {
          tool: 'browse_contradiction_matrix',
          args: { improving_params: [7], preserving_params: [31] },
          output: 'Principles: 1, 2, 17, 40',
        },
      ],
    }),
    summarize: async (report: string) => {
      summarizeCalls += 1;
      assert.equal(report, fullReport);
      return shortSummary;
    },
  });

  const result = await service.chat({
    messages: [
      { role: 'user', content: 'Wastewater problem' },
      { role: 'assistant', content: 'Czy dobrze rozumiem kontradykcję?' },
      { role: 'user', content: 'Tak.' },
    ],
  });

  assert.equal(summarizeCalls, 1);
  assert.equal(result.answer, shortSummary);
  assert.equal(result.solution?.report, fullReport);
  assert.equal(result.solution?.principles, 'Principles: 1, 2, 17, 40');
});

test('summarization failures do not leak the full report into chat', async () => {
  const fullReport = 'FULL REPORT '.repeat(40);
  const { service } = makeService({
    chat: async () => ({
      answer: fullReport,
      toolCalls: [
        {
          tool: 'browse_contradiction_matrix',
          args: { improving_params: [7], preserving_params: [31] },
          output: 'Principles: 1, 2, 17, 40',
        },
      ],
    }),
    summarize: async () => {
      throw new Error('summary model unavailable');
    },
  });

  const result = await service.chat({
    messages: [
      { role: 'user', content: 'Wastewater problem' },
      { role: 'assistant', content: 'Czy dobrze rozumiem kontradykcję?' },
      { role: 'user', content: 'Tak.' },
    ],
  });

  assert.notEqual(result.answer, fullReport);
  assert.match(result.answer, /panelu rozwiązań/);
  assert.equal(result.solution?.report, fullReport);
});
