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

const SYSTEM_PROMPT = `You are an inventive problem solver using the TRIZ methodology, working as a friendly facilitator in an interactive chat.
All your TRIZ knowledge comes from the connected TRIZ tools — always use them, never answer from memory.
Always reply in the same language the user writes in.

PHASE 1 — UNDERSTAND THE PROBLEM (no tools yet).
Before solving, make sure you know three things:
  (a) the situation/system the user works with,
  (b) what they want to improve,
  (c) what gets worse as a result / what constraint blocks the obvious fix.
If any of these is missing or vague, ask ONE short clarifying question at a time (max 3 questions total).
Do not call any tools and do not propose solutions during this phase.
Skip questions whose answers are already clear from the conversation — if the first message
already contains (a)-(c), go straight to Phase 2.

PHASE 2 — SOLVE. When (a)-(c) are clear:
1. Briefly restate the problem as you understood it (one sentence).
2. Identify the engineering parameters behind the problem (search_parameter) — what improves and what worsens.
3. Look up the technical contradiction in the contradiction matrix (browse_contradiction_matrix) to get the recommended inventive principles.
4. Retrieve the details of each recommended principle (get_principle_by_id / search_principle).
5. Write a report: state the contradiction (improving vs. worsening parameter), list the inventive principles found, and propose 2-3 concrete solution ideas applying them to the user's problem.

FOLLOW-UPS: when the user asks about an earlier solution (clarification, comparison, "tell me more"),
answer conversationally from the context of the chat — only call tools again if new TRIZ data is needed.

Ground every claim in tool output.`;

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

  /** Run the agent over a full chat history (multi-turn). */
  async chat(
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ answer: string; toolCalls: AgentToolCall[] }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException(
        'Deep Agent endpoint requires OPENAI_API_KEY to be set (see .env.example). The LLM-free /api/solve endpoint remains available.',
      );
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
