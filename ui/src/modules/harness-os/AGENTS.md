# Harness OS Module

- Harness OS is the repo-wide Farplane harness control surface: skills, docs,
  specs, templates, agents, scripts, review rubrics, feature registry rows, and
  project framework adoption.
- Keep Skill OS behavior in `modules/skills-studio`; Harness OS may reuse shared
  graph workbench primitives but should not make Skill OS a sub-tab.
- Keep Harness OS organized by object: Map, Features, Templates, and Projects.
  Skill rollout, template debt, heat, and lifecycle-proximity ranking belong in
  Skill OS.
- Map should render the generated `farplane-framework-core` projection. The
  projection is seeded by `farplane/manifest.json` include/exclude patterns;
  do not recreate Framework Core with UI-side keyword filters.
- Prefer read-only graph and registry views until a ticket explicitly owns
  writer behavior.
- Graph data should come from generated Farplane artifacts under
  `/codex/skill-maintenance-graph/*`; do not mine git or the filesystem in the
  browser.
