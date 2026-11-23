import { v4 as uuidv4 } from 'uuid';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  mfa_enabled: boolean;
  mfa_secret: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  revoked: boolean;
  expires_at: string;
  created_at: string;
}

export interface LedgerAccountRow {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  currency: string;
  is_system: boolean;
  status: string;
  created_at: string;
}

export interface WalletRow {
  id: string;
  user_id: string;
  currency: string;
  status: string;
  ledger_account_id: string;
  created_at: string;
  updated_at: string;
}

export interface BeneficiaryRow {
  id: string;
  user_id: string;
  name: string;
  account_number: string;
  routing_code: string;
  currency: string;
  bank_name: string;
  is_verified: boolean;
  created_at: string;
}

export interface JournalEntryRow {
  id: string;
  entry_number: number;
  reference_id: string | null;
  entry_type: string;
  description: string;
  status: 'PENDING' | 'POSTED' | 'VOID';
  created_at: string;
}

export interface LedgerEntryRow {
  id: string;
  journal_entry_id: string;
  account_id: string;
  entry_side: 'DEBIT' | 'CREDIT';
  amount: string; // Decimal string
  currency: string;
  created_at: string;
}

export interface HoldRow {
  id: string;
  wallet_id: string;
  reference_id: string;
  amount: string;
  status: 'ACTIVE' | 'RELEASED' | 'SETTLED';
  expires_at: string;
  created_at: string;
}

