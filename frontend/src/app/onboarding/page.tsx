'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight, ArrowLeft, Check, Home, Car, Shield, TrendingUp, Target } from 'lucide-react';

const GOALS = [
  { id: 'house', label: 'Buy House', icon: Home },
  { id: 'car', label: 'Buy Car', icon: Car },
  { id: 'emergency', label: 'Emergency Fund', icon: Shield },
  { id: 'retirement', label: 'Retirement', icon: TrendingUp },
  { id: 'custom', label: 'Custom Goal', icon: Target },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [personal, setPersonal] = useState({ name: '', age: '', occupation: '' });
  const [financial, setFinancial] = useState({
    monthlyIncome: '',
    monthlyExpenses: '',
    savings: '',
    existingLoans: '',
  });
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await usersApi.completeOnboarding();
      await refreshUser();
      router.push('/dashboard');
    } catch {
      // Continue anyway
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                s < step ? 'bg-black text-white' : s === step ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${s < step ? 'bg-black' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Personal Details</h2>
                  <p className="text-gray-500 text-sm mt-1">Tell us about yourself</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      placeholder="John Doe"
                      value={personal.name}
                      onChange={(e) => setPersonal({ ...personal, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input
                      type="number"
                      placeholder="25"
                      value={personal.age}
                      onChange={(e) => setPersonal({ ...personal, age: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Occupation</Label>
                    <Input
                      placeholder="Software Engineer"
                      value={personal.occupation}
                      onChange={(e) => setPersonal({ ...personal, occupation: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Financial Details</h2>
                  <p className="text-gray-500 text-sm mt-1">Help us understand your financial situation</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Monthly Income (₹)</Label>
                    <Input
                      type="number"
                      placeholder="50000"
                      value={financial.monthlyIncome}
                      onChange={(e) => setFinancial({ ...financial, monthlyIncome: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Monthly Expenses (₹)</Label>
                    <Input
                      type="number"
                      placeholder="30000"
                      value={financial.monthlyExpenses}
                      onChange={(e) => setFinancial({ ...financial, monthlyExpenses: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Current Savings (₹)</Label>
                    <Input
                      type="number"
                      placeholder="100000"
                      value={financial.savings}
                      onChange={(e) => setFinancial({ ...financial, savings: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Existing Loans (₹)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={financial.existingLoans}
                      onChange={(e) => setFinancial({ ...financial, existingLoans: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Financial Goals</h2>
                  <p className="text-gray-500 text-sm mt-1">What are you saving for?</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {GOALS.map((goal) => {
                    const Icon = goal.icon;
                    const selected = selectedGoals.includes(goal.id);
                    return (
                      <button
                        key={goal.id}
                        onClick={() => toggleGoal(goal.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          selected
                            ? 'border-black bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${selected ? 'text-black' : 'text-gray-400'}`} />
                        <span className={`font-medium ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                          {goal.label}
                        </span>
                        {selected && <Check className="h-4 w-4 text-black ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete Setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
