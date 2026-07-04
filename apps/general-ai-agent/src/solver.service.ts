import { Injectable, Logger } from '@nestjs/common';
import { TrizMcpService, TrizParameter } from './triz-mcp.service';
import { LangfuseTracingService } from './langfuse-tracing.service';

export interface SolveRequest {
  /** The problem statement (free text). This is the only input — TRIZ derives the rest. */
  problem: string;
}

export interface SolveResult {
  problem: string;
  detectedParameters: TrizParameter[];
  contradiction: string;
  improvingParameter: TrizParameter | null;
  worseningParameter: TrizParameter | null;
  principlesFromMatrix: string;
  relatedPrinciples: string;
  trail: string[];
}

const NO_PRINCIPLES = 'No Inventive Principles';

/**
 * Inventive Problem Solver pipeline (from the Miro Event Storming board).
 * Input is just the problem statement — TRIZ derives the technical contradiction
 * itself: the embedding-backed MCP detects the relevant engineering parameters,
 * then we probe the contradiction matrix across parameter pairs to surface the
 * inventive principles. No external LLM required.
 */
@Injectable()
export class SolverService {
  private readonly logger = new Logger(SolverService.name);

  constructor(
    private readonly triz: TrizMcpService,
    private readonly tracing: LangfuseTracingService,
  ) {}

  async solve(req: SolveRequest): Promise<SolveResult> {
    return this.tracing.trace(
      'solver.solve',
      {
        input: req,
        metadata: { route: 'POST /api/solve', engine: 'pipeline' },
        tags: ['solver', 'pipeline'],
        type: 'chain',
      },
      () => this.solveInternal(req),
    );
  }

  private async solveInternal(req: SolveRequest): Promise<SolveResult> {
    const trail: string[] = [];
    const problem = (req.problem || '').trim();

    trail.push(`Problem submitted: "${problem || '(none)'}"`);

    // 1. Detect the TRIZ engineering parameters relevant to the problem.
    const detected = await this.triz.searchParameter(problem, 6);
    trail.push(
      detected.length
        ? `Detected ${detected.length} relevant TRIZ parameter(s): ${detected
            .map((p) => `[${p.id}] ${p.name}`)
            .join(', ')}`
        : 'No TRIZ parameters detected for this problem.',
    );

    // 2. Build the technical contradiction: probe the matrix over ordered pairs
    //    of the most relevant parameters, keep the first pair that yields principles.
    let improvingParameter: TrizParameter | null = null;
    let worseningParameter: TrizParameter | null = null;
    let principlesFromMatrix = 'Could not detect a parameter pair to look up in the matrix.';

    const pairs = this.rankedPairs(detected.slice(0, 4));
    for (const [a, b] of pairs) {
      trail.push(`TRIZ matrix lookup: improving [${a.id}] vs preserving [${b.id}].`);
      const text = await this.triz.browseContradictionMatrix([a.id], [b.id]);
      if (!text.startsWith(NO_PRINCIPLES)) {
        improvingParameter = a;
        worseningParameter = b;
        principlesFromMatrix = text;
        trail.push(`Technical contradiction built and principles found for [${a.id}] vs [${b.id}].`);
        break;
      }
    }

    if (!improvingParameter && detected.length >= 2) {
      // No matrix cell produced principles — still report the top contradiction candidate.
      improvingParameter = detected[0];
      worseningParameter = detected[1];
      principlesFromMatrix =
        'No inventive principles in the matrix for the detected parameter pairs. ' +
        'See related principles below for candidate directions.';
      trail.push('No matrix principles found; falling back to related principles.');
    }

    const contradiction =
      improvingParameter && worseningParameter
        ? `Improving [${improvingParameter.id}] ${improvingParameter.name} tends to worsen [${worseningParameter.id}] ${worseningParameter.name}.`
        : 'Could not build a technical contradiction from the problem.';

    // 3. Related principles as extra candidate directions.
    const relatedPrinciples = await this.triz.searchPrinciple(problem, 5);
    trail.push('Related inventive principles retrieved as extra candidate directions.');
    trail.push('Run completed.');

    return {
      problem,
      detectedParameters: detected,
      contradiction,
      improvingParameter,
      worseningParameter,
      principlesFromMatrix,
      relatedPrinciples,
      trail,
    };
  }

  /** Ordered parameter pairs, prioritised by relevance rank (closest matches first). */
  private rankedPairs(params: TrizParameter[]): [TrizParameter, TrizParameter][] {
    const pairs: [TrizParameter, TrizParameter][] = [];
    for (let span = 1; span < params.length; span++) {
      for (let i = 0; i + span < params.length; i++) {
        const a = params[i];
        const b = params[i + span];
        pairs.push([a, b]); // improving a, preserving b
        pairs.push([b, a]); // and the reverse direction (matrix is not symmetric)
      }
    }
    return pairs;
  }
}
