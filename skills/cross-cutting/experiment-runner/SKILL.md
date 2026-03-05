---
name: experiment-runner
description: Run hypothesis-driven experiments and persist outcomes for autonomous business optimization.
---

# Experiment Runner

## Goal

Operationalize the loop: hypothesis -> execution -> measurement -> decision.

## Inputs

- hypothesis statement
- project id
- planned action
- success metric and time window

## Outputs

- Experiment record (`experiments[]`)
- Before/after metrics snapshot
- Recommendation: continue, iterate, or stop

## Workflow

1. Create experiment record with `running` status.
2. Execute planned action via capability skills.
3. Collect metrics for defined window.
4. Update experiment status and attach results.
5. Suggest next decision for PM agent.

## Guardrails

- Every experiment must have a measurable success metric.
- Mark failed experiments explicitly with reason.
- Do not run conflicting experiments on identical audience slices at the same time.
