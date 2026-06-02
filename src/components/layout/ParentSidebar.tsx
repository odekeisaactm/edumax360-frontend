'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
  Users,
  FileText,
  DollarSign,
  Calendar,
  User,
  GraduationCap,
  Award,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Archive,
  Columns,
  TrendingUp,
  Clock,
  BookOpen,
  FileSearch
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
  children?: NavItem[];
}

export function ParentSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Results']);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const isCurrentPath = (href: string) => {
    if (href === pathname) return true;
    if (href !== '#' && pathname.startsWith(href)) return true;
    return false;
  };

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard/parent',
      icon: <Home className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/parent') && pathname === '/dashboard/parent',
    },
    {
      name: 'Results',
      href: '#',
      icon: <Award className="h-5 w-5" />,
      current: false,
      children: [
        {
          name: 'Current Term',
          href: '/dashboard/parent/result',
          icon: <FileText className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result') && pathname === '/dashboard/parent/result',
        },
        {
          name: 'Result Archive',
          href: '/dashboard/parent/result/archive',
          icon: <Archive className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result/archive'),
        },
        {
          name: 'Class Broadsheet',
          href: '/dashboard/parent/result/broadsheet',
          icon: <Columns className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result/broadsheet'),
        },
        {
          name: 'Compare Performance',
          href: '/dashboard/parent/result/compare',
          icon: <TrendingUp className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result/compare'),
        },
        {
          name: 'Exam Scripts',
          href: '/dashboard/parent/result/scripts',
          icon: <FileSearch className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/result/scripts'),
        },
      ],
    },
    {
      name: 'My Children',
      href: '#',
      icon: <Users className="h-5 w-5" />,
      current: false,
      children: [
        {
          name: 'Children List',
          href: '/dashboard/parent/wards',
          icon: <Users className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/wards'),
        },
        {
          name: 'Academic Performance',
          href: '/dashboard/parent/performance',
          icon: <Award className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/performance'),
        },
        {
          name: 'Attendance',
          href: '/dashboard/parent/attendance',
          icon: <Calendar className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/parent/attendance'),
        },
      ],
    },
    {
      name: 'Fees & Payments',
      href: '/dashboard/parent/fees',
      icon: <DollarSign className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/parent/fees'),
    },
    {
      name: 'Reports',
      href: '/dashboard/parent/reports',
      icon: <FileText className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/parent/reports'),
    },
    {
      name: 'Communication',
      href: '/dashboard/parent/messages',
      icon: <MessageSquare className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/parent/messages'),
    },
    {
      name: 'Profile',
      href: '/dashboard/parent/profile',
      icon: <User className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/parent/profile'),
    },
  ];

  const renderNavItem = (item: NavItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);

    return (
      <div key={item.name}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.name)}
            className={`w-full flex items-center px-4 py-2.5 text-sm font-bold rounded-2xl transition-all mb-1 ${
              level > 0 ? 'ml-4' : ''
            } ${isExpanded ? 'bg-slate-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <span className="flex items-center">
              {item.icon}
              <span className="ml-3">{item.name}</span>
            </span>
            <span className="ml-auto">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 opacity-50" />
              ) : (
                <ChevronRight className="h-4 w-4 opacity-50" />
              )}
            </span>
          </button>
        ) : (
          <Link
            href={item.href}
            className={`flex items-center px-4 py-2.5 text-sm font-bold rounded-2xl transition-all mb-1 ${
              item.current
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:bg-slate-50'
            } ${level > 0 ? 'ml-6' : ''}`}
            onClick={() => onClose()}
          >
            <span className="flex items-center">
              {item.icon}
              <span className="ml-3">{item.name}</span>
            </span>
          </Link>
        )}

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child) => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-6 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-black text-slate-900 tracking-tight block leading-none">PARENT</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">PORTAL</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Footer */}
        <div className="p-6 border-t border-slate-50">
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Need help?</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">Contact the school admin for portal support.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
