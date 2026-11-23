# Incident Postmortem: INCIDENT-004
**Title**: High-Velocity Transfer Burst & Suspicious Outflow Detection  
**Severity**: Sev-2 (Fraud Prevention & Risk Monitoring)  
**Status**: Mitigated  

## 1. Executive Summary
An account initiated 5 transfers in 3 minutes totaling $9,500 USD immediately after adding a new unverified beneficiary. The FastAPI risk engine evaluated composite heuristics, scored the transaction at 88/100 (`CRITICAL`), and rejected the outbound transfer.

## 2. Risk Heuristics Evaluation
- `RAPID_NEW_BENEFICIARY_DRAIN`: Transfer attempted 2 minutes after adding beneficiary (+35)
- `HIGH_VELOCITY_5M`: 5 transactions in trailing 5 minutes (+25)
- `LARGE_SINGLE_TRANSFER`: Transfer amount >= $5,000 ceiling (+25)
- **Total Composite Score**: 85/100 -> Risk Tier: `CRITICAL`
- **Automated Recommendation**: `REJECT_AND_FREEZE`

## 3. Operations Response
1. The transaction was blocked prior to double-entry ledger execution.
2. A risk alert was queued in the Operations Analyst dashboard.
3. Operations analyst verified with customer, identifying an unauthorized automated script. The account was temporarily frozen to prevent credential stuffing.

