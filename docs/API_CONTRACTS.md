# FinCore Financial API Contracts Specification

## 1. Unified Response Envelope Standard
Every API response returned by FinCore adheres to a predictable JSON envelope:

### Success Response Format:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-11-23T22:30:00.000Z"
  }
}
```

### Error Response Format:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient available funds. Required: 101.0000 USD, Available: 50.0000 USD.",
    "details": { "required": "101.0000", "available": "50.0000", "currency": "USD" }
  },
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-11-23T22:30:00.000Z"
  }
}
```

## 2. Standard Error Taxonomy
| HTTP Status | Error Code | Description | Corrective Action |
| :--- | :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Request payload failed schema validation | Fix body according to error details |
| `401` | `UNAUTHORIZED` | Missing or expired JWT Bearer token | Call `/auth/refresh` or `/auth/login` |
| `401` | `INVALID_MFA_CODE` | 6-digit TOTP verification code rejected | Check authenticator app or use 123456 |
| `403` | `FORBIDDEN` | Role lacks permission for this resource | Request required staff role |
| `403` | `REAUTH_REQUIRED` | Sensitive action requires reauthentication | Provide valid `X-Reauth-Token` header |
| `404` | `RESOURCE_NOT_FOUND` | Wallet, user, or transfer ID does not exist | Verify UUID identifier |
| `409` | `CONCURRENT_REQUEST` | Transaction with key is currently processing | Wait and retry with backoff |
| `422` | `INSUFFICIENT_FUNDS`| Wallet available balance < amount + fee | Deposit funds or reduce amount |
| `422` | `UNBALANCED_LEDGER_ENTRY` | Debits do not equal credits | Ledger engine rejected invalid split |

## 3. Idempotency Key Specification
Clients must pass the `Idempotency-Key` header on all mutative requests (`POST /transfers`, `POST /payments/intents`).
- FinCore verifies whether a record already exists with the given key.
- If the previous execution was completed, FinCore replays the saved result with header `Idempotent-Replay: true` without double debiting.
- If payload parameters (source wallet, amount, currency) mismatch the original request, FinCore rejects the call with `422 IDEMPOTENCY_PAYLOAD_MISMATCH`.

## 4. Webhook Signature Verification Specification
External payment provider webhooks require the `fin-signature` header:
$$\text{Signature Header} = \texttt{t=1700000000,v1=HMAC-SHA256(secret, t.rawBody)}$$
FinCore validates:
1. Timestamp is within 300 seconds of current system clock (replay protection).
2. HMAC SHA-256 computation matches using constant-time comparison (`crypto.timingSafeEqual`).
3. `provider_event_id` is deduplicated against the `provider_webhook_events` table.

