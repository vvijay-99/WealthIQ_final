'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RecommendationCard } from '@/components/recommendation-card';
import { LoadingState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import type { Recommendation, Priority } from '@/lib/types';
import {
  calculateFinancialFeatures,
  calculateHealthScore,
  classifySpendingRisk,
  generatePersonalizedRecommendations,
  IncomeRow,
  ExpenseRow,
  SavingsRow,
  DebtRow,
  InvestmentRow,
  FDRow,
} from '@/lib/financial-engine';
import { Lightbulb, AlertCircle } from 'lucide-react';

export default function RecommendationsPage() {
  const { user, authState } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (userId: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [incomeRes, expenseRes, savingsRes, debtRes, investRes, fdRes] =
        await Promise.all([
          (supabase.from('income_records') as any).select('*').eq('user_id', userId),
          (supabase.from('expense_records') as any).select('*').eq('user_id', userId),
          (supabase.from('savings_records') as any).select('*').eq('user_id', userId),
          (supabase.from('debts') as any).select('*').eq('user_id', userId),
          (supabase.from('investments') as any).select('*').eq('user_id', userId),
          (supabase.from('fixed_deposits') as any).select('*').eq('user_id', userId),
        ]);

      const finData = {
        incomeRecords: (incomeRes.data as IncomeRow[]) || [],
        expenseRecords: (expenseRes.data as ExpenseRow[]) || [],
        savingsRecords: (savingsRes.data as SavingsRow[]) || [],
        debtRecords: (debtRes.data as DebtRow[]) || [],
        investmentRecords: (investRes.data as InvestmentRow[]) || [],
        fdRecords: (fdRes.data as FDRow[]) || [],
      };

      const features = calculateFinancialFeatures(finData);
      const scoreRes = calculateHealthScore(features, finData);
      const riskRes = classifySpendingRisk(features);
      const recs = generatePersonalizedRecommendations(
        features,
        scoreRes.health_score,
        riskRes,
        finData,
        userId
      );
      setRecommendations(recs);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to generate recommendations.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchRecommendations(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, fetchRecommendations]);

  const filtered =
    priorityFilter === 'All'
      ? recommendations
      : recommendations.filter((r) => r.priority === priorityFilter);

  return (
    <DashboardLayout>
      <PageHeader
        title="Personalized Recommendations"
        description="Deterministic, rule-based financial guidance tailored to your actual income, expenses, debt, and savings."
      />

      {errorMessage && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-8">
          <LoadingState message="Generating personalized recommendations..." />
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Priority Filter Tabs */}
          <div className="flex items-center gap-2">
            {(['All', 'High', 'Medium', 'Low'] as const).map((p) => (
              <Button
                key={p}
                variant={priorityFilter === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPriorityFilter(p)}
                className="text-xs"
              >
                {p} Priority {p !== 'All' && `(${recommendations.filter((r) => r.priority === p).length})`}
              </Button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-medium text-foreground">No active recommendations in this tier</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Your recorded financial metrics are well-managed in this category. Continue maintaining disciplined financial habits.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((rec) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
