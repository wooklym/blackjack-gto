'use strict';
// Static site generator: data/strategy.json + src/i18n/*.json -> dist/
const fs = require('fs');
const path = require('path');
const { allRules, ruleId, deckSlug, DECKS } = require('./engine/strategy');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SITE = (
  process.env.SITE_URL ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "") ||
  'https://blackjackchart.app'
).replace(/\/$/, '');
const REPO = 'https://github.com/wooklym/blackjack-gto';
const TODAY = new Date().toISOString().slice(0, 10);

const LANGS = [
  { code: 'en', hreflang: 'en', og: 'en_US', name: 'English' },
  { code: 'ko', hreflang: 'ko', og: 'ko_KR', name: '한국어' },
  { code: 'ja', hreflang: 'ja', og: 'ja_JP', name: '日本語' },
  { code: 'zh-cn', hreflang: 'zh-Hans', og: 'zh_CN', name: '简体中文' },
  { code: 'zh-tw', hreflang: 'zh-Hant', og: 'zh_TW', name: '繁體中文' },
  { code: 'es', hreflang: 'es', og: 'es_ES', name: 'Español' },
  { code: 'pt', hreflang: 'pt', og: 'pt_BR', name: 'Português' },
  { code: 'fr', hreflang: 'fr', og: 'fr_FR', name: 'Français' },
  { code: 'de', hreflang: 'de', og: 'de_DE', name: 'Deutsch' },
  { code: 'ru', hreflang: 'ru', og: 'ru_RU', name: 'Русский' },
  { code: 'vi', hreflang: 'vi', og: 'vi_VN', name: 'Tiếng Việt' },
  { code: 'th', hreflang: 'th', og: 'th_TH', name: 'ไทย' },
];

const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'strategy.json'), 'utf8'));
const RULES = allRules();
const DEFAULT_RULE = { decks: 6, h17: true, das: true, surrender: true, enhc: false };
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', 'en.json'), 'utf8'));
const UP_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const CODES = ['H', 'S', 'Dh', 'Ds', 'P', 'Rh', 'Rs', 'Rp'];
const SHOW = { H: 'H', S: 'S', Dh: 'D', Ds: 'Ds', P: 'P', Rh: 'R', Rs: 'Rs', Rp: 'Rp' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const json = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function loadLang(code) {
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'i18n', code + '.json'), 'utf8'));
  for (const k of Object.keys(EN)) if (!(k in t)) throw new Error(`i18n: ${code} is missing "${k}"`);
  return t;
}

const decksLabel = (t, n) => (n === Infinity ? t.dInf : n === 1 ? t.d1 : fill(t.dN, { n }));
const longRules = (t, r) => [r.h17 ? t.h17 : t.s17, r.das ? t.das : t.ndas, r.surrender ? t.ls : t.ns, r.enhc ? t.enhc : t.peek];
const shortRules = (t, r) =>
  [r.h17 ? 'H17' : 'S17', r.das ? t.tDas : t.tNdas, r.surrender ? t.tLs : t.tNs].concat(r.enhc ? [t.tEnhc] : []).join(', ');
const url = (lang, r) => `/${lang}/` + (r ? ruleId(r) + '/' : '');
const actionName = (t, code) =>
  ({ H: t.aH, S: t.aS, P: t.aP, Dh: `${t.aD} / ${t.aH}`, Ds: `${t.aD} / ${t.aS}`, Rh: `${t.aR} / ${t.aH}`, Rs: `${t.aR} / ${t.aS}`, Rp: `${t.aR} / ${t.aP}` })[code];

