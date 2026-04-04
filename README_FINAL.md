# ShiftShield

**AI-powered parametric income protection for delivery riders**

ShiftShield is a full-stack micro-insurance platform designed for gig workers on **Swiggy** and **Zomato**. It combines a Flutter mobile experience, a Node.js backend, and a Python ML pricing service to deliver a weekly income-protection product that can:

- generate **dynamic premiums**
- create and renew **weekly protection policies**
- detect **environmental disruption triggers**
- process **zero-paperwork claims**
- credit rider wallets automatically
- surface everything through a clean **dashboard, policy, claims, and notifications** experience

The project evolved beyond a Bengaluru-only proof of concept and now supports a broader multi-geography model with **12 supported zones**, **T1 / T2 / T3 segmentation**, underwriting-aware quote flows, and integrated ML-based pricing bounded to an affordability band.

---

## Why ShiftShield Matters

Delivery partners lose real income when **heavy rain**, **extreme heat**, or **severe air pollution** disrupt a shift. Traditional claims-heavy insurance is too slow, too manual, and too fragile for this use case.

ShiftShield uses **objective external signals** and **pre-defined policy logic** to turn disruption into an automated workflow:

`quote -> purchase -> active cover -> trigger -> claim -> payout`

That means:

- no form filling
- no manual claims submission
- no ambiguity about covered conditions
- no waiting for a human adjuster to validate obvious disruption events

---

## What The Project Includes

### Full-stack product surface

- **Flutter mobile app**
  - onboarding
  - signup / login / OTP flows
  - dashboard
  - policy views
  - quote and payment flows
  - claims views
  - rider profile

- **Node.js / Express backend**
  - authentication
  - city and zone discovery
  - quote generation
  - policy creation and renewal
  - wallet operations
  - claim history
  - dashboard aggregation
  - notifications
  - admin trigger simulation
  - policy lifecycle automation

- **Python FastAPI ML service**
  - premium prediction endpoint
  - model loading and health reporting
  - geography-aware fallback behavior
  - synthetic training data generation
  - bounded premium calibration

### Product capabilities

- **Parametric quote generation**
- **Underwriting-aware eligibility gating**
- **Wallet-first policy purchase and claim settlement**
- **Trigger-driven claims processing**
- **Non-Bengaluru support through expanded geography coverage**
- **City-tier-aware pricing inputs**
- **Dashboard and notification layer for rider visibility**

---

## Core Product Flow

ShiftShield is built around one coherent operating loop:

1. rider signs up and completes profile
2. rider requests a quote for the next policy week
3. backend computes underwriting eligibility and premium
4. rider purchases a policy using wallet or direct payment mode
5. policy becomes active for the covered week
6. a trigger event is detected or simulated for the rider’s zone and shift
7. backend validates policy, eligibility, and fraud signals
8. claim is created automatically
9. payout is credited to the wallet
10. dashboard and notifications reflect the updated state

This makes the system feel product-complete rather than feature-fragmented.

---

## Major Features

### 1. Dynamic Premium Calculation

The pricing engine combines:

- geography
- city tier
- zone risk class
- weekly forecast conditions
- recent trigger history
- rider earnings baselines
- shift coverage

Premiums are calibrated into an **affordable weekly band of INR 20–50**, while still preserving dynamic movement based on weekly conditions.

### 2. Weekly Policy Management

The backend supports:

- quote-driven purchase
- wallet-backed and direct-payment purchase modes
- current policy retrieval
- policy history
- policy detail view
- renewal for future weeks
- lifecycle progression across scheduled, active, and expired states

### 3. Automated Claims

Claims are processed through the disruption workflow without manual submission:

- trigger is created
- active policies are matched by zone and shift
- fraud and activity checks run
- claim is marked paid or under_review
- wallet is credited for paid claims
- rider sees the update in dashboard and notifications

### 4. Wallet and Settlement Layer

The wallet system supports:

- top-up
- premium debit
- payout credit
- withdrawal tracking
- transaction history

This creates a clean financial ledger for every policy purchase and every disruption payout.

### 5. Dashboard and Notifications

The dashboard aggregates:

- rider identity and platform
- wallet balance
- current policy summary
- shifts remaining
- recent claims
- weather status
- next-week quote availability

The notification layer surfaces product-critical events such as:

- policy created
- policy renewed
- claim paid
- wallet movement events

### 6. Multi-Geography Risk Model

The project now supports a broader geography model with:

- **12 supported operational zones**
- **T1 / T2 / T3 city tiers**
- geography-aware fallback forecast behavior
- non-Bengaluru quote and claim-path validation

This gives the platform a stronger expansion story than a single-city prototype.

---

## Geography Footprint

Current supported operating zones include:

