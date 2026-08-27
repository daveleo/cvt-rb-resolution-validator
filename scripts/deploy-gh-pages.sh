#!/usr/bin/env bash
# Build the site and publish dist/ to the `gh-pages` branch.
# Usage:  bash scripts/deploy-gh-pages.sh
set -euo pipefail

cd "$(dirname "$0")/.."

npm run build

WT="$(mktemp -d)"
trap 'git worktree remove --force "$WT" 2>/dev/null || true' EXIT

if git show-ref --verify --quiet refs/heads/gh-pages; then
  git worktree add "$WT" gh-pages
else
  git worktree add --orphan -b gh-pages "$WT"
fi

find "$WT" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -r dist/. "$WT/"
touch "$WT/.nojekyll"

git -C "$WT" add -A
if git -C "$WT" diff --cached --quiet; then
  echo "No changes to deploy."
else
  git -C "$WT" commit -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git -C "$WT" push origin gh-pages
  echo "Deployed to gh-pages."
fi
