# ShiftShield: AI-Powered Parametric Income Protection for Delivery Riders

## What Is ShiftShield

ShiftShield is a parametric micro-insurance platform for food delivery partners on Swiggy and Zomato. It protects gig workers against income loss caused by verified external disruptions — heavy rain, extreme heat, and severe air pollution — using real-time weather data, ML-driven dynamic pricing, and automated claim payouts with zero manual submission.

**Core innovation**: Objective environmental signals trigger automatic payouts. No claim forms, no disputes, no waiting. If the weather disrupts your shift, you get paid.

## What Is Built (Current State)

This is a working hackathon prototype with a real backend, trained ML model, and end-to-end flows — not a wireframe or design document.

### Working end-to-end

- Multi-city, multi-zone geography model (8 cities, 12 zones, 3 tiers)
- XGBoost-based dynamic premium pricing served via FastAPI
- Weekly policy lifecycle (quote, purchase, activate, expire, renew)
- Parametric trigger detection and automated claim processing
- Rider wallet with topup, premium debit, claim credit, and withdrawal
- Rule-based fraud checking with hard-fail and soft-fail paths
- Admin trigger simulation for demo scenarios
- Rider dashboard, notifications, and policy history
- JWT-authenticated API for all rider-facing operations
- 85 tests passing (100% coverage of core flows)

### What is real vs simulated

| Layer | Status |
|-------|--------|
| Premium pricing engine | Real — trained XGBoost model, live inference |
| Weather data | Live Open-Meteo API with deterministic fallback |
| Policy/claim/wallet logic | Real — fully implemented backend |
| Trigger detection | Admin-simulated for demo; threshold rules are real |
| Rider profiles | Seeded demo personas |
| Training data | Realistic synthetic distributions |
| Database | Local JSON store (demo mode); Supabase config stubbed |

## Coverage Model

- **Weekly premiums**: Monday 00:00 to Sunday 23:59
- **Shift-level coverage**: Lunch (12-3 PM), Dinner (7-11 PM), or Both
- **Zone-based pricing**: Premiums tied to zone risk class, city tier, weather forecast, and trigger history
- **Premium range**: Bounded to INR 20-50 per week (affordable for gig workers)
- **Advance purchase**: Underwriting rules enforce minimum lead time before coverage starts

## Covered Disruptions

| Disruption | Trigger Threshold | Source |
|------------|-------------------|--------|
| Heavy rain | >= 15 mm/hour sustained | Open-Meteo weather API |
| Extreme heat | >= 42 C for 120+ minutes | Open-Meteo weather API |
| Severe AQI | >= 301 for 60+ minutes | Open-Meteo air quality API |

Thresholds are configurable per city tier and per zone. T2/T3 cities have lower thresholds reflecting different risk profiles.

## Payout Structure

| Level | Condition | Payout |
|-------|-----------|--------|
| Level 1 | Moderate disruption | 20% of shift baseline earnings |
| Level 2 | Significant disruption | 40% of shift baseline earnings |
| Level 3 | Severe disruption | 60% of shift baseline earnings |
| Level 4 | Extreme disruption (Red Alert level) | 80% of shift baseline earnings |

**Guardrails**:
- Maximum one payout per shift per policy week
- Dinner payouts weighted higher (greater income dependency)
- Baseline earnings locked at policy purchase time
- Payout cap calculated per policy (6 shifts x max payout per shift)

## Geography

### City Tiers

| Tier | Cities | Characteristics |
|------|--------|----------------|
| T1 (Premium) | Bengaluru, Pune, Hyderabad, Chennai | Higher earnings baselines, higher thresholds |
| T2 (Standard) | Jaipur, Lucknow, Indore | Moderate baselines, adjusted thresholds |
| T3 (Emerging) | Bhubaneswar | Lower baselines, lower thresholds |

### Zones (12 operational zones)

Each zone has its own risk class (low/medium/high), earnings baselines, and coordinates.

**Bengaluru** (5 zones): Koramangala, Indiranagar, HSR Layout, Whitefield, Electronic City
**Pune**: Hinjewadi | **Hyderabad**: HITEC City | **Chennai**: OMR
**Jaipur**: Malviya Nagar | **Lucknow**: Gomti Nagar | **Indore**: Vijay Nagar | **Bhubaneswar**: Patrapada

Zone-specific threshold overrides exist (e.g., Whitefield has a lower AQI threshold of 290 due to local conditions).

## ML / AI

### Premium Pricing Model

- **Algorithm**: XGBoost (180 estimators, max_depth=5, learning_rate=0.08)
- **Test MAE**: 5.56 INR
- **Serving**: FastAPI endpoint at `/premium/predict`
- **Training data**: Realistic synthetic distributions generated from zone/city configurations