/** Rows of a chart section, merging identical leading and trailing hard rows. */
function rows(chart, kind) {
  if (kind === 'soft') return Object.keys(chart.soft).map((k) => ({ label: 'A,' + (k - 11), key: k, cells: chart.soft[k] }));
  if (kind === 'pairs') return Object.keys(chart.pairs).sort((a, b) => (a === 'A') - (b === 'A') || a - b).map((k) => ({ label: `${k},${k}`, key: k, cells: chart.pairs[k] }));
  const keys = Object.keys(chart.hard).map(Number).sort((a, b) => a - b);
  const same = (a, b) => chart.hard[a].join() === chart.hard[b].join();
  let lo = 0;
  while (lo + 1 < keys.length && same(keys[lo], keys[lo + 1])) lo++;
  let hi = keys.length - 1;
  while (hi - 1 > lo && same(keys[hi], keys[hi - 1])) hi--;
  const out = [];
  out.push({ label: lo > 0 ? `${keys[0]}–${keys[lo]}` : String(keys[0]), key: keys.slice(0, lo + 1).join(' '), cells: chart.hard[keys[0]] });
  for (let i = lo + 1; i < hi; i++) out.push({ label: String(keys[i]), key: String(keys[i]), cells: chart.hard[keys[i]] });
  out.push({ label: hi < keys.length - 1 ? `${keys[hi]}+` : String(keys[hi]), key: keys.slice(hi).join(' '), cells: chart.hard[keys[hi]] });
  return out;
}

