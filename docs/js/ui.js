/* Budgeteer page: reads the state and draws it, and turns events into state actions. */
(function () {
  'use strict';
  var core = Budgeteer.core;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtInput(n) { return String(Math.round(n * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  var store, parts = [];

  /* parts register a render function and, optionally, a function for value-only changes */
  function addPart(part) { parts.push(part); }

  function renderNotice(n) { $('notice').textContent = n || ''; }

  var settings = {
    structure: function (plan) {
      var q = plan.view === 'quarter';
      $('vMonth').setAttribute('aria-pressed', String(!q)); $('vQuarter').setAttribute('aria-pressed', String(q));
      $('vQuarter').disabled = !q && !core.canUseQuarterView(plan.length);
      $('length').value = core.periodCount(plan);
      $('lblLen').textContent = q ? 'Number of quarters (1 to 4)' : 'Number of months (1 to 12)';
      $('bMax').value = fmtInput(plan.budgets.max); $('bStr').value = fmtInput(plan.budgets.stretch);
      $('sMax').setAttribute('aria-pressed', String(plan.scenario === 'max')); $('sStr').setAttribute('aria-pressed', String(plan.scenario === 'stretch'));
      $('viewHint').textContent = (!q && !core.canUseQuarterView(plan.length))
        ? 'The quarter view needs a plan length that is a multiple of 3 months.'
        : 'Everything is stored in months. The quarter view groups three months into a quarter and converts nothing.';
    },
    value: function () {}
  };

  function bindSettings() {
    $('vMonth').addEventListener('click', function () { store.setView('month'); });
    $('vQuarter').addEventListener('click', function () { store.setView('quarter'); });
    $('sMax').addEventListener('click', function () { store.setScenario('max'); });
    $('sStr').addEventListener('click', function () { store.setScenario('stretch'); });
    $('length').addEventListener('change', function () { store.setLength(core.parseAmount(this.value)); });
    $('bMax').addEventListener('input', function () { store.setBudget('max', core.parseAmount(this.value)); });
    $('bStr').addEventListener('input', function () { store.setBudget('stretch', core.parseAmount(this.value)); });
    ['bMax', 'bStr'].forEach(function (id) { $(id).addEventListener('blur', function () { var p = store.getPlan(); this.value = fmtInput(p.budgets[id === 'bMax' ? 'max' : 'stretch']); }); });
  }

  function render(change) {
    var plan = change.plan;
    renderNotice(change.notice);
    parts.forEach(function (p) {
      if (change.kind === 'structure' || change.kind === 'init') p.structure(plan);
      if (change.kind === 'value' || change.kind === 'structure' || change.kind === 'init') p.value(plan);
    });
  }

  function typedHeadline() {
    var el = $('typed'), full = el.textContent;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.textContent = ''; var i = 0;
    var t = setInterval(function () { el.textContent = full.slice(0, ++i); if (i >= full.length) clearInterval(t); }, 45);
  }

  function init(theStore) {
    store = theStore;
    addPart(settings);
    bindSettings();
    store.subscribe(render);
    render({ kind: 'init', plan: store.getPlan(), notice: store.getNotice() });
    typedHeadline();
  }

  Budgeteer.ui = { init: init, addPart: addPart, esc: esc, fmtInput: fmtInput, $: $, getStore: function () { return store; } };
})();
