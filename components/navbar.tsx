'use client';

import { Menu, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NotificationDropdown } from '@/components/notification-dropdown';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface NavbarProps {
  onMenuClick: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      router.replace('/login');
    }
  };

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          className="pl-9 bg-muted/50 border-0"
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-muted">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{displayName}</div>
              <div className="text-xs text-muted-foreground">{displayEmail}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-danger cursor-pointer">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
