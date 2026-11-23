# Incident Postmortem: INCIDENT-002
**Title**: Mismatched Payment Provider Settlement Reconciliation Variance  
**Severity**: Sev-2 (Financial Discrepancy)  
**Status**: Resolved  

## 1. Executive Summary
Daily automated batch settlement reconciliation between internal clearing accounts and external gateway reports flagged a $45.20 variance on batch `BATCH-2026-11-20`.

## 2. Root Cause
The payment provider deducted an unexpected international interchange surcharge of 0.8% on three cross-border card transactions without providing itemized fee breakdown tags in the instant webhook payloads.

## 3. Corrective Action & Recovery
1. The 3-way reconciliation engine (`perform_reconciliation`) flagged the discrepancy with status `VARIANCE_FLAGGED`.
2. Operations analysts reviewed the itemized external settlement file, identified the missing fee deduction, and created an itemized adjusting journal entry:
   - Debit: `5100-PAYMENT-PROVIDER-FEES` ($45.20)
   - Credit: `1100-GATEWAY-CLEARING-USD` ($45.20)
3. Clearing account reconciled to exactly $0.00 variance.
