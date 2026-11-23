# Incident Postmortem: INCIDENT-001
**Title**: Duplicate Payment Provider Webhook Storm  
**Severity**: Sev-1 (Critical Data Integrity Risk)  
**Status**: Resolved & Prevented  
**Lead Investigator**: Core Financial Architecture Team  

## 1. Executive Summary
During a simulated payment gateway failover, the external payment provider replayed 1,200 webhook events within a 2-minute window. An unindexed event receiver led to duplicate ledger credits for customer deposits, temporarily inflating liability balances.

## 2. Timeline (UTC)
- **10:14:00**: Gateway network blip; provider begins bulk retry of pending webhook events.
- **10:14:22**: Operations monitoring triggers Sev-1 alert: customer wallet balances rising without corresponding gateway settlements.
- **10:15:05**: Incident response initiated; gateway webhook receiver placed in maintenance queue.
- **10:16:30**: Root cause identified: `provider_event_id` lacked a unique constraint and database-level deduplication table.
- **10:20:00**: Hotfix deployed: `provider_webhook_events` table enforced with `UNIQUE(provider_event_id)` and idempotency store check in Redis/memory.
- **10:25:00**: Erroneous duplicate credits identified via journal entry references and safely reversed. Total platform debits and credits rebalanced.

## 3. Root Cause
The webhook processing handler assumed upstream providers guarantee at-most-once delivery. Under network partitions, payment providers operate with **at-least-once** semantics, generating identical signed payloads with identical event IDs.

## 4. Corrective & Preventative Actions
1. **Event Deduplication Table**: Every received event is stored in `provider_webhook_events` under a unique constraint. Duplicate payloads return `200 { status: 'DUPLICATE_IGNORED' }` without invoking the ledger.
2. **Automated Regression Test**: Added `tests/payments_and_webhooks.test.ts` verifying duplicate webhook replays execute exactly zero duplicate ledger entries.
3. **Double-Entry Invariant Alert**: Automated health check monitors ledger balance every 30 seconds.

