# Assessment 01: Financial Customer & Operations Frontend
**Objective**: Build responsive customer and operations dashboards for balances, beneficiaries, transfers, transaction history, disputes, and financial reports. Clearly label simulated balances and show transaction states.

## 1. Learner Implementation Checklist
- [x] Responsive Next.js App Router & Tailwind CSS UI implemented in `frontend/app/page.tsx`.
- [x] Clear and persistent simulated funds disclaimer: *"SIMULATED FUNDS ONLY - NO REAL BANKING CREDENTIALS OR VALUE"*.
- [x] Multi-currency wallet view (USD, EUR, GBP) displaying Total, Held, and Available balances.
- [x] Beneficiaries management UI with validated input controls.
- [x] Transfer wizard modal with beneficiary selection, amount input, fee preview, and step-up reauthentication for amounts >= $1,000.
- [x] Live transaction history with state badges (`COMPLETED`, `PENDING`, `REVERSED`, `FAILED`).
- [x] Customer dispute filing workflow with reason and evidence attachment.
- [x] Operations/Admin role switcher with dispute resolution queue, risk alerts center, and live double-entry ledger invariant inspector.

## 2. Acceptance Criteria Verification
- **Verified**: The interface runs from standard setup (`npm run dev:frontend` or production bundle `npm run build && npm run start`).
- **Verified**: Business logic and balances are validated server-side by the REST API, not just cosmetic in the interface.
- **Verified**: Handles invalid inputs (e.g. overdrafts, missing beneficiaries) with safe error alerts and no credential leakage.
- **Verified**: 1-click role switcher allows evaluators to seamlessly test all 5 roles during live technical review.