function table(t, chart, kind) {
  const head = UP_LABELS.map((u) => `<th scope="col">${u}</th>`).join('');
  const body = rows(chart, kind)
    .map(
      (r) =>
        `<tr data-k="${r.key}"><th scope="row">${r.label}</th>` +
        r.cells.map((c) => `<td class="c-${c}" title="${esc(t['l' + c])}">${SHOW[c]}</td>`).join('') +
        '</tr>'
    )
    .join('');
  return `<section class="chart" data-kind="${kind}"><h2>${esc(t[kind])}</h2><table><caption>${esc(t.yourHand)} × ${esc(t.dealerUp)}</caption><thead><tr><th scope="col" class="corner"></th>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

function legend(t, chart) {
  const used = new Set();
  for (const sec of Object.values(chart)) for (const row of Object.values(sec)) row.forEach((c) => used.add(c));
  const items = CODES.filter((c) => used.has(c)).map((c) => `<li><span class="key c-${c}">${SHOW[c]}</span> ${esc(t['l' + c])}</li>`).join('');
  return `<section class="legend"><h2>${esc(t.legend)}</h2><ul>${items}</ul></section>`;
}

function selector(t, lang, r) {
  const sel = (name, label, opts, cur, disabled) =>
    `<label>${esc(label)}<select name="${name}"${disabled ? ' disabled' : ''}>` +
    opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('') +
    '</select></label>';
  return (
    `<section class="rules"><h2>${esc(t.rulesTitle)}</h2><form id="rules" data-lang="${lang}">` +
    sel('decks', t.lblDecks, DECKS.map((n) => [deckSlug(n), decksLabel(t, n)]), deckSlug(r.decks)) +
    sel('s17', t.lblSoft17, [['s17', t.optS17], ['h17', t.optH17]], r.h17 ? 'h17' : 's17') +
    sel('das', t.lblDas, [['das', t.optYes], ['ndas', t.optNo]], r.das ? 'das' : 'ndas') +
    sel('hole', t.lblHole, [['peek', t.optPeek], ['enhc', t.optEnhc]], r.enhc ? 'enhc' : 'peek') +
    sel('sur', t.lblSur, [['ls', t.optLs], ['ns', t.optNs]], r.surrender ? 'ls' : 'ns', r.enhc) +
    '</form></section>'
  );
}

function lookup(t) {
  const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const sel = (id, label, cur) =>
    `<label>${esc(label)}<select id="${id}">` + cards.map((c) => `<option${c === cur ? ' selected' : ''}>${c}</option>`).join('') + '</select></label>';
  return (
    `<section class="lookup"><h2>${esc(t.lookupTitle)}</h2><div class="row">` +
    sel('lk1', t.lookupCard1, '10') + sel('lk2', t.lookupCard2, '6') + sel('lkd', t.lookupDealer, '10') +
    `</div><p class="result"><span>${esc(t.lookupResult)}</span> <strong id="lkout" aria-live="polite"></strong></p></section>`
  );
}

function neighbours(r) {
  const out = [];
  const push = (n, label) => out.push({ rule: n, label });
  push({ ...r, h17: !r.h17 }, (t) => (r.h17 ? t.s17 : t.h17));
  push({ ...r, das: !r.das }, (t) => (r.das ? t.ndas : t.das));
  if (!r.enhc) push({ ...r, surrender: !r.surrender }, (t) => (r.surrender ? t.ns : t.ls));
  push({ ...r, enhc: !r.enhc, surrender: false }, (t) => (r.enhc ? t.peek : t.enhc));
  const i = DECKS.indexOf(r.decks);
  for (const j of [i - 1, i + 1]) if (DECKS[j]) push({ ...r, decks: DECKS[j] }, (t) => decksLabel(t, DECKS[j]));
  return out;
}

function diffs(t, a, b) {
  const out = [];
  const each = (sec, label) => {
    for (const k of Object.keys(a[sec])) {
      a[sec][k].forEach((c, i) => {
        const d = b[sec][k][i];
        if (c !== d) out.push(`<li><b>${esc(label(k))} ${esc(t.vs)} ${UP_LABELS[i]}</b>: ${esc(actionName(t, c))} → ${esc(actionName(t, d))}</li>`);
      });
    }
  };
  each('hard', (k) => fill(t.hardLbl, { n: k }));
  each('soft', (k) => fill(t.softLbl, { n: k }));
  each('pairs', (k) => `${k},${k}`);
  return out;
}

function diffSection(t, lang, r) {
  const chart = DATA[ruleId(r)];
  const blocks = neighbours(r)
    .map(({ rule, label }) => {
      const d = diffs(t, chart, DATA[ruleId(rule)]);
      return (
        `<div class="diff"><h3><a href="${url(lang, rule)}">${esc(fill(t.diffIf, { rule: label(t) }))}</a></h3>` +
        (d.length ? `<ul>${d.join('')}</ul>` : `<p>${esc(t.diffNone)}</p>`) +
        '</div>'
      );
    })
    .join('');
  return `<section class="diffs"><h2>${esc(t.diffTitle)}</h2><p>${esc(t.diffIntro)}</p><div class="diff-grid">${blocks}</div></section>`;
}

function allCharts(t, lang, current) {
  const groups = DECKS.map((n) => {
    const links = RULES.filter((r) => r.decks === n)
      .map((r) => {
        const id = ruleId(r);
        const text = esc(shortRules(t, r));
        return id === current ? `<li><span aria-current="page">${text}</span></li>` : `<li><a href="${url(lang, r)}">${text}</a></li>`;
      })
      .join('');
    return `<div><h3>${esc(decksLabel(t, n))}</h3><ul>${links}</ul></div>`;
  }).join('');
  return `<section class="all"><h2>${esc(t.allCharts)}</h2><div class="all-grid">${groups}</div></section>`;
}

function page({ lang, t, title, desc, pathname, alternates, body, ld, data }) {
  const L = LANGS.find((l) => l.code === lang) || LANGS[0];
  const canonical = SITE + pathname;
  const alt = alternates
    .map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${SITE}${a.path}">`)
    .join('');
  const ogAlt = LANGS.filter((l) => l.code !== L.code).map((l) => `<meta property="og:locale:alternate" content="${l.og}">`).join('');
  const langMenu = LANGS.map((l) => {
    const a = alternates.find((x) => x.hreflang === l.hreflang);
    return `<li><a href="${a.path}" hreflang="${l.hreflang}" lang="${l.hreflang}"${l.code === lang ? ' aria-current="true"' : ''}>${l.name}</a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="${L.hreflang}" data-lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
${alt}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(t.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${L.og}">
${ogAlt}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="theme-color" content="#0f5132">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)}</script>
<script defer src="/_vercel/insights/script.js"></script>
${ld.map((o) => `<script type="application/ld+json">${json(o)}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
<a class="brand" href="/${lang}/"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><rect x="5" y="3" width="22" height="26" rx="4" fill="currentColor"/><path d="M16 9l5 7-5 7-5-7z" fill="var(--bg)"/></svg>${esc(t.siteName)}</a>
<details class="lang"><summary aria-label="${esc(t.language)}">${L.name}</summary><ul>${langMenu}</ul></details>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap">
<p>${esc(t.disclaimer)}</p>
<p><a href="${REPO}" rel="noopener">${esc(t.source)}</a></p>
</footer>
${data ? `<div id="pick" class="pick" hidden><div class="wrap"><p><a id="pickhand"></a><strong id="pickact" aria-live="polite"></strong></p><button id="share" type="button">${esc(t.share)}</button></div></div><script id="data" type="application/json">${json(data)}</script><script src="/app.js" defer></script>` : ''}
</body>
</html>
`;
}

function chartBlocks(t, lang, r) {
  const chart = DATA[ruleId(r)];
  return (
    selector(t, lang, r) +
    `<p class="note tap">${esc(t.tapHint)}</p>` +
    `<div class="charts">${table(t, chart, 'hard')}${table(t, chart, 'soft')}${table(t, chart, 'pairs')}</div>` +
    `<div class="two">${legend(t, chart)}${lookup(t)}</div>`
  );
}

function clientData(t, r) {
  const labels = { bj: t.lookupBJ, hard: t.hardLbl, soft: t.softLbl, vs: t.vs, share: t.share, copied: t.copied };
  for (const c of CODES) labels[c] = t['l' + c];
  return { chart: DATA[ruleId(r)], labels, rule: ruleId(r) };
  // (hand guide links are built client-side from the page language)
}

// ---- Hand guide: one page per (hand, dealer upcard), covering every rule set ----
const UP_SLUGS = UP_LABELS.map((u) => u.toLowerCase());
const HANDS = []; // { kind, key, slug }
for (let t = 5; t <= 19; t++) HANDS.push({ kind: 'hard', key: String(t), slug: 'hard-' + t });
for (let t = 13; t <= 20; t++) HANDS.push({ kind: 'soft', key: String(t), slug: 'soft-' + t });
for (const c of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A']) HANDS.push({ kind: 'pairs', key: c, slug: 'pair-' + c.toLowerCase() });
const handLabel = (t, h) =>
  h.kind === 'hard' ? fill(t.hardLbl, { n: h.key }) : h.kind === 'soft' ? `${fill(t.softLbl, { n: h.key })} (A,${h.key - 11})` : fill(t.pairLbl, { c: h.key });
const handCards = (h) => {
  if (h.kind === 'pairs') return [h.key, h.key];
  if (h.kind === 'soft') return ['A', String(h.key - 11)];
  const a = Math.max(2, h.key - 10);
  return [String(h.key - a), String(a)];
};
const handUrl = (lang, h, i) => `/${lang}/hand/${h.slug}-vs-${UP_SLUGS[i]}/`;
const altPaths = (fn) => LANGS.map((l) => ({ hreflang: l.hreflang, path: fn(l.code) })).concat([{ hreflang: 'x-default', path: fn('en') }]);

function handsIndex(t, lang) {
  const chart = DATA[ruleId(DEFAULT_RULE)];
  const head = UP_LABELS.map((u) => `<th scope="col">${u}</th>`).join('');
  return ['hard', 'soft', 'pairs']
    .map((kind) => {
      const body = HANDS.filter((h) => h.kind === kind)
        .map((h) => {
          const label = kind === 'hard' ? h.key : kind === 'soft' ? 'A,' + (h.key - 11) : `${h.key},${h.key}`;
          return `<tr><th scope="row">${label}</th>` + chart[kind][h.key].map((c, i) => `<td class="c-${c}"><a href="${handUrl(lang, h, i)}" title="${esc(handLabel(t, h))} ${esc(t.vs)} ${UP_LABELS[i]}">${SHOW[c]}</a></td>`).join('') + '</tr>';
        })
        .join('');
      return `<section class="chart links"><h2>${esc(t[kind])}</h2><table><caption>${esc(t.yourHand)} × ${esc(t.dealerUp)}</caption><thead><tr><th scope="col" class="corner"></th>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
    })
    .join('');
}

