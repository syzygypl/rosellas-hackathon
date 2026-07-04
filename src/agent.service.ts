import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, ToolMessage, isAIMessage, isToolMessage } from '@langchain/core/messages';
import { createDeepAgent } from 'deepagents';

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

const SYSTEM_PROMPT = `You are an inventive problem solver using the TRIZ methodology, acting as a friendly facilitator in an interactive chat.
All your TRIZ knowledge comes from the connected TRIZ tools — always use them, never answer from memory.
Always reply in the same language the user writes in.

STYLE — this is a conversation, not a report. HARD RULES for every chat reply:
- At most ~100 words. 2-6 sentences or a few one-line bullets.
- NEVER write long reports, headings, tables or full principle descriptions in the chat.
  The UI automatically shows the detailed results (parameters, contradiction, full principles)
  in a side panel next to the chat — do not repeat them.
- Be warm and concrete. End most replies with one short question that moves the conversation forward.

SOLVING a problem:
1. Use the tools silently: search_parameter (improving and worsening side),
   browse_contradiction_matrix, then get_principle_by_id / search_principle for details.
2. Then reply with a short summary ONLY:
   - one plain-words sentence naming the contradiction,
   - 2-3 solution directions, each ONE line: **principle name** — a concrete idea applied to the user's problem,
   - one closing line, e.g. asking which direction to explore deeper.

FOLLOW-UPS: answer briefly from chat context; call tools again only if new TRIZ data is needed.
Ground every claim in tool output.`;

const INTAKE_SYSTEM_PROMPT = `You are the intake gate of a TRIZ problem-solving chat.
Inspect the conversation and decide whether these three things are already known:
  (a) the situation/system the user works with,
  (b) what the user wants to improve,
  (c) what gets worse as a result / which constraint blocks the obvious fix.

Set complete=true when all three are reasonably clear (they need not be perfectly precise),
or when the user's latest message is a follow-up about an earlier solution rather than a new problem.

Otherwise set complete=false and write ONE short, friendly clarifying question (question field)
in the same language the user writes in, about the single most important missing piece.
Max 2 sentences; you may add 2-4 very short example options as bullets. Ask about one thing only.`;

const SUMMARY_SYSTEM_PROMPT = `You compress TRIZ solution reports into short chat messages.
Write in the same language as the report. Maximum ~80 words, structured as:
1. one plain-words sentence naming the contradiction,
2. 2-3 solution directions, each exactly ONE line: **principle name** — concrete idea,
3. one short closing question (e.g. which direction to explore deeper).
No headings, no horizontal rules, no tables. Mention that the full report is in the side panel.`;

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
  },
  required: ['complete', 'question'],
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
  private intakeModel: { invoke(input: unknown): Promise<unknown> } | null = null;
  private lightModel: ChatOpenAI | null = null;

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
    const { answer, toolCalls } = await this.chat([{ role: 'user', content: problem }]);
    return { problem, answer, toolCalls };
  }

  /**
   * Intake gate: a cheap, tool-free structured-output call deciding whether the
   * problem is understood well enough to solve. Returns a clarifying question
   * to hand back to the user when it is not. Deterministic control flow lives
   * in ChatService — the LLM only judges completeness and phrases the question.
   */
  async intake(
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ complete: boolean; question: string }> {
    if (!this.intakeModel) {
      this.intakeModel = new ChatOpenAI({
        model: this.model,
        reasoning: { effort: 'none' as any },
        useResponsesApi: true,
      }).withStructuredOutput(INTAKE_SCHEMA as any, { name: 'intake' });
    }
    const result = (await this.intakeModel.invoke([
      { role: 'system', content: INTAKE_SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ])) as { complete?: boolean; question?: string };

    const complete = Boolean(result?.complete);
    this.logger.log(`Intake: complete=${complete}${complete ? '' : ` question="${result?.question}"`}`);
    return { complete, question: String(result?.question ?? '') };
  }

  /** Compress a long solution report into a short chat-friendly summary. */
  async summarize(report: string): Promise<string> {
    if (!this.lightModel) {
      this.lightModel = new ChatOpenAI({
        model: this.model,
        reasoning: { effort: 'none' as any },
        useResponsesApi: true,
      });
    }
    const res = await this.lightModel.invoke([
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: report },
    ]);
    const text = this.contentToText(res.content);
    this.logger.log(`Summarized report: ${report.length} -> ${text.length} chars`);
    return text;
  }

  /** Run the agent over a full chat history (multi-turn). */
  async chat(
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ answer: string; toolCalls: AgentToolCall[] }> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(this.configurationError());
    }

    const agent = await this.getAgent();
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    this.logger.log(`Agent chatting (${history.length} message(s)): "${lastUser?.content ?? ''}"`);

    const result = await agent.invoke({
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });

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
