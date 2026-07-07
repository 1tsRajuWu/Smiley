#!/usr/bin/env bash
# Refresh README.md download links from GitHub releases (hero badges + table).
# Resolves each platform to the newest release that actually ships that artifact.
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

latest_json=$(gh api "repos/${REPO}/releases/latest")
latest_tag=$(echo "$latest_json" | jq -r '.tag_name')
releases_json=$(gh api "repos/${REPO}/releases?per_page=30")
latest_url="https://github.com/${REPO}/releases/latest"
release_base="https://github.com/${REPO}/releases/download"

# Pick newest release (by publish order in API) that contains an asset matching regex
find_asset() {
  local pattern=$1
  echo "$releases_json" | jq -r --arg re "$pattern" '
    .[] | .tag_name as $tag | .assets[] | select(.name | test($re)) |
    [$tag, .name, .browser_download_url] | @tsv
  ' | head -1
}

download_url_for() {
  local tag=$1
  local name=$2
  # Always use versioned URLs — /latest/download/ 404s when the newest tag is still
  # publishing or missing Linux/Windows artifacts (common during CI).
  echo "${release_base}/${tag}/${name}"
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

read -r win_line <<< "$(find_asset '^Smiley-Setup-[0-9].*\.exe$')" || true
read -r mac_arm_line <<< "$(find_asset '^Smiley-[0-9].*-arm64\.dmg$')" || true
read -r mac_x64_line <<< "$(find_asset '^Smiley-[0-9].*-x64\.dmg$')" || true
read -r linux_app_line <<< "$(find_asset '^Smiley-[0-9].*\.AppImage$')" || true
read -r linux_deb_line <<< "$(find_asset '^Smiley-[0-9].*\.deb$')" || true

parse_line() {
  local line=$1
  if [[ -z "$line" ]]; then
    return 1
  fi
  IFS=$'\t' read -r tag name _url <<< "$line"
  echo "$tag" "$name" "$(download_url_for "$tag" "$name")"
}

hero_badge() {
  local label=$1
  local badge_text=$2
  local color=$3
  local logo=$4
  local logo_color=$5
  local url=$6
  local shield_text
  shield_text=$(printf '%s' "${label}-${badge_text}" | sed 's/ /_/g')
  echo "[![${label}](https://img.shields.io/badge/${shield_text}-${color}?style=for-the-badge&logo=${logo}&logoColor=${logo_color})](${url})"
}

hero_block=""
table_rows=""

add_platform() {
  local line=$1
  local badge_label=$2
  local badge_text=$3
  local badge_color=$4
  local badge_logo=$5
  local badge_logo_color=$6

  if [[ -z "$line" ]]; then
    echo "Warning: no asset found for ${badge_label}" >&2
    return
  fi

  local tag name url platform order
  IFS=$' ' read -r tag name url <<< "$(parse_line "$line")"
  platform=$(platform_for "$name")
  order=$(asset_order "$name")

  hero_block+="$(hero_badge "$badge_label" "$badge_text" "$badge_color" "$badge_logo" "$badge_logo_color" "$url")"$'\n'
  table_rows+="${order}|${platform}|${name}|${url}"$'\n'
}

add_platform "$win_line" "Windows" "Setup.exe" "0078D4" "windows" "white"
add_platform "$mac_arm_line" "macOS Apple Silicon" "Apple_Silicon" "555555" "apple" "white"
add_platform "$mac_x64_line" "macOS Intel" "Intel" "555555" "apple" "white"
add_platform "$linux_app_line" "Linux AppImage" "AppImage" "FCC624" "linux" "black"
add_platform "$linux_deb_line" "Linux deb" ".deb" "E95420" "debian" "white"

missing=0
[[ -z "$win_line" ]] && echo "Warning: Windows installer not found in recent releases" >&2 && missing=$((missing + 1))
[[ -z "$mac_arm_line" ]] && echo "Warning: macOS arm64 DMG not found" >&2 && missing=$((missing + 1))
[[ -z "$mac_x64_line" ]] && echo "Warning: macOS Intel DMG not found" >&2 && missing=$((missing + 1))
[[ -z "$linux_app_line" ]] && echo "Warning: Linux AppImage not found" >&2 && missing=$((missing + 1))
[[ -z "$linux_deb_line" ]] && echo "Warning: Linux .deb not found" >&2 && missing=$((missing + 1))

if [[ "$missing" -gt 0 ]]; then
  echo "Skipping README update — latest releases are missing ${missing} platform(s). Re-run after CI finishes." >&2
  exit 0
fi

if [[ -z "$table_rows" ]]; then
  echo "No user-facing assets found in recent releases" >&2
  exit 1
fi

table_body="| Platform | File |
|----------|------|
"
about_table_body="| Platform | File | Link |
|----------|------|------|
"
about_file_label() {
  case "$1" in
    Windows) echo "Installer (\`.exe\`)" ;;
    "macOS Apple Silicon") echo "\`.dmg\` (Apple Silicon)" ;;
    "macOS Intel") echo "\`.dmg\` (Intel)" ;;
    "Linux (AppImage)") echo "AppImage" ;;
    "Linux (.deb)") echo "\`.deb\`" ;;
    *) echo "" ;;
  esac
}

while IFS='|' read -r _order platform name url; do
  [[ -z "$platform" ]] && continue
  table_body+="| ${platform} | [${name}](${url}) |"$'\n'
  about_label=$(about_file_label "$platform")
  about_table_body+="| ${platform} | ${about_label} | [Download](${url}) |"$'\n'
done < <(echo -n "$table_rows" | sort -t'|' -k1,1n)
about_table_body+="| All platforms | — | [Latest releases](${latest_url}) |"$'\n'

if [[ ! -f "$README_PATH" ]]; then
  echo "README not found: $README_PATH" >&2
  exit 1
fi

ABOUT_PATH="$ROOT/docs/ABOUT.md"

python3 - "$README_PATH" "$ABOUT_PATH" "$hero_block" "$table_body" "$about_table_body" <<'PY'
import sys

readme_path, about_path, hero_block, table_body, about_table_body = sys.argv[1:6]

def replace_block(text, start_marker, end_marker, new_inner):
    start = text.find(start_marker)
    end = text.find(end_marker)
    if start == -1 or end == -1 or end < start:
        print(f"Missing {start_marker}/{end_marker}", file=sys.stderr)
        sys.exit(1)
    return (
        text[: start + len(start_marker)]
        + "\n"
        + new_inner.rstrip()
        + "\n"
        + text[end:]
    )

with open(readme_path, encoding="utf-8") as f:
    readme = f.read()

readme = replace_block(readme, "<!-- HERO_DOWNLOADS_START -->", "<!-- HERO_DOWNLOADS_END -->", hero_block)
readme = replace_block(readme, "<!-- DOWNLOADS_START -->", "<!-- DOWNLOADS_END -->", table_body.rstrip())

with open(readme_path, "w", encoding="utf-8") as f:
    f.write(readme)

if about_path:
    try:
        with open(about_path, encoding="utf-8") as f:
            about = f.read()
        about = replace_block(about, "<!-- DOWNLOADS_START -->", "<!-- DOWNLOADS_END -->", about_table_body.rstrip())
        with open(about_path, "w", encoding="utf-8") as f:
            f.write(about)
    except SystemExit:
        print("docs/ABOUT.md missing download markers — skipped", file=sys.stderr)
PY

echo "Updated ${README} and docs/ABOUT.md download links (latest tag: ${latest_tag})"
