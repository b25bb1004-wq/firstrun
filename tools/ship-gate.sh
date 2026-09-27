#!/usr/bin/env bash
# SHIP GATE - one command that says whether friday/integration is ready to become main
# Runs all checks in order and prints a PASS/FAIL table.
# Usage: bash tools/ship-gate.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMPDIR="${TMPDIR:-/tmp}"
WORKDIR="$(mktemp -d -t ship-gate.XXXXXX)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==============================================================================="
echo "                    SHIP GATE — friday/integration → main"
echo "==============================================================================="
echo

# Results table
results=()
pass_count=0
fail_count=0

add_result() {
  local name="$1"
  local status="$2"
  local detail="$3"
  results+=("$name|$status|$detail")
  if [ "$status" = "PASS" ]; then
    pass_count=$((pass_count + 1))
  elif [ "$status" = "FAIL" ]; then
    fail_count=$((fail_count + 1))
  fi
}

print_table() {
  echo
  echo "┌──────────────────────────────────────────────┬──────┬─────────────────────────────────────────────────────────────┐"
  echo "│ Check                                        │      │ Detail                                                      │"
  echo "├──────────────────────────────────────────────┼──────┼─────────────────────────────────────────────────────────────┤"
  for r in "${results[@]}"; do
    IFS='|' read -r name status detail <<< "$r"
    if [ "$status" = "PASS" ]; then
      stat_str=" PASS "
    elif [ "$status" = "FAIL" ]; then
      stat_str=" FAIL "
    else
      stat_str=" INFO "
    fi
    printf "│ %-44s │ %s │ %-61s │\n" "$name" "$stat_str" "$detail"
  done
  echo "└──────────────────────────────────────────────┴──────┴─────────────────────────────────────────────────────────────┘"
  echo
  echo "SUMMARY: $pass_count PASS, $fail_count FAIL"
}

