# Changelog

## Unreleased

- The axis of the cost chart shows the euro sign (€10k, €20k).
- On a phone the total bar at the bottom is lower: smaller figure, label and stamp.

## 0.2.0

- Plans have a name. The tray under the headline holds up to 10 open plans as index cards: start a new plan with one click, copy the open plan, open, rename and close plans (with undo), and fold the tray. Imports and links open as new cards. The plans are kept in the tab, so a reload does not lose them.
- Fixed: the "More settings" of a card could close when a select was changed right after opening it.
- New cost mode FTE: cost per FTE and month times a share of one FTE (slider 0 to 300 percent, up to 1,000 percent by typing). A new internal staff resource starts as FTE at 100 percent.
- The type "Internal dev" is now "Internal staff".
- A new resource is always on in stretch, and on in max when it was added while viewing max, so a plan built in max is complete in stretch.
- Link and file format version 2. Links and JSON files made with 0.1.x are no longer read.

## 0.1.1

- The summary lists every milestone with a green "Reached" or red "Not reached" stamp as its bullet, not reached goals first.
- The first official logo: three bars on the dark tile, shown before the name in the header and used as the icon of the page. Master file as SVG in `docs/logo/`, with PNG versions at 1024, 512, 180 and 32 pixels.

## 0.1.0

First complete version.

- Plan of up to 12 months or 4 quarters with up to 20 resources: rate times days, fixed per period and one-time costs.
- Max and stretch scenarios on one resource list, with a switch per resource and scenario.
- Cost chart by resource type, headroom bar against both budgets, marks where a budget is passed, status stamp, narrative summary and a sticky total bar.
- Up to 8 value-based milestones with importance, linked resources, markers on the chart and a status list for both scenarios.
- Quarter view that groups the months and converts nothing.
- Share as a link (compact, compressed when shorter, with a format version), export and import as JSON.
- Sample plan as a demo, empty plan on request.
- Dark theme only, works from disk, from GitHub Pages and in a static container, with vendored fonts and no runtime dependencies.
