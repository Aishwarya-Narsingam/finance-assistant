'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Plus, Target, TrendingUp, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addFundsId, setAddFundsId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [prediction, setPrediction] = useState('');
  const [predictionGoal, setPredictionGoal] = useState('');
  const [form, setForm] = useState({
    name: '', targetAmount: '', deadline: '', monthlyTarget: '', priority: 'MEDIUM',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: async () => { const { data } = await goalsApi.list(); return data; },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => goalsApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setDialogOpen(false); setForm({ name: '', targetAmount: '', deadline: '', monthlyTarget: '', priority: 'MEDIUM' }); },
  });

  const addFundsMutation = useMutation({
    mutationFn: ({ id, amount }: any) => goalsApi.addFunds(id, amount),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setAddFundsId(null); setAddAmount(''); },
  });

  const predictMutation = useMutation({
    mutationFn: (id: string) => goalsApi.predict(id),
    onSuccess: (data: any) => { setPrediction(data.data.prediction); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { name: form.name, targetAmount: parseFloat(form.targetAmount), priority: form.priority };
    if (form.deadline) body.deadline = new Date(form.deadline).toISOString();
    if (form.monthlyTarget) body.monthlyTarget = parseFloat(form.monthlyTarget);
    createMutation.mutate(body);
  };

  const PRIORITY_COLORS: Record<string, string> = {
    LOW: 'bg-blue-50 text-blue-600', MEDIUM: 'bg-yellow-50 text-yellow-600', HIGH: 'bg-red-50 text-red-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Savings Goals</h1>
          <p className="text-gray-500">Track your progress towards financial goals</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Goal</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data?.goals?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.goals.map((goal: any, i: number) => (
            <motion.div key={goal.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="card-hover h-full flex flex-col">
                <CardContent className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-gray-400" />
                      <h3 className="font-semibold text-gray-900">{goal.name}</h3>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[goal.priority] || ''}`}>
                      {goal.priority}
                    </span>
                  </div>

                  {goal.status === 'COMPLETED' && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl mb-3 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4" /> Goal Completed!
                    </div>
                  )}

                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{goal.progress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-black rounded-full transition-all duration-500" style={{ width: `${Math.min(goal.progress, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{formatCurrency(goal.currentAmount)}</span>
                      <span>{formatCurrency(goal.targetAmount)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-gray-500">Health Score</p>
                        <p className="font-semibold text-gray-900">{goal.healthScore}/100</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-gray-500">Monthly Need</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(goal.monthlyNeeded)}</p>
                      </div>
                    </div>

                    {goal.deadline && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" /> Deadline: {formatDate(goal.deadline)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                    {goal.status === 'ACTIVE' && (
                      <>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setAddFundsId(goal.id); setAddAmount(''); }}>
                          Add Funds
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPredictionGoal(goal.id); predictMutation.mutate(goal.id); }}>
                          <Sparkles className="h-3 w-3 mr-1" /> AI Predict
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => deleteMutation.mutate(goal.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg mb-2">No savings goals yet</p>
          <p className="text-sm">Create a goal to start tracking your savings progress</p>
        </div>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Savings Goal</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Goal Name</Label><Input placeholder="e.g., Emergency Fund" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Target Amount (₹)</Label><Input type="number" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Monthly Contribution (₹)</Label><Input type="number" value={form.monthlyTarget} onChange={(e) => setForm({ ...form, monthlyTarget: e.target.value })} /></div>
            <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            <div className="space-y-2"><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem><SelectItem value="MEDIUM">Medium</SelectItem><SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Goal'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Funds Dialog */}
      <Dialog open={!!addFundsId} onOpenChange={() => setAddFundsId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Funds</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Amount (₹)</Label><Input type="number" value={addAmount} onChange={(e) => setAddAmount(e.target.value)} /></div>
            <Button className="w-full" onClick={() => addFundsId && addFundsMutation.mutate({ id: addFundsId, amount: parseFloat(addAmount) })} disabled={!addAmount || addFundsMutation.isPending}>
              {addFundsMutation.isPending ? 'Adding...' : 'Add Funds'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Prediction Dialog */}
      <Dialog open={!!prediction} onOpenChange={() => setPrediction('')}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> AI Prediction</DialogTitle></DialogHeader>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{prediction}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
