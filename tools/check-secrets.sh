#!/usr/bin/env bash
# Run before making the repo public: scans EVERY commit (not just the current files) for credentials.
# IBM suspends accounts if Bob/Cloud credentials appear in the repo. Exit 1 on any hit.
set -u
PAT='bob_prod_[A-Za-z0-9]{8}|nvapi-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|(^|[^A-Za-z])sk-(ant-)?[A-Za-z0-9_-]{24,}|AKIA[0-9A-Z]{16}|[MN][A-Za-z0-9_-]{23,25}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}|-----BEGIN [A-Z ]*PRIVATE KEY|(API_?KEY|SECRET|TOKEN|PASSWORD)=[A-Za-z0-9/+_-]{20,}'
hits=$(git log --all -p --no-color | grep -oE "$PAT" | sort -u)
tracked=$(git ls-files | grep -iE '(^|/)\.env($|\.)' | grep -v '\.example$')
[ -n "$tracked" ] && echo "Tracked env files (must not be committed):" && echo "$tracked"
if [ -n "$hits" ]; then echo "Possible credentials in history:"; echo "$hits" | cut -c1-40; exit 1; fi
[ -n "$tracked" ] && exit 1
echo "No credentials found in $(git rev-list --all | wc -l) commits."
