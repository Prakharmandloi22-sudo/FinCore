# Assessment 05: Python Financial Calculations
**Objective**: Implement fee, interest, statement, and reconciliation calculations using Decimal rather than binary floating-point. Include rounding rules and boundary tests.

## 1. Learner Implementation Checklist
- [x] Python 3 microservice in `analytics-service/` using `decimal.Decimal` and `ROUND_HALF_EVEN` (Banker's rounding).
- [x] Tiered transfer fee calculations:
  - Free micro-transfers below $10.00
  - Domestic tier ($1.00 base + 0.5%)
  - Cross-border tier ($3.50 base + 1.5%)
  - Maximum fee cap at $25.00
- [x] Exact daily compound interest calculation: $A = P \times (1 + r/n)^{n \times t}$
- [x] Statement reconciliation: Opening Balance + Credits - Debits = Closing Balance.
- [x] Correctness & performance benchmark comparing `Decimal` vs IEEE 754 binary `float`, proving why floating-point accumulates non-zero penny drift.

## 2. Test Evidence
- Verified via `python -m pytest analytics-service/tests/test_calculations.py analytics-service/tests/test_benchmarks.py -v`.
- All tests passed. Benchmark proves exact 0.0000 drift with Decimal.

