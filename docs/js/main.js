/* Budgeteer start-up: reads the link, builds the store and starts the page. */
(function () {
  'use strict';
  var core = Budgeteer.core, codec = Budgeteer.codec, store = null;
  function banner(show) { var b = document.getElementById('demoBanner'); if (b) b.hidden = !show; }
  Budgeteer.main = { hideBanner: function () { banner(false); }, showBanner: function () { banner(true); } };

  function fragment() { return location.hash.replace(/^#/, ''); }

  /* what the page shows for the current address: a plan from the link, the sample plan, or an empty plan with a message */
  function fromAddress() {
    var frag = fragment();
    if (!frag) return Promise.resolve({ plan: Budgeteer.sample.samplePlan(), demo: true, notice: '' });
    return codec.decodePlanShort(frag).then(function (r) {
      if (r.ok) return { plan: r.plan, demo: false, notice: '' };
      return { plan: Budgeteer.share.emptyPlan(), demo: false, notice: r.message };
    });
  }

  fromAddress().then(function (start) {
    store = Budgeteer.state.createStore(start.plan, start.notice);
    banner(start.demo);
    Budgeteer.ui.init(store);
    /* a person who pastes another link into this page: load that plan. The page never writes the address itself. */
    window.addEventListener('hashchange', function () {
      fromAddress().then(function (next) {
        banner(next.demo);
        store.loadPlan(next.plan, next.notice || (next.demo ? '' : 'Opened the plan from the link.'));
      });
    });
  });
})();
