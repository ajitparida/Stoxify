# Firestore Security Specification — PulseVest Pro

## 1. Data Invariants
1. **Strict Owner Isolation**: All holdings (`/users/{userId}/holdings/{holdingId}`), watchlist items (`/users/{userId}/watchlist/{itemId}`), mutual fund holdings (`/users/{userId}/mutualFunds/{fundHoldingId}`), algo strategies (`/users/{userId}/algoStrategies/{strategyId}`), and algo orders (`/users/{userId}/algoOrders/{orderId}`) belong exclusively to `userId == request.auth.uid` with a verified email (`request.auth.token.email_verified == true`).
2. **Identity & Relational Integrity**: Document `id` must match path ID and conform to `^[a-zA-Z0-9_\-]+$` (<= 128 chars). Field `userId` must match both `{userId}` path segment and `request.auth.uid`. Every `algoOrders` creation verifies the parent `algoStrategies/{strategyId}` document exists under the same user (`exists(...)`).
3. **Immutable Audit Fields & Order Ledger**: `id`, `userId`, `symbol`/`schemeCode`, `exchange`/`planType`, `source`, and `createdAt` cannot be modified after creation. `algoOrders` records are append-only (`allow update: if false`).
4. **Server-Side Temporal Integrity**: `createdAt` (on create) and `updatedAt` (on create and update) must equal `request.time`.
5. **Bounded Types & Total Array Guarding**: Only allowlisted schema keys are permitted; numeric quantities/units/prices/guardrails are strictly range-checked; `algoStrategies.symbols` (1–10 items), `entryConditions` (1–6 items), and `exitConditions` (0–6 items) enforce bounded list lengths and element types; string fields enforce strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Read or write `/users/u1/holdings/h1` or `/users/u1/algoStrategies/s1` with `request.auth == null`.
2. **Cross-Tenant Read**: Authenticated user `u2` attempts `get` or `list` on `/users/u1/holdings` or `/users/u1/algoOrders`.
3. **Cross-Tenant Create (Identity Spoofing)**: Authenticated user `u2` creates `/users/u2/algoStrategies/s1` with `userId: "u1"`.
4. **Unverified Email Write**: Authenticated user `u1` with `email_verified: false` attempts to create a holding or algo strategy.
5. **Shadow / Ghost Field Injection**: Create holding or algo strategy with extra field `isAdmin: true` or `bypassRiskCap: true`.
6. **ID Poisoning (1KB+ ID)**: Create document with 1,500-character `{strategyId}` or invalid characters (`../evil`).
7. **Client Timestamp Spoofing**: Create or update document with client-supplied past/future `createdAt` or `updatedAt != request.time`.
8. **Immutable Field / Audit Order Tampering**: Attempt `update` on `/users/u1/algoOrders/o1` (realizedPnl rewrite) or tamper `createdAt`/`userId` on `algoStrategies`.
9. **Negative / Unbounded Risk Guardrail Poisoning**: Create `algoStrategy` with `stopLossPct: -5`, `dailyLossCapPct: 90`, or `virtualCapital: 0`.
10. **Array & String Resource Exhaustion**: Create `algoStrategy` with 500 `symbols`, non-string list elements, or 5,000-character `prompt`.
11. **Orphaned Algo Order Injection**: Create `/users/u1/algoOrders/o1` referencing a nonexistent `strategyId`.
12. **Unscoped List Scraping**: Attempt `list` on `/users/u1/algoStrategies` or `/users/u1/algoOrders` without matching `resource.data.userId == request.auth.uid`.
