# Vouch Handover Service — Agent Guide

## What this does

Generates action-first night-shift handover reports for hotel morning managers.

## Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express
- **AI**: OpenAI GPT-4o (for night log parsing)
- **Data**: In-memory (no DB — production would use PostgreSQL)

## Key files

| File | Purpose |
|---|---|
| `src/types.ts` | Shared TypeScript types |
| `src/logger.ts` | Structured JSON logger (correlation IDs) |
| `src/dataLoader.ts` | Normalizes events + night log parsing |
| `src/nightLogParser.ts` | AI-powered free-text parser with injection defense |
| `src/reconciler.ts` | Cross-night state tracking + disposition logic |
| `src/reportBuilder.ts` | Report generation + HTML rendering |
| `src/index.ts` | Express server, all API endpoints |
| `data/events.json` | Sample structured event data |
| `DECISIONS.md` | Full rationale for all design choices |

## Dev commands

```bash
npm run build   # TypeScript → dist/
npm start       # Run production server
npm run dev     # Run with ts-node (no build step)
```

## Environment variables

```bash
OPENAI_API_KEY=sk-...   # Required — GPT-4o for night log parsing
PORT=3000               # Optional — default 3000
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/api/handover?night=YYYY-MM-DD` | GET | JSON handover for a night |
| `/api/handover.html?night=YYYY-MM-DD` | GET | HTML handover for a night |
| `/api/nights` | GET | List available nights |
| `/api/events` | GET | Raw event list (debugging) |
| `/health` | GET | Health check |

## Architecture notes

- Night shifts run 23:00–07:00, span two calendar dates. `deriveNightDate()` handles this.
- `reconciler.ts` uses a running `openThreads` registry to track unresolved issues across nights.
- The AI prompt injection defense is in `nightLogParser.ts` — the system prompt explicitly tells the model not to comply with embedded directives.
- Every statement in the output cites source event IDs for traceability.

## Common issues

**Night dates are wrong**: Check `deriveNightDate()` in `dataLoader.ts` — it parses the local hour from the ISO string and subtracts 1 day for timestamps between 00:00–06:59.

**Still open items missing**: The reconciler uses a running registry. If an unresolved event appears for the first time on a given night, it won't be "still open" on subsequent nights unless it reappears in the data.

**Night log not parsed**: Check that `OPENAI_API_KEY` is set. If AI fails, the fallback `manualParseNightLog()` extracts only aircon and leak events.