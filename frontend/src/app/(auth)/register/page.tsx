'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, setAccessToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { GoogleSignInButton } from '@/components/auth/google-signin-button';
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface PasswordRequirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /[0-9]/.test(pw) },
];

function getStrength(password: string): { label: string; color: string; pct: number } {
  const passed = REQUIREMENTS.filter((r) => r.test(password)).length;
  if (password.length === 0) return { label: '', color: '', pct: 0 };
  if (passed <= 1) return { label: 'Weak', color: 'bg-red-500', pct: 25 };
  if (passed === 2) return { label: 'Fair', color: 'bg-orange-500', pct: 50 };
  if (passed === 3) return { label: 'Good', color: 'bg-yellow-500', pct: 75 };
  return { label: 'Strong', color: 'bg-emerald-500', pct: 100 };
}

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = getStrength(password);
  const allValid = REQUIREMENTS.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setError('');
    setLoading(true);

    try {
      const { data } = await authApi.register({ email, password, name });
      setAccessToken(data.accessToken);
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.details?.[0] || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
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
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-medium mb-3">
                  <Sparkles className="h-3 w-3" /> Get Started Free
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
                <p className="text-gray-500 text-sm mt-1.5">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-gray-900 font-medium hover:underline">
                    Sign in
                  </Link>
                </p>
              </div>

              {/* Google Sign Up */}
              <div className="mb-6">
                <GoogleSignInButton mode="signup" />
              </div>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-4 text-gray-400 font-medium">or continue with email</span>
                </div>
              </div>

              {/* Error */}
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
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    autoFocus
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password strength bar */}
                  {password.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 mt-2"
                    >
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${strength.pct}%` }}
                          className={`h-full rounded-full transition-colors ${strength.color}`}
                        />
                      </div>
                      {strength.label && (
                        <p className={`text-xs font-medium ${
                          strength.pct === 100 ? 'text-emerald-600' : 'text-gray-500'
                        }`}>
                          {strength.label}
                        </p>
                      )}
                      <div className="space-y-1">
                        {REQUIREMENTS.map((req) => {
                          const passed = req.test(password);
                          return (
                            <div key={req.label} className="flex items-center gap-2">
                              {passed ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <X className="h-3 w-3 text-gray-300" />
                              )}
                              <span className={`text-xs ${passed ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {req.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>

                <Button type="submit" className="w-full h-11" disabled={loading || !name || !email || !allValid}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Create Account
                </Button>

                <p className="text-xs text-gray-400 text-center leading-relaxed">
                  By creating an account, you agree to our{' '}
                  <Link href="/terms" className="text-gray-600 hover:text-gray-900 underline">Terms of Service</Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-gray-600 hover:text-gray-900 underline">Privacy Policy</Link>.
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
