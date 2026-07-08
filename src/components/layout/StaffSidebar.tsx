'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { SOFTWARE_NAME, SOFTWARE_TAGLINE } from '@/lib/constants';
import {
  Home, Users, BookOpen, Calendar, FileText, DollarSign, Settings,
  ChevronDown, ChevronRight, UserCheck, Eye, GraduationCap, ClipboardList,
  CreditCard, PieChart, Bot, Star, Layout, FileSpreadsheet, UserPlus, Activity,
  KeyRound, Clock, ArrowUpCircle, MessageSquare, Crown, Building, ArrowRightLeft,
  TrendingUp, FolderOpen, Tag, Plus, Columns, Layers, RefreshCw, Ban, Banknote,
  HelpCircle, Tags, Database, List, CheckSquare, Video, BarChart, Store,
  BarChart2, Archive, Edit, Send, Info, Smartphone, Cpu, Sliders, SlidersHorizontal,
  ArrowRight, Award, Printer, Shield, Upload, Download, CalendarDays,
  FileSearch, Package, User, Zap, MapPin, Gift, TrendingDown, Wallet,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  current?: boolean;
  children?: NavItem[];
  requiredPermissions?: string[];
  moduleCode?: string;
}

export function StaffSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { hasPermission, user, activeModules, schoolInfo } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  const isCurrentPath = (href: string) => {
    if (href === '#') return false;
    if (href === pathname) return true;
    if (pathname.startsWith(href + '/')) return true;
    return false;
  };

  const hasAccess = (item: NavItem): boolean => {
  if (user?.is_superuser) {
    if (item.moduleCode) return activeModules.some(m => m.code === item.moduleCode);
    return true;
  }

  // Check module first
  if (item.moduleCode && !activeModules.some(m => m.code === item.moduleCode)) return false;

  // If has children, show only if at least one child is accessible
  if (item.children && item.children.length > 0) {
    return item.children.some(child => hasAccess(child));
  }

  // Leaf item — check permission
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    return hasPermission(item.requiredPermissions[0]);
  }

  // No permission required — always show (Dashboard etc)
  return true;
};

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/dashboard/staff',
      icon: <Home className="h-5 w-5" />,
      current: pathname === '/dashboard/staff',
    },
    {
      name: 'Place Order',
      href: '/dashboard/staff/inventory/pos',
      icon: <CreditCard className="h-5 w-5" />,
      current: pathname === '/dashboard/staff/inventory/pos',
      moduleCode: 'inventory',
      requiredPermissions: ['inventory.add_inventorysalemodel'],
    },
    {
      name: 'View Orders',
      href: '/dashboard/staff/inventory/sales',
      icon: <ClipboardList className="h-5 w-5" />,
      current: isCurrentPath('/dashboard/staff/inventory/sales'),
      moduleCode: 'inventory',
      requiredPermissions: ['inventory.add_inventorysalemodel'],
    },
    {
      name: 'Student Management',
      href: '#',
      icon: <Users className="h-5 w-5" />,
      children: [
        {
          name: 'Dashboard',
          href: '/dashboard/staff/students/dashboard',
          icon: <Home className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/students/dashboard'),
          requiredPermissions: ['student_management.view_statistics'],
        },
        {
          name: 'All Students',
          href: '/dashboard/staff/students',
          icon: <Users className="h-4 w-4" />,
          current: pathname === '/dashboard/staff/students',
          requiredPermissions: ['student_management.view_studentmodel'],
        },
        {
          name: 'Register Student',
          href: '/dashboard/staff/students/register',
          icon: <UserPlus className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/students/register'),
          requiredPermissions: ['student_management.add_studentmodel'],
        },
        {
          name: 'Bulk Upload',
          href: '/dashboard/staff/students/bulk-upload',
          icon: <Upload className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/students/bulk-upload'),
          requiredPermissions: ['student_management.add_bulkstudentuploadmodel'],
        },
        {
          name: 'Alumni',
          href: '/dashboard/staff/students/alumni',
          icon: <GraduationCap className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/students/alumni'),
          requiredPermissions: ['student_management.view_studentmodel'],
        },
        {
          name: 'Student Guardians',
          href: '/dashboard/staff/students/guardians',
          icon: <Users className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/students/guardians'),
          requiredPermissions: ['student_management.view_parentmodel'],
        },
        {
          name: 'Login Credentials',
          href: '/dashboard/staff/students/credentials',
          icon: <KeyRound className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/students/credentials'),
          requiredPermissions: ['student_management.view_studentprofilemodel'],
        },
        {
          name: 'Configuration',
          href: '#',
          icon: <Settings className="h-4 w-4" />,
          children: [
            {
              name: 'Custom Fields',
              href: '/dashboard/staff/students/custom-fields',
              icon: <Tags className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/students/custom-fields'),
              requiredPermissions: ['student_management.view_studentsettingmodel'],
            },
            {
              name: 'Utilities',
              href: '/dashboard/staff/students/utilities',
              icon: <Database className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/students/utilities'),
              requiredPermissions: ['student_management.view_studentsettingmodel'],
            },
            {
              name: 'Settings',
              href: '/dashboard/staff/students/settings',
              icon: <Settings className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/students/settings'),
              requiredPermissions: ['student_management.view_studentsettingmodel'],
            },
          ],
        },
      ],
    },
    {
      name: 'Academic',
      href: '#',
      icon: <BookOpen className="h-5 w-5" />,
      children: [
        {
          name: 'Class Sections',
          href: '/dashboard/staff/academic/class-sections',
          icon: <Layers className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/class-sections'),
          requiredPermissions: ['academic.view_classsectionmodel'],
        },
        {
          name: 'Classes',
          href: '/dashboard/staff/academic/classes',
          icon: <GraduationCap className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/classes'),
          requiredPermissions: ['academic.view_classmodel'],
        },
        {
          name: 'Subjects',
          href: '/dashboard/staff/academic/subjects',
          icon: <BookOpen className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/subjects'),
          requiredPermissions: ['academic.view_subjectmodel'],
        },
        {
          name: 'Time Table',
          href: '/dashboard/staff/academic/timetable',
          icon: <CalendarDays className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/timetable'),
          requiredPermissions: ['academic.view_subjectgroupmodel'],
        },
        {
          name: 'Leadership Roles',
          href: '/dashboard/staff/academic/leadership-roles',
          icon: <Crown className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/leadership-roles'),
          requiredPermissions: ['academic.view_leadershiprolemodel'],
        },
        {
          name: 'Promotion',
          href: '/dashboard/staff/academic/promotion-mappings',
          icon: <TrendingUp className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/promotion-mappings'),
          requiredPermissions: ['academic.view_promotionmappingmodel'],
        },
        {
          name: 'Subject Groups',
          href: '/dashboard/staff/academic/subject-groups',
          icon: <Layers className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/subject-groups'),
          requiredPermissions: ['academic.view_subjectgroupmodel'],
        },
        {
          name: 'Academic Settings',
          href: '/dashboard/staff/academic/settings',
          icon: <Settings className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/academic/settings'),
          requiredPermissions: ['academic.view_academicsettingmodel'],
        },
      ],
    },
    {
      name: 'Learning Management',
      href: '#',
      icon: <BookOpen className="h-5 w-5" />,
      moduleCode: 'learning',
      children: [
        {
          name: 'Learning Notes',
          href: '/dashboard/staff/learning/notes',
          icon: <FileText className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/learning/notes'),
          requiredPermissions: ['learning_resources.view_learningnotemodel'],
        },
        {
          name: 'AI Settings',
          href: '/dashboard/staff/learning/ai-settings',
          icon: <Bot className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/learning/ai-settings'),
          requiredPermissions: ['learning_resources.view_learningnotemodel'],
        },
      ],
    },
    {
      name: 'Assessment',
      href: '#',
      icon: <ClipboardList className="h-5 w-5" />,
      moduleCode: 'assessment',
      children: [
        {
          name: 'All Exams',
          href: '/dashboard/staff/assessment/exams',
          icon: <FileText className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/exams'),
          requiredPermissions: ['assessment_center.view_exammodel'],
        },
        {
          name: 'Proctoring',
          href: '/dashboard/staff/assessment/proctoring',
          icon: <Shield className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/proctoring'),
          requiredPermissions: ['assessment_center.view_exammodel'],
        },
        {
          name: 'Marking',
          href: '/dashboard/staff/assessment/marking',
          icon: <CheckSquare className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/marking'),
          requiredPermissions: ['assessment_center.change_studentanswermodel'],
        },
        {
          name: 'Analytics',
          href: '/dashboard/staff/assessment/analytics',
          icon: <BarChart className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/analytics'),
          requiredPermissions: ['assessment_center.view_exammodel'],
        },
        {
          name: 'Result Transfer',
          href: '/dashboard/staff/assessment/result-transfer',
          icon: <RefreshCw className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/result-transfer'),
          requiredPermissions: ['assessment_center.change_examresulttransferconfigmodel'],
        },
        {
          name: 'Question Banks',
          href: '/dashboard/staff/assessment/question-banks',
          icon: <Database className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/question-banks'),
          requiredPermissions: ['assessment_center.view_questionbankmodel'],
        },
        {
          name: 'Topics',
          href: '/dashboard/staff/assessment/topics',
          icon: <List className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/topics'),
          requiredPermissions: ['assessment_center.view_topicmodel'],
        },
        {
          name: 'Examination Halls',
          href: '/dashboard/staff/assessment/examination-halls',
          icon: <Building className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/examination-halls'),
          requiredPermissions: ['assessment_center.view_examinationhallmodel'],
        },
        {
          name: 'Devices',
          href: '/dashboard/staff/assessment/devices',
          icon: <Smartphone className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/devices'),
          requiredPermissions: ['assessment_center.view_devicemodel'],
        },
        {
          name: 'AI Settings',
          href: '/dashboard/staff/assessment/ai-settings',
          icon: <Bot className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/ai-settings'),
          requiredPermissions: ['assessment_center.view_exammodel'],
        },
        {
          name: 'AI Services',
          href: '/dashboard/staff/assessment/ai-services',
          icon: <Cpu className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/assessment/ai-services'),
          requiredPermissions: ['assessment_center.view_exammodel'],
        },
      ],
    },
    {
      name: 'Results',
      href: '#',
      icon: <Award className="h-5 w-5" />,
      moduleCode: 'result',
      children: [
        {
          name: 'Enter Results',
          href: '/dashboard/staff/result/upload',
          icon: <Edit className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/upload'),
          requiredPermissions: ['result.change_resultmodel'],
        },
        {
          name: 'View Results',
          href: '/dashboard/staff/result/view',
          icon: <Eye className="h-5 w-5" />,
          current: isCurrentPath('/dashboard/staff/result/view'),
          requiredPermissions: ['result.view_resultmodel'],
        },
        {
          name: 'Result Comments',
          href: '/dashboard/staff/result/comments/select',
          icon: <MessageSquare className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/comments/select'),
          requiredPermissions: ['result.change_resultmodel'],
        },
        {
          name: 'Uploaded Results',
          href: '/dashboard/staff/result/tracking',
          icon: <TrendingUp className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/tracking'),
          requiredPermissions: ['result.view_resultmodel'],
        },
        {
          name: 'Publish Results',
          href: '/dashboard/staff/result/publish',
          icon: <Send className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/publish'),
          requiredPermissions: ['result.view_resultmodel'],
        },
        {
          name: 'Print Results',
          href: '/dashboard/staff/result/print',
          icon: <Printer className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/print'),
          requiredPermissions: ['result.view_resultmodel'],
        },
        {
          name: 'Analytics',
          href: '/dashboard/staff/result/analytics',
          icon: <BarChart2 className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/analytics'),
          requiredPermissions: ['result.view_resultstatisticsmodel'],
        },
        {
          name: 'Archive',
          href: '/dashboard/staff/result/archive',
          icon: <Archive className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/result/archive'),
          requiredPermissions: ['result.view_resultmodel'],
        },

        {
          name: 'Configuration',
          href: '#',
          icon: <Settings className="h-4 w-4" />,
          children: [
            {
              name: 'Groups',
              href: '/dashboard/staff/result/groups',
              icon: <Layers className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/groups'),
              requiredPermissions: ['result.view_result_configuration'],
            },
            {
              name: 'Field Sets',
              href: '/dashboard/staff/result/field-sets',
              icon: <List className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/field-sets'),
              requiredPermissions: ['result.view_result_configuration'],
            },
            {
              name: 'Grade Sets',
              href: '/dashboard/staff/result/grade-sets',
              icon: <Star className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/grade-sets'),
              requiredPermissions: ['result.view_result_configuration'],
            },
            {
              name: 'Comments',
              href: '/dashboard/staff/result/comment-templates',
              icon: <MessageSquare className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/comment-templates'),
              requiredPermissions: ['result.view_resultmodel'],
            },
            {
              name: 'Templates',
              href: '/dashboard/staff/result/templates',
              icon: <Layout className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/templates'),
              requiredPermissions: ['result.view_result_configuration'],
            },
            {
              name: 'Settings',
              href: '/dashboard/staff/result/settings',
              icon: <Settings className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/settings'),
              requiredPermissions: ['result.view_resultsettingsmodel'],
            },
            {
              name: 'Behavior',
              href: '/dashboard/staff/result/behavior',
              icon: <Shield className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/behavior'),
              requiredPermissions: ['result.view_result_configuration'],
            },

            {
              name: 'Text Categories',
              href: '/dashboard/staff/result/text-categories',
              icon: <Plus className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/result/text-categories'),
              requiredPermissions: ['result.view_result_configuration'],
            },
          ],
        },
      ],
    },
    {
      name: 'Fee Management',
      href: '#',
      icon: <DollarSign className="h-5 w-5" />,
      moduleCode: 'fee',
      children: [
        {
          name: 'Fee Dashboard',
          href: '/dashboard/staff/fee/dashboard',
          icon: <PieChart className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/fee/dashboard'),
          requiredPermissions: ['fee_management.manage_fees'],
        },
        // ==================== BILLING & INVOICES ====================
        {
          name: 'Billing & Invoices',
          href: '#',
          icon: <FileText className="h-4 w-4" />,
          children: [
            {
              name: 'Student Invoices',
              href: '/dashboard/staff/fee/invoices',
              icon: <FileText className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/invoices'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Family Invoices',
              href: '/dashboard/staff/fee/family-invoices',
              icon: <Users className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/family-invoices'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Bulk Billing Jobs',
              href: '/dashboard/staff/fee/generation-jobs',
              icon: <Layers className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/generation-jobs'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Correction Batches',
              href: '/dashboard/staff/fee/correction-batches',
              icon: <RefreshCw className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/correction-batches'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
          ],
        },
        // ==================== COLLECTIONS & DEBTS ====================
        {
          name: 'Collections & Debts',
          href: '#',
          icon: <CreditCard className="h-4 w-4" />,
          children: [
            {
              name: 'Student Payments',
              href: '/dashboard/staff/fee/payments',
              icon: <CreditCard className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/payments'),
              requiredPermissions: ['fee_management.confirm_payment'],
            },
            {
              name: 'Family Payments',
              href: '/dashboard/staff/fee/family-payments',
              icon: <Users className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/family-payments'),
              requiredPermissions: ['fee_management.confirm_payment'],
            },
            {
              name: 'Ancillary Debts (Fines)',
              href: '/dashboard/staff/fee/other-payments',
              icon: <TrendingDown className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/other-payments'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Debt Clearances',
              href: '/dashboard/staff/fee/other-payment-clearances',
              icon: <CheckSquare className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/other-payment-clearances'),
              requiredPermissions: ['fee_management.confirm_payment'],
            },
            {
              name: 'Fee Waivers',
              href: '/dashboard/staff/fee/waivers',
              icon: <Shield className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/waivers'),
              requiredPermissions: ['fee_management.approve_fee_waiver'],
            },
          ],
        },
        // ==================== PRICING & CONCESSIONS ====================
        {
          name: 'Pricing & Concessions',
          href: '#',
          icon: <Tag className="h-4 w-4" />,
          children: [
            {
              name: 'Fee Structures',
              href: '/dashboard/staff/fee/fee-structures',
              icon: <Layers className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/fee-structures'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Fee Items List',
              href: '/dashboard/staff/fee/fees',
              icon: <List className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/fees'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Fee Groups',
              href: '/dashboard/staff/fee/groups',
              icon: <FolderOpen className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/groups'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Master Discounts',
              href: '/dashboard/staff/fee/discounts',
              icon: <Tag className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/discounts'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Concession Tiers',
              href: '/dashboard/staff/fee/discount-tiers',
              icon: <TrendingUp className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/discount-tiers'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
            {
              name: 'Discount Enrollments',
              href: '/dashboard/staff/fee/discount-enrollments',
              icon: <UserCheck className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/discount-enrollments'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
          ],
        },
        // ==================== CONFIGURATION ====================
        {
          name: 'Configuration',
          href: '#',
          icon: <Settings className="h-4 w-4" />,
          children: [
            {
              name: 'Fee Settings',
              href: '/dashboard/staff/fee/settings',
              icon: <Settings className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/fee/settings'),
              requiredPermissions: ['fee_management.manage_fees'],
            },
          ],
        },
      ],
    },

    {
      name: 'Finance',
      href: '#',
      icon: <DollarSign className="h-5 w-5" />,
      moduleCode: 'finance',
      children: [
        // ==================== DASHBOARD ====================
        {
          name: 'Finance Dashboard',
          href: '/dashboard/staff/finance/dashboard',
          icon: <PieChart className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/finance/dashboard'),
          requiredPermissions: ['finance.view_expensemodel'],
        },

        // ==================== WALLET ACTIVITIES ====================
        {
          name: 'Wallet Activities',
          href: '#',
          icon: <CreditCard className="h-5 w-5" />,
          children: [
            {
              name: 'Deposit',
              href: '/dashboard/staff/finance/deposit',
              icon: <UserPlus className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/deposit'),
              requiredPermissions: ['finance.add_studentfundingmodel'],
            },
            {
              name: 'Deposit History',
              href: '/dashboard/staff/finance/deposits',
              icon: <FileText className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/deposits'),
              requiredPermissions: [
                'finance.view_studentfundingmodel',
                'finance.view_stafffundingmodel',
              ],
            },
            {
              name: 'Wallet Transfer',
              href: '/dashboard/staff/finance/wallet-transfer',
              icon: <ArrowRightLeft className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/wallet-transfer'),
              requiredPermissions: ['finance.add_wallettransfermodel'],
            },
            {
              name: 'Transfers History',
              href: '/dashboard/staff/finance/wallet-transfers',
              icon: <FileText className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/wallet-transfers'),
              requiredPermissions: ['finance.view_wallettransfermodel'],
            },
            {
              name: 'My Funding History',
              href: '/dashboard/staff/finance/my-funding',
              icon: <User className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/my-funding'),
              requiredPermissions: [],
            },
          ],
        },

        // ==================== INCOME & EXPENSES ====================
        {
          name: 'Income & Expenses',
          href: '#',
          icon: <BarChart2 className="h-5 w-5" />,
          children: [
            {
              name: 'Income Records',
              href: '/dashboard/staff/finance/incomes',
              icon: <TrendingUp className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/incomes'),
              requiredPermissions: ['finance.view_incomemodel'],
            },
            {
              name: 'Add Income',
              href: '/dashboard/staff/finance/incomes/create',
              icon: <Plus className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/incomes/create'),
              requiredPermissions: ['finance.add_incomemodel'],
            },
            {
              name: 'Income Categories',
              href: '/dashboard/staff/finance/incomes/categories',
              icon: <Tag className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/incomes/categories'),
              requiredPermissions: ['finance.view_incomemodel'],
            },
            {
              name: 'Expense Records',
              href: '/dashboard/staff/finance/expenses',
              icon: <TrendingDown className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/expenses'),
              requiredPermissions: ['finance.view_expensemodel'],
            },
            {
              name: 'Add Expense',
              href: '/dashboard/staff/finance/expenses/create',
              icon: <Plus className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/expenses/create'),
              requiredPermissions: ['finance.add_expensemodel'],
            },
            {
              name: 'Expense Categories',
              href: '/dashboard/staff/finance/expenses/categories',
              icon: <Tag className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/expenses/categories'),
              requiredPermissions: ['finance.view_expensemodel'],
            },
          ],
        },

        // ==================== PROCUREMENT ====================
        {
          name: 'Procurement',
          href: '#',
          icon: <Package className="h-5 w-5" />,
          children: [
            {
              name: 'Supplier Payments',
              href: '/dashboard/staff/finance/supplier-payments',
              icon: <CreditCard className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/supplier-payments'),
              requiredPermissions: ['finance.view_supplierpaymentmodel'],
            },
            {
              name: 'Record Supplier Payment',
              href: '/dashboard/staff/finance/supplier-payments/create',
              icon: <Plus className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/supplier-payments/create'),
              requiredPermissions: ['finance.add_supplierpaymentmodel'],
            },
            {
              name: 'Advance Payments',
              href: '/dashboard/staff/finance/advance-payments',
              icon: <ArrowUpCircle className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/advance-payments'),
              requiredPermissions: ['finance.view_purchaseadvancepaymentmodel'],
            },
            {
              name: 'Record Advance Payment',
              href: '/dashboard/staff/finance/advance-payments/create',
              icon: <Plus className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/advance-payments/create'),
              requiredPermissions: ['finance.add_purchaseadvancepaymentmodel'],
            },
            {
              name: 'Advance Settlements',
              href: '/dashboard/staff/finance/advance-settlements',
              icon: <FileText className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/advance-settlements'),
              requiredPermissions: ['finance.view_advancesettlementmodel'],
            },
          ],
        },

        // ==================== LEDGER ====================
        {
          name: 'Ledger',
          href: '#',
          icon: <BookOpen className="h-5 w-5" />,
          children: [
            {
              name: 'Bank Transactions',
              href: '/dashboard/staff/finance/bank-transactions',
              icon: <Banknote className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/bank-transactions'),
              requiredPermissions: ['finance.view_banktransactionmodel'],
            },
            {
              name: 'Student Wallet Ledger',
              href: '/dashboard/staff/finance/wallet-transactions',
              icon: <Wallet className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/wallet-transactions'),
              requiredPermissions: ['finance.view_wallettransactionmodel'],
            },
            {
              name: 'Staff Wallet Ledger',
              href: '/dashboard/staff/finance/staff-wallet-transactions',
              icon: <Wallet className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/staff-wallet-transactions'),
              requiredPermissions: ['finance.view_staffwallettransactionmodel'],
            },
            {
              name: 'Online Transactions',
              href: '/dashboard/staff/finance/online-payments',
              icon: <Activity className="h-5 w-5" />,
              current: isCurrentPath('/dashboard/staff/finance/online-payments'),
              requiredPermissions: ['finance.view_onlinepaymenttransactionmodel'],
            },
          ],
        },

        // ==================== REPORTS ====================
        {
          name: 'Reports',
          href: '#',
          icon: <FileSpreadsheet className="h-5 w-5" />,
          children: [
            {
              name: 'Income Report',
              href: '/dashboard/staff/finance/income-report',
              icon: <FileSpreadsheet className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/income-report'),
              requiredPermissions: ['finance.view_incomemodel'],
            },
            {
              name: 'Expense Report',
              href: '/dashboard/staff/finance/expense-report',
              icon: <FileSpreadsheet className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/expense-report'),
              requiredPermissions: ['finance.view_expensemodel'],
            },
            {
              name: 'Funding Report',
              href: '/dashboard/staff/finance/funding-report',
              icon: <FileSpreadsheet className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/funding-report'),
              requiredPermissions: [
                'finance.view_studentfundingmodel',
                'finance.view_stafffundingmodel',
              ],
            },
            {
              name: 'Finance Report',
              href: '/dashboard/staff/finance/finance-report',
              icon: <FileSpreadsheet className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/finance-report'),
              requiredPermissions: ['finance.view_expensemodel'],
            },
          ],
        },

        // ==================== CONFIGURATION ====================
        {
          name: 'Configuration',
          href: '#',
          icon: <Settings className="h-5 w-5" />,
          children: [
            {
              name: 'Bank Accounts',
              href: '/dashboard/staff/finance/bank-accounts',
              icon: <Building className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/bank-accounts'),
              requiredPermissions: ['finance.view_schoolbankdetailmodel'],
            },
            {
              name: 'Payment Gateways',
              href: '/dashboard/staff/finance/gateways',
              icon: <Shield className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/gateways'),
              requiredPermissions: ['finance.view_paymentgatewayconfigmodel'],
            },
            {
              name: 'Finance Settings',
              href: '/dashboard/staff/finance/settings',
              icon: <Sliders className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/finance/settings'),
              requiredPermissions: ['finance.change_financesettingmodel'],
            },
          ],
        },
      ],
    },
    {
      "name": "Salary Management",
      "href": "#",
      "icon": <DollarSign className="h-5 w-5" />,
      "moduleCode": "salary_management",
      "children": [
        {
          "name": "Dashboard",
          "href": "/dashboard/staff/salary/dashboard",
          "icon": <Layout className="h-4 w-4" />,
          "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
        },
        {
          "name": "Payroll",
          "href": "#",
          "icon": <FileText className="h-4 w-4" />,
          "children": [
            {
              "name": "All Payroll",
              "href": "/dashboard/staff/salary/payroll",
              "icon": <List className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.view_salaryrecordmodel"]
            },
            {
              "name": "Bulk Payslips",
              "href": "/dashboard/staff/salary/bulk-payslips",
              "icon": <Layers className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
            },
            {
              "name": "Annual Payslips",
              "href": "/dashboard/staff/salary/annual-payslips",
              "icon": <Calendar className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.view_salaryrecordmodel"]
            }
          ]
        },
        {
          "name": "Salary Structure",
          "href": "/dashboard/staff/salary/structure",
          "icon": <Building className="h-4 w-4" />,
          "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
        },
        {
          "name": "Salary Settings",
          "href": "/dashboard/staff/salary/settings",
          "icon": <Settings className="h-4 w-4" />,
          "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
        },
        {
          "name": "Bonuses",
          "href": "#",
          "icon": <Award className="h-4 w-4" />,
          "children": [
            {
              "name": "Special Bonuses",
              "href": "/dashboard/staff/salary/bonuses",
              "icon": <Star className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
            },
            {
              "name": "Bonus Categories",
              "href": "/dashboard/staff/salary/bonus-categories",
              "icon": <Tags className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
            },
            {
              "name": "My Special Bonus",
              "href": "/dashboard/staff/salary/bonuses/my-bonus",
              "icon": <Gift className="h-4 w-4" />,
              "requiredPermissions": []
            }
          ]
        },
        {
          "name": "Reports & Export",
          "href": "#",
          "icon": <BarChart2 className="h-4 w-4" />,
          "children": [
            {
              "name": "Salary Report",
              "href": "/dashboard/staff/salary/report",
              "icon": <FileSpreadsheet className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
            },
            {
              "name": "Salary Excel Export",
              "href": "/dashboard/staff/salary/excel-export",
              "icon": <Download className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.add_salaryrecordmodel"]
            }
          ]
        },
        {
          "name": "Loans & Advances",
          "href": "#",
          "icon": <CreditCard className="h-4 w-4" />,
          "children": [
            {
              "name": "Salary Advance",
              "href": "/dashboard/staff/salary/advances",
              "icon": <ArrowUpCircle className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.view_salaryrecordmodel"]
            },
            {
              "name": "Staff Loans",
              "href": "/dashboard/staff/salary/loans",
              "icon": <Users className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.view_salaryrecordmodel"]
            },
            {
              "name": "Staff Loan Debtors",
              "href": "/dashboard/staff/salary/loan-debtors",
              "icon": <UserCheck className="h-4 w-4" />,
              "requiredPermissions": ["salary_management.view_salaryrecordmodel"]
            }
          ]
        },

        {
          "name": "My Payslip",
          "href": "/dashboard/staff/salary/my-payslip",
          "icon": <CalendarDays className="h-4 w-4" />,
          "requiredPermissions": []
        }
      ]
    },
    {
      name: 'Inventory',
      href: '#',
      icon: <Package className="h-5 w-5" />,
      moduleCode: 'inventory',
      children: [
        {
          name: 'Inventory Report',
          href: '/dashboard/staff/inventory/inventory-report',
          icon: <FileText className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/inventory-report'),
          requiredPermissions: ['inventory.view_inventory_report'],
        },
        {
          name: 'Items',
          href: '/dashboard/staff/inventory/items',
          icon: <Package className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/items'),
          requiredPermissions: ['inventory.view_inventoryitemmodel'],
        },
        {
          name: 'Stock In',
          href: '/dashboard/staff/inventory/stock-in/new',
          icon: <ArrowUpCircle className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/stock-in/new'),
          requiredPermissions: ['inventory.add_inventorystockinmodel'],
        },
        {
          name: 'Stock Transfers',
          href: '/dashboard/staff/inventory/transfers',
          icon: <RefreshCw className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/transfers'),
          requiredPermissions: ['inventory.add_inventorystockinmodel'],
        },
        {
          name: 'View Stock In',
          href: '/dashboard/staff/inventory/stock-in',
          icon: <Eye className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/stock-in'),
          requiredPermissions: ['inventory.view_inventorystockinmodel'],
        },
        {
          name: 'View Stock Outs',
          href: '/dashboard/staff/inventory/stock-out',
          icon: <Eye className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/stock-out'),
          requiredPermissions: ['inventory.view_inventorystockinmodel'],
        },
        {
          name: 'Suppliers',
          href: '/dashboard/staff/inventory/suppliers',
          icon: <Building className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/inventory/suppliers'),
          requiredPermissions: ['inventory.view_inventoryitemmodel'],
        },
        {
          name: 'Configuration',
          href: '#',
          icon: <Settings className="h-4 w-4" />,
          children: [
            {
              name: 'Categories',
              href: '/dashboard/staff/inventory/categories',
              icon: <FolderOpen className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/inventory/categories'),
              requiredPermissions: ['inventory.view_inventoryitemmodel'],
            },
            {
              name: 'Locations',
              href: '/dashboard/staff/inventory/locations',
              icon: <MapPin className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/inventory/locations'),
              requiredPermissions: ['inventory.view_inventoryitemmodel'],
            },
            {
              name: 'POS Settings',
              href: '/dashboard/staff/inventory/settings',
              icon: <SlidersHorizontal className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/inventory/settings'),
              requiredPermissions: ['inventory.add_inventorysettingmodel'],
            },
            {
              name: 'Shop Access',
              href: '/dashboard/staff/inventory/shop-access',
              icon: <Store className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/inventory/shop-access'),
              requiredPermissions: ['inventory.add_inventorysettingmodel'],
            },
            {
              name: 'Banned Debt Users',
              href: '/dashboard/staff/inventory/debt-bans',
              icon: <Ban className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/inventory/debt-bans'),
              requiredPermissions: ['inventory.add_inventorysettingmodel'],
            },
          ],
        },
      ],
    },
    {
      name: 'HR Management',
      href: '#',
      icon: <Users className="h-5 w-5" />,
      children: [
        {
          name: 'All Staff',
          href: '/dashboard/staff/staff',
          icon: <Users className="h-4 w-4" />,
          current: pathname === '/dashboard/staff/staff',
          requiredPermissions: ['human_resource.view_staffmodel'],
        },
        {
          name: 'Register Staff',
          href: '/dashboard/staff/staff/create',
          icon: <UserCheck className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/staff/create'),
          requiredPermissions: ['human_resource.add_staffmodel'],
        },
        {
          name: 'Departments',
          href: '/dashboard/staff/departments',
          icon: <Building className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/departments'),
          requiredPermissions: ['human_resource.view_departmentmodel'],
        },
        {
          name: 'Positions',
          href: '/dashboard/staff/positions',
          icon: <Award className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/positions'),
          requiredPermissions: ['human_resource.view_positionmodel'],
        },
        {
          name: 'Permission Groups',
          href: '/dashboard/staff/groups',
          icon: <KeyRound className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/groups'),
          requiredPermissions: ['human_resource.view_positionmodel'],
        },
        {
          name: 'HR Settings',
          href: '/dashboard/staff/hr-settings',
          icon: <Settings className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/staff/hr-settings'),
          requiredPermissions: ['human_resource.view_hrsettingmodel'],
        },
      ],
    },
    {
      // ── System Configuration — now includes Academic Calendar as submenu ──
      name: 'System Configuration',
      href: '#',
      icon: <Settings className="h-5 w-5" />,
      children: [
        {
          name: 'School Info',
          href: '/dashboard/setup/school-info',
          icon: <Info className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/setup/school-info'),
          requiredPermissions: ['school_configuration.view_schoolinfomodel'],
        },
        {
          name: 'School Settings',
          href: '/dashboard/setup/school-settings',
          icon: <Settings className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/setup/school-settings'),
          requiredPermissions: ['school_configuration.view_schoolsettingsmodel'],
        },
        {
          name: 'AI Configs',
          href: '/dashboard/setup/ai-configs',
          icon: <Bot className="h-4 w-4" />,
          current: isCurrentPath('/dashboard/setup/ai-configs'),
          requiredPermissions: ['school_configuration.view_schoolaiconfigmodel'],
        },
        {
          // Academic Calendar moved here as a nested submenu
          name: 'Academic Calendar',
          href: '#',
          icon: <Calendar className="h-4 w-4" />,
          children: [
            {
              name: 'Sessions',
              href: '/dashboard/staff/academic-calendar/sessions',
              icon: <Calendar className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/academic-calendar/sessions'),
              requiredPermissions: ['school_configuration.view_sessionmodel'],
            },
            {
              name: 'Term / Periods',
              href: '/dashboard/staff/academic-calendar/session-periods',
              icon: <Clock className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/academic-calendar/session-periods'),
              requiredPermissions: ['school_configuration.view_academicsessionperiodmodel'],
            },
            {
              name: 'Period Types',
              href: '/dashboard/staff/academic-calendar/period-types',
              icon: <Tag className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/academic-calendar/period-types'),
              requiredPermissions: ['school_configuration.view_academicperiodtypemodel'],
            },
            {
              name: 'Sections',
              href: '/dashboard/staff/academic-calendar/sections',
              icon: <Layers className="h-4 w-4" />,
              current: isCurrentPath('/dashboard/staff/academic-calendar/sections'),
              requiredPermissions: ['school_configuration.view_schoolsectionmodel'],
            },
          ],
        },
      ],
    },
  ];

  // ── Recursive nav item renderer ───────────────────────────────────────────
  const renderNavItem = (item: NavItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.name);

    if (!hasAccess(item)) return null;

    const indent = level === 1 ? 'ml-3' : level === 2 ? 'ml-6' : '';
    const iconSize = level === 0 ? 'h-5 w-5' : 'h-4 w-4';

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

  // ── Logo section ──────────────────────────────────────────────────────────
  // School logo if available, else gradient icon with software name initial
  const logoSrc = schoolInfo?.logo || null;
  const schoolName = schoolInfo?.name || null;

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
            {/* Software logo — fixed, not school logo */}
            <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-indigo-600 shadow-md shadow-indigo-200">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>

            <div className="min-w-0">
              {/* Software name */}
              <p className="text-sm font-black text-slate-800 leading-tight truncate">
                {SOFTWARE_NAME}
              </p>
              {/* Software tagline — constant, never changes */}
              <p className="text-[10px] font-medium text-slate-400 leading-tight truncate">
                {SOFTWARE_TAGLINE}
              </p>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-hide">
          {navItems.map(item => renderNavItem(item))}
        </nav>


      </aside>
    </>
  );
}