# Person C Handoff

This repo contains a standalone Person C premium/quote slice. It is not the shared backend yet.

## Files and routes

- Backend entry: [`src/app.js`](/home/arnavbansal/Guidewire/backend/src/app.js)
- Quote route: [`src/routes/quotes.js`](/home/arnavbansal/Guidewire/backend/src/routes/quotes.js)
- Quote service: [`src/services/quote-service.js`](/home/arnavbansal/Guidewire/backend/src/services/quote-service.js)
- ML client: [`src/services/ml-client.js`](/home/arnavbansal/Guidewire/backend/src/services/ml-client.js)
- Weather ingestion: [`src/services/weather-service.js`](/home/arnavbansal/Guidewire/backend/src/services/weather-service.js)
- Auth middleware used by this slice: [`src/middleware/auth.js`](/home/arnavbansal/Guidewire/backend/src/middleware/auth.js)
- Storage adapter: [`src/utils/storage.js`](/home/arnavbansal/Guidewire/backend/src/utils/storage.js)
- ML service entry: [`../ml-service/main.py`](/home/arnavbansal/Guidewire/ml-service/main.py)

Routes exposed by this slice:

- `GET /health`
- `POST /api/quotes/generate`
- ML service: `GET /health`, `POST /premium/predict`

## Assumptions in the quote route

- Auth: `Authorization: Bearer <jwt>` with payload containing `rider_id`
- Riders: quote generation expects a rider row with `zone_id`, `shifts_covered`, `lunch_baseline`, `dinner_baseline`
- Zones: expects `zones.id`, `zones.name`, `zones.lat`, `zones.lng`, and default earnings
- Triggers: expects recent zone trigger counts and active-disruption lookup
- `shift_type` sent to the ML service can be `"lunch"`, `"dinner"`, or `"both"`
- Storage:
  - if `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` exist, the route uses Supabase tables
  - otherwise it falls back to local seeded JSON in [`data/local-db.json`](/home/arnavbansal/Guidewire/backend/data/local-db.json)
- The backend currently passes `forecast_override` to the ML service so the ML service can reuse backend-fetched forecast data and avoid double-fetching Open-Meteo
- If Person B keeps that optimization, they must preserve the ML payload shape including `forecast_override`

## What Person B needs to plug in

- Mount [`src/routes/quotes.js`](/home/arnavbansal/Guidewire/backend/src/routes/quotes.js) into the shared Express app
- Replace this slice’s standalone auth middleware with the shared JWT middleware if different
- Point the quote service at shared rider/zone/trigger storage instead of the local JSON fallback
- Keep the quote response shape unchanged; only `reason` is added when `can_purchase` is `false`

## Required env vars

- Backend:
  - `JWT_SECRET`
  - `ML_SERVICE_URL`
  - `PORT`
  - `HOST`
  - optional: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPEN_METEO_WEATHER_URL`, `OPEN_METEO_AQI_URL`
- ML service:
  - optional: `OPEN_METEO_WEATHER_URL`, `OPEN_METEO_AQI_URL`, `OPEN_METEO_HISTORICAL_URL`
  - optional: `PREMIUM_LOADING_FACTOR`

## Local run commands

From [`/home/arnavbansal/Guidewire/ml-service`](/home/arnavbansal/Guidewire/ml-service):

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
PYTHONPATH=. .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

From [`/home/arnavbansal/Guidewire/backend`](/home/arnavbansal/Guidewire/backend):

```bash
npm install
HOST=127.0.0.1 PORT=3000 JWT_SECRET=shiftshield-dev-secret ML_SERVICE_URL=http://127.0.0.1:8000 node src/index.js
```

## Sample JWT payload expected by the quote route

```json
{
  "rider_id": "11111111-1111-4111-8111-111111111111",
  "phone": "9876543210"
}
```

## Sample curl

```bash
curl -s -X POST http://127.0.0.1:3000/api/quotes/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  --data '{"week_start":"2026-04-06"}'
```
