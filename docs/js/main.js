/* Budgeteer start-up: builds the store and starts the page. */
(function () {
  'use strict';
  var store = Budgeteer.state.createStore(Budgeteer.sample.samplePlan());
  Budgeteer.ui.init(store);
})();
