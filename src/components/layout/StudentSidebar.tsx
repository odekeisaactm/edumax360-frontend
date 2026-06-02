import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  Home,
  BookOpen,
  Calendar,
  FileText,
  User,
  GraduationCap,
  Award,
  Clock,
  MessageSquare,
  DollarSign,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
  children?: NavItem[];
}

export const StudentSidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['academic']);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const isCurrentPath = (href: string) => {
    if (href === pathname) return true;
    if (href !== '/' && pathname.startsWith(href)) return true;
    return false;
  };

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard/student',
      icon: <Home className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/student'),
    },
    {
      name: 'Academic',
      href: '#',
      icon: <BookOpen className="h-5 w-5" />,
      current: false,
      children: [
        {
          name: 'My Classes',
          href: '/dashboard/student/classes',
          icon: <GraduationCap className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/student/classes'),
        },
        {
          name: 'Subjects',
          href: '/dashboard/student/subjects',
          icon: <BookOpen className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/student/subjects'),
        },
        {
          name: 'Timetable',
          href: '/dashboard/student/timetable',
          icon: <Calendar className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/student/timetable'),
        },
        {
          name: 'Attendance',
          href: '/dashboard/student/attendance',
          icon: <Clock className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/student/attendance'),
        },
      ],
    },
    {
      name: 'Assignments',
      href: '/dashboard/student/assignments',
      icon: <FileText className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/student/assignments'),
    },
    {
      name: 'Results',
      href: '/dashboard/student/results',
      icon: <Award className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/student/results'),
    },
    {
      name: 'Fees',
      href: '/dashboard/student/fees',
      icon: <DollarSign className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/student/fees'),
    },
    {
      name: 'Profile',
      href: '/dashboard/student/profile',
      icon: <User className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/student/profile'),
    },
    {
      name: 'Messages',
      href: '/dashboard/student/messages',
      icon: <MessageSquare className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/student/messages'),
    },
  ];

  const renderNavItem = (item: NavItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);

    return (
      <div key={item.name}>
        <Link
          href={item.href}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
            item.current
              ? 'bg-blue-100 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          } ${level > 0 ? 'ml-6' : ''}`}
          onClick={(e) => {
            if (hasChildren) {
              e.preventDefault();
              toggleExpanded(item.name);
            } else {
              onClose();
            }
          }}
        >
          <span className="flex items-center">
            {item.icon}
            <span className="ml-3">{item.name}</span>
          </span>
          {hasChildren && (
            <span className="ml-auto">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
        </Link>

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children.map((child) => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    } transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:z-auto`}>
      <div className="flex flex-col h-full">
        {/* Logo and close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <img
              className="h-8 w-auto"
              src="/images/logo-placeholder.png"
              alt="School Logo"
            />
            <span className="ml-2 text-lg font-semibold text-gray-900">Student Portal</span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-md text-gray-400 hover:text-gray-500"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            © {new Date().getFullYear()} School Management System
          </div>
        </div>
      </div>
    </div>
  );
};