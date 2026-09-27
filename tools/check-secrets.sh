#!/usr/bin/env bash
# Run before making the repo public: scans EVERY commit (not just the current files) for credentials.
# IBM suspends accounts if Bob/Cloud credentials appear in the repo. Exit 1 on any hit.
# Usage: check-secrets.sh [--tree] (--tree scans tracked files at HEAD only)
set -u

# Check if --tree mode is requested
TREE_MODE=false
if [ "${1:-}" = "--tree" ]; then
  TREE_MODE=true
fi

PAT='bob_prod_[A-Za-z0-9]{8}|nvapi-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|(^|[^A-Za-z])sk-(ant-)?[A-Za-z0-9_-]{24,}|AKIA[0-9A-Z]{16}|[MN][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}|-----BEGIN [A-Z ]*PRIVATE KEY|(API_?KEY|SECRET|TOKEN|PASSWORD)=[A-Za-z0-9/+_-]{20,}'
# HUMBLE generates local dev values (SESSION_SECRET=dev-...) for demo apps; they are not credentials.
# README placeholders copied into audit evidence (values like email-server-password) and values HUMBLE already redacted are not credentials.

if [ "$TREE_MODE" = true ]; then
  # Tree mode: scan tracked files at HEAD only
  hits=$(git ls-files -z | xargs -0 grep -oE "$PAT" 2>/dev/null | grep -vE '=dev-[a-z-]*[0-9a-f]{8,}$|=[a-z-]*(password|secret|token|key|example|your|changeme|placeholder)[a-z-]*$|<redacted-by-firstrun>' | sort -u)
  context="tree (tracked files at HEAD)"
else
  # History mode: scan all commits (default behavior)
  hits=$(git log --all -p --no-color | grep -oE "$PAT" | grep -vE '=dev-[a-z-]*[0-9a-f]{8,}$|=[a-z-]*(password|secret|token|key|example|your|changeme|placeholder)[a-z-]*$|<redacted-by-firstrun>' | sort -u)
  context="history (all commits)"
fi
tracked=$(git ls-files | grep -iE '(^|/)\.env($|\.)' | grep -v '\.example$')
[ -n "$tracked" ] && echo "Tracked env files (must not be committed):" && echo "$tracked"
if [ -n "$hits" ]; then
  # Never print the value itself (this output gets pasted into chat/issues): a masked prefix + the commits.
  echo "Possible credentials in $context (values masked):"
  while IFS= read -r h; do
    if [ "$TREE_MODE" = true ]; then
      commits="HEAD"
    else
      commits=$(git log --all --format=%h -S "$h" | tr '\n' ' ')
    fi
    echo "  $(printf '%s' "$h" | cut -c1-6)...(masked)  commits: ${commits:-?}"
  done <<< "$hits"
  exit 1
fi
[ -n "$tracked" ] && exit 1
if [ "$TREE_MODE" = true ]; then
  echo "No credentials found in $context."
else
  echo "No credentials found in $(git rev-list --all | wc -l) commits."
fi