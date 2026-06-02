/**
 * Shared dummy data for result template previews.
 * Used in the template selection page and nowhere else.
 * All templates draw from this single source for consistency.
 *
 * @file src/lib/result-template-dummy-data.ts
 */

// ─── School Info ───────────────────────────────────────────────────────────────
export const dummySchool = {
  name: 'Greenfield Academy',
  short_name: 'GFA',
  motto: 'Excellence in Learning, Character in Living',
  address: '14 Palm Avenue, Harmony Estate, Lagos State',
  email: 'info@greenfieldacademy.edu.ng',
  mobile_1: '08012345678',
  mobile_2: '08098765432',
  website: 'https://greenfieldacademy.edu.ng',
  // Use a reliable placeholder; real schools will have an actual URL
  logo: 'https://placehold.co/100x100/2c5f8d/ffffff?text=GFA',
};

// ─── Student Info ──────────────────────────────────────────────────────────────
export const dummyStudent = {
  id: 1001,
  first_name: 'Chidera',
  last_name: 'Okafor',
  full_name: 'Chidera Okafor',
  registration_number: 'GFA/2024/0087',
  gender: 'Female',
  image: '/images/default-avatar.png',
  current_class: { name: 'JSS 2' },
  class_section: 'A',
  no_in_class: 38,
  attendance: {
    present: 95,
    total: 100,
  },
};

// ─── Academic Period ───────────────────────────────────────────────────────────
export const dummyPeriod = {
  term: 'Second Term',
  session: '2024/2025',
  date_school_closed: '2025-03-28',
  next_term_open: '2025-04-28',
};

// ─── Score Result Data ─────────────────────────────────────────────────────────
// 12 subjects with realistic Nigerian secondary school scores.
export const dummyScoreSubjects = [
  { id: '1', name: 'English Language',    code: 'ENG' },
  { id: '2', name: 'Mathematics',         code: 'MTH' },
  { id: '3', name: 'Basic Science',       code: 'BSC' },
  { id: '4', name: 'Social Studies',      code: 'SST' },
  { id: '5', name: 'Civic Education',     code: 'CVE' },
  { id: '6', name: 'Agricultural Science',code: 'AGR' },
  { id: '7', name: 'Business Studies',    code: 'BUS' },
  { id: '8', name: 'Cultural & Creative', code: 'CCA' },
  { id: '9', name: 'Computer Science',    code: 'CMP' },
  { id: '10', name: 'Physical Education', code: 'PHE' },
  { id: '11', name: 'Home Economics',     code: 'HEC' },
  { id: '12', name: 'French',             code: 'FRN' },
];

