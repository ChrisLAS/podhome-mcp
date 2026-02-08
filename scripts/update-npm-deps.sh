#!/usr/bin/env bash
set -e

echo "Updating Podhome MCP npm dependencies..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Run this script from the project root."
    exit 1
fi

# Clean up old node_modules and lock files
echo "Cleaning up..."
rm -rf node_modules package-lock.json

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Check if nix-prefetch-npm-deps is available
if ! command -v nix-prefetch-npm-deps &> /dev/null; then
    echo ""
    echo "Warning: nix-prefetch-npm-deps not found in PATH"
    echo "You need to enter the Nix dev shell first:"
    echo "  nix develop"
    echo ""
    echo "Then run this script again."
    exit 1
fi

# Get the new hash
echo ""
echo "Calculating npm dependencies hash..."
NEW_HASH=$(nix-prefetch-npm-deps package-lock.json)

echo ""
echo "========================================"
echo "New npmDepsHash:"
echo ""
echo "sha256-${NEW_HASH}"
echo ""
echo "========================================"
echo ""
echo "Update flake.nix with this hash:"
echo "  npmDepsHash = \"sha256-${NEW_HASH}\";"
echo ""

# Optionally update flake.nix automatically
read -p "Update flake.nix automatically? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Use sed to replace the hash (macOS and Linux compatible)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/npmDepsHash = \"sha256-[^\"]*\"/npmDepsHash = \"sha256-${NEW_HASH}\"/" flake.nix
    else
        # Linux
        sed -i "s/npmDepsHash = \"sha256-[^\"]*\"/npmDepsHash = \"sha256-${NEW_HASH}\"/" flake.nix
    fi
    echo "✓ flake.nix updated successfully!"
else
    echo "Update flake.nix manually with the hash above."
fi
