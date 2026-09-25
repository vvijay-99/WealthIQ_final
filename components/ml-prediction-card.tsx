'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Cpu,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react';
import type { MLPredictionResult } from '@/lib/ml-engine';
import { getHealthCategoryBg } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RiskBadge } from '@/components/risk-badge';

interface MLPredictionCardProps {
  prediction: MLPredictionResult | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  Critical: 'bg-danger text-danger-foreground',
  Weak: 'bg-warning text-warning-foreground',
  Moderate: 'bg-amber-500 text-white',
  Healthy: 'bg-primary text-primary-foreground',
  Excellent: 'bg-emerald-600 text-white',
};

const CATEGORY_PROGRESS_COLORS: Record<string, string> = {
  Critical: 'bg-danger',
  Weak: 'bg-warning',
  Moderate: 'bg-amber-500',
  Healthy: 'bg-primary',
  Excellent: 'bg-emerald-500',
};

export function MLPredictionCard({ prediction }: MLPredictionCardProps) {
  const [showFeatureDetails, setShowFeatureDetails] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  if (!prediction) {
    return null;
  }

  if (!prediction.hasSufficientData) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">AI Financial Assessment</CardTitle>
          </div>
          <CardDescription>
            {prediction.explanation.methodology}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const {
    modelVersion,
    algorithm,
    predictedCategory,
    spendingRisk,
    confidence,
    classProbabilities,
    topPositiveFactors,
    topRiskFactors,
    allFeatureContributions,
    explanation,
  } = prediction;

  const categories: Array<keyof typeof classProbabilities> = [
    'Critical',
    'Weak',
    'Moderate',
    'Healthy',
    'Excellent',
  ];

  return (
    <Card className="relative overflow-hidden border border-border shadow-sm">
      {/* Top Accent Gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-emerald-500" />

      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg font-semibold">
                  AI Financial Health Assessment
                </CardTitle>
                <Badge variant="outline" className="text-[11px] font-mono font-normal">
                  {modelVersion}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {algorithm}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              Confidence: <strong className="ml-1 text-foreground">{confidence}%</strong>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Prediction & Confidence Banner */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              ML Predicted Financial Archetype
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-semibold',
                  getHealthCategoryBg(predictedCategory)
                )}
              >
                {predictedCategory}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Highest probability archetype selected by the model ({confidence}% likelihood).
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Prediction Probability
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {confidence}%
              </span>
              <span className="text-xs text-muted-foreground">relative class likelihood</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Relative statistical likelihood among the 5 financial archetypes.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Predicted Spending Risk
            </p>
            <div className="mt-2 flex items-center gap-2">
              <RiskBadge level={spendingRisk} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Evaluated from downside probability mass & debt-to-income.
            </p>
          </div>
        </div>

        {/* Clear Explanation of Prediction Meaning & Scope */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/85 leading-relaxed space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Info className="h-4 w-4 shrink-0" />
            <span>Understanding Your ML Prediction</span>
          </div>
          <p>
            Based on 10 financial features, the model estimates which financial-health archetype most closely matches your current profile. The probability represents the model&apos;s relative class likelihood, not a prediction of future financial outcomes. The archetype with the highest probability ({predictedCategory} at {confidence}%) is the model&apos;s selected prediction.
          </p>
          <p className="text-[11px] text-muted-foreground pt-0.5">
            <strong>What the model does NOT predict:</strong> The model does NOT predict future money, future income, stock prices, market returns, or guaranteed financial outcomes.
          </p>
        </div>

        {/* Multi-Class Probability Distribution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Multi-Class Probability Distribution</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              Total: 100% (Selected: {predictedCategory} at {confidence}%)
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {categories.map((cat) => {
              const probPercent = Math.round(classProbabilities[cat] * 100);
              const isWinner = cat === predictedCategory;
              return (
                <div
                  key={cat}
                  className={`rounded-lg border p-2 text-center transition-all ${
                    isWinner
                      ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/20'
                      : 'border-border/50 bg-background/50'
                  }`}
                >
                  <div className="text-[11px] font-medium truncate text-muted-foreground">
                    {cat}
                  </div>
                  <div
                    className={`mt-1 text-sm font-bold ${
                      isWinner ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {probPercent}%
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        CATEGORY_PROGRESS_COLORS[cat] || 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(4, probPercent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            The highest probability class ({predictedCategory}) is the model&apos;s selected archetype prediction.
          </p>
        </div>

        {/* Top Influencing Factors (Strengths & Risks) */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Positive Factors */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Key Resilient Drivers (Strengths)</span>
            </div>
            {topPositiveFactors.length > 0 ? (
              <ul className="space-y-2.5">
                {topPositiveFactors.map((factor) => (
                  <li key={factor.key} className="text-xs text-muted-foreground">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>{factor.name}</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        {factor.rawFormatted}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {factor.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No dominant positive outliers currently observed in the feature set.
              </p>
            )}
          </div>

          {/* Risk Factors */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
              <TrendingDown className="h-4 w-4" />
              <span>Primary Vulnerability Areas (Risks)</span>
            </div>
            {topRiskFactors.length > 0 ? (
              <ul className="space-y-2.5">
                {topRiskFactors.map((factor) => (
                  <li key={factor.key} className="text-xs text-muted-foreground">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span>{factor.name}</span>
                      <span className="font-mono text-amber-600 dark:text-amber-400">
                        {factor.rawFormatted}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {factor.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                All features are currently within stable, non-critical benchmark ranges.
              </p>
            )}
          </div>
        </div>

        {/* Feature Details Accordion Toggle */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFeatureDetails(!showFeatureDetails)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Cpu className="mr-1.5 h-3.5 w-3.5" />
              {showFeatureDetails ? 'Hide Feature Breakdown' : 'View All 10 Model Features'}
              {showFeatureDetails ? (
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMethodology(!showMethodology)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Info className="mr-1.5 h-3.5 w-3.5" />
              {showMethodology ? 'Hide Model Explanation' : 'How This Differs from Health Score'}
              {showMethodology ? (
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Feature Breakdown Table */}
          {showFeatureDetails && (
            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              {/* Feature Attribution Explanation Legend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] bg-background/80 p-2.5 rounded border border-border/50 text-muted-foreground">
                <div>
                  <strong className="text-foreground">Recorded Value:</strong> Actual value from your financial records.
                </div>
                <div>
                  <strong className="text-foreground">Weight:</strong> How important the feature is to the ML model.
                </div>
                <div>
                  <strong className="text-foreground">Normalized:</strong> Transformed model input on the model&apos;s comparable scale.
                </div>
                <div>
                  <strong className="text-foreground">Impact:</strong> Whether the feature contributes positively or negatively to the current predicted profile.
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th className="pb-2 font-medium">Feature</th>
                      <th className="pb-2 font-medium">Recorded Value</th>
                      <th className="pb-2 font-medium">Weight</th>
                      <th className="pb-2 font-medium">Normalized</th>
                      <th className="pb-2 font-medium">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {allFeatureContributions.map((fc) => (
                      <tr key={fc.key} className="hover:bg-muted/40">
                        <td className="py-2 font-medium">{fc.name}</td>
                        <td className="py-2 font-mono">{fc.rawFormatted}</td>
                        <td className="py-2 font-mono text-muted-foreground">
                          {(fc.weight * 100).toFixed(0)}%
                        </td>
                        <td className="py-2 font-mono text-muted-foreground">
                          {fc.normalizedValue.toFixed(2)}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              fc.impact === 'positive'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : fc.impact === 'negative'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {fc.impact}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Model Methodology & Explanation Card */}
          {showMethodology && (
            <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                <span>How This Differs from Health Score</span>
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Deterministic Health Score:</strong> A fixed 0–100 scoring rubric based on five weighted financial pillars and predefined benchmarks.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">ML Prediction:</strong> An explainable feature-based classifier that compares your 10-dimensional financial profile with financial-health archetypes and produces class probabilities.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Why Results May Differ:</strong> The two systems can produce different results because they use different methods. The Health Score calculates a direct weighted average against fixed benchmark thresholds, while the ML model evaluates multivariate distances across all 10 features simultaneously, accounting for complex trade-offs and non-linear interactions.
                </p>
              </div>
              <p className="pt-2 text-[11px] text-muted-foreground/80 italic border-t border-primary/10">
                {explanation.disclaimer}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
