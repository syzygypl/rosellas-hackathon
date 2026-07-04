import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from starlette.middleware.cors import CORSMiddleware

from app.core.config import config
from app.core.logger import setup_logging
from app.tools import register as register_tools

setup_logging(config.LOG_LEVEL)


mcp = FastMCP(
    "SCAMPER MCP Server",
    stateless_http=True,
    json_response=True,
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=config.MCP_DNS_REBINDING_PROTECTION,
        allowed_hosts=config.allowed_hosts,
        allowed_origins=config.allowed_origins,
    ),
)

# ---------------------------------------------------------------------------
# Register tools
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