**Feature importance (what actually drives premiums)**:

| Feature | Importance |
|---------|-----------|
| Shift type (lunch vs dinner) | 46.1% |
| Rainfall forecast | 33.1% |
| Recent trigger frequency (4 weeks) | 12.6% |
| Week of year | 4.7% |
| Earnings baseline | 2.4% |
| Zone, season, AQI, temperature | < 1% each |

Zone and city tier influence premiums primarily through **configuration** (thresholds, baselines, payout caps) rather than as direct model features. The pricing score combines the raw ML prediction with tier base scores, zone risk adjustments, and a dynamic weather score to produce the final bounded premium.

### Fraud Detection

Rule-based sequential validation (not ML-based in current build):

1. Active policy verification
2. Shift window match
3. Zone consistency (rider zone = trigger zone)
4. Duplicate payout check
5. Recent app activity check (24-hour window)
6. Platform activity cross-check (48-hour window)

**Hard fails** (policy inactive, shift mismatch, zone mismatch, duplicate) reject the claim outright. **Soft fails** (no recent activity, no platform activity) flag the claim as `under_review` with a `fraud_flag`.

## API Surface

### Open endpoints (no auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Backend health check |
| GET | `/api/cities` | List all cities with grouped zones |
| POST | `/api/admin/simulate-trigger` | Simulate a disruption event in a zone |
| POST | `/api/admin/policies/run-lifecycle` | Run policy expiry/lifecycle automation |

### Authenticated endpoints (JWT required)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/quotes/generate` | Generate a premium quote for a week |
| POST | `/api/policies/create` | Purchase a policy from a quote |
| GET | `/api/policies/current` | Get active policy |
| GET | `/api/policies/history` | List past policies |
| GET | `/api/policies/:id` | Policy detail |
| POST | `/api/policies/:id/renew` | Renew expired policy |
| GET | `/api/claims` | List rider's claims |
| GET | `/api/claims/:id` | Claim detail |
| GET | `/api/wallet` | Wallet balance + transaction history |
| GET | `/api/wallet/transactions` | Transaction list |
| POST | `/api/wallet/topup` | Add funds to wallet |
| POST | `/api/wallet/withdraw` | Request withdrawal |
| GET | `/api/dashboard` | Rider dashboard overview + alerts |
| GET | `/api/notifications` | Notification list |

### Authentication

JWT tokens with `rider_id` payload, signed with a configurable secret. Tokens are passed via `Authorization: Bearer <token>` header.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend API | Node.js / Express |
| ML Service | Python / FastAPI / XGBoost |
| ML Libraries | scikit-learn, pandas, numpy, joblib |
| Database | Local JSON store (demo); Supabase config available |
| Weather APIs | Open-Meteo (weather + air quality) |
| Testing | Node.js built-in test runner (85 tests) |
| Auth | JSON Web Tokens (jsonwebtoken) |
| Frontend | Flutter (separate repo/device) |

## Project Structure

```
Guidewire/
  backend/
    src/
      index.js                  # Express server entry point
      app.js                    # Express app setup and route mounting
      routes/                   # API route handlers
      services/                 # Business logic layer
        quote-service.js        # Premium quote generation
        policy-service.js       # Policy lifecycle management
        claims-engine.js        # Automated claim processing
        wallet-service.js       # Wallet operations
        cities-service.js       # Geography data
        ml-client.js            # ML service integration
        weather-service.js      # Weather API client
        admin-service.js        # Admin trigger simulation
        dashboard-service.js    # Rider dashboard aggregation
        notification-service.js # Notification management
        fraud-checker.js        # Rule-based fraud validation
      middleware/
        auth.js                 # JWT authentication
      utils/
        config.js               # Configuration
        storage.js              # Data store adapter
        thresholds.js           # Geography-aware threshold resolution
        underwriting.js         # Quote eligibility rules
    seed/
      cities.json               # City definitions
      zones.json                # Zone definitions with risk/earnings
      thresholds.json           # Disruption thresholds by tier/zone
      mock-riders.json          # Demo rider personas
    tests/                      # 85 test files
    data/
      local-db.json             # Runtime data store
  ml-service/
    main.py                     # FastAPI app
    model/
      train.py                  # XGBoost training pipeline
      predict.py                # Inference + pricing logic
      premium_model.joblib      # Trained model artifact
      feature_importance.json   # Model metadata
    data/
      generate_synthetic.py     # Synthetic training data generator
```

## Running Locally

### Prerequisites

- Node.js >= 18
- Python >= 3.10
- npm (for backend dependencies)

### Setup

```bash
# Install backend dependencies
cd backend && npm install && cd ..

# Create Python venv for ML service
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn joblib xgboost pandas numpy httpx
cd ..
```

