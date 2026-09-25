'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Info,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { MarketInsightsResponse, MarketInsightItem } from '../api/market-insights/route';

function formatExchangeTime(isoString: string) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return (
      d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).toUpperCase() + ' IST'
    );
  } catch {
    return isoString;
  }
}

export default function MarketInsightsPage() {
  const [data, setData] = useState<MarketInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clientFetchTime, setClientFetchTime] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMarketData = useCallback(async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const res = await fetch('/api/market-insights', { cache: 'no-store' });
      const json: MarketInsightsResponse = await res.json();

      if (!res.ok && (!json.items || json.items.length === 0)) {
        throw new Error(json.error || `HTTP error ${res.status}`);
      }

      setData(json);
      setClientFetchTime(
        new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).toUpperCase() + ' IST'
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Live market data feed temporarily unavailable.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  // 60-second auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchMarketData();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMarketData]);

  // Find latest exchange trade timestamp among all items
  const latestExchangeTimestamp = data?.items?.length
    ? data.items.reduce((latest, item) => {
        return new Date(item.last_updated) > new Date(latest)
          ? item.last_updated
          : latest;
      }, data.items[0].last_updated)
    : null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Market Insights"
        description="Authentic exchange benchmark reference data and 52-week positioning."
      />

      <div className="mt-6 space-y-6">
        {/* Educational Disclaimer Banner */}
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground/80">
          <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
          <p>
            Market Insights provides educational reference benchmarks to help you understand market movements and distance from 52-week highs. WealthIQ does not provide stock recommendations or market predictions.
          </p>
        </div>

        {/* Live Stale/Error Notification Banner */}
        {(errorMessage || data?.is_stale || data?.error) && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>
              {data?.error ||
                errorMessage ||
                'External market data feed is temporarily rate-limited. Displaying cached exchange quotes.'}
            </p>
          </div>
        )}

        {/* Market Status & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Market Open / Closed Status Badge */}
            {data?.is_market_open ? (
              <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 py-1 px-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 ml-0.5" />
                <span>Market Open (NSE 09:15 – 15:30 IST)</span>
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted/50 text-muted-foreground flex items-center gap-1.5 py-1 px-2.5">
                <Clock className="h-3.5 w-3.5" />
                <span>Market Closed — Displaying latest available official NSE closing settlement data</span>
              </Badge>
            )}

            <Badge variant="outline" className="text-xs text-muted-foreground">
              Source: {data?.source || 'NSE India'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {latestExchangeTimestamp && (
              <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2.5 py-1">
                <span className="font-medium text-foreground">Market Data Time:</span>
                <span className="font-mono text-primary font-semibold">
                  {formatExchangeTime(latestExchangeTimestamp)}
                </span>
              </div>
            )}

            {clientFetchTime && (
              <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2.5 py-1">
                <span className="font-medium text-foreground">Fetched:</span>
                <span className="font-mono text-foreground font-semibold">{clientFetchTime}</span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchMarketData(true)}
              disabled={loading || refreshing}
              className="h-8 gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Timestamp Clarity Notice */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground leading-relaxed">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <p>
            <strong className="text-foreground">Understanding Timestamps:</strong>{' '}
            <span className="text-foreground font-medium">Market Data Time</span> is the official quote/settlement timestamp recorded by the exchange (NSE).{' '}
            <span className="text-foreground font-medium">Fetched</span> is the time WealthIQ requested the data from the provider. When the market is closed, fetching retrieves the latest official exchange settlement; it does not indicate active trading during non-market hours.
          </p>
        </div>

        {/* Equities Table Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Key Index Equities (NSE)</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="text-xs text-muted-foreground h-7"
              >
                Auto-refresh (60s):{' '}
                <span className={autoRefresh ? 'font-semibold text-emerald-600 dark:text-emerald-400 ml-1' : 'ml-1'}>
                  {autoRefresh ? 'ON' : 'OFF'}
                </span>
              </Button>
            </div>
            <CardDescription>
              Real benchmark market prices, daily price changes, and distance from 52-week highs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  Fetching live NSE market data...
                </p>
              </div>
            ) : !data?.items || data.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-3" />
                <p className="text-sm font-medium text-foreground">
                  No market data available at this time
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {errorMessage || 'Unable to connect to the market data feed. Please try refreshing.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchMarketData(true)}
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-3 font-medium">Security</th>
                      <th className="pb-3 font-medium text-right">Price (LTP)</th>
                      <th className="pb-3 font-medium text-right">Daily Change</th>
                      <th className="pb-3 font-medium text-right">52W Range</th>
                      <th className="pb-3 font-medium text-right">From 52W High</th>
                      <th className="pb-3 font-medium text-right">Position</th>
                      <th className="pb-3 font-medium text-right">Market Data Time (IST)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.items.map((item: MarketInsightItem) => {
                      const isPositive = item.daily_change >= 0;
                      return (
                        <tr key={item.symbol} className="hover:bg-muted/40">
                          <td className="py-3 font-medium">
                            <div>
                              <span className="font-semibold text-foreground">{item.symbol}</span>
                              <span className="block text-xs text-muted-foreground">{item.name}</span>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-right font-medium">
                            {formatCurrency(item.current_price)}
                          </td>
                          <td className="py-3 text-right">
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${
                                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isPositive ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5" />
                              )}
                              {isPositive ? '+' : ''}
                              {formatCurrency(item.daily_change)} ({isPositive ? '+' : ''}
                              {item.daily_change_percent.toFixed(2)}%)
                            </span>
                          </td>
                          <td className="py-3 font-mono text-xs text-right text-muted-foreground">
                            {formatCurrency(item.week_52_low)} – {formatCurrency(item.week_52_high)}
                          </td>
                          <td className="py-3 font-mono text-xs text-right font-medium">
                            -{item.distance_from_52w_high.toFixed(1)}%
                          </td>
                          <td className="py-3 text-right">
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-normal ${
                                item.distance_category === 'Very Near 52W High'
                                  ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                                  : item.distance_category === 'Near 52W High'
                                  ? 'border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-500/10'
                                  : item.distance_category === 'Moderate Distance'
                                  ? 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                                  : 'border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/10'
                              }`}
                            >
                              {item.distance_category}
                            </Badge>
                          </td>
                          <td className="py-3 font-mono text-xs text-right text-muted-foreground">
                            {new Date(item.last_updated).toLocaleTimeString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
