---
name: create-team
description: Start a new Farplane team or business unit from an idea brief. Use when an agent should gather missing details, research real-world team structure, decide roles/tools/skills, prepare a founder approval task, and then execute through farplane-team-cli after approval.
---

# Create Team Skill

Use this skill when the user wants to spin up a new team from an idea, not just run one isolated CLI command.

This is a workflow skill. It should:

1. Gather the missing business brief.
2. Research how real-world teams in that space usually operate.
3. Decide likely roles, tools, data sources, and supporting skills.
4. Write a concise proposal for founder review.
5. Wait for founder approval.
6. Use `farplane-team-cli` to execute the approved plan.

## Required Brief

Before proposing a team, gather enough detail to fill:

- `focus`
- `targetCustomer`
- `primaryGoal`
- `constraints`

Do not execute team creation before these fields are clear enough to act on.

## Workflow

### 1. Clarify the brief

- Ask follow-up questions until the minimum brief is concrete.
- Prefer short questions that reduce execution ambiguity.

### 2. Research the operating shape

- Research how comparable teams in that business usually operate.
- Identify:
  - likely roles,
  - likely tools,
  - likely data sources,
  - whether the team actually needs a developer, analyst, marketer, operator, or only PM/executor roles.
- Use `find-skills` if the needed skill/tool coverage is unclear.

### 3. Produce the proposal

Summarize:

- `researchSummary`
- `proposalSummary`
- `proposedTeamName`
- `proposedDescription`
- `proposedRoles[]`
- `proposedBusinessConfig`
- `proposedInitialBoardItems[]`

Keep the rich reasoning in chat/session. Keep the task notes compact and resumable.

### 4. Persist the proposal through the board

Use `farplane-team-cli` board task commands to create and advance the proposal/review lifecycle.

Canonical flow:

- create or select the target planning team
- `team board task add --task-type team_proposal --approval-state pending_review`
- founder review / approval
- `team board task update --approval-state approved` or `--approval-state changes_requested`
- execute approved setup through normal `team create`, `team business`, `team board`, and skill sync commands
- update the proposal task with `--created-team-id` and `--created-project-id`

The board task is the resumable approval record. Do not use the removed `team proposal` command family.

### 5. Wait for approval

- Tell the founder to review the task in User Tasks.
- Do not execute until the proposal is approved.
- If the founder requests changes, revise the same proposal/session instead of starting over.

### 6. Execute through `farplane-team-cli`

After approval, use `farplane-team-cli` to:

- create the team,
- set business config,
- equip/sync needed skills,
- seed the team board with initial tasks,
- update any linked CEO task with compact result notes if one exists.

## Tool Skill Dependency

This workflow depends on:

- [`skills/farplane-team-cli/SKILL.md`](/home/kenjipcx/Zanarkand/Farplane/skills/farplane-team-cli/SKILL.md)

Use that skill for concrete command syntax and mutation rules.

## Working Memory Rule

- Proposal summary and task notes are short-term working memory.
- The linked session is the richer reasoning thread.
- On every meaningful step, update the persisted proposal board task so the workflow can resume later without transcript hunting.

## Contract Tests

- Executable workflow examples live under [`skills/create-team/tests/`](/home/kenjipcx/Zanarkand/Farplane/skills/create-team/tests).
- Run them with:

```bash
pnpm run test:skills
```
