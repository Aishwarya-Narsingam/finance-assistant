'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found.');
      return;
    }

    const verify = async () => {
      try {
        const { data } = await authApi.verifyEmail(token);
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
        setTimeout(() => router.push('/auth/login'), 2000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed. The link may have expired.');
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Card className="border-gray-200/60 shadow-xl shadow-gray-200/50">
          <CardContent className="p-8">
            {status === 'loading' && (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Verifying your email...</h2>
                <p className="text-sm text-gray-500">Please wait while we verify your email address.</p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-4 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Email Verified!</h2>
                <p className="text-sm text-gray-500">{message}</p>
                <p className="text-xs text-gray-400">Redirecting to sign in...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-4 animate-fade-in">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Verification Failed</h2>
                <p className="text-sm text-gray-500 mb-4">{message}</p>
                <div className="flex flex-col gap-3 items-center">
                  <Link href="/auth/login">
                    <Button variant="outline">
                      <ArrowLeft className="h-4 w-4 mr-2" /> Back to Login
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
