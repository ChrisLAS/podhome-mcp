"""PodHome MCP Server - Main Entry Point."""

import logging
import signal
import sys

from fastmcp import FastMCP

from .config import load_config
from .tools import register_tools

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    """Main entry point for the PodHome MCP server."""
    config = load_config()
    mcp = FastMCP("podhome")
    register_tools(mcp, config)

    logger.info(
        "Podhome MCP server started (stdio) — shows: %s", list(config.shows.keys())
    )

    def handle_shutdown(signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info("Shutdown signal received")
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
