#!/usr/bin/env bash
# Checks a release and prints its notes. Used by the Release workflow and by the tests.
# Usage: release-notes.sh VERSION [PREVIOUS_TAG]
# Reads CHANGELOG.md and the footer of docs/index.html (override with CHANGELOG and PAGE). The notes go to stdout, problems to stderr with exit code 1.
set -euo pipefail
VERSION="${1:-}"; PREV="${2:-}"
LOG="${CHANGELOG:-CHANGELOG.md}"; PAGE="${PAGE:-docs/index.html}"; REPO="${GITHUB_REPOSITORY:-MinimumViableTools/Budgeteer}"
fail() { echo "$1" >&2; exit 1; }

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "The version must look like 0.1.0"
grep -qF "Budgeteer $VERSION</span>" "$PAGE" || fail "$PAGE does not show version $VERSION in the footer"
if [ -n "$PREV" ]; then
  PV="${PREV#v}"
  { [ "$PV" != "$VERSION" ] && [ "$(printf '%s\n%s\n' "$PV" "$VERSION" | sort -V | tail -n1)" = "$VERSION" ]; } || fail "Version $VERSION is not newer than $PV"
fi

unreleased="$(awk '/^## /{p=($2=="Unreleased"); next} p && NF' "$LOG")"
[ -z "$unreleased" ] || fail "$LOG still has entries under Unreleased. Move them into the section of $VERSION."
grep -qE "^## ${VERSION//./\\.} - [0-9]{4}-[0-9]{2}-[0-9]{2}$" "$LOG" || fail "$LOG has no heading like '## $VERSION - 2026-01-31'"
body="$(awk -v v="$VERSION" '/^## /{p=($2==v); next} p' "$LOG")"
[ -n "$(printf '%s' "$body" | tr -d '[:space:]')" ] || fail "$LOG has no entries for $VERSION"

headings="$(printf '%s\n' "$body" | grep -E '^#{1,6} ' || true)"
[ -n "$headings" ] || fail "The section of $VERSION has no '### Added', '### Changed' or '### Fixed' heading"
bad="$(printf '%s\n' "$headings" | grep -vxE '### (Added|Changed|Deprecated|Removed|Fixed|Security)' || true)"
[ -z "$bad" ] || fail "Only Added, Changed, Deprecated, Removed, Fixed and Security are allowed as headings in $VERSION, found: $bad"

printf '%s\n' "$body" | sed '/./,$!d'
if [ -n "$PREV" ]; then printf '\n**Full changelog**: https://github.com/%s/compare/%s...v%s\n' "$REPO" "$PREV" "$VERSION"; fi
