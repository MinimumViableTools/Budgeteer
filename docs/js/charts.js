/* Budgeteer charts: pure functions that build the SVG text of the charts from numbers. No access to the page. */
(function (root, factory) {
  var api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./core.js') : root.Budgeteer.core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.charts = api; }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  var TYPE_COLORS = { internalDev: 'var(--data-internal-dev)', freelancer: 'var(--data-freelancer)', subscription: 'var(--data-subscription)', infrastructure: 'var(--data-infrastructure)', oneTime: 'var(--data-one-time)' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function kfmt(n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n)); }

  /* a round step for the axis: 1, 2, 2.5 or 5 times a power of ten */
  function niceStep(max, count) {
    var raw = max / count, pow = Math.pow(10, Math.floor(Math.log10(raw))), m = [1, 2, 2.5, 5, 10], i;
    for (i = 0; i < m.length; i++) if (raw <= m[i] * pow) return m[i] * pow;
    return 10 * pow;
  }
  /* the top of the axis has some headroom above the largest value */
  function axis(maxValue, count) {
    var max = maxValue > 0 ? maxValue : 1000, step = niceStep(max * 1.12, count || 4), top = Math.ceil(max * 1.12 / step) * step, ticks = [], t;
    for (t = 0; t <= top + step / 1000; t += step) ticks.push(Math.round(t * 1000) / 1000);
    return { top: top, step: step, ticks: ticks };
  }
  /* push labels apart so that none is closer than minGap, staying inside lo..hi */
  function spreadLabels(items, minGap, lo, hi) {
    var out = items.map(function (x) { return Object.assign({}, x); }), i;
    out.sort(function (a, b) { return a.y - b.y; });
    for (i = 0; i < out.length; i++) if (out[i].y < lo) out[i].y = lo;
    for (i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < minGap) out[i].y = out[i - 1].y + minGap;
    if (out.length && out[out.length - 1].y > hi) {
      out[out.length - 1].y = hi;
      for (i = out.length - 2; i >= 0; i--) if (out[i + 1].y - out[i].y < minGap) out[i].y = out[i + 1].y - minGap;
    }
    return out;
  }

  /* the numbers behind the cost chart: one entry per shown period */
  function buildCostModel(plan, scenario, width) {
    var t = core.scenarioTotals(plan, scenario), g = core.groupForView(t.monthly, plan.view);
    var periods = g.map(function (b, i) { return { label: core.periodLabel(i + 1, plan.view), byType: b, total: core.sumByType(b) }; });
    var maxP = 0; periods.forEach(function (p) { if (p.total > maxP) maxP = p.total; });
    return { view: plan.view, scenario: scenario, width: Math.max(280, width || 640), periods: periods, maxPeriod: maxP, unit: core.unitName(plan.view) };
  }

  function costChart(model) {
    var W = model.width, H = 350, padL = 50, padR = 8, padT = 64, padB = 40, n = model.periods.length;
    var pw = W - padL - padR, ph = H - padT - padB, ax = axis(model.maxPeriod, 4), col = pw / Math.max(1, n), bw = Math.min(52, col * 0.62);
    function y(v) { return padT + ph - (v / ax.top) * ph; }
    var showValues = col >= 44, labelEvery = col >= 26 ? 1 : 2, s = '';
    s += '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-labelledby="costTitle costAlt" focusable="false">';
    ax.ticks.forEach(function (t) {
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + r1(y(t)) + '" y2="' + r1(y(t)) + '" stroke="var(--rule)" stroke-width="1"/>';
      s += '<text x="' + (padL - 8) + '" y="' + r1(y(t) + 4) + '" text-anchor="end" font-size="12" fill="var(--ink-muted)">' + kfmt(t) + '</text>';
    });
    (model.underlay || []).forEach(function (u) { s += u(padL, col, padT, ph, y); });
    var peak = -1, peakV = -1; model.periods.forEach(function (p, i) { if (p.total > peakV) { peakV = p.total; peak = i; } });
    model.periods.forEach(function (p, idx) {
      var x = padL + col * idx + (col - bw) / 2, acc = 0;
      core.TYPE_ORDER.forEach(function (ty) {
        var v = p.byType[ty]; if (v <= 0) return;
        var y1 = y(acc + v), y0 = y(acc);
        s += '<rect data-bar="' + idx + '" data-type="' + ty + '" x="' + r1(x) + '" y="' + r1(y1) + '" width="' + r1(bw) + '" height="' + r1(Math.max(0, y0 - y1)) + '" fill="' + TYPE_COLORS[ty] + '"><title>' + esc(p.label + ' ' + core.TYPE_LABELS[ty] + ' ' + core.formatEuro(v)) + '</title></rect>';
        acc += v;
      });
      if (p.total > 0 && (showValues || idx === peak)) s += '<text x="' + r1(x + bw / 2) + '" y="' + r1(y(p.total) - 6) + '" text-anchor="middle" font-size="12" fill="var(--ink)">' + kfmt(p.total) + '</text>';
      if (idx % labelEvery === 0) s += '<text x="' + r1(x + bw / 2) + '" y="' + (H - padB + 20) + '" text-anchor="middle" font-size="12" fill="var(--ink-muted)">' + esc(p.label) + '</text>';
    });
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + r1(y(0)) + '" y2="' + r1(y(0)) + '" stroke="var(--border-strong)" stroke-width="2"/>';
    (model.overlay || []).forEach(function (o) { s += o(padL, col, padT, ph, y); });
    return s + '</svg>';
  }
  function costAlt(model) {
    return 'Cost per ' + model.unit + ' in the ' + model.scenario + ' scenario: ' + model.periods.map(function (p) { return p.label + ' ' + core.formatEuro(p.total); }).join(', ') + '.';
  }

  return { TYPE_COLORS: TYPE_COLORS, esc: esc, kfmt: kfmt, niceStep: niceStep, axis: axis, spreadLabels: spreadLabels, buildCostModel: buildCostModel, costChart: costChart, costAlt: costAlt };
});
