import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinCore - Digital Wallet, Ledger & Payment Processing Platform',
  description: 'Simulated digital banking platform with double-entry ledger, risk analytics, and reconciliation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-900 text-slate-100">
        {children}
      </body>
    </html>
  );
}
