'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, TrendingUp, TrendingDown, ArrowUpRight, Loader2 } from 'lucide-react';

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [type, setType] = useState('MONTHLY');
  const now = new Date();
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(now.toISOString().split('T')[0]);

  const { data, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => { const { data } = await reportsApi.list(); return data; },
  });

  const generateMutation = useMutation({
    mutationFn: (d: any) => reportsApi.generate(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reports'] }); setDialogOpen(false); },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      type,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500">Generate and view financial reports</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><FileText className="h-4 w-4 mr-2" /> Generate Report</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : data?.reports?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.reports.map((report: any, i: number) => {
            const summary = report.data?.summary || {};
            return (
              <motion.div key={report.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{report.type}</span>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(report.startDate)} — {formatDate(report.endDate)}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${(summary.healthScore || 0) >= 70 ? 'bg-emerald-50' : (summary.healthScore || 0) >= 40 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                        <TrendingUp className={`h-5 w-5 ${(summary.healthScore || 0) >= 70 ? 'text-emerald-500' : (summary.healthScore || 0) >= 40 ? 'text-yellow-500' : 'text-red-500'}`} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Income</p>
                        <p className="font-semibold text-emerald-600">{formatCurrency(summary.totalIncome || 0)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-500">Expenses</p>
                        <p className="font-semibold text-red-600">{formatCurrency(summary.totalExpenses || 0)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Health Score</span>
                      <span className="font-bold text-gray-900">{summary.healthScore || 0}/100</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2">
                      <div className="h-full bg-black rounded-full" style={{ width: `${summary.healthScore || 0}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{report.data?.transactionCount || 0} transactions analyzed</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg mb-2">No reports yet</p>
          <p className="text-sm">Generate a report to see your financial analysis</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Report</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Report Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Generate
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
