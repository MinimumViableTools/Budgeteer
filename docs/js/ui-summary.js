/* Budgeteer page: the summary and the sticky scenario total bar. */
(function () {
  'use strict';
  var core = Budgeteer.core, ui = Budgeteer.ui, $ = ui.$, esc = ui.esc;

  function stamp(key) { return '<span class="pk-stamp pk-stamp--' + key + '">' + core.STATUS_TEXT[key] + '</span>'; }
  function rel(d) { return '<b>' + core.formatEuro(d.amount) + '</b> ' + (d.over ? 'over' : 'under'); }

  var part = {
    structure: function () {},
    value: function (plan) {
      var s = core.summary(plan, plan.scenario), key = s.status, b = plan.budgets, scn = plan.scenario;
      $('sumTotal').textContent = core.formatEuro(s.total);
      $('sumStatus').innerHTML = stamp(key);
      $('sumLines').innerHTML = '<span>Max budget ' + core.formatEuro(b.max) + '</span><span>' + rel(s.vsMax) + '</span><span>Stretch budget ' + core.formatEuro(b.stretch) + '</span><span>' + rel(s.vsStretch) + '</span>';
      var html = s.paragraphs.map(function (t) {
        var m = /^Milestones:(.*)$/.exec(t);
        return '<p>' + (m ? '<b>Milestones:</b>' + esc(m[1]) : esc(t)) + '</p>';
      }).join('');
      if (s.milestones.items.length) {
        html += '<ul class="ms-sum">' + s.milestones.items.map(function (x) {
          var stampHtml = '<span class="pk-stamp pk-stamp--' + (x.reached ? 'ok' : 'over') + '">' + (x.reached ? 'Reached' : 'Not reached') + '</span>';
          return '<li class="' + (x.reached ? 'reached' : 'missed') + '">' + stampHtml + '<div><b>' + (x.importance === 'must' ? 'Must-have' : 'Nice-to-have') + ': ' + esc(x.name) + '</b> <span class="ms-due">due ' + esc(x.due) + '</span>' +
            (x.value ? '<br>Goal: ' + esc(x.value.replace(/\.$/, '')) + '.' : '') + (x.reached ? '' : '<br>Not reached because ' + esc(x.reasonText) + '.') + '</div></li>';
        }).join('') + '</ul>';
      }
      $('sumText').innerHTML = html;
      /* the sticky total bar */
      $('tbLabel').textContent = (scn === 'max' ? 'Max' : 'Stretch') + ' total';
      $('tbNum').textContent = core.formatEuro(s.total);
      var scale = Math.max(s.total, b.stretch, b.max) * 1.12 || 1;
      $('tbFill').style.width = Math.min(100, s.total / scale * 100) + '%';
      $('tbMax').style.left = (b.max / scale * 100) + '%';
      $('tbStr').style.left = (b.stretch / scale * 100) + '%';
      $('tbStamp').innerHTML = stamp(key);
    }
  };

  ui.onReady(function () { ui.addPart(part); });
})();
