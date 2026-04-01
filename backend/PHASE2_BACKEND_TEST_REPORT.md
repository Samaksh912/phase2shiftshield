# ShiftShield Phase 2 Backend Third Deep Pass Report

Date: 2026-04-01
Repo: `/home/arnavbansal/Guidewire`
Backend: `/home/arnavbansal/Guidewire/backend`
Spec: `/home/arnavbansal/Guidewire/PHASE2_IMPLEMENTATION_SPEC.md`

## Strategy

This pass did not repeat happy-path or broad edge-path testing. It focused on:

- malformed payload fuzzing
- stateful multi-step sequences
- cross-route invariants
- response-shape strictness under unusual inputs

## What Held

- Stateful wallet sequence invariants held:
  - `topup -> topup -> withdraw -> failed withdraw -> read wallet`
  - final balance and transaction count stayed consistent
- Cross-route invariants held for repeated successful and failed wallet mutations
- Previous deadline and simulate-trigger validation fixes held under repeated execution
- Zero-state and repeated-read behavior remained stable
- JSON failures still returned JSON, not HTML, and did not leak stack traces

## Newly Verified Bugs

### 1. `simulate-trigger` still accepts invalid `payout_percent` values

- Severity: Medium
- Repro:
  - `POST /api/admin/simulate-trigger`
  - payloads such as `-10`, `19`, `80.5`, `81`, `1000`
  - actual result: `201 Created`
  - expected result: `400 validation_error`
- Failing test:
  - `tests/third-pass-admin-payout-break.test.js`
- Why this is a bug:
  - spec data contract requires `payout_percent` to be an integer between `20` and `80`
- Evidence:
  - Spec: `PHASE2_IMPLEMENTATION_SPEC.md:288`
  - Current code performs no `payout_percent` validation: `src/services/admin-service.js:41-70`
- Smallest fix:
  - validate `payload.payout_percent` when present:
    - integer only
    - range `20..80`
    - reject with `400` / `validation_error`

### 2. Malformed JSON requests are mislabeled as `server_error`

- Severity: Low
- Repro:
  - send malformed JSON to `POST /api/quotes/generate`, for example raw body:
    - `{"week_start":`
  - actual result:
    - status `400`
    - body `{ "error": "server_error", "message": "Unexpected end of JSON input" }`
  - expected result:
    - malformed JSON should be classified as a validation/bad-request error, not a server error
- Failing test:
  - `tests/third-pass-json-parse-break.test.js`
- Why this is a bug:
  - it breaks error-shape semantics for malformed payload fuzzing and makes frontend/client error handling ambiguous
- Evidence:
  - Spec bad-request bucket: `PHASE2_IMPLEMENTATION_SPEC.md:71`
  - Global error mapper defaults unknown codes to `"server_error"`: `src/app.js:45-50`
- Smallest fix:
  - map JSON parse failures from `express.json()` to `validation_error` when status/statusCode is `400`

### 3. Wallet top-up accepts unsafe integers and silently rounds them

- Severity: Medium
- Repro:
  - send raw JSON body `{"amount":9007199254740993}` to `POST /api/wallet/topup`
  - actual result:
    - request succeeds with `200`
    - transaction amount is silently rounded to `9007199254740992`
    - balance is off by `1`
  - expected result:
    - reject unsafe integers instead of mutating money with rounded values
- Failing test:
  - `tests/third-pass-wallet-precision-break.test.js`
- Why this is a bug:
  - the API silently processes a different amount than the caller sent
  - this violates money-movement correctness
- Evidence:
  - Spec: `PHASE2_IMPLEMENTATION_SPEC.md:72`
  - Current validation uses `Number.isInteger(amount)` instead of `Number.isSafeInteger(amount)`:
    - `src/routes/wallet.js:64-69`
    - `src/routes/wallet.js:104-108`
- Smallest fix:
  - require `Number.isSafeInteger(amount)` for wallet top-up and withdraw
  - return `400 validation_error` for unsafe integers

## Verification Run

Command:

```bash
cd /home/arnavbansal/Guidewire/backend && npm test
```

Result:

- Total test files: 20
- Passed: 17
- Failed: 3
- Failing files:
  - `tests/third-pass-admin-payout-break.test.js`
  - `tests/third-pass-json-parse-break.test.js`
  - `tests/third-pass-wallet-precision-break.test.js`

