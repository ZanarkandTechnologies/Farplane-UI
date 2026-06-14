# Harness OS Module

- Harness OS is the repo-wide Farplane map: skills, docs, specs, templates,
  agents, scripts, review rubrics, and feature registry rows.
- Keep Skill OS behavior in `modules/skills-studio`; Harness OS may reuse shared
  graph workbench primitives but should not make Skill OS a sub-tab.
- Prefer read-only graph and registry views until a ticket explicitly owns
  writer behavior.
- Graph data should come from generated Farplane artifacts under
  `/codex/skill-maintenance-graph/*`; do not mine git or the filesystem in the
  browser.
