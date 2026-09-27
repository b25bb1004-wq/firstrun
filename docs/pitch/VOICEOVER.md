# HUMBLE demo video: voiceover script (Karmanya)

About 3 minutes at a calm pace. Record each segment as its own audio file, or in one take with a two-second
pause between segments; I cut and lay them under the video. Read naturally, don't rush the numbers.

**Setup:** quiet room, phone or headset mic 10–15 cm from your mouth. On Windows, the built-in Sound Recorder
app saves an .m4a. Save the files to `C:\Code\IBM_BOB\captures\voice\` as `seg1.m4a` … `seg5.m4a`.
Say nothing that isn't on this page: every line matches something real on screen.

---

## Segment 1: the hook (0:00–0:20)

> Every project has a "Getting started" section. It's the first thing a new teammate reads, and the only part
> of the code nobody tests.
> We ran the READMEs of thirty-one popular open-source projects on a brand-new machine.
> Eighteen of them broke.

## Segment 2: a real run (0:20–1:20)

> This is HUMBLE. It follows your README on a clean machine, exactly like a new hire would.
> Here it's GeekyAnts' Express starter. Step two, npm install, fails: npm refuses the project's peer
> dependencies.
> HUMBLE's doctor finds the cause and the fix: legacy peer deps. It fixes four more breaks the same way.
> Then it throws that machine away and replays everything from zero. Only a clean replay counts.
> Verified: five of five breaks fixed. And it hands back the corrected README.

## Segment 3: on your machine (1:20–2:10)

> Once the setup is proven, HUMBLE walks you through it on your own machine.
> First it only looks, read-only: here's what I have installed.
> It asks before every command. It runs it, and it only gives a tick when the step's own check passes.
> Here it noticed something: this project was proven on Node 22, and I have Node 24. The app won't start, and
> HUMBLE tells me exactly why, and how to fix it.
> I switch to Node 22, and the app comes up. Set up, and proven, on my machine.
> And every command goes through a guard first: this one would delete my files, so it's blocked.

## Segment 4: IBM Bob as the brain (2:10–2:40)

> Rules fix the breaks HUMBLE already knows, for free. When a failure is new, HUMBLE asks IBM Bob, with the
> evidence attached and a hard budget.
> [ONE REAL SENTENCE ABOUT THE BOB MOMENT: filled in from the Bob pass, e.g. what Bob found and what it cost]
> A fix from Bob only counts if the replay from zero passes.

## Segment 5: close (2:40–3:00)

> One engine, four ways in: a CI check that keeps your docs honest, the desktop guide for new teammates, live
> proofs on the web, and audits at scale.
> HUMBLE. Your README, proven on a clean machine.

---

Notes for the edit (Edith): segment 2's long waits are shown sped up with a "4×/8× speed" label and "cached
packages" on the final replay. Segment 3 uses the random repo (gothinkster/react-redux-realworld-example-app),
which really hit the Node 24 case today. Segment 4's sentence is written only after the Bob pass, from its real
output.
