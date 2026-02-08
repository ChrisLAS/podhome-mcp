# Getting Started with Nix/NixOS

This guide helps you get started with the Podhome MCP server using Nix.

## Quick Start

### 1. Enter Development Environment

```bash
nix develop
```

This will give you:
- Node.js 20.x
- npm
- TypeScript
- nix-prefetch-npm-deps (for updating hashes)

### 2. Generate package-lock.json

```bash
npm install
```

This creates `package-lock.json` which is required for Nix builds.

### 3. Update the npmDepsHash

Since this is the first time, you need to calculate the hash:

```bash
nix-prefetch-npm-deps package-lock.json
```

Copy the output and update `flake.nix`:

```nix
npmDepsHash = "sha256-XXX";  # Replace XXX with the actual hash
```

Or use the helper script:

```bash
./scripts/update-npm-deps.sh
```

### 4. Build the Package

```bash
nix build
```

The result will be in `./result/`.

### 5. Run the Package

```bash
nix run
```

Or install it:

```bash
nix profile install .
podhome-mcp
```

## NixOS Deployment

### Basic Configuration

Add to your `flake.nix`:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    podhome-mcp.url = "path:./podhome-mcp";  # Or git URL
  };

  outputs = { self, nixpkgs, podhome-mcp, ... }: {
    nixosConfigurations.myserver = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        podhome-mcp.nixosModules.default
        {
          services.podhome-mcp = {
            enable = true;
            podhomeApiKey = "your-api-key";
            cloudflareAccountId = "your-account-id";
            cloudflareR2AccessKeyId = "your-access-key";
            cloudflareR2SecretAccessKey = "your-secret-key";
            port = 3003;
          };
        }
      ];
    };
  };
}
```

### Apply Configuration

```bash
sudo nixos-rebuild switch --flake .#
```

### Check Service Status

```bash
systemctl status podhome-mcp
journalctl -u podhome-mcp -f
```

## Development Workflow

### Making Changes

1. Enter dev shell: `nix develop`
2. Make your changes
3. Test: `npm test`
4. Build: `npm run build`
5. Update hash if package.json changed: `./scripts/update-npm-deps.sh`
6. Test build: `nix build`

### Adding Dependencies

1. Add to package.json: `npm install <package>`
2. Update the hash: `./scripts/update-npm-deps.sh`
3. Rebuild: `nix build`

## Troubleshooting

### "npmDepsHash mismatch"

This means package-lock.json changed but flake.nix wasn't updated:

```bash
./scripts/update-npm-deps.sh
```

### "package-lock.json not found"

You need to generate it:

```bash
nix develop
npm install
```

### "nix-prefetch-npm-deps: command not found"

Enter the development shell first:

```bash
nix develop
```

### Permission Denied

Make sure the script is executable:

```bash
chmod +x ./scripts/update-npm-deps.sh
```

## Next Steps

- Read the full [README.md](README.md)
- Check out the [NixOS configuration examples](README.md#complete-nixos-example)
- Learn about [production deployment](README.md#production-deployment-guide)
