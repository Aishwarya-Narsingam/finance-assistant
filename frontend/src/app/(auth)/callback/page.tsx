'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(error === 'google_auth_failed' 
          ? 'Google authentication failed. Please try again.' 
          : 'Authentication failed. Please try again.');
        return;
      }

      if (accessToken) {
        setAccessToken(accessToken);

        // Also handle refreshToken from URL if present
        const refreshToken = searchParams.get('refreshToken');
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

        setStatus('success');
        setMessage('Authentication successful! Redirecting...');

        // Short delay then redirect
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else {
        setStatus('error');
        setMessage('No authentication token received. Please try again.');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Authenticating...</h2>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Welcome!</h2>
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 animate-fade-in">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Authentication Failed</h2>
            <p className="text-sm text-gray-500 mb-4">{message}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white flex items-center justify-center px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
