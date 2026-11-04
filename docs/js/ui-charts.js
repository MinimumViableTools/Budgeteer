/* Budgeteer page: the charts. */
(function () {
  'use strict';
  var core = Budgeteer.core, charts = Budgeteer.charts, ui = Budgeteer.ui, $ = ui.$;
  var lastPlan = null, pending = false;

  function width() { var el = $('costChart'); return el ? Math.floor(el.clientWidth) : 640; }

  function draw(plan) {
    var model = charts.buildCostModel(plan, plan.scenario, width());
    $('costTitle').textContent = 'Cost per ' + model.unit + ' by resource type';
    $('costChart').innerHTML = charts.costChart(model);
    $('costAlt').textContent = charts.costAlt(model);
  }

  var part = {
    structure: function () {
      $('legend').innerHTML = core.TYPE_ORDER.map(function (k) { return '<span style="--c:' + charts.TYPE_COLORS[k] + '"><i></i>' + core.TYPE_LABELS[k] + '</span>'; }).join('');
    },
    value: function (plan) { lastPlan = plan; draw(plan); }
  };

  ui.onReady(function () {
    ui.addPart(part);
    if (typeof ResizeObserver === 'function') {
      var last = 0;
      new ResizeObserver(function () {
        var w = width(); if (w === last || !lastPlan || pending) return;
        pending = true; requestAnimationFrame(function () { pending = false; last = width(); draw(lastPlan); });
      }).observe($('costChart'));
    }
  });
})();
