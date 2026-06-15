---
id: TKT-034
title: Telegram reply gateway for Codex threads
state: building
owner: Kenji
assignee:
complexity: M
created: 2026-06-15
---

# TKT-034: Telegram Reply Gateway for Codex Threads

## Status

- state: `building`
- owner: Kenji
- assignee:
- dependencies: Codex app-server configured locally; Telegram bot token and chat id available locally
- location: `tickets/todo/TKT-034-telegram-reply-gateway.md`
- enter when: Telegram is used for outbound human requests but replies still require opening each Codex thread manually
- leave when: a reply to a Telegram notification is routed back into the originating Codex thread and visible in that thread
- blockers: manual Telegram smoke test needs live credentials and a coordinator thread id
- spawned follow-ups:
- complexity: `M`

## Implementation State

- Added `scripts/telegram-gateway.ts` with local state at `~/.farplane/telegram-gateway/state.json`.
- Added outbound `sendTelegramNotification()` support: sends Telegram, records `message_id -> threadId`, and appends bounded local history.
- Added inbound `npm run cli -- gateway telegram --once` support: polls Telegram `getUpdates`, routes direct replies to mapped Codex threads, and routes standalone owner messages to the configured Telegram coordinator thread.
- Added `ui/src/modules/user-communications` and wired the Office menu `User Comms` entrypoint to a Telegram-only configuration modal.
- Removed board-backed request/inbox behavior from User Communications. The panel now configures the main Codex thread and app-server URL only.
- Telegram gateway configuration is centralized in `~/.farplane/config.json`; Codex office visibility lives under `~/.farplane/office.json` as `codex`.

## Description

Build a local-first Telegram reply gateway so Farplane/Codex notifications become actionable from one Telegram chat. Outbound notifications should identify their originating Codex thread/session and persist a reply mapping; inbound Telegram replies should be routed back into the originating Codex thread through the existing Codex app-server message path.

Non-reply Telegram messages should not be guessed into a random thread. They should go to one configured Telegram coordinator Codex thread, with enough recent Telegram conversation and notification history for that agent to decide whether to answer, ask a clarifying question, or dispatch a follow-up to a source thread.

This is intentionally narrower than OpenClaw's full gateway. It does not need generic channel routing, customer routing, multi-tenant bot management, or a new agent runtime.

## Goal

Let Kenji reply directly to Telegram notifications from multiple Codex threads and have the reply continue the correct thread. Treat Telegram as a lightweight communications panel, not as a task board or project-management workflow.

For unthreaded Telegram chat, use a dedicated communications/coordinator Codex thread instead of the CEO thread. That coordinator can see Telegram-side history and the recent notification map, then decide what to do without polluting a durable leadership agent.

## Grounding

- Current `telegram-message` skill sends one outbound message to Kenji using `TELEGRAM_CHAT_ID` and token from env or Keychain, but it does not accept correlation metadata or return Telegram `message_id`.
- Current script surface is `/Users/kenjipcx/.codex/skills/telegram-message/scripts/send_message.py`.
- Codex app-server supports stored thread continuation by `thread/resume({ threadId })`; Farplane already wraps turn send as `CodexRuntimeAdapter.sendMessage()`, which reads the thread and either `turn/steer`s an active turn or `turn/start`s a new one.
- Telegram Bot API update payloads include `message.reply_to_message`; local long polling via `getUpdates` is enough for this MVP. A webhook can be added later if local polling becomes unreliable.
- TeleCodex uses a per-context model: a Telegram private chat or forum topic becomes a context key, and each context maps to a persisted Codex session/thread. It also allows `/attach <id>`, `/sessions`, and `/switch <id>` to bind or switch a context to a Codex thread. Farplane should adapt the split between context-level ambient chat and explicit thread binding, but add reply-to-message short-circuit routing because our current notification flow starts from many existing Codex threads.
- OpenClaw's relevant pattern is one independent session per channel thread plus event translation back to the channel. This ticket adapts only the mapping idea, not the full gateway.

## Decision

Use two routing modes:

1. Reply mode: persisted local mapping from Telegram outbound `message_id` to Codex routing metadata, used when Kenji replies directly to a bot notification.
2. Ambient mode: non-reply owner messages go to a configured Telegram coordinator Codex thread, along with recent Telegram history and notification map context.

## Options Considered

1. **Inline-only correlation footer**
   - Pros: simplest, easy to debug by eye.
   - Cons: fragile if the user edits/copies text, leaks raw ids into every message, awkward for multi-message notifications.

2. **Persisted `message_id -> threadId` mapping with a compact visible footer**
   - Pros: reliable for direct replies, inspectable locally, keeps the notification readable, works with one Telegram chat and many Codex threads.
   - Cons: requires a tiny local state file and pruning policy.

3. **Full OpenClaw channel gateway**
   - Pros: already matches multi-channel routing concepts.
   - Cons: larger than needed, reintroduces generic gateway/runtime scope the project has been avoiding for the Codex-first path.

Recommendation: option 2 for reply routing, plus a TeleCodex-style per-context coordinator for ambient chat. Accept the local state file tradeoff because it gives direct-reply reliability without dragging in a full channel gateway.

## Scope

- Update the Telegram notification primitive to accept optional metadata:
  - `threadId`
  - `sessionId`
  - `turnId`
  - `projectPath`
  - `sourceThreadTitle`
  - `requestKind`
- Capture and persist the Telegram `sendMessage` response `result.message_id`.
- Store mappings under a local private Farplane/Codex state path, not in repo history. Candidate path: `~/.farplane/telegram-gateway/mappings.jsonl`.
- Store Telegram conversation history, bounded and private. Candidate path: `~/.farplane/telegram-gateway/history.jsonl`.
- Add configuration for a `telegramCoordinatorThreadId` / `telegramCoordinatorSessionId`; non-reply owner messages route there by default.
- Add a local listener command or script that:
  - reads the same Telegram credentials as the existing skill
  - uses Telegram `getUpdates` with an offset cursor
  - ignores messages not from configured `TELEGRAM_CHAT_ID`
  - resolves replies through `message.reply_to_message.message_id`
  - sends reply messages to the mapped Codex `threadId`
  - sends non-reply owner messages to the configured Telegram coordinator thread with bounded recent Telegram history and recent notification mappings
  - records delivery attempts and errors in a local log
- Add a small dispatch protocol for the coordinator to route a later response to a source thread only when it explicitly chooses to do so. The first version can be conservative: coordinator answers in Telegram or asks Kenji to reply directly to the relevant notification.
- Reuse Farplane's existing Codex app-server bridge shape where possible instead of creating a separate Codex SDK abstraction.
- Add settings/UI design notes for a future communications panel tab:
  - enable/disable Telegram reply gateway
  - show listener health
  - choose default fallback target for non-reply Telegram messages
  - show last routed replies and failures

## Non-Goals

- Do not block or stall outbound notification turns waiting for a Telegram reply.
- Do not route arbitrary non-reply Telegram messages to source work threads. They go only to the configured Telegram coordinator thread unless Kenji replies to a mapped notification.
- Do not send replies to a CEO/chief-of-staff thread by default; that would pollute a durable agent context.
- Do not build generic Slack/Discord/Notion channel routing.
- Do not store Telegram bot tokens, private chat ids, or raw secret-bearing payloads in repo files.
- Do not make the task board a chat inbox. Human requests can create/reconcile board tasks later, but this ticket is direct thread reply routing.

## Acceptance Criteria

- [x] AC-1: Outbound Telegram notification messages can include thread/session metadata and persist a mapping from Telegram `message_id` to the originating Codex `threadId`.
- [x] AC-2: Telegram replies from the configured owner chat route back to the mapped Codex thread.
- [x] AC-3: If the target thread has an active turn, the bridge steers that turn; otherwise it starts a new turn, matching current Farplane Codex adapter behavior.
- [x] AC-4: Replies to unknown/expired Telegram messages produce a clear Telegram or local error instead of silently routing to the wrong thread.
- [x] AC-5: Non-reply messages from the owner route only to the configured Telegram coordinator Codex thread with bounded recent Telegram history and notification-map context.
- [x] AC-6: Local state is private, inspectable, and pruned or bounded.
- [ ] AC-7: The Telegram skill documentation explains the metadata/footer contract and missing-config fallback.
- [x] AC-8: A focused smoke test or dry-run proves message-id mapping, coordinator fallback routing, and Codex send routing without requiring real Telegram credentials in CI.

