-- Migration 004: Triggers and Immutability Safeguards

-- Function to prevent modification or deletion of ledger entries
CREATE OR REPLACE FUNCTION enforce_ledger_entry_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'FinCore Ledger Violation: ledger_entries are strictly immutable and cannot be updated.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'FinCore Ledger Violation: ledger_entries are strictly immutable and cannot be deleted.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ledger_entry_immutability ON ledger_entries;
CREATE TRIGGER trg_ledger_entry_immutability
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION enforce_ledger_entry_immutability();

-- Function to prevent modification or deletion of audit logs
CREATE OR REPLACE FUNCTION enforce_audit_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'FinCore Security Violation: audit_logs are strictly append-only and cannot be altered or removed.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutability ON audit_logs;
CREATE TRIGGER trg_audit_log_immutability
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_audit_log_immutability();
