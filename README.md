# Podhome MCP Server

MCP server for publishing podcast episodes to Podhome from Auphonic-processed audio stored in Cloudflare R2.

## Overview

This MCP server is part of a multi-server podcast production pipeline:

1. **Auphonic MCP Server** - Processes and encodes audio, uploads to R2
2. **Podhome MCP Server (this)** - Resolves R2 URLs and publishes episodes

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file or export these variables:

```bash
# Required - Podhome API
export PODHOME_API_KEY="your_podhome_api_key"

# Optional - Podhome base URL (defaults to https://api.podhome.fm)
export PODHOME_BASE_URL="https://api.podhome.fm"

# Required - Cloudflare R2
export CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
export CLOUDFLARE_R2_ACCESS_KEY_ID="your_r2_access_key"
export CLOUDFLARE_R2_SECRET_ACCESS_KEY="your_r2_secret_key"

# Optional - R2 custom domain (recommended)
export R2_PUBLIC_DOMAIN="cdn.yourpodcast.com"
```

### 3. Build and Run

```bash
npm run build
npm start
```

Or for development:

```bash
npm run dev
```

## Nix/NixOS Installation

This project includes a complete Nix Flake with package and NixOS module support.

### Prerequisites

You need Nix with flakes enabled:
```bash
# Install Nix with flakes
sh <(curl -L https://nixos.org/nix/install) --daemon
# Or use the Determinate Systems installer:
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

### Flake Input

Add to your `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    podhome-mcp.url = "github:yourusername/podhome-mcp";
    # Or for a specific version:
    # podhome-mcp.url = "github:yourusername/podhome-mcp/v1.0.0";
  };

  outputs = { self, nixpkgs, podhome-mcp, ... }: {
    # Your configuration here
  };
}
```

### NixOS Module

Add the module to your NixOS configuration:

```nix
{ inputs, ... }:
{
  imports = [ inputs.podhome-mcp.nixosModules.default ];
  
  services.podhome-mcp = {
    enable = true;
    
    # Required configuration
    podhomeApiKey = "your-podhome-api-key";
    cloudflareAccountId = "your-cloudflare-account-id";
    cloudflareR2AccessKeyId = "your-r2-access-key";
    cloudflareR2SecretAccessKey = "your-r2-secret-key";
    
    # Optional configuration
    r2PublicDomain = "cdn.yourpodcast.com";
    podhomeBaseUrl = "https://api.podhome.fm";
    
    # HTTP server configuration (default: 127.0.0.1:3003)
    port = 3003;
    host = "127.0.0.1";
    
    # Logging
    logLevel = "info";  # Options: debug, info, warn, error
    
    # Security
    openFirewall = false;  # Set to true to allow external access
  };
}
```

#### Complete NixOS Example

```nix
{ config, pkgs, inputs, ... }:
{
  imports = [ inputs.podhome-mcp.nixosModules.default ];
  
  # Enable the Podhome MCP service
  services.podhome-mcp = {
    enable = true;
    
    # API Keys (use proper secrets management in production!)
    podhomeApiKey = "pk_live_xxxxxxxxxxxxxxxx";
    cloudflareAccountId = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    cloudflareR2AccessKeyId = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    cloudflareR2SecretAccessKey = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    
    # Custom domain for R2 public URLs
    r2PublicDomain = "audio.mypodcast.com";
    
    # Server listens on all interfaces on port 3003
    host = "0.0.0.0";
    port = 3003;
    openFirewall = true;
    
    # Only log warnings and errors
    logLevel = "warn";
  };
  
  # If running behind a reverse proxy (recommended for production)
  services.nginx = {
    enable = true;
    virtualHosts."mcp.mypodcast.com" = {
      locations."/" = {
        proxyPass = "http://127.0.0.1:3003";
        proxyWebsockets = true;  # Required for SSE
      };
    };
  };
}
```

### Using as a Package (Non-NixOS)

You can run the package directly without NixOS:

```bash
# Run directly from the flake
nix run github:yourusername/podhome-mcp

# Or install to your profile
nix profile install github:yourusername/podhome-mcp

# Then run
podhome-mcp
```

### Development Shell

Enter a development environment with all dependencies:

```bash
nix develop

