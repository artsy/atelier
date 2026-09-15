#!/usr/bin/env bash
#
# Safely delete an Atelier site's assets from S3.
#
# Usage: ./scripts/safely_delete.sh <slug>
#
# Always runs `aws s3 rm --dryrun` first, shows you exactly what would be
# removed, and then requires you to type the slug again to confirm before
# performing the real (non-dryrun) delete. Refuses to run non-interactively.

set -euo pipefail

BUCKET="artsy-atelier"

# Only color when stdout is an actual terminal, so output stays clean when
# piped, redirected, or run in CI.
if [ -t 1 ]; then
  RED=$'\033[31m'
  CYAN=$'\033[36m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  RESET=$'\033[0m'
else
  RED=""
  CYAN=""
  BOLD=""
  DIM=""
  RESET=""
fi

usage() {
  echo "Usage: $0 <slug>" >&2
  echo "  Deletes s3://${BUCKET}/<slug>/ after a dry run and explicit confirmation." >&2
}

if [ "$#" -ne 1 ]; then
  echo "Error: expected exactly one argument (the site slug)." >&2
  usage
  exit 1
fi

SLUG="$1"

# Matches Atelier's slug/subdomain convention (e.g. "marketing-dashboard").
# Deliberately strict: rejects empty/whitespace slugs, leading/trailing
# hyphens, slashes, or "." / ".." which could otherwise widen the delete
# scope beyond the intended folder.
if ! [[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "Error: \"$SLUG\" doesn't look like a valid site slug." >&2
  echo "Expected lowercase letters, numbers, and internal hyphens only (e.g. marketing-dashboard)." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: aws CLI not found on PATH." >&2
  exit 1
fi

if [ ! -t 0 ]; then
  echo "Error: this script requires an interactive terminal for confirmation." >&2
  exit 1
fi

# Trailing slash scopes this strictly to the slug's own folder, so e.g.
# deleting "foo" can never also match a sibling folder like "foo-bar".
TARGET="s3://${BUCKET}/${SLUG}/"

echo "Target: ${TARGET}"
echo
echo "${CYAN}Confirming AWS identity${RESET}"
read -r IDENTITY_ACCOUNT IDENTITY_ARN <<< "$(aws sts get-caller-identity --query '[Account,Arn]' --output text)"
echo "${DIM}Account: ${IDENTITY_ACCOUNT}"
echo "Arn:     ${IDENTITY_ARN}${RESET}"
echo

echo "${CYAN}Dry run (nothing will be deleted yet)${RESET}"
DRYRUN_OUTPUT="$(aws s3 rm --dryrun --recursive "$TARGET")"

if [ -z "$DRYRUN_OUTPUT" ]; then
  echo "No objects found under ${TARGET}. Nothing to delete."
  exit 0
fi

echo "${RED}${DRYRUN_OUTPUT}${RESET}"
echo
echo "⚠️  ${BOLD}The above objects would be permanently deleted from ${TARGET}${RESET} ⚠️"
echo

read -r -p "Type the slug (\"$SLUG\") to confirm permanent deletion, or anything else to abort: " CONFIRM
if [ "$CONFIRM" != "$SLUG" ]; then
  echo "Confirmation did not match. Aborting without deleting anything."
  exit 1
fi

echo
echo "${CYAN}Deleting (real, non-dryrun)${RESET}"
aws s3 rm --recursive "$TARGET"

echo
echo "Done. Deleted ${TARGET}"
