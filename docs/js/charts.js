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

  /* the shown period in which the running total first passes a budget: [{ index, kind: 'max' | 'stretch' | 'both' }] */
  function passMarks(plan, t) {
    var out = {}, order = [];
    [['max', t.passedMax], ['stretch', t.passedStretch]].forEach(function (x) {
      if (!x[1]) return;
      var i = (plan.view === 'quarter' ? core.quarterOf(x[1]) : x[1]) - 1;
      if (!out[i]) { out[i] = { index: i, kind: x[0] }; order.push(i); } else out[i].kind = 'both';
    });
    return order.map(function (i) { return out[i]; });
  }
  var PASS_TEXT = { max: 'Passes max', stretch: 'Passes stretch', both: 'Passes max + stretch' };

  /* the numbers behind the cost chart: one entry per shown period */
  function buildCostModel(plan, scenario, width) {
    var t = core.scenarioTotals(plan, scenario), g = core.groupForView(t.monthly, plan.view);
    var periods = g.map(function (b, i) { return { label: core.periodLabel(i + 1, plan.view), byType: b, total: core.sumByType(b) }; });
    var maxP = 0; periods.forEach(function (p) { if (p.total > maxP) maxP = p.total; });
    var passes = passMarks(plan, t);
    var markers = plan.milestones.map(function (m) {
      var st = core.milestoneStatus(plan, m, scenario, t);
      return { id: m.id, name: m.name, index: (plan.view === 'quarter' ? core.quarterOf(m.due) : m.due) - 1, reached: st.reached, due: core.monthLabel(m.due, plan.view, 'end') };
    });
    return { view: plan.view, scenario: scenario, width: Math.max(280, width || 640), periods: periods, maxPeriod: maxP, unit: core.unitName(plan.view), passes: passes, markers: markers };
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
    var passRows = [], lastEnd = [-1e9, -1e9];
    (model.passes || []).forEach(function (m) {
      var cx = padL + col * m.index + col / 2, text = PASS_TEXT[m.kind], half = text.length * 3.7 + 6, row = (cx - half) < lastEnd[0] ? 1 : 0;
      lastEnd[row] = cx + half; passRows.push({ m: m, cx: cx, text: text, row: row });
      s += '<rect data-pass="' + m.index + '" x="' + r1(padL + col * m.index + 2) + '" y="' + (padT - 20) + '" width="' + r1(col - 4) + '" height="' + (ph + 20) + '" fill="' + (m.kind === 'max' ? 'var(--status-warn)' : 'var(--status-over)') + '" fill-opacity="0.2" rx="2"/>';
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
    passRows.forEach(function (r) {
      s += '<text data-passlabel="' + r.m.index + '" x="' + r1(r.cx) + '" y="' + (padT - 8 - r.row * 15) + '" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">' + r.text + '</text>';
    });
    var slot = {};
    (model.markers || []).forEach(function (mk) {
      var k = slot[mk.index] || 0; slot[mk.index] = k + 1;
      var cx = padL + col * mk.index + col / 2 + k * 24, cy = 16, tip = esc(mk.name + ': ' + (mk.reached ? 'reached' : 'not reached') + ', due ' + mk.due);
      s += '<g class="mk" data-ms="' + mk.id + '" data-reached="' + (mk.reached ? 1 : 0) + '" tabindex="0" role="button" aria-label="Milestone ' + esc(mk.name) + ', ' + (mk.reached ? 'reached' : 'not reached') + ', due ' + esc(mk.due) + '. Edit">';
      s += mk.reached
        ? '<circle cx="' + r1(cx) + '" cy="' + cy + '" r="10" fill="var(--status-ok)"/><path d="M' + r1(cx - 4.5) + ' ' + (cy + 0.5) + 'l3 3L' + r1(cx + 4.5) + ' ' + (cy - 3.5) + '" fill="none" stroke="var(--surface-raised)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
        : '<rect x="' + r1(cx - 8) + '" y="' + (cy - 8) + '" width="16" height="16" fill="var(--status-over)" transform="rotate(45 ' + r1(cx) + ' ' + cy + ')"/><path d="M' + r1(cx - 3.5) + ' ' + (cy - 3.5) + 'l7 7M' + r1(cx + 3.5) + ' ' + (cy - 3.5) + 'l-7 7" fill="none" stroke="var(--surface-raised)" stroke-width="2.2" stroke-linecap="round"/>';
      s += '<title>' + tip + '</title></g>';
      s += '<line x1="' + r1(cx) + '" x2="' + r1(cx) + '" y1="' + (cy + 11) + '" y2="' + (cy + 18) + '" stroke="var(--border-strong)"/>';
    });
    (model.overlay || []).forEach(function (o) { s += o(padL, col, padT, ph, y); });
    return s + '</svg>';
  }
  function costAlt(model) {
    var t = 'Cost per ' + model.unit + ' in the ' + model.scenario + ' scenario: ' + model.periods.map(function (p) { return p.label + ' ' + core.formatEuro(p.total); }).join(', ') + '.';
    if (model.markers && model.markers.length) t += ' Milestones: ' + model.markers.map(function (m) { return m.name + ' due ' + m.due + ', ' + (m.reached ? 'reached' : 'not reached'); }).join('; ') + '.';
    return t;
  }

  /* the headroom bar: the plan total stacked by period against the max and stretch budgets */
  function buildHeadroomModel(plan, scenario, width) {
    var t = core.scenarioTotals(plan, scenario), g = core.groupForView(t.monthly, plan.view);
    var cross = {}; passMarks(plan, t).forEach(function (m) { cross[m.index] = m.kind; });
    return {
      view: plan.view, scenario: scenario, width: Math.max(250, width || 290), total: t.total, budgets: plan.budgets, unit: core.unitName(plan.view),
      periods: g.map(function (b, i) { return { label: core.periodLabel(i + 1, plan.view), byType: b, total: core.sumByType(b), cross: cross[i] || null }; }),
      passedMax: t.passedMax ? core.monthShort(t.passedMax, plan.view) : null, passedStretch: t.passedStretch ? core.monthShort(t.passedStretch, plan.view) : null
    };
  }
  function headroomChart(model) {
    var W = model.width, H = 350, bx = 56, bw = 44, top = 18, bottom = 312, total = model.total, b = model.budgets;
    var yMax = Math.max(total, b.stretch, b.max) * 1.1 || 1000;
    function y(v) { return bottom - (v / yMax) * (bottom - top); }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-labelledby="headTitle headAlt" focusable="false">', acc = 0;
    model.periods.forEach(function (p, idx) {
      var start = acc;
      core.TYPE_ORDER.forEach(function (ty) {
        var v = p.byType[ty]; if (v <= 0) return;
        s += '<rect data-slice="' + idx + '" data-type="' + ty + '" x="' + bx + '" y="' + r1(y(acc + v)) + '" width="' + bw + '" height="' + r1(Math.max(0, y(acc) - y(acc + v))) + '" fill="' + TYPE_COLORS[ty] + '" stroke="var(--surface-raised)" stroke-width="1.5"><title>' + esc(p.label + ' ' + core.TYPE_LABELS[ty] + ' ' + core.formatEuro(v)) + '</title></rect>';
        acc += v;
      });
      var h = y(start) - y(acc);
      if (h >= 12 || p.cross) s += '<text data-slicelabel="' + idx + '" x="' + (bx - 8) + '" y="' + r1((y(start) + y(acc)) / 2 + 4) + '" text-anchor="end" font-size="12" ' + (p.cross ? 'font-weight="700" fill="var(--ink)"' : 'fill="var(--ink-muted)"') + '>' + esc(p.label) + '</text>';
    });
    s += '<line x1="' + bx + '" x2="' + (bx + bw) + '" y1="' + bottom + '" y2="' + bottom + '" stroke="var(--border-strong)" stroke-width="2"/>';
    s += '<line data-tick="max" x1="' + (bx - 6) + '" x2="' + (bx + bw + 8) + '" y1="' + r1(y(b.max)) + '" y2="' + r1(y(b.max)) + '" stroke="var(--ink)" stroke-width="2"/>';
    s += '<line data-tick="stretch" x1="' + (bx - 6) + '" x2="' + (bx + bw + 8) + '" y1="' + r1(y(b.stretch)) + '" y2="' + r1(y(b.stretch)) + '" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4"/>';
    spreadLabels([
      { y: y(b.stretch), text: 'Stretch ' + core.formatEuro(b.stretch), kind: 'stretch' },
      { y: y(total), text: 'Total ' + core.formatEuro(total), kind: 'total' },
      { y: y(b.max), text: 'Max ' + core.formatEuro(b.max), kind: 'max' }
    ], 17, top, bottom).forEach(function (l) {
      s += '<text data-label="' + l.kind + '" x="' + (bx + bw + 14) + '" y="' + r1(l.y + 4) + '" font-size="12" fill="var(--ink)"' + (l.kind === 'total' ? ' font-weight="700"' : '') + '>' + esc(l.text) + '</text>';
    });
    return s + '<text x="' + (bx + bw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="12" fill="var(--ink-muted)">' + (model.scenario === 'max' ? 'Max' : 'Stretch') + ' total</text></svg>';
  }
  function headroomAlt(model) {
    var t = 'The ' + model.scenario + ' scenario totals ' + core.formatEuro(model.total) + ', against a max budget of ' + core.formatEuro(model.budgets.max) + ' and a stretch budget of ' + core.formatEuro(model.budgets.stretch) + '.';
    if (model.passedMax) t += ' The running total passes the max budget in ' + model.passedMax + '.';
    if (model.passedStretch) t += ' It passes the stretch budget in ' + model.passedStretch + '.';
    return t;
  }

  return { PASS_TEXT: PASS_TEXT, buildHeadroomModel: buildHeadroomModel, headroomChart: headroomChart, headroomAlt: headroomAlt, TYPE_COLORS: TYPE_COLORS, esc: esc, kfmt: kfmt, niceStep: niceStep, axis: axis, spreadLabels: spreadLabels, buildCostModel: buildCostModel, costChart: costChart, costAlt: costAlt };
});
