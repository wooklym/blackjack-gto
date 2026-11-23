'use strict';
// Computes every chart and writes data/strategy.json. Run: npm run compute
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Solver, allRules, ruleId, DECKS } = require('../engine/strategy');

if (!isMainThread) {
  const { decks, h17 } = workerData;
  const solver = new Solver(decks, h17);
  const out = {};
  for (const r of allRules()) {
    if (r.decks !== decks || r.h17 !== h17) continue;
    out[ruleId(r)] = solver.chart(r);
  }
  parentPort.postMessage(out);
} else {
  const jobs = [];
  for (const decks of DECKS) for (const h17 of [false, true]) jobs.push({ decks, h17 });
  const result = {};
  const t0 = Date.now();
  let running = 0;
  const limit = Math.max(1, os.cpus().length);
  const next = () => {
    if (!jobs.length) {
      if (running === 0) {
        const sorted = {};
        for (const r of allRules()) sorted[ruleId(r)] = result[ruleId(r)];
        fs.writeFileSync(path.join(__dirname, '..', 'data', 'strategy.json'), JSON.stringify(sorted) + '\n');
        console.log(`wrote ${Object.keys(sorted).length} charts in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      }
      return;
    }
    const job = jobs.shift();
    running++;
    new Worker(__filename, { workerData: job })
      .on('message', (m) => Object.assign(result, m))
      .on('error', (e) => { throw e; })
      .on('exit', () => {
        running--;
        console.log(`done ${job.decks} deck ${job.h17 ? 'H17' : 'S17'}`);
        next();
      });
  };
  for (let i = 0; i < limit; i++) next();
}
