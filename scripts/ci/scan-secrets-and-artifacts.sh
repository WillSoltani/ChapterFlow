#!/usr/bin/env bash
#
# scan-secrets-and-artifacts.sh — pre-commit / CI guard.
#
# Blocks two classes of mistake that have already bitten this PUBLIC repo:
#   1. Committed build artifacts / caches (.next*, .open-next, node_modules,
#      infra/cdk.out, *.swp, .chapterflow/, *.tsbuildinfo, .env*, .DS_Store).
#      A committed Turbopack cache (.next-chapterflow-bookcheck) once leaked a
#      live Stripe key — see public-repo-secret-leak history.
#   2. High-confidence secret tokens in file content (Stripe / AWS / Anthropic /
#      OpenAI / ElevenLabs / GitHub / Google / PEM private keys).
#
# Modes:
#   --staged    scan files staged for commit (paths) + the index (secrets)  [pre-commit hook]
#   --all       scan all tracked files                                      [CI, default]
#   --selftest  verify the detection patterns against built-in samples      [CI sanity]
#
# Exits non-zero on any finding. Bypass LOCALLY only (never in CI) with
# `git commit --no-verify`. The CI job is the un-bypassable backstop.
#
# Intentionally bash-3.2 compatible (macOS system bash): no mapfile / assoc arrays.

set -u

MODE="${1:---all}"
SELF="scripts/ci/scan-secrets-and-artifacts.sh"

# Paths that must never be tracked (already in .gitignore; this catches `git add -f`).
FORBIDDEN_PATHS='(^|/)\.next(-|/)|(^|/)\.open-next/|(^|/)node_modules/|(^|/)\.chapterflow/|^infra/cdk\.out/|^infra/dist/|\.swp$|\.swo$|\.tsbuildinfo$|(^|/)\.DS_Store$'
ENV_FILE='(^|/)\.env($|\.)'
ENV_ALLOW='\.(example|sample|template)$'

# Each alternative is length-guarded so doc placeholders (`sk-ant-...`,
# `sk_live_...`) do NOT match — only real-shaped tokens do.
SECRET_RE='sk_live_[A-Za-z0-9]{20,}|sk_test_[A-Za-z0-9]{20,}|rk_live_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{24,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|sk-ant-[A-Za-z0-9_-]{30,}|sk-proj-[A-Za-z0-9_-]{20,}|xi-api-[0-9a-f]{32}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

red() { printf '\033[31m%s\033[0m\n' "$1"; }

run_selftest() {
  fails=0
  # Positives MUST match. Each is split into two adjacent string literals so the
  # contiguous token never appears in this file (keeps scanners — incl. this one
  # and GitHub's — from flagging the samples). AKIA sample is AWS's docs example.
  for pos in \
    "sk_live_""FAKEliveKEYaaaaaaaaaaaaaaaaaaaa" \
    "whsec_""FAKEwebhookSECRETaaaaaaaaaaaaaaaa" \
    "AKIA""IOSFODNN7EXAMPLE" \
    "sk-ant-""api03-FAKEanthropicKEYaaaaaaaaaaaaaaaaaaaaaaaa" \
    "xi-api-""0123456789abcdef0123456789abcdef" \
    "-----BEGIN ""RSA PRIVATE KEY-----" ; do
    if ! printf '%s' "$pos" | grep -qE "$SECRET_RE"; then
      red "selftest: FAILED to detect a positive sample"; fails=$((fails + 1))
    fi
  done
  # Negatives MUST NOT match (placeholders, public keys, account ids, env refs).
  for neg in \
    "sk_live_..." \
    "sk-ant-..." \
    "pk_live_FAKEpublishablekeyexample" \
    "AKIA-not-a-key" \
    "928413605677" \
    "process.env.BOOK_STRIPE_SECRET_KEY" ; do
    if printf '%s' "$neg" | grep -qE "$SECRET_RE"; then
      red "selftest: FALSE POSITIVE on: $neg"; fails=$((fails + 1))
    fi
  done
  if [ "$fails" -eq 0 ]; then
    printf '✓ selftest OK — patterns detect samples with no false positives\n'
    return 0
  fi
  return 1
}

if [ "$MODE" = "--selftest" ]; then
  run_selftest
  exit $?
fi

if [ "$MODE" = "--staged" ]; then
  FILES=$(git diff --cached --name-only --diff-filter=ACM)
  GREP_SCOPE="--cached"
else
  FILES=$(git ls-files)
  GREP_SCOPE=""
fi

problems=0

# ── 1. forbidden artifact / cache / env paths ────────────────────────────────
BADPATHS=$(printf '%s\n' "$FILES" | grep -E "$FORBIDDEN_PATHS" || true)
BADENV=$(printf '%s\n' "$FILES" | grep -E "$ENV_FILE" | grep -vE "$ENV_ALLOW" || true)
ARTIFACTS=$(printf '%s\n%s\n' "$BADPATHS" "$BADENV" | grep -v '^$' | sort -u || true)
if [ -n "$ARTIFACTS" ]; then
  red "✖ Build artifacts / caches / env files must not be committed:"
  printf '%s\n' "$ARTIFACTS" | sed 's/^/    /'
  echo
  echo "  These are gitignored — one likely slipped in via 'git add -f'. Undo with:"
  echo "      git rm -r --cached <path>"
  echo "  Generated output belongs in a build step / S3, never in git history."
  echo
  problems=$((problems + 1))
fi

# ── 2. high-confidence secret tokens in content ──────────────────────────────
HITS=$(git grep $GREP_SCOPE -I -nE "$SECRET_RE" -- ":(exclude)$SELF" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  red "✖ Possible hardcoded secret(s) detected:"
  printf '%s\n' "$HITS" | sed 's/^/    /'
  echo
  echo "  Never commit live credentials — read them from process.env / SSM."
  echo "  If a value here was ever real, ROTATE it (history rewrite does not un-leak)."
  echo
  problems=$((problems + 1))
fi

if [ "$problems" -ne 0 ]; then
  red "Secret/artifact guard FAILED."
  echo "Bypass locally only if you are certain it is a false positive: git commit --no-verify"
  exit 1
fi

printf '✓ secret/artifact guard passed (%s)\n' "$MODE"
exit 0