- Bengaluru
  - Koramangala
  - Indiranagar
  - HSR Layout
  - Whitefield
  - Electronic City
- Pune
  - Hinjewadi
- Hyderabad
  - HITEC City
- Chennai
  - OMR
- Jaipur
  - Malviya Nagar
- Lucknow
  - Gomti Nagar
- Indore
  - Vijay Nagar
- Bhubaneswar
  - Patrapada

These zones are enriched with:

- coordinates
- state
- city tier
- risk class
- lunch earnings baseline
- dinner earnings baseline

---

## Underwriting Model

The quote and purchase flows incorporate an underwriting gate based on rider activity:

- `eligible` when `active_days_last_30 >= 7`
- `insufficient_history` when `active_days_last_30` is `5` or `6`
- `restricted` when `active_days_last_30 < 5`

Only eligible riders can proceed to purchase or renew in the current scoped flow. This gives the system a visible product discipline instead of pure open quoting.

---

## Trigger Model

ShiftShield currently uses environmental trigger logic centered around:

- heavy rain
- extreme heat
- severe AQI

The backend is geography-aware and supports non-Bengaluru zone handling across:

- quote path
- policy matching
- trigger simulation
- claim generation
- payout credit flow

This is already sufficient to demonstrate a robust multi-geography insurance loop.

---

## Architecture

### Frontend

**Framework:** Flutter

Key app areas in [`lib/features`](/home/arnavbansal/Guidewire/lib/features):

- auth
- onboarding
- dashboard
- policy
- quote
- claims
- profile

Supporting app infrastructure lives in:

- [`lib/core`](/home/arnavbansal/Guidewire/lib/core)
- [`lib/theme`](/home/arnavbansal/Guidewire/lib/theme)

### Backend

**Framework:** Express / Node.js

The backend app is assembled in [`backend/src/app.js`](/home/arnavbansal/Guidewire/backend/src/app.js) and exposes:

- `/api/auth`
- `/api/cities`
- `/api/quotes`
- `/api/policies`
- `/api/claims`
- `/api/wallet`
- `/api/dashboard`
- `/api/notifications`
- `/api/admin`

Core backend services include:

- [`quote-service.js`](/home/arnavbansal/Guidewire/backend/src/services/quote-service.js)
- [`policy-service.js`](/home/arnavbansal/Guidewire/backend/src/services/policy-service.js)
- [`claims-engine.js`](/home/arnavbansal/Guidewire/backend/src/services/claims-engine.js)
- [`wallet-service.js`](/home/arnavbansal/Guidewire/backend/src/services/wallet-service.js)
- [`dashboard-service.js`](/home/arnavbansal/Guidewire/backend/src/services/dashboard-service.js)
- [`notification-service.js`](/home/arnavbansal/Guidewire/backend/src/services/notification-service.js)
- [`admin-service.js`](/home/arnavbansal/Guidewire/backend/src/services/admin-service.js)
- [`cities-service.js`](/home/arnavbansal/Guidewire/backend/src/services/cities-service.js)

### ML Service

**Framework:** FastAPI / Python

The ML service entrypoint is:

- [`backend/ml-service/main.py`](/home/arnavbansal/Guidewire/backend/ml-service/main.py)

Core pricing logic lives in:

- [`ml-service/model/predict.py`](/home/arnavbansal/Guidewire/ml-service/model/predict.py)
- [`ml-service/data/generate_synthetic.py`](/home/arnavbansal/Guidewire/ml-service/data/generate_synthetic.py)

The ML service is responsible for:

- model loading
- pricing inference
- forecast-driven risk inputs
- bounded premium output

---

## API Highlights

### Authentication

- OTP-style signup and login flow
- JWT-based rider session model
- protected rider-facing endpoints

### Demo login credentials

There are currently `5` seeded demo login numbers for repeatable rider testing:

| Name | Phone | Demo OTP | Zone | Platform |
|------|-------|----------|------|----------|
| Asha | `9876543210` | `9324` | Koramangala (Bengaluru) | Swiggy |
| Rohan | `9123456780` | `2841` | Whitefield (Bengaluru) | Zomato |
| Meera | `9988776655` | `6157` | Hinjewadi (Pune) | Zomato |
| Pooja | `9345678123` | `4408` | Patrapada (Bhubaneswar) | Swiggy |
| Aditya | `9451203344` | `7712` | Gomti Nagar (Lucknow) | Zomato |

### Demo signup credentials

There are currently `5` demo signup numbers:

| Phone | Demo OTP | Notes |
|------|----------|-------|
| `9012345678` | `1201` | Preferred signup test number; already has local demo flow coverage |
| `9012345679` | `1202` | Preferred signup test number; already has local demo flow coverage |
| `9012345680` | `1203` | Preferred signup test number; already has local demo flow coverage |
| `9012345681` | `1204` | Fresh signup test number |
| `9012345682` | `1205` | Fresh signup test number |

