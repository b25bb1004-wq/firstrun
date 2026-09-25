# FirstRun report: quarry/geo-tiles

Verdict: **FAILED** at `5934184` in `node:20-bookworm`.

Clone to running from zero: 0m00s.

## Repairs

- E1 (S1) unknown: mapnik@4.5.9 has no prebuilt binary for Node 20 on linux-x64, and building it needs Mapnik 3.1 headers that Debian bookworm does not package. (needs-human, diagnosed by IBM Bob)
