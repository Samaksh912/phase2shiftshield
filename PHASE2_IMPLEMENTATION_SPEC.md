# ShiftShield — Phase 2 Master Implementation Spec

**Date:** March 31, 2026
**Deadline:** April 4, 2026 EOD
**Status:** LOCKED. No scope changes after this document.

---

## 0. Project Identity

**Product:** ShiftShield — AI-powered weekly parametric income protection for Bengaluru food delivery riders.

**One-line pitch:** When extreme heat, severe AQI, or heavy rain hits a rider's zone during their insured shift, ShiftShield detects the disruption automatically and credits their wallet — no claim filed, no paperwork, no waiting.

**Phase 2 goal:** Ship one clean end-to-end loop:

```
register rider → generate weekly premium → buy policy → detect disruption → auto-create claim → credit wallet
```

If that loop works in the app and in the 2-minute demo, Phase 2 is successful.

---

## 1. Hard Scope Locks

These are non-negotiable. Do not deviate.

| Decision | Locked Value |
|---|---|
| City | Bengaluru only |
| Zones | Koramangala, Indiranagar, HSR Layout, Whitefield, Electronic City |
| Persona | Food delivery riders (Swiggy / Zomato) |
| App | Flutter (Android-first) |
| Backend | Node.js with Express |
| ML Service | Python FastAPI (separate service) |
| Database | Supabase (PostgreSQL) |
| Weather + AQI | Open-Meteo (only live data source) |
| Platform data | Mock Platform API (self-built, simulates Swiggy/Zomato) |
| Payout | Wallet-first. Direct payout is stored as preference only, not implemented. |
| Auth | OTP-style demo auth (hardcode OTP "1234" for demo convenience) |
| Notifications | Supabase Realtime or local Flutter state refresh for Phase 2 |

---

## 2. Technical Constraints (ALL THREE PEOPLE MUST FOLLOW)

### 2.1 Time Handling

- **Store** all timestamps in UTC in the database
- **Run** all business logic (shift windows, policy deadlines, cron jobs) in `Asia/Kolkata` (IST = UTC+5:30)
- **Display** all dates and times in IST in the Flutter app
- Policy weeks: Monday 00:00 IST to Sunday 23:59 IST
- Lunch shift window: 11:00–15:00 IST
- Dinner shift window: 18:00–23:00 IST
- Purchase cutoff: Saturday 23:59 IST

### 2.2 Auth Convention

- All protected endpoints receive a JWT in the `Authorization: Bearer <token>` header
- **rider_id is ALWAYS inferred from the JWT on the backend. Never pass rider_id from the frontend in request bodies or query params.**
- JWT payload: `{ "rider_id": "rider_abc123", "phone": "9876543210", "iat": ..., "exp": ... }`
- JWT secret: use environment variable `JWT_SECRET`
- JWT expiry: 7 days

### 2.3 API Conventions

- All endpoints return JSON
- Success: `{ "data": { ... } }` or direct object as documented per endpoint
- Error: `{ "error": "error_code", "message": "Human readable message" }`
- HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 409 (conflict/duplicate), 500 (server error)
- All monetary values are in INR as integers (no decimals for Phase 2)
- All percentage values are integers (20, 45, 80 — not 0.20, 0.45, 0.80)
- **API contract precedence rule:** If this section conflicts with a screen-by-screen JSON example later in the document, the later example is authoritative. Do NOT invent a new response wrapper during implementation.
- Protected endpoints must return `401` if the JWT is missing or invalid. Do not return `200` with an error object for auth failures.
- `404` is for missing resources, `409` is for duplicate/idempotency conflicts, and `400` is for validation failures.

### 2.4 Database

- Host: Supabase project (shared credentials in team)
- All tables use `id` as UUID primary key (use `gen_random_uuid()` default)
- All tables have `created_at` timestamp with default `now()`
- Use Supabase JS client from Node.js backend
- Do NOT access Supabase directly from Flutter — all DB access goes through the Node.js API

### 2.5 Environment Variables (shared .env)

```
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

# Auth
JWT_SECRET=xxx

# Open-Meteo (no key needed, but base URLs)
OPEN_METEO_WEATHER_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_AQI_URL=https://air-quality-api.open-meteo.com/v1/air-quality
OPEN_METEO_HISTORICAL_URL=https://archive-api.open-meteo.com/v1/archive

# ML Service
ML_SERVICE_URL=http://localhost:8000

# Server
PORT=3000
NODE_ENV=development
```

### 2.6 Project Structure

```
shiftshield/
├── app/                          # Flutter app (Person A)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/
│   │   │   ├── login_screen.dart
│   │   │   ├── onboarding_screen.dart
│   │   │   ├── quote_screen.dart
│   │   │   ├── buy_policy_screen.dart
│   │   │   ├── dashboard_screen.dart
│   │   │   ├── claims_screen.dart
│   │   │   ├── wallet_screen.dart
│   │   │   └── profile_screen.dart
│   │   ├── services/
│   │   │   └── api_service.dart
│   │   ├── models/
│   │   └── widgets/
│   └── pubspec.yaml
│
├── backend/                      # Node.js API (Person B + C)
│   ├── src/
│   │   ├── index.js              # Express app entry
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT verification middleware
│   │   ├── routes/
│   │   │   ├── auth.js           # Person B
│   │   │   ├── riders.js         # Person B
│   │   │   ├── zones.js          # Person B
│   │   │   ├── policies.js       # Person B
│   │   │   ├── quotes.js         # Person C
│   │   │   ├── claims.js         # Whoever finishes first
│   │   │   ├── wallet.js         # Person B
│   │   │   ├── mock-platform.js  # Person B
│   │   │   └── admin.js          # Person C (simulate-trigger)
│   │   ├── services/
│   │   │   ├── trigger-monitor.js    # Person C
│   │   │   ├── claims-engine.js      # B or C (whoever finishes first)
│   │   │   ├── fraud-checker.js      # B or C
│   │   │   └── wallet-service.js     # Person B
│   │   ├── cron/
│   │   │   ├── trigger-cron.js       # Person C
│   │   │   └── policy-lifecycle.js   # Person B
│   │   └── utils/
│   │       ├── supabase.js
│   │       └── time.js               # IST conversion helpers
│   ├── seed/
│   │   ├── zones.json
│   │   └── mock-riders.json
│   ├── package.json
│   └── .env
│
├── ml-service/                   # Python FastAPI (Person C)
│   ├── main.py
│   ├── model/
│   │   ├── train.py              # Synthetic data + XGBoost training
│   │   ├── predict.py            # Prediction logic
│   │   └── premium_model.joblib  # Saved model
│   ├── data/
│   │   └── generate_synthetic.py
│   ├── requirements.txt
│   └── .env
│
└── README.md
```

### 2.7 Local Run Order and Health Checks

To avoid "works on my machine" failures, everyone uses this same startup order:

1. Start Supabase and apply schema
2. Seed `zones` and `mock_platform_riders`
3. Start ML service on port `8000`
4. Start backend on port `3000`
5. Start Flutter app

Required lightweight health endpoints:

- `GET /health` on backend returns:
  - `{ "status": "ok", "service": "backend" }`
- `GET /health` on ML service returns:
  - `{ "status": "ok", "service": "ml", "model_loaded": true }`

Before any integration handoff, verify both health endpoints manually.

---

## 3. Database Schema

Create these tables in Supabase. All three people must use the same schema.

```sql
-- Zones (pre-seeded, read-only)
CREATE TABLE zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT NOT NULL,
    risk_class TEXT NOT NULL CHECK (risk_class IN ('low', 'medium', 'high')),
    lat DECIMAL(8,4) NOT NULL,
    lng DECIMAL(8,4) NOT NULL,
    avg_lunch_earnings INTEGER NOT NULL DEFAULT 400,
    avg_dinner_earnings INTEGER NOT NULL DEFAULT 650
);

-- Riders
CREATE TABLE riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    platform TEXT CHECK (platform IN ('swiggy', 'zomato')),
    zone_id TEXT REFERENCES zones(id),
    shifts_covered TEXT CHECK (shifts_covered IN ('lunch', 'dinner', 'both')),
    payout_preference TEXT DEFAULT 'wallet' CHECK (payout_preference IN ('wallet', 'direct')),
    upi_id TEXT,
    lunch_baseline INTEGER,
    dinner_baseline INTEGER,
    last_app_active TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Wallets
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID UNIQUE REFERENCES riders(id) NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Wallet Transactions
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID REFERENCES wallets(id) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit_payout', 'debit_premium', 'credit_topup', 'debit_withdrawal')),
    amount INTEGER NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Policy Quotes
CREATE TABLE policy_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES riders(id) NOT NULL,
    zone_id TEXT REFERENCES zones(id) NOT NULL,
    week_start DATE NOT NULL,
    shifts_covered TEXT NOT NULL,
    risk_score DECIMAL(4,2),
    risk_band TEXT,
    premium INTEGER NOT NULL,
    payout_cap INTEGER,
    explanation_json JSONB,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly Policies
CREATE TABLE weekly_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES riders(id) NOT NULL,
    quote_id UUID REFERENCES policy_quotes(id),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    shifts_covered TEXT NOT NULL,
    premium_paid INTEGER NOT NULL,
    payout_cap INTEGER NOT NULL,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(rider_id, week_start)
);

-- Trigger Events
CREATE TABLE trigger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id TEXT REFERENCES zones(id) NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('rain', 'heat', 'aqi')),
    severity_level INTEGER NOT NULL CHECK (severity_level BETWEEN 1 AND 4),
    payout_percent INTEGER NOT NULL CHECK (payout_percent BETWEEN 20 AND 80),
    shift_type TEXT NOT NULL CHECK (shift_type IN ('lunch', 'dinner')),
    condition_a_data JSONB NOT NULL,
    condition_b_data JSONB NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Claims
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES riders(id) NOT NULL,
    policy_id UUID REFERENCES weekly_policies(id) NOT NULL,
    trigger_event_id UUID REFERENCES trigger_events(id) NOT NULL,
    shift_type TEXT NOT NULL,
    claim_date DATE NOT NULL,
    baseline_used INTEGER NOT NULL,
    payout_percent INTEGER NOT NULL,
    payout_amount INTEGER NOT NULL,
    status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'under_review', 'rejected')),
    fraud_flag BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(policy_id, shift_type, claim_date)
);

-- Mock Platform Riders (pre-seeded)
CREATE TABLE mock_platform_riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    zone_id TEXT REFERENCES zones(id),
    rider_status TEXT DEFAULT 'active',
    avg_lunch_earnings INTEGER,
    avg_dinner_earnings INTEGER,
    active_days_per_week INTEGER DEFAULT 6,
    last_active TIMESTAMPTZ,
    account_age_months INTEGER
);
```

