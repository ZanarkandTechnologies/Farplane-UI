# Hook Telemetry Module

- Owns raw hook telemetry storage only.
- Keep product-specific interpretation in projection reducers or downstream modules.
- Do not add feature-specific raw tables for new hook signals.
- Keep payloads sanitized and size-capped before storage.
