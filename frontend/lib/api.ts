export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'customer' | 'support_agent' | 'operations_analyst' | 'finance_administrator' | 'platform_administrator';
}

export interface WalletBalances {
  total: string;
  held: string;
  available: string;
  disclaimer?: string;
}

export interface Wallet {
  id: string;
  currency: 'USD' | 'EUR' | 'GBP';
  status: string;
  balances: WalletBalances;
}

export interface Transfer {
  id: string;
  source_wallet_id: string;
  destination_wallet_id: string | null;
  amount: string;
  fee: string;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  idempotency_key: string;
  created_at: string;
}

export interface Dispute {
  id: string;
  transfer_id: string;
  amount: string;
  currency: string;
  reason: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
}

// Pre-configured role accounts for 1-click live demo role switcher
export const DEMO_USERS = [
  { role: 'customer', email: 'customer@fincore.local', name: 'Alex Morgan (Customer)' },
  { role: 'support_agent', email: 'support@fincore.local', name: 'Sam Taylor (Support Agent)' },
  { role: 'operations_analyst', email: 'ops@fincore.local', name: 'Jordan Lee (Ops Analyst)' },
  { role: 'finance_administrator', email: 'finance@fincore.local', name: 'Elena Rostova (Finance Admin)' },
  { role: 'platform_administrator', email: 'admin@fincore.local', name: 'Marcus Vance (Platform Admin)' }
];

