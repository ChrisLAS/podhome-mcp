# Agent Instructions: Podhome MCP Server

> **For LLM Agents:** This document contains everything you need to know to install, configure, and deploy the Podhome MCP server on a Nix/NixOS system.

## What is This?

**Podhome MCP Server** is a Model Context Protocol (MCP) server that enables AI assistants to publish podcast episodes to [Podhome](https://podhome.fm) from audio files processed by [Auphonic](https://auphonic.com) and stored in Cloudflare R2.

### Key Components

1. **MCP Server**: Exposes 7 tools for episode management (create, publish, list, get, update, delete, R2 URL resolution)
2. **HTTP Server**: Optional HTTP mode with SSE transport (default port: 3003)
3. **R2 Integration**: Connects to Cloudflare R2 (S3-compatible) to resolve public URLs
4. **Nix Flake**: Complete Nix package + NixOS module for deployment

### Architecture

```
Auphonic → R2 Storage → Podhome MCP → Podhome API
                ↓
         (This MCP Server)
```

## Prerequisites

### System Requirements
- **OS**: NixOS or any Linux with Nix package manager
- **Architecture**: x86_64-linux or aarch64-linux
- **Network**: Internet access for API calls to Podhome and R2

### Required API Keys (You MUST Ask the User For These)

Before proceeding with any installation, request these credentials from the user:

#### 1. Podhome API Key
- **How to get**: User logs into https://podhome.fm → Settings → API Keys
- **Format**: String like `pk_live_xxxxxxxxxx` or `pk_test_xxxxxxxxxx`
- **Permissions**: Needs episode management permissions

#### 2. Cloudflare Account ID
- **How to get**: https://dash.cloudflare.com → Right sidebar shows Account ID
- **Format**: 32-character hex string
- **Example**: `1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p`

#### 3. Cloudflare R2 Access Key ID
- **How to get**: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token
- **Format**: 32-character string
- **Permissions**: Object Read & Write for the specific bucket

#### 4. Cloudflare R2 Secret Access Key
- **How to get**: Generated when creating the R2 API Token (shown only once!)
- **Format**: 64-character string
- **⚠️ Warning**: User must have saved this when creating the token

#### 5. R2 Public Domain (Optional)
- **How to get**: Cloudflare Dashboard → R2 → Bucket → Custom Domains
- **Format**: Domain like `cdn.mypodcast.com`
- **Note**: If not provided, uses R2's default public bucket URL format

### Template Message to User

```
To deploy the Podhome MCP server, I need the following credentials:

**Required:**
1. Podhome API Key (from https://podhome.fm/settings/api)
2. Cloudflare Account ID (from https://dash.cloudflare.com)
3. Cloudflare R2 Access Key ID
4. Cloudflare R2 Secret Access Key

**Optional:**
5. R2 Custom Domain (if configured in Cloudflare)

Please provide these credentials, or if you need help finding them, I can guide you through the process.
```

## Installation Methods

### Method 1: NixOS Module (Recommended for Servers)

Best for persistent deployment with systemd service management.

#### Step 1: Add Flake Input

Add to the system's `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    podhome-mcp.url = "github:yourusername/podhome-mcp";
    # Or for local development:
    # podhome-mcp.url = "path:/path/to/podhome-mcp";
  };

  outputs = { self, nixpkgs, podhome-mcp, ... }: {
    # Your system configuration
  };
}
```

#### Step 2: Import Module and Configure

In your NixOS configuration (e.g., `configuration.nix` or a separate module):

```nix
{ config, pkgs, inputs, ... }:
{
  imports = [ inputs.podhome-mcp.nixosModules.default ];
  
  services.podhome-mcp = {
    enable = true;
    
    # Required credentials
    podhomeApiKey = "USER_PROVIDED_KEY";
    cloudflareAccountId = "USER_PROVIDED_ID";
    cloudflareR2AccessKeyId = "USER_PROVIDED_KEY";
    cloudflareR2SecretAccessKey = "USER_PROVIDED_SECRET";
    
    # Optional configuration
    r2PublicDomain = "cdn.userdomain.com";  # Optional
    podhomeBaseUrl = "https://api.podhome.fm";  # Optional
    
    # HTTP server settings
    port = 3003;  # Default
    host = "127.0.0.1";  # Default (localhost only)
    logLevel = "info";  # Options: debug, info, warn, error
    
    # Security
    openFirewall = false;  # Set to true to allow external access
    
    # Service user (defaults are fine)
    # user = "podhome-mcp";
    # group = "podhome-mcp";
  };
}
```

#### Step 3: Apply Configuration

```bash
sudo nixos-rebuild switch --flake /path/to/flake#hostname
```

#### Step 4: Verify Installation

```bash
# Check service status
systemctl status podhome-mcp

# View logs
journalctl -u podhome-mcp -f

# Test health endpoint (if in HTTP mode)
curl http://localhost:3003/health
```

### Method 2: Nix Profile Install (For Testing/Development)

Best for trying out the server without full NixOS configuration.

```bash
# Install from GitHub
nix profile install github:yourusername/podhome-mcp

# Or install from local checkout
nix profile install .

# Run
export PODHOME_API_KEY="USER_PROVIDED"
export CLOUDFLARE_ACCOUNT_ID="USER_PROVIDED"
export CLOUDFLARE_R2_ACCESS_KEY_ID="USER_PROVIDED"
export CLOUDFLARE_R2_SECRET_ACCESS_KEY="USER_PROVIDED"
export MCP_PORT=3003
podhome-mcp
```

### Method 3: Nix Run (One-off Execution)

For quick testing without installation:

```bash
nix run github:yourusername/podhome-mcp
```

## Development Setup

If you need to modify the code or run tests:

```bash
# Enter development shell
nix develop

