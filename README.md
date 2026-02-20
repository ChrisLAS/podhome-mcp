# PodHome MCP Server

MCP server for the Podhome Integration API with multi-show support.

## Installation

```bash
cd podhome-mcp
uv sync
```

## Configuration

Set the following environment variables:

- `PODHOME_BASE_URL` - Base URL for the API (default: `https://serve.podhome.fm`)
- `PODHOME_SHOWS` - JSON string mapping show slugs to API keys

Example:
```bash
export PODHOME_SHOWS='{"my-main-podcast": "phk_abc123...", "weekly-tech-show": "phk_xyz789..."}'
```

## Usage

```bash
uv run podhome-mcp
```

The server runs over stdio and is designed to be used with an MCP client like OpenClaw.

## OpenClaw Registration

```json
{
  "agents": {
    "main": {
      "mcpServers": {
        "podhome": {
          "command": "uv",
          "args": ["run", "--directory", "/absolute/path/to/podhome-mcp", "podhome-mcp"],
          "env": {
            "PODHOME_BASE_URL": "https://serve.podhome.fm",
            "PODHOME_SHOWS": "{\"my-main-podcast\": \"phk_abc123def456...\", \"weekly-tech-show\": \"phk_789xyz...\"}"
          }
        }
      }
    }
  }
}
```

## Tools

### Episodes

- `create_episode` - Create a new episode for a specific show
- `list_episodes` - List episodes for a specific show (with optional filters)
- `schedule_episode` - Schedule or publish an episode
- `modify_episode` - Modify an episode's metadata

### Clips

- `create_clip` - Create a clip (soundbite) from an episode

### Webhooks

- `list_webhooks` - List all registered webhooks
- `register_webhook` - Register a new webhook
- `delete_webhook` - Delete a webhook
- `test_webhook` - Test webhooks

### Utility

- `list_shows` - List all configured show slugs

## Development

```bash
# Install dev dependencies
uv sync --group dev

# Run tests
pytest

# Type check
mypy src/podhome_mcp

# Lint
ruff check src/podhome_mcp
```
