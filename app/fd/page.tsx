'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { MOCK_FD_RATES } from '@/lib/mock-data';
import { Plus, Landmark, Trash2, Pencil, Calendar, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

type FDRow = Database['public']['Tables']['fixed_deposits']['Row'];

export default function FDPage() {
  const { user, authState } = useAuth();
  const [records, setRecords] = useState<FDRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    bank_name: 'HDFC',
    principal: '',
    interest_rate: '7.0',
    tenure_months: '12',
    start_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    senior_citizen: false,
  });

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('fixed_deposits') as any)
          .select('*')
          .eq('user_id', userId)
          .order('start_date', { ascending: false });

        if (error) {
          console.error('Error fetching fixed deposits:', error);
          setErrorMessage(error.message || 'Failed to load fixed deposits.');
          return;
        }

        setRecords((data as FDRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch fixed deposits exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading fixed deposits.'
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
      bank_name: 'HDFC',
      principal: '',
      interest_rate: '7.0',
      tenure_months: '12',
      start_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      senior_citizen: false,
    });
    setEditingId(null);
  };

  const handleStartEdit = (fd: FDRow) => {
    setEditingId(fd.id);
    setFormData({
      bank_name: fd.bank_name,
      principal: String(fd.principal),
      interest_rate: String(fd.interest_rate),
      tenure_months: String(fd.tenure_months),
      start_date: fd.start_date,
      maturity_date: fd.maturity_date || '',
      senior_citizen: Boolean(fd.senior_citizen),
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage fixed deposits.');
      return;
    }

    const principal = parseFloat(formData.principal);
    const rate = parseFloat(formData.interest_rate);
    const tenure = parseInt(formData.tenure_months, 10);

    if (isNaN(principal) || principal <= 0) {
      setErrorMessage('Please enter a valid positive principal amount.');
      return;
    }
    if (isNaN(rate) || rate < 0) {
      setErrorMessage('Please enter a valid interest rate.');
      return;
    }
    if (isNaN(tenure) || tenure <= 0) {
      setErrorMessage('Please enter a valid tenure in months.');
      return;
    }
    if (!formData.start_date) {
      setErrorMessage('Please select a start date.');
      return;
    }

    // Auto-calculate maturity date if not explicitly filled
    let calculatedMaturity = formData.maturity_date.trim() || null;
    if (!calculatedMaturity && formData.start_date) {
      const d = new Date(formData.start_date);
      d.setMonth(d.getMonth() + tenure);
      calculatedMaturity = d.toISOString().split('T')[0];
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      bank_name: formData.bank_name,
      principal,
      interest_rate: rate,
      tenure_months: tenure,
      start_date: formData.start_date,
      maturity_date: calculatedMaturity,
      senior_citizen: formData.senior_citizen,
    };

    try {
      if (editingId) {
        const { error } = await (supabase.from('fixed_deposits') as any)
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating fixed deposit:', error);
          setErrorMessage(error.message || 'Failed to update fixed deposit.');
          return;
        }

        setSuccessMessage('Fixed deposit updated successfully.');
      } else {
        const { error } = await (supabase.from('fixed_deposits') as any).insert({
          ...payload,
          user_id: user.id,
        });

        if (error) {
          console.error('Error adding fixed deposit:', error);
          setErrorMessage(error.message || 'Failed to add fixed deposit.');
          return;
        }

        setSuccessMessage('Fixed deposit added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Fixed deposit submission exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving fixed deposit.'
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
      const { error } = await (supabase.from('fixed_deposits') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting fixed deposit:', error);
        setErrorMessage(error.message || 'Failed to delete fixed deposit.');
        return;
      }

      setSuccessMessage('Fixed deposit deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete fixed deposit exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting fixed deposit.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalPrincipal = records.reduce((sum, fd) => sum + Number(fd.principal), 0);
  const totalValue = records.reduce((sum, fd) => {
    const interest = Number(fd.principal) * (Number(fd.interest_rate) / 100) * (Number(fd.tenure_months) / 12);
    return sum + Number(fd.principal) + interest;
  }, 0);
  const avgInterestRate =
    records.length > 0
      ? (records.reduce((s, f) => s + Number(f.interest_rate), 0) / records.length).toFixed(1)
      : '0.0';

  return (
    <DashboardLayout>
      <PageHeader
        title="Fixed Deposits"
        description="Track your FDs and compare bank rates."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 250, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add FD
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total FD Principal"
          value={formatCurrency(totalPrincipal)}
          icon={<Landmark className="h-4 w-4" />}
          accent="primary"
        />
        <MetricCard
          title="Estimated Maturity Value"
          value={formatCurrency(totalValue)}
          subtitle="Approx. with interest"
          accent="success"
        />
        <MetricCard
          title="Active FDs"
          value={String(records.length)}
          accent="neutral"
        />
        <MetricCard
          title="Avg. Interest Rate"
          value={`${avgInterestRate}%`}
          accent="primary"
        />
      </div>

      {/* Add / Edit form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Fixed Deposit' : 'Add New Fixed Deposit'}
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
                <Label htmlFor="fd-bank">Bank Name</Label>
                <Select
                  value={formData.bank_name}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, bank_name: val }))}
                >
                  <SelectTrigger id="fd-bank">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_FD_RATES.map((r) => (
                      <SelectItem key={r.bank_name} value={r.bank_name}>
                        {r.bank_name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other Bank">Other Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-principal">Principal (₹)</Label>
                <Input
                  id="fd-principal"
                  type="number"
                  placeholder="100000"
                  value={formData.principal}
                  onChange={(e) => setFormData((prev) => ({ ...prev, principal: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-rate">Interest Rate (%)</Label>
                <Input
                  id="fd-rate"
                  type="number"
                  step="0.01"
                  placeholder="7.0"
                  value={formData.interest_rate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, interest_rate: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-tenure">Tenure (months)</Label>
                <Input
                  id="fd-tenure"
                  type="number"
                  placeholder="12"
                  value={formData.tenure_months}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tenure_months: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-start">Start Date</Label>
                <Input
                  id="fd-start"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fd-maturity">Maturity Date (optional)</Label>
                <Input
                  id="fd-maturity"
                  type="date"
                  value={formData.maturity_date}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, maturity_date: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Switch
                id="senior"
                checked={formData.senior_citizen}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, senior_citizen: checked }))
                }
              />
              <Label htmlFor="senior">Senior Citizen (higher rate)</Label>
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
                    {editingId ? 'Update FD' : 'Save FD'}
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

      {/* Your FDs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Your Fixed Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading fixed deposits..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-6 w-6" />}
              title="No fixed deposits found"
              description="Add your first fixed deposit to track principal, interest returns, and maturity dates."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Maturity</TableHead>
                  <TableHead>Senior</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((fd) => {
                  return (
                    <TableRow key={fd.id}>
                      <TableCell className="font-medium">{fd.bank_name}</TableCell>
                      <TableCell>{formatCurrency(Number(fd.principal))}</TableCell>
                      <TableCell>{fd.interest_rate}%</TableCell>
                      <TableCell>{fd.tenure_months} months</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(fd.start_date)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {fd.maturity_date ? formatDate(fd.maturity_date) : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {fd.senior_citizen ? (
                          <span className="text-xs font-medium text-success">Yes</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(fd)}
                            title="Edit FD"
                            disabled={saving || deletingId === fd.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(fd.id)}
                            title="Delete FD"
                            disabled={saving || deletingId === fd.id}
                          >
                            {deletingId === fd.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-danger" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-danger" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* FD Rate Comparison */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">FD Rate Comparison (12-month tenure)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Regular Rate</TableHead>
                <TableHead>Senior Citizen Rate</TableHead>
                <TableHead>Min. Amount</TableHead>
                <TableHead>Premature Withdrawal</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_FD_RATES.map((rate) => (
                <TableRow key={rate.bank_name}>
                  <TableCell className="font-medium">{rate.bank_name}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {rate.regular_interest_rate}%
                  </TableCell>
                  <TableCell>{rate.senior_citizen_interest_rate}%</TableCell>
                  <TableCell>{formatCurrency(rate.minimum_amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {rate.premature_withdrawal_notes}
                  </TableCell>
                  <TableCell className="text-xs">{rate.last_updated}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Rates shown are for reference only. Verify current rates with the
            bank before making a financial decision.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
