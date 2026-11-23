# Assessment 08: Payment & Notification Integrations
**Objective**: Integrate a payment provider in test mode plus email/SMS sandbox services. Verify signed webhooks, deduplicate events, and reconcile provider event IDs.

## 1. Learner Implementation Checklist
- [x] Simulated payment provider integration (`backend/src/modules/payments/payments.routes.ts`):
  - Payment intent lifecycle: `REQUIRES_PAYMENT_METHOD` -> `PROCESSING` -> `SUCCEEDED`.
  - Confirmation triggers atomic double-entry deposit (Debit Clearing Asset, Credit Customer Liability).
- [x] Cryptographic webhook signature verification:
  - Validates `fin-signature: t=<timestamp>,v1=<hmac>` using HMAC SHA-256 with timing-safe comparison.
  - Rejects timestamps older than 300 seconds.
- [x] Event deduplication: Replayed events with the same `provider_event_id` return `200 { status: 'DUPLICATE_IGNORED' }` without double crediting.
- [x] Sandbox notification outbox (`backend/src/modules/notifications/notifications.routes.ts`): Records dispatched emails and SMS alerts.

## 2. Test Evidence
- Verified in `backend/tests/payments_and_webhooks.test.ts`:
  - Signed webhook verification passed.
  - Tampered signature rejected with 400.
  - Duplicate replay deduplicated without extra ledger entry.
