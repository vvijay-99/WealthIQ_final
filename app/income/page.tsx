'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MetricCard } from '@/components/metric-card';
import { LoadingState, EmptyState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { Plus, Wallet, Trash2, Pencil, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

type IncomeRow = Database['public']['Tables']['income_records']['Row'];

const incomeTypes = [
  'Salary',
  'Freelance',
  'Business',
  'Investments',
  'Rental',
  'Bonus',
  'Pension',
  'Other',
];

export default function IncomePage() {
  const { user, authState } = useAuth();
  const [records, setRecords] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    amount: '',
    income_type: 'Salary',
    record_date: new Date().toISOString().split('T')[0],
  });

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('income_records') as any)
          .select('*')
          .eq('user_id', userId)
          .order('record_date', { ascending: false });

        if (error) {
          console.error('Error fetching income records:', error);
          setErrorMessage(error.message || 'Failed to load income records.');
          return;
        }

        setRecords((data as IncomeRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch income records exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading income records.'
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (user?.id) {
      fetchRecords(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchRecords]);

  const resetForm = () => {
    setFormData({
      amount: '',
      income_type: 'Salary',
      record_date: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
  };

  const handleStartEdit = (record: IncomeRow) => {
    setEditingId(record.id);
    setFormData({
      amount: String(record.amount),
      income_type: record.income_type,
      record_date: record.record_date,
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    window.scrollTo({ top: 200, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage income records.');
      return;
    }

    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid positive income amount.');
      return;
    }

    if (!formData.record_date) {
      setErrorMessage('Please select a valid record date.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      if (editingId) {
        // Update existing record
        const { error } = await (supabase.from('income_records') as any)
          .update({
            amount: numericAmount,
            income_type: formData.income_type,
            record_date: formData.record_date,
          })
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating income record:', error);
          setErrorMessage(error.message || 'Failed to update income record.');
          return;
        }

        setSuccessMessage('Income record updated successfully.');
      } else {
        // Create new record
        const { error } = await (supabase.from('income_records') as any).insert({
          user_id: user.id,
          amount: numericAmount,
          income_type: formData.income_type,
          record_date: formData.record_date,
        });

        if (error) {
          console.error('Error creating income record:', error);
          setErrorMessage(error.message || 'Failed to create income record.');
          return;
        }

        setSuccessMessage('Income record added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Income record submission error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving income record.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingId(id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await (supabase.from('income_records') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting income record:', error);
        setErrorMessage(error.message || 'Failed to delete income record.');
        return;
      }

      setSuccessMessage('Income record deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete income record error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting record.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalMonthlyIncome = records.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="Income"
        description="Track your monthly earnings and income streams."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 200, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Income
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          title="Total Monthly Income"
          value={formatCurrency(totalMonthlyIncome)}
          icon={<Wallet className="h-4 w-4" />}
          accent="success"
        />
        <MetricCard
          title="Income Streams"
          value={String(records.length)}
          accent="primary"
        />
        <MetricCard
          title="Primary Source"
          value={records[0]?.income_type || '—'}
          accent="neutral"
        />
      </div>

      {/* Add / Edit Form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Income Record' : 'Add New Income Record'}
            </CardTitle>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4 text-success">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="income_type">Income Type</Label>
                <Select
                  value={formData.income_type}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, income_type: val }))}
                >
                  <SelectTrigger id="income_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {incomeTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="85000"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="record_date">Date</Label>
                <Input
                  id="record_date"
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, record_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving || loading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    {editingId ? (
                      <Pencil className="mr-2 h-4 w-4" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {editingId ? 'Update Income' : 'Save Income'}
                  </>
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Income Records Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Income History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading income records..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="No income records found"
              description="Add your first income stream to track your monthly earnings."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Income Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.income_type}</TableCell>
                    <TableCell className="font-semibold text-success">
                      {formatCurrency(Number(record.amount))}
                    </TableCell>
                    <TableCell>{formatDate(record.record_date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(record)}
                          title="Edit record"
                          disabled={saving || deletingId === record.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(record.id)}
                          title="Delete record"
                          disabled={saving || deletingId === record.id}
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-danger" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-danger" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
