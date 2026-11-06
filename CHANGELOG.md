# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the versions follow [Semantic Versioning](https://semver.org/). How a release is made: `RELEASING.md`.

## Unreleased

## 0.3.0 - 2026-11-06

### Added

- An Export button on the open plan card opens an export menu with four formats: Link, JSON, Markdown and CSV. Each one can be copied, and JSON, Markdown and CSV can be downloaded as a file. A preview shows what the file holds.
- Markdown export: the whole plan as readable text with tables, to read or to hand to an AI assistant for reshaping. It is not opened again by Budgeteer.
- CSV export: one row per resource with plain numbers and "yes" or "no" for the max and stretch scenario, for a spreadsheet such as Google Sheets. It is not opened again by Budgeteer.
- An empty plan offers "Open the sample plan" in a hint under the tray.

### Changed

- Breaking: The page moved to a new address: https://minimumviabletools.github.io/Budgeteer/. The old address no longer works. A share link made at the old address does not open any more; to open it, replace the start of the link before the `#` with the new address.
- The button "Share plan" at the top is gone. Sharing a link, JSON and the new formats are in the export menu on the plan card.
- Opening a JSON file moved to an "Import JSON" tile in the tray, next to "New plan".
- The tray has no "Sample plan" tile any more. The sample plan is offered in the hint of an empty plan.
- On a phone the open card has two lines (the name, then Copy, Export and Close), so the tray is a little higher there.

## 0.2.1 - 2026-11-04

### Added

- The cards of the plan tray overlap when they do not fit next to each other, so up to 10 plans stay in one row. At least 104 px of every card stay visible, and the open card never overlaps.

### Changed

- The plan tray is one flat row. An arrow at its left shuts it to the title of the open plan (">") or opens the cards again ("<"). It needs about 83 px of height when open and 57 px when shut. The open card holds name, Copy and Close in one line.
- The axis of the cost chart shows the euro sign (€10k, €20k).
- On a phone the total bar at the bottom is lower: smaller figure, label and stamp.

## 0.2.0 - 2026-11-04

### Added

- Plans have a name. The tray under the headline holds up to 10 open plans as index cards: start a new plan with one click, copy the open plan, open, rename and close plans (with undo), and fold the tray. Imports and links open as new cards. The plans are kept in the tab, so a reload does not lose them.
- New cost mode FTE: cost per FTE and month times a share of one FTE (slider 0 to 300 percent, up to 1,000 percent by typing). A new internal staff resource starts as FTE at 100 percent.

### Changed

- Breaking: link and file format version 2. Links and JSON files made with 0.1.x are no longer read.
- The type "Internal dev" is now "Internal staff".
- A new resource is always on in stretch, and on in max when it was added while viewing max, so a plan built in max is complete in stretch.

### Fixed

- The "More settings" of a card could close when a select was changed right after opening it.

## 0.1.1 - 2026-11-04

### Added

- The first official logo: three bars on the dark tile, shown before the name in the header and used as the icon of the page. Master file as SVG in `docs/logo/`, with PNG versions at 1024, 512, 180 and 32 pixels.

### Changed

- The summary lists every milestone with a green "Reached" or red "Not reached" stamp as its bullet, not reached goals first.

## 0.1.0 - 2026-11-04

First complete version.

### Added

- Plan of up to 12 months or 4 quarters with up to 20 resources: rate times days, fixed per period and one-time costs.
- Max and stretch scenarios on one resource list, with a switch per resource and scenario.
- Cost chart by resource type, headroom bar against both budgets, marks where a budget is passed, status stamp, narrative summary and a sticky total bar.
- Up to 8 value-based milestones with importance, linked resources, markers on the chart and a status list for both scenarios.
- Quarter view that groups the months and converts nothing.
- Share as a link (compact, compressed when shorter, with a format version), export and import as JSON.
- Sample plan as a demo, empty plan on request.
- Dark theme only, works from disk, from GitHub Pages and in a static container, with vendored fonts and no runtime dependencies.
