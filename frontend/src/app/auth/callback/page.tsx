"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign in...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("accessToken", token);
      setMessage("Sign in successful! Redirecting...");
      setTimeout(() => router.push("/dashboard"), 1000);
    } else {
      setMessage("Authentication failed. Please try again.");
      setTimeout(() => router.push("/auth/login"), 2000);
    }
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Signing In</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-600" />
          <p className="mt-4 text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