### Required Indexes

Apply these indexes immediately after table creation:

```sql
CREATE INDEX idx_riders_zone_id ON riders(zone_id);
CREATE INDEX idx_wallet_transactions_wallet_created_at ON wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX idx_policy_quotes_rider_week_start ON policy_quotes(rider_id, week_start);
CREATE INDEX idx_weekly_policies_status_week_start ON weekly_policies(status, week_start);
CREATE INDEX idx_weekly_policies_rider_created_at ON weekly_policies(rider_id, created_at DESC);
CREATE INDEX idx_trigger_events_zone_detected_at ON trigger_events(zone_id, detected_at DESC);
CREATE INDEX idx_claims_rider_created_at ON claims(rider_id, created_at DESC);
CREATE INDEX idx_claims_policy_claim_date ON claims(policy_id, claim_date);
CREATE INDEX idx_mock_platform_riders_zone_id ON mock_platform_riders(zone_id);
```

### Transaction and Idempotency Rules

These are mandatory. If any team member violates them, wallet and claims data will drift.

- Claim creation plus wallet credit must happen in a single transaction-like unit. Never create a `paid` claim and then fail to credit the wallet.
- Premium purchase plus wallet debit must happen in a single transaction-like unit. Never create a policy if the debit failed.
- The DB constraint `UNIQUE(policy_id, shift_type, claim_date)` is the final idempotency guard for repeated trigger-cron runs.
- If a duplicate claim insert is attempted because the cron ran again, treat that as a no-op and log it. Do not surface it as a user-visible error.

### Seed Data

**zones.json** — Insert at project setup:

```json
[
    {"id": "koramangala", "name": "Koramangala", "pin": "560034", "risk_class": "medium", "lat": 12.9352, "lng": 77.6245, "avg_lunch_earnings": 420, "avg_dinner_earnings": 680},
    {"id": "indiranagar", "name": "Indiranagar", "pin": "560038", "risk_class": "low", "lat": 12.9784, "lng": 77.6408, "avg_lunch_earnings": 450, "avg_dinner_earnings": 720},
    {"id": "hsr_layout", "name": "HSR Layout", "pin": "560102", "risk_class": "medium", "lat": 12.9116, "lng": 77.6474, "avg_lunch_earnings": 380, "avg_dinner_earnings": 620},
    {"id": "whitefield", "name": "Whitefield", "pin": "560066", "risk_class": "high", "lat": 12.9698, "lng": 77.7500, "avg_lunch_earnings": 350, "avg_dinner_earnings": 580},
    {"id": "electronic_city", "name": "Electronic City", "pin": "560100", "risk_class": "high", "lat": 12.8399, "lng": 77.6770, "avg_lunch_earnings": 330, "avg_dinner_earnings": 560}
]
```

---

## 4. Trigger Logic — CANONICAL DEFINITION

Everyone must implement triggers against this exact spec.

### Step 1: Eligibility Gate

A payout event is ELIGIBLE only when BOTH conditions are met:

**Condition A — External Disruption (at least ONE must be true):**

| Trigger | Threshold | Persistence Required |
|---|---|---|
| Heavy Rain | Precipitation >= 15 mm/hr | Sustained for >= 30 min (2 consecutive 15-min checks) |
| Extreme Heat | Apparent temperature >= 42°C | Sustained for >= 2 hours (8 consecutive 15-min checks) |
| Severe AQI | US AQI >= 301 | Sustained for >= 1 hour (4 consecutive 15-min checks) |

**Condition B — Market Activity Validation (at least TWO of THREE must be true):**

| Proxy | Threshold | Source |
|---|---|---|
| Traffic density drop | >= 40% below zone normal | Mock Platform API |
| Restaurant availability drop | >= 30% below zone normal | Mock Platform API |
| Active rider count drop | >= 35% below zone normal | Mock Platform API |

```
IF Condition_A == TRUE AND count(Condition_B_confirmed) >= 2:
    → ELIGIBLE → proceed to severity
ELSE:
    → NOT ELIGIBLE → no payout
```

### Step 2: Severity Classification (AFTER eligibility is confirmed)

Severity is determined by the STRENGTH of Condition A and how many Condition B proxies confirmed:

| Level | Condition A Strength | Condition B | Payout % Range |
|---|---|---|---|
| Level 1 | At threshold (e.g., rain 15-20mm, AQI 301-350, temp 42-43°C) | 2 of 3 confirmed | 20–35% |
| Level 2 | Moderate above threshold (rain 20-30mm, AQI 350-400, temp 43-45°C) | 2 of 3 confirmed | 36–55% |
| Level 3 | Strong (rain 30-50mm, AQI 400-450, temp 45-47°C) | 3 of 3 confirmed | 56–70% |
| Level 4 | Extreme (rain >50mm, AQI >450, temp >47°C) | 3 of 3 confirmed | 71–80% |

**Payout calculation:**

```
IF shift_type == "lunch":
    payout_amount = rider.lunch_baseline × (payout_percent / 100)
IF shift_type == "dinner":
    payout_amount = rider.dinner_baseline × (payout_percent / 100)
```

### Step 3: Idempotency Rule

**One rider cannot receive more than one payout for the same policy_id + shift_type + calendar_date.**

The claims table has a UNIQUE constraint on `(policy_id, shift_type, claim_date)`. If the trigger monitor fires again at the next 15-minute interval for the same ongoing event, the INSERT will fail on the unique constraint, and the system skips silently. This is correct behavior.

### Anti-Adverse-Selection Rule

Policy purchase is blocked if an eligible disruption event is already active in the rider's zone at the time of purchase. Check:

```sql
SELECT COUNT(*) FROM trigger_events
WHERE zone_id = :zone_id
AND detected_at > now() - interval '2 hours'
```

If count > 0, reject purchase with: `"An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."`

---

## 5. Fraud Check Pipeline — CANONICAL DEFINITION

Run in order. If any HARD check fails, claim is not created. If any SOFT check fails, claim is created with `status: 'under_review'`.

**HARD checks (must pass):**

| # | Check | Logic |
|---|---|---|
| 1 | Active policy | `policy.status == 'active'` AND `policy.week_start <= today <= policy.week_end` |
| 2 | Shift match | `policy.shifts_covered` includes current shift type |
| 3 | Zone match | `rider.zone_id == trigger_event.zone_id` |
| 4 | Duplicate check | No existing claim with same `policy_id + shift_type + claim_date` |

**SOFT checks (flag for review if failed):**

| # | Check | Logic |
|---|---|---|
| 5 | Recent app activity | `rider.last_app_active` is within last 24 hours |
| 6 | Platform active | Mock platform rider `last_active` is within last 48 hours |

```
If checks 1-4 ALL pass AND checks 5-6 ALL pass:
    → claim.status = 'paid'
    → credit wallet immediately

If checks 1-4 ALL pass BUT check 5 OR 6 fails:
    → claim.status = 'under_review'
    → claim.fraud_flag = true
    → do NOT credit wallet
    → notify rider: "Payout verification in progress"

If ANY of checks 1-4 fails:
    → no claim created
```

---

## 6. Work Assignment

### Person A — Frontend (Flutter)

**Owns:** All Flutter screens, API client, state management, UI/UX.

**Does NOT touch:** Backend code, database, ML service.

**Depends on:** API contracts defined in Section 8 of this document. Build against these payloads. If backend isn't ready, mock the responses locally in Flutter.

### Person B — Backend: Auth, Profile, Policy, Wallet, Mock Platform

