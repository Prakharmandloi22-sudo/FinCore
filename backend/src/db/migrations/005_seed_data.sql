-- Migration 005: Seed Chart of Accounts and Initial System Records

-- Standard System Chart of Accounts
INSERT INTO ledger_accounts (id, code, name, type, currency, is_system, status)
VALUES
    ('11111111-1111-1111-1111-111111111000', '1000-CASH-RESERVE-USD', 'FinCore Settlement Reserve USD', 'ASSET', 'USD', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111111001', '1001-CASH-RESERVE-EUR', 'FinCore Settlement Reserve EUR', 'ASSET', 'EUR', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111111002', '1002-CASH-RESERVE-GBP', 'FinCore Settlement Reserve GBP', 'ASSET', 'GBP', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111111100', '1100-GATEWAY-CLEARING-USD', 'Payment Provider In-Transit Clearing USD', 'ASSET', 'USD', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111113000', '3000-PLATFORM-EQUITY', 'FinCore Platform Initial Equity', 'EQUITY', 'USD', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111114000', '4000-TRANSFER-FEE-REVENUE', 'Transfer Processing Fee Revenue', 'REVENUE', 'USD', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111115000', '5000-INTEREST-EXPENSE', 'Customer Deposit Interest Expense', 'EXPENSE', 'USD', true, 'ACTIVE'),
    ('11111111-1111-1111-1111-111111115100', '5100-PAYMENT-PROVIDER-FEES', 'External Payment Gateway Processing Expense', 'EXPENSE', 'USD', true, 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- Seed Users across all 5 roles
-- Note: password_hash corresponds to standard bcrypt hash of 'Password123!'
INSERT INTO users (id, email, password_hash, full_name, role, mfa_enabled, mfa_secret, is_active)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'customer@fincore.local', '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u', 'Alex Morgan (Customer)', 'customer', true, 'JBSWY3DPEHPK3PXP', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'support@fincore.local', '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u', 'Sam Taylor (Support Agent)', 'support_agent', true, 'JBSWY3DPEHPK3PXP', true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'ops@fincore.local', '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u', 'Jordan Lee (Operations Analyst)', 'operations_analyst', true, 'JBSWY3DPEHPK3PXP', true),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'finance@fincore.local', '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u', 'Elena Rostova (Finance Admin)', 'finance_administrator', true, 'JBSWY3DPEHPK3PXP', true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'admin@fincore.local', '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u', 'Marcus Vance (Platform Admin)', 'platform_administrator', true, 'JBSWY3DPEHPK3PXP', true),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'alice@fincore.local', '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u', 'Alice Smith (Counterparty)', 'customer', true, 'JBSWY3DPEHPK3PXP', true)
ON CONFLICT (email) DO NOTHING;

-- Seed Customer Ledger Accounts
INSERT INTO ledger_accounts (id, code, name, type, currency, is_system, status)
VALUES
    ('22222222-2222-2222-2222-222222222001', '2000-CUST-ALEX-USD', 'Customer Alex Deposit Liability USD', 'LIABILITY', 'USD', false, 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222002', '2001-CUST-ALEX-EUR', 'Customer Alex Deposit Liability EUR', 'LIABILITY', 'EUR', false, 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222003', '2002-CUST-ALICE-USD', 'Customer Alice Deposit Liability USD', 'LIABILITY', 'USD', false, 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- Seed Wallets
INSERT INTO wallets (id, user_id, currency, status, ledger_account_id)
VALUES
    ('33333333-3333-3333-3333-333333333001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'USD', 'ACTIVE', '22222222-2222-2222-2222-222222222001'),
    ('33333333-3333-3333-3333-333333333002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'EUR', 'ACTIVE', '22222222-2222-2222-2222-222222222002'),
    ('33333333-3333-3333-3333-333333333003', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'USD', 'ACTIVE', '22222222-2222-2222-2222-222222222003')
ON CONFLICT (user_id, currency) DO NOTHING;

-- Seed Initial Capitalization Journal Entry (Deposit $5,000 USD to Alex, $2,000 USD to Alice)
-- Balanced entry: Debit Asset Reserve $7,000, Credit Liability Alex $5,000, Credit Liability Alice $2,000
INSERT INTO journal_entries (id, reference_id, entry_type, description, status)
VALUES
    ('44444444-4444-4444-4444-444444444001', 'GENESIS-SEED-001', 'DEPOSIT', 'Initial simulated seed deposit into customer wallets', 'POSTED')
ON CONFLICT DO NOTHING;

INSERT INTO ledger_entries (id, journal_entry_id, account_id, entry_side, amount, currency)
VALUES
    ('55555555-5555-5555-5555-555555555001', '44444444-4444-4444-4444-444444444001', '11111111-1111-1111-1111-111111111000', 'DEBIT', 7000.0000, 'USD'),
    ('55555555-5555-5555-5555-555555555002', '44444444-4444-4444-4444-444444444001', '22222222-2222-2222-2222-222222222001', 'CREDIT', 5000.0000, 'USD'),
    ('55555555-5555-5555-5555-555555555003', '44444444-4444-4444-4444-444444444001', '22222222-2222-2222-2222-222222222003', 'CREDIT', 2000.0000, 'USD')
ON CONFLICT DO NOTHING;

-- Seed Beneficiaries for Alex
INSERT INTO beneficiaries (id, user_id, name, account_number, routing_code, currency, bank_name, is_verified)
VALUES
    ('66666666-6666-6666-6666-666666666001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Smith', 'US9876543210', '021000021', 'USD', 'Chase JPMorgan Simulated', true),
    ('66666666-6666-6666-6666-666666666002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TechCorp International', 'GB82BARC20202012345678', 'BARCGB22', 'GBP', 'Barclays Simulated UK', true)
ON CONFLICT DO NOTHING;
