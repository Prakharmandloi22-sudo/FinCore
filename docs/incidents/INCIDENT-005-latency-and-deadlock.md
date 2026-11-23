# Incident Postmortem: INCIDENT-005
**Title**: Concurrent Transfer Lock Contention and Deadlock Resolution  
**Severity**: Sev-2 (Transaction Latency Spike & Deadlock)  
**Status**: Resolved via Lexicographical Lock Acquisition  

## 1. Executive Summary
Under high concurrent load between reciprocal transfers (User A transferring to User B simultaneously while User B transfers to User A), PostgreSQL deadlocks occurred (`ERROR: deadlock detected; Process 4012 waits for ShareLock on transaction 8891`).

## 2. Root Cause Analysis
- Transaction 1 locked Account A first, then requested Account B.
- Transaction 2 locked Account B first, then requested Account A.
- This produced a textbook circular wait deadlock condition.

## 3. Engineering Resolution
We enforced **lexicographically ordered lock acquisition**:
```typescript
const lockAccounts = [sourceWalletId, destinationWalletId].sort();
for (const accountId of lockAccounts) {
  await acquireLock(accountId);
}
```
Because both transactions now acquire locks in identical global order (e.g. Account A before Account B), circular waits are mathematically impossible.
Latencies dropped from 2,400ms to under 45ms.
4. Regression test: `tests/wallets_and_transfers.test.ts` (10 concurrent transfers executing simultaneously with zero deadlocks).
