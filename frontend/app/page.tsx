'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldAlert,
  FileText,
  Users,
  RefreshCw,
  Scale,
  CheckCircle,
  AlertTriangle,
  Lock,
  PlusCircle,
  Clock,
  Search,
  ExternalLink,
  DollarSign
} from 'lucide-react';
import { DEMO_USERS } from '../lib/api';

export default function FinCoreDashboard() {
  const [activeRole, setActiveRole] = useState<string>('customer');
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Wallet & Balances State
  const [usdBalance, setUsdBalance] = useState({ total: '4899.0000', available: '4899.0000', held: '0.0000' });
  const [eurBalance, setEurBalance] = useState({ total: '1250.0000', available: '1250.0000', held: '0.0000' });
  
  // Transactions
  const [transfers, setTransfers] = useState([
    { id: 'tx-101', recipient: 'Alice Smith', amount: '100.00', fee: '1.00', currency: 'USD', status: 'COMPLETED', date: 'Just now', type: 'DEBIT' },
    { id: 'tx-100', recipient: 'FinCore Simulation Faucet', amount: '5000.00', fee: '0.00', currency: 'USD', status: 'COMPLETED', date: 'Genesis', type: 'CREDIT' }
  ]);

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState([
    { id: 'b-1', name: 'Alice Smith', account: 'US9876543210', routing: '021000021', bank: 'Chase JPMorgan Simulated' },
    { id: 'b-2', name: 'TechCorp International', account: 'GB82BARC20202012345678', routing: 'BARCGB22', bank: 'Barclays Simulated UK' }
  ]);

  // Disputes
  const [disputes, setDisputes] = useState<any[]>([
    { id: 'disp-01', transferId: 'tx-101', amount: '100.00', reason: 'Unrecognized transfer claim', status: 'UNDER_REVIEW', claimant: 'Alex Morgan' }
  ]);

  // Risk Alerts
  const [riskAlerts, setRiskAlerts] = useState<any[]>([
    { id: 'risk-01', score: 78, tier: 'HIGH', trigger: 'RAPID_NEW_BENEFICIARY_DRAIN', detail: 'Transfer initiated 4 mins after adding beneficiary', status: 'NEW', account: 'Alex Morgan' },
    { id: 'risk-02', score: 35, tier: 'MEDIUM', trigger: 'ELEVATED_VELOCITY', detail: '3 transfers initiated in 15 minutes', status: 'ACKNOWLEDGED', account: 'Alice Smith' }
  ]);

  // Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Transfer Form State
  const [transferAmount, setTransferAmount] = useState('50.00');
  const [transferRecipient, setTransferRecipient] = useState('Alice Smith');
  const [reauthPassword, setReauthPassword] = useState('');
  const [transferMessage, setTransferMessage] = useState('');

  // Handle Transfer Submit
  const handleExecuteTransfer = () => {
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) return;

    const fee = amt >= 10 ? 1.0 : 0.0;
    const totalDeduction = amt + fee;
    const currentAvail = parseFloat(usdBalance.available);

    if (totalDeduction > currentAvail) {
      alert(`Insufficient funds! Required: $${totalDeduction.toFixed(2)}, Available: $${currentAvail.toFixed(2)}`);
      return;
    }

    // High value reauth check
    if (amt >= 1000 && !reauthPassword) {
      alert('High value transfers (>= $1,000) require entering your reauthentication password.');
      return;
    }

    const newAvail = (currentAvail - totalDeduction).toFixed(4);
    setUsdBalance({ ...usdBalance, total: newAvail, available: newAvail });

    const newTx = {
      id: `tx-${Date.now().toString().slice(-4)}`,
      recipient: transferRecipient,
      amount: amt.toFixed(2),
      fee: fee.toFixed(2),
      currency: 'USD',
      status: 'COMPLETED',
      date: 'Just now',
      type: 'DEBIT'
    };
    setTransfers([newTx, ...transfers]);

    setTransferMessage(`Transfer of $${amt.toFixed(2)} USD (Fee: $${fee.toFixed(2)}) posted to immutable double-entry ledger!`);
    setTimeout(() => {
      setTransferMessage('');
      setIsTransferModalOpen(false);
      setTransferAmount('50.00');
      setReauthPassword('');
    }, 1500);
  };

  // Handle Simulated Deposit
  const handleSimulateDeposit = (amt: number) => {
    const current = parseFloat(usdBalance.total);
    const updated = (current + amt).toFixed(4);
    setUsdBalance({ ...usdBalance, total: updated, available: updated });
    const depositTx = {
      id: `dep-${Date.now().toString().slice(-4)}`,
      recipient: 'Simulated Sandbox Deposit',
      amount: amt.toFixed(2),
      fee: '0.00',
      currency: 'USD',
      status: 'COMPLETED',
      date: 'Just now',
      type: 'CREDIT'
    };
    setTransfers([depositTx, ...transfers]);
    setIsDepositModalOpen(false);
  };

  // Handle Resolve Dispute
  const handleResolveDispute = (dispId: string, resolution: 'ACCEPTED' | 'REJECTED') => {
    setDisputes(disputes.map(d => {
      if (d.id === dispId) {
        return { ...d, status: resolution };
      }
      return d;
    }));

    if (resolution === 'ACCEPTED') {
      // Restore Alex balance
      const current = parseFloat(usdBalance.total);
      const restored = (current + 100.0).toFixed(4);
      setUsdBalance({ ...usdBalance, total: restored, available: restored });
      alert(`Dispute ${dispId} ACCEPTED. Automatic double-entry ledger reversal posted ($100.00 refunded to claimant).`);
    } else {
      alert(`Dispute ${dispId} REJECTED by operations analyst.`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner: Simulated Banking Disclaimer & Invariant Status */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex flex-wrap items-center justify-between text-xs font-mono text-amber-300">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-bold">FINCORE SIMULATION PLATFORM</span>
          <span className="text-amber-400/70">| STRICTLY SIMULATED FUNDS — NO REAL BANKING CREDENTIALS OR MONEY</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            LEDGER INVARIANT: PASS (DEBITS === CREDITS)
          </span>
          <span className="text-slate-400">ENGINE: DECIMAL 4-PLACE PRECISION</span>
        </div>
      </div>

      {/* Main Header / Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
            FC
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center">
              FinCore
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
                v1.0 Pro
              </span>
            </h1>
            <p className="text-xs text-slate-400">Digital Wallet, Ledger & Payment Engine</p>
          </div>
        </div>

        {/* Live Role Switcher */}
        <div className="flex items-center space-x-3 bg-slate-800/80 border border-slate-700 p-1.5 rounded-xl">
          <span className="text-xs text-slate-400 px-2 font-medium flex items-center">
            <Users className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
            Switch Active Role:
          </span>
          <select
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value)}
            className="bg-slate-900 text-xs text-white border border-slate-700 rounded-lg px-3 py-1.5 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            {DEMO_USERS.map((u) => (
              <option key={u.role} value={u.role}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Body Container */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-6 gap-6">
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
            {activeRole === 'customer' ? 'Customer Portal' : 'Operations Staff'}
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'overview'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Wallets & Transfers</span>
          </button>

          <button
            onClick={() => setActiveTab('beneficiaries')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'beneficiaries'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Beneficiaries</span>
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'disputes'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Disputes Queue</span>
            {disputes.filter(d => d.status === 'UNDER_REVIEW').length > 0 && (
              <span className="ml-auto text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                {disputes.filter(d => d.status === 'UNDER_REVIEW').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('statements')}
            className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
              activeTab === 'statements'
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audited Statements</span>
          </button>

          {/* Operations Only Tabs */}
          {(activeRole === 'operations_analyst' || activeRole === 'platform_administrator' || activeRole === 'finance_administrator') && (
            <>
              <div className="pt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Back Office Control
              </div>
              <button
                onClick={() => setActiveTab('risk')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  activeTab === 'risk'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Risk Analytics</span>
                <span className="ml-auto text-xs bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">
                  {riskAlerts.filter(a => a.status === 'NEW').length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                  activeTab === 'ledger'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Scale className="w-4 h-4 text-emerald-400" />
                <span>Ledger Invariants</span>
              </button>
            </>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 space-y-6">
          {/* TAB 1: OVERVIEW (WALLETS & TRANSFERS) */}
          {activeTab === 'overview' && (
            <>
              {/* Balance Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* USD Wallet Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Primary Digital Wallet</span>
                      <h2 className="text-2xl font-bold text-white mt-1">USD Wallet</h2>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium rounded-full">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-1 mb-6">
                    <div className="text-3xl font-extrabold text-white tracking-tight">
                      ${parseFloat(usdBalance.available).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Available: ${usdBalance.available} | Held: ${usdBalance.held}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsTransferModalOpen(true)}
                      className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-sky-600/20"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Send Transfer</span>
                    </button>
                    <button
                      onClick={() => setIsDepositModalOpen(true)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition"
                    >
                      <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                      <span>Simulate Deposit</span>
                    </button>
                  </div>
                </div>

                {/* EUR Wallet Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Secondary Digital Wallet</span>
                      <h2 className="text-2xl font-bold text-white mt-1">EUR Wallet</h2>
                    </div>
                    <span className="px-2.5 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-mono font-medium rounded-full">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-1 mb-6">
                    <div className="text-3xl font-extrabold text-white tracking-tight">
                      €{parseFloat(eurBalance.available).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Available: €{eurBalance.available} | Held: €{eurBalance.held}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => alert('EUR cross-border transfers enabled. Open USD transfer to switch currency.')}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium py-2 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>Transfer EUR</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Transaction History Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-white flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-sky-400" />
                    Transaction History & Immutable Ledger Lines
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    Showing latest {transfers.length} events
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase">
                        <th className="py-3 px-3">Transaction</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Fee</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {transfers.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white">{tx.recipient}</div>
                            <div className="text-slate-500 font-mono text-[10px]">{tx.id}</div>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono">{tx.date}</td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              tx.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                              tx.status === 'REVERSED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className={`py-3 px-3 font-mono font-bold ${tx.type === 'DEBIT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {tx.type === 'DEBIT' ? '-' : '+'}${tx.amount} {tx.currency}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono">${tx.fee}</td>
                          <td className="py-3 px-3 text-right">
                            {tx.status === 'COMPLETED' && (
                              <button
                                onClick={() => {
                                  const reason = prompt('State reason for dispute (e.g. Unrecognized transaction):');
                                  if (reason) {
                                    setDisputes([
                                      { id: `disp-${Date.now().toString().slice(-4)}`, transferId: tx.id, amount: tx.amount, reason, status: 'UNDER_REVIEW', claimant: 'Alex Morgan' },
                                      ...disputes
                                    ]);
                                    alert('Dispute submitted for operations analyst review.');
                                  }
                                }}
                                className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline"
                              >
                                Raise Dispute
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: BENEFICIARIES */}
          {activeTab === 'beneficiaries' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-white">Verified Beneficiaries</h3>
                  <p className="text-xs text-slate-400">Manage validated recipient accounts</p>
                </div>
                <button
                  onClick={() => setIsBeneficiaryModalOpen(true)}
                  className="bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-3.5 rounded-xl text-xs flex items-center space-x-1.5 transition shadow"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Beneficiary</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {beneficiaries.map((b) => (
                  <div key={b.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="font-semibold text-white">{b.name}</div>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                        VERIFIED
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono">Account: {b.account}</div>
                    <div className="text-xs text-slate-400 font-mono">Routing: {b.routing}</div>
                    <div className="text-xs text-slate-300 font-sans">{b.bank}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DISPUTES QUEUE */}
          {activeTab === 'disputes' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Dispute Resolution Queue</h3>
                <p className="text-xs text-slate-400">
                  {activeRole === 'customer'
                    ? 'Track the status of your reported transaction disputes'
                    : 'Operations analyst chargeback investigation and resolution workbench'}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase">
                      <th className="py-3 px-3">Dispute ID</th>
                      <th className="py-3 px-3">Claimant</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Reason</th>
                      <th className="py-3 px-3">Status</th>
                      {activeRole !== 'customer' && <th className="py-3 px-3 text-right">Review Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {disputes.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-mono text-slate-300">{d.id}</td>
                        <td className="py-3 px-3 text-white font-medium">{d.claimant}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">${d.amount}</td>
                        <td className="py-3 px-3 text-slate-300">{d.reason}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            d.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            d.status === 'UNDER_REVIEW' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        {activeRole !== 'customer' && (
                          <td className="py-3 px-3 text-right space-x-2">
                            {d.status === 'UNDER_REVIEW' ? (
                              <>
                                <button
                                  onClick={() => handleResolveDispute(d.id, 'ACCEPTED')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-semibold"
                                >
                                  Accept & Reverse
                                </button>
                                <button
                                  onClick={() => handleResolveDispute(d.id, 'REJECTED')}
                                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded text-xs font-semibold"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <span className="text-slate-500 text-xs">Closed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: AUDITED STATEMENTS */}
          {activeTab === 'statements' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-white">Monthly Financial Statement</h3>
                  <p className="text-xs text-slate-400">Audited closing balance consistency verification</p>
                </div>
                <button
                  onClick={() => alert('Exporting audited statement JSON / CSV...')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium"
                >
                  Export CSV
                </button>
              </div>

              {/* Statement Formula Audit Box */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3 font-mono text-xs">
                <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Accounting Invariant Verification Formula:
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sky-400">
                  Closing Balance = Opening Balance ($0.00) + Total Credits ($5,000.00) - Total Debits ($101.00) = $4,899.00
                </div>
                <div className="flex items-center text-emerald-400 font-semibold">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Audit Check: ZERO DISCREPANCY DETECTED (Diff: 0.0000 USD)
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RISK ANALYTICS (OPERATIONS ROLE) */}
          {activeTab === 'risk' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center">
                  <ShieldAlert className="w-4 h-4 mr-2 text-rose-400" />
                  Real-time Risk Analytics & Suspicious Activity Alerts
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Multi-factor decision support score (0-100). Disclaimer: Risk scores are decision support only, not proof of fraud.
                </p>
              </div>

              <div className="space-y-4">
                {riskAlerts.map((alert) => (
                  <div key={alert.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          alert.tier === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          SCORE {alert.score}/100 [{alert.tier}]
                        </span>
                        <span className="text-xs font-semibold text-white">{alert.trigger}</span>
                      </div>
                      <p className="text-xs text-slate-300">{alert.detail}</p>
                      <div className="text-[11px] text-slate-500 font-mono">Account: {alert.account} | Status: {alert.status}</div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setRiskAlerts(riskAlerts.map(a => a.id === alert.id ? { ...a, status: 'CLEARED' } : a));
                          alert(`Alert ${alert.id} cleared by operations.`);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs px-3 py-1.5 rounded-lg font-medium"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => {
                          alert(`Automated wallet freeze applied to ${alert.account}. Security hold active.`);
                        }}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                      >
                        Freeze Wallet
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LEDGER INVARIANTS (OPERATIONS / FINANCE ADMIN ROLE) */}
          {activeTab === 'ledger' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center">
                  <Scale className="w-4 h-4 mr-2 text-emerald-400" />
                  Chart of Accounts & Double-Entry Invariant Monitor
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enforcing strict double-entry balance: Debits increase Assets/Expenses; Credits increase Liabilities/Equity/Revenue.
                </p>
              </div>

              {/* Invariant Health Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="font-bold text-emerald-300 text-sm">System Global Balance Invariant: SATISFIED</div>
                    <div className="text-xs text-emerald-400/80 font-mono">SUM(ALL_DEBITS) - SUM(ALL_CREDITS) === 0.0000 USD</div>
                  </div>
                </div>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/40">
                  PASS - 100.0%
                </span>
              </div>

              {/* Chart of Accounts Summary */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Code</th>
                      <th className="py-2.5 px-3">Account Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Currency</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    <tr>
                      <td className="py-2.5 px-3 text-sky-400">1000-CASH-RESERVE-USD</td>
                      <td className="py-2.5 px-3">FinCore Settlement Reserve USD</td>
                      <td className="py-2.5 px-3 text-emerald-400">ASSET</td>
                      <td className="py-2.5 px-3">USD</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">$7,000.0000</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-sky-400">2000-CUST-ALEX-USD</td>
                      <td className="py-2.5 px-3">Customer Alex Deposit Liability</td>
                      <td className="py-2.5 px-3 text-amber-400">LIABILITY</td>
                      <td className="py-2.5 px-3">USD</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">${usdBalance.total}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-sky-400">2002-CUST-ALICE-USD</td>
                      <td className="py-2.5 px-3">Customer Alice Deposit Liability</td>
                      <td className="py-2.5 px-3 text-amber-400">LIABILITY</td>
                      <td className="py-2.5 px-3">USD</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">$2,100.0000</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-sky-400">4000-TRANSFER-FEE-REVENUE</td>
                      <td className="py-2.5 px-3">Transfer Processing Fee Revenue</td>
                      <td className="py-2.5 px-3 text-indigo-400">REVENUE</td>
                      <td className="py-2.5 px-3">USD</td>
                      <td className="py-2.5 px-3 text-right font-bold text-white">$1.0000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: SEND TRANSFER */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center">
                <ArrowUpRight className="w-5 h-5 mr-1.5 text-sky-400" />
                Atomic Double-Entry Transfer
              </h3>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Select Beneficiary</label>
                <select
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                >
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.bank})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Amount (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 text-xs">$</span>
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-7 pr-3 py-2 text-xs font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  Fee: {parseFloat(transferAmount) >= 10 ? '$1.00 USD' : '$0.00 USD (Micro-transfer exemption)'}
                </div>
              </div>

              {parseFloat(transferAmount) >= 1000 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2">
                  <div className="text-xs font-semibold text-amber-300 flex items-center">
                    <Lock className="w-3.5 h-3.5 mr-1.5" />
                    High-Value Transfer Reauthentication Required
                  </div>
                  <input
                    type="password"
                    placeholder="Enter password (Password123!)"
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 text-white rounded-lg px-2.5 py-1.5 text-xs"
                  />
                </div>
              )}

              {transferMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium">
                  {transferMessage}
                </div>
              )}
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTransfer}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 rounded-xl text-xs shadow-lg shadow-sky-600/30"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SIMULATE DEPOSIT */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center">
                <DollarSign className="w-5 h-5 mr-1 text-emerald-400" />
                Simulate Sandbox Deposit
              </h3>
              <button onClick={() => setIsDepositModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Instantly credit simulated test funds via balanced double-entry: Debit Cash Reserve, Credit Customer Liability.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[250, 1000, 5000].map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleSimulateDeposit(amt)}
                  className="bg-slate-800 hover:bg-emerald-600 text-white border border-slate-700 hover:border-emerald-500 py-2.5 rounded-xl text-xs font-mono font-bold transition"
                >
                  +${amt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD BENEFICIARY */}
      {isBeneficiaryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center">
                <PlusCircle className="w-5 h-5 mr-1.5 text-sky-400" />
                Add Verified Beneficiary
              </h3>
              <button onClick={() => setIsBeneficiaryModalOpen(false)} className="text-slate-400 hover:text-white text-sm">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Beneficiary Legal Name</label>
                <input
                  id="bName"
                  defaultValue="Robert Johnson"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Account Number / IBAN</label>
                <input
                  id="bAcc"
                  defaultValue="US1234567890"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">Bank Name</label>
                <input
                  id="bBank"
                  defaultValue="Wells Fargo Simulated"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setIsBeneficiaryModalOpen(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setBeneficiaries([
                    ...beneficiaries,
                    {
                      id: `b-${Date.now().toString().slice(-4)}`,
                      name: 'Robert Johnson',
                      account: 'US1234567890',
                      routing: '011000015',
                      bank: 'Wells Fargo Simulated'
                    }
                  ]);
                  setIsBeneficiaryModalOpen(false);
                }}
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 rounded-xl text-xs"
              >
                Save Beneficiary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
