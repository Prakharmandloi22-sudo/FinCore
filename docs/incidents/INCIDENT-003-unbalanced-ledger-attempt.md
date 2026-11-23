# Incident Postmortem: INCIDENT-003
**Title**: Unbalanced Ledger Entry Injection Attempt  
**Severity**: Sev-1 (Data Integrity Gatekeeper)  
**Status**: Mitigated by Database Trigger  

## 1. Executive Summary
A buggy integration script attempted to post a multi-line journal entry where total debits ($500.00) exceeded total credits ($400.00).

## 2. Root Cause
Client-side fee calculation defect passed an incomplete split array to the backend journal post endpoint.

## 3. Defense-in-Depth Protection & Verification
1. The Core Ledger Engine evaluated:
   $$\Delta = |\sum \text{Debits} - \sum \text{Credits}| = |500.00 - 400.00| = 100.00 \neq 0$$
2. The transaction was immediately aborted with `422 UNBALANCED_LEDGER_ENTRY`.
3. Database constraint trigger `trg_ledger_entry_immutability` verified no orphan lines were inserted.
4. Regression test `test_disputes_and_ledger.test.ts` confirms unbalanced attempts throw errors and rollback cleanly.