# Inside the shell:
npm install
npm run build
npm test
npm run dev
```

### Building the Package

```bash
# Build the package
nix build

# Result will be in ./result/
ls -la result/bin/
```

### Updating npm Dependencies

When `package.json` changes, you need to update the `npmDepsHash` in `flake.nix`:

**Option 1: Use the helper script (Recommended)**
```bash
nix develop
./scripts/update-npm-deps.sh
```

**Option 2: Manual process**
```bash
# Generate package-lock.json
npm install

# Get the new hash
nix-prefetch-npm-deps package-lock.json

# Update flake.nix with the new hash
```

**Note:** The hash is in SRI format. The script will handle the conversion automatically.

## Cloudflare R2 Setup

### 1. Create R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2
3. Click "Create bucket"
4. Name it (e.g., `my-podcast-audio`)
5. Choose a location close to your audience

### 2. Generate Access Keys

1. In R2, go to "Manage R2 API Tokens"
2. Click "Create API Token"
3. Select your bucket
4. Grant "Object Read & Write" permissions
5. Save the Access Key ID and Secret Access Key

### 3. Configure Bucket Access

**Option A: Public Bucket (Recommended)**
- Go to bucket settings
- Enable "Public Access"
- Note the public URL format

**Option B: Custom Domain (Best)**
- In bucket settings, click "Custom Domains"
- Add your domain (e.g., `cdn.yourpodcast.com`)
- Configure DNS as instructed
- Set `R2_PUBLIC_DOMAIN` environment variable

**Option C: Private Bucket**
- The server supports presigned URLs (not yet implemented)
- Will generate temporary URLs valid for 7 days

## Auphonic Integration

### Configure R2 as External Service

1. In Auphonic, go to "External Services"
2. Add "Generic S3"
3. Configure:
   - **Type**: Amazon S3
   - **Bucket**: Your R2 bucket name
   - **Region**: auto
   - **Endpoint**: `https://{account_id}.r2.cloudflarestorage.com`
   - **Access Key**: Your R2 access key
   - **Secret Key**: Your R2 secret key
   - **Key Prefix**: Path prefix (e.g., `episodes/`)
   - **ACL**: public-read (for public buckets)

### Metadata Flow

Auphonic can pass metadata to Podhome:
- `title` → Episode title
- `subtitle` → Short description
- `summary` → Full show notes
- `artist` → Show name
- `album` → Series name

## Available Tools

### `get_r2_public_url`

Convert Auphonic's R2 object reference to a public URL.

**Input:**
- `bucket` (string, required): R2 bucket name
- `object_key` (string, required): Object path from Auphonic
- `custom_domain` (string, optional): Override domain

**Output:**
```
R2 File: episodes/lup-0653.mp3
Bucket: my-podcast-audio
Size: 45.2MB
Public URL: https://cdn.mypodcast.com/episodes/lup-0653.mp3
```

### `create_episode`

Create a new episode draft in Podhome.

**Input:**
- `file_url` (string, required): Public R2/S3 URL
- `title` (string, required): Episode title
- `description` (string, optional): Show notes
- `episode_nr` (number, optional): Episode number
- `season_nr` (number, optional): Season number
- `link` (string, optional): Episode webpage URL
- `publish_date` (string, optional): ISO-8601 UTC datetime
- `use_podhome_ai` (boolean, optional): Default false
- `suggest_chapters` (boolean, optional): Default false
- `suggest_details` (boolean, optional): Default false
- `suggest_clips` (boolean, optional): Default false
- `enhance_audio` (boolean, optional): Default false

**Output:**
```
Created episode "The Future of AI" (ID: 550e8400-e29b-41d4-a716-446655440000)
Status: Draft
```

### `publish_episode`

Publish or schedule an episode.

**Input:**
- `episode_id` (string, required): Episode UUID
- `publish_now` (boolean, optional): Default true
- `publish_date` (string, optional): ISO-8601 UTC (if not publishing now)

**Output:**
```
Episode 550e8400-e29b-41d4-a716-446655440000 published at 2026-02-08T15:30:00Z
Status: Published
```

### `list_episodes`

List episodes with filtering.

