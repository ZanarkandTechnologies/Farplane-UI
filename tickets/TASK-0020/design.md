---
ticket_id: TASK-0020
title: Thread Data Backfill UI Design
status: draft
created_at: 2026-06-28
updated_at: 2026-06-28
---

# TASK-0020 Design: Thread Data Backfill UI

## Functional Model

Build a `Thread Data` workbench with tabs for thread browsing, thread forking,
program CRUD, backfill job creation, run progress, and output review.

```text
Thread Data
  Threads
  Forking
  Programs
  Backfill
  Runs
  Outputs
```

The feature should feel eval-like in its run/result browsing, but it is not an
eval engine. It is a program runner over historical chat/session data. Programs
produce flexible file outputs under `.farplane/backfill/jobs/<jobId>/`, and the
UI indexes those outputs for browsing, verdicts, retry, and promotion actions.

## Primary Layout

```text
+------------------------------------------------------------------------------+
| Thread Data                                      [Search threads...] [Refresh]|
+------------------------------------------------------------------------------+
| Threads | Forking | Programs | Backfill | Runs | Outputs                     |
+------------------------------------------------------------------------------+
|                                                                              |
|  Active tab content                                                          |
|                                                                              |
+------------------------------------------------------------------------------+
```

## Threads Tab

```text
+-- Thread Data / Threads -----------------------------------------------------+
| Filters                                                                      |
| [Last 7 days v] [Project: Farplane-UI v] [Ticket: any v] [Status: any v]     |
| [Search title/session/message...]                         [Select all shown] |
+------------------------------------------------------------------------------+
| [ ] Session ID        Title                         Ticket      Updated Turns|
| [ ] 019f075a...       Rescope decision telemetry    TASK-0019   Jun 27    12|
| [ ] 019f03fc...       Private trajectory mining     none        Jun 26     4|
| [ ] 019effea...       Taste loop artifacts          TASK-00xx   Jun 26    36|
+------------------------------------------------------------------------------+
| 3 selected                                    [Fork selected] [Mine selected]|
+------------------------------------------------------------------------------+
```

## Thread Detail Drawer

```text
+-- Thread Detail: 019f075a... -------------------------------+
| Title: Rescope decision telemetry                           |
| Project: Farplane-UI     Ticket: TASK-0019                  |
| Turns: 12              Last updated: Jun 27                  |
+--------------------------------------------------------------+
| [Open transcript] [Fork] [Mine this thread] [Copy session id]|
+--------------------------------------------------------------+
| Recent outputs                                               |
| - decision-v1 / run-20260628-001 / output.md                 |
| - trajectory-v1 / run-20260628-002 / output.md               |
+--------------------------------------------------------------+
```

## Programs Tab

```text
+-- Thread Data / Programs ----------------------------------------------------+
| [New Program] [Import] [Duplicate]                                           |
+----------------------+-------------------------------------------------------+
| Programs             | Program: decision-v1                                  |
|                      |                                                       |
| > decision-v1        | Name          [Decision Miner                  ]      |
|   trajectory-v1      | Version       [1.0.0                           ]      |
|   learning-v1        | Output mode   [Files + optional JSON summary v]       |
|   taste-v1           | Model         [default Codex model v]                 |
|                      | Concurrency   [-] 5 [+]                              |
|                      |                                                       |
|                      | Prompt                                                |
|                      | +-------------------------------------------------+   |
|                      | | Extract key decisions from this session...      |   |
|                      | +-------------------------------------------------+   |
|                      |                                                       |
|                      | Output files                                          |
|                      | - output.md                                           |
|                      | - output.json                                         |
|                      | - redaction.md                                        |
|                      |                                                       |
|                      | [Save] [Test on one thread] [Archive]                 |
+----------------------+-------------------------------------------------------+
```

## Backfill Tab

