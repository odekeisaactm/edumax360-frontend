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
        { codename: 'view_academic_settings',  label: 'View Settings',   desc: 'Read academic settings' },
        { codename: 'manage_academic_settings',   label: 'Manage Settings', desc: 'Update academic rules and configurations' },
      ],
    },
    {
      key: 'academic_setup',
      label: 'Academic Setup',
      description: 'Classes, sections, configurations, and core subjects',
      permissions: [
        { codename: 'view_academic_setup', label: 'View Academic Setup',   desc: 'Read classes, subjects, and configs' },
        { codename: 'manage_academic_setup',  label: 'Manage Academic Setup', desc: 'Create, edit, and delete classes, sections, and core subjects' },
      ],
    },
    {
      key: 'subject_groups',
      label: 'Subject Groups',
      description: 'Elective groups and subject combinations',
      permissions: [
        { codename: 'view_subject_groups', label: 'View Subject Groups',   desc: 'Read subject groups' },
        { codename: 'manage_subject_groups',   label: 'Manage Subject Groups', desc: 'Create and manage elective subject groups' },
      ],
    },
    {
      key: 'timetable_management',
      label: 'Timetable',
      description: 'Class schedules and break times',
      permissions: [
        { codename: 'view_timetable', label: 'View Timetable',   desc: 'Read class schedules' },
        { codename: 'manage_timetable',    label: 'Manage Timetable', desc: 'Create, edit, and delete timetable entries' },
      ],
    },
    {
      key: 'promotions_management',
      label: 'Promotions',
      description: 'Class promotion mappings moving students to next class',
      permissions: [
        { codename: 'view_promotions', label: 'View Promotions',   desc: 'Read promotion rules' },
        { codename: 'manage_promotions',          label: 'Manage Promotions', desc: 'Configure end-of-session promotion mappings' },
      ],
    },
    {
      key: 'leadership_roles',
      label: 'Leadership Roles',
      description: 'Academic leadership positions (e.g., Head Teacher, Principal)',
      permissions: [
        { codename: 'view_leadership_roles',  label: 'View Leadership Roles',   desc: 'Read leadership assignments' },
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
  description: 'Result upload, publishing, and grading configuration',
  areas: [
    {
      key: 'result_records',
      label: 'Result Records',
      description: 'Score and text result entry',
      permissions: [
        { codename: 'view_resultmodel',   label: 'View Results',       desc: 'Read student score and text results' },
        { codename: 'change_resultmodel', label: 'Enter/Edit Results', desc: 'Upload or update score and text results' },
      ],
    },
    {
      key: 'result_publishing',
      label: 'Publishing',
      description: 'Release results to students and parents',
      permissions: [
        { codename: 'can_publish_result', label: 'Publish/Unpublish Results', desc: 'Release or withhold results from students and parents' },
      ],
    },
    {
      key: 'result_archive',
      label: 'Past Results',
      description: 'Access to prior terms/sessions',
      permissions: [
        { codename: 'view_past_result', label: 'View Past Results', desc: 'Read archived results from previous terms/sessions' },
        { codename: 'edit_past_result', label: 'Edit Past Results', desc: 'Modify archived results from previous terms/sessions' },
      ],
    },
    {
      key: 'result_statistics',
      label: 'Statistics & Analytics',
      description: 'Class and student performance analytics',
      permissions: [
        { codename: 'view_resultstatisticsmodel', label: 'View Analytics', desc: 'Read result statistics and performance analytics' },
      ],
    },
    {
      key: 'result_settings',
      label: 'Result Settings',
      description: 'Core toggles: who can upload, view windows, publishing rules',
      permissions: [
        { codename: 'view_resultsettingsmodel',   label: 'View Settings',   desc: 'Read result settings' },
        { codename: 'change_resultsettingsmodel', label: 'Manage Settings', desc: 'Update result settings' },
      ],
    },
    {
      key: 'result_configuration',
      label: 'Configuration',
      description: 'Grade sets, field sets, groups, behavior categories, comment and text templates',
      permissions: [
        { codename: 'view_result_configuration',   label: 'View Configuration',   desc: 'Read grade sets, field sets, groups, behavior categories, and templates' },
        { codename: 'manage_result_configuration', label: 'Manage Configuration', desc: 'Create, edit, and delete grade sets, field sets, groups, behavior categories, and templates' },
      ],
    },
  ],
},
    {
  key: 'finance',
  label: 'Finance & Ledger',
  description: 'Income, expenses, wallet funding, procurement, and banking ledgers',
  areas: [
    {
      key: 'income_expenses',
      label: 'Income & Expenses',
      description: 'Manage general school income and expenditure records',
      permissions: [
        { codename: 'view_incomemodel',    label: 'View Income',   desc: 'Read general income records and categories' },
        { codename: 'add_incomemodel',     label: 'Manage Income', desc: 'Create and edit income records' },
        { codename: 'view_expensemodel',   label: 'View Expenses', desc: 'Read general expense records and categories' },
        { codename: 'add_expensemodel',    label: 'Manage Expenses', desc: 'Create and edit expense records' },
      ],
    },
    {
      key: 'wallet_funding',
      label: 'Wallet Activities',
      description: 'Fund student and staff wallets, and manage internal transfers',
      permissions: [
        { codename: 'view_studentfundingmodel',  label: 'View Student Funding', desc: 'Read student wallet deposits' },
        { codename: 'add_studentfundingmodel',   label: 'Fund Student Wallets', desc: 'Create and confirm student wallet deposits' },
        { codename: 'view_stafffundingmodel',    label: 'View Staff Funding',   desc: 'Read staff wallet deposits' },
        { codename: 'add_stafffundingmodel',     label: 'Fund Staff Wallets',   desc: 'Create and confirm staff wallet deposits' },
        { codename: 'view_wallettransfermodel',  label: 'View Wallet Transfers',desc: 'Read cross-wallet and sibling transfers' },
        { codename: 'add_wallettransfermodel',   label: 'Manage Wallet Transfers',desc: 'Process internal wallet transfers' },
      ],
    },
    {
      key: 'procurement',
      label: 'Procurement & Advances',
      description: 'Settle purchase orders and manage staff purchase advances',
      permissions: [
        { codename: 'view_supplierpaymentmodel',          label: 'View Supplier Payments',  desc: 'Read payments made to suppliers' },
        { codename: 'add_supplierpaymentmodel',           label: 'Manage Supplier Payments',desc: 'Record payments against purchase orders' },
        { codename: 'view_purchaseadvancepaymentmodel',   label: 'View Advance Payments',   desc: 'Read staff purchase advance disbursements' },
        { codename: 'add_purchaseadvancepaymentmodel',    label: 'Manage Advance Payments', desc: 'Disburse purchase advances and process settlements' },
      ],
    },
    {
      key: 'banking_ledger',
      label: 'Banking & Audit Ledger',
      description: 'Manage school bank accounts, physical cash vaults, and view immutable ledgers',
      permissions: [
        { codename: 'view_schoolbankdetailmodel', label: 'View Bank Accounts', desc: 'Read school bank accounts and cash vaults' },
        { codename: 'add_schoolbankdetailmodel',  label: 'Manage Bank Accounts', desc: 'Create/edit bank accounts and perform manual balance adjustments' },
        { codename: 'view_banktransactionmodel',  label: 'View Audit Ledgers', desc: 'Read the immutable bank, cash, and wallet transaction ledgers' },
      ],
    },
    {
      key: 'finance_settings',
      label: 'Finance Configuration',
      description: 'Manage global finance rules and payment gateways',
      permissions: [
        { codename: 'view_financesettingmodel',     label: 'View Settings',    desc: 'Read finance policies and active payment gateways' },
        { codename: 'change_financesettingmodel',   label: 'Manage Settings',  desc: 'Update global finance rules, reversal windows, and auto-confirm settings' },
        { codename: 'add_paymentgatewayconfigmodel',label: 'Manage Gateways',  desc: 'Add and configure online payment gateway credentials' },
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
    description: 'Fee structures, student & family invoicing, payment verification, and concessions',
    areas: [
      {
        key: 'structures_settings',
        label: 'Fee Structures & Settings',
        description: 'Define fee items, termly price lists, and bursary rules',
        permissions: [
          { codename: 'view_feemodel',          label: 'View Fee Catalog',          desc: 'Read fee items, groups, and pricing structures' },
          { codename: 'manage_fees',            label: 'Manage Fee Structures',     desc: 'Create, edit, and delete fee items, price lists, and billing structures' },
          { codename: 'view_feesettingmodel',   label: 'View Fee Settings',         desc: 'Read automated billing rules, reminder intervals, and WhatsApp bot configs' },
          { codename: 'change_feesettingmodel', label: 'Manage Fee Settings',       desc: 'Update automated billing, proof upload controls, and reminder settings' },
        ],
      },
      {
        key: 'invoicing_billing',
        label: 'Invoicing & Ancillary Debts',
        description: 'Student invoices, shared family bills, fines, and batch generation',
        permissions: [
          { codename: 'view_invoicemodel',        label: 'View Invoices & Bills',   desc: 'Read student invoices, shared family bills, and financial dashboards' },
          { codename: 'add_invoicemodel',         label: 'Generate Invoices',       desc: 'Create single student/family invoices and trigger bulk termly billing runs' },
          { codename: 'change_invoicemodel',      label: 'Edit & Void Invoices',    desc: 'Add/remove bill items, apply correction batches, and void erroneous invoices' },
          { codename: 'view_otherpaymentmodel',   label: 'View Ancillary Debts',    desc: 'Read library fines, property damage charges, and historical carry-over debts' },
          { codename: 'add_otherpaymentmodel',    label: 'Record Ancillary Debts',  desc: 'Issue fines, damage charges, and miscellaneous fees to students' },
        ],
      },
      {
        key: 'collections_verification',
        label: 'Payment Collections & Verification',
        description: 'Record desk payments, verify bank transfers, and audit webhooks',
        permissions: [
          { codename: 'view_feepaymentmodel',     label: 'View Payments & Receipts',desc: 'Read student/family payment records, proofs of payment, and receipts' },
          { codename: 'add_feepaymentmodel',      label: 'Record Desk Payments',    desc: 'Submit cash, POS, teller, and wallet fee payments at the bursary desk' },
          { codename: 'confirm_payment',          label: 'Confirm & Revert Payments',desc: 'Verify bank transfers, confirm pending proof uploads, and reverse cleared payments' },
        ],
      },
      {
        key: 'concessions_waivers',
        label: 'Discounts & Fee Waivers',
        description: 'Staff child concessions, scholarship tiers, and debt waivers',
        permissions: [
          { codename: 'view_discountmodel',       label: 'View Concessions',        desc: 'Read master discounts, class promotion tiers, and student enrollments' },
          { codename: 'add_discountmodel',        label: 'Manage Concessions',      desc: 'Create discounts, configure class tiers, and enroll students into concessions' },
          { codename: 'view_feewaivermodel',      label: 'View Waiver Requests',    desc: 'Read submitted fee waiver requests and historical decisions' },
          { codename: 'approve_fee_waiver',       label: 'Approve / Reject Waivers',desc: 'Review, approve, or reject pending fee reduction and waiver requests' },
        ],
      },
    ],
  },
    {
  key: 'inventory',
  label: 'Inventory & POS',
  description: 'Stock, suppliers, point of sale, procurement, and collections',
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
      key: 'procurement',
      label: 'Procurement',
      description: 'Purchase orders, advances, and market runs',
      permissions: [
        { codename: 'view_inventorypurchaseordermodel', label: 'View Procurement', desc: 'Read purchase orders and staff advances' },
        { codename: 'add_inventorypurchaseordermodel', label: 'Manage Procurement', desc: 'Create and process purchase orders and staff advances' },
      ],
    },
    {
      key: 'assignments',
      label: 'Assignments & Collections',
      description: 'Bulk inventory distribution and student collections',
      permissions: [
        { codename: 'view_inventoryassignmentmodel', label: 'View Assignments', desc: 'Read inventory assignments and collection records' },
        { codename: 'add_inventoryassignmentmodel', label: 'Manage Assignments', desc: 'Create assignments and process student collections' },
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
  key: 'attendance',
  label: 'Attendance Management',
  description: 'Gate/class attendance, devices, exceptions, pickups, visitors, and settings',
  areas: [
    {
      key: 'attendance_records',
      label: 'Attendance Records',
      description: 'Daily gate, class, and subject attendance records',
      permissions: [
        { codename: 'view_attendancedailyrecordmodel', label: 'View Records',   desc: 'Read student and staff daily attendance records' },
        { codename: 'view_attendanceeventmodel',        label: 'View Raw Events', desc: 'Read the raw tap/scan/manual event log' },
        { codename: 'add_attendanceeventmodel',         label: 'Record Manual Attendance', desc: 'Enter manual roll call and correction entries' },
      ],
    },
    {
      key: 'attendance_devices',
      label: 'Devices & Credentials',
      description: 'Gate hardware and PIN-to-person mapping',
      permissions: [
        { codename: 'view_attendancedevicemodel',   label: 'View Devices',       desc: 'Read registered gate/enrollment devices' },
        { codename: 'add_attendancedevicemodel',    label: 'Manage Devices',     desc: 'Add, edit, and remove devices' },
        { codename: 'view_devicecredentialmodel',   label: 'View Credentials',   desc: 'Read PIN-to-student/staff/parent mappings' },
        { codename: 'add_devicecredentialmodel',    label: 'Manage Credentials', desc: 'Enroll and edit device PIN mappings' },
      ],
    },
    {
      key: 'attendance_exceptions',
      label: 'Exceptions & Excursions',
      description: 'Planned overrides for trips, bus departures, and approved early pickups',
      permissions: [
        { codename: 'view_attendanceexceptionmodel',   label: 'View Exceptions',   desc: 'Read excursion/exception records' },
        { codename: 'add_attendanceexceptionmodel',    label: 'Manage Exceptions', desc: 'Create and edit excursion/exception records' },
      ],
    },
    {
      key: 'attendance_pickups',
      label: 'Pickup Log',
      description: 'Who collected a student and when',
      permissions: [
        { codename: 'view_pickuplogmodel', label: 'View Pickups',   desc: 'Read pickup records' },
        { codename: 'add_pickuplogmodel',  label: 'Record Pickups', desc: 'Log a student pickup' },
      ],
    },
    {
      key: 'attendance_visitors',
      label: 'Visitor Management',
      description: 'Front-desk sign-in/out and repeat-visitor identities',
      permissions: [
        { codename: 'view_visitorlogmodel',   label: 'View Visitor Log', desc: 'Read visitor sign-in/out records' },
        { codename: 'add_visitorlogmodel',    label: 'Manage Visitor Log', desc: 'Sign visitors in and out' },
        { codename: 'view_knownvisitormodel', label: 'View Known Visitors', desc: 'Read repeat-visitor identities' },
        { codename: 'add_knownvisitormodel',  label: 'Manage Known Visitors', desc: 'Register and edit repeat-visitor identities' },
      ],
    },
    {
      key: 'attendance_events',
      label: 'Event Attendance',
      description: 'Check-in for physical, online, and hybrid events',
      permissions: [
        { codename: 'view_eventattendancerecordmodel', label: 'View Event Attendance', desc: 'Read event check-in/join records' },
      ],
    },
    {
      key: 'attendance_settings',
      label: 'Attendance Settings',
      description: 'Time windows, methods per scope, escalation timers, notification rules',
      permissions: [
        { codename: 'view_attendancesettingmodel',      label: 'View Settings',   desc: 'Read attendance settings' },
        { codename: 'manage_attendance_settings',       label: 'Manage Settings', desc: 'Update attendance settings' },
      ],
    },
  ],
},
   {
    key: 'communication',
    label: 'Communication & Messaging',
    description: 'Bulk campaigns, admission enquiries, announcements, queries, and communication config',
    areas: [
      {
        key: 'bulk_messaging',
        label: 'Bulk Messaging',
        description: 'Manage and send SMS, Email, and WhatsApp campaigns',
        permissions: [
          { codename: 'view_bulkmessagecampaignmodel', label: 'View Campaigns', desc: 'Read bulk message campaigns' },
          { codename: 'add_bulkmessagecampaignmodel',  label: 'Create Campaigns', desc: 'Draft new bulk message campaigns' },
          { codename: 'send_bulk_campaign',            label: 'Send Campaigns', desc: 'Queue and dispatch campaigns to recipients' },
        ],
      },
      {
        key: 'admission_enquiries',
        label: 'Admission Enquiries',
        description: 'Track prospective students and lead pipeline',
        permissions: [
          { codename: 'view_admissionenquirymodel',   label: 'View Enquiries', desc: 'Read prospective student enquiries' },
          { codename: 'add_admissionenquirymodel',    label: 'Add Enquiries',  desc: 'Log new admission enquiries' },
          { codename: 'change_admissionenquirymodel', label: 'Manage Enquiries', desc: 'Update and convert enquiries to enrolled students' },
        ],
      },
      {
        key: 'announcements_marquee',
        label: 'Announcements & Portal Messages',
        description: 'School-wide announcements and scrolling marquee alerts',
        permissions: [
          { codename: 'view_announcementmodel',   label: 'View Announcements', desc: 'Read published announcements' },
          { codename: 'add_announcementmodel',    label: 'Manage Announcements', desc: 'Create and target school announcements' },
          { codename: 'view_marqueemessagemodel', label: 'View Marquee Messages', desc: 'Read active marquee alerts' },
          { codename: 'add_marqueemessagemodel',  label: 'Manage Marquee Messages', desc: 'Create and target portal-top marquee messages' },
        ],
      },
      {
        key: 'queries_helpdesk',
        label: 'Queries & Helpdesk',
        description: 'General queries, complaints, and follow-up threading',
        permissions: [
          { codename: 'view_querymodel',   label: 'View Queries', desc: 'Read incoming queries and complaints' },
          { codename: 'change_querymodel', label: 'Manage Queries', desc: 'Assign, reply to, and resolve queries' },
        ],
      },
      {
        key: 'communication_config',
        label: 'Communication Configuration',
        description: 'Custom contacts, gateways (SMTP/SMS/WhatsApp), and settings',
        permissions: [
          { codename: 'view_customcontactmodel',        label: 'View Custom Contacts', desc: 'Read manually added contacts' },
          { codename: 'add_customcontactmodel',         label: 'Manage Custom Contacts', desc: 'Create and update custom contacts' },
          { codename: 'view_communicationsettingmodel', label: 'View Config & Settings', desc: 'Read communication and gateway configurations' },
          { codename: 'manage_communication_settings',  label: 'Manage Config & Settings', desc: 'Configure WhatsApp, SMS, SMTP, templates, and global rules' },
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