**Input:**
- `status` (number, optional): 0=Draft, 1=Scheduled, 2=Published, 3=LivePending, 4=Live, 5=LiveEnded
- `include_transcript` (boolean, optional)
- `include_chapters` (boolean, optional)
- `include_downloads` (boolean, optional)
- `include_people` (boolean, optional)

**Output:**
```
Found 3 episodes:

ID | Title | Episode # | Status | Published
---|-------|-----------|--------|----------
550e84... | The Future of AI | E42 | Published | 2/8/2026
660f95... | Cloud Basics | E41 | Published | 2/1/2026
770a06... | Intro to DevOps | E40 | Published | 1/25/2026
```

### `get_episode`

Get detailed episode information.

**Input:**
- `episode_id` (string, required): Episode UUID
- `include_transcript` (boolean, optional)
- `include_chapters` (boolean, optional)
- `include_downloads` (boolean, optional)
- `include_people` (boolean, optional)

**Output:**
```
Episode: The Future of AI
ID: 550e8400-e29b-41d4-a716-446655440000
Number: S1E42
Status: Published
Published: 2/8/2026, 3:30:00 PM
Duration: 45:30
Downloads: 1523
URL: https://podhome.fm/episodes/42
Audio: https://cdn.mypodcast.com/episodes/lup-0653.mp3

Description:
In this episode we discuss...

Chapters:
00:00:00 - Introduction
00:05:30 - Main Topic
00:30:00 - Q&A
```

### `update_episode`

Update episode metadata.

**Input:**
- `episode_id` (string, required): Episode UUID
- `title` (string, optional)
- `description` (string, optional)
- `episode_nr` (number, optional)
- `season_nr` (number, optional)
- `image_url` (string, optional)

**Output:**
```
Updated episode 550e8400-e29b-41d4-a716-446655440000
Changed: title, description
```

### `delete_episode`

Delete an episode.

**Input:**
- `episode_id` (string, required): Episode UUID

**Output:**
```
Deleted episode 550e8400-e29b-41d4-a716-446655440000
```

## Complete Workflow Example

### 1. Process Audio with Auphonic

Using the Auphonic MCP server:

```bash
# Upload and process audio
auphonic.upload_audio {
  input_file: "/path/to/raw-audio.wav",
  preset: "podcast-mastering",
  metadata: {
    title: "Episode 42: The Future of AI",
    artist: "My Podcast",
    summary: "We discuss the latest in AI..."
  }
}
# Returns: production_uuid
```

### 2. Wait for Auphonic to Complete

```bash
# Check status (Auphonic uploads to R2 automatically)
auphonic.check_status {
  uuid: "production_uuid"
}
# When status is "Done", file is in R2
```

### 3. Get Public R2 URL

```bash
podhome.get_r2_public_url {
  bucket: "my-podcast-audio",
  object_key: "episodes/episode-42.mp3"
}
# Returns: public_url
```

### 4. Create Episode in Podhome

```bash
podhome.create_episode {
  file_url: "https://cdn.mypodcast.com/episodes/episode-42.mp3",
  title: "Episode 42: The Future of AI",
  description: "We discuss the latest in AI...",
  episode_nr: 42,
  season_nr: 1
}
# Returns: episode_id
```

### 5. Review Episode

```bash
podhome.get_episode {
  episode_id: "episode_id"
}
```

### 6. Publish

```bash
# Publish immediately
podhome.publish_episode {
  episode_id: "episode_id",
  publish_now: true
}

# OR schedule for later
podhome.publish_episode {
  episode_id: "episode_id",
  publish_now: false,
  publish_date: "2026-03-01T10:00:00Z"
}
```

## Troubleshooting

### "Invalid API key" Error

- Check `PODHOME_API_KEY` is set correctly
- Verify the API key is active in Podhome

### "File not found in R2" Error

- Verify bucket name matches Auphonic service preset
- Check object_key path is correct
- Ensure Auphonic upload completed successfully
- Wait a few minutes (Auphonic upload to R2 can take time)

### "Episode not found" Error

- Verify episode_id is correct UUID format
- Check episode exists with `list_episodes`

### R2 Connection Issues

- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Check R2 access keys have correct permissions
- Ensure bucket is in the correct Cloudflare account

## API Documentation

- [Podhome API Docs](https://podhome.fm/docs/api)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Auphonic API Docs](https://auphonic.com/help/api/)

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PODHOME_API_KEY` | Yes | - | Podhome API key |
| `PODHOME_BASE_URL` | No | `https://api.podhome.fm` | Podhome API base URL |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | - | Cloudflare account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Yes | - | R2 access key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Yes | - | R2 secret access key |
| `R2_PUBLIC_DOMAIN` | No | - | Custom domain for R2 URLs |
| `MCP_PORT` | No | - | HTTP server port (if set, runs in HTTP mode) |
| `MCP_HOST` | No | `127.0.0.1` | HTTP server host address |
| `LOG_LEVEL` | No | `info` | Log level: debug, info, warn, error |

### Server Modes

**STDIO Mode (Default):** When `MCP_PORT` is not set, the server communicates via standard input/output. This is the standard MCP protocol for CLI integration.

**HTTP Mode:** When `MCP_PORT` is set, the server runs an HTTP server with SSE (Server-Sent Events) support:
- `GET /health` - Health check endpoint
- `GET /sse` - SSE endpoint for MCP communication
- `POST /message` - Message endpoint for MCP communication

Example HTTP mode usage:
```bash
export MCP_PORT=3003
export MCP_HOST=127.0.0.1
npm start
# Server listens on http://127.0.0.1:3003
```

## Production Deployment Guide

### NixOS with Secrets Management

For production deployments, avoid storing secrets directly in your Nix configuration. Use agenix or sops-nix:

#### Using agenix

```nix
{ config, pkgs, inputs, ... }:
{
  imports = [
    inputs.podhome-mcp.nixosModules.default
    inputs.agenix.nixosModules.default
  ];

  age.secrets.podhome-api-key.file = ../secrets/podhome-api-key.age;
  age.secrets.r2-credentials.file = ../secrets/r2-credentials.age;

  services.podhome-mcp = {
    enable = true;
    podhomeApiKeyFile = config.age.secrets.podhome-api-key.path;
    # ... other config
  };
}
```

#### Using sops-nix

```nix
{ config, ... }:
{
  sops.secrets.podhome_api_key = {};
  
  services.podhome-mcp = {
    enable = true;
    podhomeApiKey = config.sops.secrets.podhome_api_key.path;
    # ... other config
  };
}
```

### Systemd Service Management

View logs:
```bash
# Follow logs in real-time
journalctl -u podhome-mcp -f

# View recent logs
journalctl -u podhome-mcp -n 100

# Check service status
systemctl status podhome-mcp
```

Restart the service:
```bash
sudo systemctl restart podhome-mcp
```

### Health Monitoring

The HTTP server exposes a health endpoint:
```bash
curl http://localhost:3003/health
# Returns: {"status":"ok","timestamp":"2026-02-08T15:30:00.000Z"}
```

### Security Considerations

1. **Firewall**: Only open the port if external access is needed (use `openFirewall = true`)
2. **Reverse Proxy**: Recommended to put nginx/Caddy in front for TLS termination
3. **Network Binding**: Default binds to 127.0.0.1 (localhost only) - change to 0.0.0.0 only if necessary
4. **Secrets**: Never commit secrets to git - use proper secrets management
5. **User Isolation**: Service runs as dedicated `podhome-mcp` user (not root)
6. **Resource Limits**: Service is limited to 512MB RAM and 50% CPU

### Troubleshooting Production Issues

**Service fails to start:**
```bash
# Check for missing environment variables
journalctl -u podhome-mcp -n 50 | grep -i error

# Verify all secrets are readable by the service user
sudo -u podhome-mcp cat /var/lib/podhome-mcp/.env  # if using env file
```

**Port already in use:**
```bash
# Find what's using port 3003
sudo ss -tlnp | grep 3003

# Change to a different port in your configuration
services.podhome-mcp.port = 3004;
```

**Permission denied errors:**
```bash
# Fix permissions on state directory
sudo chown -R podhome-mcp:podhome-mcp /var/lib/podhome-mcp
```

## License

MIT
