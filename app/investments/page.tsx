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
import { Plus, LineChart, Trash2, Pencil, CheckCircle2, AlertCircle, Loader2, X, TrendingUp, TrendingDown } from 'lucide-react';

type InvestmentRow = Database['public']['Tables']['investments']['Row'];

const assetTypes = ['Stock', 'Mutual Fund', 'ETF', 'Bond', 'Gold', 'Crypto', 'Real Estate', 'Other'];

export default function InvestmentsPage() {
  const { user, authState } = useAuth();
  const [records, setRecords] = useState<InvestmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    asset_type: 'Stock',
    symbol: '',
    quantity: '',
    purchase_price: '',
    current_value: '',
  });

  const fetchRecords = useCallback(
    async (userId: string, showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await (supabase.from('investments') as any)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching investments:', error);
          setErrorMessage(error.message || 'Failed to load investments.');
          return;
        }

        setRecords((data as InvestmentRow[]) || []);
      } catch (err: unknown) {
        console.error('Fetch investments exception:', err);
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred loading investments.'
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
      asset_type: 'Stock',
      symbol: '',
      quantity: '',
      purchase_price: '',
      current_value: '',
    });
    setEditingId(null);
  };

  const handleStartEdit = (inv: InvestmentRow) => {
    setEditingId(inv.id);
    setFormData({
      asset_type: inv.asset_type,
      symbol: inv.symbol,
      quantity: String(inv.quantity),
      purchase_price: String(inv.purchase_price),
      current_value: String(inv.current_value),
    });
    setSuccessMessage(null);
    setErrorMessage(null);
    window.scrollTo({ top: 250, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('You must be signed in to manage investments.');
      return;
    }

    const qty = parseFloat(formData.quantity);
    const purchase = parseFloat(formData.purchase_price);
    const current = parseFloat(formData.current_value);

    if (!formData.symbol.trim()) {
      setErrorMessage('Please enter an asset symbol or name.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('Please enter a valid positive quantity.');
      return;
    }
    if (isNaN(purchase) || purchase < 0) {
      setErrorMessage('Please enter a valid purchase price per unit.');
      return;
    }
    if (isNaN(current) || current < 0) {
      setErrorMessage('Please enter a valid current price per unit.');
      return;
    }

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const payload = {
      asset_type: formData.asset_type,
      symbol: formData.symbol.trim(),
      quantity: qty,
      purchase_price: purchase,
      current_value: current,
    };

    try {
      if (editingId) {
        const { error } = await (supabase.from('investments') as any)
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error updating investment:', error);
          setErrorMessage(error.message || 'Failed to update investment.');
          return;
        }

        setSuccessMessage('Investment updated successfully.');
      } else {
        const { error } = await (supabase.from('investments') as any).insert({
          ...payload,
          user_id: user.id,
        });

        if (error) {
          console.error('Error adding investment:', error);
          setErrorMessage(error.message || 'Failed to add investment.');
          return;
        }

        setSuccessMessage('Investment added successfully.');
      }

      resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Investment submission exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred saving investment.'
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
      const { error } = await (supabase.from('investments') as any)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting investment:', error);
        setErrorMessage(error.message || 'Failed to delete investment.');
        return;
      }

      setSuccessMessage('Investment deleted successfully.');
      if (editingId === id) resetForm();
      await fetchRecords(user.id, false);
    } catch (err: unknown) {
      console.error('Delete investment exception:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred deleting investment.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalInvested = records.reduce(
    (sum, inv) => sum + Number(inv.purchase_price || 0) * Number(inv.quantity || 0),
    0
  );
  const totalValue = records.reduce(
    (sum, inv) => sum + Number(inv.current_value || 0) * Number(inv.quantity || 0),
    0
  );
  const totalGain = totalValue - totalInvested;
  const gainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const assetTypeCount = new Set(records.map((i) => i.asset_type)).size;

  return (
    <DashboardLayout>
      <PageHeader
        title="Investments"
        description="Track your investment portfolio and allocation."
      >
        <Button
          onClick={() => {
            resetForm();
            window.scrollTo({ top: 250, behavior: 'smooth' });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Investment
        </Button>
      </PageHeader>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Portfolio Value"
          value={formatCurrency(totalValue)}
          icon={<LineChart className="h-4 w-4" />}
          accent="primary"
        />
        <MetricCard
          title="Total Invested"
          value={formatCurrency(totalInvested)}
          accent="neutral"
        />
        <MetricCard
          title="Total Gain/Loss"
          value={formatCurrency(totalGain)}
          subtitle={`${gainPercent >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%`}
          trend={gainPercent >= 0 ? 'up' : 'down'}
          trendValue={`${gainPercent >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%`}
          accent={gainPercent >= 0 ? 'success' : 'danger'}
        />
        <MetricCard
          title="Asset Types"
          value={String(assetTypeCount)}
          accent="primary"
        />
      </div>

      {/* Add / Edit form */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {editingId ? 'Edit Investment' : 'Add New Investment'}
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
                <Label htmlFor="asset-type">Asset Type</Label>
                <Select
                  value={formData.asset_type}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, asset_type: val }))}
                >
                  <SelectTrigger id="asset-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol / Name</Label>
                <Input
                  id="symbol"
                  placeholder="RELIANCE"
                  value={formData.symbol}
                  onChange={(e) => setFormData((prev) => ({ ...prev, symbol: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  placeholder="20"
                  value={formData.quantity}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase">Purchase Price / Unit (₹)</Label>
                <Input
                  id="purchase"
                  type="number"
                  step="any"
                  placeholder="295"
                  value={formData.purchase_price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, purchase_price: e.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current">Current Price / Unit (₹)</Label>
                <Input
                  id="current"
                  type="number"
                  step="any"
                  placeholder="300"
                  value={formData.current_value}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, current_value: e.target.value }))
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
                    {editingId ? 'Update Investment' : 'Save Investment'}
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
          <CardTitle className="text-base">Portfolio Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading investment portfolio..." />
          ) : records.length === 0 ? (
            <EmptyState
              icon={<LineChart className="h-6 w-6" />}
              title="No investment holdings found"
              description="Add stocks, mutual funds, or other assets to track portfolio performance."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset Type</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Purchase Price / Unit</TableHead>
                  <TableHead>Current Price / Unit</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Gain/Loss</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((inv) => {
                  const qty = Number(inv.quantity) || 0;
                  const purchase = Number(inv.purchase_price) || 0;
                  const current = Number(inv.current_value) || 0;
                  const invested = purchase * qty;
                  const holdingValue = current * qty;
                  const gain = holdingValue - invested;
                  const gainPct = invested > 0 ? (gain / invested) * 100 : 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.asset_type}</TableCell>
                      <TableCell className="font-semibold">{inv.symbol}</TableCell>
                      <TableCell>{inv.quantity}</TableCell>
                      <TableCell>{formatCurrency(purchase)}</TableCell>
                      <TableCell>{formatCurrency(current)}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(holdingValue)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            gain >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {gain >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {gain >= 0 ? '+' : ''}{formatCurrency(gain)} ({gainPct >= 0 ? '+' : ''}
                          {gainPct.toFixed(2)}%)
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartEdit(inv)}
                            title="Edit investment"
                            disabled={saving || deletingId === inv.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(inv.id)}
                            title="Delete investment"
                            disabled={saving || deletingId === inv.id}
                          >
                            {deletingId === inv.id ? (
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
    </DashboardLayout>
  );
}
