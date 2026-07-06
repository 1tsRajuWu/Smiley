#!/usr/bin/env bash
# Refresh README.md download table from GitHub latest release assets + counts.
# Updates content between <!-- DOWNLOADS_START --> and <!-- DOWNLOADS_END -->.
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-1tsRajuWu/Smiley}"
README="${1:-README.md}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
README_PATH="$ROOT/$README"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

release_json=$(gh api "repos/${REPO}/releases/latest")
tag=$(echo "$release_json" | jq -r '.tag_name')
version="${tag#v}"
release_url="https://github.com/${REPO}/releases/tag/${tag}"
latest_url="https://github.com/${REPO}/releases/latest"

format_count() {
  local n=$1
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --grouping "$n"
  else
    # 1,234 grouping without numfmt
    echo "$n" | awk '{ len = length($0); for (i = 0; i < len; i++) { c = substr($0, len - i, 1); out = (i > 0 && i % 3 == 0) ? c "," out : c out }; print out }'
  fi
}

platform_for() {
  case "$1" in
    Smiley-Setup-*.exe) echo "Windows" ;;
    *-arm64.dmg) echo "macOS Apple Silicon" ;;
    *-x64.dmg) echo "macOS Intel" ;;
    *.AppImage) echo "Linux (AppImage)" ;;
    *.deb) echo "Linux (.deb)" ;;
    *) echo "" ;;
  esac
}

asset_order() {
  case "$1" in
    Smiley-Setup-*.exe) echo 1 ;;
    *-arm64.dmg) echo 2 ;;
    *-x64.dmg) echo 3 ;;
    *.AppImage) echo 4 ;;
    *.deb) echo 5 ;;
    *) echo 99 ;;
  esac
}

is_user_asset() {
  local name=$1
  case "$name" in
    Smiley-Portable-*.exe|*android*|*.yml|*.blockmap|*.zip) return 1 ;;
    Smiley-Setup-*.exe|*-arm64.dmg|*-x64.dmg|*.AppImage|*.deb) return 0 ;;
    *) return 1 ;;
  esac
}

# Build sorted asset list: name|url|count|platform|order
assets_tsv=$(
  echo "$release_json" | jq -r '.assets[] | [.name, .browser_download_url, .download_count] | @tsv' |
  while IFS=$'\t' read -r name url count; do
    if is_user_asset "$name"; then
      platform=$(platform_for "$name")
      order=$(asset_order "$name")
      printf '%s\t%s\t%s\t%s\t%s\n' "$order" "$name" "$url" "$count" "$platform"
    fi
  done | sort -t$'\t' -k1,1n
)

if [[ -z "$assets_tsv" ]]; then
  echo "No user-facing assets found on latest release" >&2
  exit 1
fi

total=0
table_rows=""
while IFS=$'\t' read -r _order name url count platform; do
  total=$((total + count))
  formatted=$(format_count "$count")
  latest_download="${latest_url}/download/${name}"
  table_rows+="| ${platform} | [**${name}**](${latest_download}) | ${formatted} |"$'\n'
done <<< "$assets_tsv"

total_formatted=$(format_count "$total")

block=$(cat <<EOF
**Latest: ${tag}** — [full release notes](${release_url})

**Total downloads (latest release):** ${total_formatted} · [live stats on Releases](${latest_url})

| Platform | File | Downloads |
|----------|------|-----------|
${table_rows}
EOF
)

if [[ ! -f "$README_PATH" ]]; then
  echo "README not found: $README_PATH" >&2
  exit 1
fi

python3 - "$README_PATH" "$block" <<'PY'
import sys

readme_path, block = sys.argv[1], sys.argv[2]
start_marker = "<!-- DOWNLOADS_START -->"
end_marker = "<!-- DOWNLOADS_END -->"

with open(readme_path, encoding="utf-8") as f:
    content = f.read()

start = content.find(start_marker)
end = content.find(end_marker)
if start == -1 or end == -1 or end < start:
    print("README missing DOWNLOADS_START/DOWNLOADS_END markers", file=sys.stderr)
    sys.exit(1)

new_content = (
    content[: start + len(start_marker)]
    + "\n"
    + block.rstrip()
    + "\n"
    + content[end:]
)

with open(readme_path, "w", encoding="utf-8") as f:
    f.write(new_content)
PY

echo "Updated ${README} download section for ${tag} (${total_formatted} total downloads)"
