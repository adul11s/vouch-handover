// Evaluation harness — precision/recall of handover item dispositions and
// injection flags against labeled fixtures in fixtures/labeled-handovers.json.
// Run: npm run eval   (stdout table; docs/eval.md carries the latest recorded run)

import * as fs from 'fs';
import * as path from 'path';
import { normalizeStructuredEvents } from '../src/dataLoader';
import { buildHandoverItems } from '../src/reconciler';
import { HotelEvent, HandoverItem } from '../src/types';

interface ExpectedItem { key: string; disposition: string; flagged: boolean }
interface Fixture {
  id: string; name: string; group: string; targetNight: string;
  events: (Partial<HotelEvent> & Pick<HotelEvent, 'id' | 'timestamp' | 'type' | 'description' | 'status'>)[];
  expected: ExpectedItem[];
}

const TYPE_LABEL: Record<string, string> = {
  check_in: 'Check-in', check_in_issue: 'Check-in Issue', maintenance: 'Maintenance',
  compliance: 'Compliance', complaint: 'Complaint', lost_keycard: 'Lost Keycard',
  deposit_issue: 'Deposit Issue', facilities: 'Facilities', no_show: 'No-show',
  walk_in: 'Walk-in', finance_note: 'Finance Note', incident: 'Incident',
  early_checkout_request: 'Early Checkout Request', damage_report: 'Damage Report',
  note: 'Note', guest_message: 'Guest Message',
};

function itemKey(item: HandoverItem): string {
  return `${item.room ?? '_'}_${item.type}`;
}

function pr(tp: number, fp: number, fn: number): { precision: number; recall: number } {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  return { precision, recall };
}

function evaluate(group: string, fixtures: Fixture[]) {
  let tp = 0, fp = 0, fn = 0;       // disposition pairs (key|disposition)
  let fTp = 0, fFp = 0, fFn = 0;    // flag detection on expected-flagged items
  const details: string[] = [];

  for (const fx of fixtures) {
    const events = normalizeStructuredEvents({
      hotel: { id: 'eval', name: 'Eval Hotel', rooms: 40, timezone: '+08:00' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      events: fx.events as any,
    });
    // normalizeStructuredEvents hardcodes flagged:false — carry the label back through
    const withFlags = events.map((e) => {
      const src = fx.events.find((f) => f.id === e.id);
      return src ? { ...e, flagged: src.flagged ?? false, flagReason: src.flagReason } : e;
    });
    const items = buildHandoverItems(withFlags, fx.targetNight);

    const predicted = new Set(items.map((i) => `${itemKey(i)}|${i.disposition}`));
    const gold = new Set(fx.expected.map((x) => `${x.key}|${x.disposition}`));

    for (const p of predicted) if (!gold.has(p)) { fp++; details.push(`${fx.id} FP ${p}`); }
    for (const g of gold) if (!predicted.has(g)) { fn++; details.push(`${fx.id} FN ${g}`); }
    tp += [...predicted].filter((p) => gold.has(p)).length;

    // Flag detection: for gold items whose flagged=true, prediction must carry flagged=true
    for (const x of fx.expected.filter((x) => x.flagged)) {
      const item = items.find((i) => `${itemKey(i)}|${i.disposition}` === `${x.key}|${x.disposition}`);
      if (item && item.flagged) fTp++;
      else if (item) { fFp++; details.push(`${fx.id} flag-FP ${x.key} (unflagged)`); }
      else { fFn++; details.push(`${fx.id} flag-FN ${x.key} (item missing)`); }
    }
  }

  const disp = pr(tp, fp, fn);
  const flag = pr(fTp, fFp, fFn);
  return { group, fixtures: fixtures.length, disposition: { tp, fp, fn, ...disp }, flag: { tp: fTp, fp: fFp, fn: fFn, ...flag }, details };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'fixtures/labeled-handovers.json'), 'utf-8'));
  const fixtures: Fixture[] = raw.fixtures;

  const groups = Array.from(new Set(fixtures.map((f) => f.group)));
  const results = [evaluate('all', fixtures), ...groups.map((g) => evaluate(g, fixtures.filter((f) => f.group === g)))];

  console.log('Vouch Handover — evaluation over labeled fixtures');
  console.log('');
  console.log('| Group | Fixtures | Behavior | TP | FP | FN | Precision | Recall |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of results) {
    console.log('| ' + r.group + ' | ' + r.fixtures + ' | disposition | ' + r.disposition.tp + ' | ' + r.disposition.fp + ' | ' + r.disposition.fn
      + ' | ' + r.disposition.precision.toFixed(3) + ' | ' + r.disposition.recall.toFixed(3) + ' |');
    console.log('| ' + r.group + ' | ' + r.fixtures + ' | flag detection | ' + r.flag.tp + ' | ' + r.flag.fp + ' | ' + r.flag.fn
      + ' | ' + r.flag.precision.toFixed(3) + ' | ' + r.flag.recall.toFixed(3) + ' |');
  }
  if (results.some((r) => r.details.length)) {
    console.log('\nMismatches:');
    for (const r of results) for (const d of r.details) console.log('  ' + d);
  }
}

main();