# 1. node --test test/*.test.js (count pass and fail)
echo "[1/8] Running unit tests..."
if output=$(node --test test/*.test.js 2>&1); then
  passed=$(echo "$output" | grep -E '^ℹ pass' | sed -E 's/.*pass ([0-9]+).*/\1/' | tail -1)
  failed=$(echo "$output" | grep -E '^ℹ fail' | sed -E 's/.*fail ([0-9]+).*/\1/' | tail -1)
  passed=${passed:-0}
  failed=${failed:-0}
  add_result "Unit tests" "PASS" "pass=$passed fail=$failed"
else
  passed=$(echo "$output" | grep -E '^ℹ pass' | sed -E 's/.*pass ([0-9]+).*/\1/' | tail -1)
  failed=$(echo "$output" | grep -E '^ℹ fail' | sed -E 's/.*fail ([0-9]+).*/\1/' | tail -1)
  passed=${passed:-0}
  failed=${failed:-0}
  add_result "Unit tests" "FAIL" "pass=$passed fail=$failed (exit code non-zero)"
fi

# 2. node tools/honesty-scan.js (must pass)
echo "[2/8] Running honesty scan..."
if node tools/honesty-scan.js >"$WORKDIR/honesty.out" 2>&1; then
  add_result "Honesty scan" "PASS" "no violations"
else
  violations=$(grep -c '^  [^:]*:[0-9]*$' "$WORKDIR/honesty.out" 2>/dev/null || echo "?")
  add_result "Honesty scan" "FAIL" "$violations violations"
fi

# 3. bash tools/check-secrets.sh --tree (current tree) + history as info
echo "[3/8] Running secret scan (tree + history)..."
tree_out=$(bash tools/check-secrets.sh --tree 2>&1)
tree_status=$?
if [ $tree_status -eq 0 ]; then
  add_result "Secrets (tree)" "PASS" "clean"
else
  add_result "Secrets (tree)" "FAIL" "hits found"
fi
hist_status=0
hist_out=$(bash tools/check-secrets.sh 2>&1) || hist_status=$?
if [ $hist_status -eq 0 ]; then
  hist_detail="clean"
else
  hits=$(echo "$hist_out" | grep -c '^  ' || echo "0")
  hist_detail="$hits hits in history (info)"
fi
add_result "Secrets (history)" "INFO" "$hist_detail"

# 4. node web/build.js --audit audit/v2-31-final in a temp copy
echo "[4/8] Building site data (audit/v2-31-final)..."
BUILD_OUT="$WORKDIR/build"
mkdir -p "$BUILD_OUT"
if node web/build.js --audit audit/v2-31-final --out "$BUILD_OUT" >"$WORKDIR/build.out" 2>&1; then
  # Extract headline numbers
  audit_id=$(grep '^Audit:' "$WORKDIR/build.out" | head -1 | sed 's/Audit: //')
  repos=$(grep '^Repos:' "$WORKDIR/build.out" | head -1 | sed 's/Repos: //')
  verdicts=$(grep '^Verdicts:' "$WORKDIR/build.out" | head -1 | sed 's/Verdicts: //')
  runs_exported=$(grep 'web/public:' "$WORKDIR/build.out" | head -1 | sed -E 's/.* ([0-9]+) runs.*/\1/')
  audits_exported=$(grep 'web/public:' "$WORKDIR/build.out" | head -1 | sed -E 's/.* ([0-9]+) audits.*/\1/')
  add_result "Site build (audit/v2-31-final)" "PASS" "audit=$audit_id repos=$repos verdicts=$verdicts runs=$runs_exported audits=$audits_exported (pre-Bob)"
else
  add_result "Site build (audit/v2-31-final)" "FAIL" "build failed"
  cat "$WORKDIR/build.out"
fi

# 5. Web budgets
echo "[5/8] Checking web budgets..."
# Total JS gzip size
total_js_gzip=0
for f in web/public/assets/*.js web/public/app/*.js web/public/humble-console/*.js; do
  [ -f "$f" ] && sz=$(gzip -c "$f" | wc -c) && total_js_gzip=$((total_js_gzip + sz))
done
# Limit: 70 KB (adjustable)
JS_LIMIT=71680
if [ $total_js_gzip -le $JS_LIMIT ]; then
  add_result "JS gzip budget" "PASS" "total=${total_js_gzip}B limit=${JS_LIMIT}B"
else
  add_result "JS gzip budget" "FAIL" "total=${total_js_gzip}B limit=${JS_LIMIT}B"
fi

# No file > 5MB in web/public
big_files=$(find web/public -type f -size +5M 2>/dev/null | wc -l)
if [ "$big_files" -eq 0 ]; then
  add_result "Max file size" "PASS" "no file > 5MB"
else
  add_result "Max file size" "FAIL" "$big_files files > 5MB"
fi

# Every img has alt text
missing_alt=0
for html in web/public/*.html web/public/app/*.html; do
  [ -f "$html" ] || continue
  # grep for <img without alt=
  if grep -n '<img' "$html" | grep -v 'alt=' >/dev/null 2>&1; then
    missing_alt=$((missing_alt + 1))
  fi
done
if [ $missing_alt -eq 0 ]; then
  add_result "Image alt text" "PASS" "all images have alt"
else
  add_result "Image alt text" "FAIL" "$missing_alt images missing alt"
fi

# index.html og:image points to brand/cover-1920.jpg or og-1200.jpg
og_image=$(grep -E 'property="og:image"' web/public/index.html | sed -E 's/.*content="([^"]+)".*/\1/' | head -1)
if echo "$og_image" | grep -qE '(cover-1920|og-1200)\.jpg'; then
  add_result "OG image" "PASS" "$og_image"
else
  add_result "OG image" "FAIL" "$og_image (expected cover-1920.jpg or og-1200.jpg)"
fi

# 6. Links: every local href and src in web/public/*.html resolves to a file
echo "[6/8] Checking local links..."
broken_links=0
for html in web/public/*.html web/public/app/*.html; do
  [ -f "$html" ] || continue
  # Extract local href/src (not http(s), not data:, not #)
  links=$(grep -oE '(href|src)="([^"]+)"' "$html" | sed -E 's/.*="([^"]+)".*/\1/' | grep -vE '^(http|data:|#|//|mailto:|tel:)' || true)
  while IFS= read -r link; do
    [ -z "$link" ] && continue
    case "$link" in
      /*) target="web/public${link}" ;;
      *) dir=$(dirname "$html"); target="${dir}/${link}" ;;
    esac
    target=$(echo "$target" | sed 's/[?#].*$//')
    # Skip Vercel rewrite targets (they resolve via vercel.json rewrites, not as files)
    case "$target" in
      web/public/|web/public/app/|web/public/proof|web/public/audit) continue ;;
    esac
    [ -f "$target" ] || { echo "  BROKEN: $html -> $link ($target)"; broken_links=$((broken_links + 1)); }
  done <<< "$links"
done
if [ $broken_links -eq 0 ]; then
  add_result "Local links" "PASS" "all resolve"
else
  add_result "Local links" "FAIL" "$broken_links broken"
fi

# 7. vercel.json valid JSON, git.deploymentEnabled keeps only main
echo "[7/8] Checking vercel.json..."
if node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8'))" 2>/dev/null; then
  main_only=$(node -e "
    const v = JSON.parse(require('fs').readFileSync('vercel.json', 'utf8'));
    const g = v.git?.deploymentEnabled;
    if (!g) { console.log('missing'); process.exit(1); }
    const keys = Object.keys(g);
    // Only 'main' should be true; '*' and '**' can exist but must be false
    const ok = g.main === true && g['*'] === false && g['**'] === false;
    console.log(ok ? 'ok' : 'bad:' + JSON.stringify(g));
    if (!ok) process.exit(1);
  ")
  if [ "$main_only" = "ok" ]; then
    add_result "vercel.json" "PASS" "valid JSON, git.deploymentEnabled only main"
  else
    add_result "vercel.json" "FAIL" "$main_only"
  fi
else
  add_result "vercel.json" "FAIL" "invalid JSON"
fi

# 8. Author check: every commit in origin/main..HEAD authored by b25bb1004@iitj.ac.in or karmanyapatil@gmail.com
echo "[8/8] Checking commit authors..."
other_authors=$(git log --format="%ae" origin/main..HEAD 2>/dev/null | sort -u | grep -vE '^(b25bb1004@iitj\.ac\.in|karmanyapatil@gmail\.com)$' || true)
if [ -z "$other_authors" ]; then
  add_result "Commit authors" "PASS" "all commits by allowed authors"
else
  add_result "Commit authors" "FAIL" "other authors: $(echo "$other_authors" | tr '\n' ' ')"
fi

# Print results table
print_table

# Report check-secrets real last line
echo
echo "==============================================================================="
echo "check-secrets.sh (history) last line:"
echo "==============================================================================="
echo "$hist_out" | tail -1

# Exit code
echo
if [ $fail_count -eq 0 ]; then
  echo "GATE RESULT: PASS — friday/integration is ready to become main"
  exit 0
else
  echo "GATE RESULT: FAIL — $fail_count checks failed"
  exit 1
fi