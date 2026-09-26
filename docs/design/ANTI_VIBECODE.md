# HUMBLE site: the anti-"vibecoded" rules (Karmanya's list, binding)

Karmanya's reference: *"30 reasons your site looks vibecoded"*. Every item is a thing to **avoid**. These rules
**override** the design skills in `docs/design/skills/` wherever they disagree (e.g. the skill suggests Geist; we don't
use it). Owners: Edith (structure, type, CSS) and Zeus (motion). Check every section against this before pushing.

| # | Avoid | What we do instead on HUMBLE |
|---|---|---|
| 1 | Harsh gradients | Flat colour fields; at most one very subtle tonal shift inside a single hue. |
| 2 | Lucide icons | No icon set. Where a symbol is needed, a small custom SVG glyph drawn for us, or none. |
| 3 | Pure white background | Light theme is a warm-neutral off-white (never #fff); dark theme is graphite, not black. |
| 4 | Rainbow colouring | One accent colour for the whole page. Status colours (pass/fail) only inside real product screenshots. |
| 5 | Drop shadows | Separation with hairline borders and spacing, no box-shadows. |
| 6 | 3 feature cards in a row | Sequences, lists and full-width rows; the agent crew is a timeline, not cards. |
| 7 | Emojis | None anywhere on the site (including the Bob mode names in copy: write "Guide mode", not "🧭"). |
| 8 | Liquid glass | No blur/backdrop-filter surfaces. |
| 9 | Em dashes | Not in any copy. Use commas, colons, full stops. |
| 10 | Inter / Geist / Space Grotesk | **IBM Plex Sans** (text + display) and **IBM Plex Mono** (commands, numbers). |
| 11 | Coloured left stripe | No border-left callouts. Notes are plain text with a label. |
| 12 | Fake testimonials | None. Only our real audit numbers and real run recordings. |
| 13 | Bento grids | Editorial single-column flow with a few wide asymmetric splits. |
| 14 | Terminal window mockups | No fake terminals. Show real product screenshots/recordings (dashboard, passport, README diff). |
| 15 | "It's not X, it's Y" | Plain, specific sentences. No contrast-slogans. |
| 16 | Checkmark bullets | Numbered steps or plain text. |
| 17 | 3 pricing tiers | No pricing tiers on the landing page (flag for PR #89). |
| 18 | No real product demos | **Real** demos: the recorded acme-shop replay, the real audit dashboard, the GeekyAnts VERIFIED README diff. |
| 19 | Soft corner radius | Sharp: 0 to 2 px radius. |
| 20 | Purple and black | No purple anywhere. |
| 21 | No skeleton loaders | The "Check a README" result shows a proper skeleton while it loads. |
| 22 | Radial orbs | No glows, orbs or blurred blobs behind content. |
| 23 | Dot grids | No dot/grid background patterns. |
| 24 | Sparkle icons | **The Bob four-point spark goes.** IBM Bob is named in type; HUMBLE gets a new mark (a typographic wordmark, no sparkle). |
| 25 | Animated arrows | Links are underlined text; no bouncing/sliding arrows. |
| 26 | No TOS | Add `/terms` (plain, short, honest: hackathon project, MIT licence, no warranty). |
| 27 | No privacy policy | Add `/privacy` (what the README check sends, that nothing is stored, no tracking). |
| 28 | Hover animations | No hover motion (no lifts, scales, glows). Hover = colour/underline change only. |
| 29 | Neon colours | The old #3ddc84 is too neon. One calm accent, see tokens below. |
| 30 | Basic pastel colours | No pastels. |

## Motion, within these rules

Karmanya asked for **pro motion graphics and high-quality animation**. That fits the list as long as motion is
**choreographed and meaningful**, not decorative: a hero sequence that tells the story (a README step fails, gets
fixed, the machine rebuilds, everything passes), and scroll-driven reveals of real product footage. No hover
motion, no looping micro-animations, no animated arrows. Everything honours `prefers-reduced-motion` (the final
frame, static).

## Tokens (Edith, `web/public/assets/site.css`)

- Type: IBM Plex Sans 400/500/600, IBM Plex Mono 400/500. Display sizes set tight (tracking -0.02em), body 17px/1.6,
  max 64ch.
- Dark (default): background `#111315`, surface `#171a1d`, hairline `#2a2e33`, text `#e9e7e2`, muted `#9a9893`.
- Light: background `#f1efe9`, surface `#e9e6de`, hairline `#d3cfc5`, text `#16181b`, muted `#5d5a54`.
- **Single accent:** `#2f9e6b` (a calm verified green; `#56c08c` on dark for contrast). Nothing else is coloured.
- Radius 2px. No shadows. Borders 1px hairline.

## Overrides Karmanya made later (26 Sep) and what still holds

- **Colour:** oat · blue · hot pink (Karmanya's palette). Blue = proven/fixed, hot pink = broken. Hot pink is the one
  bright colour allowed; still no neon glows, no pastels, no purple.
- **Motion:** Apple/Meta-level motion is wanted (the WebGL hero, sticky crew, count-ups, reveals). Still no hover motion.
- **Everything else in the table above still holds.** After the premium pass, an audit (16:50) found 9 violations
  (soft radii, shadows/text glow, purple, a "not X" headline, coloured tile stripes, a checkmark, a ✚ glyph, three boxed
  stat cards, pastel tints). All fixed in the next commit. Re-run the audit before every push.
