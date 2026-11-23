# FinCore Git & Change Governance Framework

## 1. Branching Model & Protected Branches
FinCore follows an enterprise Git flow designed for zero-disruption financial systems:
- `main`: Production-ready release branch. Strictly protected:
  - Requires signed commits.
  - Requires green CI checks (Backend Jest, Python Pytest, Frontend build, and Capstone verification).
  - Minimum of 2 senior peer reviews (including a financial calculations owner review for any changes to ledger or calculations logic).
- `develop`: Integration branch for tested sprint features.
- `feature/<ticket-id>-<description>`: Isolated feature branches.
- `hotfix/<incident-id>-<description>`: Expedited hotfix branch off `main` for critical incident recovery.

## 2. Semantic Commit Standard
Every commit must follow the Conventional Commits specification:
- `feat(ledger)`: New user-facing capability or ledger feature.
- `fix(concurrency)`: Bug fix in locking or calculation logic.
- `test(invariants)`: Add or modify test suites.
- `docs(contracts)`: Documentation and contract updates.
- `chore(devops)`: CI/CD, dependency updates, or Docker changes.

## 3. Database Migration Review Procedure
Any pull request that introduces or modifies a SQL migration file in `backend/src/db/migrations/` must adhere to:
1. **Reversibility**: Must have a corresponding rollback strategy.
2. **Backward Compatibility**: Migrations must never drop active columns or lock entire tables in single transaction blocks without timeout guards.
3. **Immutability Enforcement**: The `trg_ledger_entry_immutability` trigger must never be bypassed or weakened.

## 4. Hotfix Workflow Demonstration
When a production incident occurs (e.g. `INCIDENT-005` lock contention):
1. Branch directly from `main`: `git checkout -b hotfix/INCIDENT-005-ordered-locks main`
2. Implement root-cause fix and write regression test.
3. Run verification suite: `npm run test:backend && npm run test:capstone`.
4. Submit expedited PR with Incident Postmortem link.
5. Merge to `main`, tag semantic release (`v1.0.1`), and backport to `develop`.

