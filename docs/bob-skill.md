# HUMBLE as a Bob Skill — Judge Quickstart

1. Copy `bob/skill/HUMBLE.md` into your Bob workspace: `mkdir -p .bob/skills && cp bob/skill/HUMBLE.md .bob/skills/`
2. Restart Bob IDE (or reload skills).
3. Switch to **🚀 HUMBLE** mode in Bob IDE.
4. Say: `HUMBLE, prove the setup docs for https://github.com/b25bb1004-wq/firstrun`
5. HUMBLE runs `firstrun_plan` → lists conflicts in seconds.
6. HUMBLE runs `firstrun_verify` with your Bobcoin budget → repairs, replays, writes Passport.
6. Read the verdict, evidence records (`docs said / cause / fix / verified`), and clone-to-running time.
7. Badge: `![HUMBLE](https://raw.githubusercontent.com/b25bb1004-wq/firstrun/main/.github/firstrun/passport.svg)`
8. No Docker needed for `plan`; `verify` needs Docker (clean container = clean machine).
9. Every fix is proven by replay — nothing claimed without evidence.
10. All tools are from this repo: `firstrun_plan`, `firstrun_verify`, `firstrun_status`, `firstrun_evidence`, `firstrun_guide`, `firstrun_drift`.