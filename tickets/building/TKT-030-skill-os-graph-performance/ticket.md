---
id: TKT-030
title: Skill OS graph performance optimization
state: building
owner: Farplane UI
assignee: Codex
created_at: 2026-06-14
complexity: M
depends_on:
  - TKT-029
---

# TKT-030: Skill OS Graph Performance Optimization

## Status

- state: `review`
- owner: Farplane UI
- assignee: Codex
- dependencies: `TKT-029` graph-first Skill OS and Reagraph guarded renderer
- location: `tickets/building/TKT-030-skill-os-graph-performance`
- enter when: Skill OS has both D3/SVG fallback and guarded Reagraph wiring
- leave when: Skill OS avoids unnecessary graph recomputation / WebGL loading
  work, stays interactive, and has browser proof for fallback and overlay paths
- blockers: none known
- complexity: `M`

## Goal

Optimize Skill OS graph performance without changing the product model:

- Keep graph-first Skill OS.
- Use D3/SVG as the primary shipped renderer.
- Keep the Reagraph adapter as a disabled future seam without importing the
  Reagraph package.
- Avoid loading, mounting, or probing expensive WebGL/Reagraph work in normal
  Skill OS runtime.
- Avoid recomputing D3 force layout for UI-only toggles or search-only changes.
- Preserve sidebar selection, graph selection, panning/zooming, and skill detail
  overlay behavior.

## Non-Goals

- Do not remove the adapter seam.
- Do not redesign the Skill OS UI.
- Do not optimize unrelated office renderer WebGL issues.
- Do not introduce a worker unless main-thread proof shows it is needed.

## Performance Targets

- D3 force layout should rebuild only when the visible node set or graph payload
  changes, not when refs/chains are toggled.
- Reagraph should not be present in the shipped dependency tree for this slice.
- Headless QA should not import/mount Reagraph.
- Browser proof should show no visible blank graph state; D3/SVG must render a
  usable graph.

## Done / Proof

- [x] Code split: Skill OS graph renderer uses D3/SVG directly; the disabled
  Reagraph adapter seam imports no Reagraph package.
- [x] Layout memoization: force layout computation is decoupled from edge
  visibility toggles.
- [x] Guardrails: Skill OS no longer depends on WebGL/Reagraph in normal
  runtime.
- [x] Interaction: sidebar selection still opens detail overlay.
- [x] QA: screenshot and assertions for normal headless fallback.
- [x] QA: D3 primary assertion proves no Reagraph canvas, no renderer fallback
  badge, and a visible Skill OS graph.
- [x] Checks: focused Biome, focused typecheck filter, and registry/store tests
  pass.

## Files

- `ui/src/modules/skills-studio/components/skill-os/skill-os-mini-app.tsx`
- `ui/src/modules/skills-studio/components/skill-os/skill-graph-canvas.tsx`
- `ui/src/modules/skills-studio/components/skill-os/skill-graph-svg-canvas.tsx`
- `ui/src/modules/skills-studio/components/skill-os/skill-graph-layout.ts`
- `ui/vite.config.ts`
- `ui/package.json`
- `package.json`
- `package-lock.json`
