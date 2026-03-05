---
name: tiktok-poster
description: Publish short-form content to TikTok with campaign metadata and link attribution context.
---

# TikTok Poster

## Goal

Distribute a prepared short-form asset to TikTok and record campaign metadata for measurement.

## Inputs

- Video asset path
- Caption, hashtags, CTA link
- Campaign and experiment identifiers (if present)

## Outputs

- Publish result (success/failure)
- Platform URL or post id
- Distribution metadata for project tracking

## Workflow

1. Validate asset format for TikTok constraints.
2. Publish with caption + CTA + tracking link.
3. Capture returned post URL/id and store it in task or asset notes.
4. Emit distribution completion summary for PM agent.

## Guardrails

- Never post the same asset twice unless task explicitly requests reposting.
- Always include the tracking link when provided.
- On failure, capture the exact error and classify as retryable or non-retryable.
