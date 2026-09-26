# FirstRun: animated explainer video, shooting script

**Length:** about 90 s · **Format:** 16:9, 1080p (4K if the Veo plan allows) · **Audience:** developers (maintainers, and anyone who has joined a project) · **Tone:** warm, a little funny, cinematic; no jargon, no architecture diagrams.

**The one idea:** every developer knows the first-day pain of a README that "just works" and doesn't. FirstRun follows your setup docs on a brand-new machine exactly like a new teammate would, fixes what breaks, proves the fix by doing it all again from zero, and hands you a README that works. IBM Bob runs the show.

**Production:** generated with Google Veo (latest version available to the team), one clip per shot below, edited together in DaVinci Resolve or CapCut.

---

## Rules for every shot (read before generating)

1. **No text from Veo.** AI video renders letters as gibberish (we already had to redo the cover for this). Every word on screen (titles, terminal lines, numbers, the README) is added in the edit. In prompts, screens and papers show *abstract* glowing lines or shapes, never readable text. Put `no readable text, no letters, no logos, no watermarks` in every prompt.
2. **Real numbers only.** The only statistics in the video are from our frozen audit (`audit/real-16-v3`, identical to v2): **16 public repos, 9 of the 14 with setup docs broke on a clean machine, 11 breaks fixed and re-verified from zero.** Nothing else, no invented "hours saved" or "X% of teams".
3. **No real people, no real company logos.** The newcomer is a stylised animated character. "IBM Bob" appears only as our operator character (a glowing blue spark), with the name added in the edit.
4. **One look throughout.** Use the style bible below, and feed Veo the same reference images each time (image-to-video / reference-image mode): `docs/pitch/cover.jpg` for palette and mood, and the Dock character SVGs for the agents (`lens/dock/characters/`, on Zeus's PR #92 branch until it merges).
5. **Voice-over and music are recorded separately** (or with one consistent TTS voice) and laid over the edit, so the voice doesn't change between clips. Veo's own ambient sound can stay under it at low volume.

## Style bible

- **Look:** stylised 3D animation, soft cinematic lighting, shallow depth of field, gentle film grain. Think a Pixar-style short made by a dev-tools company: friendly, not childish.
- **Palette:** deep navy night (#0b1220), cool slate greys, **verify-green** (#3ddc84) for success, **Bob-blue** (#4c8dff) for Bob and the agents, a warm amber desk-lamp glow for the human moments, and a muted red only for errors.
- **The Newcomer:** a young developer, gender-neutral, hoodie, big expressive eyes, friendly face. Same character in every human shot.
- **Bob:** a small floating four-point blue spark (like the one on our cover) that glows brighter when he speaks. He has no mouth; he communicates with light and motion.
- **The agents (Bob's crew):** six small rounded robots, each with one blue glowing trait. **Scout** (binoculars/antenna), **Planner** (holds a glowing checklist), **Runner** (sneakers, fast), **Doctor** (stethoscope), **Verifier** (magnifying glass), **Scribe** (quill pen). Match the Dock characters.
- **The Clean Machine:** a pristine, empty glass room that glows faintly, floating in darkness. It's the "brand-new computer" metaphor: nothing installed, nothing assumed.

---

## Shot list

Timings are targets. Each shot is one Veo clip (≤ 8 s). Trim in the edit.

### ACT 1: The problem (0:00–0:25)

**Shot 1: Day one (cinematic cold open), 7 s**
- *Picture:* Night. Rain streaks down a big window; city lights blurred behind. Slow push-in on the Newcomer at a desk under a warm lamp, opening a laptop. The screen's glow lights their hopeful face.
- *Camera:* slow dolly-in from behind the rain-streaked glass, rack focus from raindrops to the face.
- *VO:* "Day one. New project. The README says it just works."
- *On-screen (edit):* nothing.
- *Veo prompt:* `Cinematic stylized 3D animation, night, rain streaking down a large window with blurred city lights, slow dolly-in through the glass toward a young gender-neutral developer in a hoodie at a desk under a warm amber lamp, opening a laptop, soft blue screen glow on a hopeful face, shallow depth of field, rack focus from raindrops to face, film grain, deep navy and amber palette, no readable text, no letters, no logos, no watermarks`

**Shot 2: It doesn't just work, 7 s**
- *Picture:* Over-the-shoulder on the laptop. The Newcomer types; each command they send becomes a glowing brick stacking into a little tower on the desk. The fourth brick flashes red, and the tower wobbles and collapses in slow motion.
- *Camera:* over-the-shoulder, then a low-angle slow-mo on the falling bricks.
- *VO:* "It never just works."
- *On-screen (edit):* red error lines on the laptop, drawn in post: `command not found` · `connection refused` · `missing environment variable`.
- *Veo prompt:* `Stylized 3D animation, over-the-shoulder view of a developer typing on a laptop at night, glowing translucent bricks rise from the keyboard and stack into a small tower on the desk, one brick flashes muted red and the tower wobbles and collapses in slow motion, low angle, cinematic lighting, navy and amber palette with a muted red accent, no readable text, no letters, no logos, no watermarks`

**Shot 3: The rabbit hole, 7 s**
- *Picture:* Time-lapse. The window goes from night to dawn. Coffee cups multiply across the desk. Browser tabs float up around the Newcomer like a swirl of blank cards; a chat bubble pops up and hangs, unanswered. The Newcomer slumps.
- *Camera:* locked-off time-lapse, slight slow orbit.
- *VO:* "Hours lost to a step nobody wrote down, a version that moved on, a service nobody mentioned."
- *On-screen (edit):* the chat bubble reads "anyone know how to run this locally?" and stays unanswered.
- *Veo prompt:* `Stylized 3D animation time-lapse, a tired developer at a desk as the window turns from night to dawn, coffee cups multiply across the desk, blank floating cards swirl around their head like browser tabs, an empty speech bubble pops up and hangs, the developer slumps onto folded arms, slow orbit camera, cinematic, navy fading to pale dawn light, no readable text, no letters, no logos, no watermarks`

**Shot 4: The quiet truth, 4 s**
- *Picture:* Close-up of an old printed page (the README) pinned to a corkboard, curling at the corner, slowly fading and yellowing, as dust falls through a beam of light.
- *VO:* "READMEs don't break on purpose. They just drift."
- *Veo prompt:* `Cinematic macro close-up, an old paper page pinned to a corkboard, corner curling, slowly yellowing and fading, dust particles drifting through a single beam of light, shallow depth of field, moody, no readable text, no letters, no logos, no watermarks`

### ACT 2: Meet FirstRun (0:25–1:10)

**Shot 5: Title and Bob arrives, 6 s**
- *Picture:* Darkness. A small four-point blue spark ignites and drifts down, landing softly beside the laptop. The desk brightens; the Newcomer lifts their head.
- *VO:* "So we built FirstRun. And IBM Bob runs it."
- *On-screen (edit):* title card over the spark: **FirstRun**, then "Your README, proven." Under it, small: "Powered by IBM Bob".
- *Veo prompt:* `Stylized 3D animation, total darkness, a small glowing four-point blue star spark ignites and drifts gently down to land beside a laptop on a desk, the desk brightens with soft blue light, a tired developer lifts their head in surprise, cinematic, deep navy with bright blue glow, no readable text, no letters, no logos, no watermarks`

**Shot 6: The crew deploys, 7 s**
- *Picture:* The spark pulses, and six small rounded robots pop out of the light one by one (Scout, Planner, Runner, Doctor, Verifier, Scribe), each striking a tiny pose, then march toward the laptop screen, which opens like a doorway.
- *VO:* "Bob sends in a crew that reads your docs the way a new teammate would."
- *On-screen (edit):* each robot's name appears briefly under it.
- *Veo prompt:* `Stylized 3D animation, a glowing blue spark pulses and six small friendly rounded robots pop out of the light one by one, one with an antenna and binoculars, one holding a glowing checklist, one in sneakers, one with a stethoscope, one with a magnifying glass, one with a quill pen, each with soft blue glowing accents, they strike tiny poses then march toward a laptop screen that opens like a glowing doorway, playful, cinematic lighting, no readable text, no letters, no logos, no watermarks`

**Shot 7: The clean machine (cinematic), 8 s**
- *Picture:* The crew steps through the doorway into a vast, pristine, empty glass room floating in darkness, completely bare. The camera cranes up and out to reveal how empty it is.
- *VO:* "They start on a brand-new machine. Nothing installed. Nothing assumed. Exactly like your next hire's laptop."
- *Camera:* crane up and pull back, wide establishing shot.
- *Veo prompt:* `Cinematic stylized 3D animation, six small rounded robots step through a glowing doorway into a vast pristine empty glass room floating in dark space, faint blue grid lines on the floor, completely bare, crane shot rising up and pulling back to reveal the emptiness, awe, volumetric light, deep navy and cool blue, no readable text, no letters, no logos, no watermarks`

**Shot 8: Following the steps, 7 s**
- *Picture:* Glowing stepping-stones appear across the glass floor, one per README step. The Runner robot hops from stone to stone; each lights up green under its feet. The Planner robot ticks items off its glowing checklist.
- *VO:* "They follow your setup steps, one by one."
- *On-screen (edit):* green ticks with short real commands next to the stones, e.g. `npm install` ✓ · `docker compose up -d` ✓.
- *Veo prompt:* `Stylized 3D animation, glowing stepping stones appear in a line across a glass floor, a small robot in sneakers hops from stone to stone and each stone lights up bright green under its feet, a second small robot follows ticking a glowing checklist, cheerful momentum, cinematic tracking shot, navy and green palette, no readable text, no letters, no logos, no watermarks`

**Shot 9: A break, and the Doctor, 8 s**
- *Picture:* One stepping-stone cracks and glows muted red; the Runner stops short, arms windmilling. The Doctor robot walks up, listens to the stone with its stethoscope, nods, and places a new glowing stone in the gap. It lights green. If the Doctor looks puzzled, the blue spark (Bob) swoops in, circles the crack and lights the answer.
- *VO:* "When a step breaks, the Doctor finds out why: a missing tool, the wrong version, a service nobody started. The easy ones have known fixes. For the tricky ones, Bob steps in."
- *On-screen (edit):* the red stone labelled `connection refused :6379`; the new stone labelled `start Redis`.
- *Veo prompt:* `Stylized 3D animation, a small robot hopping across glowing stepping stones stops short as one stone cracks and glows muted red, a small robot with a stethoscope walks up and listens to the cracked stone, then places a new glowing stone in the gap which lights bright green, a small glowing blue four-point spark swoops in and circles the crack helpfully, warm and funny, cinematic, no readable text, no letters, no logos, no watermarks`

**Shot 10: Prove it from zero (the money shot), 8 s**
- *Picture:* The Verifier robot raises its magnifying glass. The whole glass room shatters into a million sparkling shards that freeze mid-air… then reverse and rebuild into a fresh, empty room. In fast-forward, the crew runs the entire path again, every stone lighting green in a rush, ending at a glowing doorway that opens onto a running app (abstract bright shapes).
- *VO:* "And nothing counts until it works again on a brand-new machine. Every fix is proven from zero."
- *Camera:* bullet-time orbit on the frozen shards, then a fast tracking run.
- *On-screen (edit):* "Replayed from zero ✓".
- *Veo prompt:* `Cinematic stylized 3D animation, a small robot raises a magnifying glass and a glass room shatters into a million sparkling shards that freeze mid-air in bullet time, the camera orbits the frozen shards, then the shards reverse and rebuild into a fresh empty glass room, then in fast forward small robots race along a path of stepping stones that all light up green in sequence, ending at a glowing doorway opening onto bright abstract shapes, triumphant, volumetric light, navy blue and green, no readable text, no letters, no logos, no watermarks`

**Shot 11: The README, fixed, 7 s**
- *Picture:* Back at the desk. The Scribe robot writes with its quill onto the glowing page; the old yellowed page from Shot 4 turns crisp and bright. A round green shield badge with a check mark is stamped onto it with a satisfying thunk.
- *VO:* "Then the Scribe hands you a README that works, with the exact fixes, the evidence, and a badge that says so."
- *On-screen (edit):* a short README diff (green `+` line such as "+ docker compose up -d redis") and the badge **VERIFIED**.
- *Veo prompt:* `Stylized 3D animation, a small robot with a quill pen writes glowing strokes onto an old yellowed paper page which transforms into a crisp bright page, then a round green shield badge with a check mark is stamped onto it with a satisfying bounce, warm desk lamp light, close-up, cinematic, no readable text, no letters, no logos, no watermarks`

### ACT 3: Proof and payoff (1:10–1:30)

**Shot 12: The real numbers, 7 s**
- *Picture:* A wall of 16 floating glass tiles in the dark, each a small abstract repo icon. One by one they light up: most flash red first, then many turn green as the tiny crew runs across them.
- *VO:* "We pointed it at 16 public projects. Nine of the fourteen with setup docs broke on a clean machine. FirstRun fixed eleven breaks and proved every one from zero."
- *On-screen (edit), exact:* **16 public repos · 9 of 14 broke · 11 fixes proven from zero.** Small footnote: "Audit of 16 pinned open-source repos, Sept 2026."
- *Veo prompt:* `Stylized 3D animation, a wall of sixteen floating glass tiles in dark space, each with an abstract glowing icon, tiles flash muted red one after another, then tiny robots run across the wall and many tiles turn bright green, satisfying rhythm, cinematic slow push-in, navy with red and green accents, no readable text, no letters, no numbers, no logos, no watermarks`

**Shot 13: The next day one (cinematic bookend), 8 s**
- *Picture:* Mirror of Shot 1, but daytime, sunny. A *different* newcomer sits at the same desk, opens the laptop, types once, and the screen blooms into a running app. They grin and lean back; through the window, a tiny blue spark waves.
- *VO:* "So your next newcomer's day one looks like this."
- *Camera:* same framing as Shot 1, but pulling *out* this time.
- *Veo prompt:* `Cinematic stylized 3D animation, bright sunny morning, a different young developer at the same desk opens a laptop, types once, the screen blooms with bright colourful abstract app shapes, they grin and lean back relaxed, through the window a tiny glowing blue spark waves, slow dolly-out, warm and hopeful, no readable text, no letters, no logos, no watermarks`

**Shot 14: End card, 5 s**
- *Picture:* Hold on the blue spark and the green shield side by side on the navy background (can reuse the cover art, `docs/pitch/cover.jpg`).
- *VO:* "FirstRun. Your README, proven."
- *On-screen (edit):* **FirstRun** · "Your README, proven." · "Powered by IBM Bob" · the project URL.

---

## Voice-over (full read, about 85 s at a relaxed pace)

> Day one. New project. The README says it just works.
> It never just works.
> Hours lost to a step nobody wrote down, a version that moved on, a service nobody mentioned.
> READMEs don't break on purpose. They just drift.
> So we built FirstRun. And IBM Bob runs it.
> Bob sends in a crew that reads your docs the way a new teammate would.
> They start on a brand-new machine. Nothing installed. Nothing assumed. Exactly like your next hire's laptop.
> They follow your setup steps, one by one.
> When a step breaks, the Doctor finds out why: a missing tool, the wrong version, a service nobody started. The easy ones have known fixes. For the tricky ones, Bob steps in.
> And nothing counts until it works again on a brand-new machine. Every fix is proven from zero.
> Then the Scribe hands you a README that works, with the exact fixes, the evidence, and a badge that says so.
> We pointed it at 16 public projects. Nine of the fourteen with setup docs broke on a clean machine. FirstRun fixed eleven breaks and proved every one from zero.
> So your next newcomer's day one looks like this.
> FirstRun. Your README, proven.

## Sound

- **Music:** starts as a soft lo-fi piano under rain (Act 1), stalls awkwardly on the brick collapse (Shot 2), goes quiet for Shot 4, then an uplifting synth pulse builds from the spark's ignition (Shot 5) to a peak on the shatter-and-rebuild (Shot 10), and resolves warm for the ending. Royalty-free / licensed only.
- **SFX:** rain; key taps; a comic brick wobble and collapse; a soft "ping" per green stone; a crack for the red stone; a glass shatter played *in reverse* for the rebuild; a satisfying stamp "thunk" for the badge.

## Checklist before publishing

- [ ] No Veo-generated text anywhere (freeze-frame every shot and check screens, papers, signs).
- [ ] Every number on screen matches the list in rule 2 exactly.
- [ ] The same Newcomer, Bob and robots across shots (regenerate any clip that drifts).
- [ ] Captions burned in (many devs watch muted).
- [ ] Credit line in the description: "Animation generated with Google Veo; edited by the FirstRun team."
