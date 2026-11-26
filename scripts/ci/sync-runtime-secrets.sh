#!/usr/bin/env bash
#
# sync-runtime-secrets.sh — copy the server's runtime secrets from the
# environment into SecureString parameters under /chapterflow/<env>/.
#
# Usage: SYNC_MODE=missing|overwrite sync-runtime-secrets.sh /chapterflow/<env>
#
# Each value is read from the environment variable of the same name.
#   missing   (default) create parameters that do not exist yet and keep every
#             existing value as it is.
#   overwrite write every value, replacing what the parameter store holds.
#
# Values are never printed. On an AWS CLI failure only the error code is shown.
# Exit codes: 0 all done, 1 at least one name failed, 2 usage error.
#
# Kept bash-3.2 compatible so it also runs with the macOS system bash.

set -euo pipefail

REQUIRED_NAMES=(BOOK_STRIPE_SECRET_KEY BOOK_STRIPE_WEBHOOK_SECRET ANTHROPIC_API_KEY AUTH_STATE_SECRET)
OPTIONAL_NAMES=(ELEVENLABS_API_KEY)

usage() {
  echo "usage: SYNC_MODE=missing|overwrite $0 /chapterflow/<env>" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage
prefix="$1"
mode="${SYNC_MODE:-missing}"

if ! [[ "$prefix" =~ ^/chapterflow/[a-z0-9-]+$ ]]; then
  echo "error: the prefix must match /chapterflow/<env> (lowercase letters, digits, dashes)" >&2
  usage
fi
case "$mode" in
  missing | overwrite) ;;
  *)
    echo "error: SYNC_MODE must be missing or overwrite" >&2
    usage
    ;;
esac

# Print only the AWS error code from captured CLI error output: the text inside
# the first pair of parentheses on the "An error occurred" line, or
# "unknown error" when there is no such well-formed code.
error_code() {
  local line code
  line="$(printf '%s\n' "$1" | command grep -m 1 'An error occurred' || true)"
  if [[ "$line" =~ \(([^\(\)]*)\) ]]; then
    code="${BASH_REMATCH[1]}"
    if [[ "$code" =~ ^[A-Za-z0-9_.-]{1,128}$ ]]; then
      printf '%s' "$code"
      return
    fi
  fi
  printf 'unknown error'
}

failed=0

sync_one() {
  local name="$1" required="$2" value param err code
  value="${!name:-}"
  param="${prefix}/${name}"

  if [ -z "${value//[[:space:]]/}" ]; then
    if [ "$required" = "required" ]; then
      echo "::error::${name} is empty in the GitHub environment; set it before syncing"
      failed=1
    else
      echo "::warning::${name} is empty in the GitHub environment; ${param} was not synced"
    fi
    return
  fi

  if [ "$mode" = "overwrite" ]; then
    if err="$(aws ssm put-parameter --name "$param" --type SecureString --overwrite --value "$value" 2>&1 >/dev/null)"; then
      echo "synced ${param}"
    else
      echo "::error::could not write ${param}: $(error_code "$err")"
      failed=1
    fi
    return
  fi

  if err="$(aws ssm put-parameter --name "$param" --type SecureString --value "$value" 2>&1 >/dev/null)"; then
    echo "created ${param}"
    return
  fi
  code="$(error_code "$err")"
  if [ "$code" = "ParameterAlreadyExists" ]; then
    echo "kept existing ${param}"
  else
    echo "::error::could not write ${param}: ${code}"
    failed=1
  fi
}

for name in "${REQUIRED_NAMES[@]}"; do
  sync_one "$name" required
done
for name in "${OPTIONAL_NAMES[@]}"; do
  sync_one "$name" optional
done

exit "$failed"
