# TKT-019: Hardcase Data Inventory

## Status

- state: `todo`
- owner: Farplane UI
- assignee:
- dependencies: TKT-015, TKT-016
- location: `tickets/todo/TKT-019-hardcase-data-inventory.md`
- enter when: eval/QA/learning surfaces expose failures worth preserving
- leave when: hardcases render as a sellability filter over eval/QA data with export gates
- blockers: commercialization policy is intentionally unresolved
- spawned follow-ups:
- complexity: `M`

## Description

Start hardcases as a filtered eval/QA view for valuable data: eval failures, QA
misses, repeated troubles, and curated examples. The first version is an
inventory/readiness filter, not a public marketplace.

## Scope

- Directory: prefer `ui/src/modules/evals` hardcase filter first; split to
  `ui/src/modules/hardcases` only if the UI grows beyond eval/QA ownership.
- Global view: dataset inventory, value/readiness, redaction/provenance status.
- Team view: hardcases captured from that project/team's evals, QA, and memory.
- Source data: eval failures, QA artifacts, lessons/troubles, manual dataset files.

## UI Sketch

```text
Eval Lab: Hardcases Filter
+ Total Cases + Ready + Needs Redaction + Policy Blocked +
Filtered cases | Dataset detail | Provenance | Export gates
Team view: captured cases + suggested eval additions
```

## Agent Contract

- Open: Eval Lab filter first; optional global launcher only after standalone value is proven.
- Test hook: hardcase normalizer fixture.
- Stabilize: fixture cases with redaction/provenance states.
- Inspect: readiness badges, source links, export disabled state.
- Key screens/states: inventory, selected case detail, policy-blocked export.
- QA cookbook: `qa/README.md`.
- Taste refs: data-room UI, precise and trust-oriented.
- Expected artifacts: screenshot and normalizer test output.
- Delegate with: this ticket and FP01.

## Done / Proof

- [ ] Hardcase filter renders from fixture/local eval/QA sources.
- [ ] Redaction, provenance, consent, and export readiness are visible.
- [ ] Export/sell actions are disabled or placeholder-gated until policy exists.
- [ ] Team/project scoped hardcases render.
- [ ] Normalizer tests pass.