// Score result data keyed by subject id (matches Django template pattern)
// Updated to include 'fields' sub-object to match the real API structure.
export const dummyScoreResult = {
  subjects: {
    '1':  { subject_code: 'ENG', subject_name: 'English Language', fields: { 'CA 1': 18, 'CA 2': 17, 'Exam': 58 }, total: 93, highest_in_class: 95, lowest_in_class: 42, average_score: 71, position: '2nd', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '2':  { subject_code: 'MTH', subject_name: 'Mathematics',      fields: { 'CA 1': 15, 'CA 2': 16, 'Exam': 52 }, total: 83, highest_in_class: 91, lowest_in_class: 38, average_score: 65, position: '4th', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '3':  { subject_code: 'BSC', subject_name: 'Basic Science',    fields: { 'CA 1': 17, 'CA 2': 15, 'Exam': 55 }, total: 87, highest_in_class: 90, lowest_in_class: 40, average_score: 68, position: '3rd', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '4':  { subject_code: 'SST', subject_name: 'Social Studies',   fields: { 'CA 1': 16, 'CA 2': 18, 'Exam': 50 }, total: 84, highest_in_class: 88, lowest_in_class: 35, average_score: 63, position: '5th', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '5':  { subject_code: 'CVE', subject_name: 'Civic Education',  fields: { 'CA 1': 19, 'CA 2': 18, 'Exam': 54 }, total: 91, highest_in_class: 93, lowest_in_class: 44, average_score: 70, position: '2nd', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '6':  { subject_code: 'AGR', subject_name: 'Agricultural Sci', fields: { 'CA 1': 14, 'CA 2': 15, 'Exam': 48 }, total: 77, highest_in_class: 85, lowest_in_class: 32, average_score: 60, position: '7th', number_of_student: 38, grade: 'B', remark: 'Very Good', has_exam: true },
    '7':  { subject_code: 'BUS', subject_name: 'Business Studies',  fields: { 'CA 1': 16, 'CA 2': 17, 'Exam': 51 }, total: 84, highest_in_class: 87, lowest_in_class: 38, average_score: 64, position: '4th', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '8':  { subject_code: 'CCA', subject_name: 'Cultural & Arts',  fields: { 'CA 1': 18, 'CA 2': 19, 'Exam': 56 }, total: 93, highest_in_class: 94, lowest_in_class: 50, average_score: 74, position: '2nd', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '9':  { subject_code: 'CMP', subject_name: 'Computer Science',  fields: { 'CA 1': 17, 'CA 2': 16, 'Exam': 53 }, total: 86, highest_in_class: 92, lowest_in_class: 41, average_score: 67, position: '3rd', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '10': { subject_code: 'PHE', subject_name: 'Physical Edu',      fields: { 'CA 1': 19, 'CA 2': 19, 'Exam': 57 }, total: 95, highest_in_class: 96, lowest_in_class: 55, average_score: 78, position: '1st', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '11': { subject_code: 'HEC', subject_name: 'Home Economics',   fields: { 'CA 1': 15, 'CA 2': 16, 'Exam': 49 }, total: 80, highest_in_class: 86, lowest_in_class: 36, average_score: 61, position: '6th', number_of_student: 38, grade: 'A', remark: 'Excellent', has_exam: true },
    '12': { subject_code: 'FRN', subject_name: 'French',           fields: { 'CA 1': 13, 'CA 2': 14, 'Exam': 45 }, total: 72, highest_in_class: 82, lowest_in_class: 30, average_score: 57, position: '9th', number_of_student: 38, grade: 'B', remark: 'Very Good', has_exam: true },
  },
  summary: {
    total_score: 1025,
    student_average: '85.4%',
    class_average: '66.8%',
    class_minimum: '32',
    position: '3rd',
    number_of_student: 38,
  },
};

// Score field list (matches Django field_list structure)
// Updated to use 'is_midterm' instead of 'mid_term' to match code expectations.
export const dummyFieldList = [
  { id: 1, name: 'CA 1',  max_mark: 20, is_midterm: true  },
  { id: 2, name: 'CA 2',  max_mark: 20, is_midterm: true },
  { id: 3, name: 'Exam',  max_mark: 60, is_midterm: false },
];

// ─── Text Result Data ──────────────────────────────────────────────────────────
export const dummyTextCategories = [
  {
    name: 'Language & Literacy',
    fields: [
      { name: 'Listening & Speaking',          value: 'Achieved'      },
      { name: 'Reading Comprehension',          value: 'Consolidating' },
      { name: 'Writing & Composition',          value: 'Achieved'      },
      { name: 'Phonics & Word Recognition',     value: 'Achieved'      },
    ],
  },
  {
    name: 'Mathematics & Numeracy',
    fields: [
      { name: 'Number Recognition & Counting',  value: 'Achieved'      },
      { name: 'Addition & Subtraction',         value: 'Consolidating' },
      { name: 'Shape & Space',                  value: 'Developing'    },
      { name: 'Measurement & Data',             value: 'Consolidating' },
    ],
  },
  {
    name: 'Science & Discovery',
    fields: [
      { name: 'Observation Skills',             value: 'Achieved'      },
      { name: 'Understanding of Nature',        value: 'Achieved'      },
      { name: 'Practical Investigation',        value: 'Consolidating' },
    ],
  },
  {
    name: 'Social & Emotional Development',
    fields: [
      { name: 'Cooperation & Teamwork',         value: 'Achieved'      },
      { name: 'Respect for Others',             value: 'Achieved'      },
      { name: 'Self-Confidence',                value: 'Consolidating' },
      { name: 'Emotional Regulation',           value: 'Developing'    },
    ],
  },
  {
    name: 'Creative Arts & Expression',
    fields: [
      { name: 'Drawing & Colouring',            value: 'Achieved'      },
      { name: 'Craft & Construction',           value: 'Achieved'      },
      { name: 'Music & Movement',               value: 'Consolidating' },
    ],
  },
  {
    name: 'Physical Development',
    fields: [
      { name: 'Gross Motor Skills',             value: 'Achieved'      },
      { name: 'Fine Motor Skills',              value: 'Consolidating' },
      { name: 'Health & Hygiene Awareness',     value: 'Achieved'      },
    ],
  },
];

// Text rating key (used in preview footer)
export const dummyTextRatingKey = [
  { value: 'Achieved',      label: 'Pupil can consistently perform task with confidence.' },
  { value: 'Consolidating', label: 'Pupil can perform task if given some support.'        },
  { value: 'Developing',    label: 'Pupil is beginning to perform the task.'              },
];

// ─── Behaviour Data ────────────────────────────────────────────────────────────
export const dummyBehavior = {
  categories: [
    {
      name: 'Affective Domain',
      items: [
        { name: 'Obedience',               score: 4 },
        { name: 'Confidence',              score: 4 },
        { name: 'Relationship with Others',score: 5 },
        { name: 'Politeness',              score: 5 },
        { name: 'Calmness',                score: 5 },
        { name: 'Punctuality',             score: 4 },
      ],
    },
    {
      name: 'Psychomotor',
      items: [
        { name: 'Neatness',                score: 5 },
        { name: 'Attitude to Work',        score: 4 },
        { name: 'Creativity',              score: 4 },
        { name: 'Sports & Games',          score: 5 },
        { name: 'Relationship with Teachers', score: 5 },
      ],
    },
  ],
};

// Flat ratings map (name → score) for template consumption
export const dummyBehaviorRatings: Record<string, number> = Object.fromEntries(
  dummyBehavior.categories.flatMap(c => c.items.map(i => [i.name, i.score]))
);

// ─── Grade List ────────────────────────────────────────────────────────────────
export const dummyGradeList = [
  { min_score: '70', max_score: '100', grade: 'A', remark: 'Excellent'  },
  { min_score: '60', max_score: '69',  grade: 'B', remark: 'Very Good'  },
  { min_score: '50', max_score: '59',  grade: 'C', remark: 'Good'       },
  { min_score: '40', max_score: '49',  grade: 'D', remark: 'Fair'       },
  { min_score: '0',  max_score: '39',  grade: 'F', remark: 'Poor'       },
];

export const dummyMidtermGradeList = [
  { min_score: '14', max_score: '20', grade: 'A', remark: 'Excellent' },
  { min_score: '10', max_score: '13', grade: 'B', remark: 'Good'      },
  { min_score: '0',  max_score: '9',  grade: 'F', remark: 'Poor'      },
];

// ─── Comments ──────────────────────────────────────────────────────────────────
export const dummyComments = {
  form_teacher: 'Mrs. Adaeze Nwosu',
  form_teacher_comment: 'Chidera has shown remarkable dedication this term. Her enthusiasm in class activities is commendable. Keep up the excellent work!',
  head_teacher: 'Mr. Emeka Obi',
  head_teacher_title: 'Principal',
  head_teacher_comment: 'An outstanding student who exemplifies the values of our school. We are proud of her achievements.',
  custom_comments: {
    'Area of Focus': 'Continue to strengthen Mathematics and French for even better results next term.',
    'Next Term Plan': 'Participate more in debate and public speaking clubs to build confidence.',
  },
  present_attendance: 95,
  total_attendance: 100,
};

// ─── Result Settings (mock — mirrors real ResultSettings shape) ────────────────
export const dummySettings = {
  primary_color:   '#2c5f8d',
  secondary_color: '#f0f4f8',
  header_color:    '#2c5f8d',
  accent_color:    '#1890ff',
  use_midterm: false,
  midterm_max_score: '20.00',
  convert_midterm_to_100: false,
  show_end_of_term_graph: true,
  show_midterm_graph: false,
  show_behavior_on_score_result: true,
  show_behavior_on_text_result: false,
  show_behavior_on_combined_result: true,
  behavior_max_rating: 5,
  enable_custom_comment_fields: true,
  custom_comment_fields: ['Area of Focus', 'Next Term Plan'],
  score_template: 'score_1_default',
  text_template: 'text_1_default',
  combined_template: 'combined_1_default',
};