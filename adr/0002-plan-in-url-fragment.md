# ADR 0002: Plan state in the URL fragment

Status: accepted, size to be confirmed by the spike in plan step 3
Date: 2026-11-04

## Context

The plan must be shareable without a server and without accounts. The part of a URL after `#` is never sent to a server, so it fits a static page. Some apps cut long links.

## Decision

The plan is encoded as compact JSON in base64url in the fragment. A plan holds at most 20 resources and 12 months. If the spike shows that the link is too long, add compression, and decide then whether a built-in browser compression API is acceptable on all targets. JSON export and import is the fallback when a link cannot carry a plan.

## Consequences

Because the Pages site is meant to become the hosted tool, every link carries a plan format version and later releases must keep reading older versions. A newer version than the tool knows is refused with a clear message.

No backend, and nothing stored anywhere. Links change whenever the plan changes. Very large plans need the JSON fallback.
