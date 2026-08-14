'use client';

import React, { useState, useEffect } from 'react'; // Added useEffect
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SOFTWARE_NAME } from '@/lib/constants';
import {
  Home, Eye, CreditCard, Upload, History, Wallet, DollarSign, Store, ShoppingCart,
  User, Users, Phone, LogOut, ChevronDown, ChevronRight, GraduationCap, Award, Layers, Lock, Landmark
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
  children?: NavItem[];
  moduleCode?: string;
  action?: () => void;
}

export function ParentSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { activeModules, logout } = useAuth();

  const isCurrentPath = (href: string) => {
    if (href === '#') return false;
    if (href === pathname) return true;
    if (pathname.startsWith(href + '/')) return true;
    return false;
  };

  const hasAccess = (item: NavItem): boolean => {
    if (item.moduleCode && !activeModules.some(m => m.code === item.moduleCode)) {
      return false;
    }
    if (item.children && item.children.length > 0) {
      return item.children.some(child => hasAccess(child));
    }
    return true;
  };

  // Moved above state so we can determine the active parent on mount
  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard/parent',
      icon: <Home className="h-5 w-5" />,
      current: pathname === '/dashboard/parent',
    },
    {
      name: 'Results',
      href: '#',
      icon: <Award className="h-5 w-5" />,
      moduleCode: 'result',
      children: [
        {
          name: 'Term Result',
          href: '/dashboard/parent/result',
          icon: <Eye className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result'),
        },
        {
          name: 'Cumulative Result',
          href: '/dashboard/parent/result/cumulative',
          icon: <Layers className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result/cumulative'),
        }
      ],
    },
    {
      name: 'Fee Management',
      href: '#',
      icon: <CreditCard className="h-5 w-5" />,
      moduleCode: 'fee',
      children: [
        {
          name: 'Invoices',
          href: '/dashboard/parent/fees',
          icon: <CreditCard className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/fees'),
        },
        {
          name: 'Make Payment',
          href: '/dashboard/parent/fees/checkout',
          icon: <Upload className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/fees/upload'),
        },
        {
          name: 'Payment History',
          href: '/dashboard/parent/fees/history',
          icon: <History className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/fees/history'),
        },
      ],
    },
    {
      name: 'Wallet Funding',
      href: '#',
      icon: <Wallet className="h-5 w-5" />,
      moduleCode: 'finance',
      children: [
        {
          name: 'Fund Wallet',
          href: '/dashboard/parent/wallet/fund',
          icon: <DollarSign className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/wallet/fund'),
        },
        {
          name: 'Funding History',
          href: '/dashboard/parent/wallet/history',
          icon: <History className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/wallet/history'),
        },
      ],
    },
    {
      name: 'Inventory',
      href: '#',
      icon: <Store className="h-5 w-5" />,
      moduleCode: 'inventory',
      children: [
        {
          name: 'Tuckshop Purchases',
          href: '/dashboard/parent/inventory/purchases',
          icon: <ShoppingCart className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/inventory/purchases'),
        },
        // You can easily drop in Cafeteria and Inventory Collection here later!
      ],
    },
    {
      name: 'School Banks',
      href: '/dashboard/parent/banks',
      icon: <Landmark className="h-5 w-5" />,
      current: pathname === '/dashboard/parent/banks' || pathname.startsWith('/dashboard/parent/banks/'),
    },
    {
      name: 'Account',
      href: '#',
      icon: <User className="h-5 w-5" />,
      children: [
        {
          name: 'My Profile',
          href: '/dashboard/parent/profile',
          icon: <User className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/profile'),
        },
        {
          name: 'Change Password',
          href: '/dashboard/parent/change-password',
          icon: <Lock className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/change-password'),
        },
      ],
    },
  ];

  // Helper to find which parent group contains the current active route
  const getActiveParent = () => {
    for (const item of navItems) {
      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          if (isCurrentPath(child.href)) {
            return item.name;
          }
        }
      }
    }
    return null;
  };

  // Initialize with ONLY the active parent open (fixes the hardcoded issue)
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    const active = getActiveParent();
    return active ? [active] : [];
  });

  // Sync open dropdowns dynamically when navigating client-side
  useEffect(() => {
    const active = getActiveParent();
    setExpandedItems(active ? [active] : []);
  }, [pathname]);

  // Accordion behavior: clicking an open item closes it, clicking a closed one opens it (and closes others)
  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => prev.includes(name) ? [] : [name]);
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);

    if (!hasAccess(item)) return null;

    const indent = level === 1 ? 'ml-3' : level === 2 ? 'ml-6' : '';

    if (item.action) {
      return (
        <button
          key={item.name}
          onClick={item.action}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all mb-0.5 text-red-600 hover:bg-red-50`}
        >
          <span className="flex-shrink-0">{item.icon}</span>
          <span className="flex-1 text-left truncate">{item.name}</span>
        </button>
      );
    }

    return (
      <div key={item.name}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.name)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all mb-0.5 ${indent} ${
              isExpanded
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <span className="flex-shrink-0 text-current">{item.icon}</span>
            <span className="flex-1 text-left truncate">{item.name}</span>
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
              : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-40" />
            }
          </button>
        ) : (
          <Link
            href={item.href}
            onClick={onClose}
            className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-xl transition-all mb-0.5 ${indent} ${
              item.current
                ? 'border-l-2 border-indigo-600 bg-indigo-50 text-indigo-700 pl-2.5'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="flex-1 truncate">{item.name}</span>
          </Link>
        )}

        {hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map(child => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-slate-100
          flex flex-col shadow-xl
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:shadow-none md:z-30
        `}
      >
        {/* ── Logo / Branding ── */}
        <div className="flex-shrink-0 px-4 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-indigo-600 shadow-md shadow-indigo-200">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-black text-slate-800 leading-tight truncate">
                PARENT PORTAL
              </p>
              <p className="text-[10px] font-medium text-slate-400 leading-tight truncate">
                {SOFTWARE_NAME}
              </p>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
          {navItems.map(item => renderNavItem(item))}
        </nav>

        {/* ── Footer Logout ── */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-bold text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}