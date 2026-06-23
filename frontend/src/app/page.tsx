'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Target, Sparkles, BarChart3 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">F</span>
          </div>
          <span className="text-lg font-bold text-gray-900">FinanceAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login"><Button variant="ghost" size="sm">Sign In</Button></Link>
          <Link href="/auth/register"><Button size="sm">Get Started</Button></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-12 py-20 lg:py-32 text-center">
        <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" /> AI-Powered Finance
        </div>
        <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
          Your AI-Powered<br />Financial Companion
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10">
          Track expenses, create budgets, set savings goals, and get AI-powered insights
          to take control of your financial future.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/auth/register">
            <Button size="lg" className="text-base">
              Start Free <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button variant="outline" size="lg" className="text-base">Sign In</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 lg:px-12 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: BarChart3, title: 'Smart Dashboard', desc: 'Real-time financial overview with beautiful charts and insights' },
            { icon: Target, title: 'Savings Goals', desc: 'Set and track goals with AI-powered predictions and recommendations' },
            { icon: Sparkles, title: 'AI Assistant', desc: 'Chat with your personal finance advisor for spending analysis and advice' },
            { icon: Shield, title: 'Secure & Private', desc: 'Enterprise-grade security with JWT, MFA, and encrypted data' },
          ].map((f, i) => (
            <div key={f.title} className="p-6 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <f.icon className="h-6 w-6 text-gray-700" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-sm text-gray-400">
        <p>© 2026 FinanceAI. Built with ❤️ for your financial wellness.</p>
      </footer>
    </div>
  );
}
