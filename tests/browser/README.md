# Browser checks

These scripts drive the real page in Chromium with Playwright and check the behaviour that the unit tests cannot: forms, charts, dialogs, links, keyboard use, contrast and the phone layout.

They are not part of `node --test` and not run in CI, because they need Playwright, which this repo does not depend on. To run them, install Playwright and its Chromium (`npm install -g playwright` and `npx playwright install chromium`, with the global modules on `NODE_PATH`), then:

    node tests/browser/run.js          # all checks
    node tests/browser/run.js 06       # one check, by its number

`run.js` serves `app/` on a local port. Screenshots go to the folder in `OUT`, or to the system temp folder.
