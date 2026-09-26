# HUMBLE landing page redesign: brief for Zeus

Karmanya's call (26 Sep): the current landing page "won't do". Redesign `web/public/index.html` using the
**design-taste-frontend** skill in `docs/design/skills/design-taste-frontend/SKILL.md` (installed from
github.com/Leonxlnx/taste-skill; reviewed by Edith: a design guide only, no commands, nothing secret).
Read the whole skill first. It is contextual; pull only what fits this brief.

## Skills to use, in this order

1. **`design-taste-frontend`**: the direction, layout and anti-defaults (the main skill).
2. **`emil-design-eng`**: polish and the invisible details (Emil Kowalski's design-engineering philosophy).
3. **`apple-design`**: fluid, physical motion translated for the web. Use it for the one cinematic moment.
4. **`find-animation-opportunities` → `animate` → `review-animations`**: find where motion earns its place, build
   it, then review it against the craft bar. `animation-vocabulary` names effects precisely; `improve-animations`
   audits what already exists.
5. **`mobile-native`**: make it feel right on a phone (many judges open the link on mobile).
6. **`impeccable`** (pbakaus/impeccable): after the first pass, use its `reference/critique.md`, `audit.md`,
   `polish.md` and `typeset.md` / `colorize.md` guidance to review and tighten the page. **Guidance only:** its
   launcher script, native binary and live-browser tool are deliberately *not* included (the launcher downloads
   a binary). Ignore any step that says to run `impeccable …`, `scripts/…` or the live browser.

Left out on purpose (from emilkowalski/skills): `animate-expo`, `ask-sonner`, `pick-ui-library`, `prototype`
(React or React Native) and `write-swift`. The landing page is one static HTML file, and adding React or a build step
the day before submission isn't worth the risk.

## Design Read (skill §0.B)

> Reading this as: **a dev-tools product landing page for hackathon judges and working developers**, with a
> **dark-tech, precise, Linear-style** language that has one cinematic moment, leaning toward **native HTML/CSS +
> restrained scroll-reveal motion** (the page is a single static file on Vercel; no framework, no build step).

**Dials (§1):** `DESIGN_VARIANCE 6 · MOTION_INTENSITY 5 · VISUAL_DENSITY 4`. It should feel technical and
trustworthy, not an Awwwards experiment: judges have to *believe the numbers*.

## Scope and timing

- **Only `web/public/index.html` (and its inline CSS/JS)**, before the **18:00 IST feature freeze**. The skill itself
  says it's not for dashboards; leave `web/public/app/` (the dashboard) alone: the demo videos are recorded on it.
- One PR, screenshots of desktop + mobile + light/dark in the PR description.

## Must keep (non-negotiable)

1. **Name and tagline:** "HUMBLE" · "Your README, proven." · "Powered by IBM Bob".
2. **Real numbers only, word for word:** *16 public repos · 9 of 14 followable READMEs broke on a clean machine ·
   22 breaks, 11 fixed and re-verified from zero.* No new stats, no invented testimonials, logos, customer counts
   or "trusted by" rows (skill §4.10: no fake quotes).
3. **Working pieces:** the "Check a README now" form (`/api/check`), the links to `/audit` and `/proof`, the Lens
   section, the IBM Bob section, the nav anchors.
4. **Brand tokens** (skill §11 "Redesign - Preserve"): navy background, verify-green `#3ddc84`, Bob-blue
   `#4c8dff`, the green shield + four-point blue spark from `docs/pitch/cover.jpg`. Evolve the type, layout and
   motion around them.

## Must avoid

- **No placeholder photography** (the skill suggests picsum.photos; don't, it's fake content) and **no brand
  logos from icon CDNs** (Simple Icons etc.). Real visuals only: product screenshots from `/audit` and
  `/proof`, the cover art, and Arnav's desk/whiteboard photos (with posters and can logos cropped out).
- The skill's anti-defaults (§0.D): no AI-purple gradients, no centered hero over dark mesh, no three equal
  feature cards, no glassmorphism everywhere.
- Mandatory from the skill: `prefers-reduced-motion` respected (§6.B), light + dark both working (§6.C),
  no layout shift, fast (§6.D). The page must stay fully usable with JS off except the check form.

## Story order (suggested)

1. **Hero:** the promise + the real stat + "Check a README now".
2. **The problem:** day one, the README drifts (one line of copy + one visual).
3. **How it works:** the agent crew (Scout → Planner → Runner → Doctor → Verifier → Scribe) with Bob as the
   operator, as a sequence, not as three equal cards.
4. **Proof:** the audit and the acme-shop replay (real screenshots, linking to `/audit` and `/proof`).
5. **Lens and IBM Bob.**
6. **Footer:** repo, MIT license, team HUMBLE.
