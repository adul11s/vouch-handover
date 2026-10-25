# Evaluation — handover dispositions & flag detection

`npm run eval` runs `scripts/eval.ts` over 10 labeled handover scenarios in
`fixtures/labeled-handovers.json`. Ground truth is manual: each fixture lists the
handover items expected as `(room_type, disposition)` plus an injection-flag
requirement. Metrics are item-level pairs (label type shown in item.key).

**Run date:** 2026-10-25 (local run, Node v26.12.0, vitest n/a — plain ts-node)

| Group | Fixtures | Behavior | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| all | 10 | disposition | 12 | 0 | 1 | 1.000 | 0.923 |
| all | 10 | flag detection | 2 | 0 | 0 | 1.000 | 1.000 |
| single_night | 5 | disposition | 5 | 0 | 0 | 1.000 | 1.000 |
| single_night | 5 | flag detection | 1 | 0 | 0 | 1.000 | 1.000 |
| multi_night | 5 | disposition | 7 | 0 | 1 | 1.000 | 0.875 |
| multi_night | 5 | flag detection | 1 | 0 | 0 | 1.000 | 1.000 |

## Known gaps (real, found on this run)

1. **Reopened issues disappear entirely (the one FN).** `f08`: an issue opens
   night A, is resolved night B, and re-occurs night C. `newTonight` excludes
   anything whose `room_type` key was seen on an earlier night, and the open
   thread was already deleted on resolution — so the reopened issue produces
   no handover item at all. This is a data-loss scenario a morning manager
   would see nothing about. Not fixed in this pass; tracked here honestly.
2. **Same-shift resolution is dropped.** An issue recorded at 23:50 and
   resolved at 00:10 (same shift) shows only as `new_tonight`; the registry
   opens threads from earlier nights only (`tests/reconciler.test.ts`
   documents this behavior explicitly).
3. `normalizeStructuredEvents` hardcodes `flagged: false`; flags only survive
   through the night-log path. The eval script re-carries fixture flags to
   make the flag metric meaningful, but production structured events cannot
   be flagged from `data/events.json`.

## What is NOT measured here

- The AI night-log parser path: evaluation exercises the deterministic
  reconciler only. No labeled free-text ↔ parsed-event corpus exists yet.
- Cost/latency of GPT-4o calls: reported in README as TODO — no API key
  available at time of writing, so no real run was made. No cost numbers are
  claimed anywhere in this repo.
