# Firestore Security Specification — PulseVest Pro

## 1. Data Invariants
1. **Strict Owner Isolation**: All holdings (`/users/{userId}/holdings/{holdingId}`), watchlist items (`/users/{userId}/watchlist/{itemId}`), and mutual fund holdings (`/users/{userId}/mutualFunds/{fundHoldingId}`) belong exclusively to `userId == request.auth.uid` with a verified email (`request.auth.token.email_verified == true`).
2. **Identity Integrity**: Document `id` must match path `{holdingId}` / `{itemId}` / `{fundHoldingId}` and conform to `^[a-zA-Z0-9_\-]+$` (<= 128 chars). Field `userId` must match both `{userId}` path segment and `request.auth.uid`.
3. **Immutable Audit Fields**: `id`, `userId`, `symbol`/`schemeCode`, `exchange`/`planType`, `source`, and `createdAt` cannot be modified after creation.
4. **Server-Side Temporal Integrity**: `createdAt` (on create) and `updatedAt` (on create and update) must equal `request.time`.
5. **Bounded Types & Zero Shadow Fields**: Only allowlisted schema keys are permitted; numeric quantities/units and prices/NAVs must be strictly positive (`<= 10,000,000`), AMFI `schemeCode` must match `^[0-9]+$`, and string fields have strict `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Read or write `/users/u1/holdings/h1` with `request.auth == null`.
2. **Cross-Tenant Read**: Authenticated user `u2` attempts `get` or `list` on `/users/u1/holdings`.
3. **Cross-Tenant Create (Identity Spoofing)**: Authenticated user `u2` creates `/users/u2/holdings/h1` with `userId: "u1"`.
4. **Unverified Email Write**: Authenticated user `u1` with `email_verified: false` attempts to create a holding.
5. **Shadow / Ghost Field Injection**: Create holding with extra field `isAdmin: true` or `verified: true`.
6. **ID Poisoning (1KB+ ID)**: Create document with 1,500-character `{holdingId}` or invalid characters (`../evil`).
7. **Client Timestamp Spoofing**: Create or update holding with client-supplied past/future `createdAt` or `updatedAt != request.time`.
8. **Immutable Field Tampering**: Update holding changing `symbol` from `RELIANCE.NS` to `TCS.NS` or modifying `createdAt`.
9. **Negative / Zero Quantity Poisoning**: Create holding with `quantity: -10` or `avgBuyPrice: 0`.
10. **String Resource Exhaustion**: Create holding with 5,000-character `notes` or `companyName` (> maxLength).
11. **Invalid Enum Injection**: Create holding with `exchange: "NASDAQ"` or `source: "hacked"`.
12. **Unscoped List Scraping**: Attempt `list` on `/users/u1/holdings` without matching `resource.data.userId == request.auth.uid` or as another user.
