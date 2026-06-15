---
module: user-communications
owner: ui-modules
status: building
---

# User Communications

Founder-facing configuration for the local Telegram reply gateway.

The module stores only local browser configuration for the main Codex thread and
Codex app-server URL. Telegram credentials and reply mappings stay in the local
Node gateway state, outside browser code.
