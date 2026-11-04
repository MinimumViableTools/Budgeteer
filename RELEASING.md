# Releasing

## Versions

Semantic Versioning, `MAJOR.MINOR.PATCH`, while the tool is below 1.0:

- Patch (0.2.1): fixes and small changes to how things look or read. Saved plans, links and files keep working.
- Minor (0.3.0): new features, or a change that makes older links or files unreadable (mark it as "Breaking" in the changelog).
- 1.0.0: when the tool is no longer a demo.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The release notes on GitHub are exactly the section of that version, so write them for someone who uses the tool.

- Sections of a version, in this order, and only those that have entries: `### Added` (new features), `### Changed` (changes to existing behaviour), `### Deprecated`, `### Removed`, `### Fixed` (bug fixes), `### Security`.
- One line per change, starting with what the person sees or can do now. A bug fix says what was wrong. Mark a change that breaks older plans, links or files with "Breaking:".
- Leave out refactoring, tests, build and documentation changes unless they matter to someone using the tool.
- Heading of a version: `## 0.2.1 - 2026-11-04`. New entries go under `## Unreleased` in the pull request that makes the change.

## Making a release

1. In a pull request: rename the entries under `## Unreleased` to the new version with today's date (keep an empty `## Unreleased` on top) and set the version in the footer of `docs/index.html` (`Budgeteer X.Y.Z`).
2. The owner merges the pull request.
3. On GitHub: Actions, Release, Run workflow, enter the version. The workflow runs the tests and checks that the version is new, that the footer and the changelog agree, that `Unreleased` is empty and that the sections use only the headings above. Then it creates the tag `vX.Y.Z` and the release, with the notes of the version and a link that compares it with the previous version.

GitHub Pages publishes every merge into `main` on its own. A release is only a named, fixed point in the history; it does not change the live page.
