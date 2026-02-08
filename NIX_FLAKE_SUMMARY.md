# Nix Flake Implementation Summary

This document summarizes the Nix Flake implementation for the Podhome MCP server.

## Files Created

### 1. `flake.nix` - Main Nix Flake
**Purpose:** Defines the package, NixOS module, and development shell

**Features:**
- **Package** (`packages.default`): Builds the TypeScript MCP server using `buildNpmPackage`
- **NixOS Module** (`nixosModules.default`): Complete systemd service configuration
- **Development Shell** (`devShells.default`): Development environment with Node.js, npm, TypeScript
- Multi-system support (x86_64-linux, aarch64-linux)

**Key Components:**
```nix
- buildNpmPackage for pure builds
- npmDepsHash for dependency pinning
- Complete NixOS module with all configuration options
- Systemd service with security hardening
- User/group isolation
- Firewall configuration option
```

### 2. Updated `src/index.ts` - HTTP Server Support
**Changes:**
- Added express HTTP server support
- SSE (Server-Sent Events) transport for MCP over HTTP
- Health check endpoint at `/health`
- Environment-based mode selection (stdio vs HTTP)
- Logging with configurable log levels (debug, info, warn, error)
- Configurable port and host via `MCP_PORT` and `MCP_HOST`

### 3. Updated `package.json` - Express Dependency
**Added:**
- `express`: ^4.18.2 (for HTTP server)
- `@types/express`: ^4.17.21 (TypeScript types)

### 4. `.env.example` - Environment Variables Template
**Purpose:** Example configuration file
**Contains:**
- All required environment variables
- Optional settings with comments
- Documentation for each variable

### 5. `scripts/update-npm-deps.sh` - Dependency Update Helper
**Purpose:** Automates npm dependency hash updates
**Usage:**
```bash
./scripts/update-npm-deps.sh
```
**Features:**
- Cleans node_modules
- Reinstalls dependencies
- Calculates new hash
- Optionally updates flake.nix automatically

### 6. `GETTING_STARTED_NIX.md` - Quick Start Guide
**Purpose:** Step-by-step guide for Nix users
**Covers:**
- Development environment setup
- Building the package
- NixOS deployment
- Common troubleshooting

### 7. Updated `README.md` - Nix Documentation
**Added Sections:**
- Nix/NixOS Installation
- Flake input configuration
- NixOS module usage
- Complete configuration examples
- HTTP server mode documentation
- Production deployment guide
- Systemd service management

## Configuration Options (NixOS Module)

### Required
- `podhomeApiKey`: Podhome API key
- `cloudflareAccountId`: Cloudflare account ID
- `cloudflareR2AccessKeyId`: R2 access key
- `cloudflareR2SecretAccessKey`: R2 secret key

### Optional
- `r2PublicDomain`: Custom domain for R2 (default: null)
- `podhomeBaseUrl`: Podhome API base URL (default: null, uses https://api.podhome.fm)
- `port`: HTTP server port (default: 3003)
- `host`: HTTP server host (default: "127.0.0.1")
- `logLevel`: Logging level (default: "info", options: debug, info, warn, error)
- `openFirewall`: Open firewall port (default: false)
- `user`: Service user (default: "podhome-mcp")
- `group`: Service group (default: "podhome-mcp")

## Security Features

### Systemd Hardening
```nix
NoNewPrivileges = true;
PrivateTmp = true;
ProtectSystem = "strict";
ProtectHome = true;
ProtectKernelTunables = true;
ProtectKernelModules = true;
ProtectControlGroups = true;
RestrictSUIDSGID = true;
RestrictRealtime = true;
RestrictNamespaces = true;
LockPersonality = true;
CapabilityBoundingSet = "";
```

### Resource Limits
- Memory: 512MB max
- CPU: 50% quota

### User Isolation
- Runs as dedicated `podhome-mcp` user (not root)
- Dedicated home directory: `/var/lib/podhome-mcp`
- Minimal permissions

## Usage Examples

### Run as Package
```bash
nix run github:yourusername/podhome-mcp
```

### Install to Profile
```bash
nix profile install github:yourusername/podhome-mcp
podhome-mcp
```

### NixOS Service
```nix
services.podhome-mcp = {
  enable = true;
  podhomeApiKey = "...";
  cloudflareAccountId = "...";
  cloudflareR2AccessKeyId = "...";
  cloudflareR2SecretAccessKey = "...";
  port = 3003;
};
```

### Development
```bash
nix develop
npm install
npm run build
npm test
```

## HTTP Server Mode

When `MCP_PORT` is set, the server runs in HTTP mode:

### Endpoints
- `GET /health` - Health check
- `GET /sse` - SSE endpoint for MCP
- `POST /message` - Message endpoint for MCP

### Configuration
```bash
export MCP_PORT=3003
export MCP_HOST=127.0.0.1
export LOG_LEVEL=info
```

### Health Check
```bash
curl http://localhost:3003/health
# {"status":"ok","timestamp":"2026-02-08T15:30:00.000Z"}
```

## Maintenance

### Update Dependencies
```bash
nix develop
./scripts/update-npm-deps.sh
```

### View Logs
```bash
journalctl -u podhome-mcp -f
```

### Restart Service
```bash
sudo systemctl restart podhome-mcp
```

## Production Checklist

- [ ] Use secrets management (agenix/sops-nix) instead of plain env vars
- [ ] Enable firewall and open port only if needed
- [ ] Use reverse proxy (nginx/Caddy) for TLS
- [ ] Set `host` to "127.0.0.1" unless external access needed
- [ ] Configure log rotation
- [ ] Set up monitoring/alerting
- [ ] Test backup/restore procedures
- [ ] Document recovery procedures

## Known Limitations

1. **npmDepsHash**: Must be manually updated when package.json changes
2. **Secrets in Nix Store**: Environment variables are visible in Nix store (use agenix/sops-nix for production)
3. **SSE Implementation**: HTTP mode uses simplified SSE - production may need enhancements

## Future Enhancements

- [ ] Automatic npmDepsHash updates via GitHub Actions
- [ ] Built-in secrets management integration
- [ ] Metrics/monitoring endpoints
- [ ] Graceful shutdown handling
- [ ] Configuration validation
- [ ] Support for additional authentication methods

