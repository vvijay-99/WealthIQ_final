import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface MarketInsightItem {
  symbol: string;
  name: string;
  current_price: number;
  daily_change: number;
  daily_change_percent: number;
  week_52_high: number;
  week_52_low: number;
  distance_from_52w_high: number;
  distance_category: 'Very Near 52W High' | 'Near 52W High' | 'Moderate Distance' | 'Far From 52W High';
  volume: number;
  last_updated: string; // ISO string representing regularMarketTime from exchange
  exchange: string;
  currency: string;
}

export interface MarketInsightsResponse {
  is_market_open: boolean;
  market_status_text: string;
  source: string;
  is_delayed: boolean;
  is_stale: boolean;
  server_fetched_at: string;
  items: MarketInsightItem[];
  error?: string;
}

// In-memory server cache to avoid rate-limiting
let cachedResponse: MarketInsightsResponse | null = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 25000; // 25 seconds server cache

const BENCHMARK_SYMBOLS = [
  { symbol: 'RELIANCE.NS', displayName: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { symbol: 'TCS.NS', displayName: 'TCS', name: 'Tata Consultancy Services' },
  { symbol: 'HDFCBANK.NS', displayName: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'INFY.NS', displayName: 'INFY', name: 'Infosys Ltd' },
  { symbol: 'ICICIBANK.NS', displayName: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { symbol: 'ITC.NS', displayName: 'ITC', name: 'ITC Ltd' },
  { symbol: 'SBIN.NS', displayName: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL.NS', displayName: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
];

function checkIsMarketOpen(): { isOpen: boolean; statusText: string } {
  // IST is UTC + 5:30
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  const day = ist.getDay(); // 0 = Sunday, 6 = Saturday
  const minutes = ist.getHours() * 60 + ist.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const isDuringTradingHours = minutes >= 555 && minutes <= 930; // 09:15 to 15:30 IST

  if (isWeekday && isDuringTradingHours) {
    return {
      isOpen: true,
      statusText: 'Market Open (NSE Trading Session: 09:15 – 15:30 IST)',
    };
  }

  return {
    isOpen: false,
    statusText: 'Market Closed — Showing latest official NSE closing settlement',
  };
}

function getDistanceCategory(distance: number): MarketInsightItem['distance_category'] {
  if (distance <= 5) return 'Very Near 52W High';
  if (distance <= 15) return 'Near 52W High';
  if (distance <= 30) return 'Moderate Distance';
  return 'Far From 52W High';
}

export async function GET() {
  const now = Date.now();
  const { isOpen, statusText } = checkIsMarketOpen();

  // If cache is fresh, return cached response with updated market open status
  if (cachedResponse && now - lastCacheTimestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...cachedResponse,
      is_market_open: isOpen,
      market_status_text: statusText,
      is_stale: false,
    });
  }

  try {
    const results = await Promise.allSettled(
      BENCHMARK_SYMBOLS.map(async (sec) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sec.symbol}?interval=1d&range=5d`;
        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
          },
          next: { revalidate: 0 },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch ${sec.symbol}: HTTP ${res.status}`);
        }

        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) {
          throw new Error(`Invalid response structure for ${sec.symbol}`);
        }

        const current_price = Number(meta.regularMarketPrice ?? 0);
        const chartPrevClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? current_price);
        const daily_change = Number((current_price - chartPrevClose).toFixed(2));
        const daily_change_percent =
          chartPrevClose > 0
            ? Number((((current_price - chartPrevClose) / chartPrevClose) * 100).toFixed(2))
            : 0;

        const week_52_high = Number(meta.fiftyTwoWeekHigh ?? current_price);
        const week_52_low = Number(meta.fiftyTwoWeekLow ?? current_price);

        const distance_from_52w_high =
          week_52_high > 0
            ? Number((((week_52_high - current_price) / week_52_high) * 100).toFixed(2))
            : 0;

        const volume = Number(meta.regularMarketVolume ?? 0);
        const tradeTimestamp = meta.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : new Date().toISOString();

        const item: MarketInsightItem = {
          symbol: sec.displayName,
          name: meta.longName || meta.shortName || sec.name,
          current_price,
          daily_change,
          daily_change_percent,
          week_52_high,
          week_52_low,
          distance_from_52w_high,
          distance_category: getDistanceCategory(distance_from_52w_high),
          volume,
          last_updated: tradeTimestamp,
          exchange: meta.fullExchangeName || meta.exchangeName || 'NSE',
          currency: meta.currency || 'INR',
        };

        return item;
      })
    );

    const successfulItems: MarketInsightItem[] = [];
    results.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) {
        successfulItems.push(r.value);
      }
    });

    if (successfulItems.length === 0) {
      throw new Error('All benchmark equity fetches failed');
    }

    const payload: MarketInsightsResponse = {
      is_market_open: isOpen,
      market_status_text: statusText,
      source: 'NSE India (via Yahoo Finance API)',
      is_delayed: false,
      is_stale: false,
      server_fetched_at: new Date().toISOString(),
      items: successfulItems,
    };

    cachedResponse = payload;
    lastCacheTimestamp = now;

    return NextResponse.json(payload);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Market data fetch failed';

    // If cache exists, fall back to cached response marked as stale
    if (cachedResponse) {
      return NextResponse.json({
        ...cachedResponse,
        is_market_open: isOpen,
        market_status_text: statusText,
        is_stale: true,
        error: `Live fetch temporarily unavailable (${errorMsg}). Showing cached data.`,
      });
    }

    // No cache available
    return NextResponse.json(
      {
        is_market_open: isOpen,
        market_status_text: statusText,
        source: 'NSE India',
        is_delayed: false,
        is_stale: true,
        server_fetched_at: new Date().toISOString(),
        items: [],
        error: 'Market data is temporarily unavailable. Please try refreshing again shortly.',
      },
      { status: 503 }
    );
  }
}
