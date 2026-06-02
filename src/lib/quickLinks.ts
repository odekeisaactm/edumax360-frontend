import {
  UserPlus,
  CalendarPlus,
  CheckSquare,
  PenTool,
  FileText,
  Shield,
  CreditCard,
  LucideIcon
} from 'lucide-react';

export interface QuickLinkItem {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconColor: string;
  moduleCode: string;       // Must match an active module
  requiredPermission?: string; // Optional: specific granular permission
}

export const MASTER_QUICK_LINKS: QuickLinkItem[] = [
  // --- STUDENT MANAGEMENT ---
  {
    id: 'register_student',
    name: 'Register Student',
    description: 'Add a new student to the system',
    href: '/dashboard/staff/students/register',
    icon: UserPlus,
    iconColor: 'text-blue-600',
    moduleCode: 'student_management',
    requiredPermission: 'student_management.add_studentmodel',
  },

  // --- HUMAN RESOURCE ---
  {
    id: 'apply_leave',
    name: 'Apply for Leave',
    description: 'Submit a new leave request',
    href: '/dashboard/staff/staff/',
    icon: CalendarPlus,
    iconColor: 'text-purple-600',
    moduleCode: 'human_resource',
  },


  // --- LEARNING RESOURCES ---
  {
    id: 'create_lesson_note',
    name: 'Create Lesson Note',
    description: 'Draft or AI-generate a new note',
    href: '/dashboard/staff/learning/notes/create',
    icon: PenTool,
    iconColor: 'text-indigo-600',
    moduleCode: 'learning',
    requiredPermission: 'learning_resources.add_lessonnotemodel',
  },
  {
    id: 'view_lesson_notes',
    name: 'Lesson Notes Hub',
    description: 'Manage all curriculum notes',
    href: '/dashboard/staff/learning/notes',
    icon: FileText,
    iconColor: 'text-sky-600',
    moduleCode: 'learning',
    requiredPermission: 'learning_resources.view_lessonnotemodel',
  },

  // --- ASSESSMENT CENTER ---
  {
    id: 'proctoring',
    name: 'Exam Proctoring',
    description: 'Monitor ongoing live exams',
    href: '/dashboard/staff/assessment/proctoring',
    icon: Shield,
    iconColor: 'text-red-600',
    moduleCode: 'assessment',
    requiredPermission: 'assessment_center.view_exammodel',
  },

  // --- FEE MANAGEMENT ---
  {
    id: 'process_payment',
    name: 'Process Payment',
    description: 'Record an offline fee payment',
    href: '/dashboard/staff/fee/payments/search',
    icon: CreditCard,
    iconColor: 'text-emerald-600',
    moduleCode: 'fee',
    requiredPermission: 'fee_management.add_feepaymentmodel',
  },
];