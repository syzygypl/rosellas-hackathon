# SCAMPER MCP Server

Model Context Protocol server exposing the SCAMPER ideation method over Streamable HTTP. It mirrors the structure of `apps/triz-mcp-server`, but the knowledge base is a static set of seven SCAMPER lenses, so no embeddings API is needed.

The `general-ai-agent` backend connects to this server (via `SCAMPER_MCP_URL`) alongside the TRIZ MCP server and picks the best solution between the two methods.

## Local Run

```bash
npm run start:scamper
```

No configuration is required for local use. The local MCP endpoint is:

```text
http://localhost:8124/mcp
```

## Configuration

| var | local default | Cloud Run default | meaning |
|-----|---------------|-------------------|---------|
| `MCP_HOST` | `0.0.0.0` | `0.0.0.0` | bind address |
| `MCP_PORT` | `8124` | `8080` | HTTP port |
| `MCP_ALLOWED_HOSTS` | local hosts | Cloud Run service host | accepted Host headers for MCP DNS rebinding protection |
| `MCP_ALLOWED_ORIGINS` | empty | empty | accepted Origin headers when present |
| `MCP_DNS_REBINDING_PROTECTION` | `true` | `true` | enables MCP transport Host/Origin validation |

## Exposed Tools

- `list_scamper_lenses`
- `get_scamper_lens`
- `get_scamper_checklist`
- `get_random_scamper_questions`
