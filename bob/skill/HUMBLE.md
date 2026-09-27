# HUMBLE — Bob Skill

Drop this file into your Bob workspace (`.bob/skills/HUMBLE.md`) to add a **HUMBLE** skill that verifies any repository's setup docs on a clean machine and fixes them with evidence.

---

## What this skill gives you

In Bob IDE, switch to **🚀 HUMBLE** mode and say:

> `HUMBLE, prove the setup docs for https://github.com/owner/repo`

HUMBLE will:
1. **Plan** — read the repo's README, manifests, CI and compose files; list every docs-vs-code conflict in seconds (no Docker).
2. **Verify** — follow the plan in a clean container, repair each break with evidence (deterministic rules first; IBM Bob for unknown failures), replay the repaired guide from zero.
3. **Report** — hand you a corrected README diff, a Setup Passport badge, and the evidence report (`FIRSTRUN.md`).

---

## Install (pick one)

| Method | Command |
|--------|---------|
| **Copy file** | `mkdir -p .bob/skills && curl -fsSL https://raw.githubusercontent.com/b25bb1004-wq/firstrun/main/bob/skill/HUMBLE.md -o .bob/skills/HUMBLE.md` |
| **npm / npx** | `npx github:b25bb1004-wq/firstrun bob install` (adds global Bob Shell modes) |
| **Local bin** | `git clone https://github.com/b25bb1004-wq/firstrun && cd firstrun && npm install && node bin/firstrun.js bob install` |

Bob IDE picks up `.bob/skills/HUMBLE.md` automatically. Restart Bob IDE or reload skills.

---

## Commands the skill exposes to Bob

These are the **MCP tools** HUMBLE registers (from `src/mcp.js`):

| Tool | Purpose |
|------|---------|
| `firstrun_plan` | Read a repo's setup docs next to manifests/CI/compose; return ordered steps + conflicts. Fast, no Docker. |
| `firstrun_verify` | Run the plan in a clean container, repair with evidence, replay from zero. Returns a `runId`; poll with `firstrun_status`. |
| `firstrun_status` | Current phase, per-step status, evidence records, Setup Passport. |
| `firstrun_evidence` | One evidence record: failing command/output, diagnosis (rule or Bob), fix, passing output. |
| `firstrun_guide` | Verified setup steps with expected results and known failure signatures for walking a newcomer. |
| `firstrun_drift` | Docs-vs-code conflicts introduced between a base ref and HEAD (PR drift guard). |

**CLI fallbacks** (when MCP not available):
```bash
# From the HUMBLE repo
node bin/firstrun.js plan <repo>
node bin/firstrun.js verify <repo> --bob-budget 3
node bin/firstrun.js status <run-dir>
# Or via npx (no clone needed)
npx github:b25bb1004-wq/firstrun plan <repo>
npx github:b25bb1004-wq/firstrun verify <repo> --bob-budget 3
```

---

## How to use it in Bob

1. **Switch to HUMBLE mode** in Bob IDE (the 🚀 HUMBLE custom mode from this skill).
2. **Say**: `HUMBLE, prove the setup docs for https://github.com/owner/repo`
3. HUMBLE calls `firstrun_plan` → summarises conflicts in plain words.
4. HUMBLE calls `firstrun_verify` with a **Bobcoin budget you set** (default 3) → explains what each agent (Scout, Planner, Runner, Doctor, Verifier, Scribe) does while it runs.
5. When finished, HUMBLE reads `.firstrun/run.json` and `out/FIRSTRUN.md` and reports:
   - Verdict (VERIFIED / PARTIAL / INCONCLUSIVE / FAILED / CI-ONLY)
   - First place a newcomer would have got stuck
   - Each evidence record: **docs said / cause / fix / verified**
   - Clone-to-running time

---

## Rules this skill enforces

- **Never** apply `out/pr` to the repository or open a PR without your explicit go-ahead. When you agree, HUMBLE runs `firstrun pr <repo>`.
- **Never** claim a fix that the replay did not prove. Every repair is backed by an evidence record showing the step passing after the fix in a brand-new container.
- **Explain each break from the evidence files** — the diagnosis class (`wrong-runtime`, `missing-service`, `undocumented-env`, `renamed-script`, `stale-file`, `peer-conflict`, `missing-tool`, `migration-needed`, `bob-diagnosed`), the cause, the fix, and the verified passing output.
- **Use only commands and MCP tools that exist in this repo** (listed above).
- **Budget**: the `--bob-budget` (Bobcoins) caps what IBM Bob may spend on unknown failures. Rules are free.

---

## Files this skill needs (already in the HUMBLE repo)

```
.bob/custom_modes.yaml   # 4 custom modes: 🚀 HUMBLE, 🩺 HUMBLE Doctor, 🗺️ HUMBLE Planner, 🧭 HUMBLE Guide
.bob/mcp.json            # MCP server config (stdio: node bin/firstrun.js mcp)
src/mcp.js               # 6 tools: plan, verify, status, evidence, guide, drift
src/brain/modes.js       # Mode definitions (also generates .bob/custom_modes.yaml)
src/scribe/passport.js   # passportBadge() → shields.io-style SVG badge
src/scribe/index.js      # Writes .github/firstrun/passport.svg + passport.json
bin/firstrun.js          # CLI entry point (all subcommands above)
```

---

## Verified badge (Setup Passport)

After a run finishes, the Scribe writes:
- `.github/firstrun/passport.svg` — shields.io-style badge (e.g. `HUMBLE verified · 42s`)
- `.github/firstrun/passport.json` — full passport data

**Markdown snippet to paste in your README** (the Scribe also writes this into `FIRSTRUN.md`):

```markdown
![HUMBLE](https://raw.githubusercontent.com/OWNER/REPO/main/.github/firstrun/passport.svg)
```

Replace `OWNER/REPO` with your repo. The badge links to the Setup Passport JSON at the same path.

---

## Quick test

```bash
# Verify HUMBLE's own demo repo (needs Docker)
node bin/firstrun.js verify examples/acme-shop --brain rules

# Or via MCP in Bob IDE (after installing this skill)
# Say: "HUMBLE, prove the setup docs for ./examples/acme-shop"
```

---

## License

Apache-2.0 — same as HUMBLE.