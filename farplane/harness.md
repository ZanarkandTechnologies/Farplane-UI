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

  heartbeat founder_heartbeat {
    trigger: "compiled from farplane/automations.md settings.founder_heartbeat"
    bindings: "farplane/bindings.md"
    first: founder_heartbeat
    output: ".farplane/automation/decisions.jsonl"
  }
}
```

## Notes

Fill this with `harness-creator` when the project needs richer strategy,
feedback loops, missing-system tickets, or business/product operating goals.
