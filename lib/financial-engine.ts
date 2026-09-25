// ============================================================
// WealthIQ Financial Intelligence Engine (Phase 3C Step 1)
// Transparent, Deterministic Financial Health Scoring & Spending Risk
// NOTE: Educational & demo financial model; not professional advice.
// ============================================================

import type { Database } from '@/lib/supabase/types';
import type {
  HealthCategory,
  RiskLevel,
  FinancialFeatures,
  ForecastPoint,
  Recommendation,
  Priority,
} from '@/lib/types';
import { supabase } from '@/lib/supabase/client';

export type IncomeRow = Database['public']['Tables']['income_records']['Row'];
export type ExpenseRow = Database['public']['Tables']['expense_records']['Row'];
export type SavingsRow = Database['public']['Tables']['savings_records']['Row'];
export type DebtRow = Database['public']['Tables']['debts']['Row'];
export type InvestmentRow = Database['public']['Tables']['investments']['Row'];
export type FDRow = Database['public']['Tables']['fixed_deposits']['Row'];
export type ScoreRow = Database['public']['Tables']['financial_scores']['Row'];

export interface FinancialData {
  incomeRecords: IncomeRow[];
  expenseRecords: ExpenseRow[];
  savingsRecords: SavingsRow[];
  debtRecords: DebtRow[];
  investmentRecords: InvestmentRow[];
  fdRecords: FDRow[];
}

export interface ScoreBreakdown {
  savings_score: number;
  expense_score: number;
  debt_score: number;
  emergency_score: number;
  investment_score: number;
}

export interface FinancialScoreResult {
  health_score: number;
  health_category: HealthCategory;
  spending_risk: RiskLevel;
  breakdown: ScoreBreakdown;
  features: FinancialFeatures;
}

export interface ForecastHorizonPoint {
  months: number;
  label: string;
  savings: number;
  net_worth: number;
  debt: number;
}

export interface FinancialForecastResult {
  monthly_income: number;
  monthly_expenses: number;
  monthly_surplus: number;
  current_savings: number;
  current_investments: number;
  current_fd_principal: number;
  current_debt: number;
  current_net_worth: number;
  trajectory_type: 'positive' | 'neutral' | 'deficit';
  trajectory_label: string;
  points: ForecastPoint[];
  horizons: {
    current: ForecastHorizonPoint;
    m6: ForecastHorizonPoint;
    m12: ForecastHorizonPoint;
    m24: ForecastHorizonPoint;
    m36: ForecastHorizonPoint;
  };
  assumptions: string[];
}

/**
 * Weights used for combining component scores into the 0-100 Financial Health Score.
 * Explicit 5 components:
 * 1. savings behavior: 25%
 * 2. expense burden: 25%
 * 3. debt burden: 20%
 * 4. emergency fund coverage: 15%
 * 5. investments/assets: 15%
 * Total sum = 100%.
 */
export const SCORE_WEIGHTS = {
  savings: 0.25, // 25%
  expense: 0.25, // 25%
  debt: 0.20, // 20%
  emergency: 0.15, // 15%
  investment: 0.15, // 15%
} as const;

/**
 * Spending risk classification thresholds.
 */
export const RISK_THRESHOLDS = {
  high: {
    expense_ratio: 0.85, // Expenses > 85% of income
    debt_to_income: 0.45, // Monthly EMI > 45% of income
  },
  medium: {
    expense_ratio: 0.65, // Expenses > 65% of income
    discretionary_ratio: 0.25, // Discretionary > 25% of income
    debt_to_income: 0.30, // Monthly EMI > 30% of income
    savings_rate: 0.10, // Saving < 10% of income
  },
} as const;

