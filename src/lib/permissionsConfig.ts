// ─── permissionsConfig.ts ──────────────────────────────────────────────────────
// This is the ONLY file you need to edit when adding new modules or permissions.
// No colors, no icons, no UI — just data.
// Add a new module object to the array and it will automatically appear on the page.

export interface PermissionDef {
  codename: string;
  label: string;
  desc: string;
}

export interface AreaDef {
  key: string;
  label: string;
  description: string;
  permissions: PermissionDef[];
}

export interface ModuleDef {
  key: string;
  label: string;
  description: string;
  areas: AreaDef[];
}

export const MODULES: ModuleDef[] = [
  {
    key: 'human_resource',
    label: 'Human Resource',
    description: 'Staff, departments, leave and HR configuration',
    areas: [
      {
        key: 'staff_records',
        label: 'Staff Records',
        description: 'Manage staff profiles and bulk uploads',
        permissions: [
          { codename: 'view_staffmodel',          label: 'View Staff',              desc: 'Read staff profiles and records' },
          { codename: 'add_staffmodel',           label: 'Add Staff',               desc: 'Register and bulk upload staff' },
          { codename: 'change_staffmodel',        label: 'Edit Staff',              desc: 'Update staff details' },
          { codename: 'delete_staffmodel',        label: 'Delete Staff',            desc: 'Permanently remove staff records' },
        ],
      },
      {
        key: 'staff_security',
        label: 'Staff Security & Documents',
        description: 'Manage login credentials and sensitive documents',
        permissions: [
          { codename: 'view_staffprofilemodel',   label: 'View Logins',             desc: 'View staff login status' },
          { codename: 'manage_staffprofile',      label: 'Manage Logins',           desc: 'Create, edit, and reset staff credentials' },
          { codename: 'view_staffdocumentmodel',  label: 'View Documents',          desc: 'View staff uploaded documents' },
          { codename: 'manage_staff_documents',   label: 'Manage Documents',        desc: 'Upload, edit, and delete staff documents' },
        ],
      },
      {
        key: 'org_structure',
        label: 'Organisation Structure',
        description: 'Departments and positions',
        permissions: [
          { codename: 'view_departmentmodel',     label: 'View Departments',        desc: 'Read department data' },
          { codename: 'manage_department',        label: 'Manage Departments',      desc: 'Create, edit, and delete departments' },
          { codename: 'view_positionmodel',       label: 'View Positions',          desc: 'Read position data' },
          { codename: 'manage_position',          label: 'Manage Positions',        desc: 'Create, edit, and delete positions' },
        ],
      },
      {
        key: 'staff_config',
        label: 'Staff Configuration',
        description: 'HR settings and custom fields',
        permissions: [
          { codename: 'view_hrsettingmodel',          label: 'View HR Settings',    desc: 'Read HR configuration settings' },
          { codename: 'add_hrsettingmodel',           label: 'Manage HR Settings',  desc: 'Create and update HR settings' },
          { codename: 'view_customstafffieldmodel',   label: 'View Custom Fields',  desc: 'Read custom staff field definitions' },
          { codename: 'manage_customstafffield',      label: 'Manage Custom Fields',desc: 'Create, edit, and delete custom staff fields' },
        ],
      },
      {
        key: 'leave_management',
        label: 'Leave Management',
        description: 'View and process staff leave requests',
        permissions: [
          { codename: 'view_staffleavemodel',   label: 'View Leave Requests',    desc: 'See all submitted leave requests' },
          { codename: 'manage_leave',           label: 'Manage Leave',           desc: 'Submit, approve, update, and delete leave requests' },
        ],
      },
      {
        key: 'groups_permissions',
        label: 'Groups & Permissions',
        description: 'Manage roles and system access levels',
        permissions: [
          { codename: 'view_group',   label: 'View Groups',   desc: 'See existing permission groups' },
          { codename: 'add_group',    label: 'Create Groups', desc: 'Create new permission groups' },
          { codename: 'change_group', label: 'Edit Groups',   desc: 'Modify group names and assigned permissions' },
          { codename: 'delete_group', label: 'Delete Groups', desc: 'Remove permission groups' },
        ],
      }
    ],
  },
  {
    key: 'academic',
    label: 'Academic Structure',
    description: 'Classes, subjects, timetable, and academic setup',
    areas: [
      {
        key: 'academic_settings',
        label: 'Academic Settings',
        description: 'Global academic rules and grading configurations',
        permissions: [
          { codename: 'view_academicsettingmodel',  label: 'View Settings',   desc: 'Read academic settings' },
          { codename: 'manage_academic_settings',   label: 'Manage Settings', desc: 'Update academic rules and configurations' },
        ],
      },
      {
        key: 'class_management',
        label: 'Class Management',
        description: 'Classes, sections, and their configurations',
        permissions: [
          { codename: 'view_classmodel', label: 'View Classes',   desc: 'Read classes, sections, and configurations' },
          { codename: 'manage_classes',  label: 'Manage Classes', desc: 'Create, edit, and delete classes and sections' },
        ],
      },
      {
        key: 'subject_management',
        label: 'Subject Management',
        description: 'Subjects, subject groups, and class assignments',
        permissions: [
          { codename: 'view_subjectmodel', label: 'View Subjects',   desc: 'Read subjects and class assignments' },
          { codename: 'manage_subjects',   label: 'Manage Subjects', desc: 'Create, edit, and delete subjects and assignments' },
        ],
      },
      {
        key: 'timetable_management',
        label: 'Timetable',
        description: 'Class schedules and break times',
        permissions: [
          { codename: 'view_timetablemodel', label: 'View Timetable',   desc: 'Read class schedules' },
          { codename: 'manage_timetable',    label: 'Manage Timetable', desc: 'Create, edit, and delete timetable entries' },
        ],
      },
      {
        key: 'promotions_management',
        label: 'Promotions',
        description: 'Class promotion mappings and student academic history',
        permissions: [
          { codename: 'view_promotionmappingmodel', label: 'View Promotions',   desc: 'Read promotion rules and student history' },
          { codename: 'manage_promotions',          label: 'Manage Promotions', desc: 'Create, edit, and delete promotion mappings' },
        ],
      },
      {
        key: 'leadership_roles',
        label: 'Leadership Roles',
        description: 'Academic leadership positions (e.g., Head Teacher, Principal)',
        permissions: [
          { codename: 'view_leadershiprolemodel',  label: 'View Leadership Roles',   desc: 'Read leadership assignments' },
          { codename: 'manage_leadership_roles',   label: 'Manage Leadership Roles', desc: 'Assign, edit, and remove leadership roles' },
        ],
      },
    ],
  },

     {
    key: 'student',
    label: 'Student Management',
    description: 'Student, Parent, Guardians Record and Management',
    areas: [
      {
        key: 'student_records',
        label: 'Student Records',
        description: 'Manage student profiles and records',
        permissions: [
          { codename: 'view_studentmodel',     label: 'View Students',      desc: 'Read student profiles and records' },
          { codename: 'add_studentmodel',      label: 'Manage Students',    desc: 'Add and update student details' },
        ],
      },
      {
        key: 'parent_records',
        label: 'Parent & Guardian Records',
        description: 'Manage parent and guardian profiles',
        permissions: [
          { codename: 'view_parentmodel',     label: 'View Parents',       desc: 'Read parent and guardian records' },
          { codename: 'add_parentmodel',      label: 'Manage Parents',     desc: 'Add and update parent and guardian details' },
        ],
      },
      {
        key: 'student_profiles',
        label: 'Student Profiles',
        description: 'Manage extended student profile information',
        permissions: [
          { codename: 'view_studentprofilemodel',  label: 'View Profiles',   desc: 'Read student profile details' },
          { codename: 'add_studentprofilemodel',   label: 'Manage Profiles', desc: 'Add and update student profiles' },
        ],
      },
      {
        key: 'bulk_upload',
        label: 'Bulk Upload',
        description: 'Bulk uploading students and parents',
        permissions: [
          { codename: 'add_bulkstudentuploadmodel', label: 'Bulk Upload', desc: 'Upload multiple student and parent records' },
        ],
      },
      {
        key: 'student_statistics',
        label: 'Statistics',
        description: 'View students and parents statistics',
        permissions: [
          { codename: 'view_statistics', label: 'View Statistics', desc: 'Read student and parent statistic reports' },
        ],
      },
      {
        key: 'student_settings',
        label: 'Student Settings',
        description: 'Student management configuration',
        permissions: [
          { codename: 'view_studentsettingmodel', label: 'View Settings',   desc: 'Read student management settings' },
          { codename: 'add_studentsettingmodel',  label: 'Manage Settings', desc: 'Update student management settings' },
        ],
      },
    ],
  },

  {
    key: 'result',
    label: 'Result Management',
    description: 'Classes, subjects, timetable, and academic setup',
    areas: [
      {
        key: 'academic_settings',
        label: 'Academic Settings',
        description: 'Global academic rules and grading configurations',
        permissions: [
          { codename: 'view_academicsettingmodel',  label: 'View Settings',   desc: 'Read academic settings' },
          { codename: 'manage_academic_settings',   label: 'Manage Settings', desc: 'Update academic rules and configurations' },
        ],
      },
      {
        key: 'class_management',
        label: 'Class Management',
        description: 'Classes, sections, and their configurations',
        permissions: [
          { codename: 'view_classmodel', label: 'View Classes',   desc: 'Read classes, sections, and configurations' },
          { codename: 'manage_classes',  label: 'Manage Classes', desc: 'Create, edit, and delete classes and sections' },
        ],
      },
      {
        key: 'subject_management',
        label: 'Subject Management',
        description: 'Subjects, subject groups, and class assignments',
        permissions: [
          { codename: 'view_subjectmodel', label: 'View Subjects',   desc: 'Read subjects and class assignments' },
          { codename: 'manage_subjects',   label: 'Manage Subjects', desc: 'Create, edit, and delete subjects and assignments' },
        ],
      },
      {
        key: 'timetable_management',
        label: 'Timetable',
        description: 'Class schedules and break times',
        permissions: [
          { codename: 'view_timetablemodel', label: 'View Timetable',   desc: 'Read class schedules' },
          { codename: 'manage_timetable',    label: 'Manage Timetable', desc: 'Create, edit, and delete timetable entries' },
        ],
      },
      {
        key: 'promotions_management',
        label: 'Promotions',
        description: 'Class promotion mappings and student academic history',
        permissions: [
          { codename: 'view_promotionmappingmodel', label: 'View Promotions',   desc: 'Read promotion rules and student history' },
          { codename: 'manage_promotions',          label: 'Manage Promotions', desc: 'Create, edit, and delete promotion mappings' },
        ],
      },
      {
        key: 'leadership_roles',
        label: 'Leadership Roles',
        description: 'Academic leadership positions (e.g., Head Teacher, Principal)',
        permissions: [
          { codename: 'view_leadershiprolemodel',  label: 'View Leadership Roles',   desc: 'Read leadership assignments' },
          { codename: 'manage_leadership_roles',   label: 'Manage Leadership Roles', desc: 'Assign, edit, and remove leadership roles' },
        ],
      },
    ],
  },
    {
    key: 'finance',
    label: 'Finance',
    description: 'General ledger, student funding, expenses, and finance settings',
    areas: [
      {
        key: 'ledger_funding',
        label: 'Ledger & Funding',
        description: 'Income, expenses, and student funding records',
        permissions: [
          { codename: 'view_expensemodel',        label: 'View Ledger',          desc: 'Read income and expense entries' },
          { codename: 'add_expensemodel',         label: 'Add Ledger Entries',   desc: 'Create new income or expense entries' },
          { codename: 'change_expensemodel',      label: 'Edit Ledger Entries',  desc: 'Update existing ledger entries' },
          { codename: 'delete_expensemodel',      label: 'Delete Ledger Entries',desc: 'Permanently remove ledger entries' },
          { codename: 'view_studentfundingmodel',   label: 'View Student Funding',  desc: 'Read student funding records' },
          { codename: 'add_studentfundingmodel',    label: 'Add Student Funding',   desc: 'Create new student funding records' },
          { codename: 'change_studentfundingmodel', label: 'Edit Student Funding',  desc: 'Update existing student funding records' },
        ],
      },
      {
        key: 'finance_settings',
        label: 'Finance Settings',
        description: 'Singleton finance configuration',
        permissions: [
          { codename: 'view_financesettingmodel',   label: 'View Finance Settings',   desc: 'Read finance configuration settings' },
          { codename: 'change_financesettingmodel', label: 'Manage Finance Settings', desc: 'Update finance configuration settings' },
        ],
      },
    ],
  },
  {
    key: 'salary_management',
    label: 'Salary Management',
    description: 'Payroll processing, salary structures, bonuses, loans, and advances',
    areas: [
      {
        key: 'payroll_processing',
        label: 'Payroll Processing',
        description: 'Salary settings, structures, records, bonuses, loans, and advances',
        permissions: [
          { codename: 'view_salaryrecordmodel',   label: 'View Salary Records',   desc: 'Read salary settings, structures, records, bonuses, loans, and advances' },
          { codename: 'add_salaryrecordmodel',    label: 'Process Payroll',       desc: 'Create salary structures and process payroll records' },
          { codename: 'change_salaryrecordmodel', label: 'Edit Salary Records',   desc: 'Update salary settings, structures, and manage loans/advances' },
          { codename: 'delete_salaryrecordmodel', label: 'Delete Salary Records', desc: 'Permanently remove salary records, structures, or bonuses' },
        ],
      },
    ],
  },
  {
    key: 'fee_management',
    label: 'Fee Management',
    description: 'Invoices, payments, fee waivers, and payment gateway webhooks',
    areas: [
      {
        key: 'fee_operations',
        label: 'Fee Operations',
        description: 'Manage invoices, payments, and fee records',
        permissions: [
          { codename: 'manage_fees', label: 'Manage Fees', desc: 'Create and update invoices, payments, and fee records' },
        ],
      },
      {
        key: 'fee_waivers',
        label: 'Fee Waivers',
        description: 'Approve or reject fee waiver requests',
        permissions: [
          { codename: 'approve_fee_waiver', label: 'Approve/Reject Fee Waivers', desc: 'Review and decide on submitted fee waiver requests' },
        ],
      },
      {
        key: 'payment_confirmation',
        label: 'Payment Confirmation',
        description: 'Confirm parent/staff-submitted payments',
        permissions: [
          { codename: 'confirm_payment', label: 'Confirm Payments', desc: 'Verify and confirm submitted fee payments' },
        ],
      },
    ],
  },
    {
    key: 'inventory',
    label: 'Inventory & POS',
    description: 'Stock, suppliers, point of sale, and canteen debt controls',
    areas: [
      {
        key: 'catalog',
        label: 'Catalog',
        description: 'Items, categories, locations, and suppliers',
        permissions: [
          { codename: 'view_inventoryitemmodel',   label: 'View Catalog',   desc: 'Read items, categories, locations, and suppliers' },
          { codename: 'add_inventoryitemmodel',    label: 'Manage Catalog', desc: 'Create and update items, categories, locations, and suppliers' },
          { codename: 'delete_inventoryitemmodel', label: 'Delete Catalog', desc: 'Permanently remove items, categories, or suppliers' },
        ],
      },
      {
        key: 'stock_movements',
        label: 'Stock Movements',
        description: 'Stock in, stock out, and transfers between locations',
        permissions: [
          { codename: 'view_inventorystockinmodel', label: 'View Stock Movements',   desc: 'Read stock in, stock out, and transfer records' },
          { codename: 'add_inventorystockinmodel',  label: 'Manage Stock Movements', desc: 'Create stock in, stock out, and transfer entries' },
        ],
      },
      {
        key: 'pos_sales',
        label: 'Point of Sale',
        description: 'Process sales and refunds at the till',
        permissions: [
          { codename: 'add_inventorysalemodel', label: 'Process Sales & Refunds', desc: 'Place orders and refund completed sales' },
        ],
      },
      {
        key: 'pos_configuration',
        label: 'POS Configuration',
        description: 'Settings, shop access locking, and debt-purchase bans',
        permissions: [
          { codename: 'view_inventorysettingmodel', label: 'View POS Settings',   desc: 'Read discount, debt, payment method, and limit configuration' },
          { codename: 'add_inventorysettingmodel',  label: 'Manage POS Settings', desc: 'Configure discount, debt, payment methods, limits, and shop access assignments' },
        ],
      },
      {
        key: 'inventory_reports',
        label: 'Inventory Reports',
        description: 'Stock levels and sales reporting',
        permissions: [
          { codename: 'view_inventory_report', label: 'View Reports', desc: 'Read low-stock, sales summary, and top-selling reports' },
        ],
      },
    ],
  },
   {
    key: 'assessment',
    label: 'Assessment Permissions',
    description: 'Classes, subjects, timetable, and academic setup',
    areas: [
      {
        key: 'academic_settings',
        label: 'Academic Settings',
        description: 'Global academic rules and grading configurations',
        permissions: [
          { codename: 'view_academicsettingmodel',  label: 'View Settings',   desc: 'Read academic settings' },
          { codename: 'manage_academic_settings',   label: 'Manage Settings', desc: 'Update academic rules and configurations' },
        ],
      },
      {
        key: 'class_management',
        label: 'Class Management',
        description: 'Classes, sections, and their configurations',
        permissions: [
          { codename: 'view_classmodel', label: 'View Classes',   desc: 'Read classes, sections, and configurations' },
          { codename: 'manage_classes',  label: 'Manage Classes', desc: 'Create, edit, and delete classes and sections' },
        ],
      },
      {
        key: 'subject_management',
        label: 'Subject Management',
        description: 'Subjects, subject groups, and class assignments',
        permissions: [
          { codename: 'view_subjectmodel', label: 'View Subjects',   desc: 'Read subjects and class assignments' },
          { codename: 'manage_subjects',   label: 'Manage Subjects', desc: 'Create, edit, and delete subjects and assignments' },
        ],
      },
      {
        key: 'timetable_management',
        label: 'Timetable',
        description: 'Class schedules and break times',
        permissions: [
          { codename: 'view_timetablemodel', label: 'View Timetable',   desc: 'Read class schedules' },
          { codename: 'manage_timetable',    label: 'Manage Timetable', desc: 'Create, edit, and delete timetable entries' },
        ],
      },
      {
        key: 'promotions_management',
        label: 'Promotions',
        description: 'Class promotion mappings and student academic history',
        permissions: [
          { codename: 'view_promotionmappingmodel', label: 'View Promotions',   desc: 'Read promotion rules and student history' },
          { codename: 'manage_promotions',          label: 'Manage Promotions', desc: 'Create, edit, and delete promotion mappings' },
        ],
      },
      {
        key: 'leadership_roles',
        label: 'Leadership Roles',
        description: 'Academic leadership positions (e.g., Head Teacher, Principal)',
        permissions: [
          { codename: 'view_leadershiprolemodel',  label: 'View Leadership Roles',   desc: 'Read leadership assignments' },
          { codename: 'manage_leadership_roles',   label: 'Manage Leadership Roles', desc: 'Assign, edit, and remove leadership roles' },
        ],
      },
    ],
  },
];