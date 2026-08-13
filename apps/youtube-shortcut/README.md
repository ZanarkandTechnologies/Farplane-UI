# Farplane YouTube Shortcut

A Plasmo extension that puts an **Analyze** action in the top-right
corner of YouTube video thumbnails. A cache miss creates a persistent Codex
task and runs the installed `summarize` skill; a cache hit reopens the stored
answer and task. Ingest jobs, source assets, dossiers, stories, and reporting
claims are retained in the project's Convex cloud deployment.

New summary tasks use `/Users/kenjipcx/Zanarkand Technologies/Analyst` as their
working directory, which files them under the registered Codex Analyst project.
Cached answers retain the task link that originally produced them.

## Build and load in Brave

From the Farplane UI root:

```bash
corepack pnpm install
corepack pnpm youtube:build
```

Open `brave://extensions`, enable **Developer mode**, choose **Load unpacked**,
and select this generated folder:

```text
/Users/kenjipcx/Zanarkand Technologies/projects/Farplane-UI/apps/youtube-shortcut/build/chrome-mv3-prod
```

If the popup still says **Cura local summary**, Brave is loading the obsolete
Cura build directory. Remove that unpacked extension entry first, then load the
Farplane folder above. The Reload button does not change an extension's source
directory.

The manifest carries a stable development key, so the local bridge can allow
the extension without exposing a general localhost API.

## Run the local Codex bridge

Keep this running while using the button:

```bash
corepack pnpm youtube:serve
```

That starts the Codex app-server on `127.0.0.1:47892` and the extension bridge
on `127.0.0.1:47893`. The extension popup opens on a **Jobs** tab with the 20
most recent Convex-backed jobs; runtime health and setup live under **Status**.
Running, completed, and failed jobs link directly to their persistent Codex
task as soon as Codex assigns its task ID.

The bridge reads the non-secret `VITE_CONVEX_URL` setting from Farplane
Configurations, then the environment, and finally the Farplane UI root
`.env.local` bootstrap file. It does not create a local Video Intelligence
database. It uses the same direct Convex function pattern as Resource Bank and
Tasty Packs; the loopback bridge remains restricted to the Farplane
browser-extension origins.

## Resume a channel manifest

The channel runner reuses the same origin-restricted `POST /analyze-youtube`
route as the browser button. It runs at a maximum of five active sources,
waits on an already-running canonical job instead of duplicating it, skips a
succeeded source already assigned to the requested project, retries transient
timeout/transport errors once, stops on authentication invalidation, and
preserves source-unavailable results as honest terminal failures.

The default analysis turn is `gpt-5.6-terra` with reasoning effort `xhigh`.
Change it in **Settings → Configs → Video Intelligence**; the bridge snapshots
the selected profile to each new job and verifies it against the connected
Codex app-server before beginning. Useful progress refreshes a 180-second idle
timeout; a 15-minute absolute cap still bounds a wedged turn. The canonical
Resource Bank job and asset receive the supplied project association.

From the Farplane UI root, run a staged manifest import:

```bash
corepack pnpm youtube:ingest-manifest -- --max-sources 1
corepack pnpm youtube:ingest-manifest -- --max-sources 5 --concurrency 5
corepack pnpm youtube:ingest-manifest
```

The default source is the frozen 2026 manifest at
`tickets/TASK-0080/artifacts/2026-channel-manifest.json`; the default report is
`tickets/TASK-0080/artifacts/qa/manifest-report.json`. Re-running the command
is safe for succeeded Vidgard sources and preserves per-source attempts,
canonical IDs, terminal status, and error classification in the report. The
`--concurrency` value is bounded to 1–5 and defaults to 5.

## Interaction

- The Analyze action occupies the thumbnail corner and suppresses YouTube's
  hover preview only while the pointer is over that action.
- First click checks the video-ID cache, then creates a persistent Codex task
  only on a miss.
- A completed answer opens immediately. Click the same button again to close or
  reopen it; press Escape to close it.
- **Open Codex Task** opens the persistent task using its `codex://` link.
- New thumbnails inserted while scrolling are scanned and receive one control.

Transcript-backed results use `TRANSCRIPT_USED`. When captions are unavailable
but the skill extracts a substantive video description, chapters, or other
page-owned material, the result uses `SUMMARY_ONLY` and labels that limitation.
When neither source is usable, the job remains a visible failure.

Optional personalization lives only at `~/.farplane/USER.md`. When that file is
absent, the result explicitly reports that personal relevance is unavailable.

## Development checks

```bash
corepack pnpm youtube:test
corepack pnpm --filter @farplane/youtube-shortcut type-check
corepack pnpm youtube:build
```
