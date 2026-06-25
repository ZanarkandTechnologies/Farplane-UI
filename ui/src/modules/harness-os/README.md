# Harness OS

Harness OS is the global Farplane harness control surface. It renders the
manifest-backed Framework Core graph, feature registry, template registry, and
project framework adoption signals as an operator-facing read-only mini app.

Skill OS remains the focused skill-only graph. Harness OS is wider: skills,
docs, specs, framework files, features, templates, and harness standard
adoption.

## Top-Level Objects

- `Map`: generated Framework Core projection from `farplane/manifest.json`
  `farplane_graph.framework_core`. Source docs are matched by include/exclude
  patterns, workflow nodes form the lifecycle spine, direct framework file/spec
  refs are retained, ordered workflow skills are connected, and hot skills carry
  heat weight from Farplane skill events. The UI defaults to the lifecycle
  workflow root with a depth lens, while `All` remains available for full graph
  audit.
- `Features`: capability registry with status, evidence, surfaces, and optional
  spec refs.
- `Templates`: structural-parameter registry backed by
  `docs/templates/registry.jsonl`.
- `Projects`: active-project framework rollout from project manifests and
  template pins.

Skill template rollout, skill health, and skill feature coverage belong in
Skill OS, not Harness OS.

## Templates Contract

Templates are registry-backed. Farplane-UI should prefer the framework
registry at `docs/templates/registry.jsonl`, generated from
`rules/template-registry.toml`, and use UI-local template family rows only as an
explicit fallback.

Templates should stay physically near the surface that owns, edits, and tests
them:

- global install contracts live under the framework `templates/global/` area
  and may be materialized into `~/.codex`;
- skill standards live with skill-maintenance or skill docs;
- ticket and Goal packet contracts live with ticket/goal-loop surfaces;
- project scaffold templates live with the skill or command that renders them.

The Templates UI is the one-place catalog. Files do not need to move into one
directory to be manageable. Rows should expose `installTarget`, `historyPolicy`,
`consumerScope`, and `registryPath` so the operator can tell which templates are
runtime-installed, project-scaffolded, skill-packaged, or source-only.
