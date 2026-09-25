'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { ExpenseChart } from '@/components/expense-chart';
import { LoadingState, EmptyState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import { formatCurrency, formatDate } from '@/lib/format';
import type { ExpenseType, ExpenseChartData } from '@/lib/types';
import { Plus, TrendingDown, Trash2, Pencil, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

type ExpenseRow = Database['public']['Tables']['expense_records']['Row'];

const expenseCategories = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Healthcare',
  'Education',
  'Entertainment',
  'Shopping',
  'Other',
];

export default function ExpensesPage() {
  const { user, authState } = useAuth();
  const [records, setRecords] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: 'Housing',
    amount: '',
    expense_type: 'essential' as ExpenseType,
    record_date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('expense_records') as any)
          .select('*')
          .eq('user_id', userId)
          .order('record_date', { ascending: false });

        if (error) {
          console.error('Error fetching expense records:', error);
          setErrorMessage(error.message || 'Failed to load expense records.');
          return;
        }

        setRecords((data as ExpenseRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch expenses exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading expenses.'
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
      category: 'Housing',
      amount: '',
      expense_type: 'essential',
      record_date: new Date().toISOString().split('T')[0],
      description: '',
    });
    setEditingId(null);
  };

  const handleStartEdit = (record: ExpenseRow) => {
    setEditingId(record.id);
    setFormData({
      category: record.category,
      amount: String(record.amount),
      expense_type: record.expense_type as ExpenseType,
      record_date: record.record_date,
      description: record.description || '',
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage expenses.');
      return;
    }

    const numericAmount = parseFloat(formData.amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid positive expense amount.');
      return;
    }

    if (!formData.category) {
      setErrorMessage('Please select a category.');
      return;
    }

    if (!formData.record_date) {
      setErrorMessage('Please select a valid date.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      category: formData.category,
      amount: numericAmount,
      expense_type: formData.expense_type,
      record_date: formData.record_date,
      description: formData.description.trim() || null,
    };

    try {
      if (editingId) {
        const { error } = await (supabase.from('expense_records') as any)
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating expense:', error);
          setErrorMessage(error.message || 'Failed to update expense.');
          return;
        }

        setSuccessMessage('Expense updated successfully.');
      } else {
        const { error } = await (supabase.from('expense_records') as any).insert({
          ...payload,
          user_id: user.id,
        });

        if (error) {
          console.error('Error adding expense:', error);
          setErrorMessage(error.message || 'Failed to add expense.');
          return;
        }

        setSuccessMessage('Expense added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Expense submission exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving expense.'
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
      const { error } = await (supabase.from('expense_records') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting expense:', error);
        setErrorMessage(error.message || 'Failed to delete expense.');
        return;
      }

      setSuccessMessage('Expense deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete expense exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting expense.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalEssential = records
    .filter((e) => e.expense_type === 'essential')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalDiscretionary = records
    .filter((e) => e.expense_type === 'discretionary')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const total = totalEssential + totalDiscretionary;

  // Compute category chart data from real database records
  const chartData: ExpenseChartData[] = useMemo(() => {
    const categoryMap = new Map<string, { amount: number; type: ExpenseType }>();
    for (const rec of records) {
      const current = categoryMap.get(rec.category);
      if (current) {
        current.amount += Number(rec.amount);
      } else {
        categoryMap.set(rec.category, {
          amount: Number(rec.amount),
          type: rec.expense_type as ExpenseType,
        });
      }
    }
    return Array.from(categoryMap.entries()).map(([category, { amount, type }]) => ({
      category,
      amount,
      type,
    }));
  }, [records]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Expenses"
        description="Track and categorize your monthly expenses."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 250, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Monthly</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Essential</p>
            <p className="mt-1 text-2xl font-bold text-chart-1">
              {formatCurrency(totalEssential)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Discretionary</p>
            <p className="mt-1 text-2xl font-bold text-chart-3">
              {formatCurrency(totalDiscretionary)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit expense form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Expense' : 'Add New Expense'}
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

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, category: val }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
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
                  placeholder="5000"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.expense_type}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, expense_type: val as ExpenseType }))
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="essential">Essential</SelectItem>
                    <SelectItem value="discretionary">Discretionary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.record_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, record_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="e.g., Monthly rent"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
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
                    {editingId ? 'Update Expense' : 'Save Expense'}
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

      {/* Chart */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Expense Breakdown by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No expenses recorded to display breakdown.
            </div>
          ) : (
            <ExpenseChart data={chartData} type="bar" />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Expense History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading expense records..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<TrendingDown className="h-6 w-6" />}
              title="No expenses recorded"
              description="Add your first expense to start tracking your spending."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.category}</TableCell>
                    <TableCell>{formatCurrency(Number(expense.amount))}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          expense.expense_type === 'essential'
                            ? 'bg-chart-1/10 text-chart-1'
                            : 'bg-chart-3/10 text-chart-3'
                        }`}
                      >
                        {expense.expense_type}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(expense.record_date)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.description || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(expense)}
                          title="Edit expense"
                          disabled={saving || deletingId === expense.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(expense.id)}
                          title="Delete expense"
                          disabled={saving || deletingId === expense.id}
                        >
                          {deletingId === expense.id ? (
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
