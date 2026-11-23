# Assessment 06: FastAPI Risk Analytics
**Objective**: Create an analytics service for transaction velocity, unusual patterns, risk flags, and operations reporting using synthetic data. Explain that risk scores are decision support, not proof of fraud.

## 1. Learner Implementation Checklist
- [x] Multi-factor risk heuristics engine implemented in `analytics-service/app/risk/engine.py`.
- [x] Velocity metrics: 5-minute transaction count, 1-hour count and volume, 24-hour total.
- [x] Heuristic triggers:
  - `HIGH_VELOCITY_5M`: >= 3 transactions in 5 minutes (+25)
  - `UNUSUAL_AMOUNT_SPIKE`: > 3.0x historical average (+30)
  - `LARGE_SINGLE_TRANSFER`: >= $5,000 threshold (+25)
  - `RAPID_NEW_BENEFICIARY_DRAIN`: transfer <= 15 mins after beneficiary creation (+35)
  - `FAILED_ATTEMPTS_BURST`: >= 3 failed attempts in last hour (+30)
- [x] Composite risk score (0-100) mapped to tiers: `LOW` (0-25), `MEDIUM` (26-60), `HIGH` (61-80), `CRITICAL` (81-100).
- [x] Decision support disclaimer returned on all responses: *"Risk scores are decision support only, not proof of fraud. High-risk transactions must be investigated by an operations analyst."*
- [x] Operations reporting endpoint with synthetic data generation.

## 2. Test Evidence
- Verified via `python -m pytest analytics-service/tests/test_risk.py -v`. All 4 risk test suites passed.

