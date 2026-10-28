# Changelog

## [1.0.0] — 2026-10-28

First tagged release of the Vouch night-shift handover service.

### What it does
- Turns messy hotel front-desk night logs into an **action-first morning report** for the incoming manager.
- Cross-night reconciler keeps a running registry of issues, so an issue opened three nights ago still surfaces until it is closed.
- Input hardening against prompt injection: embedded directives in log text are flagged in the report, never obeyed.

### Fixes included
- Reopened issues no longer disappear from the report.
- Night-date derivation no longer shifts by a day due to UTC handling.

### Status
- Evaluation harness + scorecard in the repo.
- A `Dockerfile` is included but **untested** — documented as a known gap rather than implied to work.
