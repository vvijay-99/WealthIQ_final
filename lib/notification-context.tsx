'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { FinancialFeatures, HealthCategory, RiskLevel } from '@/lib/types';
import type { FinancialData } from '@/lib/financial-engine';
import { formatCurrency } from '@/lib/format';

export type NotificationType = 'health_score' | 'spending_risk' | 'monthly_digest';

export interface InAppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  link?: string;
  dedupKey: string;
}

export interface NotificationPreferences {
  scoreAlerts: boolean;
  spendingAlerts: boolean;
  monthlyDigest: boolean;
}

interface NotificationContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => Promise<void> | void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  evaluateNotifications: (
    data: FinancialData,
    features: FinancialFeatures,
    score: number,
    category: HealthCategory,
    spendingRisk: RiskLevel
  ) => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  scoreAlerts: true,
  spendingAlerts: true,
  monthlyDigest: true,
};

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {},
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotification: () => {},
  clearAll: () => {},
  evaluateNotifications: () => {},
});

function getPrefsStorageKey(userId: string): string {
  return `wealthiq_notif_prefs_${userId}`;
}

function getNotifsStorageKey(userId: string): string {
  return `wealthiq_notifications_${userId}`;
}

function getLastStateStorageKey(userId: string): string {
  return `wealthiq_notif_last_state_${userId}`;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const notificationsRef = useRef<InAppNotification[]>(notifications);
  notificationsRef.current = notifications;

  const preferencesRef = useRef<NotificationPreferences>(preferences);
  preferencesRef.current = preferences;

  // Load preferences and notifications whenever the authenticated user changes
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      notificationsRef.current = [];
      setPreferences(DEFAULT_PREFERENCES);
      preferencesRef.current = DEFAULT_PREFERENCES;
      return;
    }

    // 1. Load User Preferences
    try {
      const savedPrefs = localStorage.getItem(getPrefsStorageKey(userId));
      if (savedPrefs) {
        const parsed = { ...DEFAULT_PREFERENCES, ...JSON.parse(savedPrefs) };
        setPreferences(parsed);
        preferencesRef.current = parsed;
      } else {
        setPreferences(DEFAULT_PREFERENCES);
        preferencesRef.current = DEFAULT_PREFERENCES;
      }
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
      preferencesRef.current = DEFAULT_PREFERENCES;
    }

    // 2. Load User Notifications
    try {
      const savedNotifs = localStorage.getItem(getNotifsStorageKey(userId));
      if (savedNotifs) {
        const parsed = JSON.parse(savedNotifs);
        if (Array.isArray(parsed)) {
          // Filter to guarantee user isolation
          const userNotifs = parsed.filter((n) => n.userId === userId);
          setNotifications(userNotifs);
          notificationsRef.current = userNotifs;
        }
      } else {
        setNotifications([]);
        notificationsRef.current = [];
      }
    } catch {
      setNotifications([]);
      notificationsRef.current = [];
    }
  }, [userId]);

  // Save notifications to localStorage when updated
  const persistNotifications = useCallback(
    (newNotifs: InAppNotification[]) => {
      if (!userId) return;
      setNotifications(newNotifs);
      notificationsRef.current = newNotifs;
      try {
        localStorage.setItem(getNotifsStorageKey(userId), JSON.stringify(newNotifs));
      } catch (err) {
        console.warn('Failed to save notifications to localStorage:', err);
      }
    },
    [userId]
  );

  // Update & persist preferences
  const updatePreferences = useCallback(
    (newPrefs: Partial<NotificationPreferences>) => {
      if (!userId) return;
      setPreferences((prev) => {
        const updated = { ...prev, ...newPrefs };
        preferencesRef.current = updated;
        try {
          localStorage.setItem(getPrefsStorageKey(userId), JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save notification preferences:', err);
        }
        return updated;
      });
    },
    [userId]
  );

  // Mark single notification as read
  const markAsRead = useCallback(
    (id: string) => {
      if (!userId) return;
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        notificationsRef.current = updated;
        try {
          localStorage.setItem(getNotifsStorageKey(userId), JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save notifications to localStorage:', err);
        }
        return updated;
      });
    },
    [userId]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.read ? n : { ...n, read: true }));
      notificationsRef.current = updated;
      try {
        localStorage.setItem(getNotifsStorageKey(userId), JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save notifications to localStorage:', err);
      }
      return updated;
    });
  }, [userId]);

  // Clear single notification
  const clearNotification = useCallback(
    (id: string) => {
      if (!userId) return;
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        notificationsRef.current = updated;
        try {
          localStorage.setItem(getNotifsStorageKey(userId), JSON.stringify(updated));
        } catch (err) {
          console.warn('Failed to save notifications to localStorage:', err);
        }
        return updated;
      });
    },
    [userId]
  );

  // Clear all notifications
  const clearAll = useCallback(() => {
    if (!userId) return;
    setNotifications([]);
    notificationsRef.current = [];
    try {
      localStorage.setItem(getNotifsStorageKey(userId), JSON.stringify([]));
    } catch (err) {
      console.warn('Failed to save notifications to localStorage:', err);
    }
  }, [userId]);

  // Unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  /**
   * Evaluates user financial metrics against notification criteria and
   * creates real in-app notifications if conditions are met.
   * Includes duplicate prevention.
   */
  const evaluateNotifications = useCallback(
    (
      data: FinancialData,
      features: FinancialFeatures,
      score: number,
      category: HealthCategory,
      spendingRisk: RiskLevel
    ) => {
      if (!userId) return;

      const hasRecords =
        data.incomeRecords.length > 0 ||
        data.expenseRecords.length > 0 ||
        data.savingsRecords.length > 0 ||
        data.debtRecords.length > 0 ||
        data.investmentRecords.length > 0 ||
        data.fdRecords.length > 0;

      if (!hasRecords) return;

      // Load last evaluated state to detect significant transitions
      let lastState: {
        score?: number;
        category?: HealthCategory;
        spendingRisk?: RiskLevel;
        lastMonthDigest?: string;
      } = {};

      try {
        const raw = localStorage.getItem(getLastStateStorageKey(userId));
        if (raw) lastState = JSON.parse(raw);
      } catch {
        lastState = {};
      }

      const newNotifsToAdd: InAppNotification[] = [];
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentPrefs = preferencesRef.current;
      const currentNotifs = notificationsRef.current;

      // -------------------------------------------------------------------
      // 1. HEALTH SCORE ALERT
      // Trigger: If enabled, fires when category transitions or score shifts >= 5 pts,
      // or if score enters Weak/Critical territory.
      // -------------------------------------------------------------------
      if (currentPrefs.scoreAlerts) {
        const scoreChangedSignificantly =
          lastState.score !== undefined && Math.abs(score - lastState.score) >= 5;
        const categoryChanged =
          lastState.category !== undefined && lastState.category !== category;
        const isVulnerable = category === 'Critical' || category === 'Weak';

        // Fingerprint dedup key for score alert
        const scoreDedupKey = `hs_${category}_${Math.floor(score / 5)}`;
        const alreadyExists = currentNotifs.some((n) => n.dedupKey === scoreDedupKey);

        if ((scoreChangedSignificantly || categoryChanged || isVulnerable) && !alreadyExists) {
          let title = `Financial Health Alert: ${category} (${score}/100)`;
          let message = `Your Financial Health Score is currently ${score} (${category}). `;

          if (lastState.score !== undefined) {
            const diff = score - lastState.score;
            if (diff > 0) {
              title = `Health Score Improved: ${category} (+${diff} pts)`;
              message += `Your score improved by ${diff} points due to favorable cash flow and asset behavior.`;
            } else if (diff < 0) {
              title = `Health Score Dropped: ${category} (${diff} pts)`;
              message += `Your score decreased by ${Math.abs(diff)} points due to increased expenses or debt service.`;
            } else {
              message += `Review component pillars on the Dashboard to optimize your score.`;
            }
          } else {
            message += `Component pillars: Savings, Expense burden, Debt ratio, Emergency fund, and Investments.`;
          }

          newNotifsToAdd.push({
            id: `notif_hs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            type: 'health_score',
            title,
            message,
            timestamp: now.toISOString(),
            read: false,
            link: '/dashboard',
            dedupKey: scoreDedupKey,
          });
        }
      }

      // -------------------------------------------------------------------
      // 2. SPENDING RISK WARNING
      // Trigger: If enabled, fires when spendingRisk is High (or transitions to Medium/High).
      // -------------------------------------------------------------------
      if (currentPrefs.spendingAlerts) {
        if (spendingRisk === 'High') {
          const riskDedupKey = `risk_high_${Math.round(features.expense_ratio * 10)}_${Math.round(features.debt_to_income * 10)}`;
          const alreadyExists = currentNotifs.some((n) => n.dedupKey === riskDedupKey);

          if (!alreadyExists) {
            let reason = 'Operating outflow exceeds safe thresholds.';
            if (features.monthly_expenses > features.monthly_income && features.monthly_income > 0) {
              reason = `Monthly expenses (${formatCurrency(features.monthly_expenses)}) exceed your income (${formatCurrency(features.monthly_income)}).`;
            } else if (features.expense_ratio > 0.85) {
              reason = `Expense ratio is at ${(features.expense_ratio * 100).toFixed(1)}% of income (threshold: 85%).`;
            } else if (features.debt_to_income > 0.45) {
              reason = `Debt obligations require ${(features.debt_to_income * 100).toFixed(1)}% of your monthly income.`;
            }

            newNotifsToAdd.push({
              id: `notif_risk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              userId,
              type: 'spending_risk',
              title: 'High Spending Risk Warning',
              message: `${reason} Review discretionary spending and debt repayment strategies.`,
              timestamp: now.toISOString(),
              read: false,
              link: '/expenses',
              dedupKey: riskDedupKey,
            });
          }
        }
      }

      // -------------------------------------------------------------------
      // 3. MONTHLY DIGEST
      // Trigger: If enabled, honestly generates exactly ONE monthly summary per calendar month.
      // -------------------------------------------------------------------
      if (currentPrefs.monthlyDigest) {
        const digestDedupKey = `digest_${currentMonthKey}`;
        const alreadyExists = currentNotifs.some((n) => n.dedupKey === digestDedupKey);

        if (!alreadyExists) {
          const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
          const surplus = features.monthly_income - features.monthly_expenses;
          const surplusFormatted =
            surplus >= 0 ? `+${formatCurrency(surplus)}` : `-${formatCurrency(Math.abs(surplus))}`;

          newNotifsToAdd.push({
            id: `notif_digest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            type: 'monthly_digest',
            title: `Monthly Financial Digest (${monthName})`,
            message: `Income: ${formatCurrency(features.monthly_income)} | Expenses: ${formatCurrency(features.monthly_expenses)} | Net Surplus: ${surplusFormatted} | Net Worth: ${formatCurrency(features.net_worth)}.`,
            timestamp: now.toISOString(),
            read: false,
            link: '/dashboard',
            dedupKey: digestDedupKey,
          });
        }
      }

      // If new notifications were generated, prepend and persist
      if (newNotifsToAdd.length > 0) {
        const updated = [...newNotifsToAdd, ...currentNotifs].slice(0, 30); // Keep latest 30
        persistNotifications(updated);
      }

      // Update last state for future transition comparisons
      try {
        localStorage.setItem(
          getLastStateStorageKey(userId),
          JSON.stringify({
            score,
            category,
            spendingRisk,
            lastMonthDigest: currentMonthKey,
          })
        );
      } catch (err) {
        console.warn('Failed to update last state:', err);
      }
    },
    [userId, persistNotifications]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        updatePreferences,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAll,
        evaluateNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
