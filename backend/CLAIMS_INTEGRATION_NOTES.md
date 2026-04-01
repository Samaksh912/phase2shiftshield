## Claims Integration Notes

- `SupabaseDataStore.listActivePoliciesByZoneAndShift` now remaps joined rider data to `policy.rider` so the claims engine can use the same shape as the local JSON store.
- `SupabaseDataStore.applyWalletTransaction` is not transactionally atomic yet. It currently:
  - reads the wallet
  - computes the next balance
  - updates the wallet
  - inserts the wallet transaction
- For the Phase 2 demo, simulate one trigger at a time when using Supabase-backed claims.
- Shared-backend integration should replace this path with an atomic database operation, such as a transactional SQL function or RPC.
