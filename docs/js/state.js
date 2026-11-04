/* Budgeteer state: the plan, the actions that change it, and change notification. No access to the page. */
(function (root, factory) {
  var api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./core.js') : root.Budgeteer.core);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.state = api; }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  /* Each notification says what changed: 'structure' rebuilds forms and lists, 'value' only refreshes results,
     so a field the person is typing in keeps its focus. */
  function createStore(initialPlan, initialNotice) {
    var plan = initialPlan, notice = initialNotice || '', listeners = [];
    function emit(kind) { listeners.slice().forEach(function (fn) { fn({ kind: kind, plan: plan, notice: notice }); }); }
    function commit(next, kind, message) { plan = next; notice = message || ''; emit(kind); }
    function say(message) { notice = message; emit('notice'); }
    function mapResource(id, fn) { return plan.resources.map(function (r) { return r.id === id ? fn(r) : r; }); }
    function num(v, lo, hi) { v = Number(v); if (!isFinite(v)) v = 0; return Math.min(hi === undefined ? 1e12 : hi, Math.max(lo, v)); }

    var store = {
      getPlan: function () { return plan; },
      getNotice: function () { return notice; },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
      say: say,
      loadPlan: function (next, message) { commit(next, 'structure', message); },

      renamePlan: function (name) {
        var n = core.cleanName(name); if (!n || n === plan.name) return;
        commit(Object.assign({}, plan, { name: n }), 'value');
      },
      setView: function (view) {
        if (view === plan.view) return;
        if (view === 'quarter' && !core.canUseQuarterView(plan.length)) { say('The quarter view needs a plan length that is a multiple of 3 months.'); return; }
        commit(Object.assign({}, plan, { view: view }), 'structure');
      },
      setLength: function (shown) {
        var c = core.clampLength(shown, plan.view);
        commit(Object.assign({}, plan, { length: c.months }), 'structure', c.message);
      },
      setBudget: function (which, value) {
        var b = Object.assign({}, plan.budgets); b[which] = num(value, 0);
        commit(Object.assign({}, plan, { budgets: b }), 'value');
      },
      setScenario: function (scenario) {
        if (scenario !== 'max' && scenario !== 'stretch') return;
        commit(Object.assign({}, plan, { scenario: scenario }), 'structure');
      },

      addResource: function (key) {
        var r = core.addResource(plan, key);
        if (r.error) { say(r.error); return; }
        commit(r.plan, 'structure', 'Added ' + r.resource.name + (plan.scenario === 'max' ? ' to both scenarios.' : ' to the stretch scenario only.'));
      },
      removeResource: function (id) { commit(core.removeResource(plan, id), 'structure', 'Resource removed. Milestones that depended on it keep working without it.'); },
      setResourceOn: function (id, scenario, on) { commit(core.setResourceOn(plan, id, scenario, !!on), 'value'); },
      renameResource: function (id, name) { commit(Object.assign({}, plan, { resources: mapResource(id, function (r) { return Object.assign({}, r, { name: String(name).slice(0, 40) }); }) }), 'value'); },
      /* patch holds stored (monthly) values: rate, days, amount, due, from, to, type, mode */
      updateResource: function (id, patch, kind) {
        var p = Object.assign({}, patch);
        ['rate', 'days', 'amount', 'fteCost'].forEach(function (k) { if (k in p) p[k] = num(p[k], 0); });
        if ('share' in p) p.share = num(p.share, 0, core.LIMITS.maxShare);
        ['due', 'from'].forEach(function (k) { if (k in p) p[k] = Math.round(num(p[k], 1, core.LIMITS.months)); });
        if ('to' in p && p.to !== null) p.to = Math.round(num(p.to, 1, core.LIMITS.months));
        commit(Object.assign({}, plan, { resources: mapResource(id, function (r) { return Object.assign({}, r, p); }) }), kind || 'value');
      },
      changeResourceMode: function (id, mode) {
        commit(Object.assign({}, plan, { resources: mapResource(id, function (r) {
          var o = Object.assign({}, r, { mode: mode });
          if (mode === 'rateDays') { o.rate = o.rate || 600; o.days = o.days || 5; }
          if (mode === 'fte') { o.fteCost = o.fteCost || 8000; o.share = o.share === undefined ? 1 : o.share; }
          if (mode === 'fixed') o.amount = o.amount || 300;
          if (mode === 'oneTime') { o.amount = o.amount || 5000; o.due = o.due || Math.ceil(plan.length / 2); }
          return o;
        }) }), 'structure');
      },

      /* a milestone input is { name, value, due, linked, importance }; returns { ok, errors } */
      saveMilestone: function (input, id) {
        var v = core.validateMilestone(input);
        if (!v.ok) return { ok: false, errors: v.errors };
        if (id === undefined || id === null) {
          var r = core.addMilestone(plan, input);
          if (r.error) { say(r.error); return { ok: false, errors: { general: r.error } }; }
          commit(r.plan, 'structure', 'Milestone saved.');
          return { ok: true };
        }
        commit(Object.assign({}, plan, { milestones: plan.milestones.map(function (m) {
          return m.id !== id ? m : { id: id, name: v.name, value: v.value, due: input.due, linked: (input.linked || []).slice(), importance: input.importance === 'nice' ? 'nice' : 'must' };
        }) }), 'structure', 'Milestone saved.');
        return { ok: true };
      },
      deleteMilestone: function (id) {
        commit(Object.assign({}, plan, { milestones: plan.milestones.filter(function (m) { return m.id !== id; }) }), 'structure', 'Milestone deleted.');
      }
    };
    return store;
  }

  return { createStore: createStore };
});
