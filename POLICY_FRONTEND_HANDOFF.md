# Policy Frontend Handoff

Date: 2026-04-02
Repo: `/home/arnavbansal/Guidewire`
Backend root: `/home/arnavbansal/Guidewire/backend`

## Purpose

This document is for frontend development.

It separates:

- `Phase 2.0 (build now)` — the policy-related backend contract that is already implemented and tested
- `Phase 2.5 (build later)` — the planned policy-related upgrades for PPT alignment

For the current testing/build phase, frontend should target **Phase 2.0 only**.

---

## Phase 2.0: Current Implemented Policy Contract

### Current policy endpoints

The backend currently exposes:

- `POST /api/policies/create`
- `POST /api/policies/:id/renew`
- `GET /api/policies/current`
- `GET /api/policies/history`
- `GET /api/policies/:id`
- `GET /api/dashboard`

All of the above are rider-authenticated routes.

### Policy object shape

Current policy responses use this shape:

```json
{
  "id": "policy_xxx",
  "quote_id": "quote_xxx",
  "week_start": "2026-04-06",
  "week_end": "2026-04-12",
  "shifts_covered": "both",
  "premium_paid": 60,
  "payout_cap": 5280,
  "status": "scheduled",
  "created_at": "2026-04-04T14:00:00Z"
}
```

Current `status` values used by the backend:

- `scheduled`
- `active`
- `expired`

### Create policy

#### Request

`POST /api/policies/create`

```json
{
  "quote_id": "quote_xxx",
  "payment_method": "wallet"
}
```

`payment_method`:

- `wallet`
- `direct`

#### Success: wallet payment

Status: `201`

```json
{
  "policy": {
    "id": "policy_xxx",
    "quote_id": "quote_xxx",
    "week_start": "2026-04-06",
    "week_end": "2026-04-12",
    "shifts_covered": "both",
    "premium_paid": 60,
    "payout_cap": 5280,
    "status": "scheduled",
    "created_at": "2026-04-04T14:00:00Z"
  },
  "wallet": {
    "id": "wallet_xxx",
    "balance": 296,
    "previous_balance": 356,
    "currency": "INR"
  },
  "transaction": {
    "id": "txn_xxx",
    "type": "debit_premium",
    "amount": -60,
    "description": "Weekly premium — 2026-04-06 to 2026-04-12",
    "created_at": "2026-04-04T14:00:00Z"
  }
}
```

#### Success: direct payment

Status: `201`

```json
{
  "policy": {
    "id": "policy_xxx",
    "quote_id": "quote_xxx",
    "week_start": "2026-04-06",
    "week_end": "2026-04-12",
    "shifts_covered": "dinner",
    "premium_paid": 40,
    "payout_cap": 3660,
    "status": "scheduled",
    "created_at": "2026-04-04T14:00:00Z"
  },
  "payment": {
    "method": "direct",
    "status": "recorded"
  }
}
```

#### Error: insufficient wallet balance

Status: `400`

```json
{
  "error": "insufficient_balance",
  "wallet_balance": 50,
  "premium_required": 80,
  "shortfall": 30,
  "message": "Insufficient wallet balance. Please top up ₹30 or choose direct payment."
}
```

#### Error: active disruption in rider zone

Status: `409`

```json
{
  "error": "disruption_active",
  "message": "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."
}
```

#### Other expected errors

- `400 validation_error`
- `400 quote_expired`
- `404 not_found`
- `409 policy_exists`

### Renew policy

#### Request

`POST /api/policies/:id/renew`

```json
{
  "quote_id": "quote_xxx",
  "payment_method": "wallet"
}
```

#### Current behavior

- Renew uses the same purchase rules as create
- Renew requires a new quote for a future week
- Renew prevents duplicate same-week policy creation

#### Success

Status: `201`

Response shape is the same as `POST /api/policies/create`.

#### Current frontend guidance

Treat renew as:

1. obtain quote for next week
2. call renew on the current policy
3. show same purchase success/error UX as create

### Get current policy

`GET /api/policies/current`

Status: `200`