Use the top `3` signup numbers first for the smoothest walkthrough. Each signup number can generally be used once unless the local store is reset.

### Quotes

- `POST /api/quotes/generate`
- computes underwriting
- computes premium
- returns purchase eligibility and explanation

### Policies

- `POST /api/policies/create`
- `POST /api/policies/:id/renew`
- `GET /api/policies/current`
- `GET /api/policies/history`
- `GET /api/policies/:id`

### Claims

- `GET /api/claims`
- `GET /api/claims/:id`

### Wallet

- `GET /api/wallet`
- `POST /api/wallet/topup`
- `POST /api/wallet/withdraw`

### Dashboard

- `GET /api/dashboard`

### Notifications

- `GET /api/notifications`

### Admin / Simulation

- `POST /api/admin/simulate-trigger`
- policy lifecycle support via [`backend/src/policy-lifecycle.js`](/home/arnavbansal/Guidewire/backend/src/policy-lifecycle.js)

---

## Technology Stack

### Frontend

- Flutter
- Provider
- GoRouter
- flutter_secure_storage
- Razorpay Flutter
- Google Fonts

### Backend

- Node.js
- Express
- JSON Web Token auth
- Supabase client support
- Twilio integration path

### ML / Data

- Python
- FastAPI
- scikit-learn / XGBoost-style model pipeline
- pandas
- numpy
- joblib
- httpx

### Infrastructure

- Render deployment config via [`render.yaml`](/home/arnavbansal/Guidewire/render.yaml)
- local JSON-backed runtime dataset for rapid iteration
- Supabase-compatible backend data path

---

## Testing and Verification

The project includes a substantial backend regression and verification surface.

Current backend status in this repo:

- `npm test` passes for the backend suite
- Phase 2 freeze and certification artifacts exist
- Phase 2.5 geography, underwriting, pricing, and non-Bengaluru flows have been exercised and verified in prior engineering passes

Useful verification artifacts:

- [`backend/PHASE2_BACKEND_TEST_REPORT.md`](/home/arnavbansal/Guidewire/backend/PHASE2_BACKEND_TEST_REPORT.md)
- backend tests under [`backend/tests`](/home/arnavbansal/Guidewire/backend/tests)
- ML tests under [`ml-service/tests`](/home/arnavbansal/Guidewire/ml-service/tests)

This gives the project a much stronger engineering story than a typical hackathon prototype.

---

## Local Development

### 1. Flutter app

```bash
flutter pub get
flutter run
```

### 2. Backend

```bash
cd backend
npm install
npm start
```

Useful backend commands:

```bash
cd backend
npm test
npm run policy:lifecycle
```

### 3. ML service

```bash
cd ml-service
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

If your environment uses the backend ML service layout:

```bash
cd backend/ml-service
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

---

## Project Positioning

ShiftShield is more than a UI prototype. It is a working insurance workflow engine with:

- parametric risk logic
- underwriting-aware quote generation
- policy lifecycle control
- automated claims
- wallet-based settlement
- geography-aware premium modeling
- multi-service architecture

For judging, demos, and technical review, the strongest message is:

> ShiftShield turns environmental disruption into an automated protection workflow for delivery riders — with explainable pricing, policy control, and zero-friction claims.

---

## What Comes Next

The current codebase already supports a strong first operational product story.

The next major evolution path is:

- richer city -> multi-zone hierarchy
- deeper premium-tier modeling
- stronger geography-specific differentiation
- more advanced real-data and provider integrations

That makes this repository a credible foundation for both a polished demo and a serious next-phase build.

---

## Repository Pointers

- Main app entry: [`lib/main.dart`](/home/arnavbansal/Guidewire/lib/main.dart)
- Backend app assembly: [`backend/src/app.js`](/home/arnavbansal/Guidewire/backend/src/app.js)
- Backend server entry: [`backend/src/index.js`](/home/arnavbansal/Guidewire/backend/src/index.js)
- ML service entry: [`backend/ml-service/main.py`](/home/arnavbansal/Guidewire/backend/ml-service/main.py)
- Baseline implementation spec: [`PHASE2_IMPLEMENTATION_SPEC.md`](/home/arnavbansal/Guidewire/PHASE2_IMPLEMENTATION_SPEC.md)

---

## Summary

ShiftShield is a high-conviction, end-to-end parametric insurance platform for delivery riders with:

- a polished mobile surface
- a modular backend
- an ML-backed premium engine
- automated claims logic
- strong verification coverage
- a clear roadmap for expansion

It is already compelling as a judged prototype and structured enough to evolve into a much more ambitious insurance platform.
