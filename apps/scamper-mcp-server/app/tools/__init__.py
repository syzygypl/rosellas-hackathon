from mcp.server.fastmcp import FastMCP

from app.tools.lenses import (
    get_random_scamper_questions,
    get_scamper_checklist,
    get_scamper_lens,
    list_scamper_lenses,
)

tools = [
    # Data / retrieval
    list_scamper_lenses,
    get_scamper_lens,
    get_scamper_checklist,
    get_random_scamper_questions,
]


def register(mcp: FastMCP) -> None:
    for tool in tools:
        mcp.tool()(tool)
