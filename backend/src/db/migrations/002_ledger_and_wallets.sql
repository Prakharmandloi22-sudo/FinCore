-- Migration 002: Ledger Accounts, Wallets, Journal Entries, and Transfers

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    currency VARCHAR(3) NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_code ON ledger_accounts(code);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_type ON ledger_accounts(type);

-- Wallets (Customer accounts mapped to customer liability ledger account)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
    ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_currency UNIQUE (user_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- Beneficiaries
CREATE TABLE IF NOT EXISTS beneficiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_number VARCHAR(64) NOT NULL,
    routing_code VARCHAR(64) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_user ON beneficiaries(user_id);

-- Journal Entries (Header for multi-line transactions)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_number BIGSERIAL UNIQUE,
    reference_id VARCHAR(128),
    entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'FEE', 'INTEREST', 'REVERSAL', 'DISPUTE_ADJUSTMENT', 'SETTLEMENT')),
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING', 'POSTED', 'VOID')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_reference ON journal_entries(reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_type ON journal_entries(entry_type);

-- Ledger Entries (Atomic Debit/Credit lines - strictly immutable)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
    account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
    entry_side VARCHAR(6) NOT NULL CHECK (entry_side IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal ON ledger_entries(journal_entry_id);

-- Balance Holds
CREATE TABLE IF NOT EXISTS holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    reference_id VARCHAR(128) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'SETTLED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holds_wallet_status ON holds(wallet_id, status);

-- Transfers
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    destination_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,
    beneficiary_id UUID REFERENCES beneficiaries(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    amount NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
    fee NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED')),
    journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE RESTRICT,
    reversal_journal_id UUID REFERENCES journal_entries(id) ON DELETE RESTRICT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_source ON transfers(source_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON transfers(destination_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transfers_idempotency ON transfers(idempotency_key);