**Owns:**
- Auth endpoints (send-otp, verify-otp, JWT generation)
- Rider profile CRUD
- Zone endpoints
- Mock Platform API (seed data + endpoints)
- Policy service (create, current, history, renew)
- Wallet service (balance, transactions, credit, debit, topup, withdraw)
- Policy lifecycle crons (activate on Monday, expire on Monday)
- Wallet-based premium payment flow

**Does NOT touch:** ML service, trigger monitor, Open-Meteo integration.

### Person C — Backend: Premium Engine, Trigger Monitor, ML Service

**Owns:**
- Python FastAPI ML service (XGBoost training + /premium/predict endpoint)
- Synthetic training data generation (historical Open-Meteo data → simulated claims)
- Quote generation endpoint in Node.js (calls ML service)
- Trigger monitor cron job (Open-Meteo polling, Condition A/B evaluation)
- Trigger simulation endpoint (POST /api/admin/simulate-trigger)
- Open-Meteo integration (weather + AQI)

**Does NOT touch:** Auth, rider profiles, wallet implementation, policy CRUD.

### Claims Management — First to Finish (B or C)

Whoever finishes their primary work first builds:
- Claims engine (trigger event → find policies → fraud check → create claim → credit wallet → notify)
- Claims endpoints (GET /api/claims, GET /api/claims/:id)
- This service wires together: trigger events (C's work) + policy lookup (B's work) + wallet credit (B's work)

### Integration responsibility:
- **Person B** is responsible for the shared Express app setup, middleware, Supabase client, and project structure.
- **Person C** plugs their routes into Person B's Express app.
- **Person A** builds against the API contracts and flags any payload mismatches.

---

## 7. Detailed Spec — Person A (Frontend / Flutter)

### Screen List and Priority

| # | Screen | Priority | Depends On (API) |
|---|---|---|---|
| 1 | Login (OTP) | P0 | POST /api/auth/send-otp, POST /api/auth/verify-otp |
| 2 | Onboarding | P0 | GET /api/zones, GET /api/mock-platform/rider/:phone, POST /api/riders/profile |
| 3 | Quote | P0 | POST /api/quotes/generate |
| 4 | Buy Policy | P0 | POST /api/policies/create |
| 5 | Dashboard | P0 | GET /api/dashboard |
| 6 | Claims History | P1 | GET /api/claims |
| 7 | Wallet | P1 | GET /api/wallet, POST /api/wallet/topup, POST /api/wallet/withdraw |
| 8 | Profile/Settings | P2 | GET /api/riders/me, PUT /api/riders/me |

### Navigation Structure

```
Bottom Nav Bar (4 tabs):
├── Dashboard (Screen 5 — home)
├── Claims (Screen 6)
├── Wallet (Screen 7)
└── Profile (Screen 8)

Login (Screen 1) → Onboarding (Screen 2) → Quote (Screen 3) → Buy (Screen 4) → Dashboard (Screen 5)
```

### Screen 1: Login

**UI Elements:**
- Phone number input (10 digits, Indian format)
- "Send OTP" button
- OTP input (4 digits)
- "Verify" button

**API calls:**
```
POST /api/auth/send-otp
Body: { "phone": "9876543210" }
Response: { "success": true, "message": "OTP sent", "expires_in_seconds": 300 }

POST /api/auth/verify-otp
Body: { "phone": "9876543210", "otp": "1234" }
Response: {
    "token": "jwt_token_here",
    "is_new_user": true,        // → navigate to Onboarding
    "rider": null                // null for new users
}
-- OR --
Response: {
    "token": "jwt_token_here",
    "is_new_user": false,        // → navigate to Dashboard
    "rider": { ...full rider object... }
}
```

**Logic:**
- Store JWT in secure storage (flutter_secure_storage)
- If `is_new_user == true` → navigate to Onboarding
- If `is_new_user == false` → navigate to Dashboard
- Include JWT in all subsequent API calls as `Authorization: Bearer <token>`

### Screen 2: Onboarding

**UI Elements:**
- Name text input
- Platform selector: toggle between "Swiggy" and "Zomato"
- Zone dropdown (populated from GET /api/zones)
- Shift selector: "Lunch" / "Dinner" / "Both" (toggle buttons)
- Payout preference: "Wallet" / "Direct to UPI" (toggle)
- UPI ID input (visible only if "Direct" selected)
- Earnings baseline display (fetched from mock platform, rider can confirm)
- "Complete Setup" button

**API calls:**
```
GET /api/zones
Response: {
    "zones": [
        { "id": "koramangala", "name": "Koramangala", "pin": "560034", "risk_class": "medium", "lat": 12.9352, "lng": 77.6245 },
        ...
    ]
}

GET /api/mock-platform/rider/:phone
Response: {
    "found": true,
    "platform": "swiggy",
    "avg_lunch_earnings": 420,
    "avg_dinner_earnings": 680,
    ...
}
-- OR --
Response: {
    "found": false,
    "message": "Rider not found. Earnings baseline will use zone average."
}

POST /api/riders/profile
Body: {
    "name": "Arjun",
    "platform": "swiggy",
    "zone_id": "koramangala",
    "shifts_covered": "both",
    "payout_preference": "wallet",
    "upi_id": null,
    "lunch_baseline": 420,
    "dinner_baseline": 680
}
Response: {
    "rider": { ...full rider object... },
    "wallet": { "id": "wallet_xyz", "balance": 0, "currency": "INR" }
}
```

**Logic:**
- On platform selection, auto-fetch mock platform data using rider's phone from JWT
- If mock platform returns `found: false`, use zone's avg_lunch_earnings and avg_dinner_earnings as defaults
- Rider can manually override earnings baseline values
- On "Complete Setup": create profile, get wallet, navigate to Quote screen

### Screen 3: Quote

**UI Elements:**
- Large premium number: "₹52 / week"
- Risk band badge: Low (green) / Medium (amber) / High (red)
- Explanation card showing top risk factors with contribution bars
- Coverage breakdown: "12 shifts protected (6 lunch + 6 dinner)"
- Payout range: "₹84 – ₹544 per shift depending on severity"
- Purchase deadline countdown timer
- "Buy Policy" button (primary CTA)
- "Buy Policy" disabled with message if `can_purchase == false`

**API call:**
```
POST /api/quotes/generate
Headers: { Authorization: Bearer <token> }
Body: { "week_start": "2026-04-06" }   // next Monday's date
Response: {
    "quote": {
        "id": "quote_q1a2b3",
        "zone_id": "koramangala",
        "zone_name": "Koramangala",
        "week_start": "2026-04-06",
        "week_end": "2026-04-12",
        "shifts_covered": "both",
        "risk_score": 0.62,
        "risk_band": "medium",
        "premium": 52,
        "payout_cap": 2400,
        "lunch_shift_max_payout": 336,
        "dinner_shift_max_payout": 544,
        "explanation": {
            "top_factors": [
                { "factor": "AQI forecast", "contribution_pct": 48, "detail": "3 evenings predicted AQI above 280" },
                { "factor": "Rain probability", "contribution_pct": 31, "detail": "65% chance of heavy rain Thursday" },
                { "factor": "Historical triggers", "contribution_pct": 14, "detail": "2 triggers in last 4 weeks" }
            ],
            "summary": "Medium risk this week. Elevated AQI evenings and moderate rain probability."
        },
        "coverage_breakdown": {
            "lunch_shifts": 6,
            "dinner_shifts": 6,
            "total_protected_shifts": 12,
            "lunch_baseline_per_shift": 420,
            "dinner_baseline_per_shift": 680,
            "min_payout_pct": 20,
            "max_payout_pct": 80
        },
        "can_purchase": true,
        "purchase_deadline": "2026-04-05T23:59:00+05:30"
    }
}
```

**Logic:**
- `week_start` should be the next upcoming Monday
- Show risk factor contributions as horizontal progress bars
- Show payout range: min = lunch_baseline × 0.20, max = dinner_baseline × 0.80
- If `can_purchase == false`, disable button and show reason

### Screen 4: Buy Policy

**UI Elements:**
- Confirmation card: "Confirm purchase for Apr 6 – Apr 12?"
- Premium: "₹52"
- Payment method: "From wallet (balance: ₹408)" or "Direct payment (simulated)"
- "Confirm" button
- Success state: green checkmark, "Policy scheduled for Apr 6 – Apr 12"

**API call:**
```
POST /api/policies/create
Headers: { Authorization: Bearer <token> }
Body: {
    "quote_id": "quote_q1a2b3",
    "payment_method": "wallet"
}
Response (success): {
    "policy": {
        "id": "policy_p4d5e6",
        "week_start": "2026-04-06",
        "week_end": "2026-04-12",
        "shifts_covered": "both",
        "premium_paid": 52,
        "payout_cap": 2400,
        "status": "scheduled",
        "created_at": "2026-04-04T14:00:00Z"
    },
    "wallet": {
        "id": "wallet_xyz",
        "balance": 356,
        "previous_balance": 408
    },
    "transaction": {
        "id": "txn_t7f8g9",
        "type": "debit_premium",
        "amount": -52,
        "description": "Weekly premium — Koramangala — Apr 6 to Apr 12"
    }
}

Response (insufficient balance): {
    "error": "insufficient_balance",
    "wallet_balance": 30,
    "premium_required": 52,
    "shortfall": 22,
    "message": "Insufficient wallet balance. Please top up ₹22 or choose direct payment."
}

Response (disruption active): {
    "error": "disruption_active",
    "message": "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."
}
```

### Screen 5: Dashboard (Main Screen)

**UI Elements:**
- Header: rider name + zone name + wallet balance chip
- Policy status card:
  - "Scheduled" (yellow) if upcoming week
  - "Active" (green) if current week
  - "No active policy" (grey) with "Get a quote" button
- Live zone weather strip: current temp, AQI, rain — color coded:
  - Green: below 70% of threshold
  - Orange: 70-99% of threshold
  - Red: threshold breached
- Upcoming risk alert if available (from quote explanation)
- Shifts remaining grid (visual: lunch/dinner × Mon-Sat, greyed out if claimed)
- Recent claims list (last 3, expandable)
- "Renew for next week" button

**API call:**
```
GET /api/dashboard
Headers: { Authorization: Bearer <token> }
Response: {
    "rider": {
        "name": "Arjun",
        "zone_name": "Koramangala",
        "platform": "swiggy"
    },
    "wallet": {
        "balance": 356
    },
    "current_policy": {
        "id": "policy_p4d5e6",
        "week_start": "2026-03-30",
        "week_end": "2026-04-05",
        "status": "active",
        "premium_paid": 52,
        "shifts_covered": "both",
        "shifts_remaining": { "lunch": 4, "dinner": 5 },
        "claims_this_week": 1,
        "total_payout_this_week": 408
    },
    "zone_weather": {
        "current_temp": 34.2,
        "current_aqi": 187,
        "current_rain_mm": 0,
        "status": "normal",
        "last_updated": "2026-03-31T19:30:00Z"
    },
    "recent_claims": [
        {
            "id": "claim_c1d2e3",
            "shift_type": "dinner",
            "trigger_type": "aqi",
            "severity_level": 2,
            "payout_percent": 45,
            "payout_amount": 306,
            "status": "paid",
            "created_at": "2026-03-31T20:15:00Z"
        }
    ],
    "next_week_quote_available": true
}
```

**Logic:**
- If `current_policy` is null, show "No active policy" card with CTA to quote screen
- If `next_week_quote_available` is true and current policy is about to expire, show renewal prompt
- Refresh this screen on every tab switch (pull fresh wallet balance)
- zone_weather.status values: "normal", "elevated", "threshold_breached"

### Screen 6: Claims History

**UI Elements:**
- Summary card: total claims, total payout, total premiums paid, net benefit
- List of claim cards, each showing:
  - Trigger icon (rain droplet / sun / smoke cloud)
  - Date and shift type: "Mar 31 — Dinner Shift"
  - Trigger detail: "AQI reached 342 in Koramangala"
  - Condition B validation: checkmarks for confirmed proxies, X for unconfirmed
  - Payout: "₹306 (45% of ₹680)"
  - Status badge: Paid (green) / Under Review (orange) / Rejected (red)

**API call:**
```
GET /api/claims
Headers: { Authorization: Bearer <token> }
Response: {
    "claims": [
        {
            "id": "claim_c1d2e3",
            "policy_id": "policy_p4d5e6",
            "shift_type": "dinner",
            "claim_date": "2026-03-31",
            "trigger_type": "aqi",
            "trigger_detail": {
                "aqi_value": 342,
                "threshold": 301,
                "duration_minutes": 135,
                "zone_name": "Koramangala"
            },
            "condition_b": {
                "traffic_drop": { "confirmed": true, "drop_pct": 47 },
                "restaurant_drop": { "confirmed": true, "drop_pct": 38 },
                "rider_count_drop": { "confirmed": false, "drop_pct": 22 }
            },
            "severity_level": 2,
            "payout_percent": 45,
            "baseline_used": 680,
            "payout_amount": 306,
            "status": "paid",
            "fraud_flag": false,
            "created_at": "2026-03-31T20:15:00Z"
        }
    ],
    "summary": {
        "total_claims": 3,
        "total_payout": 894,
        "total_premiums_paid": 156,
        "net_benefit": 738
    }
}
```

### Screen 7: Wallet

**UI Elements:**
- Large balance display: "₹356"
- Two buttons: "Top Up" | "Withdraw to UPI"
- Transaction list (paginated):
  - Green (+) for credit_payout, credit_topup
  - Red (-) for debit_premium, debit_withdrawal
  - Each row: amount, description, timestamp

**API calls:**
```
GET /api/wallet
Headers: { Authorization: Bearer <token> }
Response: {
    "wallet": { "id": "wallet_xyz", "balance": 356, "currency": "INR" },
    "transactions": [
        { "id": "txn_1", "type": "credit_payout", "amount": 306, "description": "AQI trigger — dinner shift Mar 31", "created_at": "2026-03-31T20:16:00Z" },
        { "id": "txn_2", "type": "debit_premium", "amount": -52, "description": "Weekly premium — Mar 30 to Apr 5", "created_at": "2026-03-28T14:00:00Z" },
        { "id": "txn_3", "type": "credit_topup", "amount": 500, "description": "Manual top-up (demo)", "created_at": "2026-03-25T09:00:00Z" }
    ],
    "pagination": { "page": 1, "total_pages": 2, "has_more": true }
}

POST /api/wallet/topup
Body: { "amount": 200 }
Response: {
    "wallet": { "balance": 556 },
    "transaction": { "id": "txn_4", "type": "credit_topup", "amount": 200, "description": "Manual top-up (demo)" }
}

POST /api/wallet/withdraw
Body: { "amount": 200 }
Response: {
    "wallet": { "balance": 156 },
    "transaction": { "id": "txn_5", "type": "debit_withdrawal", "amount": -200, "description": "Withdrawal to UPI (processing)" },
    "withdrawal_status": "processing",
    "expected_completion": "24-48 hours"
}
```

### Screen 8: Profile / Settings

**UI Elements:**
- Name (read-only)
- Phone (read-only)
- Platform (read-only)
- Zone (editable only between coverage weeks)
- Shift preference (editable)
- Payout preference toggle (wallet / direct)
- UPI ID (editable)
- Earnings baseline (lunch / dinner — read-only, set at onboarding)
- "Save Changes" button

**API calls:**
```
GET /api/riders/me
PUT /api/riders/me
Body (partial): { "payout_preference": "direct", "upi_id": "arjun@upi" }
Response: { "rider": { ...updated rider... } }
```

### Flutter Implementation Notes for Person A

- **State management:** Use Provider or Riverpod. Keep it simple — no complex architectures.
- **API client:** Create a single `ApiService` class that handles:
  - Base URL configuration
  - JWT attachment to all requests
  - Error response parsing
  - Mock response mode (for when backend isn't ready)
- **Color scheme:**
  - Primary: deep blue (#1A237E or similar)
  - Success/payout: green (#4CAF50)
  - Warning/elevated: amber (#FFC107)
  - Danger/breach: red (#F44336)
  - Background: white/light grey
- **Update `rider.last_app_active`:** On every API call from Flutter, the backend middleware should update the rider's `last_app_active` field. Person A does not need to do anything special — the backend handles this.
- **Mock mode:** If the backend isn't available, Person A should have a `USE_MOCK` flag that returns hardcoded JSON responses matching the contracts above. This unblocks frontend development completely.

---

## 8. Detailed Spec — Person B (Auth, Profile, Policy, Wallet, Mock Platform)

### What Person B Builds

```
Routes:
  POST /api/auth/send-otp
  POST /api/auth/verify-otp
  POST /api/riders/profile
  GET  /api/riders/me
  PUT  /api/riders/me
  GET  /api/zones
  GET  /api/dashboard
  POST /api/policies/create
  GET  /api/policies/current
  GET  /api/policies/history
  GET  /api/wallet
  GET  /api/wallet/transactions
  POST /api/wallet/topup
  POST /api/wallet/withdraw
  GET  /api/mock-platform/rider/:phone
  GET  /api/mock-platform/zone/:zoneId/activity
  GET  /api/mock-platform/zone/:zoneId/current

Services:
  wallet-service.js (credit, debit, get balance)

Cron jobs:
  policy-lifecycle.js
    - Monday 00:05 IST: activate scheduled policies
    - Monday 00:10 IST: expire last week's active policies

Shared setup:
  Express app initialization
  Auth middleware (JWT verify)
  Supabase client helper
  Time utilities (IST conversion)
  Seed script for zones and mock riders
```

### Auth Implementation

```javascript
// POST /api/auth/send-otp
// For Phase 2: hardcode OTP as "1234" for all numbers
// Store phone → OTP mapping in memory (Map object)
// Return success

// POST /api/auth/verify-otp
// Validate OTP matches stored value (or just accept "1234")
// Check if rider exists in DB by phone
// Generate JWT with rider_id (or phone if new user)
// Return { token, is_new_user, rider }
```

### Rider Profile Implementation

```javascript
// POST /api/riders/profile
// Extract phone from JWT
// Validate: zone_id exists, shifts_covered is valid, platform is valid
// If lunch_baseline or dinner_baseline not provided:
//   → Use zone.avg_lunch_earnings and zone.avg_dinner_earnings
// INSERT into riders table
// CREATE wallet with balance 0
// Return rider + wallet

// GET /api/riders/me
// Extract rider_id from JWT
// SELECT from riders + join wallet balance
// Return rider object

// PUT /api/riders/me
// Partial update — only update fields that are provided
// Cannot change: phone, name (after initial set)
// Zone change: only allowed if no active policy exists
```

### Policy Service Implementation

```javascript
// POST /api/policies/create
// Extract rider_id from JWT
// Validate: quote_id exists, quote hasn't expired
// Validate: purchase window is open
//   → Get week_start from quote. purchase_deadline = week_start - 1 day (Saturday 23:59 IST)
//   → If now > purchase_deadline → reject
// Validate: no active disruption in rider's zone (anti-adverse selection)
//   → SELECT from trigger_events WHERE zone_id = rider.zone_id AND detected_at > now() - 2 hours
//   → If count > 0 → reject
// Validate: no existing policy for this rider + week_start
// Payment:
//   IF payment_method == "wallet":
//     → Call wallet-service.debit(wallet_id, premium, 'debit_premium', policy_id, description)
//     → If insufficient balance → return 400
//   IF payment_method == "direct":
//     → Accept (mock — just record it)
// INSERT weekly_policy with status 'scheduled'
// Return policy + wallet + transaction

// GET /api/policies/current
// Find policy where week_start <= today <= week_end AND status IN ('scheduled', 'active')
// Return or null

// GET /api/policies/history
// All policies for rider, ordered by week_start DESC
// Paginated (limit 20, offset)
```

### Wallet Service Implementation

```javascript
// wallet-service.js

async function getWallet(riderId) {
    // SELECT from wallets WHERE rider_id = riderId
    // Return { id, balance, currency: "INR" }
}

async function getTransactions(walletId, page = 1, limit = 20) {
    // SELECT from wallet_transactions WHERE wallet_id = walletId
    // ORDER BY created_at DESC
    // LIMIT/OFFSET pagination
}

async function credit(walletId, amount, type, referenceType, referenceId, description) {
    // BEGIN TRANSACTION (use Supabase RPC or sequential queries)
    // UPDATE wallets SET balance = balance + amount, updated_at = now()
    //   WHERE id = walletId
    // INSERT wallet_transactions
    // SELECT new balance (read after write — authoritative)
    // COMMIT
    // Return { new_balance, transaction }
}

async function debit(walletId, amount, type, referenceType, referenceId, description) {
    // SELECT balance FROM wallets WHERE id = walletId
    // IF balance < amount → throw InsufficientBalanceError
    // UPDATE wallets SET balance = balance - amount, updated_at = now()
    //   WHERE id = walletId AND balance >= amount
    //   (the WHERE balance >= amount is a safety net against race conditions)
    // IF rows_affected == 0 → throw InsufficientBalanceError (race condition caught)
    // INSERT wallet_transactions
    // SELECT new balance (authoritative read)
    // COMMIT
    // Return { new_balance, transaction }
}
```

**CRITICAL: Always read balance from DB after mutation. Never return a calculated value.**

### Mock Platform API Implementation

```javascript
// Seed: 50-100 riders in mock_platform_riders table, spread across 5 zones
// Each has realistic earnings, status, last_active

// GET /api/mock-platform/rider/:phone
// Lookup in mock_platform_riders by phone
// If found → return rider data
// If not found → return { found: false }

// GET /api/mock-platform/zone/:zoneId/activity
// Return NORMAL baseline for this zone at current hour
// Hardcoded per zone:
//   koramangala:   { normal_active_riders: 180, normal_restaurant_count: 94, normal_traffic_score: 72 }
//   indiranagar:   { normal_active_riders: 150, normal_restaurant_count: 78, normal_traffic_score: 68 }
//   hsr_layout:    { normal_active_riders: 130, normal_restaurant_count: 65, normal_traffic_score: 60 }
//   whitefield:    { normal_active_riders: 110, normal_restaurant_count: 55, normal_traffic_score: 55 }
//   electronic_city: { normal_active_riders: 90, normal_restaurant_count: 42, normal_traffic_score: 50 }

// GET /api/mock-platform/zone/:zoneId/current
// KEY BEHAVIOR: This endpoint simulates market degradation during disruptions
//
// Check if there's an active Condition A trigger for this zone:
//   SELECT from trigger_events WHERE zone_id = zoneId AND detected_at > now() - interval '2 hours'
//
// IF active trigger exists:
//   Degrade values based on trigger severity:
//     Level 1-2: multiply normal by random(0.55, 0.65) → 35-45% drop
//     Level 3-4: multiply normal by random(0.35, 0.50) → 50-65% drop
//   Return degraded values
//
// ELSE:
//   Return normal values with ±5% random noise
//   (small natural variation to look realistic)
```

### Dashboard Aggregation

```javascript
// GET /api/dashboard
// This is the most complex endpoint — Person B builds it after other endpoints are done
//
// 1. Get rider from JWT
// 2. Get wallet balance
// 3. Get current policy (scheduled or active for this week)
// 4. Get zone weather: call Open-Meteo for rider's zone lat/lng
//    (or use cached value if Person C has built a weather cache)
//    Fallback: return static "normal" status if Open-Meteo not integrated yet
// 5. Get recent claims (last 3) for this rider
// 6. Check if next week's quote is available (is today before Saturday 23:59?)
// 7. Calculate shifts remaining:
//    total shifts = 6 lunch + 6 dinner (Mon-Sat)
//    claimed shifts = COUNT claims this week grouped by shift_type
//    remaining = total - claimed
// 8. Assemble and return full dashboard response
```

### Policy Lifecycle Cron

```javascript
// Run via node-cron or Supabase scheduled function

// Monday 00:05 IST (Sunday 18:35 UTC):
// Activate this week's policies
// UPDATE weekly_policies SET status = 'active'
//   WHERE status = 'scheduled' AND week_start = today (Monday)

// Monday 00:10 IST (Sunday 18:40 UTC):
// Expire last week's policies
// UPDATE weekly_policies SET status = 'expired'
//   WHERE status = 'active' AND week_end < today
```

### Person B Seed Script

```javascript
// seed.js — Run once to populate DB

// 1. Insert 5 zones from zones.json
// 2. Insert 50-100 mock_platform_riders across 5 zones
//    Generate: random Indian names, phone numbers, realistic earnings per zone
//    Distribute: ~20 riders per zone
//    Swiggy/Zomato split: ~60/40
//    Lunch earnings: zone.avg_lunch_earnings ± 15% variation
//    Dinner earnings: zone.avg_dinner_earnings ± 15% variation
```

---

## 9. Detailed Spec — Person C (Premium Engine, Triggers, ML)

### What Person C Builds

```
Python FastAPI:
  POST /premium/predict

Node.js routes:
  POST /api/quotes/generate
  GET  /api/admin/simulate-trigger (demo endpoint)

Node.js services:
  trigger-monitor.js (cron every 15 min during shift windows)

Scripts:
  generate_synthetic.py (creates training data from historical weather)
  train.py (trains XGBoost model)
```

### ML Service — Synthetic Data Generation

```python
# generate_synthetic.py
#
# Step 1: Pull 2 years of historical hourly weather for each zone
#
# For each zone:
#   GET https://archive-api.open-meteo.com/v1/archive
#     ?latitude={lat}&longitude={lng}
#     &start_date=2024-04-01
#     &end_date=2026-03-31
#     &hourly=temperature_2m,apparent_temperature,precipitation,weather_code
#     &timezone=Asia/Kolkata
#
#   GET https://air-quality-api.open-meteo.com/v1/air-quality
#     ?latitude={lat}&longitude={lng}
#     &start_date=2024-04-01
#     &end_date=2026-03-31
#     &hourly=us_aqi,pm2_5,pm10
#     &timezone=Asia/Kolkata
#
# Step 2: For each zone × each day × each shift (lunch 11-15, dinner 18-23):
#   Extract:
#     max_apparent_temp_during_shift
#     max_precipitation_during_shift
#     max_aqi_during_shift
#     mean values for each
#
# Step 3: Simulate trigger events using Condition A thresholds:
#   rain_triggered = max_precipitation >= 15
#   heat_triggered = max_apparent_temp >= 42
#   aqi_triggered  = max_aqi >= 301
#   any_triggered = rain_triggered OR heat_triggered OR aqi_triggered
#
# Step 4: Simulate Condition B (probabilistic):
#   If any_triggered:
#     P(2+ proxies confirmed) = 0.75  (most real disruptions pass Condition B)
#     eligible = random() < 0.75
#   Else:
#     eligible = False
#
# Step 5: If eligible, simulate severity and claim cost:
#   severity_pct = map_severity(condition_a_strength)  # 20-80
#   claim_cost = severity_pct/100 × avg_shift_earnings_for_zone
#
# Step 6: Aggregate per zone per week per shift_type:
#   Features:
#     zone_id (encoded)
#     week_of_year
#     season (heat=1, monsoon=2, aqi_season=3, normal=0)
#     avg_max_temp_forecast (mean of daily max temps for the week)
#     avg_max_rain_forecast
#     avg_max_aqi_forecast
#     trigger_count_last_4_weeks
#     shift_type (0=lunch, 1=dinner)
#     earnings_baseline
#   Target:
#     expected_weekly_claim_cost
#
# Output: CSV with ~1040 rows (104 weeks × 5 zones × 2 shifts)
#         Save to data/synthetic_training_data.csv
```

### ML Service — Model Training

```python
# train.py

import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
import joblib
import json

df = pd.read_csv('data/synthetic_training_data.csv')

feature_cols = [
    'zone_encoded', 'week_of_year', 'season',
    'avg_max_temp', 'avg_max_rain', 'avg_max_aqi',
    'trigger_freq_4w', 'shift_type', 'earnings_baseline'
]

X = df[feature_cols]
y = df['expected_weekly_claim_cost']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = xgb.XGBRegressor(
    n_estimators=100,
    max_depth=5,
    learning_rate=0.1,
    random_state=42
)
model.fit(X_train, y_train)

preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
print(f"MAE: {mae}")

# Save model
joblib.dump(model, 'model/premium_model.joblib')

# Save feature importance for explainability
importance = dict(zip(feature_cols, model.feature_importances_.tolist()))
with open('model/feature_importance.json', 'w') as f:
    json.dump(importance, f)

print("Model saved.")
```

### ML Service — FastAPI Endpoint

```python
# main.py

from fastapi import FastAPI
import joblib
import httpx
import numpy as np
from datetime import datetime, timedelta

app = FastAPI()
model = joblib.load('model/premium_model.joblib')

LOADING_FACTOR = 0.35  # 35% for ops + reserves + margin

ZONE_ENCODING = {
    "koramangala": 0, "indiranagar": 1, "hsr_layout": 2,
    "whitefield": 3, "electronic_city": 4
}

ZONE_COORDS = {
    "koramangala": (12.9352, 77.6245),
    "indiranagar": (12.9784, 77.6408),
    "hsr_layout": (12.9116, 77.6474),
    "whitefield": (12.9698, 77.7500),
    "electronic_city": (12.8399, 77.6770)
}

def get_season(week_of_year):
    # Bengaluru seasons:
    # Monsoon: Jun-Sep (weeks 22-39)
    # Pre-monsoon heat: Mar-May (weeks 9-21)
    # Post-monsoon: Oct-Nov (weeks 40-48)
    # Winter/normal: Dec-Feb (weeks 49-52, 1-8)
    if 22 <= week_of_year <= 39: return 2   # monsoon
    elif 9 <= week_of_year <= 21: return 1  # heat
    elif 40 <= week_of_year <= 48: return 3 # post-monsoon
    else: return 0                           # normal

async def fetch_7day_forecast(zone_id):
    lat, lng = ZONE_COORDS[zone_id]

    # Weather forecast
    weather_url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lng}"
        f"&daily=temperature_2m_max,apparent_temperature_max,precipitation_sum,weather_code"
        f"&timezone=Asia/Kolkata&forecast_days=7"
    )

    # AQI forecast
    aqi_url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lng}"
        f"&hourly=us_aqi&timezone=Asia/Kolkata&forecast_days=7"
    )

    async with httpx.AsyncClient() as client:
        weather_resp = await client.get(weather_url)
        aqi_resp = await client.get(aqi_url)

    weather = weather_resp.json()
    aqi = aqi_resp.json()

    daily = weather.get("daily", {})
    avg_max_temp = np.mean(daily.get("apparent_temperature_max", [35]*7))
    avg_max_rain = np.mean(daily.get("precipitation_sum", [0]*7))

    hourly_aqi = aqi.get("hourly", {}).get("us_aqi", [50]*168)
    # Get daily max AQI (take max per 24-hour block)
    daily_max_aqi = []
    for i in range(7):
        day_aqi = hourly_aqi[i*24:(i+1)*24]
        daily_max_aqi.append(max(day_aqi) if day_aqi else 50)
    avg_max_aqi = np.mean(daily_max_aqi)

    return avg_max_temp, avg_max_rain, avg_max_aqi, daily

def compute_explanation(features, feature_names, forecast_data):
    # Simple feature importance-based explanation
    # For Phase 2: use raw feature values relative to thresholds
    explanations = []

    if features[4] > 10:  # avg_max_rain > 10mm
        explanations.append({
            "factor": "Rain forecast",
            "contribution_pct": 0,  # will be normalized
            "detail": f"Average daily precipitation: {features[4]:.0f}mm"
        })

    if features[3] > 38:  # avg_max_temp > 38
        explanations.append({
            "factor": "Heat forecast",
            "contribution_pct": 0,
            "detail": f"Peak apparent temperature: {features[3]:.0f}°C"
        })

    if features[5] > 200:  # avg_max_aqi > 200
        explanations.append({
            "factor": "AQI forecast",
            "contribution_pct": 0,
            "detail": f"Average peak AQI: {features[5]:.0f}"
        })

    if features[6] > 0:  # recent triggers
        explanations.append({
            "factor": "Historical triggers",
            "contribution_pct": 0,
            "detail": f"{int(features[6])} trigger events in last 4 weeks"
        })

    # If no specific risks, add a default
    if not explanations:
        explanations.append({
            "factor": "Seasonal baseline",
            "contribution_pct": 100,
            "detail": "No elevated risk factors this week"
        })

    # Normalize contributions to 100%
    total = len(explanations)
    for i, exp in enumerate(explanations):
        exp["contribution_pct"] = round(100 / total)
    # Adjust last one to make total exactly 100
    current_sum = sum(e["contribution_pct"] for e in explanations)
    if explanations:
        explanations[0]["contribution_pct"] += (100 - current_sum)

    return explanations


@app.post("/premium/predict")
async def predict_premium(request: dict):
    zone_id = request["zone_id"]
    week_start = request["week_start"]  # "2026-04-06"
    shift_type = request["shift_type"]  # "lunch", "dinner", "both"
    lunch_baseline = request.get("earnings_baseline_lunch", 400)
    dinner_baseline = request.get("earnings_baseline_dinner", 650)
    trigger_freq_4w = request.get("recent_trigger_count", 0)

    # Fetch forecast
    avg_max_temp, avg_max_rain, avg_max_aqi, daily_data = await fetch_7day_forecast(zone_id)

    week_dt = datetime.strptime(week_start, "%Y-%m-%d")
    week_of_year = week_dt.isocalendar()[1]
    season = get_season(week_of_year)

    results = {}

    for st in (["lunch", "dinner"] if shift_type == "both" else [shift_type]):
        baseline = lunch_baseline if st == "lunch" else dinner_baseline
        shift_encoded = 0 if st == "lunch" else 1

        features = np.array([[
            ZONE_ENCODING.get(zone_id, 0),
            week_of_year,
            season,
            avg_max_temp,
            avg_max_rain,
            avg_max_aqi,
            trigger_freq_4w,
            shift_encoded,
            baseline
        ]])

        expected_claim_cost = float(model.predict(features)[0])
        expected_claim_cost = max(expected_claim_cost, 0)  # no negative costs

        premium_for_shift = expected_claim_cost * (1 + LOADING_FACTOR)
        results[st] = {
            "expected_claim_cost": round(expected_claim_cost),
            "premium": round(premium_for_shift),
            "baseline": baseline
        }

    # Total premium
    if shift_type == "both":
        total_premium = results["lunch"]["premium"] + results["dinner"]["premium"]
        avg_baseline = (lunch_baseline + dinner_baseline) / 2
    else:
        total_premium = results[shift_type]["premium"]
        avg_baseline = results[shift_type]["baseline"]

    # Ensure minimum premium floor
    total_premium = max(total_premium, 15)  # minimum ₹15/week

    # Risk score (0-1)
    risk_score = min(total_premium / (avg_baseline * 0.5), 1.0)
    risk_score = round(risk_score, 2)

    # Risk band
    if risk_score < 0.33:
        risk_band = "low"
    elif risk_score < 0.66:
        risk_band = "medium"
    else:
        risk_band = "high"

    # Payout caps
    lunch_max_payout = round(lunch_baseline * 0.80)
    dinner_max_payout = round(dinner_baseline * 0.80)
    if shift_type == "both":
        payout_cap = (lunch_max_payout * 6) + (dinner_max_payout * 6)
    elif shift_type == "lunch":
        payout_cap = lunch_max_payout * 6
    else:
        payout_cap = dinner_max_payout * 6

    # Explanation
    features_for_explanation = [
        ZONE_ENCODING.get(zone_id, 0), week_of_year, season,
        avg_max_temp, avg_max_rain, avg_max_aqi,
        trigger_freq_4w, 0, avg_baseline
    ]
    explanation_factors = compute_explanation(features_for_explanation, None, daily_data)

    summary_parts = []
    if risk_band == "low": summary_parts.append("Low risk this week.")
    elif risk_band == "medium": summary_parts.append("Medium risk this week.")
    else: summary_parts.append("High risk this week.")
    for f in explanation_factors[:2]:
        summary_parts.append(f["detail"] + ".")

    return {
        "risk_score": risk_score,
        "risk_band": risk_band,
        "premium": total_premium,
        "payout_cap": payout_cap,
        "lunch_shift_max_payout": lunch_max_payout,
        "dinner_shift_max_payout": dinner_max_payout,
        "explanation": {
            "top_factors": explanation_factors[:3],
            "summary": " ".join(summary_parts)
        }
    }
```

### Quote Generation (Node.js — calls ML service)

```javascript
// POST /api/quotes/generate
// Extract rider_id from JWT
// Get rider profile (zone, shifts, baselines)
// Get recent trigger count for this zone (last 4 weeks)
//   SELECT COUNT(*) FROM trigger_events WHERE zone_id = rider.zone_id AND detected_at > now() - interval '28 days'
//
// Call ML service:
//   POST http://ML_SERVICE_URL/premium/predict
//   Body: {
//     zone_id: rider.zone_id,
//     week_start: requested_week_start,
//     shift_type: rider.shifts_covered,
//     earnings_baseline_lunch: rider.lunch_baseline,
//     earnings_baseline_dinner: rider.dinner_baseline,
//     recent_trigger_count: count_from_query
//   }
//
// ML returns: risk_score, risk_band, premium, payout_cap, explanation, etc.
//
// Determine if purchasable:
//   can_purchase = (now < purchase_deadline) AND (no active disruption in zone)
//   purchase_deadline = week_start - 1 day, 23:59 IST
//
// Store quote in policy_quotes table
// Return full quote response (see Screen 3 contract)
```

### Trigger Monitor (Node.js Cron)

```javascript
// trigger-cron.js
// Uses node-cron: npm install node-cron
//
// Schedule: "*/15 11-14,18-22 * * *"  (every 15 min during shift hours, IST)
// NOTE: node-cron uses server timezone. Set TZ=Asia/Kolkata in env or convert.
//
// Alternative: run "*/15 * * * *" and check time in code:
//   const hour = new Date().toLocaleString('en-US', {timeZone:'Asia/Kolkata', hour:'numeric', hour12:false})
//   if (hour < 11 || (hour > 14 && hour < 18) || hour > 22) return;  // outside shift windows

async function runTriggerCheck() {
    // 1. Determine current shift
    const istHour = getCurrentISTHour();
    let currentShift;
    if (istHour >= 11 && istHour <= 14) currentShift = 'lunch';
    else if (istHour >= 18 && istHour <= 22) currentShift = 'dinner';
    else return; // outside shift windows

    // 2. Get zones with active policies for this shift
    const zones = await getZonesWithActivePolicies(currentShift);
    // SELECT DISTINCT z.* FROM zones z
    // JOIN weekly_policies p ON p.rider_id IN (SELECT id FROM riders WHERE zone_id = z.id)
    // JOIN riders r ON r.id = p.rider_id
    // WHERE p.status = 'active'
    // AND (r.shifts_covered = 'both' OR r.shifts_covered = currentShift)

    // 3. For each zone, evaluate triggers
    for (const zone of zones) {
        await evaluateZone(zone, currentShift);
    }
}

async function evaluateZone(zone, currentShift) {
    // --- CONDITION A ---
    const weather = await fetchOpenMeteoWeather(zone.lat, zone.lng);
    // GET https://api.open-meteo.com/v1/forecast
    //   ?latitude={lat}&longitude={lng}
    //   &current=apparent_temperature,precipitation,weather_code
    //   &timezone=Asia/Kolkata

    const aqi = await fetchOpenMeteoAQI(zone.lat, zone.lng);
    // GET https://air-quality-api.open-meteo.com/v1/air-quality
    //   ?latitude={lat}&longitude={lng}
    //   &current=us_aqi,pm2_5
    //   &timezone=Asia/Kolkata

    const conditionA = {
        rain: weather.current.precipitation >= 15,
        heat: weather.current.apparent_temperature >= 42,
        aqi: aqi.current.us_aqi >= 301
    };

    // Determine primary trigger type and value
    let triggerType = null;
    let conditionAData = {};

    if (conditionA.rain) {
        triggerType = 'rain';
        conditionAData = { precipitation_mm: weather.current.precipitation, threshold: 15 };
    }
    if (conditionA.heat) {
        triggerType = 'heat';
        conditionAData = { apparent_temp: weather.current.apparent_temperature, threshold: 42 };
    }
    if (conditionA.aqi) {
        triggerType = 'aqi';
        conditionAData = { us_aqi: aqi.current.us_aqi, threshold: 301 };
    }

    if (!triggerType) return; // No Condition A met

    // TODO for persistence checks:
    // For Phase 2, skip the "sustained for X consecutive checks" requirement.
    // Treat any single-check breach as valid. Add persistence tracking in Phase 3.
    // This simplification is acceptable for the hackathon demo.

    // --- CONDITION B ---
    const normal = await fetchMockPlatformActivity(zone.id);    // /mock-platform/zone/:id/activity
    const current = await fetchMockPlatformCurrent(zone.id);     // /mock-platform/zone/:id/current

    const trafficDrop = (normal.normal_traffic_score - current.traffic_score) / normal.normal_traffic_score;
    const restaurantDrop = (normal.normal_restaurant_count - current.restaurant_count) / normal.normal_restaurant_count;
    const riderDrop = (normal.normal_active_riders - current.active_riders) / normal.normal_active_riders;

    const conditionB = {
        traffic: { confirmed: trafficDrop >= 0.40, drop_pct: Math.round(trafficDrop * 100) },
        restaurant: { confirmed: restaurantDrop >= 0.30, drop_pct: Math.round(restaurantDrop * 100) },
        rider_count: { confirmed: riderDrop >= 0.35, drop_pct: Math.round(riderDrop * 100) }
    };

    const confirmedCount = [conditionB.traffic.confirmed, conditionB.restaurant.confirmed, conditionB.rider_count.confirmed]
        .filter(Boolean).length;

    if (confirmedCount < 2) return; // Eligibility not met

    // --- SEVERITY ---
    const severityResult = calculateSeverity(triggerType, conditionAData, confirmedCount);
    // Returns: { level: 1-4, payout_percent: 20-80 }

    // --- CREATE TRIGGER EVENT ---
    const triggerEvent = await insertTriggerEvent({
        zone_id: zone.id,
        trigger_type: triggerType,
        severity_level: severityResult.level,
        payout_percent: severityResult.payout_percent,
        shift_type: currentShift,
        condition_a_data: conditionAData,
        condition_b_data: conditionB
    });

    // --- CREATE CLAIMS ---
    await processClaimsForTrigger(triggerEvent, zone.id, currentShift);
}

function calculateSeverity(triggerType, conditionAData, confirmedProxies) {
    let strength; // 0-1 scale

    if (triggerType === 'rain') {
        const val = conditionAData.precipitation_mm;
        if (val >= 50) strength = 1.0;
        else if (val >= 30) strength = 0.75;
        else if (val >= 20) strength = 0.5;
        else strength = 0.25;
    } else if (triggerType === 'heat') {
        const val = conditionAData.apparent_temp;
        if (val >= 47) strength = 1.0;
        else if (val >= 45) strength = 0.75;
        else if (val >= 43) strength = 0.5;
        else strength = 0.25;
    } else if (triggerType === 'aqi') {
        const val = conditionAData.us_aqi;
        if (val >= 450) strength = 1.0;
        else if (val >= 400) strength = 0.75;
        else if (val >= 350) strength = 0.5;
        else strength = 0.25;
    }

    // 3/3 proxies = boost severity
    if (confirmedProxies === 3) strength = Math.min(strength + 0.15, 1.0);

    // Map to level and payout percent
    if (strength >= 0.85) return { level: 4, payout_percent: Math.round(71 + (strength - 0.85) / 0.15 * 9) };   // 71-80%
    if (strength >= 0.60) return { level: 3, payout_percent: Math.round(56 + (strength - 0.60) / 0.25 * 14) };  // 56-70%
    if (strength >= 0.35) return { level: 2, payout_percent: Math.round(36 + (strength - 0.35) / 0.25 * 19) };  // 36-55%
    return { level: 1, payout_percent: Math.round(20 + strength / 0.35 * 15) };                                   // 20-35%
}
```

### Claims Processing (built by whoever finishes first)

```javascript
// claims-engine.js

async function processClaimsForTrigger(triggerEvent, zoneId, shiftType) {
    // Find all riders with active policies in this zone for this shift
    const policies = await supabase
        .from('weekly_policies')
        .select('*, riders(*)')
        .eq('status', 'active')
        .in('shifts_covered', [shiftType, 'both'])
        // filter by riders in this zone (join)

    const today = getTodayDateIST(); // "2026-03-31"

    for (const policy of policies) {
        const rider = policy.riders;
        if (rider.zone_id !== zoneId) continue;

        // --- IDEMPOTENCY CHECK ---
        const existing = await supabase
            .from('claims')
            .select('id')
            .eq('policy_id', policy.id)
            .eq('shift_type', shiftType)
            .eq('claim_date', today);

        if (existing.data.length > 0) continue; // already paid for this shift today

        // --- FRAUD CHECKS ---
        const fraudResult = runFraudChecks(rider, policy, triggerEvent);

        if (fraudResult.hardFail) continue; // silently skip

        // --- CALCULATE PAYOUT ---
        const baseline = shiftType === 'lunch' ? rider.lunch_baseline : rider.dinner_baseline;
        const payoutAmount = Math.round(baseline * triggerEvent.payout_percent / 100);

        // --- CREATE CLAIM ---
        const claimStatus = fraudResult.softFail ? 'under_review' : 'paid';

        const claim = await supabase
            .from('claims')
            .insert({
                rider_id: rider.id,
                policy_id: policy.id,
                trigger_event_id: triggerEvent.id,
                shift_type: shiftType,
                claim_date: today,
                baseline_used: baseline,
                payout_percent: triggerEvent.payout_percent,
                payout_amount: payoutAmount,
                status: claimStatus,
                fraud_flag: fraudResult.softFail
            })
            .select()
            .single();

        // --- CREDIT WALLET (only if paid) ---
        if (claimStatus === 'paid') {
            const wallet = await supabase
                .from('wallets')
                .select('id')
                .eq('rider_id', rider.id)
                .single();

            await walletService.credit(
                wallet.data.id,
                payoutAmount,
                'credit_payout',
                'claim',
                claim.data.id,
                `${triggerEvent.trigger_type.toUpperCase()} trigger — ${shiftType} shift ${today}`
            );
        }

        // --- NOTIFY (log for now, push notification in integration) ---
        console.log(`Claim created: rider=${rider.id}, amount=${payoutAmount}, status=${claimStatus}`);
    }
}

function runFraudChecks(rider, policy, triggerEvent) {
    // HARD CHECKS
    if (policy.status !== 'active') return { hardFail: true };
    if (rider.zone_id !== triggerEvent.zone_id) return { hardFail: true };
    // shift match checked by query
    // duplicate checked by idempotency above

    // SOFT CHECKS
    let softFail = false;

    const lastActive = new Date(rider.last_app_active);
    const now = new Date();
    const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);
    if (hoursSinceActive > 24) softFail = true;

    // Mock platform check would go here in production

    return { hardFail: false, softFail };
}
```

### Trigger Simulation Endpoint (Demo)

```javascript
// POST /api/admin/simulate-trigger
// Body: {
//   "zone_id": "koramangala",
//   "trigger_type": "aqi",
//   "value": 342,
//   "shift": "dinner"
// }
//
// This endpoint:
// 1. Creates a fake Condition A event with the provided values
// 2. Calls the mock platform /current endpoint (which will auto-degrade since
//    we'll also insert the trigger event)
// 3. Runs the full claims pipeline
// 4. Returns the created trigger event + any claims created
//
// This is the DEMO BUTTON. Use it in the 2-minute video to show the full loop.
```

---

## 10. Execution Timeline — 3 Person Split

### March 31 (Today) — Setup Day

| Person A (Frontend) | Person B (Backend Core) | Person C (Premium + Triggers) |
|---|---|---|
| Flutter project setup | Express app + middleware + Supabase client | Python FastAPI project setup |
| Navigation skeleton (8 screens) | DB schema creation in Supabase | Pull historical weather data for 5 zones |
| Bottom nav bar | Seed zones + mock riders | Start synthetic data generation |
| API service class with mock mode | Auth middleware (JWT verify) | |
| | Time utility functions (IST) | |

### April 1 (Tue) — Core Build Day 1

| Person A | Person B | Person C |
|---|---|---|
| Login screen (OTP flow) | Auth endpoints (send-otp, verify-otp) | Finish synthetic data generation |
| Onboarding screen (zone picker, shift selector, platform, earnings) | Rider profile CRUD | Train XGBoost model |
| Wire login → onboarding flow | Mock platform API (3 endpoints) | Build FastAPI /premium/predict |
| | Zones endpoint | Test predictions locally |
| | Auto-create wallet on registration | |

### April 2 (Wed) — Core Build Day 2

| Person A | Person B | Person C |
|---|---|---|
| Quote screen (premium display, risk badge, explanation card) | Policy create endpoint | Quote generation endpoint (Node.js → calls FastAPI) |
| Buy policy screen (confirmation, wallet debit) | Policy current/history endpoints | Open-Meteo live weather + AQI integration |
| | Wallet service (credit, debit, balance, transactions) | Trigger monitor cron job skeleton |
| | Wallet endpoints (GET, topup, withdraw) | |
| | Policy lifecycle cron (activate/expire) | |

### April 3 (Thu) — Integration Day

| Person A | Person B | Person C |
|---|---|---|
| Dashboard screen (policy card, weather strip, recent claims) | Dashboard aggregation endpoint | Trigger monitor: Condition A evaluation |
| Claims history screen | **START Claims Management** (whoever finishes first) | Trigger monitor: Condition B evaluation |
| Wallet screen | Claims engine: trigger → fraud → wallet credit | Severity calculation |
| Connect all screens to real APIs | Claims endpoints (GET /claims) | Simulate-trigger endpoint |
| Replace mock mode with live calls | | Wire: trigger → claims engine |

### April 4 (Fri) — Demo Day

| Morning (all three) | Afternoon (all three) |
|---|---|
| End-to-end test: full happy path | Record 2-minute video |
| Fix integration bugs | Final README update |
| Seed demo accounts with wallet balance | Push to GitHub |
| Test simulate-trigger → claim → wallet | Submit |
| Profile screen (low priority, skip if tight) | |

---

## 11. Demo Script (2-minute video)

This is the exact sequence to record:

```
0:00-0:15  HOOK
  "Food delivery riders in Bengaluru lose ₹2000-5000/month when weather
  disrupts their shifts. ShiftShield protects their earning windows
  automatically."

0:15-0:30  SHOW: Rider logs in → Onboarding
  Phone entry → OTP → Name → Select Swiggy → Select Koramangala →
  Both shifts → Earnings loaded from platform

0:30-0:50  SHOW: Quote → Buy Policy
  "₹52/week — Medium risk — 3 AQI evenings forecasted"
  Tap Buy → Wallet debited → "Policy scheduled"

0:50-1:20  SHOW: Trigger → Auto-Claim → Wallet Credit
  Dashboard shows policy active
  [Simulate AQI trigger for Koramangala dinner shift]
  Dashboard goes red: "AQI 342 detected"
  Claim card appears: "₹306 paid — 45% of ₹680 dinner baseline"
  Wallet balance increases

1:20-1:40  SHOW: Claims History + Wallet
  Claims screen: trigger details, Condition B validation checkmarks
  Wallet screen: credit_payout transaction visible

1:40-1:55  EXPLAIN: AI + Fraud
  "Premium is calculated by an XGBoost model using 7-day weather
  forecasts. Claims are auto-generated — riders never file anything.
  Fraud checks run automatically on every claim."

1:55-2:00  CLOSE
  "ShiftShield. Protecting the income behind every shift."
```

---

## 12. What Is Intentionally Cut from Phase 2

Do NOT build any of these:

- Multi-city support
- Real payment gateway (Razorpay)
- Actual bank/UPI transfer
- Advanced fraud ML (Isolation Forest)
- GPS/accelerometer spoofing detection
- Admin analytics dashboard
- Push notifications via FCM (use in-app state refresh)
- Unit tests
- CI/CD
- Multiple coverage weeks in advance
- Policy modification after purchase
- Rider-to-rider social features
- Chatbot or AI assistant

---

## 13. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Open-Meteo goes down during demo | Person C: cache last known weather values. If API fails, use cached data. |
| ML model predictions are nonsensical | Person C: add floor (₹15/week) and ceiling (₹150/week) on premium output. |
| Wallet goes negative | Person B: DB constraint `balance >= 0` + application-level check before debit. |
| Flutter can't connect to backend | Person A: mock mode flag returns hardcoded responses. Record video from mock if needed. |
| Trigger never fires in demo | Person C: simulate-trigger endpoint is the guaranteed demo path. |
| Claims duplicate on repeated cron run | DB unique constraint on `(policy_id, shift_type, claim_date)`. |
| Team member falls behind | Claims management is the flex task — whoever is free picks it up. |

---

## 14. Definition of Done

Phase 2 is DONE when:

1. A new rider can sign up, see a quote, and buy a policy
2. The trigger simulation creates a claim and credits the wallet
3. The rider sees the claim in their history and the wallet balance updated
4. This loop is captured in a 2-minute video
5. The source code runs (with setup instructions)
6. The README reflects what was actually built

Everything else is bonus.

### Final Freeze Checklist

Before recording the demo, verify all of these:

- The backend `/health` endpoint returns `ok`
- The ML service `/health` endpoint returns `ok` and `model_loaded: true`
- Seeded demo rider exists and can log in with OTP `1234`
- The rider has a non-zero wallet balance for the policy-purchase path
- The quote screen returns a premium, risk band, and explanation
- The buy-policy flow debits the wallet correctly
- The simulate-trigger endpoint creates exactly one claim for the shift
- The wallet balance refreshes immediately after claim payout
- The claims screen shows trigger details and Condition B validation
- The README setup steps match the actual commands needed to run the repo