function buildHands(L, t, urls) {
  const lang = L.code;
  const indexPath = `/${lang}/hand/`;
  const variants = RULES.filter((r) => r.decks === DECKS[0]);
  write(
    `${lang}/hand/index.html`,
    page({
      lang, t, title: `${t.handsTitle} – ${t.siteName}`, desc: t.homeDesc, pathname: indexPath, alternates: altPaths((l) => `/${l}/hand/`),
      body: `<nav class="crumbs" aria-label="breadcrumb"><a href="${url(lang)}">${esc(t.home)}</a> › <span>${esc(t.handGuide)}</span></nav><h1>${esc(t.handsTitle)}</h1><p class="note">${esc(t.defaultNote)}</p><div class="charts">${handsIndex(t, lang)}</div>`,
      ld: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.siteName, item: SITE + url(lang) },
        { '@type': 'ListItem', position: 2, name: t.handsTitle, item: SITE + indexPath },
      ] }],
    })
  );
  urls.push({ path: indexPath, alternates: altPaths((l) => `/${l}/hand/`), priority: '0.8' });

  for (const h of HANDS) {
    const hand = handLabel(t, h);
    const cards = handCards(h);
    UP_LABELS.forEach((up, i) => {
      const vars = { hand, up, n: RULES.length };
      const code = (r) => DATA[ruleId(r)][h.kind][h.key][i];
      const def = code(DEFAULT_RULE);
      const counts = {};
      for (const r of RULES) counts[code(r)] = (counts[code(r)] || 0) + 1;
      const order = CODES.filter((c) => counts[c]).sort((a, b) => counts[b] - counts[a]);
      const title = fill(t.handTitle, vars), desc = fill(t.handDesc, vars), h1 = fill(t.handH1, vars), q = fill(t.handQ, vars);
      const pathname = handUrl(lang, h, i);
      const hash = `#h=${cards[0]},${cards[1]}&d=${up}`;
      const matrix =
        `<table class="matrix"><thead><tr><th scope="col" class="corner">${esc(t.lblDecks)} →</th>${DECKS.map((n) => `<th scope="col" title="${esc(decksLabel(t, n))}">${n === Infinity ? '∞' : n}</th>`).join('')}</tr></thead><tbody>` +
        variants
          .map(
            (v) =>
              `<tr><th scope="row">${esc(shortRules(t, v))}</th>` +
              DECKS.map((n) => { const r = { ...v, decks: n }, c = code(r); return `<td class="c-${c}"><a href="${url(lang, r)}${hash}" title="${esc(t['l' + c])}">${SHOW[c]}</a></td>`; }).join('') +
              '</tr>'
          )
          .join('') +
        '</tbody></table>';
      const answer = `${t.handLead} ${t['l' + def]}. ${fill(t.handCount, vars)}: ${order.map((c) => `${t['l' + c]} (${counts[c]}/${RULES.length})`).join('; ')}.`;
      const body =
        `<nav class="crumbs" aria-label="breadcrumb"><a href="${url(lang)}">${esc(t.home)}</a> › <a href="${indexPath}">${esc(t.handGuide)}</a> › <span>${esc(h1)}</span></nav>` +
        `<h1>${esc(h1)}</h1><p class="lead">${esc(q)}</p>` +
        `<section class="answer"><p>${esc(t.handLead)}</p><p><strong class="c-${def}">${esc(t['l' + def])}</strong></p></section>` +
        `<section class="legend"><h2>${esc(fill(t.handCount, vars))}</h2><ul>${order.map((c) => `<li><span class="key c-${c}">${SHOW[c]}</span> ${esc(t['l' + c])} — ${counts[c]}/${RULES.length}</li>`).join('')}</ul></section>` +
        `<section><h2>${esc(t.handMatrix)}</h2>${matrix}</section>` +
        `<section class="more"><h2>${esc(t.handOtherUp)}</h2><ul>${UP_LABELS.map((u, j) => (j === i ? '' : `<li><a href="${handUrl(lang, h, j)}">${esc(hand)} ${esc(t.vs)} ${u}</a></li>`)).join('')}</ul></section>` +
        `<section class="more"><h2>${esc(fill(t.handOther, vars))}</h2><ul>${HANDS.map((o) => (o === h ? '' : `<li><a href="${handUrl(lang, o, i)}">${esc(handLabel(t, o))}</a></li>`)).join('')}</ul></section>`;
      write(
        `${lang}/hand/${h.slug}-vs-${UP_SLUGS[i]}/index.html`,
        page({
          lang, t, title, desc, pathname, alternates: altPaths((l) => handUrl(l, h, i)), body,
          ld: [
            { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
              { '@type': 'ListItem', position: 1, name: t.siteName, item: SITE + url(lang) },
              { '@type': 'ListItem', position: 2, name: t.handsTitle, item: SITE + indexPath },
              { '@type': 'ListItem', position: 3, name: h1, item: SITE + pathname },
            ] },
            { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: L.hreflang, mainEntity: [{ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: answer } }] },
          ],
        })
      );
      urls.push({ path: pathname, alternates: altPaths((l) => handUrl(l, h, i)), priority: '0.5' });
    });
  }
}

