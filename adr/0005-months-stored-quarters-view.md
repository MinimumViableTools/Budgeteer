# ADR 0005: Months are the only stored unit, quarters are a view

Status: accepted
Date: 2026-11-04

## Context

The planning unit can be months or quarters, and totals must stay unchanged when it is switched. Amounts convert by the factor 3, but periods do not: a resource starting in month 2, a one-time cost in month 5 or a milestone due in month 5 do not fall on quarter boundaries, so converting the data loses precision and a round trip is not exact. Weeks were removed earlier, because 52 weeks do not divide into 12 months.

## Decision

Everything is stored in months: plan length, starts, ends, due months, milestone due months, and per-month values. The quarter view groups months into quarters for display only. Switching the view converts nothing. The quarter view is available when the plan length is a multiple of 3 months. Editing in the quarter view writes back to months with the rules in the spec.

## Consequences

Totals and milestone statuses are identical in both views, and a round trip is exact by construction. The quarter view needs display and editing rules, and fine-grained values can only be set precisely in the month view. The shareable link stores months and the chosen view.