# Install npm dependencies
npm install

# Run tests
npm test

# Build TypeScript
npm run build

# Run locally
npm run dev
```

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PODHOME_API_KEY` | Yes | - | Podhome API key |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | - | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Yes | - | R2 access key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Yes | - | R2 secret access key |
| `R2_PUBLIC_DOMAIN` | No | - | Custom domain for R2 URLs |
| `PODHOME_BASE_URL` | No | `https://api.podhome.fm` | Podhome API base URL |
| `MCP_PORT` | No | - | HTTP server port (if set, runs HTTP mode) |
| `MCP_HOST` | No | `127.0.0.1` | HTTP server bind address |
| `LOG_LEVEL` | No | `info` | Logging: debug, info, warn, error |

### Service Modes

**STDIO Mode** (Default): Communicates via standard input/output for MCP CLI tools

**HTTP Mode**: Set `MCP_PORT` to run HTTP server with:
- `GET /health` - Health check
- `GET /sse` - SSE endpoint for MCP
- `POST /message` - Message endpoint

## Troubleshooting Guide

### Service Won't Start

**Check:**
```bash
# View error logs
journalctl -u podhome-mcp -n 50

# Check if all env vars are set
systemctl show podhome-mcp --property=Environment
```

**Common Issues:**
1. **Missing API keys**: Ensure all 4 required credentials are provided
2. **Permission denied**: Check file permissions on state directory
3. **Port already in use**: Change `port` to a different number (e.g., 3004)

### npmDepsHash Mismatch

If you see "npmDepsHash mismatch" error:

```bash
# Enter dev shell
nix develop

# Update the hash
./scripts/update-npm-deps.sh

# Rebuild
nix build
```

### R2 Connection Failures

**Check:**
- Cloudflare Account ID is correct (32 chars)
- R2 keys have Object Read & Write permissions
- Bucket exists and is accessible
- Network connectivity to R2 endpoint

### Podhome API Errors

**Check:**
- API key is valid (not expired)
- Base URL is correct (try default if unsure)
- Network connectivity to Podhome API

## Available MCP Tools

Once running, the server exposes these tools:

1. **`get_r2_public_url`** - Convert R2 object key to public URL
2. **`create_episode`** - Create episode draft in Podhome
3. **`publish_episode`** - Publish or schedule episode
4. **`list_episodes`** - List all episodes with filters
5. **`get_episode`** - Get detailed episode info
6. **`update_episode`** - Update episode metadata
7. **`delete_episode`** - Delete an episode

## Production Deployment Checklist

When deploying to production, ensure:

- [ ] All 4 required API credentials obtained from user
- [ ] Secrets properly secured (consider using agenix/sops-nix)
- [ ] Firewall configured (only open port if external access needed)
- [ ] Reverse proxy configured (nginx/Caddy recommended for TLS)
- [ ] Host set to 127.0.0.1 unless external access required
- [ ] Log level set appropriately (warn/error for production)
- [ ] Service running as non-root user (automatic with module)
- [ ] Monitoring/alerting configured (check journald logs)
- [ ] Backup/recovery procedures documented

## Security Considerations

### Secrets Management

**⚠️ WARNING**: Environment variables in Nix configuration are stored in the Nix store (world-readable).

**For Production**: Use proper secrets management:

```nix
# Using agenix
age.secrets.podhome-api-key.file = ../secrets/podhome-api-key.age;
services.podhome-mcp.podhomeApiKeyFile = config.age.secrets.podhome-api-key.path;

# Or using sops-nix
sops.secrets.podhome_api_key = {};
services.podhome-mcp.podhomeApiKey = config.sops.secrets.podhome_api_key.path;
```

### Network Security

- Default binds to localhost (127.0.0.1) - safest
- Use reverse proxy (nginx/Caddy) for external access with TLS
- Only open firewall if absolutely necessary
- Consider VPN/internal network for server communication

### Service Isolation

The NixOS module automatically configures:
- Dedicated system user (not root)
- Private /tmp directory
- Read-only system directories
- Limited capabilities
- Resource limits (512MB RAM, 50% CPU)

## File Locations

### NixOS Deployment

- **Service binary**: `/nix/store/...-podhome-mcp/bin/podhome-mcp`
- **State directory**: `/var/lib/podhome-mcp/`
- **Logs**: `journalctl -u podhome-mcp`
- **Service config**: `/etc/systemd/system/podhome-mcp.service`

### Source Code

- **Entry point**: `src/index.ts`
- **Tools**: `src/tools/*.ts`
- **Clients**: `src/clients/*.ts`
- **Tests**: `tests/*.test.ts`
- **Nix config**: `flake.nix`

## Getting Help

If you encounter issues:

1. Check logs: `journalctl -u podhome-mcp -f`
2. Verify config: `systemctl cat podhome-mcp`
3. Test manually: `nix run` with env vars
4. Review tests: `npm test`
5. Check README.md for detailed docs

## Quick Reference Commands

```bash
# Enter dev shell
nix develop

# Build package
nix build

# Run package
nix run

# Install to profile
nix profile install .

# Update deps hash
./scripts/update-npm-deps.sh

# Check service status
systemctl status podhome-mcp

# View logs
journalctl -u podhome-mcp -f

# Restart service
sudo systemctl restart podhome-mcp

# Test health endpoint
curl http://localhost:3003/health
```

---

**Remember**: Always ask the user for API credentials before attempting installation. These cannot be generated automatically and must be obtained from their respective services.
