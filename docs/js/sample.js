/* Budgeteer sample plan: invented data for the demo and for tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Budgeteer = root.Budgeteer || {}; root.Budgeteer.sample = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function samplePlan() {
    return {
      version: 1, view: 'month', length: 6, scenario: 'stretch', budgets: { max: 95000, stretch: 125000 },
      resources: [
        { id: 1, name: 'Core team', type: 'internalStaff', mode: 'rateDays', rate: 1200, days: 10, from: 1, to: null, on: { max: true, stretch: true } },
        { id: 2, name: 'Freelance designer', type: 'freelancer', mode: 'rateDays', rate: 650, days: 4, from: 1, to: null, on: { max: true, stretch: true } },
        { id: 3, name: 'Analytics tool', type: 'subscription', mode: 'fixed', amount: 450, from: 1, to: null, on: { max: true, stretch: true } },
        { id: 4, name: 'Hosting', type: 'infrastructure', mode: 'fixed', amount: 300, from: 1, to: null, on: { max: true, stretch: true } },
        { id: 5, name: 'Security audit', type: 'oneTime', mode: 'oneTime', amount: 8000, due: 5, on: { max: false, stretch: true } },
        { id: 6, name: 'Extra freelancer', type: 'freelancer', mode: 'rateDays', rate: 600, days: 8, from: 3, to: 6, on: { max: false, stretch: true } }
      ],
      milestones: [
        { id: 1, name: 'Prototype ready', value: 'Stakeholders can click through the core flow and give feedback.', due: 2, linked: [1, 2], importance: 'must' },
        { id: 2, name: 'Security audit passed', value: 'We can onboard customers with sensitive data.', due: 5, linked: [5], importance: 'nice' },
        { id: 3, name: 'Public beta', value: 'First external users can sign up and use the product.', due: 6, linked: [1, 6], importance: 'must' }
      ]
    };
  }
  return { samplePlan: samplePlan };
});
