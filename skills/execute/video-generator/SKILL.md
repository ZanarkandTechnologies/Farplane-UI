---
name: video-generator
description: Produce short-form video assets for growth experiments and affiliate content loops.
---

# Video Generator

## Goal

Create a publish-ready short video from a task brief with clear CTA and tracking-ready link context.

## Inputs

- Task brief from kanban
- Topic, angle, CTA, and offer details
- Target platform constraints (duration, aspect ratio, text limits)

## Outputs

- Script draft
- Caption copy
- Output asset path or publishing-ready package
- Optional content metadata for later attribution

## Workflow

1. Convert task brief into a single hypothesis-driven content angle.
2. Generate a short script with hook -> value -> CTA.
3. Produce a video artifact using available tooling.
4. Return title/caption variants for PM selection or A/B testing.
5. Attach source metadata so distribution can attribute performance.

## Guardrails

- Keep claims factual and avoid unsupported guarantees.
- Include clear CTA language that maps to measurable links.
- If generation fails, return a retry plan with smallest next step.
