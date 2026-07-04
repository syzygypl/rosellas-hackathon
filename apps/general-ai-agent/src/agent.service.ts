import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, ToolMessage, isAIMessage, isToolMessage } from '@langchain/core/messages';
import { createDeepAgent } from 'deepagents';
import { loadPrompt } from './prompt-loader';
import { LangfuseTracingService } from './langfuse-tracing.service';

export interface AgentToolCall {
  tool: string;
  args: Record<string, unknown>;
  output: string;
}

export interface AgentSolveResult {
  problem: string;
  answer: string;
  toolCalls: AgentToolCall[];
}

/** One humanized solution direction on the side-panel card. */
export interface SolutionDirection {
  principle: string;
  idea: string;
  example?: string;
}

/** Humanized side-panel card, written by the LLM in the conversation language. */
export interface SolutionCard {
  title: string;
  summary: string;
  contradiction: string;
  directions: SolutionDirection[];
  nextSteps: string[];
}

const SYSTEM_PROMPT = loadPrompt('agent-system.md');
const INTAKE_SYSTEM_PROMPT = loadPrompt('intake-system.md');
const SUMMARY_SYSTEM_PROMPT = loadPrompt('summary-system.md');
const SUGGEST_SYSTEM_PROMPT = loadPrompt('suggest-system.md');
const CARD_SYSTEM_PROMPT = loadPrompt('card-system.md');

const CARD_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'short human title for the problem, max ~8 words, in the user language',
    },
    summary: {
      type: 'string',
      description: '1-2 plain sentences: what we understood about the problem and its goal',
    },
    contradiction: {
      type: 'string',
      description:
        'the core trade-off in plain everyday words ("the more X, the worse Y"); empty string when none',
    },
    directions: {
      type: 'array',
      description: '2-4 solution directions grounded in the provided tool outputs',
      items: {
        type: 'object',
        properties: {
          principle: {
            type: 'string',
            description: 'inventive principle number and translated name, e.g. "Zasada 1 — Segmentacja"',
          },
          idea: {
            type: 'string',
            description: "1-2 sentences applying the principle concretely to the user's problem",
          },
          example: {
            type: 'string',
            description: 'one short real-world example of the principle; empty string if none',
          },
        },
        required: ['principle', 'idea', 'example'],
        additionalProperties: false,
      },
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
      description: '1-3 short concrete next steps for the user',
    },
  },
  required: ['title', 'summary', 'contradiction', 'directions', 'nextSteps'],
  additionalProperties: false,
} as const;

/** Cap each raw tool output handed to the card writer so the call stays cheap. */
const CARD_TOOL_OUTPUT_LIMIT = 4000;

const SUGGEST_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      description:
        '2-4 short, self-contained quick replies to the assistant question; empty array when the message asks nothing',
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
} as const;

const INTAKE_SCHEMA = {
  type: 'object',
  properties: {
    complete: {
      type: 'boolean',
      description: 'true when (a), (b) and (c) are known or the last message is a follow-up',
    },
    question: {
      type: 'string',
      description: 'the single clarifying question to ask when complete=false; empty string otherwise',
    },
    suggestions: {
      type: 'array',
      items: { type: 'string' },
      description:
        '2-4 short, clickable answer options for the question (a few words each, in the user language); empty array when complete=true or when no sensible options exist',
    },
  },
  required: ['complete', 'question', 'suggestions'],
  additionalProperties: false,
} as const;

/**
 * Agentic solving path: a LangChain Deep Agent whose tools are discovered
 * dynamically from the TRIZ MCP server (tools/list) — nothing is hardcoded.
 * Complements the deterministic SolverService pipeline; requires OPENAI_API_KEY.
 */
