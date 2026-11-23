# Assessment 03: Double-Entry Ledger Database
**Objective**: Design accounts, ledger entries, transactions, holds, settlements, and audit tables. Enforce immutable ledger entries, valid references, appropriate precision, and database constraints.

## 1. Learner Implementation Checklist
- [x] Complete PostgreSQL migration schema files created:
  - `001_initial_schema.sql`: users, refresh_tokens
  - `002_ledger_and_wallets.sql`: ledger_accounts, wallets, beneficiaries, journal_entries, ledger_entries, holds, transfers
  - `003_payments_disputes_risk_audit.sql`: payment_intents, provider_webhook_events, disputes, settlements, risk_alerts, audit_logs
  - `004_triggers_and_immutability.sql`: `trg_ledger_entry_immutability` trigger preventing UPDATE and DELETE
  - `005_seed_data.sql`: Chart of Accounts and initial system users
- [x] Immutability enforced: Ledger entries and audit records cannot be mutated or deleted.
- [x] Decimal precision: `NUMERIC(18, 4)` precision prevents floating-point penny drift.
- [x] Global balance invariant: `SUM(debits) === SUM(credits)` strictly maintained.

## 2. Test Evidence
- Verified in `backend/tests/disputes_and_ledger.test.ts` (unbalanced entries throw errors, balance holds deducted from available funds, global invariant test passes).

