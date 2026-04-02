# ShiftShield Phase 3 Gap-to-Build Plan

Date: 2026-04-02
Repo: `/home/arnavbansal/Guidewire`
Baseline branch: `Arnav-2.5`

## 1. Purpose

This document defines the next major workstream after the frozen Phase 2.5 stretch.

Phase 3 exists to close the larger remaining gaps between the current implementation and the newer Guidewire PPT direction.

This file is intended to persist:

- what is already aligned
- what still differs from the PPT
- what the next implementation phase should focus on

## 2. Current Baseline

Phase 2 backend is complete and frozen.

Phase 2.5 is also complete enough to treat as the current upgrade baseline.

Current aligned areas:

- 12 supported geographies
- explicit `T1` / `T2` / `T3` metadata
- `Swiggy` / `Zomato` scope
- underwriting gate in quote/create/renew
- pricing constrained into the `₹20–₹50` band
- non-Bengaluru quote and claim-path verification
- geography-aware fallback weather/provider behavior

## 3. Major Gaps Still Remaining

### 3.1 City -> multiple zones hierarchy

Current model:

- one operational `zone_id` per supported geography unit

Remaining gap:

- no explicit `city -> multiple zones` hierarchy
- no ability to model several zones/wards under a single city cleanly

Why it matters:

- the PPT direction implies broader city-level expansion with richer internal geography
- future risk, trigger, and pricing behavior will be easier to reason about with a proper hierarchy

### 3.2 Tiered premium model

Current model:

- dynamic premium exists
- calibrated into `₹20–₹50`
- geography-aware inputs exist
- exercised quotes still often cluster at the floor

Remaining gap:

- not enough premium differentiation across city tiers / zone risk profiles
- no explicit premium-tier product layer on top of the dynamic model

Why it matters:

- the PPT direction expects a more explainable premium story
- higher-risk and higher-earning geographies should not feel too similar to lower-risk geographies

### 3.3 Zone/city-specific thresholding

Current model:

- underwriting thresholds are global
- disruption thresholds are still one shared backend set

Remaining gap:

- no city-specific or zone-specific threshold tables
- no configurable trigger/risk thresholds by geography segment

Why it matters:

- future expansion may need different treatment for different climate/risk regions

### 3.4 Real-data maturity

Current model:

- real/live weather path where available
- fallback synthetic/weather-derived behavior
- synthetic training data generation remains part of the pipeline

Remaining gap:

- no full 10-year real dataset pipeline
- no true production-grade external risk-data pipeline

Why it matters:

- the PPT direction gestures toward deeper historical realism and stronger data grounding

### 3.5 CPCB / ward-level evolution

Current model:

- Open-Meteo-backed path
- geography-aware but not true ward-level or CPCB-driven

Remaining gap:

- no real CPCB provider integration
- no ward-level trigger granularity

### 3.6 Settlement/reporting depth

Current model:

- wallet-first payout model remains central
- limited actuarial/reporting depth

Remaining gap:

- no richer direct-settlement simulation layer
- no strong BCR/loss-ratio/stress-control backend surface

## 4. Recommended Phase 3 Scope

### Phase 3A: Geography hierarchy

Build:

- explicit `city` records
- explicit `zone` records under each city
- clean city -> zone relationships in backend + ML config

Target outcome:

- each city can contain multiple zones
- current `zone_id` flows remain functional

### Phase 3B: Tiered premium model

Build:

- premium-tier logic on top of dynamic risk scoring
- explainable differentiation by:
  - city tier
  - zone risk class
  - rider earnings baseline
  - recent trigger history

Target outcome:

- still dynamic
- still bounded
- but more differentiated than the current compressed/floor-heavy behavior

### Phase 3C: Geography-specific thresholding

Build:

- configurable threshold tables or risk configs by city/zone segment

Target outcome:

- not every geography behaves as if it shares the same disruption profile

### Phase 3D: Later data realism

Defer until after 3A/3B/3C:

- stronger real historical data ingestion
- possible CPCB/provider integration
- richer actuarial reporting

## 5. Tiered Premium Model Interpretation

For this project, a tiered premium model should mean:

- **dynamic risk still exists**
- but pricing is not only one flattened number from a compressed calibration band

The model should combine:

1. a **base tier** derived from geography segment
- example:
  - `T1` cities
  - `T2` cities
  - `T3` cities

2. a **zone risk adjustment**
- example:
  - `low`
  - `medium`
  - `high`

3. a **dynamic weekly risk adjustment**
- live or fallback weather/AQI
- recent trigger history
- shift coverage

4. an optional **affordability guardrail**
- keep prices within the allowed product band
- prevent extreme outcomes

This is different from:

- one static premium table
- or a single compressed dynamic number with weak differentiation

## 6. Non-Goals For The Immediate Next Step

Do not do all of this at once.

Do not start with:

- full 10-year data ingestion
- full CPCB integration
- full settlement redesign
- broad frontend refactor

The next implementation phase should start with:

1. city -> multiple zones model
2. tiered premium model

## 7. Recommended Order

1. design explicit city + zone hierarchy
2. update backend/seed/ML config to support that hierarchy
3. redesign the premium model so tier + zone + dynamic risk all matter
4. verify quotes across multiple cities/zones
5. then revisit deeper provider/data realism

## 8. Completion Standard For Phase 3 Start

The next phase should be considered properly started only when:

- the hierarchy model is clearly defined in writing
- premium-tier logic is defined in writing
- the coding task is split into bounded slices
- verification strategy is defined before implementation starts
