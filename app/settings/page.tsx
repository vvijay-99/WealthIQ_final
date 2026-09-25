'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
import { LoadingState } from '@/components/state-components';
import { useAuth } from '@/lib/auth-context';
import { useNotifications } from '@/lib/notification-context';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';
import {
  User,
  Shield,
  Bell,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Globe,
} from 'lucide-react';

const financialGoals = [
  'Build emergency fund',
  'Become debt-free',
  'Start investing',
  'Save for a house',
  'Plan for retirement',
  'Save for education',
  'Other',
];

const riskTolerances = [
  'Conservative',
  'Moderate',
  'Aggressive',
];

const incomeStabilities = [
  'Very stable',
  'Stable',
  'Variable',
  'Seasonal',
  'Freelance / Contract',
];

const currencies = [
  { code: 'INR', label: 'INR (₹) — Indian Rupee', symbol: '₹' },
  { code: 'USD', label: 'USD ($) — US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR (€) — Euro', symbol: '€' },
  { code: 'GBP', label: 'GBP (£) — British Pound', symbol: '£' },
];

const NOTIFS_STORAGE_KEY = 'wealthiq_notification_prefs';
const CURRENCY_STORAGE_KEY = 'wealthiq_currency_preference';

export default function SettingsPage() {
  const { user, authState, refreshProfile, refreshSession } = useAuth();
  const [loading, setLoading] = useState(true);

  // Profile Form state
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [initialProfileData, setInitialProfileData] = useState({
    full_name: '',
    country: '',
    financial_goal: '',
    risk_tolerance: '',
    income_stability: '',
  });

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    country: '',
    financial_goal: '',
    risk_tolerance: '',
    income_stability: '',
  });

  // Password Form state
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // App & Notification Preferences state
  const { preferences, updatePreferences } = useNotifications();
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [notifications, setNotifications] = useState(preferences);

  // Sync notification toggles with user preferences
  useEffect(() => {
    setNotifications(preferences);
  }, [preferences]);

  // Load Currency preference from localStorage
  useEffect(() => {
    try {
      const savedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (savedCurrency) {
        setCurrency(savedCurrency);
      }
    } catch {
      // LocalStorage access fallback
    }
  }, []);

  // Fetch real profile from Supabase
  const loadProfile = useCallback(
    async (userId: string) => {
      setLoading(true);
      setProfileError(null);
      try {
        const { data, error } = await (supabase.from('profiles') as any)
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          setProfileError(error.message || 'Failed to load profile settings.');
          return;
        }

        const row = data as Database['public']['Tables']['profiles']['Row'] | null;
        const loaded = {
          full_name: row?.full_name ?? user?.user_metadata?.full_name ?? '',
          country: row?.country ?? '',
          financial_goal: row?.financial_goal ?? '',
          risk_tolerance: row?.risk_tolerance ?? '',
          income_stability: row?.income_stability ?? '',
        };
        setInitialProfileData(loaded);
        setProfileForm(loaded);
      } catch (err: unknown) {
        setProfileError(
          err instanceof Error ? err.message : 'An error occurred loading settings.'
        );
      } finally {
        setLoading(false);
      }
    },
    [user?.user_metadata?.full_name]
  );

  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id);
    } else if (authState === 'unauthenticated') {
      setLoading(false);
    }
  }, [user?.id, authState, loadProfile]);

  // Profile Save Handler
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setProfileError('You must be signed in to update settings.');
      return;
    }

    setProfileSaving(true);
    setProfileSuccess(null);
    setProfileError(null);

    const payload = {
      user_id: user.id,
      full_name: profileForm.full_name.trim() || null,
      country: profileForm.country.trim() || null,
      financial_goal: profileForm.financial_goal || null,
      risk_tolerance: profileForm.risk_tolerance || null,
      income_stability: profileForm.income_stability || null,
    };

    try {
      const { data, error } = await (supabase.from('profiles') as any)
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) {
        setProfileError(error.message || 'Failed to save account settings.');
        return;
      }

      // Sync with Supabase Auth metadata
      if (payload.full_name) {
        try {
          await supabase.auth.updateUser({
            data: { full_name: payload.full_name },
          });
        } catch (authErr) {
          console.warn('Could not sync user_metadata in settings:', authErr);
        }
      }

      const saved = data as Database['public']['Tables']['profiles']['Row'] | null;
      const updated = {
        full_name: saved?.full_name ?? '',
        country: saved?.country ?? '',
        financial_goal: saved?.financial_goal ?? '',
        risk_tolerance: saved?.risk_tolerance ?? '',
        income_stability: saved?.income_stability ?? '',
      };
      setInitialProfileData(updated);
      setProfileForm(updated);
      setProfileSuccess('Account settings saved successfully.');

      // Refresh navbar and sidebar state
      await refreshProfile();
      await refreshSession();
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : 'An unexpected error occurred while saving.'
      );
    } finally {
      setProfileSaving(false);
    }
  };

  // Profile Reset Handler
  const handleProfileReset = () => {
    setProfileForm(initialProfileData);
    setProfileSuccess(null);
    setProfileError(null);
  };

  // Password Update Handler
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!passwordForm.newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) {
        setPasswordError(error.message || 'Failed to update password.');
        return;
      }

      setPasswordSuccess('Password updated successfully.');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error ? err.message : 'An unexpected error occurred while updating password.'
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  // App Preferences Save Handler
  const handlePreferencesSave = () => {
    setPrefSaving(true);
    setPrefSuccess(null);
    setPrefError(null);

    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
      updatePreferences(notifications);
      setPrefSuccess('Application preferences saved.');
    } catch (err: unknown) {
      setPrefError('Failed to save preferences.');
    } finally {
      setPrefSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Settings"
        description="Manage your account profile, preferences, and security settings."
      />

      {loading ? (
        <div className="mt-8">
          <LoadingState message="Loading your settings..." />
        </div>
      ) : (
        <div className="mt-6 space-y-6 max-w-4xl">
          {/* 1. Account & Profile Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Account Profile</CardTitle>
              </div>
              <CardDescription>
                Personalize your display identity and financial baseline preferences.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleProfileSubmit}>
              <CardContent className="space-y-4">
                {profileSuccess && (
                  <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-3 text-success">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{profileSuccess}</p>
                  </div>
                )}
                {profileError && (
                  <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3 text-danger">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{profileError}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="settings-email">Email Address</Label>
                    <Input
                      id="settings-email"
                      type="email"
                      value={user?.email ?? ''}
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your registered account email address.
                    </p>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="settings-fullname">Full Name</Label>
                    <Input
                      id="settings-fullname"
                      placeholder="e.g. Aditya Sharma"
                      value={profileForm.full_name}
                      onChange={(e) => {
                        setProfileForm((prev) => ({ ...prev, full_name: e.target.value }));
                        setProfileSuccess(null);
                        setProfileError(null);
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      This name is displayed across the navigation bar, sidebar, and reports.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-country">Country</Label>
                    <Input
                      id="settings-country"
                      placeholder="e.g. India"
                      value={profileForm.country}
                      onChange={(e) => {
                        setProfileForm((prev) => ({ ...prev, country: e.target.value }));
                        setProfileSuccess(null);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-goal">Primary Financial Goal</Label>
                    <Select
                      value={profileForm.financial_goal || undefined}
                      onValueChange={(val) => {
                        setProfileForm((prev) => ({ ...prev, financial_goal: val }));
                        setProfileSuccess(null);
                      }}
                    >
                      <SelectTrigger id="settings-goal">
                        <SelectValue placeholder="Select primary goal" />
                      </SelectTrigger>
                      <SelectContent>
                        {financialGoals.map((goal) => (
                          <SelectItem key={goal} value={goal}>
                            {goal}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-risk">Risk Tolerance</Label>
                    <Select
                      value={profileForm.risk_tolerance || undefined}
                      onValueChange={(val) => {
                        setProfileForm((prev) => ({ ...prev, risk_tolerance: val }));
                        setProfileSuccess(null);
                      }}
                    >
                      <SelectTrigger id="settings-risk">
                        <SelectValue placeholder="Select risk tolerance" />
                      </SelectTrigger>
                      <SelectContent>
                        {riskTolerances.map((tol) => (
                          <SelectItem key={tol} value={tol}>
                            {tol}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="settings-stability">Income Stability</Label>
                    <Select
                      value={profileForm.income_stability || undefined}
                      onValueChange={(val) => {
                        setProfileForm((prev) => ({ ...prev, income_stability: val }));
                        setProfileSuccess(null);
                      }}
                    >
                      <SelectTrigger id="settings-stability">
                        <SelectValue placeholder="Select income stability" />
                      </SelectTrigger>
                      <SelectContent>
                        {incomeStabilities.map((st) => (
                          <SelectItem key={st} value={st}>
                            {st}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleProfileReset}
                  disabled={profileSaving}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
                <Button type="submit" size="sm" disabled={profileSaving}>
                  {profileSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* 2. Security / Password Update */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Security & Password</CardTitle>
              </div>
              <CardDescription>
                Update your account password to maintain security.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSubmit}>
              <CardContent className="space-y-4">
                {passwordSuccess && (
                  <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-3 text-success">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{passwordSuccess}</p>
                  </div>
                )}
                {passwordError && (
                  <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3 text-danger">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{passwordError}</p>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={passwordForm.newPassword}
                      onChange={(e) => {
                        setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }));
                        setPasswordSuccess(null);
                        setPasswordError(null);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => {
                        setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                        setPasswordSuccess(null);
                        setPasswordError(null);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-4">
                <Button type="submit" size="sm" disabled={passwordSaving}>
                  {passwordSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {/* 3. Display & Notification Preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Display & Notification Preferences</CardTitle>
              </div>
              <CardDescription>
                Customize regional currency display and notification channels.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {prefSuccess && (
                <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-3 text-success">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{prefSuccess}</p>
                </div>
              )}
              {prefError && (
                <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-3 text-danger">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{prefError}</p>
                </div>
              )}

              <div className="space-y-2 max-w-sm">
                <Label htmlFor="currency-select">Base Currency</Label>
                <Select
                  value={currency}
                  onValueChange={(val) => {
                    setCurrency(val);
                    setPrefSuccess(null);
                  }}
                >
                  <SelectTrigger id="currency-select">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default currency used across metric displays and charts.
                </p>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>Notification Alerts</span>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Financial Health Score Alerts</p>
                    <p className="text-xs text-muted-foreground">
                      Notify me when health score drops or rises into a new tier.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.scoreAlerts}
                    onCheckedChange={(checked) => {
                      setNotifications((prev) => ({ ...prev, scoreAlerts: checked }));
                      setPrefSuccess(null);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Spending & Debt Risk Warnings</p>
                    <p className="text-xs text-muted-foreground">
                      Receive alerts when expense ratio or debt-to-income exceeds safe thresholds.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.spendingAlerts}
                    onCheckedChange={(checked) => {
                      setNotifications((prev) => ({ ...prev, spendingAlerts: checked }));
                      setPrefSuccess(null);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Monthly Financial Summary</p>
                    <p className="text-xs text-muted-foreground">
                      Monthly overview of surplus, investments, and net worth progress.
                    </p>
                  </div>
                  <Switch
                    checked={notifications.monthlyDigest}
                    onCheckedChange={(checked) => {
                      setNotifications((prev) => ({ ...prev, monthlyDigest: checked }));
                      setPrefSuccess(null);
                    }}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t pt-4">
              <Button
                type="button"
                size="sm"
                onClick={handlePreferencesSave}
                disabled={prefSaving}
              >
                {prefSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Preferences
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
