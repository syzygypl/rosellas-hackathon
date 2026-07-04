import { Injectable, Logger } from '@nestjs/common';
import { AgentService, AgentToolCall } from './agent.service';
import { SolverService } from './solver.service';
import { TrizMcpService, TrizParameter } from './triz-mcp.service';

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
  ) {}

  async chat(req: ChatRequest): Promise<ChatResult> {
    const messages = (req.messages || []).filter((m) => m?.content?.trim());
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      return { answer: 'Opisz swój problem techniczny, a poszukam rozwiązań TRIZ.', engine: 'pipeline', solution: null };
    }

    if (process.env.OPENAI_API_KEY) {
      try {
        return await this.agentChat(messages, lastUser.content);
      } catch (err) {
        this.logger.warn(`Agent chat failed, falling back to pipeline: ${err}`);
      }
    }
    return this.pipelineChat(messages);
  }

  // --- Agent path -----------------------------------------------------------

  private async agentChat(messages: ChatMessage[], lastUserContent: string): Promise<ChatResult> {
    // Guided intake: until the problem is understood (or 3 questions were asked),
    // a cheap gate call either lets the solver run or returns ONE clarifying question.
    const questionsAsked = messages.filter((m) => m.role === 'assistant').length;
    if (questionsAsked < 3) {
      const intake = await this.agent.intake(messages);
      if (!intake.complete && intake.question) {
        return { answer: intake.question, engine: 'agent', solution: null };
      }
    }

    const { answer, toolCalls } = await this.agent.chat(messages);

    // Keep the chat conversational: a long solve report goes to the side panel
    // in full, while the chat bubble gets a compressed summary.
    let chatAnswer = answer;
    let report: string | undefined;
    if (toolCalls.length && answer.split(/\s+/).length > 130) {
      try {
        chatAnswer = await this.agent.summarize(answer);
        report = answer;
      } catch (err) {
        this.logger.warn(`Report summarization failed, sending full answer: ${err}`);
      }
    }

    return {
      answer: chatAnswer,
      engine: 'agent',
      solution: toolCalls.length
        ? { ...this.solutionFromToolCalls(lastUserContent, toolCalls), report }
        : null,
    };
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
