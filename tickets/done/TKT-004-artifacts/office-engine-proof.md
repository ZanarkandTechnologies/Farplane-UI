---
ticket: TKT-004
created: 2026-06-12
kind: qa-proof
---

# Office Engine Proof

## Browser Smoke

- URL: `http://127.0.0.1:5200/office`
- Screenshot: `tickets/done/TKT-004-artifacts/office-debug-occupancy-proof.png`
- Page errors: `0`
- Bad HTTP responses: `0`
- Relevant app console errors: `0`
- Headless renderer warning: WebGL `ReadPixels` performance warning only.

## Runtime Collision Summary

```json
{
  "objectCount": 17,
  "outsideLayoutCount": 0,
  "collisionReportCount": 0,
  "walkability": {
    "gridWidth": 30,
    "gridDepth": 34,
    "walkable": 428,
    "blocked": 592
  },
  "reports": []
}
```

## Checks

- `npm run test:once -- occupancy placement-engine office-object-placement office-placement office-data-provider a-star-pathfinding`: passed, 31 tests.
- `npm run quality:smells`: passed with 38 legacy large-file warnings.
- `npm run --workspace @farplane/ui build --`: passed with existing chunk-size warning.
