import { Injectable, Logger } from '@nestjs/common';

export interface TrizParameter {
  id: number;
  name: string;
  description: string;
}

/**
 * Thin JSON-RPC client for the TRIZ MCP server (Streamable HTTP).
 * The server runs stateless with JSON responses, so a single POST per call
 * is enough — no session handshake required.
 */
@Injectable()
export class TrizMcpService {
  private readonly logger = new Logger(TrizMcpService.name);
  private readonly url = process.env.MCP_URL || 'http://localhost:8123/mcp';
  private rpcId = 0;

  /** Low-level: call an MCP tool and return its plain-text result. */
  private async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const body = {
      jsonrpc: '2.0',
      id: ++this.rpcId,
      method: 'tools/call',
      params: { name, arguments: args },
    };

    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`MCP ${name} failed: HTTP ${res.status} ${await res.text()}`);
    }

    const raw = await res.text();
    const payload = this.parseBody(raw);

    if (payload?.error) {
      throw new Error(`MCP ${name} error: ${JSON.stringify(payload.error)}`);
    }

    const result = payload?.result;
    // Prefer structured output, fall back to text content blocks.
    if (result?.structuredContent?.result != null) {
      return String(result.structuredContent.result);
    }
    const text = result?.content?.map((c: any) => c.text).filter(Boolean).join('\n');
    return text ?? '';
  }

  /** Accept both plain JSON and SSE ("data: {...}") framed responses. */
  private parseBody(raw: string): any {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
    // SSE framing: find the last "data:" line and parse it.
    const dataLines = trimmed
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim());
    if (dataLines.length) {
      return JSON.parse(dataLines[dataLines.length - 1]);
    }
    throw new Error(`Unexpected MCP response: ${raw.slice(0, 200)}`);
  }

  /** Parse "• [16] Name\n  description" blocks into structured parameters. */
  private parseParameters(text: string): TrizParameter[] {
    const params: TrizParameter[] = [];
    const lines = text.split('\n');
    let current: TrizParameter | null = null;
    for (const line of lines) {
      const header = line.match(/^[•\-\*]?\s*\[(\d+)\]\s*(.+)$/);
      if (header) {
        if (current) params.push(current);
        current = { id: Number(header[1]), name: header[2].trim(), description: '' };
      } else if (current && line.trim()) {
        current.description += (current.description ? ' ' : '') + line.trim();
      }
    }
    if (current) params.push(current);
    return params;
  }

  // --- Public, domain-friendly wrappers -----------------------------------

  async searchParameter(query: string, limit = 5): Promise<TrizParameter[]> {
    const text = await this.callTool('search_parameter', { query, limit });
    return this.parseParameters(text);
  }

  async searchPrinciple(query: string, limit = 5): Promise<string> {
    return this.callTool('search_principle', { query, limit });
  }

  async browseContradictionMatrix(
    improvingParams: number[],
    preservingParams: number[],
  ): Promise<string> {
    return this.callTool('browse_contradiction_matrix', {
      improving_params: improvingParams,
      preserving_params: preservingParams,
    });
  }

  async getPrincipleById(id: number): Promise<string> {
    return this.callTool('get_principle_by_id', { principle_id: id });
  }
}
