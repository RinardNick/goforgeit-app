'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ThemeToggle } from '@/app/components/ThemeToggle';

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'AI Agents' },
    { href: '/settings/api-keys', label: 'API Keys' },
    { href: '/settings/billing', label: 'Billing' },
  ];

  return (
    <nav className="sticky top-0 z-50 mb-8 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-12">
            <Link href="/" className="text-2xl font-heading font-bold text-primary tracking-tight">
              FORGE
            </Link>
            <div className="flex space-x-8">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(`${item.href}/`));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200
                      ${
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              data-testid="logout-button"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
