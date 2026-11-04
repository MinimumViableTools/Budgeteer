/* Budgeteer stack: the plans that are open in this session, which one is shown, and closing with undo. No access to the page.
   The page puts the stack into the tab storage and takes it out again, the stack itself only produces and reads text. */
(function (root, factory) {
  var api = factory(typeof require === 'function' && typeof module !== 'undefined' ? require('./core.js') : root.Budgeteer.core,
    typeof require === 'function' && typeof module !== 'undefined' ? require('./codec.js') : root.Budgeteer.codec);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.stack = api; }
})(typeof self !== 'undefined' ? self : this, function (core, codec) {
  'use strict';

  var STORAGE_VERSION = 1;
  function clone(plan) { return JSON.parse(JSON.stringify(plan)); }
  function limitMessage() { return 'The tray holds at most ' + core.LIMITS.plans + ' plans. Close one first.'; }

  /* options: { entries: [{ id, plan, sample }], activeId, nextId }. At least one plan is always open. */
  function createStack(options) {
    var o = options || {}, entries = (o.entries || []).map(function (e) { return { id: e.id, plan: e.plan, sample: !!e.sample }; });
    var nextId = o.nextId || 1, activeId = o.activeId, lastClosed = null, listeners = [];
    entries.forEach(function (e) { if (e.id >= nextId) nextId = e.id + 1; });
    function emit(what) { listeners.slice().forEach(function (fn) { fn(what); }); }
    function indexOf(id) { for (var i = 0; i < entries.length; i++) if (entries[i].id === id) return i; return -1; }
    function emptyPlan() { return core.newPlan('month', 6, 'New plan'); }
    if (!entries.length) entries.push({ id: nextId++, plan: emptyPlan(), sample: false });
    if (indexOf(activeId) < 0) activeId = entries[0].id;

    var stack = {
      list: function () { return entries.slice(); },
      count: function () { return entries.length; },
      full: function () { return entries.length >= core.LIMITS.plans; },
      activeId: function () { return activeId; },
      active: function () { return entries[indexOf(activeId)]; },
      get: function (id) { return entries[indexOf(id)] || null; },
      subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; },
      canUndo: function () { return !!lastClosed; },
      lastClosedName: function () { return lastClosed ? lastClosed.entry.plan.name : ''; },

      /* a plan that comes from a link or a file, or the sample: a new card that is opened */
      add: function (plan, extra) {
        if (entries.length >= core.LIMITS.plans) return { ok: false, error: limitMessage() };
        var e = { id: nextId++, plan: plan, sample: !!(extra && extra.sample) };
        entries.push(e); activeId = e.id; emit('list'); return { ok: true, entry: e };
      },
      addEmpty: function () { return stack.add(emptyPlan()); },
      /* a copy of a plan, named "Copy of ...", placed right after the original */
      copy: function (id) {
        var src = stack.get(id === undefined ? activeId : id);
        if (!src) return { ok: false, error: 'That plan is not open any more.' };
        if (entries.length >= core.LIMITS.plans) return { ok: false, error: limitMessage() };
        var plan = clone(src.plan), room = core.LIMITS.planName - 'Copy of '.length;
        plan.name = core.cleanName('Copy of ' + core.cleanName(src.plan.name).slice(0, room));
        var e = { id: nextId++, plan: plan, sample: false };
        entries.splice(indexOf(src.id) + 1, 0, e); activeId = e.id; emit('list'); return { ok: true, entry: e };
      },
      open: function (id) {
        if (indexOf(id) < 0 || id === activeId) return false;
        activeId = id; emit('active'); return true;
      },
      /* the page keeps the shown plan current, so the card shows its name and its total */
      updateActive: function (plan) {
        var e = stack.active(); if (!e || e.plan === plan) return;
        if (e.sample && plan.name !== e.plan.name) e.sample = false;
        e.plan = plan; emit('plan');
      },
      /* closes a plan and remembers it for undo. The last plan is replaced by an empty one. */
      close: function (id) {
        var i = indexOf(id); if (i < 0) return { ok: false };
        var entry = entries[i], wasActive = entry.id === activeId;
        entries.splice(i, 1);
        var replacement = null;
        if (!entries.length) { replacement = { id: nextId++, plan: emptyPlan(), sample: false }; entries.push(replacement); }
        if (wasActive) activeId = entries[Math.min(i, entries.length - 1)].id;
        lastClosed = { entry: entry, index: i, wasActive: wasActive };
        emit('list'); return { ok: true, entry: entry, wasActive: wasActive, activeChanged: wasActive };
      },
      undoClose: function () {
        if (!lastClosed) return { ok: false };
        var l = lastClosed; lastClosed = null;
        if (entries.length >= core.LIMITS.plans) { lastClosed = l; return { ok: false, error: limitMessage() }; }
        entries.splice(Math.min(l.index, entries.length), 0, l.entry);
        activeId = l.entry.id; emit('list'); return { ok: true, entry: l.entry };
      },
      forgetUndo: function () { lastClosed = null; },

      /* text for the tab storage */
      serialize: function () {
        return JSON.stringify({ v: STORAGE_VERSION, nextId: nextId, activeId: activeId,
          entries: entries.map(function (e) { return { id: e.id, sample: e.sample, plan: codec.normalizePlan(e.plan) }; }) });
      }
    };
    return stack;
  }

  /* reads the text from the tab storage; anything that is not valid gives null, and nothing is half taken over */
  function restore(text) {
    if (typeof text !== 'string' || text.length > 2000000) return null;
    var d; try { d = JSON.parse(text); } catch (e) { return null; }
    if (!d || d.v !== STORAGE_VERSION || !Array.isArray(d.entries) || !d.entries.length || d.entries.length > core.LIMITS.plans) return null;
    var seen = {}, entries = [], i, e, r;
    for (i = 0; i < d.entries.length; i++) {
      e = d.entries[i];
      if (!e || typeof e.id !== 'number' || e.id < 1 || Math.floor(e.id) !== e.id || seen[e.id]) return null;
      r = codec.validatePlan(e.plan); if (!r.ok) return null;
      seen[e.id] = true; entries.push({ id: e.id, plan: r.plan, sample: e.sample === true });
    }
    return createStack({ entries: entries, activeId: d.activeId, nextId: typeof d.nextId === 'number' ? d.nextId : undefined });
  }

  return { createStack: createStack, restore: restore, limitMessage: limitMessage, STORAGE_VERSION: STORAGE_VERSION };
});
