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
    key: 'assesment',
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