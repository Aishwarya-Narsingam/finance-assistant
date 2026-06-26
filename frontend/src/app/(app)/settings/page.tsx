"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Loader2, Shield, Key, User, Smartphone } from "lucide-react";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || "" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const [mfaToken, setMfaToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateProfile(data),
    onSuccess: () => { refreshUser(); setMessage({ type: "success", text: "Profile updated!" }); },
    onError: (err: any) => setMessage({ type: "error", text: err.response?.data?.error || "Update failed" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => usersApi.changePassword(data),
    onSuccess: () => { setPassword({ currentPassword: "", newPassword: "" }); setMessage({ type: "success", text: "Password changed!" }); },
    onError: (err: any) => setMessage({ type: "error", text: err.response?.data?.error || "Change failed" }),
  });

  const mfaSetupMutation = useMutation({
    mutationFn: () => usersApi.mfaSetup(),
    onSuccess: (res) => { setQrCode(res.data.data.qrCode); setShowMfaSetup(true); },
    onError: (err: any) => setMessage({ type: "error", text: err.response?.data?.error || "MFA setup failed" }),
  });

  const mfaVerifyMutation = useMutation({
    mutationFn: (token: string) => usersApi.mfaVerify(token),
    onSuccess: () => { refreshUser(); setShowMfaSetup(false); setMfaToken(""); setMessage({ type: "success", text: "MFA enabled!" }); },
    onError: (err: any) => setMessage({ type: "error", text: err.response?.data?.error || "MFA verification failed" }),
  });

  const mfaDisableMutation = useMutation({
    mutationFn: (token: string) => usersApi.mfaDisable(token),
    onSuccess: () => { refreshUser(); setMfaToken(""); setMessage({ type: "success", text: "MFA disabled!" }); },
    onError: (err: any) => setMessage({ type: "error", text: err.response?.data?.error || "Failed to disable MFA" }),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {message && (
        <div className={`rounded-lg p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
          {message.text}
          <button className="ml-2 float-right" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); updateProfileMutation.mutate(profile); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={profile.name} onChange={(e) => setProfile({ name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-gray-50" />
            </div>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); changePasswordMutation.mutate(password); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} required />
            </div>
            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Change Password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Authenticator App</p>
                <p className="text-xs text-muted-foreground">
                  {user?.mfaEnabled ? "MFA is currently enabled" : "Use an authenticator app for 2FA"}
                </p>
              </div>
            </div>
            <Badge variant={user?.mfaEnabled ? "success" : "secondary"}>
              {user?.mfaEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          {!user?.mfaEnabled ? (
            !showMfaSetup ? (
              <Button onClick={() => mfaSetupMutation.mutate()} disabled={mfaSetupMutation.isPending}>
                {mfaSetupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Up MFA
              </Button>
            ) : (
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy):</p>
                {qrCode && <img src={qrCode} alt="MFA QR Code" className="mx-auto h-48 w-48" />}
                <div className="space-y-2">
                  <Label>Enter the 6-digit code from your app</Label>
                  <div className="flex gap-2">
                    <Input value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} maxLength={6} placeholder="000000" className="text-center text-lg tracking-widest" />
                    <Button onClick={() => mfaVerifyMutation.mutate(mfaToken)} disabled={mfaToken.length !== 6 || mfaVerifyMutation.isPending}>
                      {mfaVerifyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Verify
                    </Button>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">To disable MFA, enter your current code:</p>
              <div className="flex gap-2">
                <Input value={mfaToken} onChange={(e) => setMfaToken(e.target.value)} maxLength={6} placeholder="000000" className="w-40 text-center text-lg tracking-widest" />
                <Button variant="destructive" onClick={() => mfaDisableMutation.mutate(mfaToken)} disabled={mfaToken.length !== 6 || mfaDisableMutation.isPending}>
                  {mfaDisableMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Disable MFA
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
