(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('data').textContent);
  var L = data.labels;
  var UP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
  var CARDS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  // Rule selector: navigate to the page for the chosen rule set (keeps the selected hand).
  var form = document.getElementById('rules');
  if (form) {
    form.addEventListener('change', function () {
      var f = form.elements;
      var enhc = f.hole.value === 'enhc';
      var sur = enhc ? 'ns' : f.sur.value;
      location.href =
        '/' + form.dataset.lang + '/' + [f.decks.value + '-deck', f.s17.value, f.das.value, sur, f.hole.value].join('-') + '/' + location.hash;
    });
  }

  var c1 = document.getElementById('lk1'), c2 = document.getElementById('lk2'), d = document.getElementById('lkd');
  var out = document.getElementById('lkout');
  var bar = document.getElementById('pick'), barHand = document.getElementById('pickhand'), barAct = document.getElementById('pickact');
  var shareBtn = document.getElementById('share');
  if (!c1) return;
  var shareText = '', picked = false;

  // Cookieless usage analytics (Vercel Web Analytics custom events).
  function track(name, extra) {
    var props = { rule: data.rule, lang: document.documentElement.lang, hand: c1.value + ',' + c2.value + ' vs ' + d.value };
    for (var k in extra || {}) props[k] = extra[k];
    try { window.va('event', { name: name, data: props }); } catch (e) {}
  }

  function findRow(kind, key) {
    var rows = document.querySelectorAll('.chart[data-kind="' + kind + '"] tbody tr');
    for (var i = 0; i < rows.length; i++) if ((' ' + rows[i].dataset.k + ' ').indexOf(' ' + key + ' ') > -1) return rows[i];
    return null;
  }

  // Which chart row a two-card hand belongs to.
  function classify(a, b) {
    if (a === b) return { kind: 'pairs', key: a, label: a + ',' + a };
    if (a === 'A' || b === 'A') {
      var x = a === 'A' ? b : a;
      if (x === '10') return null;
      return { kind: 'soft', key: String(11 + Number(x)), label: L.soft.replace('{n}', 11 + Number(x)) + ' (A,' + x + ')' };
    }
    var t = Number(a) + Number(b);
    return { kind: 'hard', key: String(t), label: L.hard.replace('{n}', t) };
  }

  // A representative two-card hand for a chart row.
  function cardsFor(kind, key) {
    if (kind === 'pairs') return [key, key];
    if (kind === 'soft') return ['A', String(Number(key) - 11)];
    var t = Number(key), a = Math.max(2, t - 10);
    return [String(t - a), String(a)];
  }

  function update(reveal, scroll) {
    var a = c1.value, b = c2.value, col = UP.indexOf(d.value);
    var on = document.querySelector('td.on');
    if (on) on.classList.remove('on');
    var h = classify(a, b);
    if (!h) {
      out.textContent = L.bj; out.className = '';
      bar.hidden = true; document.body.classList.remove('has-pick');
      return;
    }
    var code = data.chart[h.kind][h.key][col];
    out.textContent = L[code]; out.className = 'c-' + code;
    var hand = h.label + ' ' + L.vs + ' ' + d.value;
    barHand.textContent = hand;
    barHand.href = '/' + document.documentElement.dataset.lang + '/hand/' + (h.kind === 'pairs' ? 'pair' : h.kind) + '-' + h.key.toLowerCase() + '-vs-' + d.value.toLowerCase() + '/'; barAct.textContent = L[code]; barAct.className = 'c-' + code;
    shareText = hand + ' → ' + L[code];
    var row = findRow(h.kind, h.key), cell = row && row.children[col + 1];
    if (cell) cell.classList.add('on');
    if (reveal) {
      bar.hidden = false; document.body.classList.add('has-pick');
      try { history.replaceState(null, '', '#h=' + a + ',' + b + '&d=' + d.value); } catch (e) {}
      if (scroll && cell) cell.scrollIntoView({ block: 'center' });
    }
  }

  [c1, c2, d].forEach(function (el) { el.addEventListener('change', function () { update(true); }); });

  // Click (or Enter/Space on) any chart cell to select that hand.
  function pick(cell) {
    var row = cell.parentNode, sec = row.closest('.chart');
    var cards = cardsFor(sec.dataset.kind, row.dataset.k.split(' ')[0]);
    c1.value = cards[0]; c2.value = cards[1]; d.value = UP[cell.cellIndex - 1];
    update(true);
    if (!picked) { picked = true; track('chart_click'); }
  }
  var cells = document.querySelectorAll('.chart tbody td');
  for (var i = 0; i < cells.length; i++) { cells[i].tabIndex = 0; cells[i].setAttribute('role', 'button'); }
  document.addEventListener('click', function (e) {
    var cell = e.target.closest && e.target.closest('.chart tbody td');
    if (cell) pick(cell);
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.chart tbody td')) { e.preventDefault(); pick(e.target); }
  });

  // Share the selected hand: native share sheet where available, otherwise copy the link.
  function copied() {
    shareBtn.textContent = L.copied;
    setTimeout(function () { shareBtn.textContent = L.share; }, 2000);
  }
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); copied(); } catch (e) {}
    document.body.removeChild(ta);
  }
  shareBtn.addEventListener('click', function () {
    var url = location.href;
    track('share', { method: navigator.share ? 'native' : 'copy' });
    if (navigator.share) { navigator.share({ title: document.title, text: shareText, url: url }).catch(function () {}); return; }
    var text = shareText + '\n' + url;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(copied, function () { legacyCopy(text); });
    else legacyCopy(text);
  });

  // Open a shared link: #h=10,6&d=10
  var m = /h=([A0-9]+),([A0-9]+)&d=([A0-9]+)/.exec(decodeURIComponent(location.hash));
  if (m && CARDS.indexOf(m[1]) > -1 && CARDS.indexOf(m[2]) > -1 && UP.indexOf(m[3]) > -1) {
    c1.value = m[1]; c2.value = m[2]; d.value = m[3];
    update(true, true);
    track('shared_link_open');
  } else update(false);
})();
