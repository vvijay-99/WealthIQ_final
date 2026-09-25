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
import { formatCurrency } from '@/lib/format';
import { Plus, CreditCard, Trash2, Pencil, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

type DebtRow = Database['public']['Tables']['debts']['Row'];

const debtTypes = [
  'Home Loan',
  'Car Loan',
  'Personal Loan',
  'Education Loan',
  'Credit Card',
  'Business Loan',
  'Other',
];

export default function DebtsPage() {
  const { user, authState } = useAuth();
  const [records, setRecords] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    debt_type: 'Home Loan',
    original_principal: '',
    remaining_balance: '',
    interest_rate: '',
    monthly_emi: '',
    remaining_months: '',
  });

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('debts') as any)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching debts:', error);
          setErrorMessage(error.message || 'Failed to load debt records.');
          return;
        }

        setRecords((data as DebtRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch debts exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading debts.'
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
      debt_type: 'Home Loan',
      original_principal: '',
      remaining_balance: '',
      interest_rate: '',
      monthly_emi: '',
      remaining_months: '',
    });
    setEditingId(null);
  };

  const handleStartEdit = (debt: DebtRow) => {
    setEditingId(debt.id);
    setFormData({
      debt_type: debt.debt_type,
      original_principal: String(debt.original_principal),
      remaining_balance: String(debt.remaining_balance),
      interest_rate: String(debt.interest_rate),
      monthly_emi: String(debt.monthly_emi),
      remaining_months: String(debt.remaining_months),
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage debt obligations.');
      return;
    }

    const principal = parseFloat(formData.original_principal);
    const balance = parseFloat(formData.remaining_balance);
    const rate = parseFloat(formData.interest_rate);
    const emi = parseFloat(formData.monthly_emi);
    const months = parseInt(formData.remaining_months, 10);

    if (isNaN(principal) || principal <= 0) {
      setErrorMessage('Please enter a valid original principal.');
      return;
    }
    if (isNaN(balance) || balance < 0) {
      setErrorMessage('Please enter a valid remaining balance.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      setErrorMessage('Please enter a valid interest rate.');
      return;
    }
    if (isNaN(emi) || emi < 0) {
      setErrorMessage('Please enter a valid monthly EMI.');
      return;
    }
    if (isNaN(months) || months < 0) {
      setErrorMessage('Please enter valid remaining months.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      debt_type: formData.debt_type,
      original_principal: principal,
      remaining_balance: balance,
      interest_rate: rate,
      monthly_emi: emi,
      remaining_months: months,
    };

    try {
      if (editingId) {
        const { error } = await (supabase.from('debts') as any)
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating debt:', error);
          setErrorMessage(error.message || 'Failed to update debt record.');
          return;
        }

        setSuccessMessage('Debt record updated successfully.');
      } else {
        const { error } = await (supabase.from('debts') as any).insert({
          ...payload,
          user_id: user.id,
        });

        if (error) {
          console.error('Error adding debt:', error);
          setErrorMessage(error.message || 'Failed to add debt record.');
          return;
        }

        setSuccessMessage('Debt record added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Debt submission exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving debt record.'
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
      const { error } = await (supabase.from('debts') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting debt:', error);
        setErrorMessage(error.message || 'Failed to delete debt record.');
        return;
      }

      setSuccessMessage('Debt record deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete debt exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting debt record.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalDebt = records.reduce((sum, d) => sum + Number(d.remaining_balance), 0);
  const totalEMI = records.reduce((sum, d) => sum + Number(d.monthly_emi), 0);
  const totalOriginal = records.reduce((sum, d) => sum + Number(d.original_principal), 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="Debts"
        description="Manage your loans, EMIs, and debt obligations."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 250, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Debt
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Outstanding Debt"
          value={formatCurrency(totalDebt)}
          icon={<CreditCard className="h-4 w-4" />}
          accent="danger"
        />
        <MetricCard
          title="Monthly EMI Total"
          value={formatCurrency(totalEMI)}
          accent="danger"
        />
        <MetricCard
          title="Total Borrowed"
          value={formatCurrency(totalOriginal)}
          accent="neutral"
        />
        <MetricCard
          title="Active Loans"
          value={String(records.length)}
          accent="warning"
        />
      </div>

      {/* Add / Edit form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Debt Obligation' : 'Add New Debt'}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="debt-type">Loan Type</Label>
                <Select
                  value={formData.debt_type}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, debt_type: val }))}
                >
                  <SelectTrigger id="debt-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {debtTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="principal">Original Principal (₹)</Label>
                <Input
                  id="principal"
                  type="number"
                  placeholder="2500000"
                  value={formData.original_principal}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, original_principal: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remaining">Remaining Balance (₹)</Label>
                <Input
                  id="remaining"
                  type="number"
                  placeholder="280000"
                  value={formData.remaining_balance}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, remaining_balance: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest">Interest Rate (%)</Label>
                <Input
                  id="interest"
                  type="number"
                  step="0.01"
                  placeholder="8.5"
                  value={formData.interest_rate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, interest_rate: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emi">Monthly EMI (₹)</Label>
                <Input
                  id="emi"
                  type="number"
                  placeholder="12000"
                  value={formData.monthly_emi}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, monthly_emi: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenure">Remaining Months</Label>
                <Input
                  id="tenure"
                  type="number"
                  placeholder="28"
                  value={formData.remaining_months}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, remaining_months: e.target.value }))
                  }
                  required
                />
              </div>
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
                    {editingId ? 'Update Debt' : 'Save Debt'}
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

      {/* Table */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Debt Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading debt obligations..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-6 w-6" />}
              title="No active debt obligations"
              description="Add loans or EMI commitments to keep track of balances and repayments."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Type</TableHead>
                  <TableHead>Original Principal</TableHead>
                  <TableHead>Remaining Balance</TableHead>
                  <TableHead>Interest Rate</TableHead>
                  <TableHead>Monthly EMI</TableHead>
                  <TableHead>Months Left</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((debt) => (
                  <TableRow key={debt.id}>
                    <TableCell className="font-medium">{debt.debt_type}</TableCell>
                    <TableCell>{formatCurrency(Number(debt.original_principal))}</TableCell>
                    <TableCell className="font-semibold text-danger">
                      {formatCurrency(Number(debt.remaining_balance))}
                    </TableCell>
                    <TableCell>{debt.interest_rate}%</TableCell>
                    <TableCell>{formatCurrency(Number(debt.monthly_emi))}</TableCell>
                    <TableCell>{debt.remaining_months}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(debt)}
                          title="Edit debt"
                          disabled={saving || deletingId === debt.id}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(debt.id)}
                          title="Delete debt"
                          disabled={saving || deletingId === debt.id}
                        >
                          {deletingId === debt.id ? (
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
