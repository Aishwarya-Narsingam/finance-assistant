'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usersApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getInitials, formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Lock,
  Shield,
  Camera,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  X,
  Check,
  ChevronRight,
  Smartphone,
  Clock,
  AlertTriangle,
  LogOut,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';

// ─── Password Requirements ─────────────────────────────────────
const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
];

function getPasswordStrength(password: string): { label: string; color: string; pct: number } {
  const passed = PASSWORD_REQUIREMENTS.filter((r) => r.test(password)).length;
  if (password.length === 0) return { label: '', color: '', pct: 0 };
  if (passed <= 1) return { label: 'Weak', color: 'bg-red-500', pct: 25 };
  if (passed === 2) return { label: 'Fair', color: 'bg-orange-500', pct: 50 };
  if (passed === 3) return { label: 'Good', color: 'bg-yellow-500', pct: 75 };
  return { label: 'Strong', color: 'bg-emerald-500', pct: 100 };
}

// ─── Section Header ────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, description }: { icon: any; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

// ─── Settings Page ─────────────────────────────────────────────
export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Password
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false });
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // MFA
  const [mfaDialog, setMfaDialog] = useState(false);
  const [mfaData, setMfaData] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaVerified, setMfaVerified] = useState(false);
  const [mfaError, setMfaError] = useState('');

  // Sessions
  const [activeSessions] = useState([
    { device: 'Chrome on Windows', location: 'Hyderabad, India', lastActive: 'Now', current: true },
    { device: 'Safari on iPhone', location: 'Hyderabad, India', lastActive: '2 hours ago', current: false },
  ]);

  const passwordStrength = getPasswordStrength(passwordForm.new);

  // ─── Handlers ──────────────────────────────────────────────

  const handleUpdateProfile = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await usersApi.updateProfile({ name });
      await refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await usersApi.uploadAvatar(base64);
        await refreshUser();
      };
      reader.readAsDataURL(file);
    } catch { /* ignore */ }
    setAvatarUploading(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');

    if (passwordForm.new !== passwordForm.confirm) {
      return;
    }

    try {
      await usersApi.changePassword({
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new,
      });
      setPasswordForm({ current: '', new: '', confirm: '' });
      setPasswordSuccess('Password changed successfully!');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to change password';
      alert(msg);
    }
  };

  const setupMfa = async () => {
    setMfaError('');
    try {
      const { data } = await usersApi.setupMfa();
      setMfaData(data);
      setMfaDialog(true);
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Failed to setup MFA');
    }
  };

  const verifyMfa = async () => {
    setMfaError('');
    try {
      await usersApi.verifyMfa(mfaCode);
      setMfaVerified(true);
      await refreshUser();
      setTimeout(() => setMfaDialog(false), 1500);
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Invalid code');
    }
  };

  const disableMfa = async () => {
    const code = prompt('Enter your MFA code to disable:');
    if (code) {
      try {
        await usersApi.disableMfa(code);
        await refreshUser();
      } catch (err: any) {
        alert(err.response?.data?.error || 'Failed to disable MFA');
      }
    }
  };

  const isPasswordValid = PASSWORD_REQUIREMENTS.every((r) => r.test(passwordForm.new));
  const allPasswordFieldsFilled = passwordForm.current && passwordForm.new && passwordForm.confirm;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* ─── Profile Section ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-gray-900 via-gray-600 to-gray-400" />
          <CardContent className="p-6">
            <SectionHeader icon={User} title="Profile" description="Your personal information" />

            <div className="flex flex-col sm:flex-row items-start gap-6 mb-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden ring-2 ring-gray-100">
                  {(user?.avatar || user?.image) ? (
                    <Image
                      src={user!.avatar || user!.image!}
                      alt="Avatar"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-gray-500">
                      {getInitials(user?.name || '')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {avatarUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <Camera className="h-4 w-4 text-gray-500" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{user?.name}</p>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                  <span>Member since {user?.createdAt ? formatDate(user.createdAt) : 'N/A'}</span>
                  <span className="inline-flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${user?.isEmailVerified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {user?.isEmailVerified ? 'Verified' : 'Unverified'}
                  </span>
                  {user?.provider === 'google' && (
                    <span className="inline-flex items-center gap-1 text-blue-500 font-medium">
                      Connected with Google
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Form */}
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="settings-name">Full Name</Label>
                <Input
                  id="settings-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled className="bg-gray-50 text-gray-500" />
                <p className="text-xs text-gray-400">Email cannot be changed</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={saving || !name || name === user?.name}
                  className="relative"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : saveSuccess ? (
                    <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-400" />
                  ) : null}
                  {saveSuccess ? 'Saved!' : 'Save Changes'}
                </Button>
                <AnimatePresence>
                  {saveSuccess && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-emerald-600 font-medium"
                    >
                      Profile updated
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Password Section ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <SectionHeader icon={Lock} title="Password" description="Update your password" />

            {user?.provider === 'google' ? (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-600">
                  Your account is connected with Google. Password management is handled by Google.
                </p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                {/* Current Password */}
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                      required
                      placeholder="Enter current password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.new}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                      required
                      minLength={8}
                      placeholder="Create new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength Indicator */}
                  {passwordForm.new.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2 mt-2"
                    >
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${passwordStrength.pct}%` }}
                          className={`h-full rounded-full transition-colors ${passwordStrength.color}`}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">{passwordStrength.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        {PASSWORD_REQUIREMENTS.map((req) => {
                          const passed = req.test(passwordForm.new);
                          return (
                            <div key={req.label} className="flex items-center gap-1.5">
                              {passed ? (
                                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                              ) : (
                                <X className="h-3 w-3 text-gray-300 shrink-0" />
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

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                      required
                      minLength={8}
                      placeholder="Confirm new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordForm.confirm && passwordForm.new !== passwordForm.confirm && (
                    <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                      <X className="h-3 w-3" /> Passwords do not match
                    </p>
                  )}
                  {passwordForm.confirm && passwordForm.new === passwordForm.confirm && (
                    <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                      <Check className="h-3 w-3" /> Passwords match
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!allPasswordFieldsFilled || !isPasswordValid || passwordForm.new !== passwordForm.confirm}
                  >
                    Update Password
                  </Button>
                  {passwordSuccess && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-sm text-emerald-600 font-medium flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-4 w-4" /> {passwordSuccess}
                    </motion.span>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Security Section ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-6">
            <SectionHeader icon={Shield} title="Security" description="Protect your account" />

            {/* Security Status */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                user?.mfaEnabled ? 'bg-emerald-50' : 'bg-amber-50'
              }`}>
                <Shield className={`h-5 w-5 ${
                  user?.mfaEnabled ? 'text-emerald-600' : 'text-amber-600'
                }`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Security Status</p>
                <p className="text-xs text-gray-500">
                  {user?.mfaEnabled
                    ? 'MFA is enabled. Your account has extra protection.'
                    : 'MFA is not enabled. Add an extra layer of security.'}
                </p>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                user?.mfaEnabled
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {user?.mfaEnabled ? 'Protected' : 'At Risk'}
              </span>
            </div>

            {/* MFA */}
            <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                  <p className="text-xs text-gray-500">
                    {user?.mfaEnabled ? 'Authenticator app enabled' : 'Add an authenticator app'}
                  </p>
                </div>
              </div>
              {user?.mfaEnabled ? (
                <Button variant="outline" size="sm" onClick={disableMfa} className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200">
                  Disable
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={setupMfa}>
                  Enable
                </Button>
              )}
            </div>

            {/* Active Sessions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Active Sessions
                </h3>
              </div>
              <div className="space-y-2">
                {activeSessions.map((session, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Smartphone className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {session.device}
                          {session.current && (
                            <span className="ml-2 text-xs text-emerald-600 font-medium">Current</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">{session.location} &middot; {session.lastActive}</p>
                      </div>
                    </div>
                    {!session.current && (
                      <button className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1">
                        <LogOut className="h-3 w-3" /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── Danger Zone ────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-red-200">
          <CardContent className="p-6">
            <SectionHeader icon={AlertTriangle} title="Danger Zone" description="Irreversible actions" />
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Delete Account</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200 shrink-0">
                  Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─── MFA Setup Dialog ───────────────────────────────── */}
      <Dialog open={mfaDialog} onOpenChange={(open) => {
        if (!open) {
          setMfaDialog(false);
          setMfaVerified(false);
          setMfaCode('');
          setMfaError('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {mfaVerified ? 'MFA Enabled!' : 'Setup Two-Factor Authentication'}
            </DialogTitle>
          </DialogHeader>

          {mfaVerified ? (
            <div className="text-center py-6 space-y-3 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="font-medium text-gray-900">Two-factor authentication is now enabled!</p>
              <p className="text-sm text-gray-500">Your account is now more secure.</p>
            </div>
          ) : mfaData ? (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Scan this QR code with Google Authenticator or a similar app. You&apos;ll need the 6-digit code to sign in.
                </p>
              </div>

              <div className="flex justify-center p-4 bg-white border border-gray-100 rounded-xl">
                <img src={mfaData.qrCode} alt="QR Code" className="w-44 h-44" />
              </div>

              {mfaError && (
                <p className="text-sm text-red-500 text-center">{mfaError}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="mfa-code">Enter 6-digit code from your authenticator app</Label>
                <Input
                  id="mfa-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>

              <Button
                className="w-full"
                onClick={verifyMfa}
                disabled={mfaCode.length < 6}
              >
                {mfaCode.length < 6 ? 'Enter code to verify' : 'Verify & Enable'}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
