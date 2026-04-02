# ShiftShield Phase 2.5 Implementation Plan

Date: 2026-04-02
Repo: `/home/arnavbansal/Guidewire`
Baseline branch: `Arnav`

## 1. Purpose

This document defines **Phase 2.5**.

Phase 2.5 comes **after** a completed and verified Phase 2 backend baseline.

It exists because newer Guidewire PPT/material introduced product-direction requirements that are not fully covered by the original Phase 2 scope.

This file is the persistent source of truth for the Phase 2.5 upgrade path.

## 2. Phase 2 Baseline

Phase 2 backend was completed and verified before Phase 2.5 started.

Implemented in Phase 2:

- Dynamic Premium Calculation
- Insurance Policy Management
- Claims Management
- Wallet
- Dashboard
- Notifications
- Admin simulate-trigger
- Policy lifecycle runner

Verified Phase 2 state at freeze:

- Local backend test suite: green
- Whole-system local verification: green
- Deep local edge-case and break-it verification: green
- Hosted Supabase smoke including notifications: green
- Final backend verdict: `GO`

Known inherited caveat:

- Supabase wallet mutation under true concurrency/failure remains a documented caveat.
- This was not a blocker for Phase 2 freeze, but it is not considered fully solved.

## 3. Why Phase 2.5 Exists

Guidewire’s later PPT/material introduced additional expectations that are not fully reflected in the original Phase 2 implementation.

Main gaps identified:

1. Geographic scope
- Need at least 10 cities
- Current system is still centered around the original 5 Bengaluru zones

2. City segmentation
- Need explicit city tiers: `T1`, `T2`, `T3`

3. Platform scope
- Need support for:
  - `swiggy`
  - `zomato`

4. Underwriting alignment
- Minimum 7 active delivery days before cover starts
- Workers with `< 5` active days in the last 30 days should move to a lower tier / restricted path

5. Pricing alignment
- Weekly premium should generally fall in the `₹20–₹50` range

6. Trigger model evolution
- Trigger/provider path should be city-aware
- Future-ready for later CPCB / ward-level integration

## 4. Phase 2.5 Principles

Phase 2.5 is an **upgrade**, not a rewrite.

Rules:

- Do not discard the working Phase 2 baseline
- Prefer staged upgrades over broad redesigns
- Keep route/service architecture stable where possible
- Mock city/platform/activity data is acceptable in the first Phase 2.5 round
- Do not claim true CPCB/ward-level production integration unless it is actually implemented
- Do not attempt full 10-year real-data ingestion in the first Phase 2.5 round

## 5. Phase 2.5 Scope

### In scope for the first round

1. Geography expansion
- Expand from 5 zones to at least 10 cities
- Add explicit city tier metadata: `T1`, `T2`, `T3`

2. Platform expansion
- Preserve and clearly support Swiggy and Zomato across the expanded geography model

3. Underwriting rules
- Minimum 7 active delivery days before cover starts
- `< 5` active days in last 30 days => lower-tier / restricted path

4. Pricing recalibration
- Bring weekly premium behavior toward `₹20–₹50`

5. Trigger/provider city-awareness
- Remove hardcoded assumptions tied to the original 5-zone setup
- Prepare for future provider evolution

6. Documentation and testing updates
- Update tests, reports, and handoff documents to reflect Phase 2.5 behavior

### Explicitly deferred for the first round

1. Full 10-year real historical dataset ingestion
2. Full CPCB integration
3. True ward-level production trigger coverage
4. Major backend architecture rewrite
5. Frontend implementation details

## 6. Product Model Changes in Phase 2.5

### 6.1 Geography

The data model should evolve from:

- 5 Bengaluru zones

to:

- at least 10 supported cities
- each tagged with a tier:
  - `T1`
  - `T2`
  - `T3`

Recommended minimum city metadata:

- `id`
- `name`
- `tier`
- `lat`
- `lng`
- `risk_class`
- `avg_lunch_earnings`
- `avg_dinner_earnings`
- optional `state` or `region`

### 6.2 Platform support

Platform support should include:

- `swiggy`
- `zomato`

Mock platform data can be used in this round.

### 6.3 Underwriting

The backend should support explicit underwriting checks tied to worker activity.

Minimum required rules:

- Rider must have at least 7 active delivery days before cover starts
- Rider with fewer than 5 active days in the last 30 days should be treated as lower-tier / restricted

