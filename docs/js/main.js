/* Budgeteer start-up: takes the open plans from the tab storage, reads the link, builds the store and starts the page. */
(function () {
  'use strict';
  var codec = Budgeteer.codec, store = null, stack = null;

  function fragment() { return location.hash.replace(/^#/, ''); }
  function decode() { var frag = fragment(); return frag ? codec.decodePlanShort(frag) : Promise.resolve({ ok: false, code: 'empty', message: '' }); }

  decode().then(function (link) {
    var restored = Budgeteer.tray.load(), notice = '';
    stack = restored;
    if (link.ok) {
      /* a link opens as a new card. Someone who comes only for a link starts without the sample plan. */
      if (!stack) stack = Budgeteer.stack.createStack({ entries: [{ id: 1, plan: link.plan, sample: false }] });
      else { var r = stack.add(link.plan); if (!r.ok) notice = r.error; }
    } else if (link.code !== 'empty') notice = link.message;
    if (!stack) stack = Budgeteer.stack.createStack({ entries: [{ id: 1, plan: Budgeteer.sample.samplePlan(), sample: true }] });
    Budgeteer.tray.start(stack);
    store = Budgeteer.state.createStore(stack.active().plan, notice);
    Budgeteer.ui.init(store);

    /* a person who pastes another link into this page: it opens as a new card. The page never writes the address itself. */
    window.addEventListener('hashchange', function () {
      decode().then(function (next) {
        if (next.ok) Budgeteer.tray.addPlan(next.plan, 'Opened the plan from the link as a new card in the tray.');
        else if (next.code !== 'empty') store.say(next.message);
      });
    });
  });
})();
