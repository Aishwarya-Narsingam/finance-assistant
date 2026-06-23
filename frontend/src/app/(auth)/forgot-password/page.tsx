'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Sparkles, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold text-gray-900">FinanceAI</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-gray-200/60 shadow-xl shadow-gray-200/50">
            <CardContent className="p-8">
              {sent ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
                  <p className="text-sm text-gray-500">
                    If an account exists with <strong className="text-gray-700">{email}</strong>,
                    we&apos;ve sent a password reset link.
                  </p>
                  <div className="pt-4">
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back to sign in
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Mail className="h-6 w-6 text-gray-600" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900">Forgot password?</h1>
                    <p className="text-gray-500 text-sm mt-1.5">
                      Enter your email and we&apos;ll send you a reset link.
                    </p>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl"
                    >
                      <p className="text-sm text-red-600">{error}</p>
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        autoComplete="email"
                      />
                    </div>

                    <Button type="submit" className="w-full h-11" disabled={loading || !email}>
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Send Reset Link
                    </Button>

                    <div className="text-center">
                      <Link
                        href="/auth/login"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                      </Link>
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
