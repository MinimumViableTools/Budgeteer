# Budgeteer

Agent context for this repository. Read this first.

- Spec: `SPEC.md` is the source of truth. If code and spec disagree, ask, and change the spec first.
- Plan: `PLAN.md` lists the steps. Work in small steps against the acceptance criteria.
- Decisions: the decision records (ADRs) are kept outside this repo, in `NLSPLGRND/workbench` under `specs/budget-planner/adr/`. Read them there when that repo is attached, and add a new ADR there for a significant choice. Do not add an `adr/` folder here.
- Stack: plain HTML, CSS and JavaScript, no build step, no runtime dependencies. The app lives in `docs/`, which GitHub Pages serves. Add a framework or tool only if it is needed or reduces complexity.
- Local use must work by opening `docs/index.html`. Avoid ES modules and runtime fetching of local files.
- The tool uses the Ink theme of the Pocketknife design language only. Colours come from the shared tokens as CSS variables.
- `core.js` and `codec.js` are pure functions with no access to the page, and are tested with `node --test`.
- Plan: the steps in `PLAN.md` are the order of work.
- Do not commit credentials or confidential content. Demo data is invented.
- Work on a feature branch and open a pull request for every change. Nono merges; Claude never merges. Commits are authored as Nono (GitHub noreply address) and keep the `Co-Authored-By` trailer for Claude.
- Ask clarifying questions before making assumptions. Do not use horizontal rules in documents.
