/* Budgeteer core: pure functions for the plan, its costs, milestones, units and text.
   No access to the page. Everything is stored in months; the quarter view only groups months. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.core = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = { months: 12, quarters: 4, resources: 20, milestones: 8, milestoneName: 40, milestoneValue: 140 };
  var TYPE_ORDER = ['internalDev', 'freelancer', 'subscription', 'infrastructure', 'oneTime'];
  var TYPE_LABELS = { internalDev: 'Internal dev', freelancer: 'Freelancer', subscription: 'Subscription', infrastructure: 'Infrastructure', oneTime: 'One time' };
  var TEMPLATES = {
    internalDev: { name: 'Internal developer', type: 'internalDev', mode: 'rateDays', rate: 1000, days: 10 },
    freelancer: { name: 'Freelancer', type: 'freelancer', mode: 'rateDays', rate: 650, days: 5 },
    subscription: { name: 'Subscription', type: 'subscription', mode: 'fixed', amount: 200 },
    infrastructure: { name: 'Infrastructure', type: 'infrastructure', mode: 'fixed', amount: 300 },
    oneTime: { name: 'One-time cost', type: 'oneTime', mode: 'oneTime', amount: 5000 }
  };
  var SCENARIOS = ['max', 'stretch'];

  /* money and numbers */
  function formatEuro(n) {
    var v = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (n < 0 && Math.round(Math.abs(n)) > 0 ? '-' : '') + '€' + v;
  }
  function parseAmount(text) {
    var v = parseFloat(String(text).replace(/[^0-9.\-]/g, ''));
    return isFinite(v) ? v : 0;
  }

  /* periods: the plan length is in months, the view only decides how they are grouped and labelled */
  function quarterOf(month) { return Math.ceil(month / 3); }
  function periodCount(plan) { return plan.view === 'quarter' ? plan.length / 3 : plan.length; }
  function unitName(view) { return view === 'quarter' ? 'quarter' : 'month'; }
  function periodLabel(index, view) { return (view === 'quarter' ? 'Q' : 'M') + index; }
  function monthShort(month, view) { return view === 'quarter' ? 'Q' + quarterOf(month) : 'M' + month; }
  /* "M5" in the month view. In the quarter view a month that sits where an edit would put it shows only the quarter, any other month
     shows both ("Q2 (M5)"). kind is 'start' for a start or a one-time due (the first month of a quarter) and 'end' for an end or a milestone due (the last). */
  function monthLabel(month, view, kind) {
    if (view !== 'quarter') return 'M' + month;
    var aligned = kind === 'start' ? month % 3 === 1 : month % 3 === 0;
    return 'Q' + quarterOf(month) + (aligned ? '' : ' (M' + month + ')');
  }
  function canUseQuarterView(length) { return length % 3 === 0; }

  /* length input (AC15): the value is in shown units, the result is in shown units and in months */
  function clampLength(value, view) {
    var cap = view === 'quarter' ? LIMITS.quarters : LIMITS.months;
    var v = Math.max(1, Math.round(value)), message = '';
    if (v > cap) { v = cap; message = 'A plan can have at most ' + cap + ' ' + unitName(view) + 's.'; }
    return { shown: v, months: view === 'quarter' ? v * 3 : v, message: message };
  }
  /* per-period values: shown in the quarter view as three times the monthly value (AC38) */
  function shownValue(monthly, view) { return view === 'quarter' ? monthly * 3 : monthly; }
  function storedValue(shown, view) { return view === 'quarter' ? shown / 3 : shown; }
  /* snapping when a precise month is edited in the quarter view (AC39, AC40) */
  function snapStart(q) { return 3 * (q - 1) + 1; }
  function snapEnd(q) { return 3 * q; }
  function snapOneTimeDue(q) { return 3 * (q - 1) + 1; }
  function snapMilestoneDue(q) { return 3 * q; }
  function isAligned(kind, month) {
    if (kind === 'end' || kind === 'milestone') return month === null || month % 3 === 0;
    return month % 3 === 1;
  }

  /* the choices of a period select. kind: 'start', 'end' (may be empty: end of plan), 'oneTime' or 'milestone'.
     In the quarter view a month that is not where an edit would put it gets its own entry, "keep", so nothing changes until the person picks a quarter. */
  function periodChoices(plan, kind, current) {
    var out = [], n = periodCount(plan), i, q = plan.view === 'quarter', endish = kind === 'end' || kind === 'milestone';
    if (kind === 'end') out.push({ value: '', label: 'End of plan', selected: current === null });
    if (!q) {
      for (i = 1; i <= plan.length; i++) out.push({ value: String(i), label: 'M' + i, selected: current === i });
      return out;
    }
    var aligned = current === null || isAligned(endish ? 'end' : 'start', current);
    if (current !== null && !aligned) out.push({ value: 'keep', label: monthLabel(current, 'quarter', endish ? 'end' : 'start'), selected: true });
    for (i = 1; i <= n; i++) out.push({ value: 'q' + i, label: 'Q' + i, selected: aligned && current !== null && quarterOf(current) === i });
    return out;
  }
  /* the month a choice stands for, null for "end of plan", undefined for "keep" */
  function monthFromChoice(kind, value) {
    if (value === 'keep') return undefined;
    if (value === '') return null;
    var m = /^q(\d+)$/.exec(value);
    if (!m) return parseInt(value, 10);
    var q = parseInt(m[1], 10);
    if (kind === 'start') return snapStart(q);
    if (kind === 'oneTime') return snapOneTimeDue(q);
    if (kind === 'end') return snapEnd(q);
    return snapMilestoneDue(q);
  }

  /* costs */
  function costAt(r, month, length) {
    var from = r.from || 1, to = r.to || length;
    if (r.mode === 'oneTime') return month === r.due ? r.amount : 0;
    if (month < from || month > to) return 0;
    return r.mode === 'rateDays' ? r.rate * r.days : r.amount;
  }
  function emptyByType() { var o = {}; TYPE_ORDER.forEach(function (t) { o[t] = 0; }); return o; }
  function sumByType(b) { var s = 0; TYPE_ORDER.forEach(function (t) { s += b[t]; }); return s; }
  function monthlyByType(plan, scenario) {
    var out = [], m, byType;
    for (m = 1; m <= plan.length; m++) {
      byType = emptyByType();
      plan.resources.forEach(function (r) { if (r.on[scenario]) byType[r.type] += costAt(r, m, plan.length); });
      out.push(byType);
    }
    return out;
  }
  function runningTotals(monthly) { var s = 0; return monthly.map(function (b) { s += sumByType(b); return s; }); }
  function groupForView(monthly, view) {
    if (view !== 'quarter') return monthly.slice();
    var out = [], q, i;
    for (q = 0; q < monthly.length / 3; q++) {
      var b = emptyByType();
      for (i = 0; i < 3; i++) TYPE_ORDER.forEach(function (t) { b[t] += monthly[q * 3 + i][t]; });
      out.push(b);
    }
    return out;
  }
  function lineTotal(r, length) { var s = 0, m; for (m = 1; m <= length; m++) s += costAt(r, m, length); return s; }
  /* the first month whose running total is strictly above the budget, or null */
  function firstPassedMonth(running, budget) {
    for (var i = 0; i < running.length; i++) if (running[i] > budget) return i + 1;
    return null;
  }
  function scenarioTotals(plan, scenario) {
    var monthly = monthlyByType(plan, scenario), running = runningTotals(monthly);
    return {
      monthly: monthly, running: running, total: running.length ? running[running.length - 1] : 0,
      passedMax: firstPassedMonth(running, plan.budgets.max), passedStretch: firstPassedMonth(running, plan.budgets.stretch)
    };
  }
  function status(total, budgets) {
    if (total <= budgets.max) return 'ok';
    if (total <= budgets.stretch) return 'warn';
    return 'over';
  }
  var STATUS_TEXT = { ok: 'Within max budget', warn: 'In stretch zone', over: 'Over stretch budget' };
  function distance(total, budget) { return { amount: Math.abs(total - budget), over: total > budget }; }

  /* a resource that starts, or is due, after the plan ends adds nothing */
  function outsidePlan(r, length) {
    if (r.mode === 'oneTime') return r.due > length;
    return (r.from || 1) > length;
  }

  /* milestones */
  function findResource(plan, id) { for (var i = 0; i < plan.resources.length; i++) if (plan.resources[i].id === id) return plan.resources[i]; return null; }
  function milestoneStatus(plan, ms, scenario, totals) {
    var t = totals || scenarioTotals(plan, scenario), passed = firstPassedMonth(t.running, plan.budgets[scenario]);
    var reasons = [];
    if (passed !== null && passed <= ms.due) reasons.push({ kind: 'budget', month: passed, text: 'budget passed in ' + monthShort(passed, plan.view) });
    ms.linked.forEach(function (id) {
      var r = findResource(plan, id);
      if (r && !r.on[scenario]) reasons.push({ kind: 'resource', id: id, name: r.name, text: r.name + ' is switched off' });
    });
    return { reached: reasons.length === 0, reasons: reasons, reasonText: reasons.map(function (x) { return x.text; }).join(' and ') };
  }
  /* linked resources that start after the milestone is due: they add nothing to it */
  function lateLinks(plan, ms) {
    var out = [];
    ms.linked.forEach(function (id) {
      var r = findResource(plan, id); if (!r) return;
      var start = r.mode === 'oneTime' ? r.due : (r.from || 1);
      if (start > ms.due) out.push(r.name);
    });
    return out;
  }
  function validateMilestone(input) {
    var errors = {}, name = String(input.name || '').trim(), value = String(input.value || '').trim();
    if (!name) errors.name = 'Give the milestone a name so you can recognise it in the list.';
    else if (name.length > LIMITS.milestoneName) errors.name = 'The name can have at most ' + LIMITS.milestoneName + ' characters.';
    if (value.length > LIMITS.milestoneValue) errors.value = 'The goal can have at most ' + LIMITS.milestoneValue + ' characters.';
    var ok = Object.keys(errors).length === 0;
    return { ok: ok, errors: errors, name: name, value: value, remaining: LIMITS.milestoneValue - value.length };
  }

  /* plan changes: each returns a new plan, or an error message with the plan unchanged */
  function nextId(list) { var m = 0; list.forEach(function (x) { if (x.id > m) m = x.id; }); return m + 1; }
  function newPlan(view, shownLength) {
    var c = clampLength(shownLength, view);
    return { version: 1, view: view, length: c.months, scenario: 'max', budgets: { max: 0, stretch: 0 }, resources: [], milestones: [] };
  }
  function addResource(plan, templateKey) {
    if (plan.resources.length >= LIMITS.resources) return { plan: plan, error: 'A plan can have at most ' + LIMITS.resources + ' resources. Remove one first.' };
    var t = TEMPLATES[templateKey], r = { id: nextId(plan.resources), name: t.name, type: t.type, mode: t.mode, from: 1, to: null, on: { max: false, stretch: false } };
    if (t.mode === 'rateDays') { r.rate = t.rate; r.days = t.days; } else r.amount = t.amount;
    if (t.mode === 'oneTime') r.due = Math.ceil(plan.length / 2);
    r.on[plan.scenario] = true;
    return { plan: Object.assign({}, plan, { resources: plan.resources.concat([r]) }), resource: r };
  }
  function removeResource(plan, id) {
    return Object.assign({}, plan, {
      resources: plan.resources.filter(function (r) { return r.id !== id; }),
      milestones: plan.milestones.map(function (m) { return Object.assign({}, m, { linked: m.linked.filter(function (x) { return x !== id; }) }); })
    });
  }
  function setResourceOn(plan, id, scenario, on) {
    return Object.assign({}, plan, { resources: plan.resources.map(function (r) {
      if (r.id !== id) return r;
      var o = Object.assign({}, r.on); o[scenario] = on; return Object.assign({}, r, { on: o });
    }) });
  }
  function addMilestone(plan, input) {
    if (plan.milestones.length >= LIMITS.milestones) return { plan: plan, error: 'A plan can have at most ' + LIMITS.milestones + ' milestones. Remove one first.' };
    var v = validateMilestone(input);
    if (!v.ok) return { plan: plan, errors: v.errors };
    var m = { id: nextId(plan.milestones), name: v.name, value: v.value, due: input.due, linked: (input.linked || []).slice(), importance: input.importance === 'nice' ? 'nice' : 'must' };
    return { plan: Object.assign({}, plan, { milestones: plan.milestones.concat([m]) }), milestone: m };
  }

  /* the narrative: plain sentences, rendered by the page */
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function summary(plan, scenario) {
    var t = scenarioTotals(plan, scenario), view = plan.view, scn = scenario === 'max' ? 'max' : 'stretch';
    var anyOn = plan.resources.some(function (r) { return r.on[scenario]; });
    var out = { total: t.total, status: status(t.total, plan.budgets), vsMax: distance(t.total, plan.budgets.max), vsStretch: distance(t.total, plan.budgets.stretch), paragraphs: [], milestones: { total: plan.milestones.length, notReached: [] } };
    if (!anyOn) { out.paragraphs.push('No resources are switched on in the ' + scn + ' scenario. Switch one on or add one to see the plan.'); return out; }
    var g = groupForView(t.monthly, view), byT = emptyByType(), bestType, bestPeriod = 1, bestVal = -1;
    g.forEach(function (b, i) { TYPE_ORDER.forEach(function (ty) { byT[ty] += b[ty]; }); var v = sumByType(b); if (v > bestVal) { bestVal = v; bestPeriod = i + 1; } });
    bestType = TYPE_ORDER.slice().sort(function (a, b) { return byT[b] - byT[a]; })[0];
    function rel(d, name) { return formatEuro(d.amount) + (d.over ? ' over' : ' under') + ' the ' + name + ' budget'; }
    out.paragraphs.push((scn === 'max' ? 'Max' : 'Stretch') + ' scenario over ' + plural(periodCount(plan), unitName(view)) + ': the plan totals ' + formatEuro(t.total) + '. That is ' + rel(out.vsMax, 'max') + ' and ' + rel(out.vsStretch, 'stretch') + '.');
    var p2 = TYPE_LABELS[bestType] + ' is the largest share at ' + Math.round(byT[bestType] / t.total * 100) + '% (' + formatEuro(byT[bestType]) + '). The most expensive ' + unitName(view) + ' is ' + periodLabel(bestPeriod, view) + ' at ' + formatEuro(bestVal) + '.';
    if (t.passedMax) p2 += ' The running total passes the max budget in ' + monthShort(t.passedMax, view) + '.';
    if (t.passedStretch) p2 += ' It passes the stretch budget in ' + monthShort(t.passedStretch, view) + '.';
    out.paragraphs.push(p2);
    if (plan.milestones.length) {
      plan.milestones.forEach(function (m) {
        var st = milestoneStatus(plan, m, scenario, t);
        if (!st.reached) out.milestones.notReached.push({ name: m.name, value: m.value, importance: m.importance, reasonText: st.reasonText });
      });
      out.milestones.notReached.sort(function (a, b) { return (a.importance === 'must' ? 0 : 1) - (b.importance === 'must' ? 0 : 1); });
      if (!out.milestones.notReached.length) out.paragraphs.push('Milestones: with the ' + scn + ' budget and resources, all ' + plan.milestones.length + ' goals are reached.');
      else out.paragraphs.push('Milestones: with the current ' + scn + ' budget and resources, ' + out.milestones.notReached.length + ' of ' + plan.milestones.length + ' goals are not reached.');
    }
    return out;
  }

  return {
    LIMITS: LIMITS, TYPE_ORDER: TYPE_ORDER, TYPE_LABELS: TYPE_LABELS, TEMPLATES: TEMPLATES, SCENARIOS: SCENARIOS, STATUS_TEXT: STATUS_TEXT,
    formatEuro: formatEuro, parseAmount: parseAmount,
    quarterOf: quarterOf, periodCount: periodCount, unitName: unitName, periodLabel: periodLabel, monthShort: monthShort, monthLabel: monthLabel,
    canUseQuarterView: canUseQuarterView, clampLength: clampLength, shownValue: shownValue, storedValue: storedValue,
    periodChoices: periodChoices, monthFromChoice: monthFromChoice, snapStart: snapStart, snapEnd: snapEnd, snapOneTimeDue: snapOneTimeDue, snapMilestoneDue: snapMilestoneDue, isAligned: isAligned,
    costAt: costAt, monthlyByType: monthlyByType, sumByType: sumByType, runningTotals: runningTotals, groupForView: groupForView, lineTotal: lineTotal,
    firstPassedMonth: firstPassedMonth, outsidePlan: outsidePlan, scenarioTotals: scenarioTotals, status: status, distance: distance,
    findResource: findResource, milestoneStatus: milestoneStatus, lateLinks: lateLinks, validateMilestone: validateMilestone,
    newPlan: newPlan, addResource: addResource, removeResource: removeResource, setResourceOn: setResourceOn, addMilestone: addMilestone,
    summary: summary
  };
});
