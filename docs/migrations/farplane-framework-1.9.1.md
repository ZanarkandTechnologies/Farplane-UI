---
title: Farplane Framework 1.9.1 Migration Receipt
owner: init-advisor
status: active
kind: migration-receipt
created_at: 2026-07-12
source_commit: 1d4ce4a17fbcab377d7d2e428002f44fb0f53c44
---

# Farplane Framework 1.9.1 Migration Receipt

## Setup Rationale

Farplane UI is a brownfield project. This migration preserves active dirty
work in Resource Bank, Telegram, ingest-content, user-communications,
`TASK-0037`, `tmp/`, and `ui/tmp/` while moving only project-owned Farplane
framework config and active config readers to the canonical 1.9.1 split-file
contract.

## Operating Model

- Mission: build and distribute the trusted local founder-control UI.
- Descriptive products:
  - accepted founder-control UI workflows/releases;
  - evidence-backed UI demos and content;
  - adoption/market learning that changes product or distribution decisions.
- Selected objective:
  - `accepted_ui_product_cycles`.
- Product metric refs:
  - `accepted_ui_workflows_releases`;
  - `evidence_distribution_reach`;
  - `decision_changing_adoption_briefs`.
- Source gap:
  - `qualified_install_interest_signal` is defined but unselected until an
    honest provider or manual ledger exists.

## Migration Delta

- Replaced retired Markdown config with `farplane/harness.yaml`,
  `farplane/metrics.yaml`, and `farplane/bindings.yaml`.
- Updated `farplane/manifest.json` to `spec_version = 1.9.1`.
- Rewrote `farplane/automations.toml` to template `1.0.0` with exactly one
  Work Pulse heartbeat and cron records for Daily BAU, Weekly BAU, and weekly
  Dogfood.
- Removed the retired bandit heartbeat reference and local script runner.
- Updated config reading so canonical YAML files parse as YAML.
- Created `TASK-0039` as the project-local capability refinement ticket for
  evidence-backed UI content composition.

## Approval Gates

Publishing, deploys, account mutations, spend, customer contact, destructive
cleanup, product-boundary changes, and protected charter changes remain
approval-gated.

## Proof To Record

- clean-HEAD retired-path scan;
- worktree retired-path scan;
- Farplane project validator;
- project snapshot;
- doctor;
- focused UI config/projection tests;
- root typecheck;
- Biome;
- exact one-heartbeat/live desired-state parity check.