How the product enforces the restricted path can be implemented in a minimal explicit way, for example:

- restricted eligibility
- restricted pricing bucket
- explicit underwriting state in quote or policy flow

For the first underwriting implementation slice, use this explicit behavior:

- `eligible` when `active_days_last_30 >= 7`
- `insufficient_history` when `active_days_last_30` is `5` or `6`
- `restricted` when `active_days_last_30 < 5`

For that first slice:

- only `eligible` should be purchasable / renewable
- `insufficient_history` and `restricted` should be blocked explicitly in quote and policy purchase flows
- pricing changes for these states are deferred until the later pricing recalibration slice

Current implementation status:

- this first underwriting slice is now implemented in the backend quote/create/renew path
- underwriting is visible and testable through explicit quote response state and create/renew blocking behavior
- targeted backend verification for the underwriting slice is green
- broader whole-system verification is still deferred until later slices land

### 6.4 Pricing

Current Phase 2 pricing must be recalibrated to align with the new target range.

Target:

- weekly premium typically in `₹20–₹50`

This likely requires updating:

- premium floor
- premium ceiling
- loading factor
- tier/city scaling
- supporting mock earnings assumptions

### 6.5 Trigger/provider logic

Current trigger logic should become city-aware and no longer rely on assumptions that only the original 5-city/zone set exists.

First-round requirement:

- make provider logic geography-extensible

Deferred:

- true CPCB/ward-level integration

## 7. Recommended Implementation Order

The intended Phase 2.5 implementation order is:

1. Audit current Bengaluru-only assumptions in backend + ML
2. Expand geography and add city tiers
3. Expand platform support
4. Add underwriting rules
5. Recalibrate pricing into `₹20–₹50`
6. Make trigger/provider logic city-aware
7. Update tests, reports, and handoff artifacts
8. Run full-system and deep verification for Phase 2.5

## 8. Expected Backend Impact

Likely affected areas:

### Backend

- seed data / local data
- storage adapter assumptions
- quote generation
- policy eligibility / purchase / renew flow
- dashboard aggregation
- trigger processing inputs
- notification text if product language changes

### ML service

- city definitions
- training-data generation assumptions
- premium calibration logic
- zone/city encoding assumptions

## 9. Testing Strategy for Phase 2.5

Testing should happen after implementation stages, not before.

Recommended testing order:

1. Whole-system Phase 2.5 verification
- quote
- policy create / renew
- dashboard
- trigger / claim
- wallet
- notifications

2. Deep iterative testing
- edge cases
- malformed payloads
- time/date boundaries
- cross-slice invariants
- repeated sequences
- hosted smoke where relevant

## 10. Frontend Coordination

Frontend should continue building against the current Phase 2.0 contract until Phase 2.5 backend contracts are actually implemented and verified.

Current frontend handoff file:

- `/home/arnavbansal/Guidewire/POLICY_FRONTEND_HANDOFF.md`

That file already separates:

- current Phase 2.0 policy contract
- planned Phase 2.5 additions

## 11. Agent Operating Model

Phase 2.5 should continue using the multi-agent setup:

1. Orchestrator chat
- strategy
- task framing
- prompt writing
- output triage

2. Thinking 2
- repo/spec/live verification
- integration analysis

3. Coding agent
- implementation

4. Testing agent
- whole-system testing
- deep edge-case / break-it testing

5. Claude
- deep second opinion
- ambiguity resolution
- adversarial review when useful

## 12. Completion Criteria for the First Phase 2.5 Round

The first Phase 2.5 round should be considered successful when:

1. Geography is expanded to at least 10 cities
2. T1/T2/T3 tiering exists in the working model
3. Swiggy and Zomato support remains cleanly supported
4. Underwriting rules are visible and testable
5. Premiums are recalibrated into the intended `₹20–₹50` range for supported cases
6. Trigger/provider logic is city-aware
7. Existing Phase 2 flows still work after the upgrade
8. Tests and handoff documents are updated

## 13. Current Next Step

Immediate next step for Phase 2.5:

1. Recalibrate premium behavior toward the intended `₹20–₹50` range
2. Keep pricing changes narrowly scoped to the premium-shaping layer without reopening underwriting rules
3. After pricing, verify quote/create/renew behavior again before moving to trigger/provider city-awareness
