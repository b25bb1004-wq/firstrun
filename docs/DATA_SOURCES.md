# Data sources

The IBM Bob 2.0 hackathon guide asks teams to keep a list of every public website whose data they
used, and to use only data whose terms allow it (no personal, client, confidential or social-media
data). FirstRun uses **no personal data**. Its only external data is public open-source repositories,
cloned read-only at a pinned commit and run in disposable containers.

## Audited repositories (`audit/real-16/`, `audit/real-16-v2/`)

| Repository | Pinned commit | License |
|---|---|---|
| github.com/GeekyAnts/express-typescript | 6b9bb70e23 | MIT |
| github.com/mdn/express-locallibrary-tutorial | b378f3dd48 | CC0-1.0 |
| github.com/Louis3797/express-ts-auth-service | fc6722badf | MIT |
| github.com/JKHeadley/rest-hapi | 708ecbcd4f | MIT |
| github.com/teamhide/fastapi-boilerplate | df4e6d4f81 | **none declared** |
| github.com/zhanymkanov/fastapi_production_template | 8e82353ff3 | Unlicense |
| github.com/madhums/node-express-mongoose | 86e5696177 | MIT |
| github.com/przemek-nowicki/node-express-template.ts | d731e5cef4 | **none declared** |
| github.com/maitraysuthar/rest-api-nodejs-mongodb | 6a1ba2da70 | MIT |
| github.com/vargasjona/fastapi-alembic-sqlmodel-async | 96f10870e7 | MIT |
| github.com/erev0s/VAmPI | f16052dce8 | MIT |
| github.com/edwinhern/express-typescript | 983fa04136 | MIT |
| github.com/kellyjonbrazil/jello | b43c9b2460 | MIT |
| github.com/NayamAmarshe/please | 10e94b3e7e | MIT |
| github.com/addyosmani/git2txt | e8db771b97 | MIT |
| github.com/TejasQ/add-gitignore | 0552635306 | MIT |

**Open item:** the two repos with no declared license are copyright-by-default. Running their public
code to audit it is fine, but the committed run outputs include rewritten copies of their READMEs
(`out/README.md`, `out/pr/`). Before the repo goes public, either drop those two repos' README
copies (keep the findings and evidence), or ask their owners. Decision: Arnav/Karmanya.

## Other sources

- Web API: `codeload.github.com` / `api.github.com` (the hosted instant check downloads public repo
  tarballs on request; nothing is stored).
- Statistics quoted in the pitch: Atlassian State of DevEx 2025, Cortex 2024, Stack Overflow
  Developer Survey 2024 (see `docs/WHY_FIRSTRUN.md`).
- Demo repos `examples/acme-shop` and `examples/notes-api-py` were written by the team, with seeded breaks.
