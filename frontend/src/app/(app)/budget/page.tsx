'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Plus, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

const CATEGORIES = ['FOOD','TRAVEL','SHOPPING','BILLS','RENT','INVESTMENT','ENTERTAINMENT','HEALTHCARE','EDUCATION','SALARY','FREELANCE','OTHER'];
const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#F59E0B', TRAVEL: '#8B5CF6', SHOPPING: '#EC4899', BILLS: '#6366F1',
  RENT: '#64748B', INVESTMENT: '#14B8A6', ENTERTAINMENT: '#F43F5E', HEALTHCARE: '#10B981',
  EDUCATION: '#3B82F6', SALARY: '#22C55E', FREELANCE: '#A855F7', OTHER: '#9CA3AF',
};

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [form, setForm] = useState({ name: '', amount: '', category: 'FOOD' });

  const { data, isLoading } = useQuery({
    queryKey: ['budgets', month, year],
    queryFn: async () => {
      const { data } = await budgetsApi.list({ month: String(month), year: String(year) });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => budgetsApi.create(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setDialogOpen(false);
      setForm({ name: '', amount: '', category: 'FOOD' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  });

  const totalBudget = data?.budgets?.reduce((s: number, b: any) => s + b.amount, 0) || 0;
  const totalSpent = data?.budgets?.reduce((s: number, b: any) => s + b.spent, 0) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: form.name,
      amount: parseFloat(form.amount),
      category: form.category,
      month,
      year,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-500">Track and manage your monthly budgets</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Budget
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {new Date(0, i).toLocaleString('default', { month: 'long' })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[year - 1, year, year + 1].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="stat-card">
          <p className="text-sm text-gray-500">Total Budget</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalBudget)}</p>
        </Card>
        <Card className="stat-card">
          <p className="text-sm text-gray-500">Total Spent</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalSpent)}</p>
        </Card>
        <Card className="stat-card">
          <p className="text-sm text-gray-500">Remaining</p>
          <p className={`text-2xl font-bold mt-1 ${totalBudget - totalSpent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(totalBudget - totalSpent)}
          </p>
        </Card>
      </div>

      {/* Budget Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-2 text-center py-8 text-gray-400">Loading...</div>
        ) : data?.budgets?.length > 0 ? (
          data.budgets.map((budget: any, i: number) => {
            const pct = budget.percentage || 0;
            const color = CATEGORY_COLORS[budget.category] || '#9CA3AF';
            const isOver = pct > 100;
            const isWarning = pct > 80 && pct <= 100;
            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{budget.name}</h3>
                        <p className="text-xs text-gray-500">{budget.category}</p>
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOver ? 'bg-red-50' : isWarning ? 'bg-yellow-50' : 'bg-emerald-50'}`}>
                        {isOver ? <AlertTriangle className="h-4 w-4 text-red-500" /> :
                         isWarning ? <TrendingUp className="h-4 w-4 text-yellow-500" /> :
                         <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-500">{formatCurrency(budget.spent)} spent</span>
                      <span className="text-gray-500">{formatCurrency(budget.amount)} budget</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-medium ${isOver ? 'text-red-600' : 'text-gray-500'}`}>
                        {pct}% used
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatCurrency(Math.max(0, budget.amount - budget.spent))} left
                      </span>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(budget.id)}
                      className="mt-3 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        ) : (
          <div className="col-span-2 text-center py-12 text-gray-400">
            <p className="text-lg mb-2">No budgets for this month</p>
            <p className="text-sm">Create a budget to start tracking your spending</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Budget Name</Label>
              <Input placeholder="e.g., Groceries Budget" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Budget'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
