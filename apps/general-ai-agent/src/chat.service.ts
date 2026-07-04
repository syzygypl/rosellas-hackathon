import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AgentService, AgentToolCall, SolutionDirection } from './agent.service';
import { SolverService } from './solver.service';
import { TrizMcpService, TrizParameter } from './triz-mcp.service';
import { LangfuseTracingService } from './langfuse-tracing.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

/** Structured payload for the side "solutions" panel in the UI. */
export interface ChatSolution {
  title: string;
  /** 1-2 plain sentences about the problem, in the conversation language (agent path only). */
  summary?: string;
  /** Humanized solution directions written by the LLM (agent path only). */
  directions?: SolutionDirection[];
  /** Suggested next steps for the user (agent path only). */
  nextSteps?: string[];
  parameters: TrizParameter[];
  contradiction: string | null;
  principles: string;
  related: string;
  trail: string[];
  /** Full agent report (markdown) when the chat answer is a compressed summary. */
  report?: string;
}

export interface ChatResult {
  answer: string;
  engine: 'agent' | 'pipeline';
  solution: ChatSolution | null;
  warning?: string;
  /** Optional quick-reply options rendered as buttons under the assistant question. */
  suggestions?: string[];
}

/**
 * Interactive chat over the TRIZ solver. With OPENAI_API_KEY the Deep Agent
 * handles the whole conversation (multi-turn, follow-ups). Without it, each
 * user turn is treated as a (refined) problem statement and routed through
 * the LLM-free deterministic pipeline.
 * Either way the response carries a ChatSolution for the side panel.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly agent: AgentService,
    private readonly solver: SolverService,
    private readonly triz: TrizMcpService,
    private readonly tracing: LangfuseTracingService,
  ) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    return this.tracing.trace(
      'api.chat',
      {
        input: req,
        metadata: { route: 'POST /api/chat', messageCount: req.messages?.length ?? 0 },
        tags: ['api', 'chat'],
      },
      async () => {
        const messages = (req.messages || []).filter((m) => m?.content?.trim());
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        if (!lastUser) {
          return {
            answer: 'Opisz swój problem techniczny, a poszukam rozwiązań TRIZ.',
            engine: 'pipeline',
            solution: null,
          };
        }

        if (this.agent.isConfigured()) {
          try {
            return await this.agentChat(messages, lastUser.content);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Agent chat failed: ${message}`, err instanceof Error ? err.stack : undefined);
            throw new ServiceUnavailableException(
              `OpenAI agent failed; refusing silent fallback. ${message}`,
            );
          }
        }
        const result = await this.pipelineChat(messages);
        result.warning = this.agent.configurationError();
        return result;
      },
    );
  }

  // --- Agent path -----------------------------------------------------------

  private async agentChat(messages: ChatMessage[], lastUserContent: string): Promise<ChatResult> {
    // Guided intake: until the problem is understood (or 3 questions were asked),
    // a cheap gate call either lets the solver run or returns ONE clarifying question.
    const questionsAsked = messages.filter((m) => m.role === 'assistant').length;
    if (questionsAsked < 3) {
      const intake = await this.agent.intake(messages);
      if (!intake.complete && intake.question) {
        return { answer: intake.question, engine: 'agent', solution: null, suggestions: intake.suggestions };
      }
    }

    const { answer, toolCalls } = await this.agent.chat(messages);

    // Keep the chat conversational: a long solve report goes to the side panel
    // in full, while the chat bubble gets a compressed summary. In parallel,
    // rewrite the raw tool outputs into a humanized card in the conversation
    // language; the dry tool-call distillation stays as fallback and as the
    // "technical details" section.
    let chatAnswer = answer;
    let report: string | undefined;
    let solution: ChatSolution | null = null;
    if (toolCalls.length) {
      const needsSummary = answer.split(/\s+/).length > 130;
      const [card, summary] = await Promise.all([
        this.agent.composeSolutionCard(messages, toolCalls, answer).catch((err) => {
          this.logger.warn(`Solution card composition failed, using raw card: ${err}`);
          return null;
        }),
        needsSummary
          ? this.agent.summarize(answer).catch((err) => {
              this.logger.warn(`Report summarization failed, sending full answer: ${err}`);
              return null;
            })
          : Promise.resolve(null),
      ]);
      if (summary) {
        chatAnswer = summary;
        report = answer;
      }
      solution = { ...this.solutionFromToolCalls(lastUserContent, toolCalls), report };
      if (card) {
        solution.title = card.title || solution.title;
        solution.summary = card.summary || undefined;
        solution.contradiction = card.contradiction || solution.contradiction;
        solution.directions = card.directions.length ? card.directions : undefined;
        solution.nextSteps = card.nextSteps.length ? card.nextSteps : undefined;
      }
    }

    // Quick replies for the follow-up question the agent usually ends with.
    let suggestions: string[] | undefined;
    try {
      suggestions = await this.agent.suggestReplies(chatAnswer);
    } catch (err) {
      this.logger.warn(`Quick-reply generation failed: ${err}`);
    }

    return { answer: chatAnswer, engine: 'agent', suggestions, solution };
  }

  /** Distill the agent's tool activity into the side-panel structure. */
  private solutionFromToolCalls(problem: string, toolCalls: AgentToolCall[]): ChatSolution {
    const parameters: TrizParameter[] = [];
    const seen = new Set<number>();
    const principles: string[] = [];
    const related: string[] = [];
    let contradiction: string | null = null;

    for (const call of toolCalls) {
      if (call.tool === 'search_parameter') {
        for (const p of this.triz.parseParameters(call.output)) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            parameters.push(p);
          }
        }
      } else if (call.tool === 'browse_contradiction_matrix') {
        if (call.output) principles.push(call.output);
        const imp = this.idList(call.args['improving_params']);
        const pre = this.idList(call.args['preserving_params']);
        if (imp.length && pre.length) {
          const name = (id: number) => {
            const p = parameters.find((x) => x.id === id);
            return p ? `[${id}] ${p.name}` : `[${id}]`;
          };
          contradiction = `Improving ${imp.map(name).join(', ')} vs preserving ${pre.map(name).join(', ')}.`;
        }
      } else if (call.output) {
        related.push(call.output);
      }
    }

    return {
      title: problem.length > 80 ? problem.slice(0, 77) + '…' : problem,
      parameters,
      contradiction,
      principles: principles.join('\n\n'),
      related: related.join('\n\n'),
      trail: toolCalls.map((c) => `${c.tool}(${JSON.stringify(c.args)})`),
    };
  }

  private idList(value: unknown): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (value != null && Number.isFinite(Number(value))) return [Number(value)];
    return [];
  }

  // --- LLM-free fallback path ------------------------------------------------

  private async pipelineChat(messages: ChatMessage[]): Promise<ChatResult> {
    // Join all user turns so refinements ("focus on weight") sharpen the search.
    const problem = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content.trim())
      .join('\n');

    const r = await this.solver.solve({ problem });

    const paramsLine = r.detectedParameters.length
      ? r.detectedParameters.map((p) => `[${p.id}] ${p.name}`).join(', ')
      : 'brak dopasowania';

    const answer = [
      `Przeanalizowałem problem deterministycznym pipeline'em TRIZ (bez LLM).`,
      ``,
      `**Wykryte parametry:** ${paramsLine}`,
      `**Sprzeczność techniczna:** ${r.contradiction}`,
      ``,
      `Zasady wynalazcze z macierzy sprzeczności i powiązane kierunki znajdziesz w panelu rozwiązań obok. ` +
        `Dopisz kolejną wiadomość z doprecyzowaniem (kontekst, ograniczenia), a przeliczę ponownie.`,
    ].join('\n');

    const lastUser = [...messages].reverse().find((m) => m.role === 'user')!;
    return {
      answer,
      engine: 'pipeline',
      solution: {
        title: lastUser.content.length > 80 ? lastUser.content.slice(0, 77) + '…' : lastUser.content,
        parameters: r.detectedParameters,
        contradiction: r.contradiction,
        principles: r.principlesFromMatrix,
        related: r.relatedPrinciples,
        trail: r.trail,
      },
    };
  }
}
