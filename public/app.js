(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('data').textContent);
  var UP = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

  // Rule selector: navigate to the page for the chosen rule set.
  var form = document.getElementById('rules');
  if (form) {
    form.addEventListener('change', function () {
      var f = form.elements;
      var enhc = f.hole.value === 'enhc';
      var sur = enhc ? 'ns' : f.sur.value;
      location.href =
        '/' + form.dataset.lang + '/' + [f.decks.value + '-deck', f.s17.value, f.das.value, sur, f.hole.value].join('-') + '/';
    });
  }

  // Quick hand lookup.
  var c1 = document.getElementById('lk1'), c2 = document.getElementById('lk2'), d = document.getElementById('lkd');
  var out = document.getElementById('lkout');
  if (!c1) return;

  function find(kind, key) {
    var rows = document.querySelectorAll('.chart[data-kind="' + kind + '"] tbody tr');
    for (var i = 0; i < rows.length; i++) if ((' ' + rows[i].dataset.k + ' ').indexOf(' ' + key + ' ') > -1) return rows[i];
    return null;
  }

  function update() {
    var a = c1.value, b = c2.value, col = UP.indexOf(d.value), kind, key;
    var on = document.querySelector('td.on');
    if (on) on.classList.remove('on');
    if (a === b) { kind = 'pairs'; key = a; }
    else if (a === 'A' || b === 'A') {
      var x = a === 'A' ? b : a;
      if (x === '10') { out.textContent = data.labels.bj; out.className = ''; return; }
      kind = 'soft'; key = String(11 + Number(x));
    } else { kind = 'hard'; key = String(Number(a) + Number(b)); }
    var code = data.chart[kind][key][col];
    out.textContent = data.labels[code];
    out.className = 'c-' + code;
    var row = find(kind, key);
    if (row) row.children[col + 1].classList.add('on');
  }

  [c1, c2, d].forEach(function (el) { el.addEventListener('change', update); });
  update();
})();