function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function build() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });

  const urls = [];
  const altFor = (r) =>
    LANGS.map((l) => ({ hreflang: l.hreflang, path: url(l.code, r) })).concat([{ hreflang: 'x-default', path: r ? url('en', r) : '/' }]);

  for (const L of LANGS) {
    const lang = L.code;
    const t = loadLang(lang);
    const how = `<section class="prose"><h2>${esc(t.howTitle)}</h2><p>${esc(t.howBody)}</p></section>`;

    const guideLink = `<section class="guide"><h2>${esc(t.handGuide)}</h2><p><a href="/${lang}/hand/">${esc(t.handsTitle)} →</a></p></section>`;

    // Home
    const faq = [1, 2, 3, 4].map((i) => [t['q' + i], t['a' + i]]);
    const homeBody =
      `<h1>${esc(t.homeH1)}</h1><p class="lead">${esc(t.homeIntro)}</p><p class="note">${esc(t.defaultNote)}</p>` +
      chartBlocks(t, lang, DEFAULT_RULE) +
      how +
      diffSection(t, lang, DEFAULT_RULE) +
      guideLink +
      `<section class="prose faq"><h2>${esc(t.faqTitle)}</h2>${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</section>` +
      allCharts(t, lang, null);
    write(
      `${lang}/index.html`,
      page({
        lang, t, title: t.homeTitle, desc: t.homeDesc, pathname: url(lang), alternates: altFor(null), body: homeBody,
        data: clientData(t, DEFAULT_RULE),
        ld: [
          { '@context': 'https://schema.org', '@type': 'WebSite', name: t.siteName, url: SITE + url(lang), inLanguage: L.hreflang, description: t.homeDesc },
          { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: L.hreflang, mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
        ],
      })
    );
    urls.push({ path: url(lang), alternates: altFor(null), priority: '1.0' });

    // One page per rule set
    for (const r of RULES) {
      const id = ruleId(r);
      const decks = decksLabel(t, r.decks);
      const title = fill(t.chartTitle, { decks, rules: shortRules(t, r) });
      const desc = fill(t.chartDesc, { decks, rules: longRules(t, r).join(', ') });
      const h1 = fill(t.chartH1, { decks });
      const body =
        `<nav class="crumbs" aria-label="breadcrumb"><a href="${url(lang)}">${esc(t.home)}</a> › <span>${esc(decks)} · ${esc(shortRules(t, r))}</span></nav>` +
        `<h1>${esc(h1)}</h1><p class="lead">${esc(t.chartIntro)}</p>` +
        `<section class="facts"><h2>${esc(t.tableRules)}</h2><ul><li>${esc(decks)}</li>${longRules(t, r).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` +
        chartBlocks(t, lang, r) +
        how +
        diffSection(t, lang, r) +
        guideLink +
        allCharts(t, lang, id);
      write(
        `${lang}/${id}/index.html`,
        page({
          lang, t, title, desc, pathname: url(lang, r), alternates: altFor(r), body, data: clientData(t, r),
          ld: [
            { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
              { '@type': 'ListItem', position: 1, name: t.siteName, item: SITE + url(lang) },
              { '@type': 'ListItem', position: 2, name: h1, item: SITE + url(lang, r) },
            ] },
            { '@context': 'https://schema.org', '@type': 'Article', headline: title, description: desc, inLanguage: L.hreflang, image: SITE + '/og.png',
              mainEntityOfPage: SITE + url(lang, r), dateModified: TODAY, author: { '@type': 'Organization', name: t.siteName, url: SITE + '/' },
              publisher: { '@type': 'Organization', name: t.siteName, url: SITE + '/' } },
          ],
        })
      );
      urls.push({ path: url(lang, r), alternates: altFor(r), priority: id === ruleId(DEFAULT_RULE) ? '0.9' : '0.7' });
    }
    buildHands(L, t, urls);
  }

  // Root: language chooser (x-default) with a client-side language redirect.
  const codes = LANGS.map((l) => l.code);
  const rootBody =
    `<h1>${esc(EN.homeH1)}</h1><p class="lead">${esc(EN.homeIntro)}</p>` +
    `<ul class="langs">${LANGS.map((l) => `<li><a href="/${l.code}/" hreflang="${l.hreflang}" lang="${l.hreflang}">${l.name}</a></li>`).join('')}</ul>`;
  const redirect = `<script>(function(){try{var c=${json(codes)},n=(navigator.languages||[navigator.language||'en']);for(var i=0;i<n.length;i++){var l=n[i].toLowerCase(),m=/^zh/.test(l)?(/tw|hk|mo|hant/.test(l)?'zh-tw':'zh-cn'):l.split('-')[0];if(c.indexOf(m)>-1){location.replace('/'+m+'/');return}}}catch(e){}})()</script>`;
  write(
    'index.html',
    page({ lang: 'en', t: EN, title: EN.homeTitle, desc: EN.homeDesc, pathname: '/', alternates: altFor(null), body: rootBody, ld: [
      { '@context': 'https://schema.org', '@type': 'WebSite', name: EN.siteName, url: SITE + '/' },
    ] }).replace('</head>', redirect + '\n</head>')
  );
  urls.unshift({ path: '/', alternates: altFor(null), priority: '1.0' });

  write(
    '404.html',
    page({ lang: 'en', t: EN, title: EN.notFound + ' – ' + EN.siteName, desc: EN.homeDesc, pathname: '/404.html', alternates: altFor(null),
      body: `<h1>${esc(EN.notFound)}</h1><ul class="langs">${LANGS.map((l) => `<li><a href="/${l.code}/">${l.name}</a></li>`).join('')}</ul>`, ld: [] })
      .replace(/<link rel="canonical"[^>]*>/, '<meta name="robots" content="noindex">')
  );

  const groups = {};
  for (const u of urls) (groups[u.path.split('/')[1] || 'root'] = groups[u.path.split('/')[1] || 'root'] || []).push(u);
  for (const [name, list] of Object.entries(groups)) {
    write(
      `sitemaps/${name}.xml`,
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
        list
          .map(
            (u) =>
              `<url><loc>${SITE}${u.path}</loc><lastmod>${TODAY}</lastmod><priority>${u.priority}</priority>` +
              u.alternates.map((x) => `<xhtml:link rel="alternate" hreflang="${x.hreflang}" href="${SITE}${x.path}"/>`).join('') +
              '</url>'
          )
          .join('\n') +
        '\n</urlset>\n'
    );
  }
  write(
    'sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      Object.keys(groups).map((name) => `<sitemap><loc>${SITE}/sitemaps/${name}.xml</loc><lastmod>${TODAY}</lastmod></sitemap>`).join('\n') +
      '\n</sitemapindex>\n'
  );
  fs.writeFileSync(path.join(DIST, 'urls.txt'), urls.map((u) => SITE + u.path).join('\n') + '\n');
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`built ${urls.length} pages for ${SITE}`);
}

build();
