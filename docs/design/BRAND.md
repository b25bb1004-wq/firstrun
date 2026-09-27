# HUMBLE brand kit

Source: logo SVGs and banner from Avtansh Singh Brar (27 Sep 2026). Files in `web/public/brand/`.

| file | use |
|---|---|
| `humble-logo.svg` | mark + wordmark (827×181), nav bar, deck title, README header |
| `humble-mark.svg` | mark only (189×181), favicon, app icon, Dock button, console header |
| `humble-wordmark.svg` | wordmark only (633×122) |
| `humble-mark-white.svg` | white mark (716×537) for dark backgrounds, video end card |
| `banner-1920.jpg` | hero / submission cover (1920×1080, from the 3840×2160 original) |
| `og-1200.jpg` | Open Graph / social card (1200×675) |
| `cover-1920.jpg` | **lablab submission cover** (Banner 2: gradient, logo, tagline, "Powered by IBM BOB 2.0"); 3840×2160 original kept outside the repo |
| `gradient-bg-1920.jpg` | the soft teal-navy gradient behind Banner 2, for deck slides and section backgrounds |

Two looks, one identity: **Banner 1** (blueprint paper, pink crack, blue thread) tells the story; **Banner 2** (gradient + dashed orbit arcs) is the clean cover. Both use the same logo, tagline and agent row.

The logo SVGs have no fill (they render in `currentColor`-like black by default); set `fill` from the tokens below. The white mark already fills `#fffefe`.

## Theme (read from the banner; it matches the landing's existing oat/ink/blue/pink palette)

| token | value | role in the banner |
|---|---|---|
| `--brand-paper` | `#f4e9dc` | drafting paper background (light theme bg) |
| `--brand-paper-2` | `#e9dccd` | paper shadows, cards |
| `--brand-ink` | `#0d1030` | logo, headline ink |
| `--brand-ink-2` | `#55546c` | sub-headline grey |
| `--brand-blue` | `#2d4fa0` | "fixes itself." accent text |
| `--brand-electric` | `#1f3bff` | the fix: blue thread, the corrected command box |
| `--brand-crack` | `#f0287a` | the break: pink cracks, the failing command highlight |
| `--brand-line` | `#b9aa9c` | blueprint construction lines |

Story in the art: a README torn by a pink crack at `npm install`, the robot stitching it with a blue thread into `npm install --legacy-peer-deps`. Tagline: **"The README, that fixes itself."** Sub: **"Your setup docs, tested from a clean machine."** Agent row: HARVEY · UNITY · MACH · DR.BO · LARP · ECHO.

Motifs to reuse: blueprint grid and construction lines (compass arcs, crosshairs), monospace code on paper, pink = broken, blue = fixed. The dark console (HUMBLE_CONSOLE_SPEC) keeps its amber tokens; its `fail` and `fix` colours should use `--brand-crack` and `--brand-electric` on light surfaces.

Honesty note: the banner's README is illustrative art, not a run. The `--legacy-peer-deps` fix it shows is real in our GeekyAnts run (see `web/public/data/reels/geekyants.json`), so the art can be captioned with that run.
