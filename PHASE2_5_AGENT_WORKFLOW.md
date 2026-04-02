# ShiftShield Phase 2.5 Agent Workflow

Date: 2026-04-02
Repo: `/home/arnavbansal/Guidewire`

## Purpose

This document persists the operating model for **Phase 2.5** so it does not live only in chat context.

Phase 2.5 comes **after** a completed and frozen Phase 2 backend baseline.

This file defines:

- which agents exist
- what each agent is responsible for
- how context should be managed
- how handoffs should be written
- how to avoid long-thread drift

## Phase 2.5 Operating Model

There are 5 active work roles for Phase 2.5.

### 1. Orchestrator / Strategist Chat

This is the control thread for Phase 2.5.

Responsibilities:

- decide the next task
- keep scope under control
- write prompts for other agents
- verify whether claims made by other agents are actually supported
- distinguish:
  - implemented
  - partially implemented
  - mocked but intentional
  - deferred
  - claimed but unverified

This chat should not behave like the main implementation worker.

### 2. Thinking 2

This is the verification / inspection worker.

Responsibilities:

- inspect repo state
- compare current implementation against spec/PPT
- verify what is true in code right now
- run bounded smoke or integration verification when needed
- identify exact files / lines / contracts in play

Thinking 2 should be used for factual verification, not broad product redesign.

### 3. Coding Agent

This is the implementation worker.

Responsibilities:

- make code changes
- run targeted verification for the code it changed
- report:
  - files changed
  - tests/commands run
  - what is implemented now
  - what is still deferred

The coding agent should not silently widen scope.

### 4. Testing Agent

This is the system and edge-testing worker.

Responsibilities:

- whole-system verification
- deep edge-case testing
- break-it and regression passes
- certification-style handoff checks once a phase is near freeze

The testing agent should separate:

- verified bug
- acceptable caveat
- deferred blocker

### 5. Claude

This is the deep second-opinion reviewer.

Use Claude when:

- repeated blockers remain
- hidden logic flaws are suspected
- spec interpretation is ambiguous
- a strong adversarial second opinion is useful before freeze

Claude should not be the default first step for every task.

## Core Working Rule

Phase 2.5 is an **upgrade workstream** after Phase 2, not a restart.

Therefore:

- keep the stable Phase 2 baseline intact unless a Phase 2.5 requirement truly forces change
- prefer staged upgrades
- prefer verification before expansion
- keep mocks explicit when real data is deferred

## Persistent Reference Files

The Phase 2.5 workstream must stay aligned with these persisted files:

- `/home/arnavbansal/Guidewire/PHASE2_5_IMPLEMENTATION_PLAN.md`
- `/home/arnavbansal/Guidewire/POLICY_FRONTEND_HANDOFF.md`
- `/home/arnavbansal/Guidewire/PHASE2_5_AGENT_WORKFLOW.md`

How to use them:

- `PHASE2_5_IMPLEMENTATION_PLAN.md`
  - persistent source of truth for scope, goals, and implementation order
- `POLICY_FRONTEND_HANDOFF.md`
  - frontend-facing policy contract for current Phase 2.0 and planned Phase 2.5 changes
- `PHASE2_5_AGENT_WORKFLOW.md`
  - operating model and context-management rules for the agent setup

If implementation decisions change materially, update these files.

## Context Management Rules

Long-thread drift is a known risk.

To reduce it, all substantial replies in the orchestrator thread should end with a compact rolling summary.

Use this exact structure:

```text
Context snapshot:
- Goal:
- Active workstream:
- Current verified state:
- Unverified claims:
- Current blocker:
- Files in play:
- Last verification run:
- Open caveats:
- Next 3 concrete tasks:
```

### Rules for the context snapshot

- keep it short
- only include active technical facts
- do not restate the entire project every turn
- compress stale information instead of repeating it
- if context starts drifting, re-anchor from the latest snapshot only

## Handoff Rules Between Agents

Every handoff should be explicit and bounded.

### When sending work to the coding agent

Include:

- exact goal
- explicit scope
- what not to change
- files to inspect first
- required verification
- expected report format

### When sending work to Thinking 2

Include:

- exact verification question
- files/spec to inspect
- whether live verification is required
- output format

### When sending work to the testing agent

Include:

- whether the pass is:
  - exploratory
  - edge-case
  - regression
  - certification
- what should count as a blocker
- required output format

### When sending work to Claude

Include:

- what not to focus on
- what is already verified
- whether the goal is:
  - adversarial review
  - spec review
  - bug hunt
  - architecture sanity check

## Phase 2.5 Recommended Work Sequence

1. geography expansion
2. platform expansion
3. underwriting rules
4. pricing recalibration
5. trigger/provider city-awareness
6. documentation and handoff updates
7. whole-system verification
8. deep testing
9. external adversarial review if needed

## Completion Standard

A Phase 2.5 slice should not be called complete until:

- implementation exists in code
- targeted verification has run
- current known caveats are stated clearly
- relevant persistent docs are updated

## Immediate Use

Any new Phase 2.5 orchestrator chat should be reminded of:

- the persistent markdown files
- the 5-agent operating model
- the compact rolling context snapshot
- the rule that Phase 2 is the frozen baseline
