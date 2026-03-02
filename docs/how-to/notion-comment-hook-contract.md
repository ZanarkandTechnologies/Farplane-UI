# Notion Comment Hook Contract

This document defines the payload mapping contract for Notion comment webhooks into OpenClaw hook actions.

## Goal

- Keep inbound automation on OpenClaw-native hooks.
- Keep ShellCorp app canonical for workflow orchestration.
- Trigger agent runs from Notion comments only when intent is explicit (wake-word).

## Endpoint Contract

- Inbound endpoint: `POST /hooks/notion`
- Auth header: `Authorization: Bearer <hooks.token>` or `x-openclaw-token: <hooks.token>`
- Mapping source: `hooks.mappings[]` entry with `match.path = "notion"`

## Phase A Payload Capture Contract

Use `tools/notion-webhook-probe/server.py` to gather live payload evidence before finalizing transform logic.

Minimum captures expected:

1. Verification challenge body with `verification_token`
2. `comment.created` with wake-word
3. `comment.created` without wake-word
4. Non-comment event payload (for skip verification)

Saved evidence path:

- `tools/notion-webhook-probe/payloads/*.json`

## Expected Notion Fields (normalized)

The transform reads from these field paths when present:

- `type` -> event type (expect `comment.created`)
- `entity.id` -> comment id (preferred)
- `id` -> event id fallback
- `data.page_id` -> Notion page id
- `authors[]` -> author metadata, skip if any author is bot-typed

Comment text extraction order:

1. `data.comment.rich_text[].plain_text`
2. `data.rich_text[].plain_text`
3. `comment.rich_text[].plain_text`
4. Optional live lookup via Notion API using `entity.id` + `NOTION_API_KEY` env var

## OpenClaw Hook Action Mapping

For accepted comments, transform returns an `agent` action:

- `kind`: `agent`
- `message`: extracted comment text
- `name`: `Notion`
- `agentId`: `main` (override allowed in config mapping)
- `sessionKey`: `hook:notion:page:<pageId>:comment:<commentId>`
- `wakeMode`: `now`
- `deliver`: `true`
- `channel`: `last`

For verification challenge:

- return `wake` action with token echoed into text for operator visibility.

For skipped events:

- return `null`

## OpenClaw Config Snippet

```json
{
  "hooks": {
    "enabled": true,
    "token": "replace_with_dedicated_hook_secret",
    "path": "/hooks",
    "defaultSessionKey": "hook:notion:ingress",
    "allowRequestSessionKey": false,
    "allowedSessionKeyPrefixes": ["hook:notion:"],
    "allowedAgentIds": ["main", "hooks"],
    "transformsDir": "~/.openclaw/hooks/transforms",
    "mappings": [
      {
        "id": "notion-comments",
        "match": { "path": "notion" },
        "action": "agent",
        "name": "Notion",
        "agentId": "main",
        "wakeMode": "now",
        "deliver": true,
        "channel": "last",
        "transform": { "module": "notion.ts" }
      }
    ]
  }
}
```

## Verification and Test Commands

Local verification challenge simulation:

```bash
curl -X POST http://127.0.0.1:8321/hooks/notion \
  -H "content-type: application/json" \
  -d '{"verification_token":"secret_example"}'
```

Mapped endpoint simulation (OpenClaw):

```bash
curl -X POST http://127.0.0.1:18789/hooks/notion \
  -H "Authorization: Bearer <hooks.token>" \
  -H "content-type: application/json" \
  -d '{"type":"comment.created","entity":{"id":"comment123"},"data":{"page_id":"page123","comment":{"rich_text":[{"plain_text":"@shell summarize this"}]}},"authors":[{"type":"person"}]}'
```

## Troubleshooting

- `401 unauthorized`: wrong/missing hook token
- `400 invalid payload`: malformed JSON body
- `202` but no useful output: transform returned empty message or non-matching event
- no run triggered: missing wake-word or bot-authored comment skipped
