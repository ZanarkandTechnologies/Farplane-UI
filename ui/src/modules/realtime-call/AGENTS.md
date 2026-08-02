# Realtime Call Module

- Read `README.md` and `docs/qa-runbook.md` before changing call behavior.
- Keep profile and session endpoints behind the module-local client.
- Never simulate media, speaking state, transcripts, or connected participants.
- Keep each call in one trusted scope: one live-model project or the Farplane-owned executive
  office. Never accept a browser-provided path for the office scope.
- Preserve browser permission, connection, error, and ended states in UI changes.
