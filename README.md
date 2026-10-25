# Vouch Night-Shift Handover Service

[![CI](https://github.com/adul11s/vouch-handover/actions/workflows/ci.yml/badge.svg)](https://github.com/adul11s/vouch-handover/actions/workflows/ci.yml)

Generates action-first night-shift handover reports for hotel morning managers.

## Quick start

```bash
npm install
cp .env.example .env
# Add your OPENAI_API_KEY to .env
npm run build
npm start
```

Then:
```bash
# Get list of available nights
curl http://localhost:3000/api/nights

# Get JSON handover for a specific night
curl "http://localhost:3000/api/handover?night=2026-05-29"

# Get HTML handover (human-readable)
curl "http://localhost:3000/api/handover.html?night=2026-05-29"
```

## What it does

1. **Ingest** — processes structured events (JSON) and free-text night logs
2. **Reconcile** — tracks issues across nights: still open, newly resolved, new tonight
3. **Ground** — every statement in the output cites source event IDs
4. **Flag** — detects contradictions and incomplete entries, including prompt injection attempts

## Sample output

```
Total: 5 | Still Open: 3 | New Tonight: 2 | Resolved: 0

🚨 On Fire — Needs Immediate Attention
  [still_open] Deposit Issue Room 309 — Guest checks out tomorrow morning...
    Follow-up: Collect deposit before guest checkout, or flag to finance.
    Sources: [evt_0014]

🆕 New Tonight
  [new_tonight] Damage Report Room 226 — Housekeeping found a cracked basin...
    Follow-up: Obtain manager approval and photos before processing charge.
    Sources: [evt_0023]
```

## Architecture

See `DECISIONS.md` and `AGENTS.md` for full design rationale.

## Deployment

The service is a stateless Node.js server. Deploy anywhere that runs Node.js (Railway, Render, Fly.io, AWS Lambda + API Gateway).

```bash
# Docker (optional)
# ⚠️ UNTESTED — the Dockerfile was written for this simple Node service but has
# not been executed/verified (no Docker daemon on the authoring machine). The
# verified path is npm run build && npm start.
docker build -t vouch-handover .
docker run -p 3000:3000 -e OPENAI_API_KEY=$OPENAI_API_KEY vouch-handover
```
## Known gaps

- Demo data sintetis; tidak ada video demo.
- Biaya/latensi per request AI belum diukur (TODO, perlu API key saat runtime).
- Room-specific "contradiction 312" masih hardcode; logger `correlationId`
  sering `unknown`.
