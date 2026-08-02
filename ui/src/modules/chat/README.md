# Chat Module

Owns office chat surfaces: chat dialog, sidebar, message rendering, story chat display, chat store, and chat hooks.

Executive specialists open the same dialog, but Codex mode resolves each one to a hidden named
backing thread (`Farplane Agent [agentId] Name`). The profile supplies bounded developer
instructions only when that thread is first created. Subsequent messages reuse it, and the backing
thread is excluded from ordinary office-worker projections so one persona does not render twice.
