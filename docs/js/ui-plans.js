/* Budgeteer page: the tray of open plans. Cards for the plans of this session, a new plan with one click, a copy, closing with undo.
   This is the only file that uses the tab storage (sessionStorage), so the plans survive a reload and are gone when the tab is closed. */
(function () {
  'use strict';
  var core = Budgeteer.core, ui = Budgeteer.ui, $ = ui.$, esc = ui.esc;
  var KEY = 'budgeteer.session', PREF = 'budgeteer.tray', UNDO_MS = 8000;
  var store, stack, suppress = false, saveTimer = null, undoTimer = null, collapsed = false;

  function storage() { try { return window.sessionStorage; } catch (e) { return null; } }
  function read(key) { var s = storage(); try { return s ? s.getItem(key) : null; } catch (e) { return null; } }
  function write(key, value) { var s = storage(); try { if (s) s.setItem(key, value); } catch (e) { /* storage full or blocked: the plans stay in memory */ } }

  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; write(KEY, stack.serialize()); }, 200);
  }
  function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } write(KEY, stack.serialize()); }

  function meta(plan) {
    var t = core.scenarioTotals(plan, plan.scenario).total, n = core.periodCount(plan), u = core.unitName(plan.view);
    return n + ' ' + u + (n === 1 ? '' : 's') + ' · ' + core.formatEuro(t) + ' ' + plan.scenario;
  }

  function cardHtml(e, activeId, i) {
    var p = e.plan, active = e.id === activeId, name = esc(p.name);
    if (active) {
      return '<li class="plan-card active" data-plan="' + e.id + '" aria-current="true"><span class="pk-stamp plan-stamp" aria-hidden="true">Open</span>' +
        '<input class="plan-name" data-rename aria-label="Plan name" maxlength="' + core.LIMITS.planName + '" autocomplete="off" value="' + name + '">' +
        '<div class="plan-meta" data-meta>' + esc(meta(p)) + '</div>' +
        '<div class="plan-actions"><button type="button" class="pk-btn pk-btn--ghost" data-copy>Copy</button><button type="button" class="pk-btn pk-btn--ghost" data-close="' + e.id + '" aria-label="Close plan ' + name + '">Close</button></div></li>';
    }
    return '<li class="plan-card" data-plan="' + e.id + '"><button type="button" class="plan-open" data-open="' + e.id + '"><span class="plan-title">' + name + '</span><span class="plan-meta">' + esc(meta(p)) + '</span></button>' +
      '<button type="button" class="plan-x" data-close="' + e.id + '" aria-label="Close plan ' + name + '"><span aria-hidden="true">×</span></button></li>';
  }

  function renderAll() {
    var list = stack.list(), activeId = stack.activeId();
    $('trayCards').innerHTML = list.map(function (e, i) { return cardHtml(e, activeId, i); }).join('') +
      '<li class="plan-card plan-new"><button type="button" class="plan-add" data-new' + (stack.full() ? ' aria-disabled="true"' : '') + '>+ New plan</button></li>' +
      '<li class="plan-card plan-new plan-sample"><button type="button" class="plan-add" data-sample' + (stack.full() ? ' aria-disabled="true"' : '') + '>+ Sample plan</button></li>';
    renderBar();
  }
  function renderBar() {
    var a = stack.active();
    $('trayCount').textContent = ' (' + stack.count() + ')';
    $('trayNow').textContent = a ? a.plan.name + ' · ' + meta(a.plan) : '';
    $('demoBanner').hidden = !(a && a.sample);
  }
  function renderLight() {
    var a = stack.active(); if (!a) return;
    var card = document.querySelector('.plan-card.active'), m = card && card.querySelector('[data-meta]');
    if (m) m.textContent = meta(a.plan);
    renderBar();
  }

  function applyCollapsed(c, remember) {
    collapsed = c; $('tray').classList.toggle('collapsed', c); $('trayBody').hidden = c;
    $('trayToggle').setAttribute('aria-expanded', String(!c));
    if (remember) write(PREF, c ? '1' : '0');
  }

  /* showing a plan from the stack in the page */
  function show(message) {
    suppress = true; store.loadPlan(stack.active().plan, message || ''); suppress = false;
  }
  function addPlan(plan, message) {
    var r = stack.add(plan);
    if (!r.ok) { store.say(r.error); return false; }
    show(message); return true;
  }

  function focusName() { var a = document.querySelector('.plan-card.active [data-rename]'); if (a) a.focus(); }
  function showUndo(name) {
    $('undoText').textContent = 'Closed “' + name + '”. ';
    $('trayUndo').hidden = false;
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(hideUndo, UNDO_MS);
  }
  function hideUndo() { $('trayUndo').hidden = true; if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; } stack.forgetUndo(); }

  function bind() {
    var cards = $('trayCards');
    cards.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-new')) {
        if (stack.full()) { store.say(Budgeteer.stack.limitMessage()); return; }
        var r = stack.addEmpty(); if (r.ok) { show('Started an empty plan.'); focusName(); } return;
      }
      if (t.hasAttribute('data-copy')) {
        var c = stack.copy(); if (c.ok) { show('Copied the plan as “' + c.entry.plan.name + '”.'); focusName(); } else store.say(c.error); return;
      }
      if (t.hasAttribute('data-sample')) {
        if (stack.full()) { store.say(Budgeteer.stack.limitMessage()); return; }
        var sr = stack.add(Budgeteer.sample.samplePlan(), { sample: true }); if (sr.ok) { show('Added the sample plan.'); focusName(); } return;
      }
      if (t.hasAttribute('data-open')) {
        if (stack.open(+t.getAttribute('data-open'))) { show(''); var a = document.querySelector('.plan-card.active [data-rename]'); if (a) a.focus(); } return;
      }
      if (t.hasAttribute('data-close')) {
        var name = stack.get(+t.getAttribute('data-close')).plan.name, res = stack.close(+t.getAttribute('data-close'));
        if (res.ok) { if (res.activeChanged) show(''); showUndo(name); var nx = document.querySelector('.plan-card.active [data-rename]') || $('trayToggle'); nx.focus(); }
      }
    });
    cards.addEventListener('input', function (e) { if (e.target.hasAttribute('data-rename')) store.renamePlan(e.target.value); });
    cards.addEventListener('focusout', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-rename')) e.target.value = stack.active().plan.name; });
    cards.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.hasAttribute('data-rename')) { e.preventDefault(); e.target.blur(); } });
    $('trayToggle').addEventListener('click', function () { applyCollapsed(!collapsed, true); });
    $('undoBtn').addEventListener('click', function () {
      var r = stack.undoClose();
      if (r.ok) { $('trayUndo').hidden = true; if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; } show('Brought “' + r.entry.plan.name + '” back.'); var a = document.querySelector('.plan-card.active [data-rename]'); if (a) a.focus(); }
      else store.say(r.error);
    });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  }

  /* the page asks for the stack before it builds the store */
  function load() { var text = read(KEY); return text ? Budgeteer.stack.restore(text) : null; }
  function start(theStack) { stack = theStack; }

  ui.onReady(function (s) {
    store = s;
    applyCollapsed(read(PREF) === '1', false);
    renderAll(); bind();
    stack.subscribe(function (what) { if (what === 'plan') renderLight(); else renderAll(); persist(); });
    store.subscribe(function () { if (suppress) return; stack.updateActive(store.getPlan()); });
    persist();
  });

  Budgeteer.tray = { load: load, start: start, addPlan: addPlan, show: show };
})();
