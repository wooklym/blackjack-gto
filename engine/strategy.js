'use strict';
/**
 * Blackjack basic-strategy engine.
 *
 * Exact finite-shoe expected-value calculation (cards are removed from the shoe
 * as they are dealt). For every two-card starting hand and dealer upcard the EV
 * of each action is computed; the chart shows the EV-maximising action for each
 * total (total-dependent basic strategy, weighted over two-card compositions).
 *
 * Cards are 1..10 where 1 = Ace and 10 = any ten-valued card.
 * Simplifications: no resplitting; split aces receive one card each.
 */

const UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
const KEY_MUL = [0];
for (let c = 1; c <= 10; c++) KEY_MUL[c] = Math.pow(22, c - 1);

function baseShoe(decks) {
  const s = new Int32Array(11);
  for (let c = 1; c <= 9; c++) s[c] = 4 * decks;
  s[10] = 16 * decks;
  return s;
}

/**
 * Evaluation context for one (decks, soft-17 rule, upcard, extra removed card).
 * Dealer outcome distributions are cached here and shared by every rule variant.
 */
class Ctx {
  constructor(decks, h17, up, extra) {
    this.h17 = h17;
    this.up = up;
    this.shoe = baseShoe(decks);
    this.shoe[up]--;
    if (extra) this.shoe[extra]--;
    this.n = 52 * decks - 1 - (extra ? 1 : 0);
    this.bjCard = up === 1 ? 10 : up === 10 ? 1 : 0;
    this.dealerCache = new Map();
    this.memo = [new Map(), new Map()]; // [peek, enhc]
    this.out = null;
  }

  /** Dealer final distribution [17,18,19,20,21,bust], conditional on no blackjack. */
  dealer(key) {
    let d = this.dealerCache.get(key);
    if (d) return d;
    d = new Float64Array(6);
    this.out = d;
    const shoe = this.shoe, up = this.up, bj = this.bjCard;
    const denom = this.n - (bj ? shoe[bj] : 0);
    for (let h = 1; h <= 10; h++) {
      if (h === bj || shoe[h] === 0) continue;
      const p = shoe[h] / denom;
      shoe[h]--; this.n--;
      this.dealerRec(up + h, up === 1 || h === 1, p);
      shoe[h]++; this.n++;
    }
    this.dealerCache.set(key, d);
    return d;
  }

  dealerRec(hard, ace, p) {
    const soft = ace && hard + 10 <= 21;
    const total = soft ? hard + 10 : hard;
    if (total > 21) { this.out[5] += p; return; }
    if (total > 17 || (total === 17 && !(soft && this.h17))) { this.out[total - 17] += p; return; }
    const shoe = this.shoe, n = this.n;
    for (let c = 1; c <= 10; c++) {
      const k = shoe[c];
      if (k === 0) continue;
      shoe[c]--; this.n--;
      this.dealerRec(hard + c, ace || c === 1, p * k / n);
      shoe[c]++; this.n++;
    }
  }

  /** Probability that the player's next card is c (accounts for a peeked hole card). */
  drawProb(c, enhc) {
    const shoe = this.shoe, bj = this.bjCard;
    if (!bj || enhc) return shoe[c] / this.n;
    if (c === bj) return shoe[c] / (this.n - 1);
    const nonBj = this.n - shoe[bj];
    return shoe[c] * (1 - 1 / nonBj) / (this.n - 1);
  }

  standEV(hard, ace, key, enhc) {
    const total = ace && hard + 10 <= 21 ? hard + 10 : hard;
    const d = this.dealer(key);
    let ev = d[5];
    for (let t = 17; t <= 21; t++) {
      if (total > t) ev += d[t - 17]; else if (total < t) ev -= d[t - 17];
    }
    if (enhc && this.bjCard) {
      const pbj = this.shoe[this.bjCard] / this.n;
      ev = -pbj + (1 - pbj) * ev;
    }
    return ev;
  }

  /** Returns {s, h, b}: EV of standing, hitting, and the best of the two. */
  node(hard, ace, key, enhc) {
    const memo = this.memo[enhc ? 1 : 0];
    let r = memo.get(key);
    if (r) return r;
    const s = this.standEV(hard, ace, key, enhc);
    let h = -Infinity;
    const total = ace && hard + 10 <= 21 ? hard + 10 : hard;
    if (total < 21) {
      h = 0;
      const shoe = this.shoe;
      for (let c = 1; c <= 10; c++) {
        if (shoe[c] === 0) continue;
        const p = this.drawProb(c, enhc);
        if (hard + c > 21) { h -= p; continue; }
        shoe[c]--; this.n--;
        h += p * this.node(hard + c, ace || c === 1, key + KEY_MUL[c], enhc).b;
        shoe[c]++; this.n++;
      }
    }
    r = { s, h, b: Math.max(s, h) };
    memo.set(key, r);
    return r;
  }

  doubleEV(hard, ace, key, enhc) {
    let ev = 0;
    const shoe = this.shoe;
    for (let c = 1; c <= 10; c++) {
      if (shoe[c] === 0) continue;
      const p = this.drawProb(c, enhc);
      if (hard + c > 21) { ev -= 2 * p; continue; }
      shoe[c]--; this.n--;
      ev += 2 * p * this.standEV(hard + c, ace || c === 1, key + KEY_MUL[c], enhc);
      shoe[c]++; this.n++;
    }
    return ev;
  }