export interface TransferRow {
  id: string;
  source_wallet_id: string;
  destination_wallet_id: string | null;
  beneficiary_id: string | null;
  idempotency_key: string;
  amount: string;
  fee: string;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  journal_entry_id: string | null;
  reversal_journal_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntentRow {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: string;
  currency: string;
  status: 'REQUIRES_PAYMENT_METHOD' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  provider_intent_id: string | null;
  idempotency_key: string;
  payment_method_type: string;
  journal_entry_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEventRow {
  id: string;
  provider_event_id: string;
  event_type: string;
  payload: any;
  status: string;
  signature: string | null;
  received_at: string;
}

export interface DisputeRow {
  id: string;
  transfer_id: string;
  claimant_id: string;
  amount: string;
  currency: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  evidence: any[];
  resolved_by: string | null;
  resolution_notes: string | null;
  reversal_journal_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementRow {
  id: string;
  batch_id: string;
  provider_id: string;
  currency: string;
  total_amount: string;
  fee_amount: string;
  net_amount: string;
  status: string;
  internal_calculated_net: string | null;
  variance: string;
  created_at: string;
}

export interface RiskAlertRow {
  id: string;
  user_id: string | null;
  transaction_id: string | null;
  risk_score: number;
  risk_tier: string;
  triggers: any[];
  status: string;
  decision_support_note: string;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string | null;
  previous_state: any | null;
  new_state: any | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  destination: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string;
}

export class MemoryStore {
  users: Map<string, UserRow> = new Map();
  refreshTokens: Map<string, RefreshTokenRow> = new Map();
  ledgerAccounts: Map<string, LedgerAccountRow> = new Map();
  wallets: Map<string, WalletRow> = new Map();
  beneficiaries: Map<string, BeneficiaryRow> = new Map();
  journalEntries: Map<string, JournalEntryRow> = new Map();
  ledgerEntries: Map<string, LedgerEntryRow> = new Map();
  holds: Map<string, HoldRow> = new Map();
  transfers: Map<string, TransferRow> = new Map();
  paymentIntents: Map<string, PaymentIntentRow> = new Map();
  webhookEvents: Map<string, WebhookEventRow> = new Map();
  disputes: Map<string, DisputeRow> = new Map();
  settlements: Map<string, SettlementRow> = new Map();
  riskAlerts: Map<string, RiskAlertRow> = new Map();
  auditLogs: Map<string, AuditLogRow> = new Map();
  notifications: Map<string, NotificationRow> = new Map();

  private journalCounter = 1;

  constructor() {
    this.seedDefaults();
  }

  reset() {
    this.users.clear();
    this.refreshTokens.clear();
    this.ledgerAccounts.clear();
    this.wallets.clear();
    this.beneficiaries.clear();
    this.journalEntries.clear();
    this.ledgerEntries.clear();
    this.holds.clear();
    this.transfers.clear();
    this.paymentIntents.clear();
    this.webhookEvents.clear();
    this.disputes.clear();
    this.settlements.clear();
    this.riskAlerts.clear();
    this.auditLogs.clear();
    this.notifications.clear();
    this.journalCounter = 1;
    this.seedDefaults();
  }

  seedDefaults() {
    // 1. Chart of Accounts
    const defaultAccounts: LedgerAccountRow[] = [
      { id: '11111111-1111-1111-1111-111111111000', code: '1000-CASH-RESERVE-USD', name: 'FinCore Settlement Reserve USD', type: 'ASSET', currency: 'USD', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111111001', code: '1001-CASH-RESERVE-EUR', name: 'FinCore Settlement Reserve EUR', type: 'ASSET', currency: 'EUR', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111111002', code: '1002-CASH-RESERVE-GBP', name: 'FinCore Settlement Reserve GBP', type: 'ASSET', currency: 'GBP', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111111100', code: '1100-GATEWAY-CLEARING-USD', name: 'Payment Provider In-Transit Clearing USD', type: 'ASSET', currency: 'USD', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111113000', code: '3000-PLATFORM-EQUITY', name: 'FinCore Platform Initial Equity', type: 'EQUITY', currency: 'USD', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111114000', code: '4000-TRANSFER-FEE-REVENUE', name: 'Transfer Processing Fee Revenue', type: 'REVENUE', currency: 'USD', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111115000', code: '5000-INTEREST-EXPENSE', name: 'Customer Deposit Interest Expense', type: 'EXPENSE', currency: 'USD', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '11111111-1111-1111-1111-111111115100', code: '5100-PAYMENT-PROVIDER-FEES', name: 'External Payment Gateway Processing Expense', type: 'EXPENSE', currency: 'USD', is_system: true, status: 'ACTIVE', created_at: new Date().toISOString() },
      // Customer deposit accounts
      { id: '22222222-2222-2222-2222-222222222001', code: '2000-CUST-ALEX-USD', name: 'Customer Alex Deposit Liability USD', type: 'LIABILITY', currency: 'USD', is_system: false, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '22222222-2222-2222-2222-222222222002', code: '2001-CUST-ALEX-EUR', name: 'Customer Alex Deposit Liability EUR', type: 'LIABILITY', currency: 'EUR', is_system: false, status: 'ACTIVE', created_at: new Date().toISOString() },
      { id: '22222222-2222-2222-2222-222222222003', code: '2002-CUST-ALICE-USD', name: 'Customer Alice Deposit Liability USD', type: 'LIABILITY', currency: 'USD', is_system: false, status: 'ACTIVE', created_at: new Date().toISOString() }
    ];
    defaultAccounts.forEach(acc => this.ledgerAccounts.set(acc.id, acc));

    // 2. Users (Password is 'Password123!')
    // Precalculated valid bcrypt hash for 'Password123!'
    const hash = '$2a$10$VsS6smYR4rFyqCO1g5JaWO5EzTDY51Q/aRQg1DN/TXXSzqaBKxs3u';
    const defaultUsers: UserRow[] = [
      { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'customer@fincore.local', password_hash: hash, full_name: 'Alex Morgan (Customer)', role: 'customer', mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'support@fincore.local', password_hash: hash, full_name: 'Sam Taylor (Support Agent)', role: 'support_agent', mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'ops@fincore.local', password_hash: hash, full_name: 'Jordan Lee (Operations Analyst)', role: 'operations_analyst', mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', email: 'finance@fincore.local', password_hash: hash, full_name: 'Elena Rostova (Finance Admin)', role: 'finance_administrator', mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', email: 'admin@fincore.local', password_hash: hash, full_name: 'Marcus Vance (Platform Admin)', role: 'platform_administrator', mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', email: 'alice@fincore.local', password_hash: hash, full_name: 'Alice Smith (Counterparty)', role: 'customer', mfa_enabled: true, mfa_secret: 'JBSWY3DPEHPK3PXP', is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    defaultUsers.forEach(u => this.users.set(u.id, u));

    // 3. Wallets
    const defaultWallets: WalletRow[] = [
      { id: '33333333-3333-3333-3333-333333333001', user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', currency: 'USD', status: 'ACTIVE', ledger_account_id: '22222222-2222-2222-2222-222222222001', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '33333333-3333-3333-3333-333333333002', user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', currency: 'EUR', status: 'ACTIVE', ledger_account_id: '22222222-2222-2222-2222-222222222002', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '33333333-3333-3333-3333-333333333003', user_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', currency: 'USD', status: 'ACTIVE', ledger_account_id: '22222222-2222-2222-2222-222222222003', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    defaultWallets.forEach(w => this.wallets.set(w.id, w));

    // 4. Beneficiaries
    const defaultBeneficiaries: BeneficiaryRow[] = [
      { id: '66666666-6666-6666-6666-666666666001', user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Alice Smith', account_number: 'US9876543210', routing_code: '021000021', currency: 'USD', bank_name: 'Chase JPMorgan Simulated', is_verified: true, created_at: new Date().toISOString() },
      { id: '66666666-6666-6666-6666-666666666002', user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'TechCorp International', account_number: 'GB82BARC20202012345678', routing_code: 'BARCGB22', currency: 'GBP', bank_name: 'Barclays Simulated UK', is_verified: true, created_at: new Date().toISOString() }
    ];
    defaultBeneficiaries.forEach(b => this.beneficiaries.set(b.id, b));

    // 5. Genesis Journal Entry: Initial simulated deposits
    const genesisJournal: JournalEntryRow = {
      id: '44444444-4444-4444-4444-444444444001',
      entry_number: this.journalCounter++,
      reference_id: 'GENESIS-SEED-001',
      entry_type: 'DEPOSIT',
      description: 'Initial simulated seed deposit into customer wallets',
      status: 'POSTED',
      created_at: new Date().toISOString()
    };
    this.journalEntries.set(genesisJournal.id, genesisJournal);

    const genesisLines: LedgerEntryRow[] = [
      // Debit Cash Reserve USD $7,000
      { id: '55555555-5555-5555-5555-555555555001', journal_entry_id: genesisJournal.id, account_id: '11111111-1111-1111-1111-111111111000', entry_side: 'DEBIT', amount: '7000.0000', currency: 'USD', created_at: new Date().toISOString() },
      // Credit Alex USD $5,000
      { id: '55555555-5555-5555-5555-555555555002', journal_entry_id: genesisJournal.id, account_id: '22222222-2222-2222-2222-222222222001', entry_side: 'CREDIT', amount: '5000.0000', currency: 'USD', created_at: new Date().toISOString() },
      // Credit Alice USD $2,000
      { id: '55555555-5555-5555-5555-555555555003', journal_entry_id: genesisJournal.id, account_id: '22222222-2222-2222-2222-222222222003', entry_side: 'CREDIT', amount: '2000.0000', currency: 'USD', created_at: new Date().toISOString() }
    ];
    genesisLines.forEach(l => this.ledgerEntries.set(l.id, l));
  }

  // Double-entry balance calculation for a ledger account
  calculateAccountBalance(accountId: string): string {
    const account = this.ledgerAccounts.get(accountId);
    if (!account) return '0.0000';

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of this.ledgerEntries.values()) {
      if (entry.account_id === accountId) {
        const amt = parseFloat(entry.amount);
        if (entry.entry_side === 'DEBIT') totalDebits += amt;
        if (entry.entry_side === 'CREDIT') totalCredits += amt;
      }
    }

    // Normal balance rule:
    // Assets & Expenses: Balance = Debits - Credits
    // Liabilities, Equity & Revenue: Balance = Credits - Debits
    let balance = 0;
    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      balance = totalDebits - totalCredits;
    } else {
      balance = totalCredits - totalDebits;
    }

    return balance.toFixed(4);
  }

  getWalletBalances(walletId: string): { total: string; held: string; available: string; currency: string } {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const totalBalance = this.calculateAccountBalance(wallet.ledger_account_id);
    let held = 0;

    for (const hold of this.holds.values()) {
      if (hold.wallet_id === walletId && hold.status === 'ACTIVE') {
        held += parseFloat(hold.amount);
      }
    }

    const available = Math.max(0, parseFloat(totalBalance) - held);

    return {
      total: totalBalance,
      held: held.toFixed(4),
      available: available.toFixed(4),
      currency: wallet.currency
    };
  }

  // Atomically post double-entry journal entry with immutability and balance verification
  postJournalEntry(
    referenceId: string | null,
    entryType: string,
    description: string,
    lines: Array<{ accountId: string; entrySide: 'DEBIT' | 'CREDIT'; amount: string; currency: string }>
  ): JournalEntryRow {
    // 1. Invariant check: Sum of Debits MUST strictly equal Sum of Credits
    let debitSum = 0;
    let creditSum = 0;

    for (const line of lines) {
      const amt = parseFloat(line.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error(`Invalid line amount: ${line.amount}`);
      }
      if (line.entrySide === 'DEBIT') debitSum += amt;
      else if (line.entrySide === 'CREDIT') creditSum += amt;
      else throw new Error(`Invalid entry side: ${line.entrySide}`);
    }

    const diff = Math.abs(debitSum - creditSum);
    if (diff > 0.0001) {
      throw new Error(`Unbalanced journal entry! Debits=${debitSum.toFixed(4)}, Credits=${creditSum.toFixed(4)}, Difference=${diff.toFixed(4)}`);
    }

    // 2. Create Journal Header
    const journalId = uuidv4();
    const journal: JournalEntryRow = {
      id: journalId,
      entry_number: this.journalCounter++,
      reference_id: referenceId,
      entry_type: entryType,
      description,
      status: 'POSTED',
      created_at: new Date().toISOString()
    };
    this.journalEntries.set(journalId, journal);

    // 3. Create Immutable Ledger Entries
    for (const line of lines) {
      const lineId = uuidv4();
      const lineRow: LedgerEntryRow = {
        id: lineId,
        journal_entry_id: journalId,
        account_id: line.accountId,
        entry_side: line.entrySide,
        amount: parseFloat(line.amount).toFixed(4),
        currency: line.currency,
        created_at: new Date().toISOString()
      };
      this.ledgerEntries.set(lineId, lineRow);
    }

    return journal;
  }

  // Global Ledger Invariant Verification: SUM(all debits) === SUM(all credits)
  verifyGlobalBalanceInvariant(): { isBalanced: boolean; totalDebits: string; totalCredits: string; difference: string } {
    let debits = 0;
    let credits = 0;

    for (const entry of this.ledgerEntries.values()) {
      const amt = parseFloat(entry.amount);
      if (entry.entry_side === 'DEBIT') debits += amt;
      else credits += amt;
    }

    const diff = Math.abs(debits - credits);
    return {
      isBalanced: diff < 0.0001,
      totalDebits: debits.toFixed(4),
      totalCredits: credits.toFixed(4),
      difference: diff.toFixed(4)
    };
  }
}

export const memoryStore = new MemoryStore();
