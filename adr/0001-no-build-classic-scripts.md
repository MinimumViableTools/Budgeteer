# ADR 0001: No build step, classic scripts, no libraries

Status: accepted
Date: 2026-11-04

## Context

The tool must work by opening `docs/index.html` from disk, from GitHub Pages and in a static container, with no maintenance. Browsers block ES modules and `fetch()` of local files when a page is opened from disk. The charts are simple: stacked bars and one total bar.

## Decision

Plain HTML, CSS and JavaScript. Classic scripts loaded in order, one shared namespace object, no bundler, no `npm install` to run anything. Charts are drawn in HTML and SVG by our own code. Pure logic files end with an export line so Node can test them.

## Consequences

Works from disk without a server and without a network. Nothing to update or break over time. Axis scaling, label placement and accessibility of the charts are our own work.
