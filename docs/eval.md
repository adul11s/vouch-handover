# Evaluation — handover dispositions & flag detection

`npm run eval` runs `scripts/eval.ts` over 10 labeled handover scenarios in
`fixtures/labeled-handovers.json`. Ground truth is manual: each fixture lists the
handover items expected as `(room_type, disposition)` plus an injection-flag
requirement. Metrics are item-level pairs (label type shown in item.key).

**Run date:** 2026-10-25 (local run, Node v26.12.0). Update: the reopened-issue
data-loss bug (previously the only FN, fixture `f08`) is fixed in
`src/reconciler.ts` — threads closed by an earlier resolution are recorded in a
`closedThreads` set, and a later recurrence re-enters as `new_tonight` instead of
vanishing. Recall is now 1.000 across all groups.

| Group | Fixtures | Behavior | TP | FP | FN | Precision | Recall |
|---|---|---|---|---|---|---|---|
| all | 10 | disposition | 13 | 0 | 0 | 1.000 | 1.000 |
| all | 10 | flag detection | 2 | 0 | 0 | 1.000 | 1.000 |
| single_night | 5 | disposition | 5 | 0 | 0 | 1.000 | 1.000 |
| single_night | 5 | flag detection | 1 | 0 | 0 | 1.000 | 1.000 |
| multi_night | 5 | disposition | 8 | 0 | 0 | 1.000 | 1.000 |
| multi_night | 5 | flag detection | 1 | 0 | 0 | 1.000 | 1.000 |

## History

- 2026-10-25 (first run): missing `f08` gave TP=12, FN=1, recall 0.923 — see the
  first version of this file / git history for the original table.
- 2026-10-25 (after fix): reopened issues now produce a `new_tonight` item;
  regression covered by `tests/reconciler.test.ts` ("reopened issue after
  resolution (f08 regression)").

## Known gaps (real, found on this run)

1. **Same-shift resolution is dropped.** An issue recorded at 23:50 and
   resolved at 00:10 (same shift) shows only as `new_tonight`; the registry
   opens threads from earlier nights only (`tests/reconciler.test.ts`
   documents this behavior explicitly).
2. `normalizeStructuredEvents` hardcodes `flagged: false`; flags only survive
   through the night-log path. The eval script re-carries fixture flags to
   make the flag metric meaningful, but production structured events cannot
   be flagged from `data/events.json`.

## What is NOT measured here

- The AI night-log parser path: evaluation exercises the deterministic
  reconciler only. No labeled free-text ↔ parsed-event corpus exists yet.
- Cost/latency of GPT-4o calls: reported in README as TODO — no API key
  available at time of writing, so no real run was made. No cost numbers are
  claimed anywhere in this repo.
- Docker image build/run: `Dockerfile` exists but is marked UNTESTED (no
  Docker daemon available at time of writing).
