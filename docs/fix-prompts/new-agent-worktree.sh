#!/usr/bin/env bash
# Spawn an isolated git worktree for ONE fix agent.
# Usage:  ./docs/fix-prompts/new-agent-worktree.sh <ID>     e.g.  ./docs/fix-prompts/new-agent-worktree.sh H4
set -euo pipefail
BASE="audit/prod-readiness-2026-06-14"
id="${1:?usage: new-agent-worktree.sh <ID>   (e.g. H4)}"
root="$(git rev-parse --show-toplevel)"
wt="$root/../cf-fix-$id"
if git -C "$root" show-ref --verify --quiet "refs/heads/fix/$id"; then
  echo "branch fix/$id already exists — remove it or pick another id" >&2; exit 1
fi
git -C "$root" worktree add -b "fix/$id" "$wt" "$BASE"
echo ""
echo "✓ worktree ready:  $wt   (branch fix/$id off $BASE)"
echo "  → start an agent with cwd = $wt and paste the $id prompt."
echo "  → when reviewed, fold it in:"
echo "      git -C \"$root\" checkout $BASE && git -C \"$root\" merge --no-ff fix/$id"
echo "      git -C \"$root\" worktree remove \"$wt\" && git -C \"$root\" branch -d fix/$id"
