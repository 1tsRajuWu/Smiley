#!/usr/bin/env bash
# One-time: add Supabase secrets for install tracking in GitHub Actions.
# Usage:
#   ./scripts/setup-supabase-github-secrets.sh
#   ./scripts/setup-supabase-github-secrets.sh "sb_publishable_…"
set -euo pipefail

REPO="${GITHUB_REPO:-1tsRajuWu/Smiley}"
URL="${SUPABASE_URL:-https://smxpcmakejgxknpzrspg.supabase.co}"
ANON_KEY="${1:-${SUPABASE_ANON_KEY:-}}"

if [[ -z "$ANON_KEY" ]]; then
  echo "Paste your Supabase Publishable key (sb_publishable_… or Legacy anon JWT):"
  read -r ANON_KEY
fi

if [[ -z "$ANON_KEY" ]]; then
  echo "No key provided." >&2
  exit 1
fi

echo "Setting SUPABASE_URL and SUPABASE_ANON_KEY on $REPO …"
gh secret set SUPABASE_URL --body "$URL" --repo "$REPO"
gh secret set SUPABASE_ANON_KEY --body "$ANON_KEY" --repo "$REPO"
echo "Done. Ship a new release tag so builds bundle downloads.registry.json."
