"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, ArrowLeft, Sparkles, PiggyBank, Target, Check } from "lucide-react";

const STEPS = [
  { title: "Welcome", icon: Sparkles, description: "Let's get you set up" },
  { title: "Income", icon: PiggyBank, description: "Tell us about your finances" },
  { title: "Goals", icon: Target, description: "What do you want to achieve?" },
];

const PREFERRED_CATEGORIES = ["FOOD", "TRAVEL", "SHOPPING", "BILLS", "RENT", "ENTERTAINMENT", "HEALTHCARE", "EDUCATION", "INVESTMENT"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    monthlyIncome: "",
    currency: "INR",
    preferredCategories: [] as string[],
  });

  const mutation = useMutation({
    mutationFn: (data: any) => usersApi.completeOnboarding(data),
    onSuccess: () => {
      router.push("/dashboard");
    },
  });

  const currentStep = STEPS[step];

  function toggleCategory(cat: string) {
    setForm((prev) => ({
      ...prev,
      preferredCategories: prev.preferredCategories.includes(cat)
        ? prev.preferredCategories.filter((c) => c !== cat)
        : [...prev.preferredCategories, cat],
    }));
  }

  function handleNext() {
    if (step === STEPS.length - 1) {
      mutation.mutate({
        monthlyIncome: parseFloat(form.monthlyIncome),
        currency: form.currency,
        preferredCategories: form.preferredCategories,
      });
    } else {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg"
      >
        {/* Progress */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  i <= step ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-1 w-12 rounded transition-colors ${i < step ? "bg-indigo-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100">
              <currentStep.icon className="h-6 w-6 text-indigo-600" />
            </div>
            <CardTitle className="text-xl">{currentStep.title}</CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {step === 0 && (
                  <div className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      FinanceAI helps you track your spending, create budgets, and reach your financial goals with the power of AI.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-left">
                      {[
                        "Track every rupee",
                        "AI-powered insights",
                        "Smart budgeting",
                        "Goal predictions",
                      ].map((feature) => (
                        <div key={feature} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                          <Check className="h-4 w-4 text-green-500" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Monthly Income (₹)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g., 50000"
                        value={form.monthlyIncome}
                        onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">This helps us create personalized budgets and insights for you.</p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Select the spending categories most relevant to you:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PREFERRED_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => toggleCategory(cat)}
                          className={`rounded-lg border p-3 text-xs font-medium transition-colors ${
                            form.preferredCategories.includes(cat)
                              ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex justify-between">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={mutation.isPending} className="gap-2">
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === STEPS.length - 1 ? (
                  "Get Started"
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
