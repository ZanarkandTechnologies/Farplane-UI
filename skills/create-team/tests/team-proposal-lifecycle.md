# Team Creation Lifecycle

This contract proves the create-team workflow examples still match the local CLI-backed team creation lifecycle.
The board-backed proposal approval commands require Convex configuration, so they are documented in the skill body and covered by CLI tests instead of this filesystem-only skill contract.

```json skill-test
{
  "name": "team creation lifecycle",
  "steps": [
    {
      "run": [
        "team",
        "create",
        "--name",
        "Affiliate Content Engine",
        "--description",
        "Planning team for home office affiliate content",
        "--goal",
        "Ship weekly revenue-generating content",
        "--auto-roles",
        "pm,builder"
      ],
      "expect": {
        "companyProjectIdsInclude": ["proj-affiliate-content-engine"],
        "openclawAgentIdsInclude": ["affiliate-content-engine-pm", "affiliate-content-engine-builder"]
      }
    }
  ]
}
```
