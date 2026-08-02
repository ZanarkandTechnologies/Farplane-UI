---
title: Realtime call feature registry
status: active
owner: realtime-call
---

# Feature Registry

| Capability | Owner | Evidence |
| --- | --- | --- |
| Employee selection and dialog lifecycle | `store.ts` | `store.test.ts` |
| Single-project resolution | `lib/resolve-call-selection.ts` | colocated test |
| Local agent profile discovery | `hooks/use-project-agent-profiles.ts` | bridge response/error states |
| Live media and transcripts | `components/realtime-call-dialog.tsx` | LiveKit room browser QA |
