# Assessment 10: Git & Change Governance
**Objective**: Maintain reviewed changes for ledger and calculation logic, protected branches, migration reviews, semantic commits, and release tags. Demonstrate a safe hotfix workflow.

## 1. Learner Implementation Checklist
- [x] Branching and review governance policy documented in `docs/GOVERNANCE.md`.
- [x] Protected branches (`main`, `develop`): Requires 2 peer reviews including financial calculations code owner.
- [x] Semantic commits enforced: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.
- [x] Migration review protocol: Reversibility, non-blocking DDL, and immutability trigger validation.
- [x] Hotfix workflow demonstration: Branching off `main` for critical incident recovery with regression tests.

## 2. Evidence
- Clean commit history following Conventional Commits format in git repository.
