---
kind: project-harness
status: draft
project: Farplane UI
created_at: 2026-06-17
updated_at: 2026-06-17
framework_template_version: "0.1.0"
owner: harness
---

# Project Harness

```harness-program
project "Farplane UI" {
  values {
    mission: "Build a founder-control office for AI work with clear runtime visibility, ticket-backed execution, and humane operator oversight."
    operating_principles: [
      "Prefer visible project artifacts over transcript memory.",
      "Keep runtime state inspectable and adapter-backed.",
      "Prove UI changes with browser evidence before closeout."
    ]
    priorities: [
      trust.high,
      usefulness.high,
      speed.medium
    ]
    non_tradeoffs: [
      "Do not store secrets in tracked config.",
      "Do not hide automation state outside .farplane/ runtime ledgers."
    ]
  }

  modes: [project]

  system ticket_loop {
    status: ready
    evidence: ref("tickets/")
    action: use_existing("local ticket workflow")
  }

  heartbeat ticket_update {
    trigger: "compiled from farplane/automations.md settings.ticket_drainer"
    bindings: "farplane/bindings.md"
    first: daily_ticket_drainer
    output: ".farplane/reports/ticket-update/latest.md"
  }

  heartbeat weekly_pm_update {
    trigger: "compiled from farplane/automations.md settings.weekly_pm"
    bindings: "farplane/bindings.md"
    first: grouped_jobs
    jobs: [update_external_context, update_memory, skill_hardening, skill_refinement, registry_drift, update_strategy]
    output: ".farplane/reports/weekly-pm/latest.md"
  }
}
```

## Notes

Fill this with `harness-creator` when the project needs richer strategy,
feedback loops, missing-system tickets, or business/product operating goals.
