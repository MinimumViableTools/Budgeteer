# ADR 0003: Numbers are unrounded, rounding is for display only

Status: accepted
Date: 2026-11-04

## Context

Typing a per-quarter value in the quarter view divides it by 3 to get the monthly value, and a day rate times half days can produce fractions.

## Decision

All amounts are kept unrounded as numbers, and only the display rounds to whole euros in one fixed English format, for example €92,100. The format does not depend on the browser, so tests and demos are identical. Switching the view converts nothing (see ADR 0005). Tests compare totals with a tolerance of 1e-9.

## Consequences

Displayed values of single lines may not add up exactly to the displayed total. The summary can mention this when it happens. Totals never drift through repeated switches, because switching converts nothing.
