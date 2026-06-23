import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'FinanceAI — Your AI-Powered Financial Companion',
  description: 'Manage your finances with AI-powered insights, budgeting, and goal tracking.',
  keywords: ['finance', 'AI', 'budget', 'savings', 'personal finance'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
