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

The bridge reads `CONVEX_URL` or `VITE_CONVEX_URL` from the environment, falling
back to the Farplane UI root `.env.local`. It does not create a local Video
Intelligence database. It uses the same direct Convex function pattern as
Resource Bank and Tasty Packs; the loopback bridge remains restricted to the
Farplane browser-extension origins.

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
