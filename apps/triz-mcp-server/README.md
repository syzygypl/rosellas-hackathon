# TRIZ MCP Server

Model Context Protocol server exposing TRIZ tools from `pytriz` over Streamable HTTP.

This app is adapted from [mmysior/gdg-mcp-workshop](https://github.com/mmysior/gdg-mcp-workshop). The server is deployed as our own Cloud Run service, but embeddings are delegated to an external OpenAI-compatible API through `EMBEDDING_SERVICE_URL`.

## Local Run

```bash
cp apps/triz-mcp-server/.env.example apps/triz-mcp-server/.env
# edit EMBEDDING_API_KEY
npm run start:mcp
```

The local MCP endpoint is:

```text
http://localhost:8123/mcp
```

## Configuration

| var | local default | Cloud Run default | meaning |
|-----|---------------|-------------------|---------|
| `MCP_HOST` | `0.0.0.0` | `0.0.0.0` | bind address |
| `MCP_PORT` | `8123` | `8080` | HTTP port |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | `text-embedding-3-small` | OpenAI-compatible embedding model |
| `EMBEDDING_SERVICE_URL` | `https://api.openai.com/v1` | `https://api.openai.com/v1` | OpenAI-compatible `/v1` base URL |
| `EMBEDDING_API_KEY` | required | GitHub secret | API key/token for the embeddings endpoint |
| `OPENAI_API_KEY` | optional fallback | optional fallback | standard OpenAI API key env name |
| `OPEN_AI_API_KEY` | optional fallback | optional fallback | accepted local typo-compatible fallback |

## Exposed Tools

- `browse_contradiction_matrix`
- `search_parameter`
- `search_principle`
- `get_random_principles`
- `get_principle_by_id`
- `get_parameter_by_id`
