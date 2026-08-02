---
module: user-communications
owner: ui-modules
status: building
---

# User Communications

Founder-facing configuration for the local Telegram reply gateway.

The module stores only non-secret configuration such as the main Codex thread,
allowlist, and Codex app-server URL. `TELEGRAM_BOT_TOKEN` is injected when the
Node gateway launches with `farplane run -- …`; the token is never written to
browser state or `~/.farplane/config.toml`.
