# Assessment 11: Secure Financial CI/CD
**Objective**: Build pipelines with automated tests, dependency and secret scanning, image scanning, signed/versioned artifacts where available, staging validation, approvals, and rollback.

## 1. Learner Implementation Checklist
- [x] Continuous Integration workflow (`.github/workflows/ci.yml`):
  - Job 1: Backend tests (Jest/Supertest) + Capstone challenge verification.
  - Job 2: Python financial calculations & risk tests (Pytest).
  - Job 3: Frontend Next.js typecheck and production build.
- [x] Security Scanning workflow (`.github/workflows/security.yml`):
  - Secret scanning for accidental credential leaks.
  - Dependency vulnerability auditing (`npm audit`).
  - Container non-root user enforcement check.
- [x] Automated rollback procedures documented in `docs/SECURITY_AND_RECOVERY.md`.

