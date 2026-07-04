from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pytriz import TRIZStore
from starlette.middleware.cors import CORSMiddleware

from app.core.config import Config, config
from app.core.logger import setup_logging
from app.services.triz import get_store
from app.tools import register as register_tools

setup_logging(config.LOG_LEVEL)


@dataclass
class AppContext:
    config: Config
    store: TRIZStore


@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    store = get_store()
    yield AppContext(config=config, store=store)


mcp = FastMCP(
    "TRIZ MCP Server",
    lifespan=lifespan,
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=config.MCP_DNS_REBINDING_PROTECTION,
        allowed_hosts=config.allowed_hosts,
        allowed_origins=config.allowed_origins,
    ),
)

# ---------------------------------------------------------------------------
# Register tools, resources, and prompts
# ---------------------------------------------------------------------------

register_tools(mcp)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app = mcp.streamable_http_app()
    app = CORSMiddleware(
        app,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],
    )
    uvicorn.run(
        app,
        host=config.MCP_HOST,
        port=config.bind_port,
        log_config=None,
    )