@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly mcpUrl = process.env.MCP_URL || 'http://localhost:8123/mcp';
  private readonly model = process.env.OPENAI_MODEL || 'gpt-5.5';
  private readonly reasoningEffort = (process.env.OPENAI_REASONING_EFFORT ||
    'low') as 'minimal' | 'low' | 'medium' | 'high';
  private agentPromise: Promise<ReturnType<typeof createDeepAgent>> | null = null;
  private intakeModel: { invoke(input: unknown, options?: unknown): Promise<unknown> } | null = null;
  private suggestModel: { invoke(input: unknown, options?: unknown): Promise<unknown> } | null = null;
  private cardModel: { invoke(input: unknown, options?: unknown): Promise<unknown> } | null = null;
  private lightModel: ChatOpenAI | null = null;

  constructor(private readonly tracing: LangfuseTracingService) {}

  isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim());
  }

  configurationError(): string {
    return [
      'OpenAI agent is disabled because OPENAI_API_KEY is not set.',
      'Set OPENAI_API_KEY in .env or in the process environment to enable the agent.',
      `Current agent config: OPENAI_MODEL=${this.model}, OPENAI_REASONING_EFFORT=${this.reasoningEffort}, MCP_URL=${this.mcpUrl}.`,
      'The LLM-free /api/solve pipeline remains available.',
    ].join(' ');
  }

  /** Build the MCP client + agent once, reuse across requests. */
  private getAgent() {
    if (!this.agentPromise) {
      this.agentPromise = this.buildAgent().catch((err) => {
        this.agentPromise = null; // allow retry on next request
        throw err;
      });
    }
    return this.agentPromise;
  }

  private async buildAgent() {
    const client = new MultiServerMCPClient({
      mcpServers: {
        triz: { transport: 'http', url: this.mcpUrl },
      },
    });
    const tools = await client.getTools();
    this.logger.log(
      `Loaded ${tools.length} tool(s) from TRIZ MCP: ${tools.map((t) => t.name).join(', ')}`,
    );
    return createDeepAgent({
      // reasoning.effort is ignored by non-reasoning models, so safe unconditionally.
      // GPT-5.x rejects tools + reasoning_effort on /v1/chat/completions — force Responses API.
      model: new ChatOpenAI({
        model: this.model,
        reasoning: { effort: this.reasoningEffort },
        useResponsesApi: true,
      }),
      tools,
      systemPrompt: SYSTEM_PROMPT,
    });
  }

  async solve(problem: string): Promise<AgentSolveResult> {
    return this.tracing.trace(
      'agent.solve',
      {
        input: { problem },
        metadata: { route: 'POST /api/agent/solve', model: this.model, reasoningEffort: this.reasoningEffort },
        tags: ['api', 'agent', 'solve'],
        type: 'agent',
      },
      async () => {
        const { answer, toolCalls } = await this.chat([{ role: 'user', content: problem }]);
        return { problem, answer, toolCalls };
      },
    );
  }

  /**
   * Intake gate: a cheap, tool-free structured-output call deciding whether the
   * problem is understood well enough to solve. Returns a clarifying question
   * to hand back to the user when it is not. Deterministic control flow lives
   * in ChatService — the LLM only judges completeness and phrases the question.
   */
  async intake(
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ complete: boolean; question: string; suggestions: string[] }> {
    return this.tracing.trace(
      'agent.intake',
      {
        input: { history },
        metadata: { model: this.model, messageCount: history.length },
        tags: ['agent', 'intake'],
        type: 'chain',
      },
      async () => {
        if (!this.intakeModel) {
          this.intakeModel = new ChatOpenAI({
            model: this.model,
            reasoning: { effort: 'none' as any },
            useResponsesApi: true,
          }).withStructuredOutput(INTAKE_SCHEMA as any, { name: 'intake' });
        }
        const result = (await this.intakeModel.invoke(
          [
            { role: 'system', content: INTAKE_SYSTEM_PROMPT },
            ...history.map((m) => ({ role: m.role, content: m.content })),
          ],
          this.tracing.langchainConfig('agent.intake.llm', ['agent', 'intake'], {
            model: this.model,
            messageCount: history.length,
          }),
        )) as { complete?: boolean; question?: string; suggestions?: unknown[] };

        const complete = Boolean(result?.complete);
        const suggestions = (Array.isArray(result?.suggestions) ? result.suggestions : [])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .slice(0, 4);
        this.logger.log(
          `Intake: complete=${complete}${complete ? '' : ` question="${result?.question}" suggestions=${JSON.stringify(suggestions)}`}`,
        );
        return { complete, question: String(result?.question ?? ''), suggestions };
      },
    );
  }

  /**
   * Quick replies: given the assistant's final chat message, generate 2-4
   * clickable answer options when that message asks the user a question.
   */
  async suggestReplies(answer: string): Promise<string[]> {
    return this.tracing.trace(
      'agent.suggest_replies',
      {
        input: { answer },
        metadata: { model: this.model, answerLength: answer.length },
        tags: ['agent', 'suggestions'],
        type: 'chain',
      },
      async () => {
        if (!this.suggestModel) {
          this.suggestModel = new ChatOpenAI({
            model: this.model,
            reasoning: { effort: 'none' as any },
            useResponsesApi: true,
          }).withStructuredOutput(SUGGEST_SCHEMA as any, { name: 'quick_replies' });
        }
        const result = (await this.suggestModel.invoke(
          [
            { role: 'system', content: SUGGEST_SYSTEM_PROMPT },
            { role: 'user', content: answer },
          ],
          this.tracing.langchainConfig('agent.suggest_replies.llm', ['agent', 'suggestions'], {
            model: this.model,
            answerLength: answer.length,
          }),
        )) as { suggestions?: unknown[] };

        const suggestions = (Array.isArray(result?.suggestions) ? result.suggestions : [])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .slice(0, 4);
        this.logger.log(`Quick replies: ${JSON.stringify(suggestions)}`);
        return suggestions;
      },
    );
  }

  /**
   * Humanize the side-panel card: rewrite the raw tool outputs into a card in
   * the conversation language — plain-words contradiction, solution directions
   * applied to the user's problem, next steps. Grounded in the tool outputs.
   */
  async composeSolutionCard(
    history: { role: 'user' | 'assistant'; content: string }[],
    toolCalls: AgentToolCall[],
    answer: string,
  ): Promise<SolutionCard> {
    return this.tracing.trace(
      'agent.compose_solution_card',
      {
        input: { history, toolCalls, answer },
        metadata: { model: this.model, messageCount: history.length, toolCallCount: toolCalls.length },
        tags: ['agent', 'solution-card'],
        type: 'chain',
      },
      async () => {
        if (!this.cardModel) {
          this.cardModel = new ChatOpenAI({
            model: this.model,
            reasoning: { effort: 'none' as any },
            useResponsesApi: true,
          }).withStructuredOutput(CARD_SCHEMA as any, { name: 'solution_card' });
        }

        const problem = history
          .filter((m) => m.role === 'user')
          .map((m) => m.content.trim())
          .join('\n');
        const toolDump = toolCalls
          .map((c) => `### ${c.tool}(${JSON.stringify(c.args)})\n${c.output.slice(0, CARD_TOOL_OUTPUT_LIMIT)}`)
          .join('\n\n');

        const result = (await this.cardModel.invoke(
          [
            { role: 'system', content: CARD_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                `## User problem (their own words)`,
                problem,
                ``,
                `## Assistant final answer`,
                answer,
                ``,
                `## Raw TRIZ tool outputs`,
                toolDump,
              ].join('\n'),
            },
          ],
          this.tracing.langchainConfig('agent.compose_solution_card.llm', ['agent', 'solution-card'], {
            model: this.model,
            messageCount: history.length,
            toolCallCount: toolCalls.length,
          }),
        )) as Partial<SolutionCard> & { directions?: unknown[]; nextSteps?: unknown[] };

        const directions = (Array.isArray(result?.directions) ? result.directions : [])
          .map((d) => {
            const dir = d as Partial<SolutionDirection>;
            return {
              principle: String(dir?.principle ?? '').trim(),
              idea: String(dir?.idea ?? '').trim(),
              example: String(dir?.example ?? '').trim() || undefined,
            };
          })
          .filter((d) => d.principle && d.idea)
          .slice(0, 4);
        const nextSteps = (Array.isArray(result?.nextSteps) ? result.nextSteps : [])
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
          .slice(0, 3);

        const card: SolutionCard = {
          title: String(result?.title ?? '').trim(),
          summary: String(result?.summary ?? '').trim(),
          contradiction: String(result?.contradiction ?? '').trim(),
          directions,
          nextSteps,
        };
        this.logger.log(
          `Solution card: "${card.title}" with ${card.directions.length} direction(s), ${card.nextSteps.length} next step(s)`,
        );
        return card;
      },
    );
  }

  /** Compress a long solution report into a short chat-friendly summary. */
  async summarize(report: string): Promise<string> {
    return this.tracing.trace(
      'agent.summarize',
      {
        input: { report },
        metadata: { model: this.model, reportLength: report.length },
        tags: ['agent', 'summarize'],
        type: 'chain',
      },
      async () => {
        if (!this.lightModel) {
          this.lightModel = new ChatOpenAI({
            model: this.model,
            reasoning: { effort: 'none' as any },
            useResponsesApi: true,
          });
        }
        const res = await this.lightModel.invoke(
          [
            { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: report },
          ],
          this.tracing.langchainConfig('agent.summarize.llm', ['agent', 'summarize'], {
            model: this.model,
            reportLength: report.length,
          }),
        );
        const text = this.contentToText(res.content);
        this.logger.log(`Summarized report: ${report.length} -> ${text.length} chars`);
        return text;
      },
    );
  }

  /** Run the agent over a full chat history (multi-turn). */
  async chat(
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ answer: string; toolCalls: AgentToolCall[] }> {
    return this.tracing.trace(
      'agent.chat',
      {
        input: { history },
        metadata: {
          model: this.model,
          reasoningEffort: this.reasoningEffort,
          messageCount: history.length,
        },
        tags: ['agent', 'chat'],
        type: 'agent',
      },
      async () => {
        if (!this.isConfigured()) {
          throw new ServiceUnavailableException(this.configurationError());
        }

        const agent = await this.getAgent();
        const lastUser = [...history].reverse().find((m) => m.role === 'user');
        this.logger.log(`Agent chatting (${history.length} message(s)): "${lastUser?.content ?? ''}"`);

        const result = await agent.invoke(
          {
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          },
          this.tracing.langchainConfig('agent.chat.langchain', ['agent', 'chat'], {
            model: this.model,
            reasoningEffort: this.reasoningEffort,
            messageCount: history.length,
          }),
        );

        // Pair each AI tool_call with the ToolMessage carrying its output.
        const messages: unknown[] = (result as any).messages ?? [];
        const outputsByCallId = new Map<string, string>();
        for (const m of messages) {
          if (isToolMessage(m as any)) {
            const tm = m as ToolMessage;
            outputsByCallId.set(String(tm.tool_call_id), this.contentToText(tm.content));
          }
        }

        const toolCalls: AgentToolCall[] = [];
        let answer = '';
        for (const m of messages) {
          if (!isAIMessage(m as any)) continue;
          const ai = m as AIMessage;
          for (const call of ai.tool_calls ?? []) {
            const output = outputsByCallId.get(String(call.id)) ?? '';
            this.logger.log(`Tool call: ${call.name}(${JSON.stringify(call.args)})`);
            toolCalls.push({ tool: call.name, args: call.args as Record<string, unknown>, output });
          }
          const text = this.contentToText(ai.content);
          if (text) answer = text; // last non-empty AI message wins
        }

        this.logger.log(`Agent finished: ${toolCalls.length} tool call(s).`);
        return { answer, toolCalls };
      },
    );
  }

  private contentToText(content: unknown): string {
    if (typeof content === 'string') {
      // MCP tool outputs arrive as JSON-serialized content blocks — unwrap them.
      if (content.startsWith('{') || content.startsWith('[')) {
        try {
          return this.contentToText(JSON.parse(content));
        } catch {
          return content;
        }
      }
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((block) => this.contentToText(block))
        .filter(Boolean)
        .join('\n');
    }
    if (content && typeof content === 'object' && 'text' in (content as any)) {
      return String((content as any).text ?? '');
    }
    return '';
  }
}