```text
+-- Thread Data / Backfill ----------------------------------------------------+
| Program                                                                      |
| [decision-v1: Decision Miner                                      v] [Edit]  |
|                                                                              |
| Source filter                                                                |
| [Last N days: 14     ] [Project: Farplane-UI v] [Ticket: any v]              |
| [Include archived [ ]] [Limit: 50] [Dry run [x]]                             |
|                                                                              |
| Matching threads                                                             |
| +--------------------------------------------------------------------------+ |
| | 42 matches | 50 max | estimated 9 min at concurrency 5                  | |
| | [ ] 019f075a... Rescope decision telemetry       TASK-0019              | |
| | [ ] 019f03fc... Private trajectory mining        none                   | |
| | [ ] 019effea... Taste loop artifacts             TASK-00xx              | |
| +--------------------------------------------------------------------------+ |
|                                                                              |
| Execution                                                                    |
| [Concurrency 5] [Parent Codex thread: create new v]                          |
|                                                                              |
|                                      [Preview job] [Run backfill]            |
+------------------------------------------------------------------------------+
```

## Runs Tab

```text
+-- Thread Data / Runs --------------------------------------------------------+
| [Running v] [Program: any v] [Last 30 days v]                 [Open folder]  |
+------------------------------------------------------------------------------+
| Run ID              Program       Status       Done   Flags   Started        |
| run-20260628-001    decision-v1   Running      18/42  2       10:41 PM       |
| run-20260627-004    trajectory-v1 Complete     5/5    0       Yesterday      |
| run-20260626-011    learning-v1   Failed       7/20   1       Jun 26         |
+------------------------------------------------------------------------------+
```

## Run Detail

```text
+-- Run: run-20260628-001 / decision-v1 --------------------------------------+
| Status: Running      18/42 complete      Parent thread: 019f.... [Open]      |
| Output path: .farplane/backfill/jobs/run-20260628-001/                       |
+------------------------------------------------------------------------------+
| Summary                                                                      |
| Completed 18 | Running 5 | Queued 19 | Failed 0 | Privacy flags 2           |
+------------------------------------------------------------------------------+
| Sources                                                                      |
| Session       Status     Output        Verdict       Flags                   |
| 019f075a...   Done       output.md     unreviewed    none                    |
| 019f03fc...   Running    -             -             -                       |
| 019effea...   Done       output.md     keep          possible secret         |
+------------------------------------------------------------------------------+
| [Pause] [Resume] [Retry failed] [Promote kept outputs] [Open job folder]     |
+------------------------------------------------------------------------------+
```

## Output Viewer

```text
+-- Output: run-20260628-001 / 019f075a... -----------------------------------+
| Program: decision-v1       Verdict: [unreviewed v]       [Open source thread]|
+-------------------------------+----------------------------------------------+
| Files                         | Preview                                      |
|                               |                                              |
| > output.md                   | # Decisions                                  |
|   output.json                 |                                              |
|   redaction.md                | - Use hookTelemetryEvents as raw store...    |
|   logs.txt                    | - Rename listener to codex-event-miner...    |
|                               | - Split historical mining into TASK-0020...  |
|                               |                                              |
|                               | Source spans                                 |
|                               | - turn 019f0416...                           |
|                               | - turn 019f0773...                           |
+-------------------------------+----------------------------------------------+
| [Keep] [Reject] [Create eval case] [Create ticket] [Copy output path]        |
+------------------------------------------------------------------------------+
```

## Interaction Rules

- `Mine selected` opens Backfill with selected session ids prefilled.
- `Run backfill` creates a parent Codex job/thread, not N UI-side requests.
- The parent job/thread spawns workers or subagents, one per session id.
- UI reads job files/progress from `.farplane/backfill/jobs/<jobId>/`.
- Output files are canonical; normalized JSON exists for indexing and previews.
- Every output must include source session id, program id/version, run id, and
  redaction status.
- Failed source rows remain visible and retryable.
- Promotion is separate from generation: generation creates candidates, review
  decides what becomes eval, ticket, memory, or training material.

