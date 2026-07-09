#!/usr/bin/env bash
# Clear macOS quarantine xattrs so Smiley can be opened (unsigned / unnotarized app).
# Usage:
#   ./scripts/install-mac.sh /Applications/Smiley.app
#   ./scripts/install-mac.sh ~/Downloads/Smiley-2.1.9-arm64.dmg
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage: install-mac.sh <path-to-Smiley.app or .dmg>

Removes com.apple.quarantine and related extended attributes so macOS
Gatekeeper stops blocking Smiley on first launch.

After running this script, still use right-click → Open once:
  Applications → right-click Smiley → Open → Open

Examples:
  ./scripts/install-mac.sh /Applications/Smiley.app
  ./scripts/install-mac.sh ~/Downloads/Smiley-2.1.9-arm64.dmg

See INSTALL-MAC.md for full instructions.
EOF
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

TARGET="$1"

if [[ ! -e "$TARGET" ]]; then
  echo "Error: not found: $TARGET" >&2
  exit 1
fi

if ! command -v xattr >/dev/null 2>&1; then
  echo "Error: xattr not found (macOS only)." >&2
  exit 1
fi

echo "Clearing quarantine attributes on:"
echo "  $TARGET"
xattr -cr "$TARGET"

echo ""
echo "Done. If Smiley still won't open:"
echo "  1. Move Smiley.app to /Applications (if you passed a .dmg, open it and drag first)"
echo "  2. Right-click Smiley → Open → click Open in the dialog"
echo ""
echo "Guide: $ROOT/INSTALL-MAC.md"
