FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_PYTHON_DOWNLOADS=0
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8080

WORKDIR /app

COPY apps/triz-mcp-server/pyproject.toml apps/triz-mcp-server/uv.lock apps/triz-mcp-server/README.md ./
RUN uv sync --locked --no-install-project

COPY apps/triz-mcp-server/app ./app
RUN uv sync --locked

EXPOSE 8080

CMD ["/app/.venv/bin/python", "app/main.py"]