Windows / PowerShell equivalents:

```powershell
# Backend dependencies
cd backend
npm install
cd ..

# ML virtualenv
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..
```

### Start services

```bash
# Terminal 1 — ML service
cd ml-service
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8001

# Terminal 2 — Backend
cd Guidewire
HOST=0.0.0.0 ML_SERVICE_URL=http://127.0.0.1:8001 node backend/src/index.js
```

PowerShell equivalents:

```powershell
# Terminal 1 — ML service
cd .\ml-service
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8001

# Terminal 2 — Backend
cd .
$env:HOST="0.0.0.0"
$env:ML_SERVICE_URL="http://127.0.0.1:8001"
node .\backend\src\index.js
```

Backend runs on port 3000. ML service runs on port 8001.

## Current User Workflows

### Existing seeded rider login

This is the primary demo path for the existing rider personas.

Flow:

1. Open the login screen
2. Enter the rider's phone number
3. Enter fixed demo OTP `9324`
4. Backend issues JWT automatically
5. Frontend uses that token for dashboard, quotes, policies, claims, wallet, and notifications

### New user signup

This is the onboarding path for new riders.

Flow:

1. Call `POST /api/auth/request-otp`
2. User receives OTP through Twilio Verify
3. Call `POST /api/auth/signup` with full rider details and the OTP
4. Backend verifies OTP, creates rider/platform/wallet records, and issues JWT automatically
5. Frontend uses that token for the normal rider flows

Important Twilio note:

- on a Twilio trial account, OTP SMS works only for verified recipient phone numbers
- use seeded riders plus login OTP `9324` for repeatable demos

### Session lookup

- `GET /api/auth/me` returns the authenticated rider profile and geography summary

### Run tests

```bash
cd backend && npm test
```

### WSL2 port forwarding (for Flutter on another device)

If running backend on WSL2 with `networkingMode=mirrored` in `.wslconfig`:

```powershell
# PowerShell (Admin) — forward external traffic to WSL's localhost binding
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=<YOUR_WINDOWS_IP> connectport=3000 connectaddress=127.0.0.1

# Add firewall rule (one-time)
New-NetFirewallRule -DisplayName "ShiftShield Backend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

Flutter app connects to `http://<YOUR_WINDOWS_IP>:3000`.

### Auth API surface

- `POST /api/auth/request-otp`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Generate JWT tokens for low-level testing only

This is only needed for low-level API debugging. Normal app usage should go through the auth routes above.

```bash
cd backend && node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { rider_id: '11111111-1111-4111-8111-111111111111' },
  'shiftshield-dev-secret',
  { expiresIn: '30d' }
);
console.log(token);
"
```

### Demo riders

| Name | ID | Zone | Platform |
|------|-----|------|----------|
| Asha | `11111111-1111-4111-8111-111111111111` | Koramangala (Bengaluru) | Swiggy |
| Rohan | `22222222-2222-4222-8222-222222222222` | Whitefield (Bengaluru) | Zomato |
| Meera | `33333333-3333-4333-8333-444444444444` | Hinjewadi (Pune) | Zomato |
| Pooja | `44444444-4444-4444-8444-555555555555` | Patrapada (Bhubaneswar) | Swiggy |
| Aditya | `55555555-5555-4555-8555-666666666666` | Gomti Nagar (Lucknow) | Zomato |

Use their seeded phone numbers with login OTP `9324`.

## What Is Not Built Yet

- GPS/accelerometer-based anti-spoofing (designed, not implemented)
- Isolation Forest fraud detection (using rule-based checks instead)
- Google Maps traffic proxy / restaurant availability proxy for Condition B validation
- IMD Red Alert integration
- Production database (PostgreSQL/Supabase — config stubbed, using local JSON)
- Full ward-level operational rollout
- CPCB production AQI integration

## Cross-Platform Notes

The project now supports both:

- repo layout with `backend/` and `ml-service/` as siblings
- repo layout where `ml-service/` is nested under `backend/`

The ML seed loader was patched to resolve seed files in both layouts, which is important for Windows laptop setups that may place the folders differently.

## Phase 4 Roadmap (In Progress)

Phase 4 is the final hackathon rollout phase, focused on scaling the prototype into a stronger demo:

1. **Phase 4.1** — Geography scale-up: more zones per featured city, expanded riders, demo runbook
2. **Phase 4.2** — Premium realism: stronger explainability, validation artifacts, model retraining for new zones
3. **Phase 4.3** — Analytics + demo hardening: snapshot analytics endpoint, demo control, final review artifacts

See `PHASE4_FULL_SCALE_ROLLOUT_PLAN.md` for the full plan.

## License

Hackathon project — not licensed for production use.
