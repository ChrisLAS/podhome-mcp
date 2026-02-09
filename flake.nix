{
  description = "Podhome MCP Server - Publish podcast episodes to Podhome from Auphonic-processed audio stored in Cloudflare R2";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Read package.json for version info
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
      in
      {
        packages = rec {
          default = podhome-mcp;
          
          podhome-mcp = pkgs.buildNpmPackage {
            pname = packageJson.name;
            version = packageJson.version;
            
            src = ./.;
            
            # This hash must be updated when package-lock.json changes
            # Run: nix-prefetch-npm-deps package-lock.json
            # To update: npm install && nix-prefetch-npm-deps package-lock.json
            npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
            
            nativeBuildInputs = with pkgs; [
              nodejs_20
              typescript
            ];
            
            buildPhase = ''
              runHook preBuild
              
              # Build TypeScript
              npm run build
              
              runHook postBuild
            '';
            
            installPhase = ''
              runHook preInstall
              
              # Create output directory structure
              mkdir -p $out/bin
              mkdir -p $out/lib/podhome-mcp
              
              # Copy built files
              cp -r dist $out/lib/podhome-mcp/
              cp package.json $out/lib/podhome-mcp/
              
              # Create wrapper script
              makeWrapper ${pkgs.nodejs_20}/bin/node $out/bin/podhome-mcp \
                --add-flags "$out/lib/podhome-mcp/dist/index.js" \
                --set NODE_ENV production
              
              runHook postInstall
            '';
            
            meta = with pkgs.lib; {
              description = packageJson.description;
              homepage = "https://github.com/yourusername/podhome-mcp";
              license = licenses.mit;
              maintainers = [ ];
              platforms = platforms.linux;
              mainProgram = "podhome-mcp";
            };
          };
        };
        
        devShells.default = pkgs.mkShell {
          name = "podhome-mcp-dev";
          
          packages = with pkgs; [
            nodejs_20
            typescript
            nodePackages.npm
            nix-prefetch-npm-deps
            git
          ];
          
          shellHook = ''
            echo "Podhome MCP Development Shell"
            echo "Node.js: $(node --version)"
            echo "npm: $(npm --version)"
            echo ""
            echo "Available commands:"
            echo "  npm install     - Install dependencies"
            echo "  npm run build   - Build TypeScript"
            echo "  npm test        - Run tests"
            echo "  npm run dev     - Run development server"
            echo ""
          '';
        };
      }
    ) // {
      # NixOS module (system-independent)
      nixosModules.default = { config, lib, pkgs, ... }:
        with lib;
        let
          cfg = config.services.podhome-mcp;
        in
        {
          options.services.podhome-mcp = {
            enable = mkEnableOption "Podhome MCP server";
            
            package = mkOption {
              type = types.package;
              default = self.packages.${pkgs.system}.default;
              defaultText = literalExpression "inputs.podhome-mcp.packages.\${pkgs.system}.default";
              description = "The podhome-mcp package to use.";
            };
            
            # Required environment variables
            podhomeApiKey = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Podhome API key (optional if using podhomeApiKeyFile/podhomeApiKeys). Get from https://podhome.fm/settings/api";
            };

            podhomeApiKeyFile = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Path to a file containing the Podhome API key (optional).";
            };

            podhomeApiKeys = mkOption {
              type = types.nullOr (types.attrsOf types.str);
              default = null;
              description = "Named Podhome API keys (optional). Exposed via PODHOME_API_KEYS JSON.";
            };

            podhomeApiKeysFile = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Path to a JSON file of named Podhome API keys (optional).";
            };

            podhomeApiKeysDir = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Directory containing Podhome API key files (optional). Filename (minus extension) becomes the key name.";
            };
            
            cloudflareAccountId = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Cloudflare account ID for R2 access (optional if using cloudflareAccountIdFile).";
            };

            cloudflareAccountIdFile = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Path to a file containing the Cloudflare account ID (optional).";
            };
            
            cloudflareR2AccessKeyId = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Cloudflare R2 access key ID (optional if using cloudflareR2AccessKeyIdFile).";
            };

            cloudflareR2AccessKeyIdFile = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Path to a file containing the Cloudflare R2 access key ID (optional).";
            };
            
            cloudflareR2SecretAccessKey = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Cloudflare R2 secret access key (optional if using cloudflareR2SecretAccessKeyFile).";
            };

            cloudflareR2SecretAccessKeyFile = mkOption {
              type = types.nullOr types.str;
              default = null;
              description = "Path to a file containing the Cloudflare R2 secret access key (optional).";
            };
            
            # Optional environment variables
            r2PublicDomain = mkOption {
              type = types.nullOr types.str;
              default = null;
              example = "cdn.yourpodcast.com";
              description = "Custom domain for R2 public access (optional). If not set, uses R2 public bucket URL.";
            };
            
            podhomeBaseUrl = mkOption {
              type = types.nullOr types.str;
              default = null;
              example = "https://api.podhome.fm";
              description = "Podhome API base URL (optional, defaults to https://api.podhome.fm).";
            };
            
            # HTTP Server configuration
            port = mkOption {
              type = types.port;
              default = 3003;
              description = "Port to run the MCP HTTP server on.";
            };
            
            host = mkOption {
              type = types.str;
              default = "127.0.0.1";
              description = "Host address to bind the HTTP server to. Use 0.0.0.0 to listen on all interfaces.";
            };
            
            logLevel = mkOption {
              type = types.enum [ "info" "warn" "error" "debug" ];
              default = "info";
              description = "Log level for the service.";
            };
            
            # Service configuration
            user = mkOption {
              type = types.str;
              default = "podhome-mcp";
              description = "User to run the service as.";
            };
            
            group = mkOption {
              type = types.str;
              default = "podhome-mcp";
              description = "Group to run the service as.";
            };
            
            openFirewall = mkOption {
              type = types.bool;
              default = false;
              description = "Whether to open the firewall for the configured port.";
            };
          };
          
          config = mkIf cfg.enable {
            assertions =
              let
                countTrue = items: length (filter (item: item) items);
              in
              [
                {
                  assertion = countTrue [
                    (cfg.podhomeApiKey != null)
                    (cfg.podhomeApiKeyFile != null)
                    (cfg.podhomeApiKeys != null)
                    (cfg.podhomeApiKeysFile != null)
                    (cfg.podhomeApiKeysDir != null)
                  ] >= 1;
                  message = "services.podhome-mcp requires at least one Podhome API key source (podhomeApiKey, podhomeApiKeyFile, podhomeApiKeys, podhomeApiKeysFile, or podhomeApiKeysDir).";
                }
                {
                  assertion = countTrue [ (cfg.podhomeApiKey != null) (cfg.podhomeApiKeyFile != null) ] <= 1;
                  message = "services.podhome-mcp: only one of podhomeApiKey or podhomeApiKeyFile may be set.";
                }
                {
                  assertion = countTrue [ (cfg.cloudflareAccountId != null) (cfg.cloudflareAccountIdFile != null) ] == 1;
                  message = "services.podhome-mcp requires exactly one of cloudflareAccountId or cloudflareAccountIdFile.";
                }
                {
                  assertion = countTrue [ (cfg.cloudflareR2AccessKeyId != null) (cfg.cloudflareR2AccessKeyIdFile != null) ] == 1;
                  message = "services.podhome-mcp requires exactly one of cloudflareR2AccessKeyId or cloudflareR2AccessKeyIdFile.";
                }
                {
                  assertion = countTrue [ (cfg.cloudflareR2SecretAccessKey != null) (cfg.cloudflareR2SecretAccessKeyFile != null) ] == 1;
                  message = "services.podhome-mcp requires exactly one of cloudflareR2SecretAccessKey or cloudflareR2SecretAccessKeyFile.";
                }
              ];
            # Create user and group
            users.users.${cfg.user} = {
              isSystemUser = true;
              group = cfg.group;
              description = "Podhome MCP server user";
              home = "/var/lib/podhome-mcp";
              createHome = true;
            };
            
            users.groups.${cfg.group} = {};
            
            # Open firewall if requested
            networking.firewall.allowedTCPPorts = mkIf cfg.openFirewall [ cfg.port ];
            
            # Systemd service
            systemd.services.podhome-mcp = {
              description = "Podhome MCP Server";
              after = [ "network.target" ];
              wantedBy = [ "multi-user.target" ];
              
              environment = {
                MCP_PORT = toString cfg.port;
                MCP_HOST = cfg.host;
                LOG_LEVEL = cfg.logLevel;
              } // optionalAttrs (cfg.podhomeApiKey != null) {
                PODHOME_API_KEY = cfg.podhomeApiKey;
              } // optionalAttrs (cfg.podhomeApiKeyFile != null) {
                PODHOME_API_KEY_FILE = cfg.podhomeApiKeyFile;
              } // optionalAttrs (cfg.podhomeApiKeys != null) {
                PODHOME_API_KEYS = builtins.toJSON cfg.podhomeApiKeys;
              } // optionalAttrs (cfg.podhomeApiKeysFile != null) {
                PODHOME_API_KEYS_FILE = cfg.podhomeApiKeysFile;
              } // optionalAttrs (cfg.podhomeApiKeysDir != null) {
                PODHOME_API_KEYS_DIR = cfg.podhomeApiKeysDir;
              } // optionalAttrs (cfg.cloudflareAccountId != null) {
                CLOUDFLARE_ACCOUNT_ID = cfg.cloudflareAccountId;
              } // optionalAttrs (cfg.cloudflareAccountIdFile != null) {
                CLOUDFLARE_ACCOUNT_ID_FILE = cfg.cloudflareAccountIdFile;
              } // optionalAttrs (cfg.cloudflareR2AccessKeyId != null) {
                CLOUDFLARE_R2_ACCESS_KEY_ID = cfg.cloudflareR2AccessKeyId;
              } // optionalAttrs (cfg.cloudflareR2AccessKeyIdFile != null) {
                CLOUDFLARE_R2_ACCESS_KEY_ID_FILE = cfg.cloudflareR2AccessKeyIdFile;
              } // optionalAttrs (cfg.cloudflareR2SecretAccessKey != null) {
                CLOUDFLARE_R2_SECRET_ACCESS_KEY = cfg.cloudflareR2SecretAccessKey;
              } // optionalAttrs (cfg.cloudflareR2SecretAccessKeyFile != null) {
                CLOUDFLARE_R2_SECRET_ACCESS_KEY_FILE = cfg.cloudflareR2SecretAccessKeyFile;
              } // optionalAttrs (cfg.r2PublicDomain != null) {
                R2_PUBLIC_DOMAIN = cfg.r2PublicDomain;
              } // optionalAttrs (cfg.podhomeBaseUrl != null) {
                PODHOME_BASE_URL = cfg.podhomeBaseUrl;
              };
              
              serviceConfig = {
                Type = "simple";
                User = cfg.user;
                Group = cfg.group;
                ExecStart = "${cfg.package}/bin/podhome-mcp";
                Restart = "on-failure";
                RestartSec = 5;
                
                # Working directory
                WorkingDirectory = "/var/lib/podhome-mcp";
                
                # Resource limits
                MemoryMax = "512M";
                CPUQuota = "50%";
                
                # Security hardening
                NoNewPrivileges = true;
                PrivateTmp = true;
                ProtectSystem = "strict";
                ProtectHome = true;
                ReadWritePaths = [ "/var/lib/podhome-mcp" ];
                ProtectKernelTunables = true;
                ProtectKernelModules = true;
                ProtectControlGroups = true;
                RestrictSUIDSGID = true;
                RestrictRealtime = true;
                RestrictNamespaces = true;
                LockPersonality = true;
                
                # Capabilities
                CapabilityBoundingSet = "";
                
                # Logging
                StandardOutput = "journal";
                StandardError = "journal";
                SyslogIdentifier = "podhome-mcp";
                
                # Start limit
                StartLimitIntervalSec = 60;
                StartLimitBurst = 3;
              };
              
              # Log rate limiting
              unitConfig = {
                StartLimitIntervalSec = 60;
                StartLimitBurst = 3;
              };
            };
            
            # State directory
            systemd.tmpfiles.rules = [
              "d /var/lib/podhome-mcp 0755 ${cfg.user} ${cfg.group} -"
            ];
          };
        };
    };
}