function clamp(min: number, max: number, val: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Step 2: Feature Engineering from user's Supabase records.
 * Guaranteed never to produce NaN or Infinity.
 */
export function calculateFinancialFeatures(data: FinancialData): FinancialFeatures {
  const {
    incomeRecords,
    expenseRecords,
    savingsRecords,
    debtRecords,
    investmentRecords,
    fdRecords,
  } = data;

  // 1. Income
  const monthly_income = incomeRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // 2. Expenses
  const essential_expenses = expenseRecords
    .filter((e) => e.expense_type === 'essential')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const discretionary_expenses = expenseRecords
    .filter((e) => e.expense_type === 'discretionary')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const monthly_expenses = essential_expenses + discretionary_expenses;

  // 3. Savings
  const totalSavingsType = savingsRecords
    .filter((s) => s.savings_type === 'Total Savings')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const current_savings =
    totalSavingsType > 0
      ? totalSavingsType
      : savingsRecords.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const emergency_fund = savingsRecords
    .filter((s) => s.savings_type === 'Emergency Fund')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // 4. Debts
  const total_debt = debtRecords.reduce((sum, d) => sum + Number(d.remaining_balance || 0), 0);
  const monthly_emi = debtRecords.reduce((sum, d) => sum + Number(d.monthly_emi || 0), 0);

  // 5. Investments & FDs
  const investment_value = investmentRecords.reduce(
    (sum, i) => sum + Number(i.quantity || 0) * Number(i.current_value || 0),
    0
  );
  const fd_value = fdRecords.reduce((sum, f) => {
    const principal = Number(f.principal || 0);
    const rate = Number(f.interest_rate || 0);
    const tenure = Number(f.tenure_months || 12);
    const interest = principal * (rate / 100) * (tenure / 12);
    return sum + principal + interest;
  }, 0);
  const fd_principal = fdRecords.reduce((sum, f) => sum + Number(f.principal || 0), 0);

  // 6. Net Worth Formula
  // Net Worth = Current Savings + Investment Value + FD Principal - Total Debt
  const net_worth = current_savings + investment_value + fd_principal - total_debt;

  // 7. Ratios (safe division)
  const savings_rate =
    monthly_income > 0
      ? clamp(0, 1, (monthly_income - monthly_expenses) / monthly_income)
      : current_savings > 0 && monthly_expenses === 0
      ? 1.0
      : 0.0;

  const expense_ratio =
    monthly_income > 0
      ? clamp(0, 2, monthly_expenses / monthly_income)
      : monthly_expenses > 0
      ? 1.0
      : 0.0;

  const discretionary_expense_ratio =
    monthly_income > 0
      ? clamp(0, 1, discretionary_expenses / monthly_income)
      : 0.0;

  const debt_to_income =
    monthly_income > 0
      ? clamp(0, 2, monthly_emi / monthly_income)
      : monthly_emi > 0
      ? 1.0
      : 0.0;

  const benchmarkEssential =
    essential_expenses > 0
      ? essential_expenses
      : monthly_expenses > 0
      ? monthly_expenses
      : 0;

  const emergency_fund_months =
    benchmarkEssential > 0
      ? clamp(0, 24, emergency_fund / benchmarkEssential)
      : emergency_fund > 0
      ? 6.0
      : 0.0;

  return {
    monthly_income,
    monthly_expenses,
    essential_expenses,
    discretionary_expenses,
    current_savings,
    emergency_fund,
    total_debt,
    monthly_emi,
    investment_value,
    fd_value,
    savings_rate,
    expense_ratio,
    discretionary_expense_ratio,
    debt_to_income,
    emergency_fund_months,
    net_worth,
  };
}

/**
 * Step 3: Transparent, deterministic scoring engine (0-100).
 */
export function calculateHealthScore(
  features: FinancialFeatures,
  data: FinancialData
): {
  health_score: number;
  health_category: HealthCategory;
  breakdown: ScoreBreakdown;
} {
  const hasAnyRecords =
    data.incomeRecords.length > 0 ||
    data.expenseRecords.length > 0 ||
    data.savingsRecords.length > 0 ||
    data.debtRecords.length > 0 ||
    data.investmentRecords.length > 0 ||
    data.fdRecords.length > 0;

  if (!hasAnyRecords) {
    return {
      health_score: 0,
      health_category: 'Moderate',
      breakdown: {
        savings_score: 0,
        expense_score: 0,
        debt_score: 0,
        emergency_score: 0,
        investment_score: 0,
      },
    };
  }

  // 1. Savings Behavior (0-100) — Benchmark: 20%+ savings rate gets 100
  let savings_score = 0;
  if (features.monthly_income > 0) {
    savings_score = clamp(0, 100, Math.round((features.savings_rate / 0.20) * 100));
  } else if (features.current_savings > 0) {
    savings_score = 50;
  }

  // 2. Expense Burden (0-100) — Benchmark: <= 40% expenses is 100, scaling down as expenses exceed
  let expense_score = 0;
  if (features.monthly_income > 0) {
    expense_score = clamp(0, 100, Math.round(100 - Math.max(0, features.expense_ratio - 0.40) * 140));
  } else if (features.monthly_expenses === 0) {
    expense_score = 75;
  } else {
    expense_score = 20;
  }

  // 3. Debt Burden (0-100) — Benchmark: 0 DTI is 100, scaling down with higher monthly EMI burden
  let debt_score = 0;
  if (features.total_debt === 0 && features.monthly_emi === 0) {
    debt_score = 100; // Debt-free bonus
  } else if (features.monthly_income > 0) {
    debt_score = clamp(0, 100, Math.round(100 - features.debt_to_income * 180));
  } else {
    debt_score = 20;
  }

  // 4. Emergency Fund Coverage (0-100) — Benchmark: 6 months of expenses gets 100
  const emergency_score = clamp(
    0,
    100,
    Math.round((features.emergency_fund_months / 6) * 100)
  );

  // 5. Investments & Assets (0-100) — Benchmark: 6 months of income (or min ₹1,00,000)
  let investment_score = 0;
  const totalAssets = features.investment_value + (data.fdRecords.reduce((s, f) => s + Number(f.principal || 0), 0));
  if (totalAssets > 0) {
    const targetAssetBenchmark =
      features.monthly_income > 0 ? features.monthly_income * 6 : 100000;
    investment_score = clamp(0, 100, Math.round((totalAssets / targetAssetBenchmark) * 100));
  }

  // Weighted combination across the 5 explicit components
  const weightedSum =
    savings_score * SCORE_WEIGHTS.savings +
    expense_score * SCORE_WEIGHTS.expense +
    debt_score * SCORE_WEIGHTS.debt +
    emergency_score * SCORE_WEIGHTS.emergency +
    investment_score * SCORE_WEIGHTS.investment;

  const health_score = clamp(0, 100, Math.round(weightedSum));

  // Determine Category
  let health_category: HealthCategory = 'Moderate';
  if (health_score >= 80) health_category = 'Excellent';
  else if (health_score >= 65) health_category = 'Healthy';
  else if (health_score >= 50) health_category = 'Moderate';
  else if (health_score >= 35) health_category = 'Weak';
  else health_category = 'Critical';

  return {
    health_score,
    health_category,
    breakdown: {
      savings_score,
      expense_score,
      debt_score,
      emergency_score,
      investment_score,
    },
  };
}

/**
 * Step 4: Deterministic Spending Risk Classifier.
 */
export function classifySpendingRisk(features: FinancialFeatures): RiskLevel {
  const { monthly_income, monthly_expenses, expense_ratio, discretionary_expense_ratio, debt_to_income, savings_rate } =
    features;

  // High Risk conditions
  if (
    (monthly_income === 0 && monthly_expenses > 0) ||
    monthly_expenses > monthly_income ||
    expense_ratio > RISK_THRESHOLDS.high.expense_ratio ||
    debt_to_income > RISK_THRESHOLDS.high.debt_to_income
  ) {
    return 'High';
  }

  // Medium Risk conditions
  if (
    expense_ratio > RISK_THRESHOLDS.medium.expense_ratio ||
    discretionary_expense_ratio > RISK_THRESHOLDS.medium.discretionary_ratio ||
    debt_to_income > RISK_THRESHOLDS.medium.debt_to_income ||
    (monthly_income > 0 && savings_rate < RISK_THRESHOLDS.medium.savings_rate)
  ) {
    return 'Medium';
  }

  // Otherwise healthy / Low Risk
  return 'Low';
}

/**
 * Step 5: Master calculation and persistence into financial_scores.
 */
export async function evaluateAndPersistFinancialScore(
  userId: string,
  data: FinancialData,
  lastKnownScore?: ScoreRow | null
): Promise<FinancialScoreResult> {
  const features = calculateFinancialFeatures(data);
  const { health_score, health_category, breakdown } = calculateHealthScore(features, data);
  const spending_risk = classifySpendingRisk(features);

  const roundedSavingsRate = Math.round(features.savings_rate * 1000) / 1000;
  const roundedExpenseRatio = Math.round(features.expense_ratio * 1000) / 1000;
  const roundedDebtToIncome = Math.round(features.debt_to_income * 1000) / 1000;
  const roundedEmergencyMonths = Math.round(features.emergency_fund_months * 10) / 10;

  // Determine if a new record needs to be inserted into financial_scores
  const isChanged =
    !lastKnownScore ||
    Number(lastKnownScore.health_score) !== health_score ||
    lastKnownScore.health_category !== health_category ||
    lastKnownScore.spending_risk !== spending_risk ||
    Number(lastKnownScore.expense_ratio) !== roundedExpenseRatio ||
    Number(lastKnownScore.savings_rate) !== roundedSavingsRate ||
    Number(lastKnownScore.debt_to_income) !== roundedDebtToIncome;

  if (isChanged && userId) {
    const payload = {
      user_id: userId,
      health_score,
      health_category,
      spending_risk,
      savings_rate: roundedSavingsRate,
      expense_ratio: roundedExpenseRatio,
      debt_to_income: roundedDebtToIncome,
      emergency_fund_months: roundedEmergencyMonths,
      model_version: 'v1.0-deterministic',
    };

    try {
      const { error } = await (supabase.from('financial_scores') as any).insert(payload);
      if (error) {
        console.error('Error persisting financial_scores record:', error);
      }
    } catch (err) {
      console.error('Failed to persist financial_scores:', err);
    }
  }

  return {
    health_score,
    health_category,
    spending_risk,
    breakdown,
    features,
  };
}

/**
 * Step 6: Deterministic Financial Forecast.
 * Projects Net Worth and Savings over 6, 12, 24, and 36 months based on
 * current income, expenses, and cash surplus/deficit.
 * Does NOT invent speculative market returns.
 */
export function calculateFinancialForecast(
  features: FinancialFeatures,
  data: FinancialData
): FinancialForecastResult {
  const monthly_income = Math.max(0, features.monthly_income || 0);
  const monthly_expenses = Math.max(0, features.monthly_expenses || 0);
  const monthly_surplus = monthly_income - monthly_expenses;
  const current_savings = Math.max(0, features.current_savings || 0);
  const current_investments = Math.max(0, features.investment_value || 0);
  const current_fd_principal = Math.max(
    0,
    (data.fdRecords || []).reduce((sum, f) => sum + Number(f.principal || 0), 0)
  );
  const current_debt = Math.max(0, features.total_debt || 0);
  const monthly_emi = Math.max(0, features.monthly_emi || 0);
  const current_net_worth = current_savings + current_investments + current_fd_principal - current_debt;

  let trajectory_type: 'positive' | 'neutral' | 'deficit' = 'neutral';
  let trajectory_label = 'Neutral cash flow: Monthly income matches expenses exactly.';

  if (monthly_surplus > 0) {
    trajectory_type = 'positive';
    trajectory_label = `Positive trajectory: Generating ₹${Math.round(monthly_surplus).toLocaleString('en-IN')}/month in net surplus.`;
  } else if (monthly_surplus < 0) {
    trajectory_type = 'deficit';
    trajectory_label = `Deficit trajectory: Monthly expenses exceed income by ₹${Math.round(Math.abs(monthly_surplus)).toLocaleString('en-IN')}.`;
  }

  // Helper for computing horizon at m months
  const computePoint = (m: number, label: string): ForecastHorizonPoint => {
    let projected_savings = current_savings;
    let projected_net_worth = current_net_worth;
    const projected_debt = Math.max(0, current_debt - monthly_emi * m);

    if (monthly_surplus > 0) {
      projected_savings = current_savings + monthly_surplus * m;
      projected_net_worth = projected_savings + current_investments + current_fd_principal - projected_debt;
    } else if (monthly_surplus < 0) {
      const totalDeficit = Math.abs(monthly_surplus) * m;
      projected_savings = Math.max(0, current_savings - totalDeficit);
      projected_net_worth = current_net_worth + monthly_surplus * m;
    } else {
      projected_savings = current_savings;
      projected_net_worth = projected_savings + current_investments + current_fd_principal - projected_debt;
    }

    return {
      months: m,
      label,
      savings: Math.round(projected_savings),
      net_worth: Math.round(projected_net_worth),
      debt: Math.round(projected_debt),
    };
  };

  const current = computePoint(0, 'Current');
  const m6 = computePoint(6, '6 Months');
  const m12 = computePoint(12, '12 Months');
  const m24 = computePoint(24, '24 Months');
  const m36 = computePoint(36, '36 Months');

  // Chart milestones: Now (0), 6M, 12M, 18M, 24M, 30M, 36M
  const chartMilestones = [
    { m: 0, label: 'Now', isForecast: false },
    { m: 6, label: '6M', isForecast: true },
    { m: 12, label: '12M', isForecast: true },
    { m: 18, label: '18M', isForecast: true },
    { m: 24, label: '24M', isForecast: true },
    { m: 30, label: '30M', isForecast: true },
    { m: 36, label: '36M', isForecast: true },
  ];

  const points: ForecastPoint[] = chartMilestones.map((ms) => {
    const pt = computePoint(ms.m, ms.label);
    return {
      month: ms.label,
      savings: pt.savings,
      net_worth: pt.net_worth,
      isForecast: ms.isForecast,
    };
  });

  const assumptions = [
    monthly_surplus > 0
      ? `Monthly surplus of ₹${Math.round(monthly_surplus).toLocaleString('en-IN')} is consistently added to liquid savings.`
      : monthly_surplus < 0
      ? `Monthly cash deficit of ₹${Math.round(Math.abs(monthly_surplus)).toLocaleString('en-IN')} drains existing liquidity.`
      : 'Cash flow is exactly balanced; no net accumulation or drain.',
    'Investments and fixed deposits are held at baseline recorded values with zero market speculation.',
    monthly_emi > 0
      ? `Active debt is amortized at the ongoing rate of ₹${Math.round(monthly_emi).toLocaleString('en-IN')}/month.`
      : 'No active debt liabilities are amortizing.',
  ];

  return {
    monthly_income,
    monthly_expenses,
    monthly_surplus,
    current_savings,
    current_investments,
    current_fd_principal,
    current_debt,
    current_net_worth,
    trajectory_type,
    trajectory_label,
    points,
    horizons: {
      current,
      m6,
      m12,
      m24,
      m36,
    },
    assumptions,
  };
}

/**
 * Step 7: Deterministic Personalized Recommendations.
 * Evaluates the user's real financial ratios, health score, and risk level
 * to generate educational, explainable suggestions.
 */
export function generatePersonalizedRecommendations(
  features: FinancialFeatures,
  healthScore: number,
  spendingRisk: RiskLevel,
  data: FinancialData,
  userId = 'user'
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const now = new Date().toISOString();

  const {
    monthly_income,
    monthly_expenses,
    discretionary_expenses,
    essential_expenses,
    investment_value,
    savings_rate,
    expense_ratio,
    discretionary_expense_ratio,
    debt_to_income,
    emergency_fund_months,
    total_debt,
    monthly_emi,
  } = features;

  const totalAssets = investment_value + (data.fdRecords || []).reduce((s, f) => s + Number(f.principal || 0), 0);

  // 1. Income Check
  if (data.incomeRecords.length === 0 || monthly_income === 0) {
    recommendations.push({
      id: 'rec-income-missing',
      user_id: userId,
      category: 'Financial Planning',
      priority: 'High',
      severity: 0.95,
      title: 'Record Your Monthly Income Streams',
      reason: 'No monthly income records are currently tracked. Income is the cornerstone metric for calculating savings rate, debt ratios, and accurate forecasts.',
      suggested_action: 'Navigate to the Income module and add your recurring primary salary, freelance, or business revenue.',
      created_at: now,
    });
  }

  // 2. High Expense Ratio / Deficit Check
  if (monthly_income > 0 && (monthly_expenses > monthly_income || expense_ratio > 0.85)) {
    recommendations.push({
      id: 'rec-expenses-critical',
      user_id: userId,
      category: 'Expenses',
      priority: 'High',
      severity: 0.9,
      title: 'Curtail High Expense Burden',
      reason: `Your monthly expenses (₹${Math.round(monthly_expenses).toLocaleString('en-IN')}) consume ${Math.round(expense_ratio * 100)}% of income, creating a cash deficit or critically thin buffer.`,
      suggested_action: `Review non-essential outlays (currently ₹${Math.round(discretionary_expenses).toLocaleString('en-IN')}/mo). Aim to trim discretionary purchases by 10%–15% to restore positive cash flow.`,
      created_at: now,
    });
  } else if (monthly_income > 0 && (expense_ratio > 0.65 || discretionary_expense_ratio > 0.25)) {
    recommendations.push({
      id: 'rec-expenses-moderate',
      user_id: userId,
      category: 'Expenses',
      priority: 'Medium',
      severity: 0.6,
      title: 'Optimize Discretionary Spending',
      reason: `Your overall expense ratio is ${Math.round(expense_ratio * 100)}% with discretionary purchases accounting for ${Math.round(discretionary_expense_ratio * 100)}% of income.`,
      suggested_action: 'Audit recurring subscriptions and leisure expenditures to redirect an extra 5% of monthly income toward your emergency reserve.',
      created_at: now,
    });
  }

  // 3. Savings Rate Check
  if (monthly_income > 0 && savings_rate < 0.10 && monthly_expenses <= monthly_income) {
    recommendations.push({
      id: 'rec-savings-low',
      user_id: userId,
      category: 'Savings',
      priority: 'High',
      severity: 0.85,
      title: 'Increase Monthly Savings Rate',
      reason: `Your savings rate is ${Math.round(savings_rate * 100)}%, below the healthy financial benchmark of 20%.`,
      suggested_action: 'Automate a standing transfer of 10% of your earnings on payday before allocating funds to non-essential spending.',
      created_at: now,
    });
  } else if (monthly_income > 0 && savings_rate >= 0.10 && savings_rate < 0.20) {
    recommendations.push({
      id: 'rec-savings-moderate',
      user_id: userId,
      category: 'Savings',
      priority: 'Medium',
      severity: 0.5,
      title: 'Scale Toward 20% Savings Rate',
      reason: `You are currently saving ${Math.round(savings_rate * 100)}% of your income. Increasing this to 20% strengthens resilience against unexpected disruptions.`,
      suggested_action: 'Gradually increase your monthly savings allocation by 2% each quarter to systematically reach the 20% target.',
      created_at: now,
    });
  }

  // 4. Emergency Fund Coverage Check
  if (emergency_fund_months < 1.0 && (essential_expenses > 0 || monthly_expenses > 0)) {
    recommendations.push({
      id: 'rec-emergency-critical',
      user_id: userId,
      category: 'Emergency Fund',
      priority: 'High',
      severity: 0.95,
      title: 'Build Immediate Emergency Reserves',
      reason: `Your emergency fund covers only ${emergency_fund_months.toFixed(1)} months of essential living costs (benchmark is 3–6 months, ~₹${Math.round((essential_expenses || monthly_expenses) * 3).toLocaleString('en-IN')}).`,
      suggested_action: 'Direct all available monthly surplus into a dedicated liquid savings account until at least 1–3 months of expenses are secured.',
      created_at: now,
    });
  } else if (emergency_fund_months < 3.0 && (essential_expenses > 0 || monthly_expenses > 0)) {
    recommendations.push({
      id: 'rec-emergency-moderate',
      user_id: userId,
      category: 'Emergency Fund',
      priority: 'Medium',
      severity: 0.65,
      title: 'Strengthen Emergency Cushion',
      reason: `Your emergency savings cover ${emergency_fund_months.toFixed(1)} months of expenses. Expanding this to 3–6 months protects against unforeseen emergencies.`,
      suggested_action: 'Continue allocating a portion of your monthly savings toward your emergency fund until you hit a 3–6 month threshold.',
      created_at: now,
    });
  } else if (emergency_fund_months >= 6.0) {
    recommendations.push({
      id: 'rec-emergency-healthy',
      user_id: userId,
      category: 'Emergency Fund',
      priority: 'Low',
      severity: 0.2,
      title: 'Emergency Reserve Fully Funded',
      reason: `You have ${emergency_fund_months.toFixed(1)} months of living expenses safely preserved in emergency reserves.`,
      suggested_action: 'Your safety net is in place. You can safely direct any additional cash surplus beyond this threshold into long-term wealth building.',
      created_at: now,
    });
  }

  // 5. Debt Burden Check
  if (monthly_income > 0 && debt_to_income > 0.40) {
    recommendations.push({
      id: 'rec-debt-high',
      user_id: userId,
      category: 'Debt',
      priority: 'High',
      severity: 0.9,
      title: 'Prioritize Debt Amortization',
      reason: `Monthly EMI commitments (₹${Math.round(monthly_emi).toLocaleString('en-IN')}) absorb ${Math.round(debt_to_income * 100)}% of your income, representing a heavy fixed burden.`,
      suggested_action: 'Target highest-interest liabilities first (avalanche method) and look into refinancing or consolidating to lower aggregate monthly payments.',
      created_at: now,
    });
  } else if (monthly_income > 0 && debt_to_income > 0.20) {
    recommendations.push({
      id: 'rec-debt-moderate',
      user_id: userId,
      category: 'Debt',
      priority: 'Medium',
      severity: 0.55,
      title: 'Manage Outstanding Debt Load',
      reason: `Your debt-to-income ratio is ${Math.round(debt_to_income * 100)}% across ₹${Math.round(total_debt).toLocaleString('en-IN')} in total balances.`,
      suggested_action: 'Avoid opening new credit lines and dedicate any variable windfalls or bonuses toward paying down principal balance.',
      created_at: now,
    });
  } else if (total_debt === 0 && monthly_income > 0) {
    recommendations.push({
      id: 'rec-debt-free',
      user_id: userId,
      category: 'Debt',
      priority: 'Low',
      severity: 0.1,
      title: 'Debt-Free Flexibility',
      reason: 'You have zero recorded debt and no monthly EMI obligations, maximizing your discretionary cash flow.',
      suggested_action: 'Maintain your debt-free status and deploy surplus cash into diversified, inflation-hedging asset classes.',
      created_at: now,
    });
  }

  // 6. Investments & Asset Base Check
  if (totalAssets === 0) {
    recommendations.push({
      id: 'rec-investments-none',
      user_id: userId,
      category: 'Investment Diversification',
      priority: 'Medium',
      severity: 0.7,
      title: 'Begin Asset Allocation Strategy',
      reason: 'You currently have zero active investments or fixed deposits recorded in your portfolio.',
      suggested_action: 'Once your emergency fund is initiated, explore conservative, diversified index funds or fixed deposits to protect purchasing power against inflation.',
      created_at: now,
    });
  } else if (monthly_income > 0 && totalAssets < monthly_income * 2) {
    recommendations.push({
      id: 'rec-investments-grow',
      user_id: userId,
      category: 'Investment Diversification',
      priority: 'Medium',
      severity: 0.5,
      title: 'Expand Long-Term Asset Holdings',
      reason: `Your total asset holdings (₹${Math.round(totalAssets).toLocaleString('en-IN')}) are relatively modest compared to your annual cash flow.`,
      suggested_action: 'Set up systematic monthly contributions (e.g. SIPs) to dollar-cost average into diversified broad-market holdings.',
      created_at: now,
    });
  } else if (investment_value > 0) {
    recommendations.push({
      id: 'rec-investments-review',
      user_id: userId,
      category: 'Investment Diversification',
      priority: 'Low',
      severity: 0.25,
      title: 'Maintain Portfolio Allocation',
      reason: `You have ₹${Math.round(investment_value).toLocaleString('en-IN')} in active investment holdings across your portfolio.`,
      suggested_action: 'Periodically rebalance your asset allocation across equity, debt, and liquid instruments to match your changing life horizons.',
      created_at: now,
    });
  }

  // 7. General Financial Health & Positive Reinforcement
  if (healthScore >= 75 && spendingRisk === 'Low') {
    recommendations.push({
      id: 'rec-health-excellent',
      user_id: userId,
      category: 'Financial Planning',
      priority: 'Low',
      severity: 0.15,
      title: 'Maintain Healthy Financial Rhythm',
      reason: `Your Financial Health Score of ${healthScore}/100 and Low Spending Risk reflect solid financial discipline and budgeting control.`,
      suggested_action: 'Keep up your consistent saving and investing habits, and review long-term retirement and milestone goals on an annual basis.',
      created_at: now,
    });
  }

  // Sort by priority (High -> Medium -> Low), then severity descending
  const priorityOrder: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
  recommendations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pDiff !== 0) return pDiff;
    return b.severity - a.severity;
  });

  return recommendations;
}