  /** Runs fn with cards a and b removed from the shoe. */
  withCards(a, b, fn) {
    this.shoe[a]--; this.shoe[b]--; this.n -= 2;
    const r = fn(a + b, a === 1 || b === 1, KEY_MUL[a] + KEY_MUL[b]);
    this.shoe[a]++; this.shoe[b]++; this.n += 2;
    return r;
  }

  /** EV of one hand that started from a split card p (this ctx has the other p removed). */
  splitHandEV(p, das, enhc) {
    const shoe = this.shoe;
    shoe[p]--; this.n--;
    let ev = 0;
    for (let c = 1; c <= 10; c++) {
      if (shoe[c] === 0) continue;
      const pr = this.drawProb(c, enhc);
      shoe[c]--; this.n--;
      const hard = p + c, ace = p === 1 || c === 1, key = KEY_MUL[p] + KEY_MUL[c];
      let v;
      if (p === 1) v = this.standEV(hard, ace, key, enhc);
      else {
        v = this.node(hard, ace, key, enhc).b;
        if (das) v = Math.max(v, this.doubleEV(hard, ace, key, enhc));
      }
      ev += pr * v;
      shoe[c]++; this.n++;
    }
    shoe[p]++; this.n++;
    return ev;
  }
}

/** Shared dealer/EV caches for one (decks, h17) pair. */
class Solver {
  constructor(decks, h17) {
    this.decks = decks;
    this.h17 = h17;
    this.ctxs = new Map();
  }

  ctx(up, extra) {
    const k = up * 11 + extra;
    let c = this.ctxs.get(k);
    if (!c) { c = new Ctx(this.decks, this.h17, up, extra); this.ctxs.set(k, c); }
    return c;
  }

  /** EVs of every action for the two-card hand (a, b) against upcard up. */
  handEVs(a, b, up, rules) {
    const enhc = !!rules.enhc;
    const ctx = this.ctx(up, 0);
    const ev = ctx.withCards(a, b, (hard, ace, key) => {
      const nd = ctx.node(hard, ace, key, enhc);
      return { S: nd.s, H: nd.h, D: ctx.doubleEV(hard, ace, key, enhc) };
    });
    if (rules.surrender && !enhc) ev.R = -0.5;
    if (a === b) ev.P = 2 * this.ctx(up, a).splitHandEV(a, !!rules.das, enhc);
    return ev;
  }

  /** Chart code for a set of weighted compositions. */
  decide(comps, up, rules) {
    const sum = {};
    let wsum = 0;
    for (const [a, b, w] of comps) {
      const ev = this.handEVs(a, b, up, rules);
      for (const k in ev) sum[k] = (sum[k] || 0) + w * ev[k];
      wsum += w;
    }
    for (const k in sum) sum[k] /= wsum;
    const best = (keys) => keys.filter((k) => k in sum).reduce((x, y) => (sum[y] > sum[x] + 1e-12 ? y : x));
    const top = best(['S', 'H', 'D', 'P', 'R']);
    let code = top;
    if (top === 'D') code = 'D' + best(['S', 'H']).toLowerCase();
    else if (top === 'R') code = 'R' + best(['S', 'H', 'P']).toLowerCase();
    return { code, ev: sum };
  }

  chart(rules) {
    const hard = {}, soft = {}, pairs = {};
    const weights = (up) => { const s = baseShoe(this.decks); s[up]--; return s; };
    for (let t = 5; t <= 19; t++) {
      hard[t] = UPCARDS.map((up) => {
        const s = weights(up), comps = [];
        for (let a = 2; a <= 10; a++) {
          const b = t - a;
          if (b <= a || b > 10) continue;
          comps.push([a, b, s[a] * s[b]]);
        }
        return this.decide(comps, up, rules).code;
      });
    }
    // Hard 20 only exists as a pair of tens; it is covered by the pairs table.
    for (let x = 2; x <= 9; x++) soft[11 + x] = UPCARDS.map((up) => this.decide([[1, x, 1]], up, rules).code);
    for (const p of [2, 3, 4, 5, 6, 7, 8, 9, 10, 1]) {
      pairs[p === 1 ? 'A' : p] = UPCARDS.map((up) => this.decide([[p, p, 1]], up, rules).code);
    }
    return { hard, soft, pairs };
  }
}

const DECKS = [1, 2, 4, 6, 8];

/** Every supported rule combination. */
function allRules() {
  const out = [];
  for (const decks of DECKS)
    for (const h17 of [false, true])
      for (const das of [true, false]) {
        for (const surrender of [true, false]) out.push({ decks, h17, das, surrender, enhc: false });
        out.push({ decks, h17, das, surrender: false, enhc: true });
      }
  return out;
}

function ruleId(r) {
  return [
    r.decks + '-deck',
    r.h17 ? 'h17' : 's17',
    r.das ? 'das' : 'ndas',
    r.surrender ? 'ls' : 'ns',
    r.enhc ? 'enhc' : 'peek',
  ].join('-');
}

module.exports = { Solver, allRules, ruleId, UPCARDS, DECKS };
