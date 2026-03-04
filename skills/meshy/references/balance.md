# Balance Reference

Endpoint: `GET /openapi/v1/balance`

## Purpose

Check available credits before running expensive multi-stage workflows.

## Response shape

```json
{
  "balance": 1000
}
```

## Recommended usage

- Check once before batch jobs.
- Abort or ask for confirmation if credits are below your threshold.
