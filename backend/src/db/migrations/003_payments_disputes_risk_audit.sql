-- Migration 003: Payments, Disputes, Reconciliation, Risk Alerts, and Audit

-- Payment Intents (simulated gateway authorization)
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'REQUIRES_PAYMENT_METHOD' CHECK (status IN ('REQUIRES_PAYMENT_METHOD', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED')),
    provider_intent_id VARCHAR(128) UNIQUE,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    payment_method_type VARCHAR(50) DEFAULT 'CARD',
    journal_entry_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider ON payment_intents(provider_intent_id);

-- Provider Webhook Events for Deduplication
CREATE TABLE IF NOT EXISTS provider_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_event_id VARCHAR(128) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE')),
    signature VARCHAR(255),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_provider_event ON provider_webhook_events(provider_event_id);

-- Disputes
CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id UUID NOT NULL REFERENCES transfers(id) ON DELETE RESTRICT,
    claimant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED')),
    evidence JSONB DEFAULT '[]'::jsonb,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,
    reversal_journal_id UUID REFERENCES journal_entries(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_transfer ON disputes(transfer_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- Settlements (Batch Provider Reconciliation)
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id VARCHAR(64) UNIQUE NOT NULL,
    provider_id VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    total_amount NUMERIC(18, 4) NOT NULL,
    fee_amount NUMERIC(18, 4) NOT NULL,
    net_amount NUMERIC(18, 4) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RECONCILED', 'VARIANCE_FLAGGED')),
    internal_calculated_net NUMERIC(18, 4),
    variance NUMERIC(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Risk Alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    transaction_id UUID,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_tier VARCHAR(20) NOT NULL CHECK (risk_tier IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    triggers JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'CLEARED', 'FROZEN')),
    decision_support_note TEXT DEFAULT 'Risk scores provide decision support and require human operations review. Not definitive proof of fraud.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_alerts_tier ON risk_alerts(risk_tier);
CREATE INDEX IF NOT EXISTS idx_risk_alerts_user ON risk_alerts(user_id);

-- Immutable Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id),
    actor_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45),
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- Notification Sandbox Outbox
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('EMAIL', 'SMS')),
    destination VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SENT' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
