# FirstRun: 20-second animated teaser, shooting script

**Length:** 20 s · **Format:** 16:9, 1080p (4K if the Veo plan allows) · **Audience:** developers · **Tone:** cinematic, warm, a little funny; no jargon.

**The one idea, in 20 seconds:** the README that "just works" never does on day one. FirstRun sends IBM Bob's crew onto a brand-new machine to follow your docs, fix what breaks, and prove it from zero.

**Production:** Google Veo (the latest model available to the team), **5 clips**, cut hard together in DaVinci Resolve or CapCut. Generate each clip at Veo's normal length and **trim** to the timings below; fast cuts are the point of a teaser.

---

## Rules for every clip

1. **No text from Veo.** AI video turns letters into gibberish (the cover had to be redone for this). Every word and number on screen is added in the edit. Screens and papers show abstract glowing shapes only. End every prompt with `no readable text, no letters, no logos, no watermarks`.
2. **Real numbers only.** The single stat in the teaser comes from our frozen audit (`audit/real-16-v3`): **9 of 14 public READMEs broke on a clean machine.**
3. **No real people and no real company logos.** "IBM Bob" is our blue-spark character, named in the edit.
4. **One look.** Use the same reference images for every clip (image-to-video / reference mode): `docs/pitch/cover.jpg` (palette, the blue spark and the green shield) and the Dock robot SVGs (`lens/dock/characters/`, on PR #92 until it merges).
5. **VO and music are laid over the edit** (one voice, licensed or royalty-free music), so nothing changes between clips.

## Style bible

- **Look:** stylised 3D animation (a Pixar-style short from a dev-tools company), soft cinematic light, shallow depth of field, light film grain.
- **Palette:** deep navy night (#0b1220), **verify-green** (#3ddc84) for success, **Bob-blue** (#4c8dff) for Bob and his crew, warm amber lamp light for the human, muted red only for errors.
- **The Newcomer:** young gender-neutral developer in a hoodie, big expressive eyes. Same character in shots 1 and 2.
- **Bob:** a small floating four-point blue spark (as on the cover) that glows brighter when he acts. No face.
- **The crew:** six small rounded robots with blue glowing accents: antenna and binoculars (Scout), glowing checklist (Planner), sneakers (Runner), stethoscope (Doctor), magnifying glass (Verifier), quill pen (Scribe).
- **The clean machine:** a pristine, empty glass room floating in darkness, standing for a brand-new computer.

---

## Shots

### Shot 1: Day one · 0:00–0:04 (4 s)
- *Picture:* Night, rain streaking down a window, city lights blurred. Slow push-in on the Newcomer under a warm lamp as they open a laptop; the screen lights their hopeful face.
- *VO:* "Day one. The README says it just works."
- *Veo prompt:* `Cinematic stylized 3D animation, night, rain streaking down a large window with blurred city lights, slow dolly-in through the glass toward a young gender-neutral developer in a hoodie at a desk under a warm amber lamp opening a laptop, soft blue screen glow on a hopeful face, shallow depth of field, rack focus from raindrops to face, film grain, deep navy and amber palette, no readable text, no letters, no logos, no watermarks`

### Shot 2: It doesn't · 0:04–0:08 (4 s)
- *Picture:* Over the shoulder: each command the Newcomer types becomes a glowing brick stacking on the desk; one flashes red and the tower collapses in slow motion. The Newcomer's face drops.
- *VO:* "It doesn't."
- *On-screen (edit), last second:* **9 of 14 public READMEs broke on a clean machine.**
- *Veo prompt:* `Stylized 3D animation, over-the-shoulder view of a developer typing on a laptop at night, glowing translucent bricks rise from the keyboard and stack into a small tower on the desk, one brick flashes muted red and the tower collapses in slow motion, the developer's face falls, low angle, cinematic, navy and amber palette with a muted red accent, no readable text, no letters, no logos, no watermarks`

### Shot 3: Bob and the crew · 0:08–0:12 (4 s)
- *Picture:* A small blue four-point spark drops beside the laptop and bursts; six little robots pop out and march through the screen into a vast, empty glass room floating in the dark.
- *VO:* "FirstRun sends in IBM Bob and his crew, on a brand-new machine…"
- *Veo prompt:* `Stylized 3D animation, a glowing blue four-point star spark drops beside a laptop and bursts into light, six small friendly rounded robots with soft blue glowing accents pop out, one with binoculars, one with a glowing checklist, one in sneakers, one with a stethoscope, one with a magnifying glass, one with a quill pen, they march through the glowing laptop screen into a vast pristine empty glass room floating in dark space, crane shot pulling back, cinematic, navy and bright blue, no readable text, no letters, no logos, no watermarks`

### Shot 4: Fix it, then prove it from zero (the money shot) · 0:12–0:17 (5 s)
- *Picture:* A glowing stepping-stone path crosses the glass room; one stone cracks red, and the stethoscope robot patches it green. Then the magnifying-glass robot raises its lens, the whole room **shatters into frozen sparkling shards (bullet time)**, they reverse and rebuild, and the crew races the path again with every stone lighting green in a rush.
- *VO:* "…to follow your docs, fix what breaks, and prove it from zero."
- *On-screen (edit):* a quick green "✓ proven from zero".
- *Veo prompt:* `Cinematic stylized 3D animation, glowing stepping stones across a glass floor, one stone cracks muted red and a small robot with a stethoscope patches it bright green, then a small robot raises a magnifying glass and the glass room shatters into a million sparkling shards frozen mid-air in bullet time with the camera orbiting, the shards reverse and rebuild the room, and small robots race along the path as every stone lights up green in sequence, triumphant, volumetric light, navy blue and green, no readable text, no letters, no logos, no watermarks`

### Shot 5: Proven · 0:17–0:20 (3 s)
- *Picture:* A crisp page (the README) gets a round green shield badge with a check mark stamped onto it, with a bounce; hold on the blue spark beside the green shield on navy (the cover look).
- *VO:* "FirstRun. Your README, proven."
- *On-screen (edit):* **FirstRun** · "Your README, proven." · small: "Powered by IBM Bob" · the project URL.
- *Veo prompt:* `Stylized 3D animation, close-up of a crisp glowing paper page, a round green shield badge with a check mark is stamped onto it with a satisfying bounce, then the camera settles on a small glowing blue four-point spark floating beside the green shield on a deep navy background, soft volumetric light, cinematic, no readable text, no letters, no logos, no watermarks`

---

## Voice-over (full read, about 17 s, brisk)

> Day one. The README says it just works.
> It doesn't.
> FirstRun sends in IBM Bob and his crew, on a brand-new machine, to follow your docs, fix what breaks, and prove it from zero.
> FirstRun. Your README, proven.

## Sound

- **Music:** soft piano under rain (Shot 1), a hard stop on the collapse (Shot 2), then an uplifting synth pulse from the spark (Shot 3), peaking on the shatter-and-rebuild (Shot 4), landing on the stamp (Shot 5).
- **SFX:** rain; key taps; brick collapse; a crack for the red stone; a glass shatter played **in reverse** for the rebuild; a stamp "thunk" on the badge.

## Checklist before publishing

- [ ] No Veo-generated text anywhere (freeze-frame every clip: screens, pages, signs).
- [ ] The only stat is "9 of 14 public READMEs broke on a clean machine".
- [ ] Same Newcomer, Bob and robots across clips.
- [ ] Captions burned in (many devs watch muted); total runtime 20 s.
- [ ] Description credit: "Animation generated with Google Veo; edited by the FirstRun team."
