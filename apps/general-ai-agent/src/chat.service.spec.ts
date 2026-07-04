import 'reflect-metadata';
import { ChatService, ChatSolution } from './chat.service';
import { AgentToolCall } from './agent.service';
import { TrizMcpService } from './triz-mcp.service';

describe('ChatService.solutionFromToolCalls', () => {
  // solutionFromToolCalls only needs triz.parseParameters, which is pure —
  // the agent, solver and tracing dependencies are never touched.
  const service = new ChatService(
    {} as never,
    {} as never,
    new TrizMcpService({} as never),
    {} as never,
  );
  const distill = (problem: string, calls: AgentToolCall[]): ChatSolution =>
    (service as any).solutionFromToolCalls(problem, calls);

  it('distills parameters, contradiction, principles and trail from tool calls', () => {
    const solution = distill('Dron: udźwig vs masa', [
      {
        tool: 'search_parameter',
        args: { query: 'weight' },
        output:
          '• [1] Weight of moving object\n  The mass of the object in a gravitational field.\n' +
          '• [21] Power\n  The rate at which work is performed.',
      },
      {
        tool: 'browse_contradiction_matrix',
        args: { improving_params: [21], preserving_params: [1] },
        output: 'Principle 8 - Anti-weight\nPrinciple 31 - Porous materials',
      },
      {
        tool: 'get_principle_by_id',
        args: { principle_id: 8 },
        output: 'Anti-weight: compensate the weight by merging with objects that provide lift.',
      },
    ]);

    expect(solution.parameters.map((p) => p.id)).toEqual([1, 21]);
    expect(solution.contradiction).toBe(
      'Poprawiamy [21] Power, nie pogarszając [1] Weight of moving object.',
    );
    expect(solution.principles).toContain('Principle 8 - Anti-weight');
    expect(solution.related).toContain('compensate the weight');
    expect(solution.trail).toHaveLength(3);
    expect(solution.trail[0]).toContain('search_parameter');
  });

  it('deduplicates parameters repeated across tool calls', () => {
    const output = '• [1] Weight of moving object\n  The mass of the object.';
    const solution = distill('problem', [
      { tool: 'search_parameter', args: {}, output },
      { tool: 'search_parameter', args: {}, output },
    ]);

    expect(solution.parameters).toHaveLength(1);
  });

  it('truncates long problem statements in the fallback title', () => {
    const solution = distill('x'.repeat(200), []);

    expect(solution.title.length).toBeLessThanOrEqual(80);
    expect(solution.title.endsWith('…')).toBe(true);
  });

  it('keeps the contradiction empty when the matrix was not browsed', () => {
    const solution = distill('problem', [
      { tool: 'search_parameter', args: {}, output: '• [1] Weight\n  desc' },
    ]);

    expect(solution.contradiction).toBeNull();
  });
});
