'use strict';
// Sanity checks: compares computed charts with well-known published basic strategy.
const data = require('../data/strategy.json');
const { allRules, ruleId } = require('../engine/strategy');

let failed = 0;
const UP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
function expectRow(id, sec, key, want) {
  const got = data[id][sec][key].join(' ');
  if (got !== want) { failed++; console.error(`FAIL ${id} ${sec} ${key}\n  want ${want}\n  got  ${got}`); }
}
function expectCell(id, sec, key, up, want) {
  const got = data[id][sec][key][UP.indexOf(up)];
  if (got !== want) { failed++; console.error(`FAIL ${id} ${sec} ${key} vs ${up}: want ${want}, got ${got}`); }
}

for (const r of allRules()) if (!data[ruleId(r)]) { failed++; console.error('missing chart ' + ruleId(r)); }

// 6 decks, H17, DAS, late surrender: the full standard chart.
const A = '6-deck-h17-das-ls-peek';
const ref = {
  hard: {
    8: 'H H H H H H H H H H', 9: 'H Dh Dh Dh Dh H H H H H', 10: 'Dh Dh Dh Dh Dh Dh Dh Dh H H',
    11: 'Dh Dh Dh Dh Dh Dh Dh Dh Dh Dh', 12: 'H H S S S H H H H H', 13: 'S S S S S H H H H H',
    14: 'S S S S S H H H H H', 15: 'S S S S S H H H Rh Rh', 16: 'S S S S S H H Rh Rh Rh',
    17: 'S S S S S S S S S Rs', 18: 'S S S S S S S S S S',
  },
  soft: {
    13: 'H H H Dh Dh H H H H H', 14: 'H H H Dh Dh H H H H H', 15: 'H H Dh Dh Dh H H H H H',
    16: 'H H Dh Dh Dh H H H H H', 17: 'H Dh Dh Dh Dh H H H H H', 18: 'Ds Ds Ds Ds Ds S S H H H',
    19: 'S S S S Ds S S S S S', 20: 'S S S S S S S S S S',
  },
  pairs: {
    2: 'P P P P P P H H H H', 3: 'P P P P P P H H H H', 4: 'H H H P P H H H H H',
    5: 'Dh Dh Dh Dh Dh Dh Dh Dh H H', 6: 'P P P P P H H H H H', 7: 'P P P P P P H H H H',
    8: 'P P P P P P P P P Rp', 9: 'P P P P P S P P S S', 10: 'S S S S S S S S S S', A: 'P P P P P P P P P P',
  },
};
for (const sec in ref) for (const k in ref[sec]) expectRow(A, sec, k, ref[sec][k]);

// 6 decks, S17: the classic differences from H17.
const B = '6-deck-s17-das-ls-peek';
expectCell(B, 'hard', 11, 'A', 'H');
expectCell(B, 'hard', 15, 'A', 'H');
expectCell(B, 'hard', 17, 'A', 'S');
expectCell(B, 'soft', 18, '2', 'S');
expectCell(B, 'soft', 19, '6', 'S');
expectCell(B, 'pairs', 8, 'A', 'P');

// No double after split.
const C = '6-deck-s17-ndas-ns-peek';
expectRow(C, 'pairs', 4, 'H H H H H H H H H H');
expectRow(C, 'pairs', 2, 'H H P P P P H H H H');
expectRow(C, 'pairs', 6, 'H P P P P H H H H H');

// Single deck quirks.
const D = '1-deck-s17-ndas-ns-peek';
expectRow(D, 'hard', 8, 'H H H Dh Dh H H H H H');
expectRow(D, 'hard', 9, 'Dh Dh Dh Dh Dh H H H H H');
expectCell(D, 'hard', 11, 'A', 'Dh');
expectCell(D, 'pairs', 7, '10', 'S');
expectCell(D, 'soft', 18, 'A', 'S');

// Infinite deck: matches 8 decks except two near-tie soft doubles that become hits.
const F = "inf-deck-s17-das-ls-peek", G = "8-deck-s17-das-ls-peek";
let infDiff = 0;
for (const sec of ["hard", "soft", "pairs"]) for (const k in data[F][sec]) data[F][sec][k].forEach((c, i) => { if (c !== data[G][sec][k][i]) infDiff++; });
if (infDiff !== 2) { failed++; console.error("FAIL infinite deck should differ from 8 decks in exactly 2 cells, got " + infDiff); }
expectCell(F, "soft", 13, "5", "H");
expectCell(F, "soft", 15, "4", "H");
expectCell(F, "hard", 11, "A", "H");
expectCell(F, "hard", 16, "9", "Rh");

// European no hole card: do not risk extra money against a ten or ace.
const E = '6-deck-s17-das-ns-enhc';
expectCell(E, 'hard', 11, '10', 'H');
expectCell(E, 'pairs', 8, '10', 'H');
expectCell(E, 'pairs', 8, 'A', 'H');
expectCell(E, 'pairs', 'A', 'A', 'H');
expectCell(E, 'pairs', 'A', '10', 'P');

if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
console.log(`all checks passed (${Object.keys(data).length} charts)`);
