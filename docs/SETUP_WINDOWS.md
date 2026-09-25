# Set up a fresh Windows laptop for FirstRun

Paste the prompt below into Claude Code on the new laptop (start it in your home folder). It
rebuilds the environment of the main dev PC. The steps marked **YOU** need a human: installers that
ask for admin rights, restarts, logins, CAPTCHAs and tokens.

Reference versions on the main PC (25 Sep 2026): Node 26.4, npm 11.17, git 2.55, GitHub CLI 2.96,
Docker Desktop 29.7, Bob Shell 2.0.5, Vercel CLI 59.15, Python 3.14 (optional), Windows 11 Pro.

---

```
Set up this Windows laptop so I can work on our hackathon project. It must match the main dev PC.
Use winget for installs where possible. Before each install, check whether the tool is already
there and skip it if so. After every step, verify it with a version command and tell me the result.
When a step needs me (admin prompt, restart, browser login, CAPTCHA, token), stop, tell me exactly
what to click or type, and wait for me.

Project: FirstRun, for the IBM Bob 2.0 Hackathon (lablab.ai). Deadline: Sunday 27 Sep 2026,
8:30 PM IST. Repo (private): https://github.com/b25bb1004-wq/firstrun

1. Core tools (winget, user scope where possible):
   - Git for Windows:  winget install --id Git.Git -e
   - Node.js (current release, must be 20 or newer; main PC has 26.x):  winget install --id OpenJS.NodeJS -e
   - GitHub CLI:  winget install --id GitHub.cli -e
   Then open a new shell so PATH updates, and check node, npm, git and gh versions.

2. Docker Desktop (the verify and audit commands run steps inside clean Linux containers):
   winget install --id Docker.DockerDesktop -e
   It needs WSL 2. If WSL is missing, run `wsl --install` (asks for admin, then a restart) and tell
   me to restart. After the restart, I start Docker Desktop once and accept its terms myself.
   Verify with: docker run --rm hello-world

3. GitHub login (ME): I run `gh auth login` (GitHub.com, HTTPS, log in with a web browser).
   Then run `gh auth setup-git`, and check with `gh auth status`.

4. Clone and install:
   cd %USERPROFILE% && gh repo clone b25bb1004-wq/firstrun FirstRun && cd FirstRun
   npm install
   node --test test/*.test.js        (every test must pass; show me any failure)
   cd lens && npm install && cd ..   (FirstRun Lens desktop app: Electron + OCR)
   Set git user.name and user.email for this repo to MY name and MY GitHub email (ask me for them).
   Never add an AI co-author trailer to commits.

5. Read CLAUDE.md completely. It is the operating rules for this repo: how the team coordinates,
   hard rules, repo map. Then read docs/WHY_FIRSTRUN.md and README.md. Summarize them for me in
   5 lines.

6. Global CLIs:
   npm i -g bobshell vercel
   Verify: `bob --version` should print 2.0.x, and `vercel --version`.
   Then `node bin/firstrun.js bob install` (installs FirstRun's Bob modes into ~/.bob).

7. IBM Bob (ME, only from 25 Sep 8:30 PM IST, when hackathon access opens):
   - Bob IDE: I download the Windows x64 installer from https://bob.ibm.com/download, install it,
     and sign in with MY hackathon IBMid. If Bob IDE closes immediately on launch, check Windows
     Smart App Control: it blocks an unsigned file inside Bob (winregistry.node). Show me the Code
     Integrity events that prove it, and I decide whether to turn Smart App Control off.
   - Bob Shell: I run `bob` once in a terminal and finish the browser login with the same IBMid.
   - Check with: node bin/firstrun.js bob

8. Vercel (ME, optional; only if this laptop will deploy the hosted demo): I run `vercel login`.

9. Team chat on Discord (ME + you): each person's Claude has its own bot (Friday = Arnav's,
   Edith = Karmanya's). Two machines must never run the same bot's listener at the same time. If
   my bot already runs on another machine, skip this step.
   Create .env in the repo root with exactly these two lines:
     DISCORD_BOT_TOKEN=
     DISCORD_CHANNEL_ID=1552953693832216687
   Open .env in Notepad for me. I paste my bot token after the = myself. Never ask me to paste
   the token into this chat, and never print, log or commit it. Then run
   `node tools/chat.js setup` (it must list server "Helios" and channel #firstrun_1) and
   `node tools/chat.js inbox`.

10. Smoke test:
   node bin/firstrun.js plan examples/acme-shop        (instant, no Docker)
   node bin/firstrun.js verify examples/acme-shop      (Docker; should end VERIFIED, 5 breaks fixed)
   Report the Setup Passport line.

11. Finish with a checklist of every step: done, skipped or waiting on me.
```
