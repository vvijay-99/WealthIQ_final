'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  TrendingDown,
  PiggyBank,
  CreditCard,
  LineChart,
  Landmark,
  TrendingUp,
  Lightbulb,
  BarChart3,
  User,
  Settings,
  X,
  Wallet,
} from 'lucide-react';
import { WealthIQLogo } from '@/components/wealthiq-logo';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/income', label: 'Income', icon: Wallet },
  { href: '/expenses', label: 'Expenses', icon: TrendingDown },
  { href: '/savings', label: 'Savings', icon: PiggyBank },
  { href: '/debts', label: 'Debts', icon: CreditCard },
  { href: '/investments', label: 'Investments', icon: LineChart },
  { href: '/fd', label: 'Fixed Deposits', icon: Landmark },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/recommendations', label: 'Recommendations', icon: Lightbulb },
  { href: '/market-insights', label: 'Market Insights', icon: BarChart3 },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const displayName =
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Demo User';
  const displayEmail = user?.email || 'demo@wealthiq.ai';
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DU';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <WealthIQLogo variant="full" size="md" theme="sidebar" href="/dashboard" />
          <button
            onClick={onClose}
            className="text-sidebar-muted hover:text-sidebar-foreground lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Overview
          </div>
          <div className="space-y-1">
            {navItems.slice(0, 1).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
            ))}
          </div>

          <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Financial Data
          </div>
          <div className="space-y-1">
            {navItems.slice(1, 5).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
            ))}
          </div>

          <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            AI Insights
          </div>
          <div className="space-y-1">
            {navItems.slice(5, 9).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
            ))}
          </div>

          <div className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            Account
          </div>
          <div className="space-y-1">
            {navItems.slice(9).map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onClick={onClose} />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-border/50 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-sidebar-muted">{displayEmail}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavLink({
  item,
  pathname,
  onClick,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-white'
          : 'text-sidebar-muted hover:bg-sidebar-border/50 hover:text-sidebar-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  );
}