```json
{
  "current_policy": {
    "id": "policy_xxx",
    "quote_id": "quote_xxx",
    "week_start": "2026-04-06",
    "week_end": "2026-04-12",
    "shifts_covered": "dinner",
    "premium_paid": 40,
    "payout_cap": 3660,
    "status": "scheduled",
    "created_at": "2026-04-04T14:00:00Z"
  }
}
```

If no policy is available:

```json
{
  "current_policy": null
}
```

### Get policy history

`GET /api/policies/history?limit=20&offset=0`

Status: `200`

```json
{
  "policies": [
    {
      "id": "policy_xxx",
      "quote_id": "quote_xxx",
      "week_start": "2026-04-06",
      "week_end": "2026-04-12",
      "shifts_covered": "dinner",
      "premium_paid": 40,
      "payout_cap": 3660,
      "status": "scheduled",
      "created_at": "2026-04-04T14:00:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1,
    "has_more": false
  }
}
```

### Get policy detail

`GET /api/policies/:id`

Status: `200`

```json
{
  "policy": {
    "id": "policy_xxx",
    "quote_id": "quote_xxx",
    "week_start": "2026-04-06",
    "week_end": "2026-04-12",
    "shifts_covered": "dinner",
    "premium_paid": 40,
    "payout_cap": 3660,
    "status": "scheduled",
    "created_at": "2026-04-04T14:00:00Z"
  }
}
```

### Dashboard contract relevant to policy UX

`GET /api/dashboard`

Current dashboard includes policy-related fields:

```json
{
  "rider": {
    "name": "Asha Rider",
    "zone_name": "Koramangala",
    "platform": "swiggy"
  },
  "wallet": {
    "balance": 356
  },
  "current_policy": {
    "id": "policy_asha_active",
    "week_start": "2026-03-31",
    "week_end": "2026-04-06",
    "status": "active",
    "premium_paid": 52,
    "shifts_covered": "both",
    "shifts_remaining": {
      "lunch": 6,
      "dinner": 5
    },
    "claims_this_week": 1,
    "total_payout_this_week": 306
  },
  "zone_weather": {
    "current_temp": 28,
    "current_aqi": 180,
    "current_rain_mm": 0,
    "status": "normal",
    "last_updated": "2026-04-01T12:00:00Z"
  },
  "recent_claims": [
    {
      "id": "claim_xxx",
      "shift_type": "dinner",
      "trigger_type": "aqi",
      "severity_level": 2,
      "payout_percent": 45,
      "payout_amount": 306,
      "status": "paid",
      "created_at": "2026-04-01T12:00:00Z"
    }
  ],
  "next_week_quote_available": true
}
```

### Notifications relevant to policy UX

Current notification types already implemented:

- `policy_created`
- `policy_renewed`
- `claim_paid`
- `claim_under_review`
- `wallet_credited`
- `wallet_debited`

For Phase 2.0 frontend, policy notifications can be used but they are not required to unblock policy screens.

### What frontend should build now for Phase 2.0

Build now:

- current policy card
- policy history list
- policy detail screen/sheet
- buy policy confirmation flow
- renew CTA on current/expiring policy
- dashboard policy summary
- wallet/direct payment branch in buy/renew flows
- clear handling for:
  - insufficient wallet balance
  - disruption active
  - duplicate policy exists
  - quote expired

Do not assume Phase 2.5 fields yet.

---

## Phase 2.5: Planned Policy Contract Changes

These are planned upgrades for PPT alignment and are **not the frontend source of truth yet**.

Frontend should not block current work on these.

### Why Phase 2.5 exists

The newer PPT direction adds:

- at least 10 cities
- T1 / T2 / T3 city tiering
- stronger platform/geography alignment while keeping Swiggy/Zomato
- stronger underwriting rules
- pricing expectations closer to `₹20–₹50/week`

### Expected policy-related additions in Phase 2.5

#### 1. Policy becomes city-aware

Likely new fields on policy and/or dashboard-facing policy summaries:

- `city_id`
- `city_name`
- `city_tier` (`T1 | T2 | T3`)
- possibly `zone_id` if city and zone both remain visible

Frontend impact:

- show city name
- show city tier badge
- stop assuming Bengaluru-only copy

#### 2. Platform scope remains stable

Current frontend can assume:

- `swiggy`
- `zomato`

Frontend impact:

- onboarding/profile/platform badges should continue to support Swiggy/Zomato

#### 3. Underwriting becomes explicit

Planned backend-visible concepts:

- minimum 7 active delivery days before cover starts
- `< 5` active days in last 30 days => lower activity tier / restricted pricing or eligibility

First planned backend slice for underwriting:

- `eligible` when `active_days_last_30 >= 7`
- `insufficient_history` when `active_days_last_30` is `5` or `6`
- `restricted` when `active_days_last_30 < 5`

Expected first-slice behavior:

- only `eligible` can purchase or renew
- `insufficient_history` and `restricted` should be surfaced explicitly and blocked
- pricing changes for these states are deferred to a later slice

Current backend status:

- the first underwriting slice is now implemented in backend quote/create/renew behavior
- frontend should expect underwriting-related fields and blocked purchase states to become real backend behavior once the upgraded contract is consumed

Likely future fields:

- `underwriting_status`
  - `eligible`
  - `insufficient_history`
  - `restricted`
- `underwriting_reason`
- `active_days_last_30`
- `minimum_active_days_required`
- `worker_activity_tier`

Frontend impact:

- quote screen will likely need eligibility/restriction messaging
- policy purchase/renew CTA may need disable states

#### 4. Renew remains, but UX may get richer

Likely still:

- `POST /api/policies/:id/renew`

Possible future additions:

- more explicit renew eligibility messaging
- clearer next-week preview
- city/tier/platform context in renew summary

#### 5. Dashboard policy card may expand

Likely future additions:

- city name / city tier
- underwriting summary
- richer current/upcoming policy distinction

### What frontend should assume for Phase 2.5

Safe assumption:

- same core policy endpoints
- richer fields added, not a brand-new policy architecture

Do not assume Phase 2.5 is final until backend confirms the upgraded contract.

Backend has now confirmed the first underwriting slice, but pricing recalibration and later Phase 2.5 additions are still in progress.

---

## Frontend build recommendation

### Build now against Phase 2.0

Use current endpoints and shapes as the source of truth for:

- buy policy
- renew
- current policy
- policy history
- policy detail
- dashboard policy summary

### Keep UI flexible for Phase 2.5

Design the frontend components so they can later accept optional fields like:

- `city_name`
- `city_tier`
- `underwriting_status`
- `underwriting_reason`
- `worker_activity_tier`
- expanded `platform`

### Suggested frontend approach

For now:

- use the current policy object as the stable base
- treat city/tier/underwriting additions as optional future enhancements

---

## Current source-of-truth files

Backend files:

- [backend/src/routes/policies.js](/home/arnavbansal/Guidewire/backend/src/routes/policies.js)
- [backend/src/services/policy-service.js](/home/arnavbansal/Guidewire/backend/src/services/policy-service.js)
- [backend/src/routes/dashboard.js](/home/arnavbansal/Guidewire/backend/src/routes/dashboard.js)
- [backend/src/services/dashboard-service.js](/home/arnavbansal/Guidewire/backend/src/services/dashboard-service.js)

Current contract proof:

- [backend/tests/policies.http.test.js](/home/arnavbansal/Guidewire/backend/tests/policies.http.test.js)
- [backend/tests/renew.http.test.js](/home/arnavbansal/Guidewire/backend/tests/renew.http.test.js)
- [backend/tests/dashboard.http.test.js](/home/arnavbansal/Guidewire/backend/tests/dashboard.http.test.js)

---

## Final summary

For frontend development right now:

- **Build against Phase 2.0**
- policy endpoints and payloads above are the current contract
- Phase 2.5 should be treated as planned additions, not current API truth

The safest frontend strategy is:

- implement current policy flow now
- keep components extensible for future city/tier/underwriting fields
