#!/usr/bin/env bash
# Run before making the repo public: scans EVERY commit (not just the current files) for credentials.
# IBM suspends accounts if Bob/Cloud credentials appear in the repo. Exit 1 on any hit.
set -u
PAT='bob_prod_[A-Za-z0-9]{8}|nvapi-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|(^|[^A-Za-z])sk-(ant-)?[A-Za-z0-9_-]{24,}|AKIA[0-9A-Z]{16}|[MN][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}|-----BEGIN [A-Z ]*PRIVATE KEY|(API_?KEY|SECRET|TOKEN|PASSWORD)=[A-Za-z0-9/+_-]{20,}'
# FirstRun generates local dev values (SESSION_SECRET=dev-…) for demo apps; they are not credentials.
# README placeholders copied into audit evidence (all-lowercase words like email-server-password) and values FirstRun already redacted are not credentials.
hits=$(git log --all -p --no-color | grep -oE "$PAT" | grep -vE '=dev-[a-z-]*[0-9a-f]{8,}$|=[a-z]+(-[a-z]+)+$|<redacted-by-firstrun>' | sort -u)
tracked=$(git ls-files | grep -iE '(^|/)\.env($|\.)' | grep -v '\.example$')
[ -n "$tracked" ] && echo "Tracked env files (must not be committed):" && echo "$tracked"
if [ -n "$hits" ]; then
  # Never print the value itself (this output gets pasted into chat/issues): a masked prefix + the commits.
  echo "Possible credentials in history (values masked):"
  while IFS= read -r h; do
    commits=$(git log --all --format=%h -S "$h" | tr '\n' ' ')
    echo "  $(printf '%s' "$h" | cut -c1-6)...(masked)  commits: ${commits:-?}"
  done <<< "$hits"
  exit 1
fi
[ -n "$tracked" ] && exit 1
echo "No credentials found in $(git rev-list --all | wc -l) commits."
