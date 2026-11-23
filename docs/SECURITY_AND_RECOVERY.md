# FinCore Security Architecture & Disaster Recovery Plan

## 1. Role-Based Access Control (RBAC) Matrix
FinCore enforces strict server-side authorization across 5 distinct business roles:

| Module / Operation | Customer | Support Agent | Operations Analyst | Finance Admin | Platform Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Own Wallets & Balances | ✅ | ❌ | ❌ | ❌ | ❌ |
| Initiate Transfers | ✅ (Self) | ❌ | ❌ | ❌ | ❌ |
| Raise Transaction Dispute | ✅ (Self) | ❌ | ❌ | ❌ | ❌ |
| View Customer Account Details| ❌ | ✅ | ✅ | ❌ | ✅ |
| Review / Resolve Disputes | ❌ | ✅ | ✅ | ❌ | ✅ |
| View Risk Alerts & Freeze Account| ❌ | ❌ | ✅ | ❌ | ✅ |
| Run 3-Way Reconciliation | ❌ | ❌ | ✅ | ✅ | ✅ |
| View System Chart of Accounts | ❌ | ❌ | ❌ | ✅ | ✅ |
| Reverse Completed Transfer | ❌ | ❌ | ✅ | ✅ | ✅ |
| View Append-Only Audit Trail | ❌ | ❌ | ✅ | ✅ | ✅ |

## 2. Sensitive Action Reauthentication Protocol
To protect against session hijacking or unauthorized automated transfers:
- Any transfer where $\text{amount} \ge \$1,000.00$ USD requires step-up reauthentication.
- The client must call `POST /auth/reauth` passing the user's password or MFA code.
- FinCore issues a short-lived `reauthToken` (valid for 5 minutes).
- The client provides this in the `X-Reauth-Token` header.
- The server validates the token matches the authenticated session actor and has not expired.

## 3. Disaster Recovery (DR) & Backup Restoration Drills
- **Recovery Point Objective (RPO)**: < 15 minutes (hourly encrypted snapshots + continuous write-ahead logs).
- **Recovery Time Objective (RTO)**: < 2 minutes.
- **Backup Encryption**: Snapshots are dumped via `pg_dump`, checksummed using SHA-256, and encrypted with AES-256-GCM.
- **Restore Verification Drill**: Automated scripts (`scripts/restore.ps1` and `scripts/restore.sh`) decrypt snapshots, restore them into an isolated staging schema, and run double-entry balance audits before declaring recovery complete.

