# Assessment 14: Secure Deployment & Recovery
**Objective**: Deploy a simulated environment with HTTPS, restricted database access, encrypted backups, restore drills, monitoring, and separate test/staging/production configuration.

## 1. Learner Implementation Checklist
- [x] HTTPS and TLS configuration in `docker/nginx/nginx.conf` and `docker-compose.prod.yml`.
- [x] Database security: PostgreSQL runs strictly on private Docker network with zero public port exposure.
- [x] Automated encrypted backup scripts:
  - `scripts/backup.ps1` (PowerShell for Windows)
  - `scripts/backup.sh` (Bash for Linux/Docker)
  - Computes SHA-256 integrity checksum and encrypts with AES-256.
- [x] Disaster recovery restore drill scripts:
  - `scripts/restore.ps1`
  - `scripts/restore.sh`
  - Decrypts, verifies checksum, restores to isolated test DB, and validates ledger balance invariants.
- [x] Observability: Structured JSON logging, `/health` endpoint, and `/metrics` Prometheus-compatible gauge.