## Agent Contract

- Open: existing `telegram-message` skill, `ui/src/modules/runtime/lib/codex-app-server/client.ts`, `ui/src/modules/runtime/lib/adapters/codex-runtime-adapter.ts`, `ui/src/modules/runtime/README.md`, `tickets/README.md`.
- Test hook: mock Telegram `sendMessage`/`getUpdates` payloads, including `reply_to_message`, and mock Codex app-server RPC calls.
- Stabilize: prefer local JSONL state plus atomic append/update helpers; bound retries and polling.
- Inspect: local mapping/log files under `~/.farplane/telegram-gateway/`.
- Key screens/states: future Settings communications panel, but MVP may be CLI/script-only.
- Taste refs: settings copy should be terse and operational if UI is added.
- Expected artifacts: updated Telegram skill docs/script, local listener script/command, tests, ticket progress notes.
- Delegate with: a bounded implementation prompt that includes this ticket path and asks the implementer to keep the gateway Codex-only.

## Evidence Checklist

- [x] Unit test or dry-run: outbound send response persists `message_id -> threadId`.
- [x] Unit test or dry-run: inbound reply resolves `reply_to_message.message_id`.
- [x] Unit test or dry-run: unknown reply is rejected safely.
- [x] Unit test or dry-run: non-reply owner message is sent to the configured coordinator thread with bounded history context.
- [ ] Manual smoke notes: local listener can receive one Telegram reply and route it to a test Codex thread.
- [x] Documentation: how to run/stop the local listener and where state lives.

## Build Notes

Suggested implementation slices:

1. Extend `send_message.py` to return or optionally write Telegram API response metadata, including `message_id`.
2. Add a small gateway state module/script for mapping and cursor storage.
3. Add bounded Telegram history storage and a recent notification-map summarizer for coordinator prompts.
4. Add `listen_telegram_replies.py` or a repo-owned CLI command that long-polls `getUpdates` and routes replies/non-replies by mode.
5. Add Codex app-server RPC send support for script use. Prefer calling the local app-server bridge endpoint over inventing a second SDK layer.
6. Update the `telegram-message` skill instructions to require thread/session metadata whenever a message asks Kenji to answer an agent.
7. Add Settings/communications-panel design follow-up only after the script MVP works.

## Feasibility

High for an MVP. The hard parts are not the APIs; they are correlation discipline, safe fallback behavior, and keeping the listener local/private.

Risks:

- Telegram bots only receive messages sent to the bot chat, so Kenji must reply in the bot conversation to a bot-sent notification.
- Multiple local listeners for the same bot token can conflict if both consume `getUpdates`; run exactly one poller or move to webhook later.
- A Codex thread can be unavailable, archived, or in a failed state; the bridge must report that back instead of dropping the reply.
- If Telegram sends a reply without `reply_to_message`, the MVP should route only to the configured coordinator thread, not infer a source work thread.
- Coordinator routing can become confusing if it has too much or too little history. Keep the first version bounded: recent Telegram messages, recent outbound notification summaries, and explicit thread IDs.

## QA Reconciliation

- AC-1: `PASS` via `scripts/telegram-gateway.test.ts`
- AC-2: `PASS` via `scripts/telegram-gateway.test.ts`
- AC-3: `PASS` via `scripts/telegram-gateway.test.ts`
- Screen: `PASS` via focused user-communications and panel-registry tests
- Evidence item: `MANUAL_SMOKE_PENDING`

## Artifact Links

- OpenAI Codex app-server docs: https://developers.openai.com/codex/app-server
- Telegram Bot API docs: https://core.telegram.org/bots/api
- TeleCodex peer implementation: https://github.com/benedict2310/telecodex

## Required Evidence

- [x] Unit/integration/e2e tests pass, as applicable.
- [x] Typecheck passes if TypeScript surfaces change.
- [ ] Lint passes for changed repo code.
- [ ] Manual local Telegram smoke test documented when credentials are available.
